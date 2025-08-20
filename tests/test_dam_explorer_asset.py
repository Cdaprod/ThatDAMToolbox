"""Ensure the DAM Explorer asset is served correctly.

Run tests with:
    pytest -q
"""

from fastapi.testclient import TestClient


def test_dashboard_includes_dam_explorer(api_client: TestClient) -> None:
    """Dashboard HTML should reference the explorer script."""
    resp = api_client.get("/")
    assert resp.status_code == 200
    assert "/static/components/dam-explorer.js" in resp.text


def test_dam_explorer_asset_served(api_client: TestClient) -> None:
    """Explorer script should be accessible without 404."""
    resp = api_client.get("/static/components/dam-explorer.js")
    assert resp.status_code == 200
    assert "export default" in resp.text

