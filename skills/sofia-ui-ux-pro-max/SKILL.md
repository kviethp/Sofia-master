---
{
  "name": "sofia-ui-ux-pro-max",
  "description": "Operate UI UX Pro Max as Sofia Master design-intelligence layer for UI planning, design-system generation, page overrides, and frontend handoff guidance.",
  "inputs": [
    "product/use-case brief",
    "target user",
    "platform/stack constraints",
    "page or feature context"
  ],
  "constraints": [
    "Start with design-system generation for meaningful UI work",
    "Use persisted output instead of giant prompt dumps",
    "Treat recommendations as heuristics, not absolute truth"
  ],
  "requiredTools": [
    "read",
    "exec",
    "write"
  ],
  "expectedOutputs": [
    "Design direction",
    "Persisted design-system guidance",
    "Implementation-ready UI handoff constraints"
  ]
}
---

# Sofia UI UX Pro Max

Use this skill to operate the local UI UX Pro Max toolkit in a way that fits Sofia Master.

## Goal

Turn vague or high-level UI requests into:
- a concrete design direction
- a persisted design system
- page-level overrides where needed
- focused lookups for UX, style, color, typography, charts, or stack guidance
- implementation-ready constraints for downstream coding agents

## Use this workflow

### 1. Normalize the brief

Start from `templates/ui-intake.md`.

Extract or infer:
- product type
- target user
- primary goal
- platform
- trust level
- data density
- brand tone
- constraints (stack, speed, mobile-first, accessibility, dark mode)

Ask follow-up questions only if necessary.

### 2. Start with design-system generation

For any new UI, redesign, or major page direction change, run:

```bash
./tools/ui-ux-pro-max-design-system "<product + tone + use case>" -p "<project>" -f markdown
```

Do not start with code unless the design direction is already known and documented.

### 3. Persist reusable design decisions

When the output should survive compaction or be reused across steps, run:

```bash
./tools/ui-ux-pro-max-run "<query>" --design-system --persist -p "<project>" -f markdown -o .
```

This creates a project-scoped master file such as `design-system/<project-slug>/MASTER.md`.

### 4. Create page overrides when needed

For page- or screen-specific priorities, run:

```bash
./tools/ui-ux-pro-max-run "<query>" --design-system --persist -p "<project>" --page "<page>" -f markdown -o .
```

Use page overrides when a page needs a different emphasis than the global system.

### 5. Use targeted lookups only after the master direction exists

Examples:

```bash
./tools/ui-ux-pro-max-run "trust authority minimal" --domain style
./tools/ui-ux-pro-max-run "fintech trust" --domain color
./tools/ui-ux-pro-max-run "modern professional premium" --domain typography
./tools/ui-ux-pro-max-run "loading states accessibility forms" --domain ux
./tools/ui-ux-pro-max-run "financial analytics comparison" --domain chart
./tools/ui-ux-pro-max-run "dashboard performance forms navigation" --stack nextjs
```

## Retrieval rules

When implementing a specific page:
1. Read `design-system/<project-slug>/MASTER.md` if it exists.
2. Read `design-system/<project-slug>/pages/<page>.md` if it exists.
3. Let the page file override the master.
4. Convert the result into concrete implementation constraints.

Implementation constraints should cover:
- semantic colors/tokens
- typography scale
- spacing scale
- radius and border rules
- elevation/shadow rules
- motion durations/easing
- hover/focus/loading/disabled/error/empty states
- hierarchy and CTA rules

Use `templates/ui-handoff.md` for the final handoff shape.

## Sofia-specific guidance

- Use UI UX Pro Max as a reasoning tool, not absolute truth.
- Prefer the search scripts and persisted output over giant prompt dumps.
- For fintech, healthcare, enterprise, and dense dashboards: optimize for trust, clarity, readability, and accessibility over trendiness.
- If uncertain, recommend one primary direction and one fallback.
- Avoid too many equal options.

## Good outcomes

Return outputs that are handoff-friendly:
1. Context summary
2. UX strategy
3. Visual direction
4. Design-system constraints
5. Accessibility and trust checks
6. Anti-patterns to avoid
7. Build handoff
8. Optional next steps

## Local resources

- Operating guide: `docs/sofia-master-ui-ux-pro-max-operating-guide.md`
- Toolkit root: `tools/ui-ux-pro-max/`
- Wrapper command: `./tools/ui-ux-pro-max-run`
- Design-system shortcut: `./tools/ui-ux-pro-max-design-system`
- Intake template: `templates/ui-intake.md`
- Handoff template: `templates/ui-handoff.md`