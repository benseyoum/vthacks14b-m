import { NextResponse } from "next/server";
import { interpretFrames } from "@/lib/gemini";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!Array.isArray(body.frames) || body.frames.length === 0) {
      return NextResponse.json(
        { error: "No camera frames received." },
        { status: 400 }
      );
    }

    const interpretation = await interpretFrames(
      body.frames,
      Array.isArray(body.meta) ? body.meta : undefined
    );

    return NextResponse.json({
      interpretation,
    });
  } catch (error) {
    console.error("SignalBridge error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "SignalBridge could not interpret the interaction.",
      },
      { status: 500 }
    );
  }
}
