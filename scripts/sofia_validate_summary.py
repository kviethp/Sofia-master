#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path


def load_input(path: Path):
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        return json.loads(text)

    sections = {}
    current = None
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        if line.startswith("#"):
            current = re.sub(r"^#+\s*", "", line).strip().lower().replace(" ", "_").replace("/", "_")
            sections.setdefault(current, [])
            continue
        if current is None:
            continue
        cleaned = line.strip()
        if cleaned.startswith("-"):
            cleaned = cleaned.lstrip("- ").strip()
        sections.setdefault(current, []).append(cleaned)
    return sections


def main():
    parser = argparse.ArgumentParser(description="Validate Sofia summary quality guard")
    parser.add_argument("--input", required=True)
    args = parser.parse_args()

    data = load_input(Path(args.input))
    missing = []

    goal_val = data.get("goal") or data.get("goals") or data.get("objective") or data.get("objectives")
    if not goal_val or (isinstance(goal_val, list) and not any(x.strip() for x in goal_val)) or (isinstance(goal_val, str) and not goal_val.strip()):
        missing.append("active goal")

    decisions = data.get("decisions", []) or data.get("decision", [])
    next_steps = data.get("next_steps", []) or data.get("next_step", []) or data.get("next_actions", [])
    constraints = data.get("constraints", [])
    refs = data.get("file_task_references", []) or data.get("file_references", []) or data.get("task_references", [])

    if not decisions:
        missing.append("decisions")
    if not next_steps:
        missing.append("unfinished work / next step")
    if not constraints:
        missing.append("important constraints")
    if not refs:
        missing.append("relevant file/path references")

    print(json.dumps({
        "ok": len(missing) == 0,
        "missing": missing
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
