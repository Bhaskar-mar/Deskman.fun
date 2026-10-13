# The thirty levels

Physics reference:
* The player is 34×62. Run speed is 380/s.
* A held jump rises about 157 units; a tapped jump about 58.
* A flat jump at full speed covers about 290 units horizontally.
* Ground tops are at y=680 in a 900-unit-tall world.

Difficulty is measured, not guessed. `difficulty()` in `tests/playthrough.mjs` replays every level's winning route:
* **Jump precision:** for each timed jump, sweep the take-off point and measure how wide the window is that still clears the level; add 100/width.
* **Crumbling tiles:** 1 per stretch, plus 10 / (hesitation slack in units).
* **Chasing wall:** 3 + (wall speed − 340) / 5.
* **Reactive hazards:** fixed weights for rushers (by speed), saws (by speed), crushers, hidden spikes, rides, invisible floors and fake exits.

Levels 9–30 are ordered by this composite score, so each is harder than the one before. Levels 1–8 keep the hand-tuned order from 1.4.0. The wall-chase levels 4 and 7 score above their neighbours because of the chase weight.

Every level is checked by `tests/playthrough.mjs`: a scripted run must complete it, and a naive "hold right" run must die. `tests/traps.mjs` checks that each signature trap kills at its designed spot.

| # | Name | Teaches | Signature surprise | How to beat it once you know |
|---|---|---|---|---|
| 1 | TRUST | Run, jump a pit, jump a spike, step up a ledge | When you approach, the EXIT hops away, and spikes pop up where it stood | Jump the spikes and follow the door |
| 2 | Disappearing Floor | Platforms crack and fall after you step on them; ride a moving platform | The last stretch of "solid" floor collapses almost instantly | Keep moving over the tiles, then jump the last stretch |
| 3 | HIDDEN | Hidden spikes, a patrolling saw, an invisible bridge, a checkpoint | A hanging crusher drops fast if you dash under it. The exit bounces you back once ("The door disagrees.") | Trigger the crusher, step back, then climb over it once it lands (it becomes solid). Walk into the door twice |
| 4 | DON'T STOP | Collapsing tiles under pressure, a vertical saw | A red sawtooth wall chases you through the whole level | Never stop. Run under the saw while it is up, or jump it while it is down |
| 5 | TRUST NOTHING | Everything above, plus a checkpoint | The floor under the visible exit collapses and the door leaps up to a far ledge. Then the tile just before the real exit drops out | Jump early over the collapsing floor, climb the ledge, and jump straight into the door |
| 6 | SLIDE (hard) | Short "tap" jumps, reading moving threats | The floor ahead slides away when you approach; a spike rushes at you; a low ceiling lined with spikes kills a full jump over the floor spike beneath it; a narrow crusher | Jump the gap the slide opens, hop over the rusher, *tap* jump under the ceiling, let the crusher fall then climb it |
| 7 | PANIC (brutal) | Everything under pressure | A faster wall chases you while 100-wide tiles crumble, the floor drops out of the world, a spike rushes at you and a ceiling corridor demands a tap jump; the exit bounces you back once | Never stop; jump the dropped floor from its edge; tap under the ceiling; walk into the door twice |
| 8 | THE DEVIL (impossible) | Every mechanic, two checkpoints | Hidden spike, sliding floor, rushing spike, a moving platform under ceiling spikes, a crusher, crumbling tiles, a saw, an invisible bridge, a collapsing floor under the first exit that forces a long leap onto a 90-wide strip, and a spike that pops up on the final ledge right before the real exit | Learn each section, then chain them: the last two jumps must be taken the moment you land |

## Levels 9–30

These are built from obstacle segments by `buildLevel()` in `src/game/deskman-game.js`. Each segment carries its own solution, and `tests/playthrough.mjs` uses it to prove the level beatable. Checkpoints sit every third segment, except in chase levels.

| # | Name | Tier | Segments | Obstacles | Chase | Exit |
|---|---|---|---|---|---|---|
| 9 | LEAP OF FAITH | BRUTAL | 11 | gap, island, spikes, hidden, step | — | plain |
| 10 | CRUMBLE | BRUTAL | 11 | tiles, gap, island, spikes, fake | — | plain |
| 11 | RUSH HOUR | BRUTAL | 11 | rusher, island, hidden, gap, spikes | — | fake |
| 12 | CHASE | BRUTAL | 8 | gap, spikes, tiles, island, hidden, step | wall 345 | plain |
| 13 | SLIP | BRUTAL | 11 | slide, spikes, island, tiles, hidden, gap | — | fake |
| 14 | GHOST FLOOR | INSANE | 11 | invisible, hidden, slide, island, fake, spikes, gap | — | collapse |
| 15 | RIDE | INSANE | 10 | moving, island, rusher, ceiling, gap, hidden | — | collapse |
| 16 | SAW MILL | INSANE | 12 | saw, island, vsaw, gap, spikes, hidden | — | fake |
| 17 | LOW CEILING | INSANE | 11 | ceiling, gap, island, rusher, step | — | fake |
| 18 | MIXED SIGNALS | INSANE | 10 | slide, ceiling, island, saw, fake, hidden, crusher, tiles, gap | — | collapse |
| 19 | DESCENT | INSANE | 10 | rusher, island, moving, ceiling, slide, vsaw, hidden, tiles, gap | — | collapse |
| 20 | CRUSHER ROW | INSANE | 9 | crusher, gap, island, tiles, hidden | — | collapse |
| 21 | NEEDLE | IMPOSSIBLE | 11 | ceiling, spikes, island, hidden, gap, fake | — | collapse |
| 22 | BLIND FAITH | IMPOSSIBLE | 12 | hidden, invisible, slide, island, fake, ceiling, gap | — | collapse |
| 23 | GRINDER | IMPOSSIBLE | 12 | saw, island, crusher, vsaw, gap, spikes, ceiling | — | collapse |
| 24 | QUICKSAND | IMPOSSIBLE | 11 | tiles, slide, island, fake, gap, hidden, ceiling | — | collapse |
| 25 | STAMPEDE | IMPOSSIBLE | 9 | rusher, island, ceiling, tiles, gap, hidden | wall 350 | collapse |
| 26 | NO MERCY | IMPOSSIBLE | 14 | fake, ceiling, island, vsaw, slide, rusher, moving, tiles, crusher, gap, hidden | — | collapse |
| 27 | GAUNTLET | IMPOSSIBLE | 13 | slide, island, rusher, moving, crusher, ceiling, saw, tiles, hidden, gap | — | collapse |
| 28 | FLIGHT | IMPOSSIBLE | 10 | tiles, ceiling, island, rusher, slide, gap, hidden | wall 355 | collapse |
| 29 | LAST BREATH | IMPOSSIBLE | 13 | rusher, island, tiles, ceiling, slide, gap, fake, hidden | wall 360 | collapse |
| 30 | RAZEBAIT | DEVIL | 22 | hidden, island, slide, rusher, moving, crusher, ceiling, saw, tiles, fake, vsaw, gap | — | collapse |

Rules that hold everywhere, so traps stay fair:
* Red means lethal: spikes, saws, crusher teeth, the chasing wall.
* Ink means ground. Cracked ground with red cracks is about to fall.
* Gold means the exit or a reached checkpoint.
* A crusher is lethal only while falling. Once it lands it is ordinary solid ground.
* Death respawns you in 0.6 s, or immediately on Jump or a tap. If you reached a checkpoint in this attempt, you respawn there.
