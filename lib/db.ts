import { Pool } from "pg";

let pool: Pool | null = null;

function connectionString() {
  return process.env.TIGER_DATABASE_URL || process.env.DATABASE_URL || "";
}

export function isDatabaseConfigured() {
  return connectionString().length > 0;
}

function splitSslMode(raw: string) {
  try {
    const parsed = new URL(raw);
    const mode = parsed.searchParams.get("sslmode");
    parsed.searchParams.delete("sslmode");
    return { url: parsed.toString(), mode };
  } catch {
    return { url: raw, mode: null };
  }
}

export function getPool() {
  if (pool) return pool;

  const raw = connectionString();
  if (!raw) {
    throw new Error(
      "No database configured. Put TIGER_DATABASE_URL=... in .env.local."
    );
  }

  const { url, mode } = splitSslMode(raw);

  pool = new Pool({
    connectionString: url,
    ssl: mode === "disable" ? false : { rejectUnauthorized: false },
    max: 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
  });

  pool.on("error", (error) => {
    console.error("Tiger pool error:", error.message);
  });

  return pool;
}

export type ReadingRow = {
  time: string;
  room: string;
  intent: string;
  message: string;
  needed_clarification: boolean;
  chosen_option: string | null;
  top_candidate: string | null;
  top_confidence: number | null;
};

export type HourlyRow = {
  bucket: string;
  room: string;
  readings: number;
  clarified: number;
  avg_confidence: number | null;
  avg_latency_ms: number | null;
};
