import subprocess
from typing import Any
import tempfile
from typing import Any
import os


def run_a_generic_command(cmd: str) -> dict[str, Any]:
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
        return {
            "stdout": completed_process.stdout,
            "stderr": completed_process.stderr,
            "returncode": completed_process.returncode,
        }
    except Exception as exc:
        return {"stdout": "", "stderr": str(exc), "returncode": 1}
    finally:
        if path and os.path.exists(path):
            os.remove(path)