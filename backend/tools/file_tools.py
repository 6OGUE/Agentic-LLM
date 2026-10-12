from pathlib import Path


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
