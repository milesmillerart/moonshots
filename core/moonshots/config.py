import os
from pathlib import Path

ROOT = Path(os.environ.get("MOONSHOTS_ROOT", "/srv/moonshots"))
CORE = ROOT / "core"
VENTURES = ROOT / "ventures"
INTEGRATIONS = ROOT / "integrations"
DATA = ROOT / "data"
LOGS = ROOT / "logs"
SECRETS = ROOT / "secrets"
DB_PATH = DATA / "moonshots.db"

HOST = os.environ.get("MOONSHOTS_HOST", "127.0.0.1")
PORT = int(os.environ.get("MOONSHOTS_PORT", "8100"))
# Keep concurrency low: the box has 1 vCPU / 2 GB RAM.
MAX_CONCURRENT_JOBS = int(os.environ.get("MOONSHOTS_MAX_JOBS", "2"))
DEFAULT_JOB_TIMEOUT = 1800
SYNC_INTERVAL = 60  # seconds between manifest rescans

APPROVAL_KINDS = ("financial", "credential", "external", "other")


def read_env_file(path: Path) -> dict:
    out = {}
    if not path.exists():
        return out
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out
