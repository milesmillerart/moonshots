"""Venture manifests: discovery, validation, sync into the DB."""
import json
import re
import shutil
import time
from pathlib import Path

import yaml
from croniter import croniter

from . import db
from .config import VENTURES, APPROVAL_KINDS, DEFAULT_JOB_TIMEOUT
from .logs import log

SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,40}$")
STATUSES = ("idea", "planned", "building", "live", "paused", "retired")


def load_manifest(path: Path) -> dict:
    m = yaml.safe_load(path.read_text()) or {}
    slug = path.parent.name
    m.setdefault("slug", slug)
    if m["slug"] != slug:
        raise ValueError(f"manifest slug {m['slug']!r} != folder {slug!r}")
    if m.get("status", "idea") not in STATUSES:
        raise ValueError(f"bad status {m.get('status')!r}; one of {STATUSES}")
    for j in m.get("jobs") or []:
        if not j.get("name") or not j.get("command"):
            raise ValueError("each job needs name and command")
        sched = j.get("schedule")
        if sched and not croniter.is_valid(sched):
            raise ValueError(f"job {j['name']}: invalid cron {sched!r}")
        if j.get("approval") and j["approval"] not in APPROVAL_KINDS:
            raise ValueError(f"job {j['name']}: approval must be one of {APPROVAL_KINDS}")
    return m


def discover():
    out = {}
    for p in sorted(VENTURES.glob("*/manifest.yaml")):
        if p.parent.name.startswith("_"):
            continue
        try:
            out[p.parent.name] = load_manifest(p)
        except Exception as e:  # keep going; surface error on dashboard via logs
            log("core", "error", "manifest invalid", venture=p.parent.name, error=str(e))
    return out


def next_run(schedule):
    return croniter(schedule, time.time()).get_next(float) if schedule else None


def sync():
    """Upsert ventures + jobs from manifests. Returns number of ventures."""
    found = discover()
    seen_jobs = set()
    with db.conn() as c:
        for slug, m in found.items():
            c.execute(
                "INSERT INTO ventures(slug,name,status,description,manifest,updated_at) VALUES (?,?,?,?,?,?)"
                " ON CONFLICT(slug) DO UPDATE SET name=excluded.name,status=excluded.status,"
                " description=excluded.description,manifest=excluded.manifest,updated_at=excluded.updated_at",
                (slug, m.get("name", slug), m.get("status", "idea"), m.get("description", ""),
                 json.dumps(m, default=str), time.time()))
            active = m.get("status") in ("building", "live")
            for j in m.get("jobs") or []:
                jid = f"{slug}/{j['name']}"
                seen_jobs.add(jid)
                enabled = 1 if (j.get("enabled", True) and active) else 0
                old = c.execute("SELECT schedule,next_run FROM jobs WHERE id=?", (jid,)).fetchone()
                nr = old["next_run"] if old and old["schedule"] == j.get("schedule") and old["next_run"] else next_run(j.get("schedule"))
                c.execute(
                    "INSERT INTO jobs(id,venture,name,schedule,command,timeout,approval,enabled,next_run)"
                    " VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET schedule=excluded.schedule,"
                    " command=excluded.command,timeout=excluded.timeout,approval=excluded.approval,"
                    " enabled=excluded.enabled,next_run=excluded.next_run",
                    (jid, slug, j["name"], j.get("schedule"), j["command"],
                     int(j.get("timeout", DEFAULT_JOB_TIMEOUT)), j.get("approval"), enabled, nr))
        for r in c.execute("SELECT id FROM jobs").fetchall():
            if r["id"] not in seen_jobs:
                c.execute("DELETE FROM jobs WHERE id=?", (r["id"],))
        for r in c.execute("SELECT slug FROM ventures").fetchall():
            if r["slug"] not in found:
                c.execute("UPDATE ventures SET status='missing' WHERE slug=?", (r["slug"],))
    return len(found)


def create(slug: str, name: str | None = None, description: str = "", status: str = "idea") -> Path:
    if not SLUG_RE.match(slug):
        raise ValueError("slug must be lowercase letters, digits, dashes (2-41 chars)")
    if status not in STATUSES:
        raise ValueError(f"status must be one of {STATUSES}")
    dest = VENTURES / slug
    if dest.exists():
        raise FileExistsError(dest)
    shutil.copytree(VENTURES / "_template", dest)
    try:
        mf = dest / "manifest.yaml"
        subs = {"__SLUG__": slug, "__NAME__": name or slug.replace("-", " ").title(),
                "__DESCRIPTION__": description or "TODO: one-line pitch", "__STATUS__": status}
        for f in (mf, dest / "README.md"):
            if f.exists():
                text = f.read_text()
                for k, v in subs.items():
                    # JSON strings are valid YAML scalars, so quote values in the manifest
                    text = text.replace(k, json.dumps(v) if f == mf and k in ("__NAME__", "__DESCRIPTION__") else v)
                f.write_text(text)
        load_manifest(mf)  # validate
    except Exception:
        shutil.rmtree(dest, ignore_errors=True)
        raise
    log("core", "info", "venture created", venture=slug, status=status)
    return dest
