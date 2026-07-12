from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
from llm import ask_llm
from executor import load_tools_schema, build_tool_registry, execute_tool
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
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

def agent(user_message, confirmed=None):
    tools_schema = load_tools_schema("tool_details.json")
    registry = build_tool_registry(tools_schema)
    iteration = 0
    max_iterations = 5

    while iteration < max_iterations:
        iteration += 1
        output = ask_llm(user_message, tools_schema)

        if not output["tool_call"]:
            return {"status": "success", "response": output["response"]}

        tool_name = output["tool_name"]
        tool_args = output["tool_args"]

        current_tool = next((t for t in tools_schema if t["name"] == tool_name), {})
        requires_auth = current_tool.get("requires_confirmation", False)

        if requires_auth and confirmed is None:
            return {
                "status": "requires_confirmation",
                "tool_name": tool_name,
                "tool_args": tool_args,
                "message": f"Agent wants to run: {tool_args.get('cmd', tool_name)}"
            }

        if requires_auth and confirmed is False:
            return {"status": "success", "response": "Operation cancelled by user."}

        result = execute_tool(tool_name, tool_args, registry, tools_schema)
        confirmed = None 

        user_message = f"""
Original request: {user_message}
Previous tool execution:
- name: {tool_name}
- result: {result}
Determine the next step if required, else provide the final answer. Make sure the final answer is a structured and polished one and NEVER RETURN raw output of the tool result. STRICTLY DO NOT provide unwanted data. Only provide what the user has asked for.
"""

    return {"status": "error", "response": "Max iterations reached"}

@app.post("/chat")
def chat(request: ChatRequest):
    return agent(request.message, confirmed=request.confirmed)

