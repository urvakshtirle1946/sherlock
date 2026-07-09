# Sherlock Candidate Identifier

Sherlock is a system designed to identify which participant in a live video meeting (e.g. Google Meet) is the actual candidate by continuously fusing multiple weak signals into a single, explainable, updating confidence score.

Frame this as **candidate identification under uncertainty**, not "cheating detection." The system updates predictions every 3 seconds as evidence accumulates.

---

## Technical Stack & Architecture

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Socket.io client, Zustand, Recharts, Lucide React.
- **Backend**: Node.js, Express, TypeScript, Socket.io, MongoDB + Mongoose, face-api.js (TensorFlow.js), Fuse.js.
- **Ingestion**: Playwright Headless Automation.

### Architecture Data Flow
```
[Google Meet / Live Video]
           │ (Playwright scraping & canvas screenshots)
           ▼
[Express Server Ingestion] ◄── [Participant Simulator Panel]
           │ (Standardised Signal Events)
           ▼
 [Modular Signal Extractors]
  ├── Name matching (Fuse.js)
  ├── Email matching (Domain/Local match)
  ├── Face verification (face-api.js)
  ├── Voice activity (Ratio + Turn Length)
  ├── Transcript analysis (Addressing name Heuristics)
  ├── Join order
  └── Camera presence
           │
           ▼
  [Confidence Engine] (Weighted combining)
           │
           ▼
  [Explanation Engine] (prose generator with OpenAI/Template fallback)
           │
           ▼
  [MongoDB Database] (Sessions, Signals, Predictions)
           │
           ▼
[Socket.io Push to Next.js Client Dashboard]
```

---

## Tradeoffs and Decisions

### 1. Ingestion Method: Playwright vs Recall.ai (Live Mode)
* **Choice**: Dual-ingestion architecture (Simulator/Playwright for Local/Demo, Recall.ai for Production/Live Meet).
* **Playwright Bot**: Joins as a headless participant and scrapes DOM info. However, this is fragile to Google Meet DOM updates and cannot isolate individual participant audio streams.
* **Recall.ai integration**: Solves the audio and robust join issues. It launches a managed bot into the meeting room and streams real-time webhooks (`participant_events` join/leave/speak/camera/screenshare and `transcript.data`). This makes ingestion source-agnostic, feeding normalized payloads directly into the same signal extractors and fusion loop.
* **Audio Scope**: Playwright uses DOM active-speaker highlights. Recall.ai provides full diarized transcripts and real-time speaking events (`speech_on` / `speech_off`), offering highly accurate voice-activity mapping.

### 2. Face Verification: face-api.js (All-TS Route)
* **Choice**: face-api.js over InsightFace + FastAPI.
* **Why**: Setting up a Python FastAPI microservice alongside Node/MERN stack adds significant operational overhead. `face-api.js` runs directly inside Node.js, using pure JS TensorFlow.js (`@tensorflow/tfjs`) for model execution.
* **Accuracy Tradeoff**: face-api.js is slightly less robust in low-res or low-light situations compared to InsightFace, but it simplifies deployment. Reference images are cached in-memory as 128-dimensional descriptors to minimize CPU cycles.

---

## Signal Weights Table

The Confidence Engine combines signals using a weighted sum, fully commented in `confidenceEngine.ts`:

| Signal Type | Weight | Rationale |
| :--- | :--- | :--- |
| **Face Verification** | 30% | Highest-weight: biometric, hard to spoof, most unique identifier. |
| **Voice Activity** | 20% | Strong behavioural signal; capped at 20% so talkative interviewers don't spoof candidate ID. |
| **Transcript Match** | 20% | Interviewer addressing someone by name ("Hi Rahul") is highly definitive when it fires. |
| **Email Match** | 15% | Strong account-level identifier; often missing for external participants (handled gracefully). |
| **Name Match** | 10% | Fuzzy comparison of display name vs candidate name. Weak alone because display names are self-chosen. |
| **Join Order** | 3% | Weak tie-breaker nudging early joiners. |
| **Camera Presence** | 2% | Mild positive signal ensuring camera-on participants hold a slight edge over camera-off. |

*Recomputed every 3 seconds. When the top-2 participants score within 5 percentage points of each other, the prediction is flagged as **Ambiguous** rather than forcing a guess.*

---

## Quick Start Setup

### Prerequisites
- Node.js (v18+)
- MongoDB running locally at `mongodb://localhost:27017/sherlock`
- Optional: `OPENAI_API_KEY` in `server/.env` for GPT prose explanations (default template fallback works out-of-the-box if left empty)
- Optional: `RECALLAI_API_KEY` in `server/.env` for Live Ingestion mode (Recall.ai)

### Installation
1. Install all dependencies from monorepo root:
   ```bash
   npm run install:all
   ```
2. Download face-api weights:
   ```bash
   cd server && node scripts/download-models.js
   ```
3. Copy environment configurations and add keys if available:
   ```bash
   cd server
   copy .env.example .env
   ```

### Running Locally (Demo Mode)
Run the server and client concurrently:
```bash
# In project root:
# (Uses in-memory MongoDB fallback automatically if local MongoDB is not running)
npm run dev
```
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`

---

## Recall.ai Live Ingestion Setup (Optional)

To stream real meeting data (Google Meet, Zoom, MS Teams) into Sherlock, configure Recall.ai:

1. **Get an API Key**: Sign up at [Recall.ai](https://www.recall.ai/) and generate an API key. Add it to `server/.env`:
   ```env
   RECALLAI_API_KEY=your_recall_api_key_here
   ```
2. **Start a Public Tunnel**: Recall.ai needs to send real-time webhooks to your local server. Run a tunnel (e.g., Ngrok or LocalTunnel):
   ```bash
   ngrok http 4000
   ```
3. **Configure Host URL**: Copy your tunnel's public HTTPS URL and set the `HOST_URL` variable in `server/.env`:
   ```env
   HOST_URL=https://xxxx-xx-xxx-xx.ngrok-free.app
   ```
4. **Initialize Live Session**: On the home page, enter the candidate details, choose **Live Meeting**, input a real Google Meet URL, and click **Initialize**. The Recall.ai bot will join the meeting immediately!
5. **Accept Bot Admission**: As the meeting host, click **Admit** on Google Meet when the *Sherlock Ingestion Bot* requests to join.

### Recall.ai Details
- **Costs**: Recall.ai has **no monthly platform fee**. It charges a usage-based rate of **$0.50 per recording hour** (billed to the second). New accounts receive complimentary credits for testing.
- **Latency**: Webhook events (speech toggles, camera toggles, and transcript data) are delivered with **~1-2 seconds of latency** from the moment of live interaction, ensuring the dashboard updates in near real-time.

---

## Known Limitations & Edge Cases

1. **Google Meet DOM Updates**: The Playwright bot relies on selector bindings (like `[data-participant-id]`). If Google shifts their DOM structure, these selectors in `playwrightBot.ts` will need to be updated. (Note: Using **Recall.ai** completely bypasses DOM fragility since it integrates at the media layer).
2. **CPU-bound Latency**: Because we use pure JS TensorFlow.js (to avoid python gyp binary compilation issues), face landmark extraction takes ~400ms per frame. We run it on a throttled interval (5s) to avoid bottlenecking the Node main thread.
3. **No-Key Degraded State**: If no `OPENAI_API_KEY` is provided, transcription and prose generation are skipped/stubbed. The scoring engine and dashboard continue working normally.
