"""
CLI-level integration tests using Click's CliRunner.
"""
import json
import pytest
from pathlib import Path


def test_cli_help(cli_runner):
    """`video-cli --help` prints usage information and exits with 0."""
    res = cli_runner.invoke(cli, ["--help"])
    assert res.exit_code == 0
    assert "Usage" in res.output


def test_cli_list_batches(cli_runner, monkeypatch):
    """
    Monkey-patch API call used by `list-batches` so the CLI works
    without hitting the real server.
    """
    fake = [{"batch": "foo", "count": 1}, {"batch": "bar", "count": 2}]
    monkeypatch.setattr(
        "video.cli.commands.batches.fetch_batches",
        lambda *_args, **_kw: fake
    )
    res = cli_runner.invoke(cli, ["list-batches", "--json"])
    assert res.exit_code == 0
    data = json.loads(res.output)
    assert data == fake


def test_cli_upload(tmp_path: Path, cli_runner, monkeypatch):
    """
    Full round-trip: create tiny file → monkey-patch API → run
    `video-cli upload` and ensure success message appears.
    """
    tiny = tmp_path / "tiny.mp4"
    tiny.write_bytes(b"\x00")

    # stub out the actual HTTP request inside CLI helper
    monkeypatch.setattr(
        "video.cli.commands.upload.upload_files",
        lambda files, batch: {"uploaded": len(files), "batch": batch}
    )
    res = cli_runner.invoke(cli, ["upload", str(tiny), "--batch", "cli_batch"])
    assert res.exit_code == 0
    assert "uploaded: 1" in res.output.lower()