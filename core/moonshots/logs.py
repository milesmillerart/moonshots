"""Structured JSON logging with size-based rotation."""
import json
import logging
import logging.handlers
import time
from collections import deque
from pathlib import Path

from .config import LOGS

_MAX_BYTES = 5 * 1024 * 1024
_BACKUPS = 5
_loggers: dict = {}


class JsonFormatter(logging.Formatter):
    def format(self, record):
        d = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(record.created)) + "Z",
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        extra = getattr(record, "fields", None)
        if extra:
            d.update(extra)
        if record.exc_info:
            d["exc"] = self.formatException(record.exc_info)
        return json.dumps(d, default=str)


def get_logger(name: str = "core", filename: str | None = None) -> logging.Logger:
    """name 'core' -> logs/core.jsonl; 'venture.<slug>' -> logs/ventures/<slug>.jsonl"""
    if name in _loggers:
        return _loggers[name]
    if filename is None:
        if name.startswith("venture."):
            filename = f"ventures/{name.split('.', 1)[1]}.jsonl"
        else:
            filename = f"{name}.jsonl"
    path = LOGS / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    lg = logging.getLogger(f"moonshots.{name}")
    lg.setLevel(logging.INFO)
    lg.propagate = False
    h = logging.handlers.RotatingFileHandler(path, maxBytes=_MAX_BYTES, backupCount=_BACKUPS)
    h.setFormatter(JsonFormatter())
    lg.addHandler(h)
    _loggers[name] = lg
    return lg


def log(name: str, level: str, msg: str, **fields):
    get_logger(name).log(getattr(logging, level.upper(), logging.INFO), msg, extra={"fields": fields})


def tail(n: int = 50) -> list[dict]:
    """Most recent n entries across all log files, newest first."""
    entries = []
    for p in list(LOGS.glob("*.jsonl")) + list(LOGS.glob("ventures/*.jsonl")):
        try:
            with p.open() as f:
                for line in deque(f, maxlen=n):
                    try:
                        entries.append(json.loads(line))
                    except ValueError:
                        pass
        except OSError:
            pass
    entries.sort(key=lambda e: e.get("ts", ""), reverse=True)
    return entries[:n]
