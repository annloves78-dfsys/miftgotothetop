// Shared constants between server (Node, via require) and client (via <script>).
// Single source of truth so damage numbers/timings never drift between the two.

const ARENA_RADIUS = 300;
const BOSS_RADIUS = 50;
const PLAYER_RADIUS = 18;

// Character roster. Every cookie shares movement speed 2; other stats are
// balanced against 'kicker' as the baseline. attackType/skillType/ultimateType
// pick which branch of player.js/server.js logic applies to that cookie, so
// adding another cookie is a data entry here plus (at most) one new branch.
const CHARACTERS = {
    kicker: {
        name: '자두맛 쿠키',
        shortName: '쿠키', // shown on the lobby's character-select button
        color: '#3498db',
        grade: '일반',
        element: '바람',
        role: '힐러',
        health: 100,
        combatPower: 500, // starting value for every character
        speed: 2,
        attackType: 'melee_kick', // straight-line hit in the facing direction
        attackRange: 70, // how far the line-shaped kick reaches
        attackWidth: 40, // width of the straight-line kick corridor
        attackDamage: 5,
        attackCooldown: 500,
        skillType: 'spin_kick', // future characters may omit skillType entirely
        skillRange: 100,
        skillDamage: 7,
        skillCooldown: 10000,
        ultimateType: 'team_heal_over_time', // future characters may omit ultimateType entirely
        ultimateHealPerTick: 10,
        ultimateTickMs: 1000,
        ultimateDurationMs: 6000,
        ultimateCooldownMs: 30000
    },
    sweetpotato: {
        name: '자색 고구마맛 쿠키',
        shortName: '고구마', // shown on the lobby's character-select button
        color: '#8e44ad',
        grade: '희귀',
        element: '어둠',
        role: '대미지 딜러',
        health: 100,
        combatPower: 500, // starting value for every character
        speed: 2,
        attackType: 'melee_kick', // same straight-line mechanic, just a longer "hook" reach
        attackRange: 150,
        attackWidth: 30,
        attackDamage: 5,
        attackCooldown: 500,
        skillType: 'speed_boost', // self-buff, no server-side damage effect needed
        skillSpeedValue: 3,
        skillSpeedDurationMs: 5000,
        skillCooldown: 10000,
        ultimateType: 'targeted_aoe', // F arms it, next left-click picks the strike point
        ultimateRadius: 90, // medium-sized circle at the clicked point
        ultimateDamage: 10,
        ultimateCooldownMs: 30000
    },
    spinach: {
        name: '시금치맛 쿠키',
        shortName: '시금치', // shown on the lobby's character-select button
        color: '#27ae60',
        grade: '일반',
        element: '바람',
        role: '힐러',
        health: 100,
        combatPower: 500, // starting value for every character
        speed: 2,
        attackType: 'melee_kick', // same straight-line mechanic, long reach
        attackRange: 150,
        attackWidth: 35,
        attackDamage: 1,
        attackCooldown: 500,
        attackHealOnUse: 1, // heals every teammate this much whenever the attack connects
        attackHealChance: 0.4, // ...but only procs this often per connecting hit
        skillType: 'spin_heal', // channel a spin for skillDurationMs; if it connects, heal the team once
        skillRadius: 40,
        skillDurationMs: 2000,
        skillDamage: 1,
        skillHealOnHit: 10,
        skillCooldown: 10000,
        ultimateType: 'attack_heal_boost', // temporarily raises attackHealOnUse to ultimateHealPerAttack
        ultimateDurationMs: 8000,
        ultimateHealPerAttack: 5,
        ultimateCooldownMs: 30000
    },
    reddragon: {
        name: '레드 드레곤맛 쿠키',
        shortName: '드레곤', // shown on the lobby's character-select button
        color: '#c0392b',
        grade: '에픽',
        element: '불',
        role: '탱커',
        health: 110,
        combatPower: 500, // starting value for every character
        speed: 2,
        attackType: 'melee_kick', // shield bash: same straight-line corridor mechanic
        attackRange: 90,
        attackWidth: 45,
        attackDamage: 4,
        attackCooldown: 500,
        skillType: 'guard_stance', // 5s damage-reduction stance; ends early if the player attacks
        skillDurationMs: 5000,
        skillDamageMultiplier: 0.8, // incoming damage while guarding
        skillCooldown: 10000,
        ultimateType: 'awakening', // temporary speed/damage buff + a one-time self heal
        ultimateDurationMs: 8000,
        ultimateSpeedMultiplier: 1.5,
        ultimateDamageMultiplier: 0.8, // incoming damage while awakened
        ultimateAttackDamage: 7, // replaces attackDamage while awakened
        ultimateSelfHeal: 10,
        ultimateCooldownMs: 30000
    },
    volcano: {
        name: '화산맛 쿠키',
        shortName: '화산', // shown on the lobby's character-select button
        color: '#d35400',
        grade: '에픽',
        element: '불',
        role: '대미지 딜러',
        health: 100,
        combatPower: 500, // starting value for every character
        speed: 2,
        attackType: 'melee_kick', // 불주먹: same straight-line corridor mechanic
        attackRange: 90,
        attackWidth: 40,
        attackDamage: 5,
        attackCooldown: 500,
        // On top of the immediate 5, a burn ticks for 1 dmg, 1s apart, twice
        // (total 7). Intentionally left out of the ability description text.
        attackBurnDamage: 1,
        attackBurnTicks: 2,
        attackBurnIntervalMs: 1000,
        skillType: 'lava_burst', // instant self-centered AoE, same shape as spin_kick
        skillRange: 100,
        skillDamage: 5,
        skillCooldown: 10000,
        ultimateType: 'magma_zone', // click-to-place zone (aims like targeted_aoe) that ticks damage over time
        ultimateRadius: 90,
        ultimateZoneDamagePerTick: 2,
        ultimateZoneTickMs: 1000,
        ultimateZoneDurationMs: 10000,
        ultimateCooldownMs: 30000
    },
    greenapple: {
        name: '청사과맛 쿠키',
        shortName: '청사과', // shown on the lobby's character-select button
        color: '#8bc34a',
        grade: '희귀',
        element: '바람',
        role: '스트라이커',
        health: 100,
        combatPower: 500, // starting value for every character
        speed: 2,
        attackType: 'melee_kick', // 긴 다리: same corridor mechanic, longer reach
        attackRange: 160,
        attackWidth: 30,
        attackDamage: 2,
        attackCooldown: 500,
        attackKnockback: 20, // pushes the target back this many px (monsters only -- the boss is fixed in place)
        skillType: 'flying_kick', // directional lunge that stuns whatever it hits, no damage
        skillRange: 160,
        skillWidth: 40,
        skillStunMs: 1000,
        skillCooldown: 10000,
        // For ultimateDurationMs after casting, every basic attack that lands
        // marks its target with this element. While marked, any attacker who
        // shares that element deals ultimateMarkMultiplier damage and
        // consumes one charge; marks stack (multiple marks add up their
        // charges instead of overwriting).
        ultimateType: 'element_mark',
        ultimateDurationMs: 5000,
        ultimateMarkMultiplier: 1.3,
        ultimateMarkUses: 3,
        ultimateCooldownMs: 30000
    }
};

// Boss definitions. Each pattern carries every timing/number needed by both
// the server (authoritative hit judging) and the client (telegraph visuals).
const BOSS_DEFS = {
    boss1: {
        id: 'boss1',
        name: '스톤 골렘',
        maxHpPerPlayer: 500,
        restMsRange: [3000, 5000],
        patterns: {
            slam: {
                telegraphMs: 1200,
                radius: 150,
                damage: 25,
                knockback: 60
            },
            spray: {
                telegraphMs: 800,
                count: 8,
                speed: 300, // px/sec
                damage: 15,
                hitRadius: 22,
                travelMs: 1000 // ARENA_RADIUS / speed * 1000
            },
            sweep: {
                telegraphMs: 1000,
                durationMs: 2000,
                tickMs: 200,
                damage: 10,
                angleTolerance: 0.18 // radians
            }
        }
    },
    boss2: {
        id: 'boss2',
        name: '시하라얼',
        color: '#f1c40f',
        maxHpPerPlayer: 1000, // fixed at the arena center, same as boss1
        restMsRange: [3000, 10000],
        patterns: {
            // 창 찌르기: a red line telegraphs from the boss straight toward
            // wherever a (randomly chosen) target player was standing, then
            // strikes along that fixed line 0.3s later.
            spear_thrust: {
                telegraphMs: 300,
                range: 320, // long enough to reach across the whole arena
                width: 50,
                damage: 15
            },
            // 창 휘두르기: telegraphs a full half of the arena (the half
            // containing a random target player), red for 0.5s, then strikes
            // anyone still standing in that half regardless of distance.
            spear_sweep: {
                telegraphMs: 500,
                damage: 20
            },
            // 별 떨어트리기: 5 separate strikes, 1s apart, each telegraphing a
            // small circle at a (re-picked) target player's position and
            // landing 0.3s later.
            star_drop: {
                telegraphMs: 300,
                radius: 20,
                damage: 10,
                waveCount: 5,
                waveIntervalMs: 1000
            }
        }
    }
};

const BOSS_LIST = [
    { id: 'boss1', name: '스톤 골렘', icon: '🗿', locked: false },
    { id: 'boss2', name: '시하라얼', icon: '🤺', locked: false },
    { id: 'boss3', name: '???', locked: true }
];

const MONSTER_RADIUS = 16;
const STAR_RADIUS = 30;

// Story-mode monsters -- weaker enemies used on tower floors, distinct from
// the raid bosses. They don't close all the way to melee range; they hover
// at preferredDistance and poke from range on a cooldown instead.
const MONSTERS = {
    cake_slice: {
        name: '케이크 조각',
        color: '#f6a9c9',
        health: 50,
        speed: 3,
        aggroRange: 500, // dormant until the player gets this close
        preferredDistance: 80, // stops closing in once this near the player
        attackRange: 110, // still attacks if the player is within this range
        attackDamage: 5,
        attackCooldown: 3000,
        telegraphMs: 400
    }
};

// Story-mode floor layouts. Floor 1 is a long bridge stretching left from the
// start (x=0). All 5 monsters are clustered together in one room between
// arenaEntranceX and arenaExitX; once the player enters, an energy shield
// seals both gates (see server's storyPlayerMove handler) until every
// monster in the room is dead. The star sits just past the (now-open) exit
// gate -- attacking it clears the floor.
// Only floor 1 has content so far -- floors 2+ exist in STORY_FLOOR_DEFS.
const STORY_FLOOR_DEFS = {
    1: {
        levelType: 'bridge',
        levelLength: 1750, // how far the bridge extends to the left of the start
        laneHalfWidth: 70, // how far off the y=0 centerline the player can wander
        recommendedPower: 500, // shown on the tower's floor-select screen
        arenaEntranceX: -900, // shield seals here (blocks retreat) once monsters are engaged
        arenaExitX: -1500, // shield here blocks progress until the room is cleared
        monsters: [
            { type: 'cake_slice', x: -1050, y: -35 },
            { type: 'cake_slice', x: -1050, y: 35 },
            { type: 'cake_slice', x: -1200, y: 0 },
            { type: 'cake_slice', x: -1350, y: -35 },
            { type: 'cake_slice', x: -1350, y: 35 }
        ],
        star: { x: -1620, y: 0 } // right past the exit gate, no long walk after clearing
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ARENA_RADIUS, BOSS_RADIUS, PLAYER_RADIUS, CHARACTERS, BOSS_DEFS, BOSS_LIST, MONSTER_RADIUS, STAR_RADIUS, MONSTERS, STORY_FLOOR_DEFS };
} else {
    window.SHARED = { ARENA_RADIUS, BOSS_RADIUS, PLAYER_RADIUS, CHARACTERS, BOSS_DEFS, BOSS_LIST, MONSTER_RADIUS, STAR_RADIUS, MONSTERS, STORY_FLOOR_DEFS };
}
