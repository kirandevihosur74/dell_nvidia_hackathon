from requests.cookies import create_cookie
import yfinance.data as _data

def _wrap_cookie(cookie, session):
    if isinstance(cookie, str):
        value = session.cookies.get(cookie)
        return create_cookie(name=cookie, value=value)
    return cookie

def patch_yfdata_cookie_basic():
    original = _data.YfData._get_cookie_basic

    # Accept 3 arguments: self, proxy, timeout
    def _patched(self, proxy=None, timeout=30):
        cookie = original(self, proxy, timeout)  # Call original with correct args
        return _wrap_cookie(cookie, self._session)

    _data.YfData._get_cookie_basic = _patched
