from requests.cookies import create_cookie
import yfinance.data as _data

def _wrap_cookie(cookie, session):
    if isinstance(cookie, str):
        value = session.cookies.get(cookie)
        return create_cookie(name=cookie, value=value)
    return cookie

def patch_yfdata_cookie_basic():
    # Historically this worked around a cookie bug in old yfinance whose
    # _get_cookie_basic(self, proxy, timeout) signature we wrapped. Modern
    # yfinance changed that signature and handles cookies correctly on its own,
    # so forcing the old call shape actually breaks it ("takes 1 to 2 positional
    # arguments but 3 were given"). Forward whatever args yfinance passes and
    # fall back to the raw cookie if our wrapper doesn't apply to this version.
    target = getattr(_data, "YfData", None)
    original = getattr(target, "_get_cookie_basic", None)
    if original is None:
        return

    def _patched(self, *args, **kwargs):
        cookie = original(self, *args, **kwargs)
        try:
            return _wrap_cookie(cookie, self._session)
        except Exception:
            return cookie

    target._get_cookie_basic = _patched
