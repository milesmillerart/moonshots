"""Send a message to a webhook (Slack/Discord/ntfy style).

Posting outside the box is an external action, so it is approval-gated.
Configure secrets/integrations/notify_webhook.env with WEBHOOK_URL=...
"""
import json
import urllib.request

from moonshots.integrations import Integration, sensitive


class Plugin(Integration):
    name = "notify_webhook"
    description = "POST JSON notifications to a webhook URL (approval-gated)"
    required_secrets = ("WEBHOOK_URL",)

    @sensitive("external")
    def send(self, text: str):
        req = urllib.request.Request(self.secrets["WEBHOOK_URL"], data=json.dumps({"text": text}).encode(),
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status
