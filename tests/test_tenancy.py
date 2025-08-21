"""Integration tests for tenancy service."""

from fastapi.testclient import TestClient

from tenancy.app import app, service


client = TestClient(app)


def setup_function() -> None:
    service.reset()


def test_first_login_creates_personal_tenant() -> None:
    resp = client.post("/login", headers={"X-User-ID": "user1"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["role"] == "OWNER"
    tenant_id = data["tenant_id"]

    resp2 = client.post("/login", headers={"X-User-ID": "user1"})
    assert resp2.json()["id"] == data["id"]
    assert len(service.tenants) == 1
    assert len(service.memberships) == 1

    resp3 = client.post(
        "/tenants", json={"name": "Team"}, headers={"X-User-ID": "user1"}
    )
    assert resp3.status_code == 200
    assert resp3.json()["name"] == "Team"
    assert len(service.tenants) == 2


def test_invite_and_role_update() -> None:
    owner = client.post("/login", headers={"X-User-ID": "owner"})
    tenant_id = owner.json()["tenant_id"]

    invite = client.post(
        f"/tenants/{tenant_id}/invite",
        json={"user_id": "user2", "role": "MEMBER"},
        headers={"X-User-ID": "owner"},
    )
    assert invite.status_code == 200
    membership_id = invite.json()["id"]

    upd = client.patch(
        f"/memberships/{membership_id}",
        json={"role": "ADMIN"},
        headers={"X-User-ID": "owner"},
    )
    assert upd.status_code == 200
    assert upd.json()["role"] == "ADMIN"

    fail = client.patch(
        f"/memberships/{membership_id}",
        json={"role": "OWNER"},
        headers={"X-User-ID": "user2"},
    )
    assert fail.status_code == 403
