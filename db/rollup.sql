CREATE MATERIALIZED VIEW readings_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket(INTERVAL '1 hour', time) AS bucket,
  room,
  count(*) AS readings,
  count(*) FILTER (WHERE needed_clarification) AS clarified,
  avg(top_confidence) AS avg_confidence,
  avg(latency_ms) AS avg_latency_ms
FROM readings
GROUP BY bucket, room
WITH NO DATA;

SELECT add_continuous_aggregate_policy('readings_hourly',
  start_offset      => INTERVAL '7 days',
  end_offset        => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists     => TRUE
);

ALTER MATERIALIZED VIEW readings_hourly SET (timescaledb.materialized_only = false);
CALL refresh_continuous_aggregate('readings_hourly', NULL, NULL);
