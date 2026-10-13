# The eight levels

Physics reference:
* The player is 34×62. Run speed is 380/s.
* A held jump rises about 157 units; a tapped jump about 58.
* A flat jump at full speed covers about 290 units horizontally.
* Ground tops are at y=680 in a 900-unit-tall world.

Difficulty is measured, not guessed: `difficulty()` in `tests/playthrough.mjs` sweeps the take-off point of every timed jump in a level's winning route and measures how wide the window is that still clears the level. The score is the sum of 100/width over the level's timed jumps (higher = harder):

| Level | 1 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|
| Score | 1.98 | 3.01 | 3.36 | 3.37 | 4.00 | 4.73 | 5.08 |
| Tightest window (units) | 176 | 172 | 124 | 188 | 88 | 80 | 60 |

Level 2 is excluded from this table: its difficulty is in the crumbling tiles and the moving-platform wait, which this score doesn't capture.

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

Rules that hold everywhere, so traps stay fair:
* Red means lethal: spikes, saws, crusher teeth, the chasing wall.
* Ink means ground. Cracked ground with red cracks is about to fall.
* Gold means the exit or a reached checkpoint.
* A crusher is lethal only while falling. Once it lands it is ordinary solid ground.
* Death respawns you in 0.6 s, or immediately on Jump or a tap. If you reached a checkpoint in this attempt, you respawn there.
