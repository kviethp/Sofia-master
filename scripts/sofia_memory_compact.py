#!/usr/bin/env python3
import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

SECTION_ALIASES = {
    "goal": "goal",
    "goals": "goal",
    "objective": "goal",
    "objectives": "goal",
    "constraints": "constraints",
    "preferences": "preferences",
    "progress": "progress",
    "done": "done",
    "in progress": "in_progress",
    "in-progress": "in_progress",
    "blocked": "blocked",
    "decisions": "decisions",
    "decision": "decisions",
    "next steps": "next_steps",
    "next step": "next_steps",
    "next actions": "next_steps",
    "open loops": "open_loops",
    "open loop": "open_loops",
    "unresolved goals": "unresolved_goals",
    "unresolved goal": "unresolved_goals",
    "file/task references": "file_task_references",
    "file references": "file_task_references",
    "task references": "file_task_references",
    "critical context": "critical_context",
    "context": "critical_context",
    "summary": "summary",
    "rolling summary": "rolling_summary",
}

LIST_KEYS = {
    "constraints",
    "preferences",
    "done",
    "in_progress",
    "blocked",
    "decisions",
    "next_steps",
    "open_loops",
    "unresolved_goals",
    "file_task_references",
    "critical_context",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_state() -> Dict[str, Any]:
    return {
        "version": 2,
        "updatedAt": now_iso(),
        "currentTask": "",
        "goal": "",
        "rollingSummary": "",
        "constraints": [],
        "preferences": [],
        "progress": {
            "done": [],
            "in_progress": [],
            "blocked": [],
        },
        "unresolvedGoals": [],
        "decisions": [],
        "nextSteps": [],
        "openLoops": [],
        "fileTaskReferences": [],
        "criticalContext": [],
        "summary": "",
        "history": [],
    }


def dedupe_keep_order(items: List[str]) -> List[str]:
    seen = set()
    out = []
    for item in items:
        item = normalize_text(item)
        if not item or item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def normalize_text(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^[-*•\d.\s\[\]xX]+", "", text).strip()
    return text


def parse_markdown_summary(text: str) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "goal": "",
        "constraints": [],
        "preferences": [],
        "done": [],
        "in_progress": [],
        "blocked": [],
        "decisions": [],
        "next_steps": [],
        "open_loops": [],
        "unresolved_goals": [],
        "file_task_references": [],
        "critical_context": [],
        "summary": "",
        "rolling_summary": "",
    }

    current = None
    summary_lines: List[str] = []
    rolling_lines: List[str] = []

    for raw in text.splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue

        heading = None
        if line.startswith("#"):
            heading = re.sub(r"^#+\s*", "", line).strip().lower()
        elif re.match(r"^[A-Za-z][A-Za-z0-9 &/_-]{1,60}:\s*$", line):
            heading = line[:-1].strip().lower()

        if heading is not None:
            current = SECTION_ALIASES.get(heading, current)
            continue

        item = normalize_text(line)
        if not item:
            continue

        if current in LIST_KEYS:
            result[current].append(item)
        elif current == "goal":
            result["goal"] = item
        elif current == "rolling_summary":
            rolling_lines.append(item)
        elif current == "summary":
            summary_lines.append(item)
        else:
            summary_lines.append(item)

    if summary_lines:
        result["summary"] = " ".join(summary_lines).strip()
    if rolling_lines:
        result["rolling_summary"] = " ".join(rolling_lines).strip()

    return result


def load_input(path: Path) -> Dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        data = json.loads(text)
        return {
            "goal": data.get("goal", "") or data.get("objectives", ""),
            "rolling_summary": data.get("rolling_summary", "") or data.get("rollingSummary", ""),
            "constraints": data.get("constraints", []),
            "preferences": data.get("preferences", []),
            "done": data.get("done", []) or data.get("progress", {}).get("done", []),
            "in_progress": data.get("in_progress", []) or data.get("progress", {}).get("in_progress", []),
            "blocked": data.get("blocked", []) or data.get("progress", {}).get("blocked", []),
            "decisions": data.get("decisions", []),
            "next_steps": data.get("next_steps", []) or data.get("nextSteps", []),
            "open_loops": data.get("open_loops", []) or data.get("openLoops", []),
            "unresolved_goals": data.get("unresolved_goals", []) or data.get("unresolvedGoals", []),
            "file_task_references": data.get("file_task_references", []) or data.get("fileTaskReferences", []),
            "critical_context": data.get("critical_context", []) or data.get("criticalContext", []),
            "summary": data.get("summary", ""),
        }
    return parse_markdown_summary(text)


def merge_state(state: Dict[str, Any], incoming: Dict[str, Any], task: str, source: str) -> Dict[str, Any]:
    merged = ensure_state()
    merged.update(state or {})
    merged.setdefault("progress", {})
    merged["progress"].setdefault("done", [])
    merged["progress"].setdefault("in_progress", [])
    merged["progress"].setdefault("blocked", [])
    merged.setdefault("history", [])
    merged.setdefault("unresolvedGoals", [])
    merged.setdefault("fileTaskReferences", [])

    if task:
        merged["currentTask"] = task.strip()
    if incoming.get("goal"):
        merged["goal"] = incoming["goal"].strip()
    if incoming.get("summary"):
        merged["summary"] = incoming["summary"].strip()
    if incoming.get("rolling_summary"):
        merged["rollingSummary"] = incoming["rolling_summary"].strip()
    elif incoming.get("summary"):
        merged["rollingSummary"] = incoming["summary"].strip()

    merged["constraints"] = dedupe_keep_order(merged.get("constraints", []) + incoming.get("constraints", []))
    merged["preferences"] = dedupe_keep_order(merged.get("preferences", []) + incoming.get("preferences", []))
    merged["progress"]["done"] = dedupe_keep_order(merged["progress"].get("done", []) + incoming.get("done", []))
    merged["progress"]["in_progress"] = dedupe_keep_order(merged["progress"].get("in_progress", []) + incoming.get("in_progress", []))
    merged["progress"]["blocked"] = dedupe_keep_order(merged["progress"].get("blocked", []) + incoming.get("blocked", []))
    merged["decisions"] = dedupe_keep_order(merged.get("decisions", []) + incoming.get("decisions", []))
    merged["nextSteps"] = dedupe_keep_order(merged.get("nextSteps", []) + incoming.get("next_steps", []))
    merged["openLoops"] = dedupe_keep_order(merged.get("openLoops", []) + incoming.get("open_loops", []))
    merged["unresolvedGoals"] = dedupe_keep_order(merged.get("unresolvedGoals", []) + incoming.get("unresolved_goals", []))
    merged["fileTaskReferences"] = dedupe_keep_order(merged.get("fileTaskReferences", []) + incoming.get("file_task_references", []))
    merged["criticalContext"] = dedupe_keep_order(merged.get("criticalContext", []) + incoming.get("critical_context", []))
    merged["updatedAt"] = now_iso()

    merged["history"].append({
        "timestamp": merged["updatedAt"],
        "source": source,
        "task": task or merged.get("currentTask", ""),
        "summary": incoming.get("summary", ""),
    })
    merged["history"] = merged["history"][-20:]
    return merged


def render_markdown(state: Dict[str, Any]) -> str:
    def bullets(items: List[str]) -> str:
        return "\n".join(f"- {x}" for x in items) if items else "- (none)"

    return f"""# Sofia Memory State

- **Updated:** {state.get('updatedAt','')}
- **Current task:** {state.get('currentTask','') or '(unset)'}
- **Goal:** {state.get('goal','') or '(unset)'}

## Rolling Summary
{state.get('rollingSummary','') or '(none)'}

## Constraints
{bullets(state.get('constraints', []))}

## Preferences
{bullets(state.get('preferences', []))}

## Progress — Done
{bullets(state.get('progress', {}).get('done', []))}

## Progress — In Progress
{bullets(state.get('progress', {}).get('in_progress', []))}

## Progress — Blocked
{bullets(state.get('progress', {}).get('blocked', []))}

## Unresolved Goals
{bullets(state.get('unresolvedGoals', []))}

## Decisions
{bullets(state.get('decisions', []))}

## Next Steps
{bullets(state.get('nextSteps', []))}

## Open Loops
{bullets(state.get('openLoops', []))}

## File / Task References
{bullets(state.get('fileTaskReferences', []))}

## Critical Context
{bullets(state.get('criticalContext', []))}

## Summary
{state.get('summary','') or '(none)'}
"""


def main() -> int:
    parser = argparse.ArgumentParser(description="Compact Sofia working context into a durable state file")
    parser.add_argument("--input", required=True, help="Path to markdown or json summary input")
    parser.add_argument("--state", required=True, help="Path to state json file")
    parser.add_argument("--task", default="", help="Current task name")
    parser.add_argument("--markdown-out", default="", help="Optional markdown snapshot path")
    args = parser.parse_args()

    input_path = Path(args.input)
    state_path = Path(args.state)
    state_path.parent.mkdir(parents=True, exist_ok=True)

    state = ensure_state()
    if state_path.exists():
        state = json.loads(state_path.read_text(encoding="utf-8"))

    incoming = load_input(input_path)
    merged = merge_state(state, incoming, args.task, str(input_path))
    state_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.markdown_out:
        md_path = Path(args.markdown_out)
        md_path.parent.mkdir(parents=True, exist_ok=True)
        md_path.write_text(render_markdown(merged), encoding="utf-8")

    print(json.dumps({
        "ok": True,
        "state": str(state_path),
        "markdown": args.markdown_out or None,
        "currentTask": merged.get("currentTask", ""),
        "updatedAt": merged.get("updatedAt", ""),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
