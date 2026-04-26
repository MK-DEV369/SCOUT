# SCOUT MainEL Error Log

Date: 2026-04-26
Scope: Consolidated runtime/integration errors observed during ingestion implementation and execution.

## 1) PostgreSQL connection timeout on default port 5432

Context:
- Command: run ingestion job via `run_ingestion_job()`.
- Target DB URL: postgresql+psycopg://postgres:postgres@localhost:5432/scout

Error:
- psycopg.errors.ConnectionTimeout: connection timeout expired
- Multiple connection attempts failed:
  - host: localhost, port: 5432, hostaddr: ::1 -> connection timeout expired
  - host: localhost, port: 5432, hostaddr: 127.0.0.1 -> connection timeout expired
- sqlalchemy.exc.OperationalError wrapping the same psycopg timeout

Root cause noted:
- PostgreSQL was not reachable on 5432 in this environment.

---

## 2) Unified-record count query failed due to DB timeout

Context:
- Command: SQLAlchemy count query on `UnifiedRecord`.
- Target DB URL: postgresql+psycopg://postgres:postgres@localhost:5432/scout

Error:
- Same stack and terminal outcome as above:
  - psycopg.errors.ConnectionTimeout
  - sqlalchemy.exc.OperationalError

Root cause noted:
- Database connectivity issue at 5432 blocked all persistence validation queries.

---

## 3) Ingestion command hangs/timeouts before completion

Context:
- Command: `python -c "import asyncio; from app.ingestion.scheduler import run_ingestion_job; print(asyncio.run(run_ingestion_job()))"`

Error:
- Command timed out (120s) without successful completion output in multiple attempts.

Root cause noted:
- Initially suspected external connector latency/blocking and/or DB reachability.
- Later confirmed persistence path was blocked by DB connectivity failures.

---

## 4) SyntaxError in one-line async execution attempts

Context:
- Command style attempted: inline `async def main()` inside a one-line `python -c` expression.

Error:
- SyntaxError: invalid syntax (at async function declaration in one-liner)

Root cause noted:
- Python one-liner format was incompatible with inline async function definition.

---

## 5) Subagent invocation failure (tool-level request format)

Context:
- Attempted execution_subagent request for DB creation + ingestion run.

Error:
- Request Failed: 400
- Message: `messages.1.content.0: Invalid data in redacted_thinking block`

Root cause noted:
- Tool invocation payload issue, not project code/runtime failure.

---

## 6) Docker unavailable

Context:
- Command: `docker --version` and `docker ps`

Error:
- `docker` not recognized as an internal or external command

Root cause noted:
- Docker CLI/engine not installed in this environment.

---

## 7) PostgreSQL port mismatch discovered

Context:
- Service inspection showed PostgreSQL service running (`postgresql-x64-18`).
- Config inspection of `E:\PostgreSQL\postgresql.conf`.

Finding/Error:
- Application expected 5432; PostgreSQL config showed `port = 5433`.

Root cause noted:
- App DB URL and live DB port were inconsistent.

---

## 8) PostgreSQL service restart permission issue

Context:
- Command attempted: `Restart-Service -Name postgresql-x64-18 -Force`

Error:
- `Cannot open postgresql-x64-18 service on computer '.'`

Root cause noted:
- Insufficient permissions to control/restart the Windows service.

---

## 9) Database missing on port 5433

Context:
- Commands run with DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5433/scout

Error:
- psycopg.OperationalError: connection to server at localhost (port 5433) failed:
  - FATAL: database "scout" does not exist
- sqlalchemy.exc.OperationalError wrapping same failure

Root cause noted:
- PostgreSQL instance reachable at 5433, but target database `scout` did not exist at that time.

---

## 10) Connection refused on port 5433 in later attempts

Context:
- Command: psql check and DB create on localhost:5433

Error:
- psql: connection to server at localhost (::1), port 5433 failed: Connection refused
- psql: connection to server at localhost (127.0.0.1), port 5433 failed: Connection refused

Root cause noted:
- PostgreSQL listener on 5433 became unavailable/not accepting connections during that execution window.

---

## 11) Table initialization timeout

Context:
- Command: `python -c "import app.main; print('tables_initialized')"` with DATABASE_URL set to 5433/scout

Error:
- Command timed out (120s); expected confirmation string was not printed.

Root cause noted:
- Blocked by unresolved DB availability/connectivity issues.

---

## 12) Dry-run collection succeeded (non-error reference)

Context:
- DB-independent collection (connector fetch only).

Result (for reference):
- `{'total_records': 101, 'by_source': {'gdelt': 1, 'google_news': 100}}`
- Exit code: 0

Note:
- Confirms ingestion fetch path is functional independent of DB persistence.
