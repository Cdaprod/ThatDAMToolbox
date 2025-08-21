"""Tenancy service exposing tenant and membership management.

Example:
    uvicorn tenancy.app:app
"""
from enum import Enum
from typing import Dict, Protocol
from uuid import UUID, uuid4

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel


class Role(str, Enum):
    """Role defines membership permissions."""

    VIEWER = "VIEWER"
    MEMBER = "MEMBER"
    ADMIN = "ADMIN"
    OWNER = "OWNER"


ROLE_ORDER = {
    Role.VIEWER: 0,
    Role.MEMBER: 1,
    Role.ADMIN: 2,
    Role.OWNER: 3,
}


class PolicyPort(Protocol):
    """PolicyPort defines role comparison logic."""

    def allow(self, actor: Role, target: Role) -> bool:
        ...


class RolePolicy:
    """Simple role comparison policy."""

    def allow(self, actor: Role, target: Role) -> bool:  # pragma: no cover - trivial
        return ROLE_ORDER[actor] >= ROLE_ORDER[target]


class Tenant(BaseModel):
    id: UUID
    name: str


class Membership(BaseModel):
    id: UUID
    tenant_id: UUID
    user_id: str
    role: Role


class TenancyService:
    """In-memory tenancy logic."""

    def __init__(self, policy: PolicyPort) -> None:
        self.policy = policy
        self.tenants: Dict[UUID, Tenant] = {}
        self.memberships: Dict[UUID, Membership] = {}

    def reset(self) -> None:
        """Clear all tenants and memberships."""

        self.tenants.clear()
        self.memberships.clear()

    def login(self, user_id: str) -> Membership:
        for m in self.memberships.values():
            if m.user_id == user_id:
                return m
        tenant = Tenant(id=uuid4(), name=f"{user_id}'s tenant")
        self.tenants[tenant.id] = tenant
        membership = Membership(
            id=uuid4(), tenant_id=tenant.id, user_id=user_id, role=Role.OWNER
        )
        self.memberships[membership.id] = membership
        return membership

    def create_tenant(self, name: str, user_id: str) -> Tenant:
        tenant = Tenant(id=uuid4(), name=name)
        self.tenants[tenant.id] = tenant
        membership = Membership(
            id=uuid4(), tenant_id=tenant.id, user_id=user_id, role=Role.OWNER
        )
        self.memberships[membership.id] = membership
        return tenant

    def _actor_membership(self, user_id: str, tenant_id: UUID) -> Membership:
        for m in self.memberships.values():
            if m.user_id == user_id and m.tenant_id == tenant_id:
                return m
        raise HTTPException(status_code=403, detail="membership required")

    def invite(self, tenant_id: UUID, actor_user: str, target_user: str, role: Role) -> Membership:
        actor = self._actor_membership(actor_user, tenant_id)
        if not self.policy.allow(actor.role, role):
            raise HTTPException(status_code=403, detail="insufficient role")
        membership = Membership(
            id=uuid4(), tenant_id=tenant_id, user_id=target_user, role=role
        )
        self.memberships[membership.id] = membership
        return membership

    def update_membership(
        self, membership_id: UUID, actor_user: str, role: Role
    ) -> Membership:
        membership = self.memberships.get(membership_id)
        if not membership:
            raise HTTPException(status_code=404, detail="membership not found")
        actor = self._actor_membership(actor_user, membership.tenant_id)
        if not self.policy.allow(actor.role, role) or ROLE_ORDER[actor.role] <= ROLE_ORDER[
            membership.role
        ]:
            raise HTTPException(status_code=403, detail="insufficient role")
        membership.role = role
        self.memberships[membership.id] = membership
        return membership


app = FastAPI(title="Tenancy Service")
policy = RolePolicy()
service = TenancyService(policy)


class TenantCreate(BaseModel):
    name: str


class InviteRequest(BaseModel):
    user_id: str
    role: Role


class MembershipUpdate(BaseModel):
    role: Role


@app.post("/login", response_model=Membership)
def login(x_user_id: str = Header(..., alias="X-User-ID")) -> Membership:
    return service.login(x_user_id)


@app.post("/tenants", response_model=Tenant)
def create_tenant(
    payload: TenantCreate, x_user_id: str = Header(..., alias="X-User-ID")
) -> Tenant:
    return service.create_tenant(payload.name, x_user_id)


@app.post("/tenants/{tenant_id}/invite", response_model=Membership)
def invite(
    tenant_id: UUID, payload: InviteRequest, x_user_id: str = Header(..., alias="X-User-ID")
) -> Membership:
    return service.invite(tenant_id, x_user_id, payload.user_id, payload.role)


@app.patch("/memberships/{membership_id}", response_model=Membership)
def patch_membership(
    membership_id: UUID,
    payload: MembershipUpdate,
    x_user_id: str = Header(..., alias="X-User-ID"),
) -> Membership:
    return service.update_membership(membership_id, x_user_id, payload.role)
