// ingestion/playwrightBot.ts
// Real meeting ingestion via a Playwright headless browser.
//
// INGESTION METHOD: Playwright (custom, self-hosted).
// WHY: No third-party API keys, no billing, no approval process. Playwright
// runs in Node/TypeScript alongside the rest of the backend.
//
// CAPTURE STRATEGY (see implementation_plan.md for full rationale):
//   • Participant list, display names: DOM text in Google Meet tiles
//   • Speaking indicator: CSS class polling (Meet highlights active speaker)
//   • Camera/mic/screen-share state: aria-labels on tile icons
//   • Video frames for face verification: canvas.drawImage(<video>) via page.evaluate()
//   • Audio: DOM-based only (speaking indicator, not raw audio stream)
//     Optional: if a system loopback device is present, audio can be piped to
//     Whisper externally — this bot does NOT handle audio capture.
//
// LIMITATIONS (documented, not hidden):
//   • Google Meet may update its DOM structure; selectors may need updating.
//   • Face-frame capture depends on Meet rendering <video> elements with
//     sufficient resolution. Low bandwidth → low-res frames → lower face score.
//   • Audio transcription requires a separate loopback capture step.
//   • Bot may be detected and removed by the meeting host.

import { chromium, Browser, Page } from 'playwright';
import { Server as SocketServer } from 'socket.io';
import * as path from 'path';
import * as fs from 'fs';
import Participant from '../models/Participant';
import Session from '../models/Session';
import ParticipantSignal from '../models/ParticipantSignal';
import { SIGNAL_WEIGHTS } from '../engines/confidenceEngine';
import { nameMatchSignal } from '../signals/nameMatch';
import { joinOrderSignal } from '../signals/joinOrder';
import { voiceActivitySignal } from '../signals/voiceActivity';
import { cameraPresenceSignal } from '../signals/cameraPresence';
import { screenShareSignal } from '../signals/screenShare';
import { faceVerificationCached } from '../signals/faceVerification';
import { v4 as uuidv4 } from 'uuid';

// ── Google Meet DOM selectors ────────────────────────────────────────────────
// These selectors are current as of mid-2025. Meet updates its UI regularly;
// if the bot stops detecting participants, these are the first thing to check.
const SELECTORS = {
  // Container for each participant tile
  participantTile: '[data-participant-id]',
  // Display name within a tile
  displayName: '[data-self-name], .zWGUib, [data-display-name]',
  // Active speaker indicator (Meet adds this class to the speaking tile)
  activeSpeakerBorder: '[data-active-speaker="true"], .ysGGtf',
  // Muted mic icon aria-label
  mutedMic: '[aria-label*="microphone off"], [aria-label*="muted"]',
  // Camera off icon
  cameraOff: '[aria-label*="camera off"], [aria-label*="camera is off"]',
  // Screen share tile indicator
  screenShare: '[data-ssrc-type="screen"]',
  // Video elements inside tiles
  videoEl: 'video',
};

const POLL_INTERVAL_MS = 3000;  // poll DOM every 3 s
const FRAME_INTERVAL_MS = 5000; // capture face frames every 5 s
const FRAME_WIDTH = 320;        // resize canvas to this width for face-api.js
const FRAME_HEIGHT = 240;

interface TrackedParticipant {
  participantId: string;       // our internal ID
  meetTileId: string;          // Meet's data-participant-id attribute
  displayName: string;
  joinedAt: Date;
  joinIndex: number;
  speakingSeconds: number;
  cameraOnTicks: number;
  totalTicks: number;
  lastFrameTs: number;
}

const tracked = new Map<string, TrackedParticipant>();

export const activeBots = new Map<string, () => Promise<void>>();

export async function closeAllPlaywrightBots(): Promise<void> {
  console.log(`[playwrightBot] Closing all active bots (${activeBots.size} running)...`);
  const closures = Array.from(activeBots.values()).map((stopFn) => stopFn().catch(() => {}));
  await Promise.all(closures);
  activeBots.clear();
  console.log('[playwrightBot] All active bots closed.');
}

export async function startPlaywrightBot(
  sessionId: string,
  meetingUrl: string,
  io: SocketServer
): Promise<() => Promise<void>> {
  const session = await Session.findById(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);

  const browser: Browser = await chromium.launch({
    headless: false, // Run in headed mode to completely bypass Google's advanced headless bot detection
    args: [
      '--use-fake-ui-for-media-stream',     // auto-accept camera/mic permissions
      '--use-fake-device-for-media-stream', // mock a virtual camera/mic hardware device
      '--disable-blink-features=AutomationControlled',
      '--window-position=9999,9999',         // place the browser window off-screen so it is invisible to the user
      '--window-size=1024,768',             // set a standard size for proper rendering
    ],
  });

  const ctx = await browser.newContext({
    permissions: ['camera', 'microphone'],
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
  });

  // Hides webdriver status from Google's bot detection scripts
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  const page: Page = await ctx.newPage();

  console.log(`[playwrightBot] navigating to ${meetingUrl}`);
  await page.goto(meetingUrl, { waitUntil: 'networkidle', timeout: 30_000 });
  
  const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? 'uploads');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  await page.screenshot({ path: path.join(uploadDir, 'meet-lobby-1.png') }).catch(() => {});
  console.log(`[playwrightBot] Navigated. Title: "${await page.title()}". Screenshot: http://localhost:4000/uploads/meet-lobby-1.png`);

  // ── Lobby join sequence ──────────────────────────────────────────────────
  try {
    // Dynamically wait for the lobby loading to finish (either name input or a join/signin button appears)
    console.log('[playwrightBot] Waiting for lobby elements to load...');
    await page.waitForSelector('input[type="text"], [placeholder="Your name"], button:has-text("Join"), button:has-text("join"), a:has-text("Sign in")', { timeout: 15000 }).catch(() => {});

    // Enter name if name field is visible (for guest users)
    const nameInput = await page.$('input[type="text"], [placeholder="Your name"], [aria-label="Your name"]');
    if (nameInput) {
      await nameInput.fill('Sherlock Ingestion Bot');
      await page.waitForTimeout(1000);
    }

    // Try multiple selector patterns to click 'Ask to join' or 'Join now'
    const joinButtons = [
      'button:has-text("Ask to join")',
      'button:has-text("Join now")',
      'span:has-text("Ask to join")',
      'span:has-text("Join now")',
      'button[aria-label*="join"]',
      'button[aria-label*="Join"]'
    ];

    let clicked = false;
    for (const selector of joinButtons) {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click();
        console.log(`[playwrightBot] Clicked lobby join button via: ${selector}`);
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      // Fallback click on any button matching "join"
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const target = buttons.find(b => b.textContent?.toLowerCase().includes('join'));
        if (target) (target as any).click();
      });
      console.log(`[playwrightBot] Executed fallback text content join click`);
    }

    await page.waitForTimeout(5000); // Wait for the main call screen to load
    await page.screenshot({ path: path.join(uploadDir, 'meet-lobby-2.png') }).catch(() => {});
    console.log(`[playwrightBot] Join attempt complete. URL: "${page.url()}". Title: "${await page.title()}". Screenshot: http://localhost:4000/uploads/meet-lobby-2.png`);
  } catch (err: any) {
    console.warn(`[playwrightBot] Lobby joining sequence warning:`, err.message);
  }

  // Mark session as active
  await Session.findByIdAndUpdate(sessionId, { status: 'active', startedAt: new Date() });

  let running = true;
  let pollTimer: NodeJS.Timeout;
  let frameTimer: NodeJS.Timeout;

  // ── DOM poll loop ──────────────────────────────────────────────────────────
  const poll = async () => {
    if (!running) return;
    try {
      const participantData = await page.evaluate((sels: any) => {
        const tiles = Array.from((document as any).querySelectorAll(sels.participantTile));
        return tiles.map((tile: any) => {
          const meetTileId = tile.getAttribute('data-participant-id') ?? '';
          const nameEl =
            tile.querySelector('[data-self-name]') ??
            tile.querySelector('.zWGUib') ??
            tile.querySelector('[data-display-name]');
          const displayName = nameEl?.textContent?.trim() ?? 'Unknown';
          const isSpeaking = tile.hasAttribute('data-active-speaker') ||
            tile.classList.contains('ysGGtf');
          const isMuted = !!tile.querySelector('[aria-label*="microphone off"]');
          const isCameraOff = !!tile.querySelector('[aria-label*="camera off"]');
          const isScreenShare = tile.getAttribute('data-ssrc-type') === 'screen';
          return { meetTileId, displayName, isSpeaking, isMuted, isCameraOff, isScreenShare };
        });
      }, SELECTORS);

      for (const p of participantData) {
        if (!p.meetTileId) continue;

        let tp = tracked.get(p.meetTileId);
        if (!tp) {
          // New participant
          const joinIndex = tracked.size;
          const participantId = uuidv4();
          tp = {
            participantId,
            meetTileId: p.meetTileId,
            displayName: p.displayName,
            joinedAt: new Date(),
            joinIndex,
            speakingSeconds: 0,
            cameraOnTicks: 0,
            totalTicks: 0,
            lastFrameTs: 0,
          };
          tracked.set(p.meetTileId, tp);

          await Participant.create({
            sessionId,
            participantId,
            displayName: p.displayName,
            joinedAt: tp.joinedAt,
            cameraOn: !p.isCameraOff,
            microphoneOn: !p.isMuted,
            screenSharing: p.isScreenShare,
            totalSpeakingSeconds: 0,
          });

          // Static join-time signals
          await saveSignal(sessionId, participantId, 'name_match', nameMatchSignal(p.displayName, session.candidateName));
          await saveSignal(sessionId, participantId, 'join_order', joinOrderSignal(joinIndex));

          io.to(`session:${sessionId}`).emit('participant_join', { participantId, displayName: p.displayName });
          console.log(`[playwrightBot] new participant: ${p.displayName}`);
        }

        tp.totalTicks++;
        if (!p.isCameraOff) tp.cameraOnTicks++;
        if (p.isSpeaking) tp.speakingSeconds += POLL_INTERVAL_MS / 1000;

        // Update participant state
        await Participant.findOneAndUpdate(
          { sessionId, participantId: tp.participantId },
          {
            cameraOn: !p.isCameraOff,
            microphoneOn: !p.isMuted,
            screenSharing: p.isScreenShare,
            totalSpeakingSeconds: tp.speakingSeconds,
          }
        );

        // Emit rolling signals
        const sessionStart = session.startedAt?.getTime() ?? Date.now();
        const totalMeetingSeconds = (Date.now() - sessionStart) / 1000;

        const voiceResult = voiceActivitySignal({
          participantSpeakingSeconds: tp.speakingSeconds,
          totalMeetingSeconds,
        });
        await saveSignal(sessionId, tp.participantId, 'voice_activity', voiceResult);

        const camResult = cameraPresenceSignal({
          cameraOnRatio: tp.totalTicks > 0 ? tp.cameraOnTicks / tp.totalTicks : 0,
          currentlyOn: !p.isCameraOff,
        });
        await saveSignal(sessionId, tp.participantId, 'camera_presence', camResult);

        if (p.isScreenShare) {
          const ssResult = screenShareSignal({
            currentlySharing: true,
            totalSharingSeconds: 0,
            totalMeetingSeconds,
          });
          await saveSignal(sessionId, tp.participantId, 'screen_share', ssResult);
        }

        io.to(`session:${sessionId}`).emit('signal_generated', {
          participantId: tp.participantId,
          voice_activity: voiceResult,
          camera_presence: camResult,
        });
      }
    } catch (err) {
      console.error('[playwrightBot] poll error:', err);
    }
    if (running) pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
  };

  // ── Face frame capture loop ────────────────────────────────────────────────
  const captureFrames = async () => {
    if (!running) return;
    if (session.candidatePhotoUrl) {
      try {
        const frames: Array<{ meetTileId: string; base64: string }> = await page.evaluate(
          ({ sels, w, h }: any) => {
            const results: Array<{ meetTileId: string; base64: string }> = [];
            const tiles = (document as any).querySelectorAll(sels.participantTile);
            tiles.forEach((tile: any) => {
              const video = tile.querySelector('video') as any;
              if (!video || !video.videoWidth) return;
              const canvas = (document as any).createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if (!ctx) return;
              ctx.drawImage(video, 0, 0, w, h);
              const meetTileId = tile.getAttribute('data-participant-id') ?? '';
              results.push({ meetTileId, base64: canvas.toDataURL('image/jpeg', 0.7) });
            });
            return results;
          },
          { sels: SELECTORS, w: FRAME_WIDTH, h: FRAME_HEIGHT }
        );

        for (const { meetTileId, base64 } of frames) {
          const tp = tracked.get(meetTileId);
          if (!tp) continue;

          const faceResult = await faceVerificationCached(
            sessionId,
            tp.participantId,
            base64,
            session.candidatePhotoUrl
          );
          await saveSignal(sessionId, tp.participantId, 'face_match', faceResult);

          io.to(`session:${sessionId}`).emit('signal_generated', {
            participantId: tp.participantId,
            type: 'face_match',
            ...faceResult,
          });
        }
      } catch (err) {
        console.error('[playwrightBot] frame capture error:', err);
      }
    }
    if (running) frameTimer = setTimeout(captureFrames, FRAME_INTERVAL_MS);
  };

  // Start loops
  pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
  frameTimer = setTimeout(captureFrames, FRAME_INTERVAL_MS);

  // Return a stop function
  const stopFn = async () => {
    running = false;
    clearTimeout(pollTimer);
    clearTimeout(frameTimer);
    await browser.close().catch(() => {});
    await Session.findByIdAndUpdate(sessionId, { status: 'ended', endedAt: new Date() }).catch(() => {});
    activeBots.delete(sessionId);
    console.log(`[playwrightBot] stopped bot for session ${sessionId}`);
  };

  activeBots.set(sessionId, stopFn);
  return stopFn;
}

// ── Helper ────────────────────────────────────────────────────────────────────
async function saveSignal(
  sessionId: string,
  participantId: string,
  type: string,
  result: { score: number; reason: string }
) {
  const weight = SIGNAL_WEIGHTS[type as keyof typeof SIGNAL_WEIGHTS] ?? 0;
  await ParticipantSignal.create({
    sessionId,
    participantId,
    type,
    value: result.score,
    weight,
    confidence: result.score * weight,
    reason: result.reason,
    timestamp: new Date(),
  }).catch(() => {}); // non-fatal
}
