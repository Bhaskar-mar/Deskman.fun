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

Levels 9–30 are ordered by this composite score, so each is harder than the one before (2.0.0: 11.9 for level 9 up to 40.0 for level 30; level 8 scores 10.5). Levels 1–8 keep the hand-tuned order from 1.4.0. The 2.0.0 tricks add weight too: reversed controls +1.5, plus the reactive weight of each new trap. The wall-chase levels 4 and 7 score above their neighbours because of the chase weight.

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

2.0.0 rebuilt these levels around Level-Devil-style tricks, layered so each level reuses earlier ones and adds one more:

| Trick | What happens | How to read it |
|---|---|---|
| `ambush` | A spike rises out of the landing while you are in the air | Jump long: the safe spot is past where the spike appears |
| `crumble` | A pillar you land on drops out from under you | Land and jump again at once |
| `popup` | Three hidden spikes appear in a row on flat ground | Walk slowly the first time; hop each one after |
| `reverse` | A banner flashes and left/right swap until the next banner | Watch for the banner; the stickman still faces the way he moves |
| `dropceiling` | A spiked ceiling lowers when you get close, then slides along | Short tap jumps only, keep moving |
| `stalactites` | Ceiling spikes shake briefly, then fall | Pass them during the shake, never stop under one |
| `fake` / `collapse` exit | The door is a lie, or the floor in front of it falls | Walk into the door twice / jump the last stretch |

These are built from obstacle segments by `buildLevel()` in `src/game/deskman-game.js`. Each segment carries its own solution, and `tests/playthrough.mjs` uses it to prove the level beatable. Checkpoints sit every third segment, except in chase levels.

| # | Name | Tier | Segments | Obstacles | Chase | Exit |
|---|---|---|---|---|---|---|
| 9 | CRUMBLE | BRUTAL | 10 | tiles, crumble, gap, island, fake, ambush | — | plain |
| 10 | RIDE | BRUTAL | 9 | moving, island, rusher, dropceiling, crumble, ambush, gap | — | collapse |
| 11 | SAW MILL | BRUTAL | 10 | saw, crumble, vsaw, stalactites, ambush, island, popup, gap | — | fake |
| 12 | LEAP OF FAITH | BRUTAL | 11 | gap, island, ambush, spikes, popup, crumble, step | — | plain |
| 13 | RUSH HOUR | BRUTAL | 10 | rusher, island, ambush, popup, crumble, spikes, gap | — | fake |
| 14 | GHOST FLOOR | INSANE | 11 | invisible, ambush, slide, island, popup, fake, crumble, hidden, reverse, gap | — | collapse |
| 15 | SLIP | INSANE | 10 | slide, popup, crumble, reverse, ambush, island, tiles | — | fake |
| 16 | LOW CEILING | INSANE | 10 | ceiling, dropceiling, island, reverse, rusher, crumble, gap | — | fake |
| 17 | DESCENT | INSANE | 11 | rusher, crumble, moving, dropceiling, slide, vsaw, ambush, reverse, tiles, island, gap | — | collapse |
| 18 | BLIND FAITH | INSANE | 13 | ambush, invisible, slide, popup, fake, crumble, hidden, reverse, island, gap | — | collapse |
| 19 | MIXED SIGNALS | INSANE | 11 | reverse, slide, dropceiling, saw, ambush, fake, crumble, stalactites, tiles, popup, gap | — | collapse |
| 20 | QUICKSAND | INSANE | 12 | tiles, slide, crumble, fake, reverse, ambush, popup, gap | — | collapse |
| 21 | CRUSHER ROW | IMPOSSIBLE | 11 | crusher, stalactites, crumble, ambush, tiles, reverse, popup, gap | — | collapse |
| 22 | CHASE | IMPOSSIBLE | 9 | gap, popup, tiles, island, ambush, stalactites, crumble, hidden | wall 360 | plain |
| 23 | GRINDER | IMPOSSIBLE | 13 | saw, crumble, crusher, vsaw, stalactites, ambush, reverse, island, dropceiling, gap | — | collapse |
| 24 | GAUNTLET | IMPOSSIBLE | 13 | slide, crumble, rusher, moving, crusher, dropceiling, reverse, saw, tiles, ambush, island, popup, gap | — | collapse |
| 25 | NEEDLE | IMPOSSIBLE | 12 | dropceiling, spikes, ceiling, popup, crumble, ambush, reverse, island, fake | — | collapse |
| 26 | NO MERCY | IMPOSSIBLE | 15 | fake, dropceiling, crumble, vsaw, slide, rusher, reverse, moving, tiles, crusher, ambush, island, stalactites, popup, gap | — | collapse |
| 27 | STAMPEDE | IMPOSSIBLE | 10 | rusher, crumble, dropceiling, tiles, ambush, stalactites, island, gap | wall 365 | collapse |
| 28 | FLIGHT | IMPOSSIBLE | 11 | tiles, dropceiling, crumble, rusher, ambush, ceiling, slide, island, stalactites, gap | wall 368 | collapse |
| 29 | LAST BREATH | IMPOSSIBLE | 13 | rusher, crumble, tiles, dropceiling, slide, ambush, island, fake, ceiling, popup, gap | wall 370 | collapse |
| 30 | DESKMAN | DEVIL | 23 | ambush, crumble, slide, rusher, moving, crusher, dropceiling, island, reverse, saw, tiles, fake, vsaw, stalactites, popup, gap | — | collapse |

Rules that hold everywhere, so traps stay fair:
* Red means lethal: spikes, saws, crusher teeth, the chasing wall.
* Ink means ground. Cracked ground with red cracks is about to fall.
* Gold means the exit or a reached checkpoint.
* A crusher is lethal only while falling. Once it lands it is ordinary solid ground.
* Death respawns you in 0.6 s, or immediately on Jump or a tap. If you reached a checkpoint in this attempt, you respawn there.
