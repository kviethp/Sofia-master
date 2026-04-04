---
{
  "name": "sofia-ui-router",
  "description": "Route UI/UX-related requests in Sofia Master to the Sofia UI UX Pro Max workflow. Use when a request involves UI direction, redesign, layout, visual polish, component design, landing pages, dashboards, admin panels, forms, navigation, responsiveness, accessibility, design systems, color, typography, spacing, states, interaction quality, or frontend UX review."
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