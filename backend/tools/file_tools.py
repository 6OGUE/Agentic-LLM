from pathlib import Path
from typing import Optional
import subprocess
import os
import re



def read_file(path: str) -> str:
    file_path = Path(path)
    return file_path.read_text(encoding="utf-8")

def list_files(path: str) -> str:
    directory = Path(path)
    entries = sorted(directory.iterdir(), key=lambda entry: entry.name.casefold())
    if not entries:
        return "Directory is empty."

    return "\n".join(
        f"{entry.name}{'/' if entry.is_dir() else ''}"
        for entry in entries
    )


def write_file(path: str, content: str) -> str:
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")
    return "written successfully"


def do_a_targetted_edit(path: str, line_range: str, content: str) -> str:
    match = re.fullmatch(r"\s*(\d+)\s*,\s*(\d+)\s*", line_range)
    if not match:
        raise ValueError("Line range must use the format 'start,end', such as '2,5'.")

    start_line, end_line = (int(value) for value in match.groups())
    if start_line < 1 or end_line < start_line:
        raise ValueError("Line range must be a valid 1-based inclusive range.")

    file_path = Path(path)
    if not file_path.is_file():
        raise FileNotFoundError(f"File does not exist: {file_path}")

    with file_path.open("r", encoding="utf-8", newline="") as source_file:
        original = source_file.read()

    lines = original.splitlines(keepends=True)
    if end_line > len(lines):
        raise ValueError(
            f"Line range ends at {end_line}, but the file has {len(lines)} lines."
        )

    newline = "\r\n" if "\r\n" in original else "\n"
    replacement = content.replace("\r\n", "\n").replace("\r", "\n")
    replacement = replacement.replace("\n", newline)
    has_following_lines = end_line < len(lines)
    original_has_final_newline = original.endswith(("\n", "\r"))
    if (
        replacement
        and not replacement.endswith(("\n", "\r"))
        and (has_following_lines or original_has_final_newline)
    ):
        replacement += newline

    updated = (
        "".join(lines[:start_line - 1])
        + replacement
        + "".join(lines[end_line:])
    )
    with file_path.open("w", encoding="utf-8", newline="") as target_file:
        target_file.write(updated)

    return f"Replaced lines {start_line}-{end_line} in '{file_path}'."


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