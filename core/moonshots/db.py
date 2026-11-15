"""SQLite state: ventures, jobs, runs, approvals, metrics."""
import json
import sqlite3
import time
from contextlib import contextmanager

from .config import DB_PATH

SCHEMA = """
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS ventures (
  slug TEXT PRIMARY KEY, name TEXT, status TEXT, description TEXT,
  manifest TEXT, updated_at REAL
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,            -- <venture>/<job>
  venture TEXT, name TEXT, schedule TEXT, command TEXT,
  timeout INTEGER, approval TEXT, enabled INTEGER,
  next_run REAL, last_run REAL, last_status TEXT
);
CREATE TABLE IF NOT EXISTS job_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT, venture TEXT, started_at REAL, finished_at REAL,
  status TEXT, exit_code INTEGER, output TEXT, trigger TEXT
);
CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venture TEXT, kind TEXT, title TEXT, details TEXT,
  amount_usd REAL, ref TEXT,       -- ref ties an approval to a job or action
  status TEXT DEFAULT 'pending',   -- pending|approved|rejected|consumed
  requested_by TEXT, created_at REAL, decided_at REAL, decided_by TEXT, note TEXT
);
CREATE TABLE IF NOT EXISTS metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venture TEXT, key TEXT, value REAL, ts REAL
);
CREATE INDEX IF NOT EXISTS ix_runs_job ON job_runs(job_id, started_at);
CREATE INDEX IF NOT EXISTS ix_metrics ON metrics(venture, key, ts);
CREATE INDEX IF NOT EXISTS ix_appr ON approvals(status, ref);
"""


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH, timeout=30, isolation_level=None)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA busy_timeout=30000")
    return c


@contextmanager
def conn():
    c = connect()
    try:
        yield c
    finally:
        c.close()


def init():
    with conn() as c:
        c.executescript(SCHEMA)


def rows(sql, *args):
    with conn() as c:
        return [dict(r) for r in c.execute(sql, args).fetchall()]


def execute(sql, *args):
    with conn() as c:
        cur = c.execute(sql, args)
        return cur.lastrowid


# ---- approvals -------------------------------------------------------------

def request_approval(venture, kind, title, details="", amount_usd=None, ref=None, requested_by="agent"):
    """Create a pending approval unless an identical pending one exists. Returns id."""
    if ref:
        existing = rows("SELECT id FROM approvals WHERE ref=? AND status='pending'", ref)
        if existing:
            return existing[0]["id"]
    return execute(
        "INSERT INTO approvals(venture,kind,title,details,amount_usd,ref,status,requested_by,created_at)"
        " VALUES (?,?,?,?,?,?, 'pending', ?, ?)",
        venture, kind, title, details if isinstance(details, str) else json.dumps(details),
        amount_usd, ref, requested_by, time.time())


def decide_approval(approval_id, approve: bool, by="don", note=""):
    with conn() as c:
        cur = c.execute(
            "UPDATE approvals SET status=?, decided_at=?, decided_by=?, note=? WHERE id=? AND status='pending'",
            ("approved" if approve else "rejected", time.time(), by, note, approval_id))
        return cur.rowcount == 1


def consume_approval(ref):
    """Atomically use one approved approval for `ref`. Single use. Returns id or None."""
    with conn() as c:
        c.execute("BEGIN IMMEDIATE")
        r = c.execute("SELECT id FROM approvals WHERE ref=? AND status='approved' ORDER BY id LIMIT 1", (ref,)).fetchone()
        if not r:
            c.execute("COMMIT")
            return None
        c.execute("UPDATE approvals SET status='consumed' WHERE id=?", (r["id"],))
        c.execute("COMMIT")
        return r["id"]


def record_metric(venture, key, value):
    execute("INSERT INTO metrics(venture,key,value,ts) VALUES (?,?,?,?)", venture, key, float(value), time.time())
