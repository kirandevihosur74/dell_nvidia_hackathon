#!/usr/bin/env python3
from extract_routes import generate_postman_collection
import os

def main():
    # Path to tradingview-yahoo-finance directory
    target_dir = "/Users/omatsone/Downloads/tradingview-yahoo-finance"
    
    # Path to app.py in the target directory
    app_path = os.path.join(target_dir, "app.py")
    
    # Output path for the Postman collection
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tradingview_yahoo_finance_api.postman_collection.json")
    
    print(f"Generating Postman collection from: {app_path}")
    print(f"Output will be saved to: {output_path}")
    
    generate_postman_collection(app_path, output_path)

if __name__ == "__main__":
    main() 