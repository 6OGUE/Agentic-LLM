import importlib
import inspect
from typing import Any


_TOOL_MODULES = (
    "tools.file_tools",
    "tools.command_tools",
    "tools.browse_tools",
)


def run_tool_batch(operations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    from executor import execute_tool, load_tools_schema

    if not isinstance(operations, list) or not operations:
        raise ValueError("Provide at least one tool operation.")

    batch_tool = next(
        (
            tool
            for tool in load_tools_schema()
            if tool.get("name") == "run_tool_batch"
        ),
        None,
    )
    if batch_tool is None:
        raise ValueError("The run_tool_batch tool is missing from tool_details.json.")

    tool_names = (
        batch_tool.get("parameters", {})
        .get("properties", {})
        .get("operations", {})
        .get("items", {})
        .get("properties", {})
        .get("tool", {})
        .get("enum", [])
    )
    if not isinstance(tool_names, list) or not all(
        isinstance(name, str) for name in tool_names
    ):
        raise ValueError("The batch tool must define a list of supported tools.")

    registry = {}
    tool_schema = []
    for module_name in _TOOL_MODULES:
        module = importlib.import_module(module_name)
        for tool_name in tool_names:
            if tool_name in registry or not hasattr(module, tool_name):
                continue

            function = getattr(module, tool_name)
            if not callable(function):
                continue

            parameters = inspect.signature(function).parameters
            keyword_parameters = {
                parameter.name: {}
                for parameter in parameters.values()
                if parameter.kind
                in (
                    inspect.Parameter.POSITIONAL_OR_KEYWORD,
                    inspect.Parameter.KEYWORD_ONLY,
                )
            }
            required_parameters = [
                parameter.name
                for parameter in parameters.values()
                if parameter.kind
                in (
                    inspect.Parameter.POSITIONAL_OR_KEYWORD,
                    inspect.Parameter.KEYWORD_ONLY,
                )
                and parameter.default is inspect.Parameter.empty
            ]
            registry[tool_name] = function
            tool_schema.append({
                "name": tool_name,
                "parameters": {
                    "properties": keyword_parameters,
                    "required": required_parameters,
                },
            })

    missing_tools = set(tool_names) - registry.keys()
    if missing_tools:
        raise ValueError(
            f"Batch tools are not available: {', '.join(sorted(missing_tools))}."
        )

    results = []
    for index, operation in enumerate(operations, start=1):
        if not isinstance(operation, dict):
            results.append({
                "step": index,
                "error": f"Operation {index} must be an object.",
            })
            continue

        tool_name = operation.get("tool")
        arguments = operation.get("args")
        if set(operation) != {"tool", "args"}:
            results.append({
                "step": index,
                "tool": tool_name,
                "error": f"Operation {index} must contain only 'tool' and 'args'.",
            })
            continue
        if not isinstance(arguments, dict):
            results.append({
                "step": index,
                "tool": tool_name,
                "error": f"Operation {index} must provide an 'args' object.",
            })
            continue

        result = execute_tool(tool_name, arguments, registry, tool_schema)
        if isinstance(result, str) and result.startswith(
            ("Execution error:", "Tool validation error:")
        ):
            results.append({"step": index, "tool": tool_name, "error": result})
        else:
            results.append({"step": index, "tool": tool_name, "result": result})

    return results
