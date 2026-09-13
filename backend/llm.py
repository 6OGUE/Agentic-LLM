import json
import os
import time
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import ServerError


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

MODEL = "gemini-3.5-flash"


def build_llm_content(user_message, tools, require_tool_choice: bool = True) -> str:
    content = f"User message: {user_message}"
    if require_tool_choice:
        content += ", Answer Using a tool from the available tools, unless the query is a basic conversation. For any Theoretical queries always use tool Compulsorily."

    return f"""
{content}
Available tools:{json.dumps(tools, indent=2)}
"""


def get_system_prompt() -> str:
    prompt_path = BASE_DIR / "system_prompt.txt"
    if not prompt_path.exists():
        raise FileNotFoundError(f"Missing system prompt file: {prompt_path}")
    return prompt_path.read_text(encoding="utf-8")


def get_client():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY is not set. Add it to your environment or a .env file.")
    return genai.Client(api_key=api_key)


def _normalize_json_payload(payload):
    if isinstance(payload, dict):
        return payload
    if isinstance(payload, list):
        if not payload:
            raise ValueError("Model returned an empty JSON array.")
        if isinstance(payload[0], dict):
            return payload[0]
        return _extract_json(payload[0])
    if isinstance(payload, str):
        return _extract_json(payload)
    raise TypeError(f"Unsupported model response payload type: {type(payload).__name__}")


def _extract_json(text: str) -> dict:
    """Strip markdown code fences etc. in case the model wraps the JSON."""
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    parsed = json.loads(text)
    return _normalize_json_payload(parsed)


def ask_llm(user_message, tools, max_retries=3, require_tool_choice: bool = True):
    content = build_llm_content(user_message, tools, require_tool_choice=require_tool_choice)

    client = get_client()
    system_prompt = get_system_prompt()
    last_err = None

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
            parsed_response = _extract_json(response.text)
            print("LLM JSON response:")
            print(json.dumps(parsed_response, indent=2, ensure_ascii=False))
            return parsed_response
        except ServerError as exc:
            last_err = exc
            wait = 2 ** attempt
            print(f"ServerError (attempt {attempt + 1}/{max_retries}): {exc}. Retrying in {wait}s...")
            time.sleep(wait)
        except (json.JSONDecodeError, TypeError, ValueError) as exc:
            last_err = exc
            print(f"Failed to parse model output as JSON (attempt {attempt + 1}/{max_retries}): {exc}")
            if "response" in locals():
                print(f"Raw output was: {response.text!r}")
            time.sleep(1)

    raise RuntimeError(f"ask_llm failed after {max_retries} attempts: {last_err}")
