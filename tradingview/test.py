import yfinance as yf
import pandas as pd

# Fetch fresh data for ES=F
ticker = "ES=F"
interval = "1d"
data = yf.download(ticker, period="1mo", interval=interval, prepost=True, auto_adjust=True)

# Print last few rows
print("\n=== RAW DATA SAMPLE ===")
print(data.tail())

# Check column names
print("\n=== COLUMN NAMES ===")
print(data.columns)

# Ensure Open/High/Low/Close exist
required_columns = ["Open", "High", "Low", "Close"]
missing_columns = [col for col in required_columns if col not in data.columns]

if missing_columns:
    print(f"\n❌ ERROR: Missing columns: {missing_columns}")
else:
    print("\n✅ All required columns are present!")
