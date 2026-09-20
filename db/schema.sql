-- SignalBridge → Tiger Cloud
-- One confirmed reading is one row. Frames are never stored here.

CREATE TABLE IF NOT EXISTS readings (
  time                  TIMESTAMPTZ      NOT NULL,
  session_id            TEXT             NOT NULL,
  room                  TEXT             NOT NULL DEFAULT 'bedside',
  actor                 TEXT             NOT NULL DEFAULT '',
  intent                TEXT             NOT NULL DEFAULT '',
  action                TEXT             NOT NULL DEFAULT '',
  message               TEXT             NOT NULL,
  location              TEXT             NOT NULL DEFAULT '',
  needed_clarification  BOOLEAN          NOT NULL DEFAULT FALSE,
  chosen_option         TEXT,
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

CREATE INDEX IF NOT EXISTS readings_session_idx ON readings (session_id, time DESC);
CREATE INDEX IF NOT EXISTS readings_clarified_idx ON readings (room, time DESC)
  WHERE needed_clarification;
