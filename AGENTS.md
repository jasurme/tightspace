# Tightspace repository instructions

These are the project owner's standing instructions for every future change in this repository.

## Engineering principles

- Research at least one relevant current website before each task; prefer official primary sources for technical or deployment facts.
- Test every change substantially: the normal path, each feature in isolation, integrations, boundary values, extreme input, failure behavior, accessibility, and responsive layouts.
- Prefer precise, compact code. Keep each abstraction purposeful, avoid repetition, and use readable horizontal space when it reduces needless vertical length.
- Preserve existing user work. Inspect the repository before editing and never discard unrelated changes.
- Keep this file and `PROJECT_MEMORY.md` current when requirements, implementation decisions, results, tests, or lessons change.
- A change is not complete until its relevant automated checks and browser interactions have been exercised.

## Delivery workflow

1. Research and inspect.
2. Implement the smallest complete change.
3. Run syntax, unit, integration, accessibility, responsive, and edge-case checks appropriate to the work.
4. Record material changes, results, and lessons in `PROJECT_MEMORY.md`.
5. Commit and push completed work when the owner requests deployment.

## Product constraints

- The production domain is `tightspace.xyz` and hosting is GitHub Pages.
- Keep the site dependency-free unless a future requirement clearly justifies a build system.
- Maintain clean, directly reloadable page routes, semantic HTML, keyboard access, and working light/dark themes.
- The primary navigation contains only `About` and `Posts`; search and theme controls are separate utilities.
