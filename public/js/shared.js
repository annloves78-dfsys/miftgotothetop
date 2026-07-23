// Shared constants between server (Node, via require) and client (via <script>).
// Single source of truth so damage numbers/timings never drift between the two.

const ARENA_RADIUS = 300;
const BOSS_RADIUS = 50;
const PLAYER_RADIUS = 18;

// 8-way facing, shared by client rendering (angle = atan2) and server hit
// detection (line-kick direction), so both always agree on what each facing
// value actually points at.
const FACING_VECTORS = {
    right: [1, 0],
    downright: [Math.SQRT1_2, Math.SQRT1_2],
    down: [0, 1],
    downleft: [-Math.SQRT1_2, Math.SQRT1_2],
    left: [-1, 0],
    upleft: [-Math.SQRT1_2, -Math.SQRT1_2],
    up: [0, -1],
    upright: [Math.SQRT1_2, -Math.SQRT1_2]
};

// Character roster. Only 'kicker' exists today; future characters get their
// own attackType branch in player.js instead of rewriting this structure.
const CHARACTERS = {
    kicker: {
        name: '자두맛 쿠키',
        shortName: '쿠키', // shown on the lobby's character-select button
        color: '#3498db',
        health: 100,
        speed: 2.52,
        attackType: 'melee_kick', // future: 'ranged', 'magic', ...
        attackRange: 70, // how far the line-shaped kick reaches
        attackWidth: 40, // width of the straight-line kick corridor
        attackDamage: 12,
        attackCooldown: 500,
        skillType: 'spin_kick', // future characters may omit skillType entirely
        skillRange: 100,
        skillDamage: 40,
        skillCooldown: 8000,
        ultimateType: 'team_heal_over_time', // future characters may omit ultimateType entirely
        ultimateHealPerTick: 10,
        ultimateTickMs: 1000,
        ultimateDurationMs: 6000,
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
    module.exports = { ARENA_RADIUS, BOSS_RADIUS, PLAYER_RADIUS, FACING_VECTORS, CHARACTERS, BOSS_DEFS, BOSS_LIST };
} else {
    window.SHARED = { ARENA_RADIUS, BOSS_RADIUS, PLAYER_RADIUS, FACING_VECTORS, CHARACTERS, BOSS_DEFS, BOSS_LIST };
}
