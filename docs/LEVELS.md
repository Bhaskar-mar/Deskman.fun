# The thirty levels

Physics reference:
* The player is 34×62. Run speed is 380/s.
* A held jump rises about 157 units; a tapped jump about 58.
* A flat jump at full speed covers about 290 units horizontally.
* Ground tops are at y=680 in a 900-unit-tall world.

## How the game teaches, then betrays

* **Levels 1–5 teach.** Each one introduces one or two ideas. A card names them when the level starts ("NEW: CRUMBLING FLOOR — Cracks red, then drops. Never stop on it."). Then the level uses them against you.
* **Levels 6–10 introduce the nasty stuff**: sliding floors, rushing spikes, low and dropping ceilings, trapdoors, sky spikes, reversed controls, jumping spikes, invisible and fake floors, rising walls. Each is named on its level's card.
* **Levels 11–30 mix everything**, each a little harder than the last.
* **Hints:** die twice at the same obstacle and a HINT box explains how to beat that obstacle. It stays until you get past it. Every obstacle type has a hint (`SEG_HINTS` in `src/game/deskman-game.js`). A level can override one with `hints:{kind:'text'}`.

## Every trick

| Segment | What happens | How to beat it |
|---|---|---|
| `spikes:N` | A row of N+1 spikes | Hold jump for height and distance |
| `gap:W` | A pit W wide | Jump from the edge |
| `step` | A ledge | Jump up |
| `tiles:K:W:ms` | K floor tiles crack and fall after you step on them | Never stop on them |
| `crumble:W:I` | A narrow pillar that falls the instant you land | Jump again immediately |
| `island:W:I` | A narrow pillar between two pits | Land and leave at once |
| `hidden` | A spike rises from the floor as you approach | Jump just before it |
| `popup` | Three hidden spikes rise one after another | Hop, hop, hop |
| `ambush:W` | A spike rises where a normal jump would land | Jump from the very edge, then hop it |
| `saw:SPEED` / `vsaw` | Patrolling saw (horizontal / vertical) | Go when it turns away / run under it while it is up |
| `crusher` | A block slams down when you get close | Stop, let it land, then climb it |
| `stalactites:N` | Ceiling blocks fall as you pass under them | Never slow down |
| `slide:W` | The floor ahead slides away as you reach it | Jump right at the edge |
| `rusher:SPEED` | A spike charges at you along the floor | Jump it when it is close |
| `ceiling` / `dropceiling` | Spiked ceiling (that drops as you enter) | Tap jump only |
| `moving:W[:ceil]` | A moving platform, optionally under a spiked ceiling | Step on, stand still |
| `reverse:L` | Left and right swap inside a red zone | Press ← to go forward |
| `invisible:W` | A floor you cannot see | Walk on it |
| `fake` | A floor that falls almost at once | Jump over it |
| **`trapdoor:W`** (2.1) | Ordinary-looking floor drops out of the world as you arrive | Jump before it |
| **`skyspike`** (2.1) | A spike falls out of the sky onto where a runner will be | Stop when it starts falling, then jump it |
| **`leaper`** (2.1) | A floor spike leaps up into your jump | Do not jump: run under it |
| **`riser`** (2.1) | A wall shoots up out of the floor | Jump it as it rises |
| exit `fake` | The door pushes you back once | Walk in again |
| exit `collapse` | The floor under the door falls and the door runs to a ledge | Jump early, climb, jump into the door |
| **exit `runaway`** (2.1) | The door hops away twice, leaving a spike where it stood | Follow it and jump the spikes |

Rules that hold everywhere, so traps stay fair once you know them:
* Red means lethal: spikes, saws, crusher teeth, the chasing wall.
* Ink means ground, unless the level told you otherwise.
* Gold means the exit or a reached checkpoint.
* A crusher is lethal only while falling. Once it lands it is ordinary solid ground.
* Death respawns you in 0.6 s, or immediately on Jump or a tap. If you reached a checkpoint in this attempt, you respawn there.

## Difficulty is measured, not guessed

`difficulty()` in `tests/playthrough.mjs` replays every level's winning route and scores it:
* **Jump precision:** for each timed jump, sweep the take-off point and measure how wide the window is that still clears the level; add 100/width.
* **Crumbling tiles:** 1 per stretch, plus 10 / (hesitation slack in units).
* **Chasing wall:** 3 + (wall speed − 340) / 5.
* **Reactive hazards:** fixed weights for rushers (by speed), saws (by speed), crushers, hidden spikes, rides, invisible floors, fake and running exits, reversed controls (+1.5), trapdoors (+0.6), sky and jumping spikes (+0.9 each), rising walls (+0.3).

The score rises at every level, from 4.96 (level 1) to 45.12 (level 30). Before 2.1, level 1 scored 2.38 and level 10 scored 11.89.

Every level is built from segments by `buildLevel()` in `src/game/deskman-game.js`. Each segment carries its own winning inputs, which the tests use:
* `tests/playthrough.mjs`: the scripted route must complete each level, and a naive "hold right" run must fail.
* `tests/traps.mjs`: each trick, alone in a test level, must kill a player who plays it the obvious way, at the right spot.
* `tests/checkpoints.mjs`: every checkpoint must lead to a completable run.

Checkpoints sit every third segment, except in chase levels.

| # | Name | Tier | Score | New in this level | Obstacles | Chase | Exit |
|---|---|---|---|---|---|---|---|
| 1 | FIRST STEPS | EASY | 4.96 | spikes, the exit | 5: spikes, gap, step | — | runaway |
| 2 | CRUMBLE | EASY | 6.47 | crumbling floor | 7: tiles, gap, spikes, crumble | — | plain |
| 3 | PEEKABOO | MEDIUM | 10.93 | hidden spikes, lying doors | 8: spikes, hidden, gap, popup, tiles, ambush | — | fake |
| 4 | MACHINES | MEDIUM | 11.38 | saws, crushers | 10: saw, hidden, crusher, gap, vsaw, crumble, popup | — | fake |
| 5 | RUN | HARD | 15.19 | the wall | 9: gap, tiles, spikes, island, hidden, crumble, ambush | wall 345 | plain |
| 6 | BUTTER | HARD | 17.13 | sliding floor, rushing spikes, running door | 10: slide, rusher, tiles, crumble, ambush, popup, gap | — | collapse |
| 7 | LOW BLOW | HARD | 18.17 | low ceilings, dropping ceiling, rides | 10: ceiling, gap, dropceiling, moving, rusher, crumble, popup | — | collapse |
| 8 | TRAPDOOR | BRUTAL | 18.72 | trapdoors, sky spikes | 11: trapdoor, skyspike, crumble, ambush, dropceiling, rusher, popup, gap | — | fake |
| 9 | MIRROR | BRUTAL | 20.19 | reversed controls, jumping spikes | 12: leaper, trapdoor, reverse, skyspike, crumble, ambush, tiles, dropceiling, gap | — | collapse |
| 10 | GHOST | BRUTAL | 20.94 | invisible floor, fake floor, rising walls | 15: invisible, fake, riser, trapdoor, skyspike, leaper, reverse, crumble, ambush, stalactites, rusher, dropceiling, gap | — | collapse |
| 11 | LEAP OF FAITH | BRUTAL | 21.28 | — | 16: gap, island, leaper, ambush, crumble, spikes, popup, skyspike, step | — | plain |
| 12 | SAW MILL | BRUTAL | 21.49 | — | 14: saw, crumble, skyspike, vsaw, stalactites, popup, trapdoor, ambush, island, gap | — | fake |
| 13 | RUSH HOUR | BRUTAL | 22.17 | — | 14: rusher, island, trapdoor, ambush, popup, skyspike, crumble, reverse, spikes, gap | — | fake |
| 14 | GHOST FLOOR | INSANE | 22.71 | — | 15: invisible, ambush, popup, slide, island, leaper, trapdoor, fake, crumble, hidden, reverse, gap | — | collapse |
| 15 | SLIP | INSANE | 23.04 | — | 14: slide, popup, skyspike, crumble, reverse, trapdoor, ambush, island, tiles | — | fake |
| 16 | LOW CEILING | INSANE | 23.15 | — | 14: ceiling, dropceiling, leaper, island, crumble, reverse, skyspike, rusher, popup, gap | — | fake |
| 17 | DESCENT | INSANE | 26.29 | — | 15: rusher, crumble, trapdoor, moving, dropceiling, ambush, slide, vsaw, skyspike, reverse, tiles, island, gap | — | collapse |
| 18 | BLIND FAITH | INSANE | 26.35 | — | 17: ambush, invisible, popup, slide, leaper, fake, crumble, trapdoor, hidden, reverse, island, gap | — | collapse |
| 19 | CRUSHER ROW | INSANE | 26.77 | — | 15: crusher, stalactites, trapdoor, crumble, ambush, tiles, skyspike, reverse, popup, gap | — | collapse |
| 20 | QUICKSAND | INSANE | 26.93 | — | 16: tiles, slide, leaper, crumble, fake, reverse, skyspike, ambush, popup, gap | — | collapse |
| 21 | CHASE | IMPOSSIBLE | 26.95 | — | 13: gap, popup, trapdoor, tiles, leaper, island, ambush, stalactites, crumble, hidden | wall 360 | plain |
| 22 | MIXED SIGNALS | IMPOSSIBLE | 27.73 | — | 15: reverse, slide, skyspike, dropceiling, saw, popup, ambush, fake, trapdoor, crumble, stalactites, tiles, gap | — | collapse |
| 23 | GRINDER | IMPOSSIBLE | 28.06 | — | 17: saw, crumble, popup, crusher, vsaw, stalactites, leaper, ambush, trapdoor, reverse, island, dropceiling, gap | — | collapse |
| 24 | NEEDLE | IMPOSSIBLE | 30.02 | — | 16: dropceiling, spikes, leaper, ceiling, popup, crumble, skyspike, ambush, reverse, island, fake | — | collapse |
| 25 | GAUNTLET | IMPOSSIBLE | 31.82 | — | 17: slide, crumble, skyspike, rusher, moving, crusher, popup, dropceiling, reverse, trapdoor, saw, tiles, ambush, island, gap | — | collapse |
| 26 | NO MERCY | IMPOSSIBLE | 32.03 | — | 19: fake, dropceiling, crumble, trapdoor, vsaw, slide, rusher, ambush, reverse, moving, skyspike, tiles, crusher, island, stalactites, popup, gap | — | collapse |
| 27 | STAMPEDE | IMPOSSIBLE | 35.17 | — | 14: rusher, crumble, trapdoor, dropceiling, leaper, tiles, popup, ambush, stalactites, island, gap | wall 365 | collapse |
| 28 | FLIGHT | IMPOSSIBLE | 35.99 | — | 15: tiles, dropceiling, trapdoor, crumble, rusher, leaper, ambush, popup, ceiling, slide, island, stalactites, gap | wall 368 | collapse |
| 29 | LAST BREATH | IMPOSSIBLE | 37.7 | — | 15: rusher, crumble, tiles, dropceiling, trapdoor, slide, ambush, island, fake, popup, ceiling, gap | wall 370 | collapse |
| 30 | DESKMAN | DEVIL | 45.12 | — | 26: ambush, crumble, slide, rusher, moving, crusher, skyspike, dropceiling, island, reverse, saw, tiles, leaper, fake, vsaw, stalactites, trapdoor, popup, gap | — | collapse |
