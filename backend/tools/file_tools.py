from pathlib import Path
from typing import Optional
import subprocess
import os



def read_file(path: str) -> str:
    file_path = Path(path)
    return file_path.read_text(encoding="utf-8")


def write_file(path: str, content: str) -> str:
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")
    return "written successfully"


def rename_file(path: str, new_name: str) -> str:
    source = Path(path)
    destination = source.with_name(new_name)

    if not source.is_file():
        raise FileNotFoundError(f"Source file does not exist: {source}")
    if source == destination:
        raise ValueError("The new name must be different from the current name.")
    if destination.exists():
        raise FileExistsError(f"Destination file already exists: {destination}")

    source.rename(destination)
    return f"Renamed '{source}' to '{destination}'."



def search_file(
    name: str,
    drive: Optional[list[str]] = None,
    extension: Optional[str] = None,
) -> str:
    drives = drive or list("CDEFGHIJKLMNOPQRSTUVWXYZ")
    pattern = f"{name}.{extension}" if extension else f"{name}.*"
    results = []

    for letter in drives:
        letter = letter.rstrip(":\\/")
        root = f"{letter}:\\"

        if subprocess.run(
            ["cmd", "/c", "if", "exist", root, "exit", "0"],
            capture_output=True,
            check=False,
        ).returncode != 0:
            continue

        result = subprocess.run(
            ["where", "/r", root, pattern],
            capture_output=True,
            text=True,
            errors="replace",
            check=False,
        )

        if result.stdout.strip():
            results.extend(result.stdout.strip().splitlines())

    return "\n".join(results) if results else "No file found"


def open_an_app(path: str) -> str:
    if os.path.isfile(path) and path.lower().endswith(".exe"):
        subprocess.Popen([path], cwd=os.path.dirname(path) or None)
        return f"Opened app: {path}"

    return "No such app found"

def open_file(path: str) -> str:
    if os.path.isfile(path):
        os.startfile(path)
        return f"Opened file: {path}"
    return "No such file found"