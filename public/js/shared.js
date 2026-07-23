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
        health: 100,
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
        health: 100,
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
        health: 100,
        speed: 2,
        attackType: 'melee_kick', // same straight-line mechanic, long reach
        attackRange: 150,
        attackWidth: 35,
        attackDamage: 1,
        attackCooldown: 500,
        attackHealOnUse: 1, // heals every teammate this much each time the attack fires (hit or not)
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
    }
};

const BOSS_LIST = [
    { id: 'boss1', name: '스톤 골렘', locked: false },
    { id: 'boss2', name: '???', locked: true },
    { id: 'boss3', name: '???', locked: true }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ARENA_RADIUS, BOSS_RADIUS, PLAYER_RADIUS, CHARACTERS, BOSS_DEFS, BOSS_LIST };
} else {
    window.SHARED = { ARENA_RADIUS, BOSS_RADIUS, PLAYER_RADIUS, CHARACTERS, BOSS_DEFS, BOSS_LIST };
}
