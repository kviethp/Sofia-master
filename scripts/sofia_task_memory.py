#!/usr/bin/env python3
import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def slugify(text: str) -> str:
    text = text.strip().lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text or "task"


def ensure_registry():
    return {
        "version": 1,
        "updatedAt": now_iso(),
        "activeTask": "",
        "tasks": []
    }


def ensure_task(slug: str, title: str):
    return {
        "version": 1,
        "slug": slug,
        "title": title,
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
        "workingMemoryPath": f"memory/sofia/tasks/{slug}/working-memory.json",
        "recentTurnsPath": f"memory/sofia/tasks/{slug}/recent-turns.json",
        "status": "active"
    }


def load_json(path: Path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def cmd_init(args):
    base = Path(args.base)
    registry_path = base / "memory/sofia/tasks/index.json"
    registry = load_json(registry_path, ensure_registry())

    slug = args.slug or slugify(args.title)
    task_dir = base / f"memory/sofia/tasks/{slug}"
    task_dir.mkdir(parents=True, exist_ok=True)

    existing = next((t for t in registry["tasks"] if t.get("slug") == slug), None)
    if existing is None:
        task = ensure_task(slug, args.title)
        registry["tasks"].append(task)
    else:
        task = existing
        task["title"] = args.title or task.get("title", slug)
        task["updatedAt"] = now_iso()

    if args.activate:
        registry["activeTask"] = slug
    registry["updatedAt"] = now_iso()
    save_json(registry_path, registry)

    print(json.dumps({
        "ok": True,
        "slug": slug,
        "taskDir": str(task_dir),
        "workingMemoryPath": f"memory/sofia/tasks/{slug}/working-memory.json",
        "recentTurnsPath": f"memory/sofia/tasks/{slug}/recent-turns.json",
        "activeTask": registry.get("activeTask", "")
    }, ensure_ascii=False))


def cmd_activate(args):
    base = Path(args.base)
    registry_path = base / "memory/sofia/tasks/index.json"
    registry = load_json(registry_path, ensure_registry())
    slug = args.slug
    if not any(t.get("slug") == slug for t in registry["tasks"]):
        raise SystemExit(f"Task not found: {slug}")
    registry["activeTask"] = slug
    registry["updatedAt"] = now_iso()
    save_json(registry_path, registry)
    print(json.dumps({"ok": True, "activeTask": slug}, ensure_ascii=False))


def cmd_list(args):
    base = Path(args.base)
    registry_path = base / "memory/sofia/tasks/index.json"
    registry = load_json(registry_path, ensure_registry())
    print(json.dumps(registry, ensure_ascii=False, indent=2))


def main():
    parser = argparse.ArgumentParser(description="Manage Sofia task-scoped memory")
    parser.add_argument("--base", default=".", help="Workspace root")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_init = sub.add_parser("init", help="Initialize a task memory container")
    p_init.add_argument("title", help="Task title")
    p_init.add_argument("--slug", default="", help="Optional task slug")
    p_init.add_argument("--activate", action="store_true", help="Set as active task")
    p_init.set_defaults(func=cmd_init)

    p_activate = sub.add_parser("activate", help="Activate an existing task")
    p_activate.add_argument("slug", help="Task slug")
    p_activate.set_defaults(func=cmd_activate)

    p_list = sub.add_parser("list", help="List task registry")
    p_list.set_defaults(func=cmd_list)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
