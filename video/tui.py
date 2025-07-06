# /video/tui.py
from textual.app import App, ComposeResult
from textual.widgets import (
    Header, Footer, TabbedContent, Static, DataTable,
    Input, Button, Tabs
)
from textual.containers import Vertical, Horizontal
import json, asyncio, subprocess, shlex

def run_cli_json(step: dict) -> dict | list:
    """Run the built-in CLI and return parsed JSON."""
    from video.cli import run_cli_from_json
    return json.loads(run_cli_from_json(json.dumps(step)))

class IndexerTUI(App):
    CSS = "Screen {align: center middle;}"
    BINDINGS = [("q", "quit", "Quit")]

    async def _refresh_stats(self):
        stats = run_cli_json({"action":"stats"})
        table = self.query_one("#stats", DataTable)
        table.clear(columns=True)
        for k,v in stats.items():
            table.add_row(k, str(v))

    def compose(self) -> ComposeResult:
        yield Header()
        with TabbedContent():
            with Tabs():
                yield Tabs.Tab("Stats", id="tab-stats")
                yield Tabs.Tab("Recent", id="tab-recent")
            with Static(id="stats"):
                yield DataTable(id="stats")
            with Static(id="recent"):
                yield DataTable(id="recent")
        yield Footer()

    async def on_mount(self):
        await self._refresh_stats()
        recent = run_cli_json({"action":"recent","limit":20})
        recent_table = self.query_one("#recent", DataTable)
        recent_table.add_columns("Batch","Filename","Added")
        for r in recent:
            recent_table.add_row(r["batch"] or "-", r["name"], r["created"][:19])

if __name__ == "__main__":
    IndexerTUI().run()