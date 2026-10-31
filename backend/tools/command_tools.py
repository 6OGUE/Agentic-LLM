import os
import subprocess
import tempfile
from typing import Any


def _process_result_message(
    action: str,
    stdout: str,
    stderr: str,
    returncode: int,
) -> str:
    if returncode != 0:
        return (
            f"{action} failed with exit code {returncode}; "
            "details are available in stderr."
        )
    if not stdout.strip() and not stderr.strip():
        return f"{action} executed successfully, but produced no output."
    if not stdout.strip():
        return f"{action} executed successfully; details are available in stderr."
    return f"{action} executed successfully; output is available in stdout."


def run_a_generic_command(cmd: str) -> dict[str, Any]:
    try:
        completed_process = subprocess.run(
            cmd,
            shell=True,
            text=True,
            capture_output=True,
            check=False,
        )
        message = _process_result_message(
            f"Command '{cmd}'",
            completed_process.stdout,
            completed_process.stderr,
            completed_process.returncode,
        )
        return {
            "message": message,
            "stdout": completed_process.stdout,
            "stderr": completed_process.stderr,
            "returncode": completed_process.returncode,
        }
    except Exception as exc:
        return {
            "message": f"Failed to execute command '{cmd}': {exc}",
            "stdout": "",
            "stderr": str(exc),
            "returncode": 1,
        }


def run_a_vbs_script(script: str) -> dict[str, Any]:
    path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".vbs", delete=False, encoding="utf-8"
        ) as f:
            f.write(script)
            path = f.name
        completed_process = subprocess.run(
            ["cscript", "//Nologo", path],
            text=True,
            capture_output=True,
            check=False,
        )
        message = _process_result_message(
            "VBScript",
            completed_process.stdout,
            completed_process.stderr,
            completed_process.returncode,
        )
        return {
            "message": message,
            "stdout": completed_process.stdout,
            "stderr": completed_process.stderr,
            "returncode": completed_process.returncode,
        }
    except Exception as exc:
        return {
            "message": f"Failed to execute VBScript: {exc}",
            "stdout": "",
            "stderr": str(exc),
            "returncode": 1,
        }
    finally:
        if path and os.path.exists(path):
            os.remove(path)