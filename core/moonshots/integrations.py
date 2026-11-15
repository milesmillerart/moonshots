"""Integration plugin loader.

Each plugin lives in /srv/moonshots/integrations/<name>/plugin.py and defines
`class Plugin(Integration)`. Secrets come from secrets/integrations/<name>.env
(never committed). Methods that spend money, touch credentials, or do
irreversible external things must be decorated with @sensitive(kind) and
will only run with an approved, unused approval id.
"""
import functools
import importlib.util
import sys

from . import db
from .config import INTEGRATIONS, SECRETS, read_env_file
from .logs import log


class ApprovalRequired(Exception):
    def __init__(self, approval_id):
        super().__init__(f"approval #{approval_id} pending in dashboard")
        self.approval_id = approval_id


def sensitive(kind: str):
    """Gate a plugin method behind an approval. Call with venture=..., and the
    gate keys the approval on plugin+method+args summary."""
    def deco(fn):
        @functools.wraps(fn)
        def wrapper(self, *args, venture: str = "core", reason: str = "", amount_usd=None, **kw):
            ref = f"integration:{self.name}.{fn.__name__}:{venture}:{reason or repr((args, kw))[:200]}"
            used = db.consume_approval(ref)
            if not used:
                aid = db.request_approval(venture, kind, f"{self.name}.{fn.__name__}: {reason or 'action'}",
                                          details=repr((args, kw))[:2000], amount_usd=amount_usd, ref=ref,
                                          requested_by=f"integration:{self.name}")
                log(f"venture.{venture}", "warning", "integration action needs approval",
                    integration=self.name, action=fn.__name__, approval=aid)
                raise ApprovalRequired(aid)
            log(f"venture.{venture}", "info", "integration action approved",
                integration=self.name, action=fn.__name__, approval=used)
            return fn(self, *args, **kw)
        wrapper.sensitive_kind = kind
        return wrapper
    return deco


class Integration:
    name = "base"
    description = ""
    required_secrets: tuple = ()

    def __init__(self):
        self.secrets = read_env_file(SECRETS / "integrations" / f"{self.name}.env")

    def configured(self) -> bool:
        return all(self.secrets.get(k) for k in self.required_secrets)

    def health(self) -> dict:
        return {"configured": self.configured()}


def discover() -> dict[str, Integration]:
    out = {}
    for p in sorted(INTEGRATIONS.glob("*/plugin.py")):
        name = p.parent.name
        if name.startswith("_"):
            continue
        try:
            spec = importlib.util.spec_from_file_location(f"moonshots_int_{name}", p)
            mod = importlib.util.module_from_spec(spec)
            sys.modules[spec.name] = mod
            spec.loader.exec_module(mod)
            out[name] = mod.Plugin()
        except Exception as e:
            log("core", "error", "integration failed to load", integration=name, error=repr(e))
    return out


def get(name: str) -> Integration:
    return discover()[name]
