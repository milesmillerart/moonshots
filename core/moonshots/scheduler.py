"""In-process job scheduler. Jobs come from venture manifests (cron syntax).

Guardrail: a job whose manifest sets `approval: <kind>` will NOT run until Don
approves a pending request in the dashboard. Each approval is single-use.
"""
import os
import signal
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor

from . import db, ventures
from .config import VENTURES, SECRETS, MAX_CONCURRENT_JOBS, SYNC_INTERVAL, PORT, read_env_file
from .logs import log

_OUTPUT_CAP = 20_000


class Scheduler:
    def __init__(self):
        self.pool = ThreadPoolExecutor(max_workers=MAX_CONCURRENT_JOBS, thread_name_prefix="job")
        self.running: set[str] = set()
        self.lock = threading.Lock()
        self.stop = threading.Event()
        self.thread = threading.Thread(target=self._loop, name="scheduler", daemon=True)
        self.last_sync = 0.0
        self.started_at = time.time()

    def start(self):
        db.init()
        # runs interrupted by a restart
        db.execute("UPDATE job_runs SET status='interrupted', finished_at=? WHERE status='running'", time.time())
        ventures.sync()
        self.last_sync = time.time()
        self.thread.start()
        log("core", "info", "scheduler started", max_jobs=MAX_CONCURRENT_JOBS)

    def shutdown(self):
        self.stop.set()
        self.pool.shutdown(wait=False, cancel_futures=True)

    def _loop(self):
        while not self.stop.wait(10):
            try:
                if time.time() - self.last_sync >= SYNC_INTERVAL:
                    ventures.sync()
                    self.last_sync = time.time()
                due = db.rows("SELECT * FROM jobs WHERE enabled=1 AND next_run IS NOT NULL AND next_run<=?", time.time())
                for job in due:
                    db.execute("UPDATE jobs SET next_run=? WHERE id=?", ventures.next_run(job["schedule"]), job["id"])
                    self.submit(job, trigger="schedule")
            except Exception as e:
                log("core", "error", "scheduler loop error", error=repr(e))

    def submit(self, job: dict, trigger="manual") -> bool:
        with self.lock:
            if job["id"] in self.running:
                log("core", "warning", "job already running, skipped", job=job["id"])
                return False
            self.running.add(job["id"])
        self.pool.submit(self._run, job, trigger)
        return True

    def _run(self, job: dict, trigger: str):
        jid, slug = job["id"], job["venture"]
        try:
            if job.get("approval"):
                ref = f"job:{jid}"
                used = db.consume_approval(ref)
                if not used:
                    aid = db.request_approval(
                        slug, job["approval"], f"Run job {jid}",
                        details=f"Command: {job['command']}", ref=ref, requested_by=f"scheduler:{trigger}")
                    db.execute("INSERT INTO job_runs(job_id,venture,started_at,finished_at,status,trigger,output)"
                               " VALUES (?,?,?,?,?,?,?)", jid, slug, time.time(), time.time(),
                               "awaiting_approval", trigger, f"approval #{aid} pending")
                    db.execute("UPDATE jobs SET last_status='awaiting_approval' WHERE id=?", jid)
                    log(f"venture.{slug}", "warning", "job blocked pending approval", job=jid, approval=aid)
                    return
                log(f"venture.{slug}", "info", "approval consumed", job=jid, approval=used)
            self._exec(job, trigger)
        except Exception as e:
            log(f"venture.{slug}", "error", "job crashed", job=jid, error=repr(e))
        finally:
            with self.lock:
                self.running.discard(jid)

    def _exec(self, job, trigger):
        jid, slug = job["id"], job["venture"]
        cwd = VENTURES / slug
        env = {
            "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
            "HOME": os.environ.get("HOME", "/home/moonshots"),
            "XDG_RUNTIME_DIR": os.environ.get("XDG_RUNTIME_DIR", f"/run/user/{os.getuid()}"),
            "LANG": "C.UTF-8",
            "MOONSHOTS_ROOT": str(VENTURES.parent),
            "MOONSHOTS_VENTURE": slug,
            "MOONSHOTS_JOB": jid,
            "MOONSHOTS_API": f"http://127.0.0.1:{PORT}/api",
        }
        # agent token lets jobs post metrics / request approvals (cannot approve)
        env.update(read_env_file(SECRETS / "agent.env"))
        # per-venture secrets, never committed
        env.update(read_env_file(SECRETS / "ventures" / f"{slug}.env"))
        run_id = db.execute("INSERT INTO job_runs(job_id,venture,started_at,status,trigger) VALUES (?,?,?,?,?)",
                            jid, slug, time.time(), "running", trigger)
        log(f"venture.{slug}", "info", "job started", job=jid, run=run_id, trigger=trigger)
        t0 = time.time()
        status, code, out = "failed", None, ""
        try:
            p = subprocess.Popen(["bash", "-c", job["command"]], cwd=cwd, env=env,
                                 stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                 start_new_session=True, text=True, errors="replace")
            try:
                out, _ = p.communicate(timeout=job.get("timeout") or 1800)
                code = p.returncode
                status = "ok" if code == 0 else "failed"
            except subprocess.TimeoutExpired:
                os.killpg(p.pid, signal.SIGKILL)
                out, _ = p.communicate()
                status = "timeout"
        except Exception as e:
            out = repr(e)
        out = (out or "")[-_OUTPUT_CAP:]
        db.execute("UPDATE job_runs SET finished_at=?, status=?, exit_code=?, output=? WHERE id=?",
                   time.time(), status, code, out, run_id)
        db.execute("UPDATE jobs SET last_run=?, last_status=? WHERE id=?", t0, status, jid)
        log(f"venture.{slug}", "info" if status == "ok" else "error", "job finished",
            job=jid, run=run_id, status=status, exit_code=code, seconds=round(time.time() - t0, 2))
