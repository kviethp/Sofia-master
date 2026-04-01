#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def bullets(items):
    if not items:
        return "- (none)"
    return "\n".join(f"- {x}" for x in items)


def main() -> int:
    parser = argparse.ArgumentParser(description="Render compact resume block for Sofia working memory")
    parser.add_argument("--state", required=True, help="Path to working-memory json")
    parser.add_argument("--recent-turns", default="", help="Optional path to recent-turns json")
    args = parser.parse_args()

    state = load_json(Path(args.state))
    recent = []
    if args.recent_turns:
        recent = load_json(Path(args.recent_turns)).get("turns", [])

    print("# Sofia Resume Block\n")
    print("## Active Task State")
    print(f"- Current task: {state.get('currentTask') or '(unset)'}")
    print(f"- Goal: {state.get('goal') or '(unset)'}")
    print(f"- Summary: {state.get('summary') or '(none)'}")
    print("\n## Decisions")
    print(bullets(state.get("decisions", [])))
    print("\n## Constraints")
    print(bullets(state.get("constraints", [])))
    print("\n## Unresolved / Open Loops")
    print(bullets(state.get("openLoops", [])))
    print("\n## Next Steps")
    print(bullets(state.get("nextSteps", [])))
    print("\n## File / Task References")
    print(bullets(state.get("fileTaskReferences", [])))
    if recent:
        print("\n## Recent Turns")
        for turn in recent[-8:]:
            role = turn.get("role", "unknown")
            text = str(turn.get("text", "")).strip().replace("\n", " ")
            if len(text) > 240:
                text = text[:237] + "..."
            print(f"- {role}: {text}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
