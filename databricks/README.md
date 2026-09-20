# SignalBridge → Databricks

**Status: provisioned, not in use.** The Unity Catalog connection
`tiger_signalbridge` and the foreign catalog `signalbridge` exist and point at
the live Tiger service, but the foreign catalog enumerates no schemas — on
Databricks Free Edition the metadata service does not appear to reach an
external host, and `pg_stat_activity` on Tiger confirms no connection from
`databricks_ro` has ever arrived. The Postgres side is verified working: that
role lists `public.readings` and `public.readings_hourly` when connected to
directly.

Nothing here runs as part of the app, and nothing here can break it — the
folder is SQL, a notebook and this file. Pick it back up by running the one
query in "Step 2" from the Databricks SQL editor, which surfaces the real
error the CLI swallows.

Tiger runs the app. Databricks reads what Tiger has already written.

Nothing streams, nothing is copied on the capture path, and the app has no
Databricks dependency — if this whole folder disappeared, SignalBridge would
still read gestures and speak sentences. That separation is the point: Tiger is
the operational store answering one room in milliseconds, Databricks is the
analytical layer answering a campus over a semester.

```
browser → /api/interpret → Gemini
                ↓
          /api/readings → Tiger (readings hypertable)
                              ↓  read-only role
                         Databricks (federation or JDBC)
```

## Before you start

**Credentials are already provisioned.** A read-only Postgres role,
`databricks_ro`, exists on the Tiger service. It can `SELECT` from `readings`
and `readings_hourly` and nothing else — an `INSERT` is refused by the server.
Its host, port, database, user and password are in `.env.local` under
`DATABRICKS_PG_*`. That file is gitignored; keep it that way.

**Free Edition has a network catch.** Databricks Free Edition restricts
outbound internet access to a limited set of trusted domains, which blocks a
Tiger host. The documented unlock is LinkedIn verification on the account,
which grants outbound internet access. If federation fails with a connection
timeout and nothing else, that is what you are hitting — it is not a
credentials problem, and no amount of re-pasting the password fixes it.

## Step 1 — put the password in a secret scope

Never paste it into a notebook cell; a shared notebook is a published
credential.

```bash
databricks secrets create-scope signalbridge
databricks secrets put-secret signalbridge pg_user      # databricks_ro
databricks secrets put-secret signalbridge pg_password  # from .env.local
```

## Step 2 — pick a path

**`federation.sql` — Lakehouse Federation.** Unity Catalog opens a read-only
connection to Tiger and exposes it as a catalog. No pipeline, no copy, no
staleness: a query in Databricks hits the same rows the app wrote a second ago.
This is the better story and the better demo. It needs `CREATE CONNECTION` on
the metastore, so you need to be a metastore admin — true on a workspace you
created yourself, often false on one handed to you.

**`ingest_readings.py` — JDBC notebook.** Reads the same table over JDBC and
lands it as a Delta table. Works without Unity Catalog privileges, and works on
any cluster or serverless compute. Use it if federation is not available, or if
you want a materialised Bronze table to build on.

Both end at the same three questions, which are the ones the deck asks:

- how often did the system have to stop and ask, by room, by hour
- which intents actually recur — the vocabulary a person really uses
- how long a reading takes, and whether that drifts

## What is *not* here

No frames. No images ever leave the browser for storage, so there is nothing in
Tiger for Databricks to read but the sentence and its evidence. If you extend
this, keep it that way — the promise on the slide is load-bearing.
