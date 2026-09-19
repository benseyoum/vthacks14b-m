import { NextResponse } from "next/server";

type ElevenLabsAlignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

type ElevenLabsResponse = {
  audio_base64?: string;
  alignment?: ElevenLabsAlignment | null;
  normalized_alignment?: ElevenLabsAlignment | null;
  detail?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      return NextResponse.json(
        { error: "No text was supplied for speech." },
        { status: 400 }
      );
    }

    if (text.length > 1000) {
      return NextResponse.json(
        { error: "Speech text is too long." },
        { status: 400 }
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ElevenLabs is not configured." },
        { status: 503 }
      );
    }

    const voiceId =
      process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
    const modelId =
      process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5";

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
        voiceId
      )}/with-timestamps?enable_logging=false`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
        }),
        cache: "no-store",
      }
    );

    const data = (await response.json()) as ElevenLabsResponse;

    if (!response.ok || !data.audio_base64) {
      console.error("ElevenLabs speech error:", data.detail ?? data);

      return NextResponse.json(
        { error: "ElevenLabs could not generate speech." },
        { status: response.ok ? 502 : response.status }
      );
    }

    return NextResponse.json(
      {
        audioBase64: data.audio_base64,
        alignment: data.alignment ?? data.normalized_alignment ?? null,
        engine: "elevenlabs",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("SignalBridge speech error:", error);

    return NextResponse.json(
      { error: "SignalBridge could not generate speech." },
      { status: 500 }
    );
  }
}
