# Databricks notebook source
# SignalBridge readings → Delta

HOST = "<DATABRICKS_PG_HOST>"
PORT = "<DATABRICKS_PG_PORT>"
DATABASE = "tsdb"

USER = dbutils.secrets.get(scope="signalbridge", key="pg_user")
PASSWORD = dbutils.secrets.get(scope="signalbridge", key="pg_password")
URL = f"jdbc:postgresql://{HOST}:{PORT}/{DATABASE}?sslmode=require"

CATALOG = "main"
SCHEMA = "signalbridge"
TABLE = f"{CATALOG}.{SCHEMA}.readings_bronze"

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

from pyspark.sql import functions as F

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
