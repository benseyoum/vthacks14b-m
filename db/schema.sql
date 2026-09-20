-- SignalBridge → Tiger Cloud
--
-- One confirmed reading is one row. Frames are never written here: the promise
-- on screen is that camera images are interpreted and discarded, so what leaves
-- the browser for the database is the sentence and its evidence, never a photo.
--
-- Run this once against your Tiger service (no psql needed):
--   tiger db query --file db/schema.sql
--
-- Then db/rollup.sql for the continuous aggregate.

CREATE TABLE IF NOT EXISTS readings (
  time                  TIMESTAMPTZ      NOT NULL,
  session_id            TEXT             NOT NULL,

  -- Which of the three rooms this reading came from: bedside, ward, lab.
  room                  TEXT             NOT NULL DEFAULT 'bedside',

  -- The interpretation itself.
  actor                 TEXT             NOT NULL DEFAULT '',
  intent                TEXT             NOT NULL DEFAULT '',
  action                TEXT             NOT NULL DEFAULT '',
  message               TEXT             NOT NULL,
  location              TEXT             NOT NULL DEFAULT '',

  -- Did the model refuse to guess, and what did the person pick?
  needed_clarification  BOOLEAN          NOT NULL DEFAULT FALSE,
  chosen_option         TEXT,

  -- Ranking signals, not statistics. Kept for "what did it nearly say instead".
  top_candidate         TEXT,
  top_confidence        DOUBLE PRECISION,
  candidates            JSONB            NOT NULL DEFAULT '[]'::jsonb,
  context               JSONB            NOT NULL DEFAULT '[]'::jsonb,

  latency_ms            INTEGER
) WITH (
  tsdb.hypertable,
  tsdb.partition_column = 'time',
  tsdb.segmentby = 'room',
  tsdb.orderby = 'time DESC'
);

-- The two lookups the app actually makes.
CREATE INDEX IF NOT EXISTS readings_session_idx ON readings (session_id, time DESC);
CREATE INDEX IF NOT EXISTS readings_clarified_idx ON readings (room, time DESC)
  WHERE needed_clarification;
