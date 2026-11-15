"""Moonshots dashboard + API (FastAPI, server-rendered HTML).

Auth:
  - Dashboard and approval decisions: HTTP Basic, creds in secrets/dashboard.env
  - Machine API (jobs/agents): Bearer token in secrets/agent.env. It can read,
    post metrics/logs and REQUEST approvals, but cannot approve them.
  - /healthz is open (returns no sensitive data).
"""
import hashlib
import hmac
import html
import json
import os
import secrets as pysecrets
import shutil
import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel

from . import __version__, db, integrations, logs, ventures
from .config import SECRETS, APPROVAL_KINDS, ROOT, read_env_file
from .scheduler import Scheduler

BASE = os.environ.get("MOONSHOTS_BASE_PATH", "").rstrip("/")
sched = Scheduler()


@asynccontextmanager
async def lifespan(app):
    sched.start()
    yield
    sched.shutdown()


app = FastAPI(title="Moonshots", version=__version__, lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
basic = HTTPBasic(auto_error=False)


def _creds():
    d = read_env_file(SECRETS / "dashboard.env")
    a = read_env_file(SECRETS / "agent.env")
    return d.get("DASHBOARD_USER", ""), d.get("DASHBOARD_PASSWORD", ""), a.get("MOONSHOTS_AGENT_TOKEN", "")


def _eq(a: str, b: str) -> bool:
    return bool(a) and bool(b) and pysecrets.compare_digest(a.encode(), b.encode())


def admin(creds: HTTPBasicCredentials | None = Depends(basic)):
    user, pw, _ = _creds()
    if creds and _eq(creds.username, user) and _eq(creds.password, pw):
        return "admin"
    raise HTTPException(401, "auth required", headers={"WWW-Authenticate": 'Basic realm="Moonshots"'})


def agent_or_admin(request: Request, creds: HTTPBasicCredentials | None = Depends(basic)):
    user, pw, tok = _creds()
    auth = request.headers.get("authorization", "")
    if auth.lower().startswith("bearer ") and _eq(auth[7:].strip(), tok):
        return "agent"
    if creds and _eq(creds.username, user) and _eq(creds.password, pw):
        return "admin"
    raise HTTPException(401, "auth required", headers={"WWW-Authenticate": 'Basic realm="Moonshots"'})


def csrf_token() -> str:
    _, pw, _ = _creds()
    return hmac.new(pw.encode(), b"moonshots-csrf", hashlib.sha256).hexdigest()


def check_csrf(token: str):
    if not _eq(token, csrf_token()):
        raise HTTPException(403, "bad csrf token")


# ---------------------------------------------------------------- helpers ---
e = lambda s: html.escape("" if s is None else str(s))


def ago(ts):
    if not ts:
        return "-"
    d = time.time() - ts
    sign = "" if d >= 0 else "in "
    d = abs(d)
    for unit, n in (("d", 86400), ("h", 3600), ("m", 60)):
        if d >= n:
            return f"{sign}{int(d // n)}{unit}" + ("" if sign else " ago")
    return f"{sign}{int(d)}s" + ("" if sign else " ago")


def system_stats():
    try:
        mem = {}
        for line in open("/proc/meminfo"):
            k, v = line.split(":")
            mem[k] = int(v.split()[0])
        load = os.getloadavg()[0]
    except Exception:
        mem, load = {}, 0
    du = shutil.disk_usage(ROOT)
    return {
        "load1": round(load, 2),
        "mem_used_mb": (mem.get("MemTotal", 0) - mem.get("MemAvailable", 0)) // 1024,
        "mem_total_mb": mem.get("MemTotal", 0) // 1024,
        "disk_free_gb": round(du.free / 2**30, 1),
        "uptime_core_s": int(time.time() - sched.started_at),
    }


CSS = """
body{font:14px/1.45 system-ui,sans-serif;margin:0;background:#0b0d12;color:#e6e6e6}
header{padding:14px 24px;background:#11141b;border-bottom:1px solid #222;display:flex;gap:18px;align-items:center}
header b{font-size:18px}a{color:#8ab4ff;text-decoration:none}main{padding:20px 24px;max-width:1300px}
h2{font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:#9aa;margin:26px 0 8px}
table{border-collapse:collapse;width:100%;background:#11141b}td,th{padding:6px 10px;border-bottom:1px solid #1e222b;text-align:left;vertical-align:top}
th{color:#889;font-weight:600}.pill{padding:1px 8px;border-radius:9px;background:#223;font-size:12px}
.ok,.live,.approved{background:#143d24}.failed,.timeout,.rejected,.error,.ERROR{background:#4a1a1a}
.pending,.awaiting_approval,.planned,.WARNING{background:#4a3a10}.building,.running{background:#10324a}
.cards{display:flex;gap:12px;flex-wrap:wrap}.card{background:#11141b;padding:10px 16px;border:1px solid #222;border-radius:6px}
.card b{display:block;font-size:20px}pre{white-space:pre-wrap;background:#11141b;padding:10px;overflow:auto;max-height:600px}
button{background:#223;color:#eee;border:1px solid #445;border-radius:4px;padding:3px 10px;cursor:pointer}
button.yes{background:#143d24}button.no{background:#4a1a1a}input{background:#0b0d12;color:#eee;border:1px solid #334;padding:3px}
.muted{color:#778}
"""


def page(title, body):
    return HTMLResponse(f"""<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width">
<meta name=robots content=noindex><title>{e(title)} · Moonshots</title><style>{CSS}</style></head><body>
<header><b>🚀 Moonshots</b><a href="{BASE}/">Overview</a><a href="{BASE}/approvals">Approvals</a>
<a href="{BASE}/logs">Logs</a><a href="{BASE}/integrations">Integrations</a><span class=muted>v{__version__}</span></header>
<main>{body}</main></body></html>""")


def pill(s):
    return f'<span class="pill {e(s)}">{e(s)}</span>'


def approvals_table(items, show_actions=True):
    if not items:
        return "<p class=muted>Nothing here.</p>"
    tok = csrf_token()
    rows = []
    for a in items:
        act = ""
        if show_actions and a["status"] == "pending":
            act = (f'<form method=post action="{BASE}/approvals/{a["id"]}/decide" style="display:flex;gap:4px">'
                   f'<input type=hidden name=csrf value="{tok}"><input name=note placeholder="note" size=12>'
                   f'<button class=yes name=decision value=approve>Approve</button>'
                   f'<button class=no name=decision value=reject>Reject</button></form>')
        amt = f"${a['amount_usd']:,.2f}" if a.get("amount_usd") is not None else ""
        rows.append(f"<tr><td>#{a['id']}</td><td>{e(a['venture'])}</td><td>{pill(a['kind'])}</td>"
                    f"<td><b>{e(a['title'])}</b><div class=muted>{e(a['details'])[:400]}</div></td><td>{amt}</td>"
                    f"<td>{pill(a['status'])}</td><td>{ago(a['created_at'])}</td><td>{act}</td></tr>")
    return ("<table><tr><th>ID</th><th>Venture</th><th>Kind</th><th>Request</th><th>Amount</th><th>Status</th>"
            "<th>Created</th><th></th></tr>" + "".join(rows) + "</table>")


def jobs_table(jobs):
    if not jobs:
        return "<p class=muted>No jobs defined.</p>"
    tok = csrf_token()
    r = []
    for j in jobs:
        r.append(f"<tr><td>{e(j['id'])}</td><td><code>{e(j['schedule'] or 'manual')}</code></td>"
                 f"<td>{'yes' if j['enabled'] else '<span class=muted>no</span>'}</td>"
                 f"<td>{e(j['approval'] or '')}</td><td>{ago(j['last_run'])} {pill(j['last_status']) if j['last_status'] else ''}</td>"
                 f"<td>{ago(j['next_run']) if j['enabled'] else '-'}</td>"
                 f"<td><form method=post action=\"{BASE}/jobs/run\"><input type=hidden name=csrf value=\"{tok}\">"
                 f"<input type=hidden name=job_id value=\"{e(j['id'])}\"><button>Run now</button></form></td></tr>")
    return ("<table><tr><th>Job</th><th>Schedule</th><th>Enabled</th><th>Needs approval</th><th>Last run</th>"
            "<th>Next</th><th></th></tr>" + "".join(r) + "</table>")


def runs_table(runs):
    if not runs:
        return "<p class=muted>No runs yet.</p>"
    r = [f"<tr><td><a href=\"{BASE}/runs/{x['id']}\">#{x['id']}</a></td><td>{e(x['job_id'])}</td><td>{pill(x['status'])}</td>"
         f"<td>{e(x['trigger'])}</td><td>{ago(x['started_at'])}</td>"
         f"<td>{round((x['finished_at'] or time.time()) - x['started_at'], 1)}s</td></tr>" for x in runs]
    return "<table><tr><th>Run</th><th>Job</th><th>Status</th><th>Trigger</th><th>Started</th><th>Took</th></tr>" + "".join(r) + "</table>"


def logs_table(entries):
    if not entries:
        return "<p class=muted>No logs.</p>"
    r = []
    for x in entries:
        extra = {k: v for k, v in x.items() if k not in ("ts", "level", "logger", "msg")}
        r.append(f"<tr><td class=muted>{e(x.get('ts'))}</td><td>{pill(x.get('level'))}</td><td>{e(x.get('logger','').replace('moonshots.',''))}</td>"
                 f"<td>{e(x.get('msg'))} <span class=muted>{e(json.dumps(extra))[:300] if extra else ''}</span></td></tr>")
    return "<table><tr><th>Time (UTC)</th><th>Level</th><th>Source</th><th>Message</th></tr>" + "".join(r) + "</table>"


def latest_metrics(slug=None):
    q = ("SELECT m.venture, m.key, m.value, m.ts FROM metrics m JOIN (SELECT venture, key, MAX(ts) ts FROM metrics"
         + (" WHERE venture=?" if slug else "") + " GROUP BY venture, key) l USING(venture,key,ts) ORDER BY venture, key")
    return db.rows(q, *([slug] if slug else []))


# -------------------------------------------------------------- dashboard ---
@app.get("/", response_class=HTMLResponse)
def overview(_=Depends(admin)):
    s = system_stats()
    vs = db.rows("SELECT * FROM ventures ORDER BY CASE status WHEN 'live' THEN 0 WHEN 'building' THEN 1 "
                 "WHEN 'planned' THEN 2 ELSE 3 END, slug")
    pend = db.rows("SELECT * FROM approvals WHERE status='pending' ORDER BY id DESC")
    jobs = db.rows("SELECT * FROM jobs ORDER BY id")
    runs = db.rows("SELECT id,job_id,status,trigger,started_at,finished_at FROM job_runs ORDER BY id DESC LIMIT 15")
    mets = latest_metrics()
    vrows = "".join(
        f"<tr><td><a href=\"{BASE}/ventures/{e(v['slug'])}\"><b>{e(v['name'])}</b></a><div class=muted>{e(v['slug'])}</div></td>"
        f"<td>{pill(v['status'])}</td><td>{e(v['description'])}</td>"
        f"<td>{len([j for j in jobs if j['venture']==v['slug']])}</td></tr>" for v in vs) or "<tr><td colspan=4 class=muted>No ventures.</td></tr>"
    mrows = "".join(f"<tr><td>{e(m['venture'])}</td><td>{e(m['key'])}</td><td>{m['value']:g}</td><td>{ago(m['ts'])}</td></tr>" for m in mets)
    body = f"""
<div class=cards>
 <div class=card><b>{len(vs)}</b>ventures</div>
 <div class=card><b>{len([v for v in vs if v['status']=='live'])}</b>live</div>
 <div class=card><b style="color:{'#f5c542' if pend else 'inherit'}">{len(pend)}</b>pending approvals</div>
 <div class=card><b>{len(sched.running)}</b>jobs running</div>
 <div class=card><b>{s['load1']}</b>load (1m)</div>
 <div class=card><b>{s['mem_used_mb']}/{s['mem_total_mb']} MB</b>memory</div>
 <div class=card><b>{s['disk_free_gb']} GB</b>disk free</div>
</div>
<h2>Pending approvals</h2>{approvals_table(pend)}
<h2>Ventures</h2><table><tr><th>Venture</th><th>Status</th><th>Pitch</th><th>Jobs</th></tr>{vrows}</table>
<h2>Jobs</h2>{jobs_table(jobs)}
<h2>Recent runs</h2>{runs_table(runs)}
<h2>Metrics (latest)</h2>{('<table><tr><th>Venture</th><th>Metric</th><th>Value</th><th>When</th></tr>'+mrows+'</table>') if mets else '<p class=muted>No metrics yet.</p>'}
<h2>Recent logs</h2>{logs_table(logs.tail(25))}"""
    return page("Overview", body)


@app.get("/ventures/{slug}", response_class=HTMLResponse)
def venture_page(slug: str, _=Depends(admin)):
    v = db.rows("SELECT * FROM ventures WHERE slug=?", slug)
    if not v:
        raise HTTPException(404)
    v = v[0]
    jobs = db.rows("SELECT * FROM jobs WHERE venture=? ORDER BY id", slug)
    runs = db.rows("SELECT id,job_id,status,trigger,started_at,finished_at FROM job_runs WHERE venture=? ORDER BY id DESC LIMIT 30", slug)
    appr = db.rows("SELECT * FROM approvals WHERE venture=? ORDER BY id DESC LIMIT 30", slug)
    mets = latest_metrics(slug)
    vlogs = [x for x in logs.tail(300) if x.get("venture") == slug or x.get("logger") == f"moonshots.venture.{slug}"][:40]
    manifest = json.loads(v["manifest"] or "{}")
    body = f"""<h1>{e(v['name'])} {pill(v['status'])}</h1><p>{e(v['description'])}</p>
<h2>Manifest</h2><pre>{e(json.dumps(manifest, indent=2))}</pre>
<h2>Jobs</h2>{jobs_table(jobs)}<h2>Approvals</h2>{approvals_table(appr)}
<h2>Metrics</h2>{''.join(f"<div>{e(m['key'])}: <b>{m['value']:g}</b> <span class=muted>{ago(m['ts'])}</span></div>" for m in mets) or '<p class=muted>None yet.</p>'}
<h2>Runs</h2>{runs_table(runs)}<h2>Logs</h2>{logs_table(vlogs)}"""
    return page(v["name"], body)


@app.get("/runs/{run_id}", response_class=HTMLResponse)
def run_page(run_id: int, _=Depends(admin)):
    r = db.rows("SELECT * FROM job_runs WHERE id=?", run_id)
    if not r:
        raise HTTPException(404)
    r = r[0]
    return page(f"Run {run_id}", f"<h1>Run #{r['id']} · {e(r['job_id'])} {pill(r['status'])}</h1>"
                f"<p>exit {e(r['exit_code'])} · trigger {e(r['trigger'])} · started {ago(r['started_at'])}</p><pre>{e(r['output'])}</pre>")


@app.get("/approvals", response_class=HTMLResponse)
def approvals_page(_=Depends(admin)):
    pend = db.rows("SELECT * FROM approvals WHERE status='pending' ORDER BY id DESC")
    done = db.rows("SELECT * FROM approvals WHERE status!='pending' ORDER BY id DESC LIMIT 100")
    return page("Approvals", f"<h2>Pending</h2>{approvals_table(pend)}<h2>History</h2>{approvals_table(done, False)}")


@app.post("/approvals/{aid}/decide")
def decide(aid: int, decision: str = Form(...), csrf: str = Form(...), note: str = Form(""), _=Depends(admin)):
    check_csrf(csrf)
    ok = db.decide_approval(aid, decision == "approve", by="don", note=note)
    logs.log("core", "info", "approval decided", approval=aid, decision=decision, applied=ok)
    return RedirectResponse(f"{BASE}/approvals", status_code=303)


@app.post("/jobs/run")
def run_job_form(job_id: str = Form(...), csrf: str = Form(...), _=Depends(admin)):
    check_csrf(csrf)
    j = db.rows("SELECT * FROM jobs WHERE id=?", job_id)
    if not j:
        raise HTTPException(404)
    sched.submit(j[0], trigger="manual:dashboard")
    return RedirectResponse(f"{BASE}/ventures/{j[0]['venture']}", status_code=303)


@app.get("/logs", response_class=HTMLResponse)
def logs_page(_=Depends(admin)):
    return page("Logs", logs_table(logs.tail(200)))


@app.get("/integrations", response_class=HTMLResponse)
def integrations_page(_=Depends(admin)):
    ints = integrations.discover()
    rows = "".join(f"<tr><td>{e(n)}</td><td>{e(p.description)}</td><td>{'yes' if p.configured() else 'no'}</td>"
                   f"<td>{e(', '.join(p.required_secrets))}</td></tr>" for n, p in ints.items())
    return page("Integrations", "<table><tr><th>Name</th><th>Description</th><th>Configured</th><th>Secrets needed "
                "(secrets/integrations/&lt;name&gt;.env)</th></tr>" + rows + "</table>")


# -------------------------------------------------------------------- API ---
@app.get("/healthz")
def healthz():
    try:
        db.rows("SELECT 1")
        ok = sched.thread.is_alive()
    except Exception:
        ok = False
    return JSONResponse({"status": "ok" if ok else "degraded", "version": __version__,
                         "scheduler": sched.thread.is_alive()}, status_code=200 if ok else 503)


class ApprovalIn(BaseModel):
    venture: str
    kind: str
    title: str
    details: str = ""
    amount_usd: float | None = None
    ref: str | None = None


class MetricIn(BaseModel):
    venture: str
    key: str
    value: float


class LogIn(BaseModel):
    venture: str
    level: str = "info"
    msg: str
    fields: dict = {}


@app.get("/api/status")
def api_status(_=Depends(agent_or_admin)):
    return {"system": system_stats(),
            "ventures": db.rows("SELECT slug,name,status FROM ventures ORDER BY slug"),
            "jobs": db.rows("SELECT id,schedule,enabled,approval,last_status,last_run,next_run FROM jobs"),
            "pending_approvals": db.rows("SELECT id,venture,kind,title,amount_usd,ref,created_at FROM approvals WHERE status='pending'"),
            "running": sorted(sched.running)}


@app.post("/api/approvals")
def api_request_approval(a: ApprovalIn, who=Depends(agent_or_admin)):
    if a.kind not in APPROVAL_KINDS:
        raise HTTPException(400, f"kind must be one of {APPROVAL_KINDS}")
    aid = db.request_approval(a.venture, a.kind, a.title, a.details, a.amount_usd, a.ref, requested_by=who)
    logs.log(f"venture.{a.venture}", "warning", "approval requested", approval=aid, kind=a.kind, title=a.title)
    return {"id": aid, "status": "pending"}


@app.get("/api/approvals/{aid}")
def api_get_approval(aid: int, _=Depends(agent_or_admin)):
    r = db.rows("SELECT * FROM approvals WHERE id=?", aid)
    if not r:
        raise HTTPException(404)
    return r[0]


@app.post("/api/approvals/{aid}/consume")
def api_consume(aid: int, _=Depends(agent_or_admin)):
    """An agent marks an approved request as used (single use)."""
    with db.conn() as c:
        cur = c.execute("UPDATE approvals SET status='consumed' WHERE id=? AND status='approved'", (aid,))
    if cur.rowcount != 1:
        raise HTTPException(409, "not approved or already used")
    return {"id": aid, "status": "consumed"}


@app.post("/api/metrics")
def api_metric(m: MetricIn, _=Depends(agent_or_admin)):
    db.record_metric(m.venture, m.key, m.value)
    return {"ok": True}


@app.post("/api/logs")
def api_log(l: LogIn, _=Depends(agent_or_admin)):
    logs.log(f"venture.{l.venture}", l.level, l.msg, **l.fields)
    return {"ok": True}


@app.post("/api/jobs/{venture}/{job}/run")
def api_run(venture: str, job: str, _=Depends(agent_or_admin)):
    j = db.rows("SELECT * FROM jobs WHERE id=?", f"{venture}/{job}")
    if not j:
        raise HTTPException(404)
    return {"submitted": sched.submit(j[0], trigger="manual:api")}


@app.post("/api/sync")
def api_sync(_=Depends(agent_or_admin)):
    return {"ventures": ventures.sync()}
