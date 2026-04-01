# Sofia Master + UI UX Pro Max Operating Guide

## Purpose

Use UI UX Pro Max as Sofia Master's **design intelligence layer**:
- generate an initial design direction
- retrieve targeted UI/UX guidance
- persist reusable design-system decisions across turns/sessions
- improve review consistency before implementation or shipping

Do **not** use it as an unquestioned source of truth. Sofia should still apply product judgment, implementation constraints, and user context.

---

## Recommended Role in the Stack

UI UX Pro Max should sit between:
1. **brief understanding** (Sofia Master)
2. **implementation** (frontend/code agent)

It is best used to produce:
- a primary UI pattern
- a visual system direction
- token-level guidance (color, typography, spacing, motion)
- anti-patterns and accessibility checks
- page-specific overrides

---

## Default Workflow

### Step 1 — Normalize the brief

Extract or infer:
- product type
- target user
- primary goal
- platform
- trust level
- data density
- brand tone
- constraints (speed, accessibility, stack, dark mode, mobile-first)

### Step 2 — Generate the design system first

Always start here for new builds or meaningful redesigns.

```bash
./tools/ui-ux-pro-max-design-system "<product + tone + use case>" -p "<project>" -f markdown
```

Example:

```bash
./tools/ui-ux-pro-max-design-system \
  "fintech dashboard trust modern minimal" \
  -p "Sofia Master Dashboard" \
  -f markdown
```

Expected output:
- recommended pattern
- style direction
- color palette direction
- typography pairing
- effects / motion notes
- anti-patterns
- pre-delivery checklist

### Step 3 — Persist reusable output

When the design direction should survive context resets or be reused by coding agents:

```bash
./tools/ui-ux-pro-max-run \
  "fintech dashboard trust modern minimal" \
  --design-system --persist \
  -p "Sofia Master Dashboard" \
  -f markdown \
  -o .
```

This creates a project-scoped folder, typically:
- `design-system/<project-slug>/MASTER.md`

### Step 4 — Add page-specific overrides

For page- or screen-level work:

```bash
./tools/ui-ux-pro-max-run \
  "fintech dashboard trust modern minimal" \
  --design-system --persist \
  -p "Sofia Master Dashboard" \
  --page "settings" \
  -f markdown \
  -o .
```

This creates a page override under the project-scoped folder, typically:
- `design-system/<project-slug>/pages/settings.md`

Use this pattern for pages that need different priorities than the master design system:
- landing page → conversion + social proof
- dashboard → density + readability
- checkout → trust + low distraction
- settings → clarity + error prevention

### Step 5 — Query only the missing pieces

After the initial design system, use domain or stack lookup only as needed.

#### Domain lookups

```bash
./tools/ui-ux-pro-max-run "trust authority minimal" --domain style
./tools/ui-ux-pro-max-run "fintech trust" --domain color
./tools/ui-ux-pro-max-run "modern professional premium" --domain typography
./tools/ui-ux-pro-max-run "form validation accessibility loading states" --domain ux
./tools/ui-ux-pro-max-run "financial analytics trends comparison" --domain chart
```

#### Stack lookups

```bash
./tools/ui-ux-pro-max-run "dashboard performance forms navigation" --stack nextjs
./tools/ui-ux-pro-max-run "rerender memo suspense loading" --stack react
./tools/ui-ux-pro-max-run "admin dashboard tables dialogs forms" --stack shadcn
./tools/ui-ux-pro-max-run "landing page hero pricing testimonials" --stack html-tailwind
```

---

## Retrieval Pattern for Sofia Master

When building a specific page:

1. Read `design-system/<project-slug>/MASTER.md`
2. Check for `design-system/<project-slug>/pages/<page>.md`
3. If the page file exists, treat it as an override
4. Convert the resulting guidance into implementation constraints

Implementation constraints should include:
- semantic colors / tokens
- typography scale
- spacing scale
- radius / border rules
- shadow / elevation scale
- motion durations and easing
- state rules (hover, focus, loading, disabled, empty, error)
- content hierarchy and CTA rules

---

## Best Practices

### 1. Start with design direction, not code

Bad:
- generate UI immediately from a vague brief

Good:
1. design system
2. design constraints
3. component/page plan
4. code

### 2. Use it as a decision-support tool

Strong use cases:
- choose a suitable style for the product type
- pick safer color directions
- choose typography that matches trust / tone
- identify anti-patterns before build
- improve review consistency

### 3. Avoid loading huge context blindly

Prefer:
- run the script
- keep only the useful output
- persist the long-lived decisions to files

Avoid:
- pasting the full repo or giant SKILL content into the active prompt

### 4. Let Sofia translate heuristics into build rules

UI UX Pro Max gives direction. Sofia should translate that into concrete rules for the coding agent.

### 5. Use targeted review categories

When reviewing an existing UI, organize feedback by:
- hierarchy
- accessibility
- touch/interaction
- responsive behavior
- feedback states
- trust/readability
- visual consistency

---

## Suggested Prompts for Sofia Master

### For a new build

> Analyze the brief. Use UI UX Pro Max to generate the design system first. Persist it to `design-system/<project-slug>/MASTER.md`. If this task is page-specific, also check or create `design-system/<project-slug>/pages/<page>.md`. Then convert the result into implementation constraints before generating code.

### For UI review

> Review this UI in 5 groups: hierarchy, accessibility, touch/interaction, responsive layout, and feedback states. Use UI UX Pro Max only to retrieve targeted guidance when needed.

### For refactoring

> Keep business logic intact. Use UI UX Pro Max to improve visual system consistency: spacing, typography, semantic colors, motion, state design, empty/loading/error states, and trust/readability.

---

## Caveats

- Recommendations are heuristic, not universal truth.
- Some upstream templates are slightly platform-biased; rely more on the search engine and datasets than on generic template text.
- For sensitive product categories (fintech, healthcare, enterprise), prioritize trust, clarity, and accessibility over visual novelty.
- For dashboards and dense internal tools, readability beats trendiness.

---

## Quick Command Reference

```bash
# generate design system
./tools/ui-ux-pro-max-design-system "<query>" -p "<project>" -f markdown

# persist master design system
./tools/ui-ux-pro-max-run "<query>" --design-system --persist -p "<project>" -f markdown -o .

# persist page override
./tools/ui-ux-pro-max-run "<query>" --design-system --persist -p "<project>" --page "<page>" -f markdown -o .

# domain lookup
./tools/ui-ux-pro-max-run "<query>" --domain ux

# stack lookup
./tools/ui-ux-pro-max-run "<query>" --stack nextjs
```
