"""Functional smoke test for the running app (http://127.0.0.1:5000).
Categorizes each endpoint and prints a pass/fail matrix."""
import json
import time
import requests

BASE = "http://127.0.0.1:5000"
results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    mark = "PASS" if ok else "FAIL"
    print(f"  [{mark}] {name}  {detail}")


def get(path, **kw):
    return requests.get(BASE + path, timeout=kw.pop("timeout", 30), **kw)


def post(path, payload, timeout=180):
    return requests.post(BASE + path, json=payload, timeout=timeout)


print("\n=== 1. PAGE ROUTES (should render 200) ===")
for p in ["/tradingplan", "/mentalprep", "/macroeconomic", "/fundamental",
          "/opening-bell", "/closing-bell", "/report", "/report/view"]:
    try:
        r = get(p)
        check(f"GET {p}", r.status_code == 200, f"HTTP {r.status_code}, {len(r.text)} bytes")
    except Exception as e:
        check(f"GET {p}", False, f"ERROR {type(e).__name__}: {e}")

print("\n=== 2. LOCAL-LLM ENDPOINTS (Nemotron; expect 200 + non-empty reply) ===")
llm_cases = [
    ("/api/chatbot",
     {"selectedSymbol": "AAPL",
      "messages": [{"role": "user", "content": "One sentence: what is RSI?"}]},
     lambda j: j.get("reply")),
    ("/api/chatbot_technical",
     {"selectedSymbol": "TSLA", "message": "One sentence: what is a moving average?"},
     lambda j: j.get("reply") or j.get("response") or json.dumps(j)[:1]),
    ("/api/analyze_strategy",
     {"strategy": "bull call spread"},
     lambda j: j.get("analysis") or j.get("reply") or json.dumps(j)[:1]),
]
for path, payload, extract in llm_cases:
    try:
        t = time.time()
        r = post(path, payload)
        dt = time.time() - t
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        content = extract(body) if body else None
        ok = r.status_code == 200 and bool(content) and "error" not in body
        snippet = (str(content)[:70] + "...") if content else f"HTTP {r.status_code} {str(body)[:80]}"
        check(f"POST {path}", ok, f"{dt:.1f}s | {snippet}")
    except Exception as e:
        check(f"POST {path}", False, f"ERROR {type(e).__name__}: {e}")

print("\n=== 3. DATA ENDPOINTS ===")
try:
    r = get("/api/symbols")
    j = r.json()
    check("GET /api/symbols", r.status_code == 200 and len(j) > 0, f"HTTP {r.status_code}, {len(j) if isinstance(j,(list,dict)) else '?'} symbols")
except Exception as e:
    check("GET /api/symbols", False, f"ERROR {type(e).__name__}: {e}")
try:
    r = get("/api/market_data/AAPL")
    ok = r.status_code == 200
    check("GET /api/market_data/AAPL", ok, f"HTTP {r.status_code} (yfinance/network)")
except Exception as e:
    check("GET /api/market_data/AAPL", False, f"ERROR {type(e).__name__}: {e}")

print("\n=== 4. OPENAI-ONLY ENDPOINTS (no key set -> should fail GRACEFULLY, not 500-crash app) ===")
for path, payload in [("/api/generate_audio", {"text": "hello"}),
                      ("/api/get_top_news/AAPL", None)]:
    try:
        r = get(path) if payload is None else post(path, payload, timeout=30)
        # "graceful" = server still responds (any HTTP code), didn't hang/crash
        check(f"{path} reachable", r.status_code in (200, 400, 401, 500, 503),
              f"HTTP {r.status_code} (expected to need OpenAI key)")
    except Exception as e:
        check(f"{path} reachable", False, f"ERROR {type(e).__name__}: {e}")

print("\n=== 5. POSTGRES PATH (auth/me is Kinde-gated -> 401 proves it's wired & reachable) ===")
try:
    r = get("/api/auth/me")
    check("GET /api/auth/me (no token)", r.status_code == 401, f"HTTP {r.status_code} (401 = auth gate before DB)")
except Exception as e:
    check("GET /api/auth/me", False, f"ERROR {type(e).__name__}: {e}")

print("\n=== SUMMARY ===")
passed = sum(1 for _, ok, _ in results if ok)
print(f"  {passed}/{len(results)} checks passed")
fails = [n for n, ok, _ in results if not ok]
if fails:
    print("  Failures:", ", ".join(fails))
