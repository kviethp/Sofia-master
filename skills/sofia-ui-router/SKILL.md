---
{
  "schemaVersion": "1.0.0",
  "id": "sofia-ui-router",
  "version": "1.0.0",
  "owner": "sofia-master",
  "description": "Route UI/UX-related requests in Sofia Master to the Sofia UI UX Pro Max workflow.",
  "intent": "Use when a Sofia task is primarily about interface design, interaction quality, UX direction, or frontend visual strategy and should be routed into the UI design workflow.",
  "trustLevel": "internal-trusted",
  "inputs": [
    "user request touching UI/UX",
    "page/app/screen context if available",
    "product goal if available"
  ],
  "constraints": [
    "Use for look/feel/interaction work, not pure backend tasks",
    "Route to Sofia UI UX Pro Max when UI direction is needed",
    "Do not start with code when design direction is still unclear"
  ],
  "requiredTools": [
    "read",
    "exec"
  ],
  "expectedOutputs": [
    "Correct UI skill routing decision",
    "Normalized UI brief",
    "Implementation-ready handoff structure"
  ],
  "qualityGates": [
    "Routes UI-heavy requests into the design workflow before code generation",
    "Produces a normalized brief and handoff-ready structure",
    "Avoids treating pure backend work as UI/UX work"
  ]
}
---

# Sofia UI Router

Use this routing skill when the user request is clearly about UI/UX.

## Trigger examples

Route here when the user asks to:
- design or redesign a page, app, screen, flow, dashboard, admin panel, landing page, settings page, checkout, onboarding, or component
- improve visual quality, hierarchy, trust, clarity, conversion, usability, or polish
- choose style, color, typography, spacing, motion, cards, tables, forms, nav, modals, charts, or state design
- review existing UI for UX/accessibility/responsiveness issues
- create or refine a design system before implementation

If uncertain, read `references/decision-rubric.md`.

## Routing rule

If the task changes how the product **looks, feels, moves, or is interacted with**, hand off to `skills/sofia-ui-ux-pro-max/SKILL.md` and follow that workflow.

## Required flow

1. Normalize the brief using `skills/sofia-ui-ux-pro-max/templates/ui-intake.md`.
2. Start with `./tools/ui-ux-pro-max-design-system` for any new build or meaningful redesign.
3. Persist with `./tools/ui-ux-pro-max-run ... --design-system --persist` when the decision should survive context resets or feed downstream agents.
4. Use targeted `--domain` or `--stack` lookups only after the main design direction exists.
5. Translate the result into implementation constraints before generating or editing code.
6. Format the result with `skills/sofia-ui-ux-pro-max/templates/ui-handoff.md` when handing off to implementation.

## Preferred handoff format

Return:
1. Context summary
2. UX strategy
3. Visual direction
4. Design-system constraints
5. Accessibility and trust checks
6. Anti-patterns to avoid
7. Build handoff
