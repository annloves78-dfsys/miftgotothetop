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
        colorLeft: '#ff6b9d', // pink
        colorRight: '#e74c3c', // red
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
        colorLeft: '#f1c40f', // yellow
        colorRight: '#8e44ad', // purple
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
        colorLeft: '#e74c3c', // red
        colorRight: '#27ae60', // green
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
        colorLeft: '#3498db', // blue
        colorRight: '#e74c3c', // red
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
        // Blue/red. Deliberately deeper shades than 레드 드레곤맛's blue/red so
        // the two don't read as the same cookie at a glance.
        color: '#c0392b',
        colorLeft: '#2980b9', // blue
        colorRight: '#c0392b', // red
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
        colorLeft: '#f1c40f', // yellow
        colorRight: '#2ecc71', // green
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
    },
    orangelemon: {
        name: '오렌지 레몬맛 쿠키',
        shortName: '오렌지레몬', // shown on the lobby's character-select button
        color: '#f39c12',
        colorLeft: '#e67e22', // orange
        colorRight: '#f1c40f', // yellow
        grade: '에이션트',
        element: '빛',
        role: '대미지 딜러',
        health: 130,
        combatPower: 500, // starting value for every character
        speed: 2,
        // 짜릿한 주먹: alternates right/left punches, each swing dealing a
        // different amount. Uses the same straight-line corridor as melee_kick.
        attackType: 'alternating_punch',
        attackRange: 90,
        attackWidth: 40,
        attackDamageRight: 7,
        attackDamageLeft: 8,
        attackCooldown: 500,
        skillType: 'kick', // 발차기: directional hit, no AoE/stun -- also what awakening auto-throws
        skillRange: 100,
        skillWidth: 45,
        skillDamage: 10,
        skillCooldown: 10000,
        // 각성: for ultimateDurationMs, the basic attack's cooldown drops to
        // ultimateRapidCooldown, and every ultimateAutoKickEvery-th attack
        // (counted fresh from the moment this activates) becomes the kick
        // instead of a punch.
        ultimateType: 'awakening_rapid',
        ultimateDurationMs: 10000,
        ultimateRapidCooldown: 100,
        ultimateAutoKickEvery: 3,
        ultimateCooldownMs: 30000
    },
    board: {
        name: '보드맛 쿠키',
        shortName: '보드', // shown on the lobby's character-select button
        color: '#3498db',
        colorLeft: '#f1c40f', // yellow
        colorRight: '#3498db', // blue
        grade: '희귀',
        element: '물',
        role: '탱커',
        health: 115,
        combatPower: 500, // starting value for every character
        speed: 2.5, // rides a board -- +0.5 over the baseline 2
        attackType: 'melee_kick', // board swing, same corridor mechanic
        attackRange: 90,
        attackWidth: 40,
        attackDamage: 2,
        attackCooldown: 500,
        // Passive: takes reduced damage from anything currently carrying an
        // element mark matching passiveResistElement (see damageReductionMultiplier).
        passiveResistElement: '물',
        passiveResistMultiplier: 0.9,
        skillType: 'self_heal',
        skillHealAmount: 10,
        skillCooldown: 10000,
        // Shields every teammate for ultimateShieldAmount -- absorbs that much
        // incoming damage before it touches HP, then breaks.
        ultimateType: 'team_shield',
        ultimateShieldAmount: 20,
        ultimateCooldownMs: 30000
    },
    lightning: {
        name: '번개전사맛 쿠키',
        shortName: '번개전사', // shown on the lobby's character-select button
        color: '#e74c3c',
        colorLeft: '#e67e22', // orange
        colorRight: '#e74c3c', // red
        grade: '레전더리',
        element: '빛',
        role: '대미지 딜러',
        health: 120,
        combatPower: 500, // starting value for every character
        speed: 2,
        // Shield + fire sword, as a two-hit combo. Stage 0 is a wide sweep with
        // only medium reach; stage 1 is a long, narrow thrust that opens
        // comboFollowupCooldown after the sweep instead of the full cooldown.
        attackType: 'combo_two_stage',
        attackStages: [
            { range: 100, width: 90, damage: 7 }, // sweep: long sideways, medium forward
            { range: 190, width: 40, damage: 4 }  // thrust: long forward
        ],
        attackCooldown: 500,
        comboFollowupCooldown: 200,
        // Passive: cheats death once per battle, coming back with this much of
        // its max health. The count resets every time a fight starts.
        passiveReviveCount: 1,
        passiveReviveHpRatio: 0.5,
        // Like guard_stance but it is NOT broken by attacking.
        skillType: 'shield_block',
        skillDurationMs: 5000,
        skillDamageMultiplier: 0.95, // incoming damage while blocking
        skillCooldown: 10000,
        // Placed like targeted_aoe. Damages, stuns, and then leaves whatever it
        // hit dealing reduced damage for a while.
        ultimateType: 'lightning_strike',
        ultimateRadius: 60,
        ultimateDamage: 15,
        ultimateStunMs: 2000,
        ultimateDamageDebuffMultiplier: 0.8,
        ultimateDebuffDurationMs: 10000,
        ultimateCooldownMs: 30000
    },
    lightninghell: {
        name: '번개지옥맛 쿠키',
        shortName: '번개지옥', // shown on the lobby's character-select button
        // Black/yellow, not purple/yellow: purple+yellow is 자색 고구마맛's
        // exact pair and the two cookies were hard to tell apart.
        color: '#1c1c22',
        colorLeft: '#1c1c22', // black
        colorRight: '#f1c40f', // yellow
        grade: '게스트',
        element: '어둠',
        role: '대미지 딜러',
        health: 140,
        combatPower: 500, // starting value for every character
        speed: 2,
        // 창 두 개: thrusts with the right-hand spear, then the left, then
        // repeats -- one spear per hand, never both at once. Same
        // straight-line corridor as melee_kick, but the corridor starts
        // attackSideOffset px off to that side of the body instead of dead
        // centre, so the two shots really do cover different ground.
        attackType: 'dual_spear',
        // "더 얇게 하고 약간 더 길게 1.4배 정도": 85 -> 119, corridor 40 -> 26.
        // The side offset stays at 22 so the two spears still visibly cover
        // different ground; dead centre is still reachable because the hit
        // test adds the target's radius (22 <= 26/2 + MONSTER_RADIUS).
        attackRange: 119, // "자두맛보다 살짝 더 긴 정도" -- kicker reaches 70
        attackWidth: 26,
        attackSideOffset: 22,
        attackDamage: 5,
        attackCooldown: 100,
        // Passive: comes back at FULL health once per battle, and the revive
        // itself blasts everything still standing -- a lone enemy loses
        // passiveReviveEnemySoloRatio of its current HP, a crowd loses
        // passiveReviveEnemyCrowdRatio each.
        passiveReviveCount: 1,
        passiveReviveHpRatio: 1,
        passiveReviveEnemySoloRatio: 0.3,
        passiveReviveEnemyCrowdRatio: 0.4,
        // 지진: shakes the whole floor, no aiming. Against a small group every
        // enemy takes skillDamage; against a bigger crowd the ground swallows
        // the nearest one outright instead.
        skillType: 'earthquake',
        skillDamage: 15,
        skillThresholdCount: 3,
        skillCooldown: 10000,
        // 죽지않는 영혼: heals for a share of max HP, then for ultimateDurationMs
        // moves faster and swaps in a stronger basic attack.
        ultimateType: 'undying_soul',
        ultimateHealRatio: 0.4,
        ultimateSpeedBonus: 1, // added to `speed`, not multiplied
        ultimateAttackDamage: 6, // replaces attackDamage while the buff is up
        ultimateDurationMs: 10000,
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

// ---- Guest raid ----
// Fought in a big SQUARE field rather than the boss raid's circle. The boss
// holds the far (top) edge and the party comes in from the bottom. Unlike the
// boss raid there is no boss list to pick from -- the first guest raid is
// always 번개지옥맛 쿠키 -- and you bring a party of GUEST_PARTY_SIZE cookies
// that you swap between mid-fight.
const GUEST_ARENA_HALF_W = 470;
const GUEST_ARENA_HALF_H = 330;
const GUEST_PARTY_SIZE = 4;

const GUEST_BOSS_DEFS = {
    guest1: {
        id: 'guest1',
        name: '번개지옥맛 쿠키',
        charType: 'lightninghell', // borrows that cookie's purple/yellow for the body
        maxHp: 500,
        radius: 46,
        recommendedPower: 2000, // for a full party of 4 combined
        homeY: -235, // sits at the back of the field
        skillIntervalMs: 1000, // picks a new skill every second it is idle
        patterns: {
            // 창 찌르기: telegraphs a red line, thrusts 0.3s later, five times over.
            spear_jab: {
                telegraphMs: 300,
                waves: 5,
                range: 560,
                width: 54,
                damage: 10
            },
            // 창 찍기: paints a 50px circle on the player, slams down 0.4s later
            // for 30, then LEAVES the spear stuck in the ground. The embedded
            // shaft is 30px across and burns anyone touching it for stuckDamage
            // a second. Six of them, one second apart; they all vanish when the
            // sixth is done.
            spear_drop: {
                telegraphMs: 400,
                markRadius: 50,
                damage: 30,
                waves: 6,
                waveIntervalMs: 1000,
                stuckRadius: 30,
                stuckDamage: 5,
                stuckTickMs: 1000
            },
            // 크게 베기: no red warning at all. If someone is close it sweeps its
            // own surroundings within 0.7s; if everyone is far it sweeps out
            // where they are within 0.6s.
            big_slash: {
                nearWindupMs: 700,
                farWindupMs: 600,
                nearThreshold: 230, // closer than this counts as 근처
                nearRadius: 215, // circle centred on the boss
                farRadius: 200, // circle centred on the player it picked
                damage: 20
            }
        },
        // ==================== 2차 레이드 ====================
        // Reached by taking the 1차 boss to 0: the floor gives way, you throw one
        // cookie away for good, and the same body comes back wreathed in a black
        // aura with 400hp and a completely different kit. Everything here
        // overrides the phase-1 fields of the same name; see guestDefFor().
        phase2: {
            maxHp: 400,
            skillIntervalMs: 5000,
            aura: true, // the black smoke the client draws around the body
            // Last stand: the first time it drops under 100 it throws up a 200
            // shield. Once only -- it can't keep buying itself another wall.
            desperationHpThreshold: 100,
            desperationShield: 200,
            patterns: {
                // 1. 부하 소환: summons ONE of the three squads at random and
                // the skill is over -- the adds stay until you clear them. It
                // won't pick this again while its last squad is still standing,
                // so the field can't silently fill up with 45 cakes.
                summon_minions: {
                    variants: [
                        { type: 'cake_slice', count: 15 },
                        { type: 'chocolate_cake_slice', count: 15 },
                        { type: 'laser_robot', count: 7 }
                    ],
                    telegraphMs: 600
                },
                // 2. 반갈라 베기 -> 레이저 -> 낙하물. One skill, three stages.
                half_sweep: {
                    telegraphMs: 300,
                    sweepDelayMs: 200,  // 예고 후 0.2초 뒤에 벤다
                    sideGapMs: 300,     // 오른쪽을 벤 뒤 왼쪽까지 0.3초
                    sweepDamage: 20,
                    sweepRange: 620,    // reaches the far side of the field
                    laserDurationMs: 3000,
                    laserTickMs: 500,
                    laserDamage: 3,
                    laserWidth: 44,
                    laserRange: 1100,
                    laserTrackSpeed: 90, // px/sec sideways -- slower than a cookie
                    fallCount: 5,
                    fallIntervalMs: 1000,
                    fallTelegraphMs: 300,
                    fallRadius: 60,
                    fallTickMs: 100,
                    fallDamage: 1 // per fallTickMs while you stand in one
                },
                // 3. 흑화: patches itself up and dulls everyone's damage. The
                // heal and the shield are permanent; only the damage cut runs
                // out (15s), and it refreshes rather than stacking.
                empower: {
                    telegraphMs: 400,
                    healAmount: 100,
                    shieldAmount: 50,
                    playerDamageMultiplier: 0.8,
                    durationMs: 15000
                },
                // 4. 창 던지기: ten thrown spears, one a second, and every one
                // that connects feeds the boss.
                spear_throw: {
                    count: 10,
                    intervalMs: 1000,
                    telegraphMs: 200,
                    radius: 30,
                    damage: 7,
                    healOnHit: 10
                },
                // 5. 총공격: spears rain across the whole field regardless of
                // where anyone is standing. The opening volley is the big one.
                barrage: {
                    waves: 5,
                    firstWaveCount: 20,
                    waveCount: 10,
                    waveMs: 1000,
                    size: 40, // width of one falling spear
                    damage: 3,
                    healOnHit: 5
                },
                // 6. 벽 가르기: a wall across the middle pens the party in on
                // their own half with a small squad. Clear it and the boss
                // throws spears (창던지기와 같은 수치) before the wall drops
                // and the skill ends.
                arena_split: {
                    telegraphMs: 500,
                    wallThickness: 18,
                    minions: [
                        { type: 'cake_slice', count: 5 },
                        { type: 'chocolate_cake_slice', count: 3 },
                        { type: 'laser_robot', count: 2 }
                    ],
                    spearCount: 5,
                    spearIntervalMs: 1000,
                    spearTelegraphMs: 200,
                    spearRadius: 30,
                    spearDamage: 7,
                    spearHealOnHit: 10
                }
            }
        }
    }
};

// The definition in force right now: phase 2 overrides maxHp/skillIntervalMs/
// patterns while keeping the shared body fields (radius, homeY, charType).
function guestDefFor(room) {
    const base = GUEST_BOSS_DEFS[room.guestId];
    if (!base) return null;
    return room.phase === 2 && base.phase2 ? { ...base, ...base.phase2 } : base;
}

const MONSTER_RADIUS = 16;
const STAR_RADIUS = 30;
const PROJECTILE_RADIUS = 6; // arrow hitbox; see projectileSpeed on MONSTERS
const PROJECTILE_MAX_LIFETIME_MS = 4000; // despawn stray arrows that never connect

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
    },
    // A laser turret. It never moves; instead it holds a beam on the player for
    // laserDurationMs, burning laserDamage every laserTickMs. The beam swings
    // toward the player, but its tip can only sweep laserTrackSpeed px/sec
    // sideways -- well under a cookie's own ~120 px/sec -- so running always
    // gets you out of it.
    laser_robot: {
        name: '레이저 로봇',
        color: '#95a5a6',
        health: 80,
        speed: 0, // a turret: holds its ground instead of kiting
        aggroRange: 620,
        preferredDistance: 0, // unused at speed 0; kept for a uniform shape
        attackRange: 620,
        attackCooldown: 3000,
        telegraphMs: 400,
        laser: true,
        laserDurationMs: 500,
        laserDamage: 2,
        laserTickMs: 100, // 2 damage per 0.1s => 10 over the full 0.5s
        laserRange: 620,
        laserWidth: 26,
        laserTrackSpeed: 80 // px/sec the beam's tip can chase sideways
    },
    // A backline archer: hangs back at range and pokes for less, but has very
    // little health of its own -- meant to be mixed in behind cake_slices.
    chocolate_cake_slice: {
        name: '초콜릿 케이크 조각',
        color: '#6b4226',
        health: 20,
        speed: 2,
        aggroRange: 500,
        preferredDistance: 220, // hangs back rather than closing to melee range
        // Fires a real arrow instead of applying damage instantly: it is aimed
        // at wherever the player stood when it was released, so sidestepping
        // after the shot dodges it. Any monster given projectileSpeed shoots
        // this way; monsters without it keep the instant-hit behaviour.
        projectileSpeed: 380, // px per second
        attackRange: 280,
        attackDamage: 2,
        attackCooldown: 3000,
        telegraphMs: 500
    }
};

// Which way a floor's bridge runs. Floors 1-2 stretch leftward along -x; floor
// 3 stretches upward along -y. Everything that has to reason about "how far
// along the bridge" vs "how far off the centreline" goes through these, so a
// new direction is a data change rather than another branch in every clamp.
// `along` travels the level's length (0 at the start, -levelLength at the far
// end); `across` is confined to +-laneHalfWidth.
const LEVEL_START_SLACK = 40; // how far back behind the start line you may stand

function floorAxis(floorDef) {
    return floorDef && floorDef.axis === 'y' ? 'y' : 'x';
}
function alongOf(floorDef, x, y) {
    return floorAxis(floorDef) === 'y' ? y : x;
}
function acrossOf(floorDef, x, y) {
    return floorAxis(floorDef) === 'y' ? x : y;
}
function fromAlongAcross(floorDef, along, across) {
    return floorAxis(floorDef) === 'y' ? { x: across, y: along } : { x: along, y: across };
}
function clampToLane(floorDef, x, y) {
    const along = Math.max(-floorDef.levelLength, Math.min(LEVEL_START_SLACK, alongOf(floorDef, x, y)));
    const across = Math.max(-floorDef.laneHalfWidth, Math.min(floorDef.laneHalfWidth, acrossOf(floorDef, x, y)));
    return fromAlongAcross(floorDef, along, across);
}

// Story-mode floor layouts. Each floor is a bridge stretching away from the
// start (0,0) along its `axis` (see the helpers above). A floor is split into
// one or more sequential "rooms" (see `gates`); monsters are tagged with the
// room they belong to (`room`, default 0). While any monster in a room is still
// alive, an energy shield seals that room's `entrance`/`exit` -- both given as
// along-axis positions (see server's storyPlayerMove handler) -- so the player
// can't retreat or advance past it. The star sits just past the last gate --
// attacking it clears the floor.
const STORY_FLOOR_DEFS = {
    1: {
        levelType: 'bridge',
        levelLength: 1750, // how far the bridge extends to the left of the start
        laneHalfWidth: 70, // how far off the y=0 centerline the player can wander
        recommendedPower: 500, // shown on the tower's floor-select screen
        gates: [
            { entrance: -900, exit: -1500, room: 0 }
        ],
        monsters: [
            { type: 'cake_slice', x: -1050, y: -35, room: 0 },
            { type: 'cake_slice', x: -1050, y: 35, room: 0 },
            { type: 'cake_slice', x: -1200, y: 0, room: 0 },
            { type: 'cake_slice', x: -1350, y: -35, room: 0 },
            { type: 'cake_slice', x: -1350, y: 35, room: 0 }
        ],
        star: { x: -1620, y: 0 } // right past the exit gate, no long walk after clearing
    },
    // Two rooms back to back: a mixed front-line/archer room, then a bend in
    // the bridge into a second room packed with 10 archers. Both are cleared
    // in sequence before the star (see the `gates` array -- room 1's entrance
    // is room 0's exit, so the shield only ever blocks the room you're in).
    2: {
        levelType: 'bridge',
        levelLength: 2600,
        laneHalfWidth: 70,
        recommendedPower: 600,
        gates: [
            { entrance: -700, exit: -1150, room: 0 },
            { entrance: -1150, exit: -2450, room: 1 }
        ],
        monsters: [
            // Room 0: 3 cake_slices up front, a chocolate archer behind them.
            { type: 'cake_slice', x: -850, y: -35, room: 0 },
            { type: 'cake_slice', x: -850, y: 0, room: 0 },
            { type: 'cake_slice', x: -850, y: 35, room: 0 },
            { type: 'chocolate_cake_slice', x: -1050, y: 0, room: 0 },
            // Room 1: 10 chocolate archers.
            { type: 'chocolate_cake_slice', x: -1750, y: -50, room: 1 },
            { type: 'chocolate_cake_slice', x: -1750, y: -15, room: 1 },
            { type: 'chocolate_cake_slice', x: -1750, y: 15, room: 1 },
            { type: 'chocolate_cake_slice', x: -1750, y: 50, room: 1 },
            { type: 'chocolate_cake_slice', x: -1950, y: -60, room: 1 },
            { type: 'chocolate_cake_slice', x: -1950, y: -20, room: 1 },
            { type: 'chocolate_cake_slice', x: -1950, y: 20, room: 1 },
            { type: 'chocolate_cake_slice', x: -1950, y: 60, room: 1 },
            { type: 'chocolate_cake_slice', x: -2150, y: -30, room: 1 },
            { type: 'chocolate_cake_slice', x: -2150, y: 30, room: 1 }
        ],
        star: { x: -2570, y: 0 }
    },
    // The first floor whose bridge runs UPWARD (axis: 'y') instead of leftward,
    // so `along` is y and `across` is x. Room 0 is a wall of 10 cake slices;
    // room 1 is three stationary laser turrets.
    3: {
        levelType: 'bridge',
        axis: 'y',
        levelLength: 2600,
        laneHalfWidth: 70,
        recommendedPower: 700,
        gates: [
            { entrance: -700, exit: -1450, room: 0 },
            { entrance: -1450, exit: -2350, room: 1 }
        ],
        monsters: [
            // Room 0: 10 cake slices waiting up the bridge (x = across, y = along).
            { type: 'cake_slice', x: -45, y: -850, room: 0 },
            { type: 'cake_slice', x: 0, y: -850, room: 0 },
            { type: 'cake_slice', x: 45, y: -850, room: 0 },
            { type: 'cake_slice', x: -30, y: -1000, room: 0 },
            { type: 'cake_slice', x: 30, y: -1000, room: 0 },
            { type: 'cake_slice', x: -50, y: -1150, room: 0 },
            { type: 'cake_slice', x: -17, y: -1150, room: 0 },
            { type: 'cake_slice', x: 17, y: -1150, room: 0 },
            { type: 'cake_slice', x: 50, y: -1150, room: 0 },
            { type: 'cake_slice', x: 0, y: -1300, room: 0 },
            // Room 1: three laser robots.
            { type: 'laser_robot', x: -50, y: -1800, room: 1 },
            { type: 'laser_robot', x: 50, y: -1900, room: 1 },
            { type: 'laser_robot', x: 0, y: -2050, room: 1 }
        ],
        star: { x: 0, y: -2500 }
    }
};

// Gacha. A pull first decides soul stone vs. cookie: GACHA_SOUL_STONE_RATE of
// pulls give a soul stone, and the remainder is a cookie whose grade is drawn
// from GACHA_GRADE_WEIGHTS. Those weights are percentages *within* that
// remainder (they sum to 100), so a grade's true rate is
// weight% * (1 - GACHA_SOUL_STONE_RATE) -- e.g. 일반 = 50% * 70% = 35%.
// One flat table over every possible outcome of a normal-banner pull: the soul
// stone entry plus one entry per cookie grade. Values are absolute percentages
// and sum to 100, so a grade's listed number IS its real pull rate.
const GACHA_SOUL_STONE_KEY = '영혼석';
const GACHA_TABLE = {
    '영혼석': 70,
    '일반': 16,
    '희귀': 10,
    '에픽': 2.5,
    '레전더리': 1,
    '에이션트': 0.3,
    '비스트': 0.15,
    '게스트': 0.05
};
// Soul stones are tracked per cookie -- this many of one cookie's stones unlocks it.
const SOUL_STONES_PER_CHARACTER = 30;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ARENA_RADIUS, BOSS_RADIUS, PLAYER_RADIUS, CHARACTERS, BOSS_DEFS, BOSS_LIST, MONSTER_RADIUS, STAR_RADIUS, PROJECTILE_RADIUS, PROJECTILE_MAX_LIFETIME_MS, MONSTERS, STORY_FLOOR_DEFS, GACHA_SOUL_STONE_KEY, GACHA_TABLE, SOUL_STONES_PER_CHARACTER, GUEST_ARENA_HALF_W, GUEST_ARENA_HALF_H, GUEST_PARTY_SIZE, GUEST_BOSS_DEFS, guestDefFor, LEVEL_START_SLACK, floorAxis, alongOf, acrossOf, fromAlongAcross, clampToLane };
} else {
    window.SHARED = { ARENA_RADIUS, BOSS_RADIUS, PLAYER_RADIUS, CHARACTERS, BOSS_DEFS, BOSS_LIST, MONSTER_RADIUS, STAR_RADIUS, PROJECTILE_RADIUS, PROJECTILE_MAX_LIFETIME_MS, MONSTERS, STORY_FLOOR_DEFS, GACHA_SOUL_STONE_KEY, GACHA_TABLE, SOUL_STONES_PER_CHARACTER, GUEST_ARENA_HALF_W, GUEST_ARENA_HALF_H, GUEST_PARTY_SIZE, GUEST_BOSS_DEFS, guestDefFor, LEVEL_START_SLACK, floorAxis, alongOf, acrossOf, fromAlongAcross, clampToLane };
}
