import json
import importlib


import os
import json

def load_tools_schema(path="tool_details.json"):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    full_path = os.path.join(base_dir, path)

    with open(full_path, "r", encoding="utf-8") as f:
        return json.load(f)["tools"]


def build_tool_registry(tools_schema):
    registry = {}

    for tool in tools_schema:
        module_name = tool["module"]
        tool_name = tool["name"]

        module = importlib.import_module(module_name)
        func = getattr(module, tool_name)

        registry[tool_name] = func

    return registry


def validate_args(tool_schema, tool_name, tool_args):
    for tool in tool_schema:
        if tool["name"] == tool_name:
            required = tool["parameters"].get("required", [])
            props = tool["parameters"]["properties"]

            for r in required:
                if r not in tool_args:
                    return False, f"Missing required arg: {r}"
                
            for k in tool_args:
                if k not in props:
                    return False, f"Unknown arg: {k}"

            return True, None

    return False, "Tool not found"


def execute_tool(tool_name, tool_args, registry, tool_schema):
    valid, err = validate_args(tool_schema, tool_name, tool_args)

    if not valid:
        return f"Tool validation error: {err}"

    try:
        return registry[tool_name](**tool_args)
    except Exception as e:
        return f"Execution error: {str(e)}"