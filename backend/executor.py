import importlib
import json
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent


def load_tools_schema(path: str = "tool_details.json") -> list[dict[str, Any]]:
    schema_path = (BASE_DIR / path).resolve()
    with schema_path.open("r", encoding="utf-8") as schema_file:
        payload = json.load(schema_file)

    tools = payload.get("tools", [])
    if not isinstance(tools, list):
        raise ValueError("Tool schema must contain a 'tools' list.")
    return tools


def build_tool_registry(tools_schema: list[dict[str, Any]]) -> dict[str, Any]:
    registry: dict[str, Any] = {}

    for tool in tools_schema:
        module_name = tool.get("module")
        tool_name = tool.get("name")

        if not module_name or not tool_name:
            raise ValueError(f"Invalid tool definition: {tool}")

        module = importlib.import_module(module_name)
        if not hasattr(module, tool_name):
            raise AttributeError(f"Tool '{tool_name}' not found in module '{module_name}'.")

        registry[tool_name] = getattr(module, tool_name)

    return registry


def validate_args(tool_schema: list[dict[str, Any]], tool_name: str, tool_args: dict[str, Any] | None) -> tuple[bool, str | None]:
    safe_args = tool_args or {}

    for tool in tool_schema:
        if tool.get("name") != tool_name:
            continue

        parameters = tool.get("parameters", {})
        required = parameters.get("required", [])
        properties = parameters.get("properties", {})

        for required_arg in required:
            if required_arg not in safe_args:
                return False, f"Missing required arg: {required_arg}"

        for arg_name in safe_args:
            if arg_name not in properties:
                return False, f"Unknown arg: {arg_name}"

        return True, None

    return False, "Tool not found"


def execute_tool(tool_name: str, tool_args: dict[str, Any], registry: dict[str, Any], tool_schema: list[dict[str, Any]]) -> str | Any:
    valid, error_message = validate_args(tool_schema, tool_name, tool_args)

    if not valid:
        return f"Tool validation error: {error_message}"

    try:
        tool_function = registry[tool_name]
        return tool_function(**tool_args)
    except Exception as exc:
        return f"Execution error: {str(exc)}"