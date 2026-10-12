import subprocess
from typing import Any


def run_a_command(cmd: str) -> dict[str, Any]:
    try:
        completed_process = subprocess.run(
            cmd,
            shell=True,
            text=True,
            capture_output=True,
            check=False,
        )
        return {
            "stdout": completed_process.stdout,
            "stderr": completed_process.stderr,
            "returncode": completed_process.returncode,
        }
    except Exception as exc:
        return {"stdout": "", "stderr": str(exc), "returncode": 1}
