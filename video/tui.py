#!/usr/bin/env python3
"""
Textual dashboard for That DAM Toolbox – uses the existing CLI for data.
"""

from __future__ import annotations

import json, asyncio
from typing import Any

from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.widgets import (
    Header, Footer, TabPane, TabbedContent,
    DataTable, Static, Input, LoadingIndicator
)

# ─── CLI bridge ──────────────────────────────────────────────────────────
def run_cli_json(step: dict[str, Any]) -> Any:
    from video.cli import run_cli_from_json
    return json.loads(run_cli_from_json(json.dumps(step)))

# ─── helpers ─────────────────────────────────────────────────────────────
def _table_clear_and_cols(tbl: DataTable, *cols: str) -> None:
    tbl.clear(columns=True)
    tbl.add_columns(*cols)


class Dashboard(App):
    """Interactive TUI dashboard."""
    BINDINGS = [
        Binding("q", "quit", "Quit"),
        Binding("r", "refresh_all", "Refresh"),
        Binding("/", "search_prompt", "Search"),
        Binding("b", "scan_batch", "Quick batch scan"),
    ]

    # ─── layout ───────────────────────────────────────────────────────────
    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)

        with Horizontal(id="split"):
            with TabbedContent(id="nav", tab_position="left"):
                with TabPane("Stats", id="p-stats"):
                    yield DataTable(id="tbl-stats")
                with TabPane("Recent", id="p-recent"):
                    yield DataTable(id="tbl-recent")
                with TabPane("Batches", id="p-batches"):
                    yield DataTable(id="tbl-batches")

            with Vertical(id="content"):
                yield Static("Select a row…", id="content-title")
                yield DataTable(id="tbl-content")

        yield Footer()

    # ─── lifecycle ────────────────────────────────────────────────────────
    async def on_mount(self) -> None:
        self.set_interval(5, self.action_refresh_all)
        await self.action_refresh_all()

    # ─── actions / keys ───────────────────────────────────────────────────
    async def action_refresh_all(self) -> None:
        await asyncio.gather(
            self._load_stats(),
            self._load_recent(),
            self._load_batches(),
        )

    async def action_scan_batch(self) -> None:
        await self._show_spinner("Scanning…")
        res = await asyncio.to_thread(run_cli_json, {"action": "scan", "workers": 4})
        await self._clear_spinner(f"Scan complete: {res.get('processed', 0)} files")

    async def action_search_prompt(self) -> None:
        prompt = Input(placeholder="Search… (Esc cancels)")
        await self.mount(prompt, after="#split")
        prompt.focus()

        async def _on_submit(value: str) -> None:  # type: ignore[override]
            prompt.remove()
            if value.strip():
                await self._run_search(value)

        prompt.on_submit = _on_submit  # type: ignore[attr-defined]

    # ─── loaders ----------------------------------------------------------
    async def _load_stats(self) -> None:
        tbl = self.query_one("#tbl-stats", DataTable)
        data = await asyncio.to_thread(run_cli_json, {"action": "stats"})
        _table_clear_and_cols(tbl, "Key", "Value")
        for k, v in data.items():
            tbl.add_row(k, str(v))

    async def _load_recent(self) -> None:
        tbl = self.query_one("#tbl-recent", DataTable)
        rows = await asyncio.to_thread(run_cli_json, {"action": "recent", "limit": 100})
        _table_clear_and_cols(tbl, "Batch", "Filename", "Added")
        for r in rows:
            tbl.add_row(r["batch"] or "-", r["name"], r["created"][:19])

    async def _load_batches(self) -> None:
        tbl = self.query_one("#tbl-batches", DataTable)
        data = await asyncio.to_thread(run_cli_json, {"action": "batches", "cmd": "list"})
        _table_clear_and_cols(tbl, "Batch", "Count")
        for name, count in data.items():
            tbl.add_row(name, str(count))

    # ─── events -----------------------------------------------------------
    async def on_data_table_row_highlighted(
        self, ev: DataTable.RowHighlighted
    ) -> None:
        if ev.sender.id != "tbl-batches":
            return
        sel = ev.sender.get_row_at(ev.cursor_row)
        if sel:
            await self._show_batch(sel.get_cell(0))

    # ─── content fillers --------------------------------------------------
    async def _show_batch(self, batch_name: str) -> None:
        tbl = self.query_one("#tbl-content", DataTable)
        self.query_one("#content-title", Static).update(f"Batch: {batch_name}")
        rows = await asyncio.to_thread(run_cli_json, {
            "action": "batches", "cmd": "show", "batch_name": batch_name
        })
        _table_clear_and_cols(tbl, "Filename", "Size", "Created")
        for r in rows:
            tbl.add_row(r["name"], str(r["size"]), r["created"][:19])

    async def _run_search(self, query: str) -> None:
        tbl = self.query_one("#tbl-content", DataTable)
        self.query_one("#content-title", Static).update(f"Search: {query}")
        rows = await asyncio.to_thread(run_cli_json, {
            "action": "search", "query": query, "limit": 200
        })
        _table_clear_and_cols(tbl, "Batch", "Filename", "Created")
        for r in rows:
            tbl.add_row(r["batch"] or "-", r["name"], r["created"][:19])

    # ─── spinner helpers --------------------------------------------------
    async def _show_spinner(self, text: str) -> None:
        sp = LoadingIndicator()
        await self.mount(sp, after="#split")
        sp.update(text)
        self._spinner = sp  # type: ignore[attr-defined]

    async def _clear_spinner(self, final_msg: str | None = None) -> None:
        sp = getattr(self, "_spinner", None)
        if sp:
            sp.remove()
            if final_msg:
                self.screen.notify(final_msg)
            self._spinner = None  # type: ignore[attr-defined]


if __name__ == "__main__":
    Dashboard().run()