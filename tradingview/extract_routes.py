#!/usr/bin/env python3
import re
import json
import uuid
from datetime import datetime

def extract_flask_routes(file_path):
    with open(file_path, 'r') as file:
        content = file.read()
    
    # First check - does app.py have route definitions?
    print(f"Searching for route definitions in {file_path}")
    if '@app.route' not in content:
        print("Warning: No '@app.route' found in the file!")
    
    # Regex pattern to match Flask route decorators
    # This pattern is more tolerant of various formatting styles
    pattern = r'@app\.route\s*\(\s*[\'"]([^\'"]+)[\'"](?:\s*,\s*methods\s*=\s*(\[[^\]]+\]))?\s*\)'

    route_matches = list(re.finditer(pattern, content))
    print(f"Found {len(route_matches)} route pattern matches")
    
    routes = []
    for i, match in enumerate(route_matches):
        route_path = match.group(1)
        methods_str = match.group(2)
        
        # Extract HTTP methods
        methods = ["GET"]  # Default to GET if methods aren't specified
        if methods_str:
            # Extract the methods from the string representation
            methods_match = re.findall(r'[\'"]([A-Z]+)[\'"]', methods_str)
            if methods_match:
                methods = methods_match
        
        # Get the function name that follows the route decorator
        # Look for the function definition after this decorator
        func_match = re.search(r'def\s+([a-zA-Z0-9_]+)\s*\(', content[match.end():match.end()+200])
        if func_match:
            function_name = func_match.group(1)
            routes.append({
                "path": route_path,
                "methods": methods,
                "function_name": function_name
            })
            print(f"Route {i+1}: {route_path} -> {function_name} [{', '.join(methods)}]")
        else:
            print(f"Route {i+1}: {route_path} -> Could not find function name!")
    
    return routes

def create_postman_collection(routes, base_url='{{baseUrl}}'):
    # Create a unique ID for the collection
    collection_id = str(uuid.uuid4())
    current_time = datetime.now().isoformat()
    
    # Initialize the collection structure
    collection = {
        "info": {
            "_postman_id": collection_id,
            "name": "TradingView Yahoo Finance API",
            "description": "API collection for the TradingView Yahoo Finance application. This collection includes endpoints for financial data, charts, trading plans, and AI-powered analysis.",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
            "updatedAt": current_time
        },
        "item": [],
        "variable": [
            {
                "key": "baseUrl",
                "value": "http://localhost:5000",
                "type": "string",
                "description": "Base URL for the API"
            }
        ]
    }
    
    # Group routes by their first path segment
    route_groups = {}
    for route in routes:
        # Get the first segment of the path (e.g., '/api/data' -> 'api')
        segments = [s for s in route["path"].split('/') if s]
        group_name = segments[0] if segments else "root"
        
        if group_name not in route_groups:
            route_groups[group_name] = []
        
        route_groups[group_name].append(route)
    
    # Create folder structure and add requests
    for group_name, group_routes in route_groups.items():
        folder = {
            "name": group_name,
            "item": []
        }
        
        for route in group_routes:
            for method in route["methods"]:
                # Create a request for each method
                request = {
                    "name": f"{route['function_name']} ({method})",
                    "request": {
                        "method": method,
                        "header": [],
                        "url": {
                            "raw": f"{base_url}{route['path']}",
                            "host": [
                                "{{baseUrl}}"
                            ],
                            "path": [s for s in route["path"].split('/') if s]
                        }
                    },
                    "response": []
                }
                
                # Add body for POST, PUT, PATCH methods
                if method in ["POST", "PUT", "PATCH"]:
                    request["request"]["header"].append({
                        "key": "Content-Type",
                        "value": "application/json"
                    })
                    
                    # Add sample request body based on the endpoint
                    sample_body = "{\n  \"key\": \"value\"\n}"
                    
                    # Customize request body for specific endpoints
                    if "chatbot" in route['function_name']:
                        sample_body = "{\n  \"messages\": [{\"role\": \"user\", \"content\": \"Tell me about AAPL\"}],\n  \"selectedSymbol\": \"AAPL\"\n}"
                    elif "analyze" in route['function_name']:
                        sample_body = "{\n  \"stock\": \"AAPL\",\n  \"strategy\": \"long\",\n  \"trading_timeframe\": \"1d\"\n}"
                    elif "trade_plan" in route['function_name']:
                        sample_body = "{\n  \"symbol\": \"AAPL\",\n  \"interval\": \"1d\",\n  \"strategy\": \"long\",\n  \"trading_timeframe\": \"1d\",\n  \"positionSize\": \"100\",\n  \"rrRatio\": \"2\"\n}"
                    
                    request["request"]["body"] = {
                        "mode": "raw",
                        "raw": sample_body,
                        "options": {
                            "raw": {
                                "language": "json"
                            }
                        }
                    }
                
                # Handle route parameters (e.g., <ticker>, <int:ema_period>)
                param_pattern = r'<(?:(?P<converter>[a-zA-Z_]+):)?(?P<parameter>\w+)>'
                path_params = re.finditer(param_pattern, route["path"])
                
                # If there are path parameters, add them to the URL
                if re.search(param_pattern, route["path"]):
                    request["request"]["url"]["variable"] = []
                    
                    for param_match in re.finditer(param_pattern, route["path"]):
                        converter = param_match.group("converter") or "string"
                        parameter = param_match.group("parameter")
                        
                        param_type = "string"
                        if converter == "int":
                            param_type = "number"
                        
                        # Set default values for common parameters
                        default_value = f"{{{{parameter_{parameter}}}}}"
                        if parameter == "ticker" or parameter == "symbol" or parameter == "stock":
                            default_value = "AAPL"
                        elif parameter == "interval":
                            default_value = "1d"
                        elif parameter == "ema_period":
                            default_value = "20"
                        elif parameter == "rsi_period":
                            default_value = "14"
                        
                        request["request"]["url"]["variable"].append({
                            "key": parameter,
                            "value": default_value,
                            "description": f"Type: {converter or 'string'}",
                            "type": param_type
                        })
                
                folder["item"].append(request)
        
        collection["item"].append(folder)
    
    return collection

def generate_postman_collection(app_file_path, output_file_path):
    routes = extract_flask_routes(app_file_path)
    collection = create_postman_collection(routes)
    
    with open(output_file_path, 'w') as output_file:
        json.dump(collection, output_file, indent=2)
    
    print(f"Extracted {len(routes)} routes")
    print(f"Postman collection saved to {output_file_path}")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        app_path = sys.argv[1]
        output_path = sys.argv[2] if len(sys.argv) > 2 else "postman_collection.json"
    else:
        app_path = "app.py"  # Default path
        output_path = "postman_collection.json"
    
    generate_postman_collection(app_path, output_path) 