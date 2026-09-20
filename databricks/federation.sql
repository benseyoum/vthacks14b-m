CREATE CONNECTION IF NOT EXISTS tiger_signalbridge
TYPE postgresql
OPTIONS (
  host     '<DATABRICKS_PG_HOST>',
  port     '<DATABRICKS_PG_PORT>',
  user     secret('signalbridge', 'pg_user'),
  password secret('signalbridge', 'pg_password')
);

CREATE FOREIGN CATALOG IF NOT EXISTS signalbridge
USING CONNECTION tiger_signalbridge
OPTIONS (database 'tsdb');

SELECT
  date_trunc('HOUR', time) AS hour,
  room,
  count(*) AS readings,
  sum(CASE WHEN needed_clarification THEN 1 ELSE 0 END) AS asked,
  round(100.0 * sum(CASE WHEN needed_clarification THEN 1 ELSE 0 END) / count(*), 1) AS asked_pct
FROM signalbridge.public.readings
WHERE time > current_timestamp() - INTERVAL 7 DAYS
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

SELECT
  room,
  intent,
  count(*) AS times,
  round(avg(top_confidence), 2) AS avg_rank_signal,
  max(time) AS last_said
FROM signalbridge.public.readings
WHERE intent <> ''
GROUP BY 1, 2
HAVING count(*) > 1
ORDER BY times DESC
LIMIT 25;

SELECT
  date_trunc('DAY', time) AS day,
  count(*) AS readings,
  round(avg(latency_ms)) AS mean_ms,
  round(percentile_approx(latency_ms, 0.95)) AS p95_ms
FROM signalbridge.public.readings
WHERE latency_ms IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC;
