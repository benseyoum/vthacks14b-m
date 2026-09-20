type Landmark = {
  x: number;
  y: number;
  z: number;
};

type HandsResults = {
  multiHandLandmarks?: Landmark[][];
};

type HandsInstance = {
  setOptions: (options: Record<string, unknown>) => void;
  onResults: (callback: (results: HandsResults) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  close: () => Promise<void> | void;
};

type HandsConstructor = new (config: {
  locateFile: (file: string) => string;
}) => HandsInstance;

declare global {
  interface Window {
    Hands?: HandsConstructor;
  }
}

const SCRIPT_ID = "signalbridge-mediapipe-hands";
const CDN_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/hands";

let scriptPromise: Promise<void> | null = null;

function loadHandsScript() {
  if (window.Hands) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Could not load hand tracking.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `${CDN_ROOT}/hands.js`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load hand tracking."));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

function distance(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function average(points: Landmark[]) {
  return points.reduce(
    (sum, point) => ({
      x: sum.x + point.x / points.length,
      y: sum.y + point.y / points.length,
      z: sum.z + point.z / points.length,
    }),
    { x: 0, y: 0, z: 0 }
  );
}

/**
 * A deliberately conservative closed-fist check.
 *
 * MediaPipe gives us 21 hand landmarks. In an open hand the four fingertips
 * sit well outside the palm. In a closed fist they fold back toward its center.
 * Scale everything by palm width so the trigger works whether the hand is near
 * or far from the camera.
 */
function isClosedFist(landmarks: Landmark[]) {
  if (landmarks.length < 21) return false;

  const palmCenter = average([
    landmarks[0],
    landmarks[5],
    landmarks[9],
    landmarks[13],
    landmarks[17],
  ]);
  const palmWidth = distance(landmarks[5], landmarks[17]);

  if (palmWidth < 0.025) return false;

  const fingertips = [8, 12, 16, 20].map((index) => landmarks[index]);
  const curled = fingertips.filter(
    (tip) => distance(tip, palmCenter) < palmWidth * 1.08
  ).length;

  // Thumb being tucked/crossed makes the emoji-like fist less likely to fire on
  // a claw or partially open hand, but allow a little extra room for variation.
  const thumbNearPalm = distance(landmarks[4], palmCenter) < palmWidth * 1.45;

  return curled === 4 && thumbNearPalm;
}

export type FistWatcherState = "loading" | "ready" | "fist" | "unavailable";

export async function startFistWatcher({
  video,
  shouldListen,
  onTrigger,
  onState,
}: {
  video: HTMLVideoElement;
  shouldListen: () => boolean;
  onTrigger: () => void;
  onState: (state: FistWatcherState) => void;
}) {
  onState("loading");

  try {
    await loadHandsScript();

    if (!window.Hands) {
      throw new Error("Hand tracker did not initialize.");
    }

    const hands = new window.Hands({
      locateFile: (file) => `${CDN_ROOT}/${file}`,
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 0,
      minDetectionConfidence: 0.72,
      minTrackingConfidence: 0.65,
    });

    let fistFrames = 0;
    let openFrames = 0;
    let latched = false;
    let stopped = false;
    let processing = false;

    hands.onResults((results) => {
      const landmarks = results.multiHandLandmarks?.[0];
      const fist = Boolean(landmarks && isClosedFist(landmarks));

      if (fist) {
        fistFrames += 1;
        openFrames = 0;
        onState("fist");

        // Two consecutive classifications is enough to feel immediate while
        // still filtering one-frame false positives.
        if (!latched && fistFrames >= 2 && shouldListen()) {
          latched = true;
          onTrigger();
        }
      } else {
        fistFrames = 0;
        openFrames += 1;
        onState("ready");

        // Require the user to release the fist before another hands-free start.
        if (openFrames >= 2) latched = false;
      }
    });

    onState("ready");

    const timer = window.setInterval(async () => {
      if (
        stopped ||
        processing ||
        !shouldListen() ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        return;
      }

      processing = true;
      try {
        await hands.send({ image: video });
      } catch (error) {
        console.warn("Hands-free fist tracking frame failed.", error);
      } finally {
        processing = false;
      }
    }, 320);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      void hands.close();
    };
  } catch (error) {
    console.warn("Hands-free fist tracking unavailable.", error);
    onState("unavailable");
    return () => {};
  }
}
