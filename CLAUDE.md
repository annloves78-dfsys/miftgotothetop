# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 유누의 메모

여기 적어두면 다음 세션이 시작할 때 읽고 참고합니다. 원하는 거, 하지 말았으면 하는 거,
지금 진행 중인 것/보류 중인 것 등을 자유롭게 계속 추가하세요.

- **이벤트 보스**(`water_guardian`/`flame_guardian`/`spark_guardian`, shared.js)는 지금은
  자리만 채운 placeholder다. 내가 직접 디자인해서 나중에 줄 예정이니, 지금 숫자를
  다듬거나 손대지 말 것.
- **스토리 타워는 층 제한이 없는 무한 컨셉**이다("GOTOTHETOP"). "마지막 층", "탑 정복"
  같은 완결형 문구나 로직을 넣지 말 것. `STORY_TOTAL_FLOORS`는 그냥 지금까지 만든
  층 수일 뿐 진짜 상한이 아니니, 새 층 추가할 때마다 이 숫자부터 올릴 것 (20층 보스
  추가할 때 이걸 깜빡해서 한 번 층이 아예 안 보이는 버그가 났었다).
- **뭔가 새로 만들면**(캐릭터/장비/보스 등) 물어볼 게 있으면 먼저 물어보고, 답 들은
  다음엔 "배포할까요?" 다시 안 물어보고 바로 커밋·푸시·배포까지 진행할 것.
- **배포 끝나면 항상 라이브 링크**(https://mift.anne.ai.kr — 2026-08-17부로 Render는
  그만 쓰고 여기로 옮김, Render 링크는 더 이상 언급하지 말 것)를 답변에 같이 보낼 것.
- 이 프로젝트는 **여러 세션이 동시에** 건드릴 때가 있다. 커밋 전에 `git status`/
  `git diff --stat`로 내가 안 건드린 변경사항이 섞여 있는지 확인하고, 내 작업분만
  스테이징할 것.
  새로운 케릭터를 만들면 그 케릭터에 설명이 제대로 적혔는지 확인하기.
  새로운걸 만들때 완전히 정해진것이 아니면 먼저 만들지 않기.
  새로운걸 만들기 전에 뭘 만드는지 말하고 만들기.
- **레전드 스토리(지하)는 원칙적으로 층마다 보스 하나씩**이다. 지하 1층(`legend1`)은
  잡몹만 있는 맛보기 예외였고, 그 뒤부터는 10층/20층 보스전과 같은 모양(짧고 넓은
  외길 하나, 잡몹 없이 보스 하나, `winOnClear`+`bossFloor`)을 기본으로 쓸 것.
- **지하 2층(`legend2`) 보스는 레드 드레곤맛 쿠키의 폭주**(`MONSTERS.reddragon_rampage`)다.
  분노의 이유는 "아무도 자길 안 써준다"(인기 없는 캐릭터라는 메타 설정) — 순수 분노 쪽
  톤이지 서글픈 쪽 아님. **stats/스킬/궁극기는 유누가 확정한 실전 수치**(2026-08-11,
  체력15000·공속200ms·적중 시 2회복, 특수스킬 10초 쿨/5초간 피해50%+회복30+보호막50,
  궁극기 30초 쿨/10초간 이속3·공격력15·피해60%+회복50+보호막100)라 더 이상
  placeholder 아님 — 숫자를 임의로 손대지 말고, 바꾸고 싶으면 먼저 물어볼 것.
  `monsterSkill`/`monsterUltimate`는 이 보스를 위해 새로 만든 범용 몬스터 엔진
  필드라 다른 몬스터도 그대로 재사용 가능. 아레나 안에 놓을 구조물(장애물)은
  아직 미정 — 유누가 정해서 줄 예정.

## Commands

- **Run the server locally**: `node server.js` (or `npm start`). Reads `PORT` env var, defaults to 8080.
- No build step — `public/` is served directly via `express.static`; editing a client file takes effect on next page load.
- No test suite and no linter configured in this repo.
- **Deploy**: live at `https://mift.anne.ai.kr`, an Ubuntu 24.04 server (Korean cloud provider, IP 1.201.117.244) running Node 22 + nginx (reverse proxy 80/443 → localhost:8080) + pm2 (process `boss-raid`) + Let's Encrypt SSL. `git push` to `main` on GitHub does **not** auto-deploy here — after pushing, SSH in and pull+restart manually:
  ```
  KEY="/g/내 드라이브/working/yunu/SSH_KeyPair-260817135047.pem"
  chmod 600 "$KEY"
  ssh -i "$KEY" -o StrictHostKeyChecking=accept-new ubuntu@mift.anne.ai.kr \
    "cd /home/ubuntu/miftgotothetop && git pull && pm2 restart boss-raid && pm2 status boss-raid"
  ```
  (Render deploy at miftgotothetop.onrender.com still technically exists but is retired/unused as of 2026-08-17 — don't bother keeping it in sync, and don't send its link.)

## Architecture

This is a real-time multiplayer (1-2 player co-op) browser game built on Express + Socket.IO, with four distinct game modes sharing one server process and one `rooms` dict.

### shared.js is the single source of truth
`public/js/shared.js` defines every piece of game data — `CHARACTERS`, `EQUIPMENT`, `MONSTERS`, `BOSS_DEFS`, `STORY_FLOOR_DEFS`, gacha tables, awaken-mode tables, etc. — and is loaded two ways from the same file: `require()`'d by `server.js` (Node) and `<script>`-tagged into the browser as `window.SHARED`. Never duplicate a number or data table between client and server; add it to `shared.js` once. When adding anything new here, remember to add it to **both** `module.exports` blocks at the bottom of the file (one for Node, one for `window.SHARED`) — a common mistake is updating the data but forgetting one of the two export lists.

### Three game modes, one `rooms` object
`server.js` keeps all live matches in a single `rooms[roomId]` dict. A room's `kind` (or which id pattern it uses) determines which tick function drives it:
- **보스 레이드** (`BOSS_DEFS`, e.g. `boss1`/`boss2`): a fixed circular arena (`ARENA_RADIUS`), boss always pinned at world origin `(0,0)`. Combat is a `bossState` state machine (`idle → telegraph → active`) with hand-written per-pattern branches in `tickRoom` (server) mirrored by matching draw code in `public/js/boss.js` (client) — adding a new raid-boss pattern means writing both halves.
- **스토리 모드** (`kind: 'story'`, `STORY_FLOOR_DEFS`): players walk a 1D "lane"/bridge (`along`/`across` coordinates via `alongOf`/`acrossOf`/`fromAlongAcross`, see the "꼬불꼬불한 다리" comment block in shared.js for winding-path floors) fighting waves of `MONSTERS`, and clear a floor by walking onto its `star` (not by attacking it). A floor can opt into being a "boss floor" (`bossFloor: true` on the floor def, checked by `isTowerBossFloor` — it reads the flag, not floor number, so it's not automatically every 10th floor) with legendary-only drops and no star (`winOnClear: true`, clears when every monster dies instead); floors 10 and 20 do this (embedding a single named boss as one of its `monsters` entries, e.g. floor 10's `cake_boss`, floor 20's `clown_boss` — those use the generic chase-and-melee AI in `tickMonsterSet` unless the monster def sets a flag like `trickBoss: true`, in which case it's routed to a fully custom tick function instead (see `tickClownBoss`) and the client special-cases its rendering too), but 30 and 40 deliberately don't (얼음/서리 챕터, 30~49층, is wave-only with no boss encounter, by request). Floors 1-10 are solo; **floor 11+ uses a 2-cookie party** (`storyPartySizeFor`) with swap-mid-fight support.
- **게스트 레이드** (`public/js/guest_raid.js` + `GUEST_BOSS_DEFS`): a separate square-arena mode, structurally similar to the boss-raid pattern system but its own file/state.
- **좀비막기** (`kind: 'zombie'`, `public/js/zombie_defense.js` + `ZOMBIE_DEFS`/`ZOMBIE_*` constants in shared.js): a build-and-survive mode, not a boss fight — a wide rectangular arena divided into a 15x8 grid (`ZOMBIE_GRID_COLS`/`ZOMBIE_GRID_ROWS`, `room.grid` index 0-119; `zombieCellIndex`/`zombieCellCenter`/`zombieColRowOfPos` in shared.js convert between grid index and world position). Zombies always spawn along the arena's right edge and push left toward the players, who start on the left side. Pressing F opens a build menu (fence/workbench/furnace/miner/house from `ZOMBIE_BUILDABLES`, plus turret/upgrade-table/reinforced-fence/reinforced-turret/cannon from `ZOMBIE_WORKBENCH_ITEMS` once a workbench exists *anywhere* on the map, not necessarily nearby) and placing one occupies a cell as a solid obstacle with hp, buildable only in the cells adjacent to the player (`zombieBuildableCellsFrom`); the menu collapses the instant an item is picked so it doesn't block the placement click. Costs are read as `def.wood || 0` / `def.iron || 0` — some items (the cannon) only cost iron, so don't assume every def has a `wood` field. A house heals whichever alive player is standing on its cell for 1 hp every 500ms (`tickZombieHouseHealing`), same generic building otherwise (zombies will break it open if they're sealed out). Zombies path around obstacles with a per-tick BFS flow field computed from each alive player's cell (`zombieBuildFlowField`/`recomputeZombieFields`) rather than walking straight at their target; only when no path exists at all (the player has fully sealed themselves in) do they fall back to walking straight and attacking whatever structure blocks them (`structureDamage`). `tickZombieTurrets` generically drives every auto-attacking structure — any `ZOMBIE_WORKBENCH_ITEMS` entry with a `range` field (turret, reinforced turret, cannon) auto-fires at the nearest zombie in range each tick; the cannon's `range: Infinity` means it always hits the nearest zombie regardless of distance. Trees (independent of the grid) respawn periodically for wood; miners passively add 1 ore/10s to the room's shared `ore` pool, and a built furnace converts 1 ore -> 1 iron every 8s (`tickZombieEconomy`) — iron plus wood is what the reinforced-tier items cost. An upgrade table (once built, interact by clicking it while nearby) lets the party spend coins on four independent room-scoped, run-only buffs handled by one generic `zombieUpgradeStat({stat})` handler keyed through `ZOMBIE_UPGRADE_LEVEL_KEYS` — `attack` (adds to every swing's damage in `zombiePlayerAttack`), `turretAttack` (adds to every auto-attacking structure's damage in `tickZombieTurrets`), `fenceHp` (immediately bumps `hp`/`maxHp` on every already-built `fence` cell, and is baked into any fence built afterward too), and `soldierAttack` (adds to soldiers' melee damage in `tickZombieSoldiers`). All four share the same cost curve (`zombieUpgradeCost`, climbing 5/10/15/... per stat independently) and reset when the room ends, never touching the character's real stats. The per-level amounts are fractional (`ZOMBIE_ATK_UPGRADE_AMOUNT` = 0.2 for the three attack-style stats, `ZOMBIE_FENCE_HP_UPGRADE_AMOUNT` = 0.5 for fence hp) — always floor `level * amount` at the point you apply it rather than storing/adding the raw fraction, so low levels show no visible change until the floor threshold is crossed. `zombieFenceHpBonus(level)` is the shared helper for that; fenceHp's purchase handler applies the *delta* between the old and new floored bonus to existing fences rather than adding the raw per-level amount, so retroactively-upgraded fences and freshly-built ones at the same level always end up with identical hp — don't reintroduce a flat `+= ZOMBIE_FENCE_HP_UPGRADE_AMOUNT` there. A `soldierSpawner` (base buildable, no workbench needed) mints a friendly `ZOMBIE_SOLDIER_DEF`-stat unit into `room.soldiers` every 15s up to `ZOMBIE_SOLDIER_CAP_PER_SPAWNER` per spawner cell (`tickZombieSoldierSpawners`); soldiers ignore grid obstacles entirely (unlike zombies) and walk straight at the nearest zombie to melee it (`tickZombieSoldiers`), while `tickZombie`'s melee-range check now picks whichever of the nearest player or nearest soldier is closer to attack — zombies don't reroute to chase soldiers, they only fight ones they happen to pass. Mobile joystick controls (`mc-joystick-zombie`/`mc-attack-zombie`) intentionally do *not* auto-aim on attack even when the global auto-aim setting is on — the joystick direction already sets facing every frame, so snapping to the nearest zombie on attack would fight the stick; both the mobile attack button and the desktop canvas click check `mobileControlsEnabled` first and skip the auto-aim snap when it's on. Unlike the other three modes, characters' special attack types (combo/dual-spear/projectile/etc.) are deliberately *not* reproduced here — `zombiePlayerAttack` always resolves a single plain swing via the shared `resolveAttack`, so every cookie plays identically in this mode. There's no win condition; when the whole party dies the reward scales with the wave reached (`zombieWaveReward`).

Across all three: **movement is client-authoritative** (client computes its own x/y and just tells the server via `playerMove`/`storyPlayerMove`, lightly bounds-checked), while **combat/damage is server-authoritative** — all HP changes, drops, and RNG happen in `server.js` and are pushed to clients as events.

### Client structure
- `public/js/main.js` — the client: all screens (lobby, story tower, gacha, equipment, character select), socket event handlers, and the story-mode render loop (`storyFrame`/`storyRender`).
- `public/js/boss.js` / `public/js/player.js` — draw-only classes for the boss-raid mode's boss and players.
- `public/js/storage.js` — the local save shape (`defaultData`/`defaultCurrencies`) and localStorage read/write.
- `public/js/supabase-config.js` — Supabase project config, shared with the sibling `gd_forum` project (its tables are prefixed `br_` to avoid collision). Account auth/cloud save is **not** Supabase's built-in auth — it's custom email/password via Postgres RPC functions called from `main.js` (`br_login`, `br_signup`, `br_save_data`, `br_get_me`), not the `supabase-js` auth client.

### Equipment/character bonus system
Equipment bonuses are additive/multiplicative stat keys applied generically — see `EQUIP_BONUS_KEYS` and `equipBonusFor()` in shared.js. Most gear items are plain `bonus*` stat deltas, but some ("각성" gear, tied to a specific `ownerChar`) instead use `awakenForm` to overwrite a character's base stats wholesale for values that can't be expressed as a simple bonus (e.g. skill damage, duration thresholds) — see the `formStat()` helper and the "각성 장비" comments in shared.js for the reasoning on when to use which.

### Known repo quirk
The user sometimes runs multiple Claude Code sessions against this repo concurrently, so an unrelated feature may show up already modified/staged when you start work — check `git status`/`git diff --stat` before committing and only stage what belongs to your own change.
