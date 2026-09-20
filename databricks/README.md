# SignalBridge → Databricks

**Status: provisioned, not in the live capture path.** Tiger Data is the operational store for confirmed SignalBridge readings. Databricks is an analytical layer for querying those readings over time.

The Unity Catalog connection and foreign catalog were provisioned during the hackathon, but the Free Edition environment did not return the Tiger schemas. Direct Postgres access from the read-only `databricks_ro` role was verified on the Tiger side.

```text
browser → /api/interpret → Gemini
                ↓
          /api/readings → Tiger Data
                              ↓ read-only role
                         Databricks
```

No camera frames are stored. The database contains confirmed sentence metadata and interpretation evidence only.

## Files

- `federation.sql` — Lakehouse Federation setup and analysis queries.
- `ingest_readings.py` — JDBC/Delta fallback notebook.
- `../db/databricks-role.sql` — reproducible read-only database role.

Keep credentials in secret storage or ignored local environment files. Never commit database passwords.
