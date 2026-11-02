import inspect
from typing import Any, Callable

from tools.browse_tools import search_the_internet
from tools.command_tools import run_a_command, run_a_vbs_script


_SUPPORTED_TOOLS: dict[str, Callable[..., Any]] = {
    "run_a_command": run_a_command,
    "search_the_internet": search_the_internet,
    "run_a_vbs_script": run_a_vbs_script,
}


def run_tool_batch(operations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not isinstance(operations, list) or not operations:
        raise ValueError("Provide at least one tool operation.")

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

        function = _SUPPORTED_TOOLS.get(tool_name)
        if function is None:
            results.append({
                "step": index,
                "tool": tool_name,
                "error": f"Unsupported tool: {tool_name}.",
            })
            continue

        parameters = inspect.signature(function).parameters
        required = {
            name
            for name, parameter in parameters.items()
            if parameter.default is inspect.Parameter.empty
        }
        unknown_arguments = arguments.keys() - parameters.keys()
        missing_arguments = required - arguments.keys()
        if unknown_arguments or missing_arguments:
            errors = []
            if missing_arguments:
                errors.append(
                    f"Missing required arguments: {', '.join(sorted(missing_arguments))}."
                )
            if unknown_arguments:
                errors.append(
                    f"Unknown arguments: {', '.join(sorted(unknown_arguments))}."
                )
            results.append({
                "step": index,
                "tool": tool_name,
                "error": " ".join(errors),
            })
            continue

        try:
            result = function(**arguments)
        except Exception as exc:
            results.append({
                "step": index,
                "tool": tool_name,
                "error": f"Execution error: {exc}",
            })
        else:
            results.append({
                "step": index,
                "tool": tool_name,
                "result": result,
            })

    return results
