#!/usr/bin/env python3
import argparse
import json


def main():
    parser = argparse.ArgumentParser(description="Decide whether Sofia should compact context")
    parser.add_argument("--turns", type=int, required=True)
    parser.add_argument("--tokens", type=int, required=True)
    parser.add_argument("--compact-after-turns", type=int, default=10)
    parser.add_argument("--compact-at-estimated-tokens", type=int, default=24000)
    parser.add_argument("--hard-limit-estimated-tokens", type=int, default=32000)
    args = parser.parse_args()

    reasons = []
    should = False
    urgency = "low"

    if args.turns >= args.compact_after_turns:
        should = True
        reasons.append(f"turns>={args.compact_after_turns}")
        urgency = "medium"

    if args.tokens >= args.compact_at_estimated_tokens:
        should = True
        reasons.append(f"tokens>={args.compact_at_estimated_tokens}")
        urgency = "high"

    if args.tokens >= args.hard_limit_estimated_tokens:
        should = True
        reasons.append(f"tokens>={args.hard_limit_estimated_tokens}")
        urgency = "critical"

    print(json.dumps({
        "shouldCompact": should,
        "urgency": urgency,
        "reasons": reasons,
        "inputs": {
            "turns": args.turns,
            "tokens": args.tokens
        },
        "thresholds": {
            "compactAfterTurns": args.compact_after_turns,
            "compactAtEstimatedTokens": args.compact_at_estimated_tokens,
            "hardLimitEstimatedTokens": args.hard_limit_estimated_tokens
        }
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
