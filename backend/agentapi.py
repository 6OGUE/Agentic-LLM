import json
from pathlib import Path
from typing import Iterator, Optional

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.responses import StreamingResponse

from executor import build_tool_registry, execute_tool, load_tools_schema
from llm import MODEL, ask_llm


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    confirmed: Optional[bool] = None


def _print_tool_result(tool_name: str, result: object) -> None:
    print(f"Tool response for {tool_name}:")
    if isinstance(result, (dict, list)):
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print(result)


def _build_follow_up_prompt(original_request: str, tool_name: str, tool_result: str) -> str:
    return f"""

    Original request: {original_request}
    Previous tool execution:
        - name: {tool_name}
        - result: {tool_result}
    Determine the next step if required, else provide the final answer. Make sure the final answer is a structured and polished one and NEVER RETURN raw output of the tool result. STRICTLY DO NOT provide unwanted data. Only provide what the user has asked for.
            
    """


def _build_incomplete_response_prompt(original_request: str) -> str:
    return f"""

    Original request: {original_request}
    The previous model response was incomplete because it did not include a
    final answer or a tool call. Continue the task using the available tools.
    Do not return tool_call=false unless the entire request is complete and
    response contains a non-empty final answer.

    """


def _build_repeated_tool_prompt(
    original_request: str,
    tool_name: str,
    tool_args: dict,
) -> str:
    return f"""

    Original request: {original_request}
    You already executed this exact tool call successfully:
        - name: {tool_name}
        - arguments: {json.dumps(tool_args, ensure_ascii=False)}
    Do not call the same tool with the same arguments again. Use the existing
    result and provide the final answer now. Return tool_call=false with a
    non-empty response.

    """


def agent_events(user_message: str, confirmed: Optional[bool] = None) -> Iterator[dict]:
    tools_schema = load_tools_schema("tool_details.json")
    registry = build_tool_registry(tools_schema)
    iteration = 0
    require_tool_choice = True
    last_read_path: Optional[str] = None
    tool_error = False
    last_tool_call: Optional[tuple[str, dict]] = None

    while True:
        iteration += 1
        yield {"event": "iteration", "iteration": iteration}
        output = ask_llm(user_message, tools_schema, require_tool_choice=require_tool_choice)
        yield {
            "event": "llm_call",
            "iteration": iteration,
            "model": MODEL,
            "response": output,
        }

        if not isinstance(output, dict):
            yield {
                "status": "error",
                "response": f"Unexpected model output: {output}",
            }
            return

        if not output.get("tool_call"):
            response = output.get("response")
            if isinstance(response, str) and response.strip() and not tool_error:
                yield {
                    "event": "agent_response",
                    "response": response,
                }
                yield {
                    "status": "success",
                    "response": response,
                }
                return

            user_message = _build_incomplete_response_prompt(user_message)
            require_tool_choice = True
            continue

        tool_name = output.get("tool_name")
        tool_args = output.get("tool_args") or {}

        if tool_name == "rename_file" and last_read_path:
            requested_path = tool_args.get("path", "")
            new_name = tool_args.get("new_name", "")
            if (
                requested_path
                and new_name
                and Path(requested_path).name.lower() == new_name.lower()
            ):
                tool_args = {**tool_args, "path": last_read_path}

        if not tool_name:
            yield {
                "status": "error",
                "response": "Model requested a tool call without naming a tool.",
            }
            return

        if last_tool_call == (tool_name, tool_args):
            user_message = _build_repeated_tool_prompt(
                user_message,
                tool_name,
                tool_args,
            )
            require_tool_choice = False
            continue

        current_tool = next(
            (tool for tool in tools_schema if tool["name"] == tool_name),
            {},
        )

        requires_auth = current_tool.get("requires_confirmation", False)

        if requires_auth and confirmed is None:
            
            confirmation_message = (
                f"Can i {tool_name.replace('_', ' ')}?"
            )

            yield {
                "status": "requires_confirmation",
                "tool_name": tool_name,
                "tool_args": tool_args,
                "message": confirmation_message,
                "continuation": user_message,
            }
            return

        if requires_auth and confirmed is False:
            require_tool_choice = False
            confirmed = None
            continue

        yield {"event": "tool_call", "tool_name": tool_name}
        yield {
            "event": "tool_execution",
            "tool_name": tool_name,
            "tool_args": tool_args,
            "status": "started",
        }
        result = execute_tool(
            tool_name,
            tool_args,
            registry,
            tools_schema,
        )

        _print_tool_result(tool_name, result)
        yield {
            "event": "tool_execution",
            "tool_name": tool_name,
            "tool_args": tool_args,
            "result": result,
            "status": "completed",
        }

        if not isinstance(result, str) or not result.startswith(
            ("Execution error:", "Tool validation error:")
        ):
            last_tool_call = (tool_name, tool_args)

        if tool_name == "read_file" and not str(result).startswith("Execution error:"):
            last_read_path = tool_args.get("path")
        tool_error = isinstance(result, str) and (
            result.startswith("Execution error:")
            or result.startswith("Tool validation error:")
        )

        user_message = _build_follow_up_prompt(
            user_message,
            tool_name,
            str(result),
        )
        confirmed = None

def agent(user_message: str, confirmed: Optional[bool] = None):
    final_event = None
    for event in agent_events(user_message, confirmed):
        final_event = event
    return final_event

@app.post("/chat")
def chat(request: ChatRequest):
    def event_stream():
        for event in agent_events(request.message, confirmed=request.confirmed):
            yield json.dumps(event, ensure_ascii=False) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")
