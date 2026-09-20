-- The role Databricks connects as.
--
-- Databricks never gets tsdbadmin. It gets an account that can read the two
-- objects it needs and nothing else — an INSERT from this role is refused by
-- the server, not by a convention someone has to remember.
--
-- Already applied to the live service. Kept here so the grant is reviewable
-- and reproducible; generate a fresh password rather than reusing one.
--
--   tiger db query --file db/databricks-role.sql

DROP ROLE IF EXISTS databricks_ro;

CREATE ROLE databricks_ro LOGIN PASSWORD '<generate-a-strong-one>';

GRANT CONNECT ON DATABASE tsdb TO databricks_ro;
GRANT USAGE ON SCHEMA public TO databricks_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO databricks_ro;

-- So a future table is readable without re-granting by hand.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO databricks_ro;
