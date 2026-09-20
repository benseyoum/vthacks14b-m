import {
  FrameTransform,
  PixelFormat,
  SmartSpectraSDK,
  ValidationCode,
} from "@smartspectra/node-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PresageRequest = {
  frames?: string[];
  width?: number;
  height?: number;
  stride?: number;
};

type ValidationSample = {
  code: number;
  name: string;
  hint: string;
  timestampUs: number;
};

const MAX_FRAMES = 24;
const MAX_FRAME_BASE64_LENGTH = 180_000;

let active = false;

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

function validationName(code: number) {
  return (
    Object.entries(ValidationCode).find(([, value]) => value === code)?.[0] ??
    `code_${code}`
  );
}

function summarize(samples: ValidationSample[]) {
  if (!samples.length) {
    return {
      ready: false,
      code: "no_validation",
      hint: "Presage did not receive enough visual signal yet.",
    };
  }

  // The SDK can emit a transient warning while the subject is moving into
  // position. Weight the most recent readings so the UI reflects the framing
  // at the end of the countdown rather than the first frame.
  const recent = samples.slice(-12);
  const okCount = recent.filter((sample) => sample.name === "kOk").length;
  const ready = okCount / recent.length >= 0.6;

  if (ready) {
    return {
      ready: true,
      code: "kOk",
      hint: "Capture quality verified.",
    };
  }

  const warnings = recent.filter((sample) => sample.name !== "kOk");
  const counts = new Map<string, { count: number; sample: ValidationSample }>();

  for (const sample of warnings) {
    const current = counts.get(sample.name);
    counts.set(sample.name, {
      count: (current?.count ?? 0) + 1,
      sample,
    });
  }

  const dominant = [...counts.values()].sort((a, b) => b.count - a.count)[0]
    ?.sample;

  return {
    ready: false,
    code: dominant?.name ?? recent.at(-1)?.name ?? "needs_adjustment",
    hint:
      dominant?.hint ||
      recent.at(-1)?.hint ||
      "Adjust your position and try the capture again.",
  };
}

export async function POST(request: Request) {
  if (active) {
    return Response.json(
      { error: "Presage is already checking another capture." },
      { status: 429 }
    );
  }

  const apiKey = process.env.SMARTSPECTRA_API_KEY;

  if (!apiKey) {
    return Response.json(
      { error: "Presage is not configured on this server." },
      { status: 503 }
    );
  }

  let body: PresageRequest;

  try {
    body = (await request.json()) as PresageRequest;
  } catch {
    return Response.json({ error: "Invalid Presage request." }, { status: 400 });
  }

  const frames = body.frames;
  const width = body.width;
  const height = body.height;
  const stride = body.stride;

  if (
    !Array.isArray(frames) ||
    frames.length < 3 ||
    frames.length > MAX_FRAMES ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    !Number.isInteger(stride) ||
    !width ||
    !height ||
    !stride ||
    stride !== width * 4
  ) {
    return Response.json(
      { error: "Invalid Presage frame batch." },
      { status: 400 }
    );
  }

  if (
    frames.some(
      (frame) =>
        typeof frame !== "string" || frame.length > MAX_FRAME_BASE64_LENGTH
    )
  ) {
    return Response.json(
      { error: "Presage frame payload is too large." },
      { status: 413 }
    );
  }

  active = true;
  let sdk: SmartSpectraSDK | null = null;

  try {
    const validations: ValidationSample[] = [];
    let sdkError = "";

    sdk = new SmartSpectraSDK({
      apiKey,
      enableTelemetry: true,
    });

    sdk.on("validationStatus", (code, timestampUs, hint) => {
      validations.push({
        code,
        name: validationName(code),
        hint,
        timestampUs,
      });
    });

    sdk.on("error", (_code, message) => {
      sdkError = message;
    });

    sdk.useCustomInput(FrameTransform.kNone);
    sdk.start();

    const baseTimestampUs = Number(process.hrtime.bigint() / 1000n);
    let acceptedFrames = 0;

    for (let index = 0; index < frames.length; index += 1) {
      const buffer = Buffer.from(frames[index], "base64");
      const expectedLength = width * height * 4;

      if (buffer.length !== expectedLength) {
        continue;
      }

      const accepted = sdk.sendFrame(
        buffer,
        width,
        height,
        stride,
        PixelFormat.kRGBA,
        baseTimestampUs + index * 125_000
      );

      if (accepted) acceptedFrames += 1;

      // Give the native pipeline time to consume the batch while keeping this
      // check much faster than the Gemini interpretation request.
      await sleep(30);
    }

    await sleep(450);
    await sdk.stopAsync();

    if (!acceptedFrames) {
      throw new Error("Presage could not accept the captured frames.");
    }

    if (sdkError && !validations.length) {
      throw new Error(sdkError);
    }

    const summary = summarize(validations);

    return Response.json({
      ...summary,
      provider: "Presage SmartSpectra",
      acceptedFrames,
      validationSamples: validations.length,
    });
  } catch (error) {
    console.error("Presage capture-quality check failed:", error);

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Presage capture-quality check failed.",
      },
      { status: 500 }
    );
  } finally {
    if (sdk) {
      try {
        await sdk.destroy();
      } catch (error) {
        console.error("Presage cleanup failed:", error);
      }
    }

    active = false;
  }
}
