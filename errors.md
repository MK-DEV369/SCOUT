# SCOUT MainEL Error Log

Date: 2026-04-26
Scope: Consolidated runtime/integration errors observed during ingestion implementation and execution.

## Status Review (2026-05-14)

Legend:
- Open: still requires action
- Mitigated: behavior is handled but the root condition can still occur operationally

Summary:
- Open: 4
- Mitigated: 3

## Remaining Issues

## 1) Docker unavailable

Status: Open (non-blocking)

Context:
- Command: `docker --version` and `docker ps`

Error:
- `docker` not recognized as an internal or external command

Root cause noted:
- Docker CLI/engine is not installed in this environment.

---

## 2) PostgreSQL port mismatch discovered

Status: Open

Context:
- Service inspection showed PostgreSQL service running (`postgresql-x64-18`).
- Config inspection of `E:\PostgreSQL\postgresql.conf`.

Finding/Error:
- Application expected 5432; PostgreSQL config showed `port = 5433`.

Root cause noted:
- App DB URL and live DB port were inconsistent.

---

## 3) PostgreSQL service restart permission issue

Status: Open

Context:
- Command attempted: `Restart-Service -Name postgresql-x64-18 -Force`

Error:
- `Cannot open postgresql-x64-18 service on computer '.'`

Root cause noted:
- Insufficient permissions to control or restart the Windows service.

---

## 4) Connection refused on port 5433 in later attempts

Status: Open

Context:
- Command: psql check and DB create on localhost:5433

Error:
- `psql: connection to server at localhost (::1), port 5433 failed: Connection refused`
- `psql: connection to server at localhost (127.0.0.1), port 5433 failed: Connection refused`

Root cause noted:
- PostgreSQL listener on 5433 was not accepting connections during that execution window.

---

## 5) PostgreSQL connection timeout on default port 5432

Status: Mitigated

Context:
- Command: run ingestion job via `run_ingestion_job()`.
- Target DB URL: `postgresql+psycopg://postgres:postgres@localhost:5432/scout`

Error:
- `psycopg.errors.ConnectionTimeout: connection timeout expired`
- `sqlalchemy.exc.OperationalError` wrapping the same psycopg timeout

Root cause noted:
- PostgreSQL was not reachable on 5432 in this environment.

---

## 6) Unified-record count query failed due to DB timeout

Status: Mitigated

Context:
- SQLAlchemy count query on `UnifiedRecord`.
- Target DB URL: `postgresql+psycopg://postgres:postgres@localhost:5432/scout`

Error:
- Same stack and terminal outcome as above:
  - `psycopg.errors.ConnectionTimeout`
  - `sqlalchemy.exc.OperationalError`

Root cause noted:
- Database connectivity issue at 5432 blocked persistence validation queries.

---

## 7) Ingestion command hangs/timeouts before completion

Status: Mitigated

Context:
- Command: `python -c "import asyncio; from app.ingestion.scheduler import run_ingestion_job; print(asyncio.run(run_ingestion_job()))"`

Error:
- Command timed out (120s) without successful completion output in multiple attempts.

Root cause noted:
- Initially suspected external connector latency/blocking and/or DB reachability.
- Later confirmed persistence path was blocked by DB connectivity failures.

## Notes

- The following issues were previously observed and have been resolved in the current codebase: async one-liner syntax, tool payload error, backend startup import path mismatch, alerts 500 on empty countries, frontend proxy ECONNREFUSED, and refresh propagation failures.
- Connector fetch-only dry runs have succeeded independently of DB persistence.
