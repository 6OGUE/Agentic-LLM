import subprocess

def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write_file(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return "written successfully"

def run_cmd(cmd):
    try:
        result = subprocess.run(cmd, shell=True, text=True, capture_output=True)
        return {"stdout": result.stdout, "stderr": result.stderr, "returncode": result.returncode}
    except Exception as e:
        return f"Error: {e}"