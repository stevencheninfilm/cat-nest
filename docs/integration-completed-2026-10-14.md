# Completed changes release — 2026-10-14

Status: integrated and ready for publication. Backend and frontend deployment are pending.

User approval cutoff: 2026-10-15 00:20:13 UTC (2026-10-14 17:20:13 America/Los_Angeles).

Base production commit: `13a2684709332088701e79b9270cce659eef1cfe`.
Approved viewport fix: `347461d4fceee1bb025847e3b7befc9a4e828e60`.
Integration branch: `codex/integration-completed-20261014`.

Only completed work as of the approval cutoff is eligible. Feature handoffs may be produced later, but must reconstruct that completed version rather than copy ongoing shared edits.

Eligible completed scopes being verified:

- Fixed document viewport; feeding, dialogs, court content and catbook keep their own scrolling/panning.
- Six minigames, single-player/computer/couple modes, cover grid, pending growth rewards and daily reward limit.
- Eighteen-cat catbook, station scene, game-win unlocks, previously completed scene and arrival interactions.
- Seven native model animations, varied idle/mood reactions and day/night lighting.
- Completed growth/need detail materials and readable need changes with a two-second hold and fade.
- Completed couple presence/role picker and compact status bar.
- Court responsibility scale and percentage bars, with no invented values for legacy cases.

Excluded at this cutoff: the in-progress six achievement cats and feeding-limit change, the in-progress accumulated need feedback and state rebalance, the later manual expression selector, later couple collaboration additions, and all subsequent requests.

Release gate: verify per-handoff hashes and scope, resolve overlapping integration changes, run the complete Node 22 suite with local PostgreSQL, build with production API URLs, audit runtime imports, push one frozen SHA, deploy that exact SHA on Render, verify PostgreSQL health, fast-forward main without force, await the matching Pages run, then verify the public mobile UI and assets. Do not consume existing user rewards or make real AI requests for smoke testing.

Infrastructure stays free. The existing Oregon PostgreSQL expires 2026-11-13 19:49 UTC; external database access stays disabled.

## Frozen candidate verification

All six completed handoffs were validated against their SHA256 manifests before integration. Shared main.js was merged against the released baseline, preserving presence, game controls, need feedback, model mood state and lifecycle cleanup. The collection victory hook runs only on an accepted transition to a finished game. The viewport fix remains in both home and court styles.

Node 22.23.3: 377 tests passed, 0 failed, 0 skipped, including a real local PostgreSQL instance. Production build with both production API URLs passed. The Docker runtime dependency closure was checked across 15 modules, and three minigame modules were added to the existing COPY list. No Docker daemon/image build was available. The care feed cap remains six, pet-needs and interaction rules match the released baseline, and the collection contains exactly 18 cats.

Complete logs: `/private/tmp/cat-completed-all-tests.log` and `/private/tmp/cat-completed-build.log`. Exact merged frontend phone validation remains a production release gate; shared localhost contains later work and is not evidence of this complete frozen build.
