import os
import re
import subprocess
import tempfile
from typing import Any


def _process_result_message(
    action: str,
    stdout: str,
    stderr: str,
    returncode: int,
) -> dict[str, str]:
    if returncode == 0:
        return {
            "message": f"{action} Successful",
            "output": stdout.strip() or "Executed successfully.",
        }

    return {
        "message": f"{action} Failed",
        "output": stderr.strip() or stdout.strip() or "Failed",
    }


def _normalize_windows_command(cmd: str) -> str:
    if os.name != "nt":
        return cmd

    normalized = cmd.replace(r'\"', '"')

    def normalize_path(match: re.Match[str]) -> str:
        return re.sub(r"\\{2,}", lambda _: "\\", match.group())

    return re.sub(
        r"""(?<![A-Za-z0-9])([A-Za-z]:\\[^\s"']*)""",
        normalize_path,
        normalized,
    )


def run_a_command(cmd: str) -> dict[str, Any]:
    try:
        cmd = _normalize_windows_command(cmd)
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
            "returncode": completed_process.returncode,
        }

    except Exception as exc:
        return {
            "message": f"Failed to execute command '{cmd}': {exc}",
            "returncode": 1,
        }


def run_a_vbs_script(script: str) -> dict[str, Any]:
    path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".vbs", delete=False, encoding="utf-8"
        ) as script_file:
            script_file.write(script)
            path = script_file.name

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