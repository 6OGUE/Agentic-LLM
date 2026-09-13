import subprocess
from pathlib import Path
from typing import Any


def read_file(path: str) -> str:
    file_path = Path(path)
    return file_path.read_text(encoding="utf-8")


def write_file(path: str, content: str) -> str:
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")
    return "written successfully"


def run_cmd(cmd: str) -> dict[str, Any]:
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
