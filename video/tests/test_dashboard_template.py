"""Tests for the dashboard template's Explorer mount point.

Example:
    pytest video/tests/test_dashboard_template.py
"""
from pathlib import Path
from jinja2 import Environment, FileSystemLoader


def test_dashboard_has_single_mount_point():
    """`dashboard.html` renders exactly one React Explorer mount point."""
    templates_dir = Path(__file__).resolve().parents[1] / "web" / "templates"
    env = Environment(loader=FileSystemLoader(templates_dir))

    html = env.get_template("dashboard.html").render(
        url_for=lambda name, path: f"/{path}"
    )

    assert html.count('id="dam-root"') == 1
    assert 'id="dam-explorer-section"' in html
    assert 'id="explorer-section"' not in html
    assert "<dam-explorer" not in html
