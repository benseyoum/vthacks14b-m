-- The rollup that makes this a hypertable rather than a log table.
--
-- "Which room, which hour, how often did it have to ask?" is the lab safety
-- question and the clinic quality question in one query. A continuous
-- aggregate keeps that answer materialised instead of scanning every reading.
--
-- Run AFTER db/schema.sql, and run each statement on its own:
--
--   tiger db query -c "$(cat db/rollup.sql | sed -n '/CREATE MATERIALIZED/,/WITH NO DATA;/p')"
--   tiger db query -c "SELECT add_continuous_aggregate_policy('readings_hourly', ...)"
--
-- Creating a continuous aggregate is not allowed inside a transaction block,
-- and multi-statement input runs in one implicit transaction — so sending this
-- whole file at once fails. One statement per call.
--
-- Skipping this file entirely is fine: the app falls back to computing the
-- same shape live with time_bucket(). The aggregate is the analytics story,
-- not the write path.

CREATE MATERIALIZED VIEW readings_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket(INTERVAL '1 hour', time)            AS bucket,
  room,
  count(*)                                        AS readings,
  count(*) FILTER (WHERE needed_clarification)    AS clarified,
  avg(top_confidence)                             AS avg_confidence,
  avg(latency_ms)                                 AS avg_latency_ms
FROM readings
GROUP BY bucket, room
WITH NO DATA;

SELECT add_continuous_aggregate_policy('readings_hourly',
  start_offset      => INTERVAL '7 days',
  end_offset        => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists     => TRUE
);

-- Real-time aggregation: union the materialised buckets with rows newer than
-- them. Without this, the policy's one-hour end_offset means a reading taken
-- on stage does not appear in the rollup until an hour later — which is the
-- whole demo.
ALTER MATERIALIZED VIEW readings_hourly SET (timescaledb.materialized_only = false);

-- Materialise what is already in the table.
CALL refresh_continuous_aggregate('readings_hourly', NULL, NULL);
