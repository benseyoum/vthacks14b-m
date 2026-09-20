-- Lakehouse Federation: Databricks reads the live Tiger database.
--
-- Run in a SQL editor on a pro or serverless SQL warehouse. Requires
-- CREATE CONNECTION on the Unity Catalog metastore.
--
-- Fill HOST and PORT from .env.local (DATABRICKS_PG_HOST / _PORT). The user
-- and password come from the secret scope, never inline.

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


-- ---------------------------------------------------------------------------
-- The three questions.
-- ---------------------------------------------------------------------------

-- 1. How often did it have to stop and ask? By room, by hour.
--
--    This is the lab safety question and the clinic quality question in one.
--    A rising clarification rate in one room means the readings there are
--    getting harder — worth a human looking before it becomes an incident.
SELECT
  date_trunc('HOUR', time)                                      AS hour,
  room,
  count(*)                                                      AS readings,
  sum(CASE WHEN needed_clarification THEN 1 ELSE 0 END)         AS asked,
  round(
    100.0 * sum(CASE WHEN needed_clarification THEN 1 ELSE 0 END) / count(*),
    1
  )                                                             AS asked_pct
FROM signalbridge.public.readings
WHERE time > current_timestamp() - INTERVAL 7 DAYS
GROUP BY 1, 2
ORDER BY 1 DESC, 2;


-- 2. The vocabulary: what does this person actually say?
--
--    The top intents are the ones worth caching, pre-loading, or putting on a
--    one-tap shortcut. This is the input to the "shared phrasebook" on the
--    future-directions slide.
SELECT
  room,
  intent,
  count(*)                        AS times,
  round(avg(top_confidence), 2)   AS avg_rank_signal,
  max(time)                       AS last_said
FROM signalbridge.public.readings
WHERE intent <> ''
GROUP BY 1, 2
HAVING count(*) > 1
ORDER BY times DESC
LIMIT 25;


-- 3. Is it getting slower?
--
--    Latency is the difference between a conversation and a wait. Watch the
--    tail, not the mean: p95 is what the person in the room experiences on a
--    bad reading.
SELECT
  date_trunc('DAY', time)                                    AS day,
  count(*)                                                   AS readings,
  round(avg(latency_ms))                                     AS mean_ms,
  round(percentile_approx(latency_ms, 0.95))                 AS p95_ms
FROM signalbridge.public.readings
WHERE latency_ms IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC;


-- Note: Tiger's continuous aggregate `readings_hourly` is a view, and views
-- may not surface through the foreign catalog. These queries deliberately read
-- the raw `readings` table and aggregate in Databricks — the rollup in Tiger
-- serves the app, this serves the analysis, and neither depends on the other.
