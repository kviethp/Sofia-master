#!/usr/bin/env python3
import argparse
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    return p.returncode, p.stdout.strip(), p.stderr.strip()


def run_json(cmd):
    code, out, err = run(cmd)
    if code != 0:
        raise SystemExit(err or out or f"Command failed: {' '.join(cmd)}")
    return json.loads(out)


def ensure_recent_turns(path: Path, task: str):
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "version": 1,
        "updatedAt": now_iso(),
        "turns": [
            {
                "role": "system",
                "text": f"Active task initialized: {task}",
                "timestamp": now_iso(),
            }
        ],
    }
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Run Sofia memory maintenance cycle")
    parser.add_argument("--base", default=".")
    parser.add_argument("--task", required=True)
    parser.add_argument("--summary", required=True)
    parser.add_argument("--turns", type=int, required=True)
    parser.add_argument("--tokens", type=int, required=True)
    parser.add_argument("--task-slug", default="")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    base = Path(args.base)
    tools = base / "tools"

    init_cmd = [str(tools / "sofia-task-memory"), "init", args.task, "--activate"]
    if args.task_slug:
        init_cmd.extend(["--slug", args.task_slug])
    init_data = run_json(init_cmd)

    compact_decision = run_json([
        str(tools / "sofia-memory-should-compact"),
        "--turns", str(args.turns),
        "--tokens", str(args.tokens),
    ])

    validation = run_json([
        str(tools / "sofia-validate-summary"),
        "--input", args.summary,
    ])

    summary_to_use = args.summary
    patched_summary = ""
    if not validation.get("ok", False):
        patched_summary = str(base / "memory/sofia/patched-summary.md")
        run_json([
            str(tools / "sofia-patch-summary"),
            "--input", args.summary,
            "--output", patched_summary,
        ])
        summary_to_use = patched_summary
        validation = run_json([
            str(tools / "sofia-validate-summary"),
            "--input", summary_to_use,
        ])

    compacted = None
    task_slug = init_data["slug"]
    state_path = str(base / f"memory/sofia/tasks/{task_slug}/working-memory.json")
    md_path = str(base / f"memory/sofia/tasks/{task_slug}/working-memory.md")
    recent_turns_path = base / f"memory/sofia/tasks/{task_slug}/recent-turns.json"
    ensure_recent_turns(recent_turns_path, args.task)

    if args.force or compact_decision.get("shouldCompact", False):
        compacted = run_json([
            str(tools / "sofia-memory-compact"),
            "--input", summary_to_use,
            "--state", state_path,
            "--task", args.task,
            "--markdown-out", md_path,
        ])

    resume_code, resume_out, resume_err = run([
        str(tools / "sofia-memory-resume"),
        "--state", state_path,
        "--recent-turns", str(recent_turns_path),
    ])
    resume_block = resume_out if resume_code == 0 else ""

    print(json.dumps({
        "ok": True,
        "task": args.task,
        "taskSlug": task_slug,
        "statePath": state_path,
        "recentTurnsPath": str(recent_turns_path),
        "compactionDecision": compact_decision,
        "validation": validation,
        "patchedSummary": patched_summary or None,
        "compacted": compacted,
        "resumeBlock": resume_block,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
