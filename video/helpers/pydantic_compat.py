"""
Runtime-compat shim for Pydantic v1 ↔ v2.

Usage
-----
from video.helpers.pydantic_compat import model_validator

class MyModel(BaseModel):
    @model_validator(mode="after")
    def _check_stuff(cls, m):
        ...
        return m
"""
from packaging import version
import pydantic as _pd

__all__ = ["model_validator", "field_validator"]

_V = version.parse(_pd.__version__)

# --------------------------------------------------------------------------- #
# Model-level validator                                                      #
# --------------------------------------------------------------------------- #
def model_validator(*args, **kw):
    """
    Dispatches to:
      • pydantic.v2   →  @pydantic.model_validator
      • pydantic.v1   →  @pydantic.validator('*')
    """
    if _V < version.parse("2.0"):
        def _wrap(func):
            return _pd.validator("*", allow_reuse=True)(func)
        return _wrap
    return _pd.model_validator(*args, **kw)


# --------------------------------------------------------------------------- #
# Field-level validator (simple re-export; shows how to extend if needed)    #
# --------------------------------------------------------------------------- #
try:
    # Only exists in v2
    from pydantic import field_validator  # noqa: F401
except ImportError:                       # pragma: no cover
    # Fallback for v1 (no-op decorator with same signature)
    def field_validator(*_args, **_kw):   # type: ignore
        def _wrap(func): return func
        return _wrap