import json
import os
import time
from pathlib import Path
from typing import Any
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import ServerError


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

AVAILABLE_MODELS = (
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemma-4-26b-a4b-it",
)
DEFAULT_MODEL = "gemini-3.1-flash-lite"
MODEL = DEFAULT_MODEL
_api_key: str | None = None


def set_api_key(api_key: str) -> None:
    global _api_key
    _api_key = api_key.strip() or None


def clear_api_key() -> None:
    global _api_key
    _api_key = None


def get_model() -> str:
    return MODEL


def set_model(model: str) -> None:
    global MODEL
    if model not in AVAILABLE_MODELS:
        raise ValueError(f"Unsupported model: {model}")
    MODEL = model


def has_api_key() -> bool:
    return bool(_api_key or os.environ.get("GOOGLE_API_KEY"))


def build_llm_content(
    user_message: str,
    tools: list[dict[str, Any]],
    require_tool_choice: bool = True,
) -> str:
    content = f"User message: {user_message}"
    if require_tool_choice:
        content += (
            ", Answer Using a tool from the available tools, unless the query "
            "is a basic conversation. For any Theoretical queries always use "
            "tool Compulsorily."
        )

    tool_details = []
    for tool in tools:
        parameters = tool.get("parameters", {}).get("properties", {})
        required = tool.get("parameters", {}).get("required", [])
        parameter_names = [
            name if name in required else f"{name}?"
            for name in parameters
        ]
        signature = f"{tool['name']}({', '.join(parameter_names)})"
        details = [
            f"{name}:{parameter.get('description', '')}"
            for name, parameter in parameters.items()
        ]
        description = tool.get("description", "")
        tool_details.append(
            f"{signature} : {description}"
            + (f" {' '.join(details)}" if details else "")
        )

    return f"""
{content}
Available tools:
{chr(10).join(tool_details)}
"""


def get_system_prompt() -> str:
    prompt_path = BASE_DIR / "system_prompt.txt"
    if not prompt_path.exists():
        raise FileNotFoundError(f"Missing system prompt file: {prompt_path}")
    return prompt_path.read_text(encoding="utf-8")


def get_client():
    api_key = _api_key or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GOOGLE_API_KEY is not set. Add it in the UI or backend .env file."
        )
    return genai.Client(api_key=api_key)


def _normalize_json_payload(payload: Any) -> dict[str, Any]:
    if isinstance(payload, dict):
        return payload
    if isinstance(payload, list):
        if not payload:
            raise ValueError("Model returned an empty JSON array.")
        if isinstance(payload[0], dict):
            return payload[0]
        if isinstance(payload[0], str):
            return _extract_json(payload[0])
    if isinstance(payload, str):
        return _extract_json(payload)
    raise TypeError(
        f"Unsupported model response payload type: {type(payload).__name__}"
    )


def _extract_json(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    return _normalize_json_payload(json.loads(text))


def ask_llm(
    user_message: str,
    tools: list[dict[str, Any]],
    max_retries: int = 3,
    require_tool_choice: bool = True,
    custom_system_prompt: str = "",
) -> dict[str, Any]:
    content = build_llm_content(
        user_message,
        tools,
        require_tool_choice=require_tool_choice,
    )
    client = get_client()
    system_prompt = get_system_prompt()
    if custom_system_prompt.strip():
        system_prompt = f"{system_prompt.rstrip()}\n\n{custom_system_prompt.strip()}"
    last_error: Exception | None = None

    for attempt in range(max_retries):
        try:
            chat = client.chats.create(
                model=MODEL,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                ),
            )
            response = chat.send_message(content)
            if not response.text:
                raise ValueError("Gemini returned an empty response.")
            parsed_response = _extract_json(response.text)
            print("Gemini JSON response:")
            print(json.dumps(parsed_response, indent=2, ensure_ascii=False))
            return parsed_response
        except ServerError as exc:
            last_error = exc
            wait = 2 ** attempt
            print(
                f"Gemini server error (attempt {attempt + 1}/{max_retries}): "
                f"{exc}. Retrying in {wait}s..."
            )
            time.sleep(wait)
        except (json.JSONDecodeError, TypeError, ValueError) as exc:
            last_error = exc
            print(
                f"Failed to parse Gemini output as JSON "
                f"(attempt {attempt + 1}/{max_retries}): {exc}"
            )
            if "response" in locals():
                print(f"Raw output was: {response.text!r}")
            time.sleep(1)

    raise RuntimeError(
        f"Gemini ask_llm failed after {max_retries} attempts: {last_error}"
    ) from last_error
