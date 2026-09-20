# Databricks notebook source
# MAGIC %md
# MAGIC # SignalBridge readings → Delta
# MAGIC
# MAGIC The fallback path when Lakehouse Federation is not available: read the
# MAGIC Tiger table over JDBC, land it as Delta, answer the same questions.
# MAGIC
# MAGIC Credentials come from the `signalbridge` secret scope. The role is
# MAGIC read-only at the server, so the worst a mistake here can do is read.

# COMMAND ----------

HOST = "<DATABRICKS_PG_HOST>"  # from .env.local
PORT = "<DATABRICKS_PG_PORT>"
DATABASE = "tsdb"

USER = dbutils.secrets.get(scope="signalbridge", key="pg_user")
PASSWORD = dbutils.secrets.get(scope="signalbridge", key="pg_password")

# sslmode=require encrypts without verifying the chain, which is what Tiger's
# own CA needs. Dropping it entirely would send the password in the clear.
URL = f"jdbc:postgresql://{HOST}:{PORT}/{DATABASE}?sslmode=require"

CATALOG = "main"
SCHEMA = "signalbridge"
TABLE = f"{CATALOG}.{SCHEMA}.readings_bronze"

# COMMAND ----------

spark.sql(f"CREATE SCHEMA IF NOT EXISTS {CATALOG}.{SCHEMA}")

readings = (
    spark.read.format("jdbc")
    .option("url", URL)
    .option("driver", "org.postgresql.Driver")
    .option("dbtable", "public.readings")
    .option("user", USER)
    .option("password", PASSWORD)
    .load()
)

readings.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(TABLE)

print(f"{readings.count()} readings landed in {TABLE}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Incremental refresh
# MAGIC
# MAGIC Re-running the cell above rewrites the table. To pull only what is new,
# MAGIC read with a predicate on `time` and append. `readings` is a hypertable,
# MAGIC so Tiger prunes by chunk and the pushed-down filter is cheap.

# COMMAND ----------

from pyspark.sql import functions as F

watermark = spark.sql(f"SELECT max(time) AS t FROM {TABLE}").collect()[0]["t"]

if watermark is not None:
    query = f"(SELECT * FROM public.readings WHERE time > '{watermark}') AS newer"

    new_rows = (
        spark.read.format("jdbc")
        .option("url", URL)
        .option("driver", "org.postgresql.Driver")
        .option("dbtable", query)
        .option("user", USER)
        .option("password", PASSWORD)
        .load()
    )

    if new_rows.count() > 0:
        new_rows.write.mode("append").saveAsTable(TABLE)

    print(f"appended {new_rows.count()} rows since {watermark}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## 1. How often did it have to stop and ask?

# COMMAND ----------

by_hour = (
    spark.table(TABLE)
    .withColumn("hour", F.date_trunc("HOUR", "time"))
    .groupBy("hour", "room")
    .agg(
        F.count("*").alias("readings"),
        F.sum(F.col("needed_clarification").cast("int")).alias("asked"),
        F.round(F.avg("latency_ms")).alias("mean_ms"),
    )
    .withColumn("asked_pct", F.round(100 * F.col("asked") / F.col("readings"), 1))
    .orderBy(F.desc("hour"), "room")
)

display(by_hour)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 2. The vocabulary that actually recurs

# COMMAND ----------

vocabulary = (
    spark.table(TABLE)
    .filter(F.col("intent") != "")
    .groupBy("room", "intent")
    .agg(
        F.count("*").alias("times"),
        F.round(F.avg("top_confidence"), 2).alias("avg_rank_signal"),
        F.max("time").alias("last_said"),
    )
    .filter(F.col("times") > 1)
    .orderBy(F.desc("times"))
)

display(vocabulary)

# COMMAND ----------

# MAGIC %md
# MAGIC ## 3. Latency, at the tail
# MAGIC
# MAGIC The mean hides the readings that made someone wait. Watch p95.

# COMMAND ----------

latency = (
    spark.table(TABLE)
    .filter(F.col("latency_ms").isNotNull())
    .withColumn("day", F.to_date("time"))
    .groupBy("day")
    .agg(
        F.count("*").alias("readings"),
        F.round(F.avg("latency_ms")).alias("mean_ms"),
        F.round(F.percentile_approx("latency_ms", 0.95)).alias("p95_ms"),
    )
    .orderBy(F.desc("day"))
)

display(latency)
