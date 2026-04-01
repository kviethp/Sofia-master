#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path

REQUIRED_SECTIONS = [
    "Goal",
    "Constraints",
    "Decisions",
    "Next Steps",
    "File/Task References",
]


def parse_sections(text: str):
    sections = {}
    current = None
    for raw in text.splitlines():
        line = raw.rstrip()
        if line.startswith("#"):
            current = re.sub(r"^#+\s*", "", line).strip()
            sections.setdefault(current, [])
            continue
        if current is not None:
            sections[current].append(line)
    return sections


def has_meaningful_content(lines):
    return any(x.strip() for x in lines)


def main():
    parser = argparse.ArgumentParser(description="Patch a structured Sofia summary with missing quality-guard sections")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    text = input_path.read_text(encoding="utf-8")
    sections = parse_sections(text)

    out = text.rstrip() + "\n"
    for section in REQUIRED_SECTIONS:
        if section not in sections or not has_meaningful_content(sections[section]):
            out += f"\n# {section}\n- TODO: fill this before saving compacted memory\n"

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(out, encoding="utf-8")
    print(json.dumps({"ok": True, "output": str(output_path)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
