import json
import os
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import ServerError

load_dotenv()

MODEL = "gemma-4-26b-a4b-it"

client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))

with open("system_prompt.txt", "r") as f:
    SYSTEM_PROMPT = f.read()


def _extract_json(text: str) -> dict:
    """Strip markdown code fences etc. in case the model wraps the JSON."""
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    return json.loads(text)


def ask_llm(user_message, tools, max_retries=3):
    content = f"""
User message:{user_message}
Available tools:{json.dumps(tools, indent=2)}
"""

    last_err = None
    for attempt in range(max_retries):
        try:
            res = client.models.generate_content(
                model=MODEL,
                contents=content,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                ),
            )
            return _extract_json(res.text)
        except ServerError as e:
            last_err = e
            wait = 2 ** attempt
            print(f"ServerError (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {wait}s...")
            time.sleep(wait)
        except json.JSONDecodeError as e:
            last_err = e
            print(f"Failed to parse model output as JSON (attempt {attempt + 1}/{max_retries}): {e}")
            print(f"Raw output was: {res.text!r}")
            time.sleep(1)

    raise RuntimeError(f"ask_llm failed after {max_retries} attempts: {last_err}")
