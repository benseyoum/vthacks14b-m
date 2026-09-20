import { Pool } from "pg";

/**
 * Tiger Cloud — Postgres with hypertables.
 *
 * Built on first use, like the Gemini client, and for the same reason: a
 * missing credential must not take anything down while a module evaluates.
 *
 * Stronger rule here though — the database is *optional*. SignalBridge speaks
 * the sentence whether or not a row gets written, so nothing on the capture
 * path may wait on this or fail because of it. Callers check
 * isDatabaseConfigured() and move on.
 */

let pool: Pool | null = null;

function connectionString() {
  return process.env.TIGER_DATABASE_URL || process.env.DATABASE_URL || "";
}

export function isDatabaseConfigured() {
  return connectionString().length > 0;
}

/**
 * Tiger hands out `...?sslmode=require`, which current pg reads as
 * `verify-full` — and that beats any `ssl` option passed alongside it, so the
 * connection dies on "self-signed certificate in certificate chain" against
 * Tiger's own CA. Strip the parameter and state the intent directly instead of
 * depending on which pg version is installed.
 */
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
      "No database configured. Put TIGER_DATABASE_URL=... in .env.local (the connection string from your Tiger Cloud service)."
    );
  }

  const { url, mode } = splitSslMode(raw);

  pool = new Pool({
    connectionString: url,

    // Encrypted, but not verified against a local trust store: Tiger Cloud
    // signs with its own CA. To harden, download the service CA from the
    // console and pass `ssl: { ca }` here instead.
    ssl: mode === "disable" ? false : { rejectUnauthorized: false },

    // A hackathon laptop opening a handful of connections, not a fleet.
    max: 4,
    idleTimeoutMillis: 30_000,

    // Fail fast rather than hanging the request on venue wifi.
    connectionTimeoutMillis: 8_000,
  });

  // An idle client erroring out must not become an unhandled rejection that
  // kills the dev server mid-demo.
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
