from moonshots.integrations import Integration, sensitive


class Plugin(Integration):
    name = "example"                 # must match the folder name
    description = "What this integration talks to"
    required_secrets = ("API_KEY",)  # read from secrets/integrations/example.env

    def read_something(self):
        """Read-only calls need no approval."""
        ...

    @sensitive("external")
    def publish(self, payload):
        """Irreversible external action: gated behind Don's approval."""
        ...
