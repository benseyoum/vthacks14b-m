DROP ROLE IF EXISTS databricks_ro;

CREATE ROLE databricks_ro LOGIN PASSWORD '<generate-a-strong-one>';

GRANT CONNECT ON DATABASE tsdb TO databricks_ro;
GRANT USAGE ON SCHEMA public TO databricks_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO databricks_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO databricks_ro;
