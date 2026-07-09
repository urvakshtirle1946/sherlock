import FingerprintJS from '@fingerprintjs/fingerprintjs';

export interface DeviceDetails {
  os: string;
  browser: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  screen: string;
  cpuCores: number;
  gpu: string;
  ram?: string;
}

export interface DeviceFingerprintResult {
  visitorId: string;
  confidence: number;
  components: Record<string, { value: unknown }>;
  details: DeviceDetails;
}

let fpPromise: ReturnType<typeof FingerprintJS.load> | null = null;

function getFingerprintAgent() {
  if (!fpPromise) {
    fpPromise = FingerprintJS.load();
  }
  return fpPromise;
}

export function getDeviceDetails(): DeviceDetails {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let os = 'Unknown OS';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown Browser';
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/edge|edg/i.test(ua)) browser = 'Edge';
  else if (/opr/i.test(ua)) browser = 'Opera';

  const isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua);
  const deviceType = isMobile ? 'mobile' : 'desktop';

  let gpu = 'Unknown GPU';
  try {
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
      if (gl) {
        const dbgRenderInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbgRenderInfo) {
          gpu = gl.getParameter(dbgRenderInfo.UNMASKED_RENDERER_WEBGL) || 'Unknown GPU';
        }
      }
    }
  } catch (e) {}

  const screen = typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : 'Unknown';
  const cpuCores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 0 : 0;
  const ram = typeof navigator !== 'undefined' && (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB` : undefined;

  return { os, browser, deviceType, screen, cpuCores, gpu, ram };
}

/** Device identification via FingerprintJS & Web APIs — no hand-rolled canvas hashing. */
export async function getDeviceFingerprint(): Promise<DeviceFingerprintResult> {
  const agent = await getFingerprintAgent();
  const result = await agent.get();
  const details = getDeviceDetails();
  return {
    visitorId: result.visitorId,
    confidence: result.confidence.score,
    components: Object.fromEntries(
      Object.entries(result.components).map(([key, comp]) => [key, { value: (comp as any).value }])
    ),
    details,
  };
}
