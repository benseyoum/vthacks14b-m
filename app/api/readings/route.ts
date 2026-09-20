import { NextResponse } from "next/server";

import { getPool, isDatabaseConfigured } from "@/lib/db";
import type { HourlyRow, ReadingRow } from "@/lib/db";
import type { SignalInterpretation } from "@/types/signalbridge";

type Body = {
  interpretation?: SignalInterpretation;
  sessionId?: string;
  room?: string;
  chosenOption?: string | null;
  neededClarification?: boolean;
  latencyMs?: number | null;
};

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ stored: false, reason: "no-database" });
  }

  try {
    const body: Body = await request.json();
    const reading = body.interpretation;

    if (!reading?.finalMessage?.trim()) {
      return NextResponse.json(
        { stored: false, reason: "no-message" },
        { status: 400 }
      );
    }

    const top = [...(reading.objectCandidates ?? [])].sort(
      (a, b) => b.confidence - a.confidence
    )[0];

    await getPool().query(
      `INSERT INTO readings (
         time, session_id, room,
         actor, intent, action, message, location,
         needed_clarification, chosen_option,
         top_candidate, top_confidence, candidates, context,
         latency_ms
       ) VALUES (
         now(), $1, $2,
         $3, $4, $5, $6, $7,
         $8, $9,
         $10, $11, $12::jsonb, $13::jsonb,
         $14
       )`,
      [
        body.sessionId || "anonymous",
        body.room || "bedside",
        reading.actor || "",
        reading.intent || "",
        reading.action || "",
        reading.finalMessage.trim(),
        reading.location || "",
        Boolean(body.neededClarification),
        body.chosenOption || null,
        top?.value ?? null,
        top?.confidence ?? null,
        JSON.stringify(reading.objectCandidates ?? []),
        JSON.stringify(reading.context ?? []),
        body.latencyMs ?? null,
      ]
    );

    return NextResponse.json({ stored: true });
  } catch (error) {
    console.error("Reading not stored:", error);
    return NextResponse.json({ stored: false, reason: "write-failed" });
  }
}

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ configured: false, readings: [], hourly: [] });
  }

  try {
    const pool = getPool();

    const recent = await pool.query<ReadingRow>(
      `SELECT time, room, intent, message,
              needed_clarification, chosen_option,
              top_candidate, top_confidence
         FROM readings
        ORDER BY time DESC
        LIMIT 50`
    );

    let hourly;

    try {
      hourly = await pool.query<HourlyRow>(
        `SELECT bucket, room, readings, clarified, avg_confidence, avg_latency_ms
           FROM readings_hourly
          WHERE bucket > now() - INTERVAL '7 days'
          ORDER BY bucket DESC`
      );
    } catch {
      hourly = await pool.query<HourlyRow>(
        `SELECT time_bucket(INTERVAL '1 hour', time) AS bucket,
                room,
                count(*) AS readings,
                count(*) FILTER (WHERE needed_clarification) AS clarified,
                avg(top_confidence) AS avg_confidence,
                avg(latency_ms) AS avg_latency_ms
           FROM readings
          WHERE time > now() - INTERVAL '7 days'
          GROUP BY bucket, room
          ORDER BY bucket DESC`
      );
    }

    return NextResponse.json({
      configured: true,
      readings: recent.rows,
      hourly: hourly.rows,
    });
  } catch (error) {
    console.error("Readings query failed:", error);

    return NextResponse.json(
      {
        configured: true,
        readings: [],
        hourly: [],
        error:
          error instanceof Error ? error.message : "Could not read the table.",
      },
      { status: 500 }
    );
  }
}
