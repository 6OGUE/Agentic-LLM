import json
from typing import Optional

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from executor import build_tool_registry, execute_tool, load_tools_schema
from llm import ask_llm


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


def agent(user_message: str, confirmed: Optional[bool] = None):
    tools_schema = load_tools_schema("tool_details.json")
    registry = build_tool_registry(tools_schema)
    iteration = 0
    max_iterations = 10
    require_tool_choice = True

    while iteration < max_iterations:
        iteration += 1
        output = ask_llm(user_message, tools_schema, require_tool_choice=require_tool_choice)

        if not isinstance(output, dict):
            return {
                "status": "error",
                "response": f"Unexpected model output: {output}",
            }

        if not output.get("tool_call"):
            return {
                "status": "success",
                "response": output.get("response", ""),
            }

        tool_name = output.get("tool_name")
        tool_args = output.get("tool_args") or {}

        if not tool_name:
            return {
                "status": "error",
                "response": "Model requested a tool call without naming a tool.",
            }

        current_tool = next(
            (tool for tool in tools_schema if tool["name"] == tool_name),
            {},
        )

        requires_auth = current_tool.get("requires_confirmation", False)

        if requires_auth and confirmed is None:
            if tool_name == "run_cmd":
                confirmation_message = (
                    f"Agent wants to run the command: "
                    f"{tool_args.get('cmd', '')}"
                )
            else:
                confirmation_message = (
                    f"Agent wants to {tool_name.replace('_', ' ')}"
                )

            return {
                "status": "requires_confirmation",
                "tool_name": tool_name,
                "tool_args": tool_args,
                "message": confirmation_message,
            }

        if requires_auth and confirmed is False:
            require_tool_choice = False
            confirmed = None
            continue

        result = execute_tool(
            tool_name,
            tool_args,
            registry,
            tools_schema,
        )

        _print_tool_result(tool_name, result)

        confirmed = None

        user_message = _build_follow_up_prompt(
            user_message,
            tool_name,
            str(result),
        )

    return {
        "status": "error",
        "response": "Max iterations reached",
    }



@app.post("/chat")
def chat(request: ChatRequest):
    return agent(request.message, confirmed=request.confirmed)
