# Tightspace project memory

## Standing product direction

- `tightspace.xyz` is a minimal personal blog hosted on GitHub Pages.
- Visual direction: generous whitespace, large system-sans typography, thin rules, and a restrained magenta accent inspired by the owner's reference UI.
- Primary navigation stays limited to About and Posts.
- Search uses a command-palette presentation and must work with pointer, keyboard, and assistive technology.
- Theme selection supports light and dark, follows the operating-system preference initially, and persists an explicit choice.

## Technical decisions

- 2026-07-27: Started with dependency-free static HTML, CSS, and ES modules. This keeps branch-based GitHub Pages deployment simple and makes every route usable without a build step.
- 2026-07-27: Posts use directory-based routes (`/posts/<slug>/index.html`) so clean URLs and direct reloads work on GitHub Pages.
- 2026-07-27: Shared pure search/theme helpers live in `assets/core.js`; browser behavior lives in `assets/site.js`. This keeps the logic directly unit-testable with Node's built-in test runner.
- 2026-07-27: The custom domain is stored in the root `CNAME` file. GitHub Pages should publish `main` from `/(root)`.

## Change log

- 2026-07-27: Initial site foundation created with About, Posts, one article, persistent themes, accessible search, responsive styling, deployment documentation, and automated checks.
- 2026-07-27: Pushed the tested root commit `1b9e14a` to `jasurme/tightspace` on `main`, enabled public GitHub Pages from `main` at `/(root)`, and confirmed GitHub's build completed without error.
- 2026-07-27: GitHub recognized the custom `CNAME` as `tightspace.xyz`, but live DNS still resolves the apex to `162.255.119.168` and `www` to `parkingpage.namecheap.com`; HTTPS therefore times out. Replace those Namecheap parking records with GitHub Pages DNS records before considering the custom-domain launch complete.

## Test and lesson log

- 2026-07-27 automated result: `npm run check` passed syntax checks plus all 11 unit, semantic-structure, route/resource, requested-content, and deployment-marker tests.
- 2026-07-27 real-browser result: `npm run test:browser` passed in installed headless Chrome at 320×320, 320×568, 1440×900, and 2560×1440. Covered direct loads/reloads, light/dark system changes, explicit persistence, corrupt and blocked storage, keyboard focus, Escape/backdrop close, empty/no-result/extreme search input, mobile target sizes, overflow, short dialog height, and runtime console errors.
- 2026-07-27 visual result: reviewed generated desktop light, desktop dark search, mobile dark home, and mobile dark search screenshots. The layout matches the reference direction and has no visible horizontal clipping.
- Lesson: substring search initially made `hi` match the navigation keyword `archive`; narrowing that keyword made `hi` return only the requested post. Keep test queries short enough to reveal accidental substring matches.
- Lesson: native dialog Escape behavior and post-close focus timing vary across automation/browser paths. Handle Escape explicitly and restore focus after the dialog's close event, with the search trigger as a safe fallback.
- Lesson: native search inputs may show their own cancel icon beside the custom close control. Suppress that browser decoration to avoid duplicate controls.
- Lesson: modal height must be tested separately from mobile width. A viewport-relative clamped result height keeps the footer reachable even at 320px tall.
