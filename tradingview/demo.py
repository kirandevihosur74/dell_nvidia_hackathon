import yfinance as yf
from curl_cffi import requests as curl_requests
import yfinance_cookie_patch

# Apply monkey patch
yfinance_cookie_patch.patch_yfdata_cookie_basic()

def main():
    session = curl_requests.Session(impersonate="chrome")
    ticker = yf.Ticker("AAPL", session=session)
    df = ticker.history(raise_errors=True)
    print(df)

if __name__ == "__main__":
    main()
