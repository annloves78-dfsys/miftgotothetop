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
    // 몸이 두 개다: 기본은 상체, 특수스킬로 하체와 서로 오간다. 두 몸은
    // 체력을 각각 따로 들고 있어서(80 + 50, 합쳐서 130인 것이나 마찬가지)
    // 나갔다 들어오면 지금 안 나온 쪽 체력 그대로 다시 나온다. 궁극기(합체)는
    // 10초 동안 둘을 하나로 합쳐서 체력이 더해지고 공격력이 6이 되며, 풀리면
    // 다시 상체·풀피로 돌아온다.
    electriccord: {
        name: '전기줄맛 쿠키',
        shortName: '전기줄', // shown on the lobby's character-select button
        color: '#3ec1e0',
        colorLeft: '#3ec1e0', // 하늘색 (상체)
        colorRight: '#8b0000', // 찐한 빨강 (하체)
        grade: '희귀',
        element: '물',
        role: '대미지 딜러',
        // health는 상체 기준(join 시 기본값)과 같아야 한다 -- 처음 들어올 때는
        // 늘 상체다.
        health: 80,
        upperHealth: 80,
        upperAttackDamage: 4,
        lowerHealth: 50,
        lowerAttackDamage: 6,
        speed: 2,
        attackType: 'melee_kick',
        attackRange: 100,
        attackWidth: 36,
        attackDamage: 4, // = upperAttackDamage. 실제 전투 피해는 effectiveAttackDamage가 몸 상태를 보고 정한다
        attackCooldown: 500,
        // 특수스킬: 상체 <-> 하체 변신. 피해도 표식도 없다. 합체 중에는 쓸 수 없다.
        skillType: 'body_swap',
        skillCooldown: 8000,
        // 궁극기: 합체. 10초 동안 상체+하체 체력을 하나로 합치고 공격력이 6이 된다.
        ultimateType: 'body_fuse',
        ultimateDurationMs: 10000,
        ultimateAttackDamage: 6,
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
    // 레전더리 이벤트 한정. The first cookie that fights at range: it
    // throws a drop rather than swinging, and everything it does is in service
    // of 물 속성부여 -- see applyElementMark for how a 물 mark and a 바람 mark
    // refuse to overwrite each other.
    waterdrop: {
        name: '물방울맛 쿠키',
        shortName: '물방울', // shown on the lobby's character-select button
        color: '#3498db',
        colorLeft: '#1f6fb2', // blue
        colorRight: '#7fd4f5', // sky
        grade: '레전더리',
        element: '물',
        role: '스트라이커',
        // 레전더리 뽑기로만 얻는다: excluded from the starting roster, unlike every
        // other cookie so far. Also keeps it out of play until its abilities
        // below are actually implemented server-side.
        seasonLimited: true,
        health: 100,
        speed: 2,
        // 물방울 던지기: a real projectile, so it travels and can miss.
        attackType: 'throw_projectile',
        attackProjectileRadius: 10, // the drop is 20px across
        attackProjectileSpeed: 460, // px per second
        attackRange: 520, // how far the drop flies before it fizzles
        attackDamage: 3,
        attackCooldown: 500,
        // 물방울 터트리기: pick a spot (aims like a targeted ultimate), and
        // everything inside gets 물 속성부여. No damage of its own.
        skillType: 'mark_burst',
        skillRadius: 40,
        skillMarkUses: 3,
        skillMarkMultiplier: 1.3,
        skillCooldown: 10000,
        // 폭포: pick a spot; whatever it lands on is marked for 10 seconds with
        // no charge limit ("개수 상관없이").
        ultimateType: 'mark_flood',
        ultimateRadius: 110,
        ultimateMarkDurationMs: 10000,
        ultimateMarkMultiplier: 1.3,
        ultimateCooldownMs: 30000
    },
    // 레전더리 이벤트 한정, 불 갈래. Hits for very little up front and lets the
    // burn do the work; both of its abilities exist to hand out 불 속성부여.
    magma: {
        name: '마그마맛 쿠키',
        shortName: '마그마', // shown on the lobby's character-select button
        // 빨강 + 핑크. Deliberately a darker red and a hotter pink than
        // 자두맛's soft pink/red, which is the same pair of colours.
        color: '#c0392b',
        colorLeft: '#a93226', // deep red
        colorRight: '#ff2d78', // hot pink
        grade: '레전더리',
        element: '불',
        role: '스트라이커',
        seasonLimited: true,
        health: 90,
        speed: 2,
        // 용암창: a straight thrust in front, same corridor mechanic as the
        // other melee cookies -- just long and thin.
        attackType: 'melee_kick',
        attackRange: 140,
        attackWidth: 32,
        attackDamage: 2,
        attackCooldown: 500,
        // 불 데미지 5: 1 a second, five times. Like 화산맛's burn, this is
        // deliberately NOT part of the damage number the hit displays.
        attackBurnDamage: 1,
        attackBurnTicks: 5,
        attackBurnIntervalMs: 1000,
        // 땅파기: pick a spot and come up there. Anything within skillRadius of
        // where it surfaces takes 불 속성부여 x3. No damage of its own.
        skillType: 'burrow_mark',
        skillRadius: 150,
        skillMarkUses: 3,
        skillMarkMultiplier: 1.3,
        skillCooldown: 10000,
        // 마그마 쏟기: pick a spot, 10 damage, and a 15-second 불 mark with no
        // charge limit.
        ultimateType: 'magma_pour',
        ultimateRadius: 90,
        ultimateDamage: 10,
        ultimateMarkDurationMs: 15000,
        ultimateMarkMultiplier: 1.3,
        ultimateCooldownMs: 30000
    },
    // 핑크 계열이 여럿이라 각자 다른 분홍을 쓴다: 자두맛은 연분홍, 마그마맛은
    // 진분홍, 아래 셋은 서로 다른 짝 색으로 구분된다.
    blacksugar: {
        name: '블랙 슈거맛 쿠키',
        shortName: '블랙슈거',
        color: '#141218',
        colorLeft: '#ff4f9a', // pink
        colorRight: '#141218', // black
        grade: '비스트',
        element: '어둠',
        role: '탱커',
        health: 200,
        speed: 2,
        attackType: 'melee_kick', // 초록 막대: wide, short swing
        attackRange: 110,
        attackWidth: 44,
        attackDamage: 5,
        attackCooldown: 500,
        // Always on, unlike guard_stance -- there is no window to time.
        passiveDamageMultiplier: 0.8,
        // 적 끌어들이기: anything that can walk gets dragged to the cookie;
        // anything rooted in place (turrets, a fixed boss) takes skillDamage
        // instead, since there is no dragging it anywhere.
        skillType: 'pull_in',
        skillRange: 260,
        skillDamage: 20,
        skillCooldown: 10000,
        ultimateType: 'guard_surge', // 보호막 + 즉시 회복, 자기 자신에게
        ultimateShieldAmount: 70,
        ultimateHealAmount: 20,
        ultimateCooldownMs: 30000
    },
    dragonfruit: {
        name: '용과맛 쿠키',
        shortName: '용과',
        color: '#e0498a',
        colorLeft: '#ff7ab6', // pink
        colorRight: '#2ecc71', // green
        grade: '에이션트',
        element: '불',
        role: '힐러',
        health: 100,
        speed: 2,
        attackType: 'melee_kick', // 용과풀
        attackRange: 130,
        attackWidth: 34,
        attackDamage: 2,
        attackCooldown: 500,
        // 화염 데미지 2, spread over two ticks like every other burn here.
        attackBurnDamage: 1,
        attackBurnTicks: 2,
        attackBurnIntervalMs: 1000,
        attackHealOnUse: 1, // 패시브: every landed hit heals the team 1
        skillType: 'wide_slash', // 크게베기: a broad forward arc that heals on contact
        skillRange: 190,
        skillWidth: 120,
        skillDamage: 5,
        skillHealOnHit: 15,
        skillCooldown: 10000,
        ultimateType: 'team_guard', // 보호: % heal + a flat shield for everyone
        ultimateHealRatio: 0.25,
        ultimateShieldAmount: 40,
        ultimateCooldownMs: 30000
    },
    sugarfly: {
        name: '슈가 플라이맛 쿠키',
        shortName: '슈가플라이',
        color: '#ff69b4',
        colorLeft: '#ffa6cf', // pink
        colorRight: '#3498db', // blue
        grade: '에픽',
        element: '바람',
        role: '대미지 딜러',
        health: 100,
        speed: 2,
        attackType: 'melee_kick', // 설탕팔 밀치기
        attackRange: 100,
        attackWidth: 40,
        attackDamage: 5,
        attackCooldown: 500,
        // 패시브: every fifth landed hit heals the cookie itself.
        attackHealEveryHits: 5,
        attackHealSelf: 2,
        skillType: 'charge_dash', // 돌진: close the gap fast, hit hard, run hot after
        skillRange: 300,
        skillWidth: 46,
        skillDamage: 13,
        skillSpeedBonus: 1,
        skillSpeedDurationMs: 3000,
        skillCooldown: 10000,
        // 나비모드: a TOGGLE, not a timer. It runs until switched off, eating
        // ultimateSelfDamage every ultimateSelfDamageIntervalMs, and the 30s
        // cooldown only starts counting once it is switched off.
        ultimateType: 'butterfly_mode',
        ultimateSpeedBonus: 1.3,
        ultimateAttackDamage: 8,
        ultimateSelfDamage: 1,
        ultimateSelfDamageIntervalMs: 2000,
        ultimateCooldownMs: 30000
    },
    // 비스트 등급의 빛 속성 딜러. 죽어도 한 번 일어나고, 각성 장비를 끼면
    // 한 번 더 일어나며 그 두 번째 부활에서 각성해 수치가 통째로 바뀜다.
    lightningdevil: {
        name: '번개악마맛 쿠키',
        shortName: '번개악마',
        color: '#e67e22',
        colorLeft: '#e67e22', // 주황
        colorRight: '#4a1d7a', // 진한 보라
        grade: '비스트',
        element: '빛',
        role: '대미지 딜러',
        health: 130,
        speed: 2,
        // 보라빛 대검: 모든 베기가 흡혈 베기다. 차례는 세지 않지만, 빨아오는
        // 것은 그 베기로 적을 쓰러뜨렸을 때뿐이다.
        attackType: 'vampire_slash',
        attackRange: 175,
        attackWidth: 80,
        attackDamage: 8,
        attackCooldown: 300,
        attackVampireRange: 175,
        attackVampireWidth: 80,
        attackVampireHealRatio: 0.1, // 쓰러뜨렸을 때만 최대 체력의 10%
        // 패시브 1: 적중할 때마다 확률적으로 큰 회복이 터진다.
        passiveHitHealChance: 0.2,
        passiveHitHealRatio: 0.25,
        // 패시브 2: 쓰러져도 한 번은 반드시 일어난다. 각성 장비(붉은 번개
        // 모자)를 끼면 한 번이 더 생기고, 그 두 번째 부활이 각성이 된다.
        passiveReviveCount: 1,
        passiveReviveHpRatio: 0.5,
        awakenOnReviveNo: 2,
        // 순간이동: 때파기처럼 자리를 찍어서 그 자리로 간다. 표식은 남기지
        // 않고, 이동하면서 자기 체력만 채운다. skillRadius는 표식 반경이
        // 아니라 모바일에서 자리를 안 찍었을 때 앞으로 나가는 거리다.
        skillType: 'blink_heal',
        skillRadius: 90,
        skillHealRatio: 0.1,
        skillCooldown: 10000,
        // 크게베기: 0.3초 예열 뒤에 엄청 큰 반공간을 벤다.
        ultimateType: 'great_slash',
        ultimateWindupMs: 300,
        ultimateRange: 320,
        ultimateWidth: 200,
        ultimateDamage: 50,
        ultimateHealRatio: 0.1,
        ultimateSpeedBonus: 0.5,
        ultimateSpeedDurationMs: 10000,
        ultimateCooldownMs: 30000,
        // 각성 형태. 여기 적힌 것만 덮어쓴다.
        awakenedForm: {
            health: 150,
            attackDamage: 12,
            skillHealRatio: 0.2,
            ultimateDamage: 70
        }
    },
    // 바다펄맛 쿠키는 이 게임에서 유일하게 궁극기 칸이 비어 있다. 특수스킬
    // 자리에 있는 '밀물'이 곧 궁극기이고, 쓸 때마다 1 -> 2 -> 3 -> 4단계로
    // 올라갔다가 다시 1로 돌아간다.
    seapearl: {
        name: '바다펄맛 쿠키',
        shortName: '바다펄',
        color: '#1b4f8a',
        colorLeft: '#2e86de', // 파랑
        colorRight: '#12161c', // 검정
        grade: '비스트',
        element: '물',
        role: '힐러',
        health: 150,
        speed: 2,
        // 주먹으로 짧게 지른다. 날아가지 않는 근접 판정이다.
        attackType: 'melee_kick',
        attackRange: 80,
        attackWidth: 34,
        attackDamage: 5,
        attackCooldown: 300,
        // 패시브: 체력이 lowHpAt 아래로 떨어지면 켜지고, 체력이 다시 꽉 찰
        // 때까지 유지된다. 켜져 있는 동안 주먹이 약해지는 대신 때릴 때마다
        // 스스로 회복한다. 몇 번이든 다시 켜진다.
        lowHpAt: 60,
        lowHpAttackDamage: 2,
        lowHpAttackHealSelf: 2,
        // 밀물: 특수스킬 자리에 있지만 실제로는 궁극기다. 쿨타임 15초는
        // 일부러 짧게 잡은 값이다 (유누가 "실수 아님"이라고 못 박았다).
        // 예열 시간은 쿨타임에 들어가지 않는다 -- 물결이 터진 순간부터 15초를
        // 센다. 2단계부터는 자리를 찍어서 쓴다.
        skillType: 'tide_cycle',
        skillCooldown: 15000,
        skillRadius: 70, // 2단계부터 찍는 자리의 크기. 좁게 -- 정확히 찍어야 한다
        // damageRatio는 '맞은 적이 지금 가진 체력'의 비율, healRatio는
        // '받는 쿠키의 최대 체력'의 비율이다.
        skillStages: [
            { windupMs: 0, healRatio: 0.1, shieldAmount: 20 },
            { windupMs: 1000, damageRatio: 0.2, healRatio: 0.25, shieldAmount: 30 },
            { windupMs: 3000, damageRatio: 0.3, healRatio: 0.5, shieldAmount: 70 },
            // 4단계는 2·3단계를 둘 다 맞혔을 때만 나온다. 하나라도 빗나가면
            // 곧바로 1단계로 되돌아간다 (advanceTideStage 참고).
            { windupMs: 5000, damageRatio: 0.4, healRatio: 0.8, shieldAmount: 100 }
        ],
        // 궁극기 칸은 비어 있다.
        ultimateType: null
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
        ultimateHealRatio: 0.5,
        ultimateSpeedBonus: 1, // added to `speed`, not multiplied
        ultimateAttackDamage: 7, // replaces attackDamage while the buff is up
        // 궁극기를 쓰면 부하가 같이 나온다. 부하는 가장 가까운 적에게 걸어가
        // 스스로 때리고, 궁극기가 끝나면 사라진다. 맞으면 죽기도 한다.
        ultimateSummonCount: 4,
        ultimateSummon: {
            name: '번개 부하',
            color: '#f1c40f',
            health: 30,
            speed: 1.4,
            attackDamage: 2,
            attackCooldown: 300, // 공속 0.3초
            attackRange: 110
        },
        ultimateDurationMs: 10000,
        ultimateCooldownMs: 30000
    },
    // 게스트 둘째. 혼자서는 거의 아무 것도 못 깎는다 -- 주먹이 1이다. 대신
    // 때릴 때마다 빛 표식을 쌓아 두는 쿠키라서, 같은 빛 속성 쿠키(오렌지
    // 레몬맛 · 번개악마맛 · 자색 고구마맛)와 같이 나가면 그 표식이 전부
    // 그쪽의 피해로 돌아간다. 표식 규칙은 물방울맛/마그마맛의 것과 같다.
    cheesedumpling: {
        name: '치즈만두맛 쿠키',
        shortName: '치즈만두', // shown on the lobby's character-select button
        color: '#f4d03f',
        colorLeft: '#f4d03f', // 노랑
        colorRight: '#27ae60', // 초록
        grade: '게스트',
        element: '빛',
        role: '스트라이커',
        // 이 게임에서 가장 두꺼운 쿠키다. 피해가 1뿐이라 맞고 버티는 것이 곧
        // 역할이고, 쓰러져도 각성으로 한 번 더 일어난다.
        health: 400,
        speed: 2,
        // 주먹. 짧고 좁게, 대신 빠르게 지른다 -- 한 대의 피해보다 몇 번
        // 때리느냐가 중요한 쿠키다 (때린 횟수만큼 표식이 쌓이므로).
        attackType: 'melee_kick',
        attackRange: 90,
        attackWidth: 40,
        attackDamage: 2,
        attackCooldown: 250,
        // 패시브 1: 기본공격이 적중할 때마다 빛 표식이 attackMarkUses번 쌓인다.
        // 각성하면 awakenedForm이 이 값을 0으로 덮어써서 더는 주지 않는다.
        attackMarkUses: 2,
        attackMarkMultiplier: 1.5,
        // 표식을 쌓는 쿠키라서 자기가 박은 표식은 자기가 먹지 않는다. 안 그러면
        // 때릴 때마다 스스로 한 개씩 까먹어서 쌓이는 속도가 반토막 난다.
        // 각성하면 반대로 '먹는 쪽'이 되므로 awakenedForm에서 뒤집힌다.
        keepsOwnMarks: true,
        // 패시브 2: 쓰러지면 그 자리에서 각성한다. 부활이 곧 각성이라
        // awakenOnReviveNo가 1이다 (번개악마맛은 2번째 부활에서 각성한다).
        passiveReviveCount: 1,
        passiveReviveHpRatio: 1,
        awakenOnReviveNo: 1,
        // 만두 주먹: 앞을 한 대 치면서 빛 표식을 10개 박고, 그 자리에서
        // 쌓여 있던 표식을 전부 터뜨린다. 쌓는 것은 주먹, 터뜨리는 것은
        // 이쪽 -- 그래서 혼자 나가도 쌓아 둔 것이 피해로 돌아온다.
        // 표식이 하나도 없어도 방금 박은 10개는 터지므로 최소 50이다.
        skillType: 'mark_punch',
        skillRange: 90,
        skillWidth: 40,
        skillDamage: 2,
        skillMarkUses: 10,
        skillMarkMultiplier: 1.5,
        skillMarkBurstDamage: 5, // 표식 한 개당
        skillMarkBurstMax: 40, // 한 번에 터뜨릴 수 있는 표식 수 (궁극기 한 판 분량)
        skillCooldown: 10000,
        // 치즈만두 덩어리: 자리를 찍어 떨어뜨린다. 화산맛의 마그마 지대와 같은
        // 방식이지만, 1초마다 피해를 주면서 빛 표식도 같이 박는다.
        ultimateType: 'dumpling_zone',
        ultimateRadius: 100,
        ultimateZoneDamagePerTick: 2,
        ultimateZoneTickMs: 1000,
        ultimateZoneDurationMs: 10000,
        ultimateZoneMarkUses: 4,
        ultimateZoneMarkMultiplier: 1.5,
        ultimateCooldownMs: 30000,
        // 각성 형태. 여기 적힌 것만 덮어쓴다. 체력이 400에서 200으로 반토막
        // 나는 대신, 쌓는 쿠키에서 **거둬들이는** 쿠키로 뒤집힌다:
        // 표식을 더 이상 주지 않고(attackMarkUses 0), 자기 표식을 먹기
        // 시작하며(keepsOwnMarks false), 한 개 먹을 때마다 배수 대신
        // markEatBonus만큼을 더해서 터뜨린다. 그동안 쌓아 둔 것이 전부
        // 그 주먹으로 돌아온다.
        awakenedForm: {
            health: 200,
            attackDamage: 6,
            attackMarkUses: 0,
            keepsOwnMarks: false,
            markEatBonus: 5
        }
    },
    hellflavor: {
        name: '지옥맛 쿠키',
        shortName: '지옥',
        color: '#12081f',
        colorLeft: '#3d0a66', // 보라
        colorRight: '#0a0a0a', // 검정
        grade: '비스트',
        element: '어둠',
        role: '대미지 딜러',
        health: 230,
        speed: 2,
        // 검은도끼: 앞으로 한 번 크게 벤다. 다른 근접 무기들과 같은 직선 판정.
        attackType: 'melee_kick',
        attackRange: 100,
        attackWidth: 40,
        attackDamage: 10,
        attackCooldown: 500,
        // 패시브 1: 쓰러지면 딱 한 번, 풀피로 일어난다. 그 순간 반경
        // passiveReviveBlastRadius 안의 적에게 고정 데미지를 준다 (번개지옥맛과
        // 달리 상대 체력 비율이 아니라 그냥 숫자다).
        passiveReviveCount: 1,
        passiveReviveHpRatio: 1,
        passiveReviveBlastDamage: 30,
        passiveReviveBlastRadius: 90,
        // 패시브 2: 기본공격으로 적을 죽일 때마다 공격력 +1을 15초간 얻는다.
        // 스택 상한 없음 -- 죽인 만큼 계속 쌓인다.
        passiveKillAttackBuff: 1,
        passiveKillAttackBuffDurationMs: 15000,
        // 특수스킬: 자기 체력을 25%(전체 체력 기준) 채우고, 동시에 반경 안의
        // 적 전부에게 데미지를 준다. 조준 없이 즉시 발동.
        skillType: 'life_burst',
        skillRadius: 150,
        skillDamage: 10,
        skillHealRatio: 0.25,
        skillCooldown: 10000,
        // 궁극기: 지정한 위치로 날아올랐다가 떨어진다. 도약~착지까지
        // ultimateWindupMs가 걸리고, 착지 반경 안을 맞히면 공격력이 10초간
        // 오르고 최대 체력의 25%를 회복한다.
        ultimateType: 'sky_slam',
        ultimateRadius: 200,
        ultimateWindupMs: 1000,
        ultimateDamage: 60,
        ultimateHealRatioOnHit: 0.25,
        ultimateAttackBuff: 3,
        ultimateAttackBuffDurationMs: 10000,
        ultimateCooldownMs: 30000
    },
    flamefairy: {
        name: '불꽃요정맛 쿠키',
        shortName: '불꽃요정',
        color: '#8b1a1a',
        colorLeft: '#8b1a1a', // 찐한 빨강
        colorRight: '#e74c3c', // 그냥 빨강
        grade: '게스트',
        element: '불',
        role: '대미지 딜러',
        health: 200,
        speed: 2,
        // 불꽃 던지기: 물방울맛과 같은 투사체 매커니즘이지만 훨씬 빠르게 날아간다.
        attackType: 'throw_projectile',
        attackProjectileRadius: 15, // 물방울맛(10)의 1.5배
        attackProjectileSpeed: 700,
        attackRange: 500,
        attackDamage: 5,
        attackCooldown: 500,
        // 마그마맛처럼 화염 피해가 따로 붙는다: 1초마다 1번씩, 6초 동안.
        attackBurnDamage: 6,
        attackBurnTicks: 6,
        attackBurnIntervalMs: 1000,
        // 패시브: 전투당 두 번 부활한다(항상 풀피). 부활할 때마다 화염 피해가
        // 1씩 늘어서 6 -> 7(1차 부활) -> 8(2차 부활)이 된다.
        passiveReviveCount: 2,
        passiveReviveHpRatio: 1,
        passiveBurnGrowthPerRevive: 1,
        // 특수스킬: 방패로 막는다. 자신의 체력을 80(고정값) 채우고, 100짜리
        // 보호막을 씌운다. 팀 전체가 아니라 자기 자신만.
        skillType: 'self_guard_surge',
        skillHealAmount: 80,
        skillShieldAmount: 100,
        skillCooldown: 10000,
        // 궁극기: 번개악마맛의 크게베기처럼 조준 없이 지금 보고 있는 방향으로
        // 길고 큰 화염지대를 깐다. 15초 동안 유지되며, 안에 있는 적은 1초마다
        // 화염 피해를 입고, 자기 자신이 그 안에 있으면 1초마다 체력을 회복한다.
        // 그 지대 안에 있는 적을 공격하면(기본 공격) 화염 피해가 1 더 붙는다.
        ultimateType: 'fire_line_zone',
        ultimateRange: 450,
        ultimateWidth: 180,
        ultimateZoneDamagePerTick: 3,
        ultimateZoneTickMs: 1000,
        ultimateZoneDurationMs: 15000,
        ultimateZoneSelfHealPerTick: 8,
        ultimateZoneAttackBonusBurn: 1,
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
        // 몸에 닿아 있기만 해도 아프다. 패턴과 상관없이 0.1초마다 1씩.
        contact: { damage: 1, tickMs: 100 },
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

// ---- 스토리 타워 20층 보스: 가면광대 ----
// "보스 레이드" 목록(BOSS_LIST/boss3)과는 다른 존재다 -- 10층(케이크 보스)과
// 같은 방식으로, 스토리 20층의 다리 위에 놓인 몬스터 하나(MONSTERS.clown_boss,
// trickBoss:true)로 구현한다. 다만 이 보스만은 일반 몬스터 AI(추격+단발
// 공격)를 쓰지 않고, server.js의 tickClownBoss가 통째로 대신 돈다 -- 부채꼴
// 반전/9칸 격자/좌우 반쪽 갈라치기 같은 패턴은 플레이어 위치를 보스 기준
// 좌표(along/across)로 재는 것뿐이라 다리 폭만 넉넉하면(laneHalfWidth:300)
// 레인 이동 그대로도 표현된다.
const STORY_TOWER_BOSS_FLOOR = 20;
const STORY_TOWER_BOSS_MONSTER = 'clown_boss';
// "속임수"가 정체성인 보스. 체력 3500은 MONSTERS.clown_boss.health에 있다
// (스토리 몬스터는 항상 인원수와 무관한 고정 체력이라 따로 분기할 게 없다).
// 페이즈는 체력 구간으로 나뉘고, 페이즈마다 쓰는 패턴 조합과 패시브가 다르다.
// 패턴 하나하나의 수치도 페이즈마다 달라서(같은 패턴이 뒷페이즈에서 더
// 세짐), 패턴 정의 자체를 페이즈 키로 감싼 별도 표로 둔다.

// 색 언어는 전 패턴 공통: 빨강 = 정직(예고대로), 보라 = 속임수(예고와 반대).
const BOSS3_COLOR_HONEST = '#e74c3c';
const BOSS3_COLOR_TRICK = '#9b59b6';

const BOSS3_PATTERN_DEFS = {
    // 거짓 참격: 부채꼴(아레나의 2/5, 약 144도) 참격. reverseChance 확률로
    // "안이 위험" <-> "밖이 위험"이 뒤집히고, 그때만 보랏빛으로 표시된다.
    fake_slash: {
        p1: { telegraphMs: 500, damage: 10, reverseChance: 0.4, arcFraction: 2 / 5 },
        p2: { telegraphMs: 500, damage: 10, reverseChance: 0.4, arcFraction: 2 / 5 },
        p3: { telegraphMs: 300, damage: 118, reverseChance: 0.5, arcFraction: 2 / 5 }
    },
    // 헛것 베기: 보스 자체가 최대 maxDurationMs 동안 "진짜"/"가짜(보랏빛)"로
    // 계속 깜빡인다. 가짜로 보일 때 공격이 적중하면 그 공격은 무효, 공격자가
    // reflectDamage를 입고 패턴이 즉시 끝난다. 원래 설계는 "분신이 옆에 서는"
    // 것이었지만, 이 게임의 보스 판정이 항상 아레나 중앙 한 점 고정이라(다른
    // 위치에 별도로 때릴 수 있는 대상을 둘 수 없음) 같은 자리에서 겉모습만
    // 바뀌는 걸로 구현한다 -- "지금 진짜로 보이는가"를 읽는 게임이 된다.
    // fakeCount는 페이즈가 셀수록 가짜 판정 구간이 넓어지는 정도(가중치)로 쓴다.
    decoy_flicker: {
        p1: { maxDurationMs: 10000, reflectDamage: 20, fakeWeight: 1, flickerMs: 900 },
        p3: { maxDurationMs: 10000, reflectDamage: 25, fakeWeight: 2, flickerMs: 700 }
    },
    // 뒤바뀐 발걸음: 파티 전체 이동 반전 + 화면 보라색. 페이즈3부터는 지속
    // 데미지/보스 회복까지 붙는다.
    reverse_steps: {
        p1: { durationMs: 5000, dotDamagePerSec: 0, bossHealPerSec: 0 },
        p3: { durationMs: 7000, dotDamagePerSec: 2, bossHealPerSec: 3 }
    },
    // 아홉 칸: 아레나를 3x3(9칸)으로 나누고 그중 safeCellCount칸을 "안전"으로
    // 표시. 그 안에서 0~maxFakeCount개는 랜덤으로 가짜(더 찐하게 빛남) --
    // 표시 안 된 칸 + 가짜 칸에 있으면 피해.
    nine_cells: {
        p2: { telegraphMs: 5000, damage: 15, safeCellCount: 3, maxFakeCount: 2 },
        p3: { telegraphMs: 3000, damage: 20, safeCellCount: 3, maxFakeCount: 2 }
    },
    // 자취 감추기: 보스가 공중으로 사라져 좌/우 고정 축으로 연속 타격. 매
    // 타격마다 반쪽 중 하나만 진짜이고, 타격 hintMs 전에 어느 쪽인지 표시된다
    // (너무 짧아 사실상 운에 가깝다).
    vanish_strike: {
        p2: { hitCountMin: 4, hitCountMax: 5, intervalMs: 1000, hintMs: 300, damage: 10 },
        p3: { hitCountMin: 6, hitCountMax: 7, intervalMs: 700, hintMs: 200, damage: 15 }
    }
};

// 페이즈는 체력 하한선(minHp, 그 초과일 때 이 페이즈) 순서로 나열한다.
// 1페이즈 3500~2500 / 2페이즈 2500~1000 / 3페이즈(발악) 1000~0.
const BOSS3_PHASES = [
    {
        key: 'p1', minHp: 2500,
        patternKeys: ['fake_slash', 'decoy_flicker', 'reverse_steps'],
        patternIntervalMs: 3000,
        passive: null
    },
    {
        key: 'p2', minHp: 1000,
        patternKeys: ['fake_slash', 'nine_cells', 'vanish_strike'],
        patternIntervalMs: 3000,
        passive: { negateChance: 0.25, reflectDamage: 8, healOnHit: 10, regenPerSec: 0 }
    },
    {
        key: 'p3', minHp: 0,
        patternKeys: ['fake_slash', 'decoy_flicker', 'reverse_steps', 'nine_cells', 'vanish_strike'],
        patternIntervalMs: 2000,
        passive: { negateChance: 0.35, reflectDamage: 12, healOnHit: 15, regenPerSec: 2 }
    }
];

function boss3PhaseFor(hp) {
    for (const phase of BOSS3_PHASES) {
        if (hp > phase.minHp) return phase;
    }
    return BOSS3_PHASES[BOSS3_PHASES.length - 1];
}

function boss3PatternStat(patternName, phaseKey) {
    const byPhase = BOSS3_PATTERN_DEFS[patternName];
    return byPhase ? (byPhase[phaseKey] || byPhase.p1 || byPhase.p2) : null;
}

// ---- Guest raid ----
// Fought in a big SQUARE field rather than the boss raid's circle. The boss
// holds the far (top) edge and the party comes in from the bottom. Unlike the
// boss raid there is no boss list to pick from -- the first guest raid is
// always 번개지옥맛 쿠키 -- and you bring a party of GUEST_PARTY_SIZE cookies
// that you swap between mid-fight.
const GUEST_ARENA_HALF_W = 470;
const GUEST_ARENA_HALF_H = 330;
const GUEST_PARTY_SIZE = 4;

// The lobby's 이벤트 칸, laid out like the shop: categories down the left, the
// selected one's content on the right. Running a different event later is a
// data change here rather than new screens.
//
// 레전더리 이벤트: 물/불 두 갈래, 각각 직접 플레이하는 스테이지 사다리.
// A stage is an ordinary story-mode bridge (same shape as STORY_FLOOR_DEFS), so
// it runs on the story engine untouched -- see floorDefFor. First clear pays its
// tickets; clearing both ladders pays a bonus. Tickets are the only way into
// 레전더리 뽑기, and each side pays ITS OWN cookie's ticket -- 물 스테이지는
// 물방울맛 티켓, 불 스테이지는 화염맛 티켓 (see LEGENDARY_BANNERS).

const EVENT = {
    id: 'water_vs_fire',
    name: '레전더리 이벤트',
    icon: '🌊',
    period: '상시',
    // Each stage: { id, name, reward, def }. `id` doubles as the floor key the
    // story engine is entered with, so it must not collide with a floor number.
    // A stage unlocks when the one before it on the same side is cleared.
    stages: {
        water: {
            label: '💧 물',
            icon: '💧',
            ticketKey: 'ticketWaterdrop',
            stages: [
                {
                    id: 'ev_w1', name: '얕은 여울', reward: 1,
                    def: {
                        levelType: 'bridge', levelLength: 1500, laneHalfWidth: 70,
                        gates: [{ entrance: -800, exit: -1300, room: 0 }],
                        monsters: [
                            { type: 'water_drop', x: -950, y: -35, room: 0 },
                            { type: 'water_drop', x: -950, y: 35, room: 0 },
                            { type: 'water_drop', x: -1100, y: 0, room: 0 },
                            { type: 'water_drop', x: -1220, y: -35, room: 0 }
                        ],
                        star: { x: -1420, y: 0 }
                    }
                },
                {
                    id: 'ev_w2', name: '거센 물살', reward: 2,
                    def: {
                        levelType: 'bridge', levelLength: 1800, laneHalfWidth: 70,
                        gates: [{ entrance: -800, exit: -1600, room: 0 }],
                        monsters: [
                            { type: 'water_drop', x: -950, y: -40, room: 0 },
                            { type: 'water_drop', x: -950, y: 0, room: 0 },
                            { type: 'water_drop', x: -950, y: 40, room: 0 },
                            { type: 'water_drop', x: -1150, y: -25, room: 0 },
                            { type: 'water_drop', x: -1150, y: 25, room: 0 },
                            { type: 'water_cannon', x: -1400, y: -40, room: 0 },
                            { type: 'water_cannon', x: -1400, y: 40, room: 0 }
                        ],
                        star: { x: -1720, y: 0 }
                    }
                },
                {
                    // Two rooms: a melee wall, then a nest of 물대포 that has to be
                    // closed on while their shots are in the air.
                    id: 'ev_w3', name: '물대포 진지', reward: 2,
                    def: {
                        levelType: 'bridge', levelLength: 2300, laneHalfWidth: 70,
                        gates: [
                            { entrance: -700, exit: -1150, room: 0 },
                            { entrance: -1150, exit: -2150, room: 1 }
                        ],
                        monsters: [
                            { type: 'water_drop', x: -850, y: -35, room: 0 },
                            { type: 'water_drop', x: -850, y: 35, room: 0 },
                            { type: 'water_drop', x: -1000, y: -35, room: 0 },
                            { type: 'water_drop', x: -1000, y: 35, room: 0 },
                            { type: 'water_cannon', x: -1500, y: -50, room: 1 },
                            { type: 'water_cannon', x: -1500, y: 0, room: 1 },
                            { type: 'water_cannon', x: -1500, y: 50, room: 1 },
                            { type: 'water_cannon', x: -1750, y: -30, room: 1 },
                            { type: 'water_cannon', x: -1750, y: 30, room: 1 },
                            { type: 'water_cannon', x: -1950, y: 0, room: 1 }
                        ],
                        star: { x: -2250, y: 0 }
                    }
                },
                {
                    id: 'ev_w4', name: '깊은 물', reward: 3,
                    def: {
                        levelType: 'bridge', levelLength: 2600, laneHalfWidth: 70,
                        gates: [
                            { entrance: -700, exit: -1350, room: 0 },
                            { entrance: -1350, exit: -2400, room: 1 }
                        ],
                        monsters: [
                            { type: 'water_drop', x: -850, y: -45, room: 0 },
                            { type: 'water_drop', x: -850, y: 0, room: 0 },
                            { type: 'water_drop', x: -850, y: 45, room: 0 },
                            { type: 'water_drop', x: -1000, y: -25, room: 0 },
                            { type: 'water_drop', x: -1000, y: 25, room: 0 },
                            { type: 'water_cannon', x: -1200, y: -40, room: 0 },
                            { type: 'water_cannon', x: -1200, y: 40, room: 0 },
                            { type: 'water_drop', x: -1600, y: -45, room: 1 },
                            { type: 'water_drop', x: -1600, y: 0, room: 1 },
                            { type: 'water_drop', x: -1600, y: 45, room: 1 },
                            { type: 'water_cannon', x: -1850, y: -50, room: 1 },
                            { type: 'water_cannon', x: -1850, y: 0, room: 1 },
                            { type: 'water_cannon', x: -1850, y: 50, room: 1 },
                            { type: 'water_cannon', x: -2100, y: -30, room: 1 },
                            { type: 'water_cannon', x: -2100, y: 30, room: 1 }
                        ],
                        star: { x: -2520, y: 0 }
                    }
                }
            ],
            // 4개를 다 깨야 열리는 보스. 유일하게 반복 도전이 되고, 깔 때마다
            // 티켓을 주므로 티켓을 무한히 모을 수 있다. (임시 보스 -- 진짜
            // 보스가 오면 이 def만 갈아끼우면 된다.)
            boss: {
                id: 'ev_wb', name: '물의 수호자', reward: 1, repeatable: true,
                def: {
                    levelType: 'bridge', levelLength: 1800, laneHalfWidth: 90,
                    gates: [{ entrance: -700, exit: -1600, room: 0 }],
                    monsters: [
                        { type: 'water_guardian', x: -1200, y: 0, room: 0 },
                        { type: 'water_cannon', x: -1000, y: -60, room: 0 },
                        { type: 'water_cannon', x: -1000, y: 60, room: 0 },
                        { type: 'water_drop', x: -900, y: -30, room: 0 },
                        { type: 'water_drop', x: -900, y: 30, room: 0 }
                    ],
                    star: { x: -1720, y: 0 }
                }
            }
        },
        fire: {
            label: '🔥 불',
            icon: '🔥',
            ticketKey: 'ticketMagma',
            stages: [
                {
                    id: 'ev_f1', name: '불씨', reward: 1,
                    def: {
                        levelType: 'bridge', levelLength: 1500, laneHalfWidth: 70,
                        gates: [{ entrance: -800, exit: -1300, room: 0 }],
                        monsters: [
                            { type: 'flame_slice', x: -950, y: -35, room: 0 },
                            { type: 'flame_slice', x: -950, y: 35, room: 0 },
                            { type: 'flame_slice', x: -1100, y: 0, room: 0 },
                            { type: 'flame_slice', x: -1220, y: -35, room: 0 },
                            { type: 'flame_slice', x: -1220, y: 35, room: 0 }
                        ],
                        star: { x: -1420, y: 0 }
                    }
                },
                {
                    id: 'ev_f2', name: '타오르는 다리', reward: 2,
                    def: {
                        levelType: 'bridge', levelLength: 1900, laneHalfWidth: 70,
                        gates: [{ entrance: -800, exit: -1700, room: 0 }],
                        monsters: [
                            { type: 'flame_slice', x: -950, y: -45, room: 0 },
                            { type: 'flame_slice', x: -950, y: 0, room: 0 },
                            { type: 'flame_slice', x: -950, y: 45, room: 0 },
                            { type: 'flame_slice', x: -1200, y: -30, room: 0 },
                            { type: 'flame_slice', x: -1200, y: 30, room: 0 },
                            { type: 'flame_slice', x: -1450, y: -45, room: 0 },
                            { type: 'flame_slice', x: -1450, y: 45, room: 0 }
                        ],
                        star: { x: -1820, y: 0 }
                    }
                },
                {
                    id: 'ev_f3', name: '화염 포탑', reward: 2,
                    def: {
                        levelType: 'bridge', levelLength: 2300, laneHalfWidth: 70,
                        gates: [
                            { entrance: -700, exit: -1150, room: 0 },
                            { entrance: -1150, exit: -2150, room: 1 }
                        ],
                        monsters: [
                            { type: 'flame_slice', x: -850, y: -35, room: 0 },
                            { type: 'flame_slice', x: -850, y: 35, room: 0 },
                            { type: 'flame_slice', x: -1000, y: -35, room: 0 },
                            { type: 'flame_slice', x: -1000, y: 35, room: 0 },
                            { type: 'flame_turret', x: -1500, y: -50, room: 1 },
                            { type: 'flame_turret', x: -1700, y: 50, room: 1 },
                            { type: 'flame_turret', x: -1900, y: 0, room: 1 }
                        ],
                        star: { x: -2250, y: 0 }
                    }
                },
                {
                    // Runs UPWARD like story floor 3, so the last stage of the
                    // event doesn't read as one more copy of the same bridge.
                    id: 'ev_f4', name: '불의 심장', reward: 3,
                    def: {
                        levelType: 'bridge', axis: 'y', levelLength: 2600, laneHalfWidth: 70,
                        gates: [
                            { entrance: -700, exit: -1400, room: 0 },
                            { entrance: -1400, exit: -2400, room: 1 }
                        ],
                        monsters: [
                            { type: 'flame_slice', x: -45, y: -850, room: 0 },
                            { type: 'flame_slice', x: 0, y: -850, room: 0 },
                            { type: 'flame_slice', x: 45, y: -850, room: 0 },
                            { type: 'flame_slice', x: -30, y: -1000, room: 0 },
                            { type: 'flame_slice', x: 30, y: -1000, room: 0 },
                            { type: 'flame_slice', x: -50, y: -1150, room: 0 },
                            { type: 'flame_slice', x: 0, y: -1150, room: 0 },
                            { type: 'flame_slice', x: 50, y: -1150, room: 0 },
                            { type: 'flame_turret', x: -50, y: -1700, room: 1 },
                            { type: 'flame_turret', x: 50, y: -1800, room: 1 },
                            { type: 'flame_slice', x: 0, y: -1900, room: 1 },
                            { type: 'flame_slice', x: -40, y: -2000, room: 1 },
                            { type: 'flame_turret', x: 40, y: -2050, room: 1 },
                            { type: 'flame_turret', x: 0, y: -2200, room: 1 }
                        ],
                        star: { x: 0, y: -2520 }
                    }
                }
            ],
            boss: {
                id: 'ev_fb', name: '불의 수호자', reward: 1, repeatable: true,
                def: {
                    levelType: 'bridge', levelLength: 1800, laneHalfWidth: 90,
                    gates: [{ entrance: -700, exit: -1600, room: 0 }],
                    monsters: [
                        { type: 'flame_guardian', x: -1200, y: 0, room: 0 },
                        { type: 'flame_turret', x: -1400, y: -70, room: 0 },
                        { type: 'flame_turret', x: -1400, y: 70, room: 0 },
                        { type: 'flame_slice', x: -900, y: -30, room: 0 },
                        { type: 'flame_slice', x: -900, y: 30, room: 0 },
                        { type: 'flame_slice', x: -1000, y: 0, room: 0 }
                    ],
                    star: { x: -1720, y: 0 }
                }
            }
        },
        // 번개전사맛 쿠키도 레전더리라 자기 사다리를 갖는다.
        lightning: {
            label: '⚡ 번개',
            icon: '⚡',
            ticketKey: 'ticketLightning',
            stages: [
                {
                    id: 'ev_l1', name: '정전기', reward: 1,
                    def: {
                        levelType: 'bridge', levelLength: 1500, laneHalfWidth: 70,
                        gates: [{ entrance: -800, exit: -1300, room: 0 }],
                        monsters: [
                            { type: 'spark_slice', x: -950, y: -35, room: 0 },
                            { type: 'spark_slice', x: -950, y: 35, room: 0 },
                            { type: 'spark_slice', x: -1100, y: 0, room: 0 },
                            { type: 'spark_slice', x: -1230, y: -35, room: 0 }
                        ],
                        star: { x: -1420, y: 0 }
                    }
                },
                {
                    id: 'ev_l2', name: '번짝이는 다리', reward: 2,
                    def: {
                        levelType: 'bridge', levelLength: 1900, laneHalfWidth: 70,
                        gates: [{ entrance: -800, exit: -1700, room: 0 }],
                        monsters: [
                            { type: 'spark_slice', x: -950, y: -45, room: 0 },
                            { type: 'spark_slice', x: -950, y: 0, room: 0 },
                            { type: 'spark_slice', x: -950, y: 45, room: 0 },
                            { type: 'spark_slice', x: -1200, y: -30, room: 0 },
                            { type: 'spark_slice', x: -1200, y: 30, room: 0 },
                            { type: 'tesla_coil', x: -1500, y: 0, room: 0 }
                        ],
                        star: { x: -1820, y: 0 }
                    }
                },
                {
                    id: 'ev_l3', name: '전기 코일 지대', reward: 2,
                    def: {
                        levelType: 'bridge', levelLength: 2300, laneHalfWidth: 70,
                        gates: [
                            { entrance: -700, exit: -1150, room: 0 },
                            { entrance: -1150, exit: -2150, room: 1 }
                        ],
                        monsters: [
                            { type: 'spark_slice', x: -850, y: -35, room: 0 },
                            { type: 'spark_slice', x: -850, y: 35, room: 0 },
                            { type: 'spark_slice', x: -1000, y: 0, room: 0 },
                            { type: 'tesla_coil', x: -1450, y: -55, room: 1 },
                            { type: 'tesla_coil', x: -1650, y: 55, room: 1 },
                            { type: 'spark_slice', x: -1800, y: 0, room: 1 },
                            { type: 'tesla_coil', x: -1950, y: -30, room: 1 }
                        ],
                        star: { x: -2250, y: 0 }
                    }
                },
                {
                    id: 'ev_l4', name: '번개가 치는 곣', reward: 3,
                    def: {
                        levelType: 'bridge', axis: 'y', levelLength: 2600, laneHalfWidth: 70,
                        gates: [
                            { entrance: -700, exit: -1400, room: 0 },
                            { entrance: -1400, exit: -2400, room: 1 }
                        ],
                        monsters: [
                            { type: 'spark_slice', x: -45, y: -850, room: 0 },
                            { type: 'spark_slice', x: 0, y: -850, room: 0 },
                            { type: 'spark_slice', x: 45, y: -850, room: 0 },
                            { type: 'spark_slice', x: -30, y: -1000, room: 0 },
                            { type: 'spark_slice', x: 30, y: -1000, room: 0 },
                            { type: 'tesla_coil', x: 0, y: -1150, room: 0 },
                            { type: 'spark_slice', x: -40, y: -1700, room: 1 },
                            { type: 'spark_slice', x: 40, y: -1800, room: 1 },
                            { type: 'tesla_coil', x: -50, y: -1900, room: 1 },
                            { type: 'tesla_coil', x: 50, y: -2050, room: 1 },
                            { type: 'spark_slice', x: 0, y: -2150, room: 1 },
                            { type: 'tesla_coil', x: 0, y: -2250, room: 1 }
                        ],
                        star: { x: 0, y: -2520 }
                    }
                }
            ],
            boss: {
                id: 'ev_lb', name: '번개의 수호자', reward: 1, repeatable: true,
                def: {
                    levelType: 'bridge', levelLength: 1800, laneHalfWidth: 90,
                    gates: [{ entrance: -700, exit: -1600, room: 0 }],
                    monsters: [
                        { type: 'spark_guardian', x: -1250, y: 0, room: 0 },
                        { type: 'tesla_coil', x: -1450, y: -70, room: 0 },
                        { type: 'tesla_coil', x: -1450, y: 70, room: 0 },
                        { type: 'spark_slice', x: -900, y: -30, room: 0 },
                        { type: 'spark_slice', x: -900, y: 30, room: 0 },
                        { type: 'spark_slice', x: -1000, y: 0, room: 0 }
                    ],
                    star: { x: -1720, y: 0 }
                }
            }
        }
    },
    // 전체 클리어 보너스. Paid as this many of EACH side's ticket, since the two
    // tickets are not interchangeable: 8 + 2 = 10장씩.
    bothClearedReward: 2
};

// Kept as a list so the 이벤트 칸 can show several at once later.
const EVENTS = [EVENT];

// Every event stage, flattened, and the stage-id -> level-def map the story
// engine looks levels up in.
function allEventStages() {
    return Object.values(EVENT.stages).reduce((acc, side) => acc.concat(side.stages), []);
}
// The bosses are separate: they don't count toward 전체 클리어 and they can be
// replayed forever, but they are entered exactly like a stage.
function allEventBosses() {
    return Object.values(EVENT.stages).map(side => side.boss).filter(Boolean);
}
function allEventPlayable() {
    return allEventStages().concat(allEventBosses());
}
const EVENT_STAGE_DEFS = allEventPlayable().reduce((acc, s) => { acc[s.id] = s.def; return acc; }, {});

// The one place that turns whatever a story room was entered with -- a floor
// number or an event stage id -- into its level layout.
function floorDefFor(floor) {
    const known = STORY_FLOOR_DEFS[floor] || EVENT_STAGE_DEFS[floor];
    if (known) return known;
    const parsed = parseAwakenFloorKey(floor);
    if (!parsed) return null;
    if (!AWAKEN_FLOOR_CACHE[floor]) {
        AWAKEN_FLOOR_CACHE[floor] = awakenFloorDef(parsed.charType, parsed.level);
    }
    return AWAKEN_FLOOR_CACHE[floor];
}
function isEventStage(floor) {
    return Object.prototype.hasOwnProperty.call(EVENT_STAGE_DEFS, floor);
}

const GUEST_BOSS_DEFS = {
    guest1: {
        id: 'guest1',
        name: '번개지옥맛 쿠키',
        charType: 'lightninghell', // borrows that cookie's purple/yellow for the body
        maxHp: 500,
        radius: 46,
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
// 덩치는 몬스터마다 다를 수 있다. 표에 radius가 없으면 이 기본값을 쓴다.
// 판정과 그림이 같은 값을 봐야 하므로 서버·클라이언트가 이 함수 하나만 쓴다.
function monsterRadiusOf(type) {
    const def = MONSTERS[type];
    return (def && def.radius) || MONSTER_RADIUS;
}
const SUMMON_RADIUS = 14; // 부하는 몬스터보다 작다
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
    },
    // ---- 레전더리 이벤트 전용 ----
    // 물 side: a sturdy front line backed by archers. Slower and safer to fight
    // than the 불 side, which trades health for speed and damage.
    water_drop: {
        name: '물방울 병사',
        color: '#3498db',
        health: 60,
        speed: 3,
        aggroRange: 500,
        preferredDistance: 80,
        attackRange: 110,
        attackDamage: 5,
        attackCooldown: 2600,
        telegraphMs: 400
    },
    water_cannon: {
        name: '물대포',
        color: '#1f6fb2',
        health: 30,
        speed: 2,
        aggroRange: 520,
        preferredDistance: 230,
        projectileSpeed: 400,
        attackRange: 300,
        attackDamage: 3,
        attackCooldown: 2800,
        telegraphMs: 500
    },
    // 불 side: rushes you down, hits harder, dies faster.
    flame_slice: {
        name: '불꽃 조각',
        color: '#e74c3c',
        health: 40,
        speed: 4,
        aggroRange: 560,
        preferredDistance: 70,
        attackRange: 110,
        attackDamage: 7,
        attackCooldown: 2400,
        telegraphMs: 350
    },
    spark_slice: {
        name: '번개 조각',
        color: '#f1c40f',
        health: 45,
        speed: 4,
        aggroRange: 580,
        preferredDistance: 75,
        attackRange: 115,
        attackDamage: 6,
        attackCooldown: 2200,
        telegraphMs: 300
    },
    tesla_coil: {
        name: '전기 코일',
        color: '#e67e22',
        health: 70,
        speed: 0,
        aggroRange: 620,
        preferredDistance: 0,
        attackRange: 620,
        attackCooldown: 2600,
        telegraphMs: 400,
        laser: true,
        laserDurationMs: 700, // holds longer than the 화염 포탑, but ticks softer
        laserDamage: 1,
        laserTickMs: 100,
        laserRange: 620,
        laserWidth: 24,
        laserTrackSpeed: 90
    },
    // ---- 이벤트 보스 (임시) ----
    // Placeholder guardians so the boss slot is playable and its ticket loop
    // works; the real bosses are coming as a data swap.
    water_guardian: {
        name: '물의 수호자',
        color: '#1f6fb2',
        health: 400,
        speed: 2,
        aggroRange: 700,
        preferredDistance: 200,
        projectileSpeed: 420,
        attackRange: 320,
        attackDamage: 6,
        attackCooldown: 1600,
        telegraphMs: 400
    },
    flame_guardian: {
        name: '불의 수호자',
        color: '#c0392b',
        health: 400,
        speed: 3,
        aggroRange: 700,
        preferredDistance: 70,
        attackRange: 130,
        attackDamage: 9,
        attackCooldown: 1600,
        telegraphMs: 350
    },
    spark_guardian: {
        name: '번개의 수호자',
        color: '#f39c12',
        health: 400,
        speed: 2,
        aggroRange: 700,
        preferredDistance: 0,
        attackRange: 700,
        attackCooldown: 2000,
        telegraphMs: 400,
        laser: true,
        laserDurationMs: 900,
        laserDamage: 2,
        laserTickMs: 100,
        laserRange: 700,
        laserWidth: 30,
        laserTrackSpeed: 100
    },
    // ---- 4~9층에서 처음 나오는 것들 ----
    // 4층: 느리고 단단한 앞줄. 케이크 조각보다 두 배 가까이 질기다.
    jelly_blob: {
        name: '젤리 덩어리',
        color: '#9b59b6',
        health: 90,
        speed: 2,
        aggroRange: 480,
        preferredDistance: 85,
        attackRange: 120,
        attackDamage: 8,
        attackCooldown: 3200,
        telegraphMs: 500
    },
    // 5층: 아주 빠르게 자주 쏘는 뒷줄. 대신 종잇장이다.
    mint_dart: {
        name: '민트 다트',
        color: '#1abc9c',
        health: 18,
        speed: 3,
        aggroRange: 560,
        preferredDistance: 240,
        projectileSpeed: 520,
        attackRange: 320,
        attackDamage: 3,
        attackCooldown: 1500,
        telegraphMs: 300
    },
    // 6층: 달려와서 터진다. 터지면 반경 안을 통째로 때리고 자기도 죽는다.
    // 텔레그래프가 길어서 보고 피할 수 있지만, 붙으면 아프다.
    candy_bomber: {
        name: '사탕 폭탄병',
        color: '#e84393',
        health: 30,
        speed: 5,
        aggroRange: 620,
        preferredDistance: 40,
        attackRange: 90,
        attackDamage: 18,
        attackCooldown: 2000,
        telegraphMs: 700,
        explode: true,
        explodeRadius: 130
    },
    // 7층: 앞줄의 상위 버전. 세게 때리고 잘 안 죽는다.
    cream_knight: {
        name: '크림 기사',
        color: '#f5cba7',
        health: 140,
        speed: 3,
        aggroRange: 520,
        preferredDistance: 80,
        attackRange: 130,
        attackDamage: 12,
        attackCooldown: 2800,
        telegraphMs: 550
    },
    // 8층: 짧고 굵은 빔을 오래 쏘는 포탑. 사거리는 짧아서 파고들면 된다.
    frost_turret: {
        name: '서리 포탑',
        color: '#7fb3d5',
        health: 110,
        speed: 0,
        aggroRange: 460,
        preferredDistance: 0,
        attackRange: 460,
        attackCooldown: 2400,
        telegraphMs: 400,
        laser: true,
        laserDurationMs: 1000,
        laserDamage: 2,
        laserTickMs: 100,
        laserRange: 460,
        laserWidth: 40,
        laserTrackSpeed: 70
    },
    // 9층: 마지막 층을 지키는 정예. 멀리서 세게 쏘고 발도 빠르다.
    // 10층 보스. 다가와서 때리는 것뿐이지만, 한 대 때릴 때마다 공격력과
    // 속도가 오르고 스스로 조금씩 회복해서 끌수록 감당이 안 된다.
    // 체력이 200 아래로 떨어지면 딱 한 번 버틴다.
    cake_boss: {
        name: '케이크',
        color: '#f6a9c9',
        colorLeft: '#ffd9e6',
        colorRight: '#c96a95',
        health: 1000,
        speed: 2,
        aggroRange: 1000,
        preferredDistance: 60,
        // 덩치가 큰 만큼 팔도 길다. 잡몹(90~130)보다 훨씬 멀리서 때린다.
        attackRange: 220,
        attackDamage: 12,
        attackCooldown: 1400,
        telegraphMs: 500,
        // 때릴 때마다 자란다.
        // 보스라서 화면 위에 긴 체력 바를 띄우고, 덩치도 잡몹의 두 배가 넘는다.
        bossBar: true,
        radius: 38,
        growOnAttack: { attack: 0.5, speed: 0.1, heal: 0.5 },
        // 딱 한 번: 체력 100 회복 + 보호막 100.
        lowHpGuard: { atHp: 200, heal: 100, shield: 100 }
    },
    // 20층 보스. 속임수가 정체성이라 쫓아오지도, 정직하게 예고하지도 않는다.
    // 제자리에 고정된 채(speed:0) trickBoss 전용 AI(tickClownBoss, server.js)가
    // 돌아간다 -- 일반 몬스터의 추격/공격 로직(tickMonsterSet)은 이 몬스터를
    // 완전히 건너뛴다. 체력 3500, 페이즈/패턴 수치는 shared.js의 BOSS3_PHASES /
    // BOSS3_PATTERN_DEFS에 있다.
    clown_boss: {
        name: '가면광대',
        color: '#8e44ad',
        colorLeft: '#a569bd',
        colorRight: '#5b2c6f',
        health: 3500,
        speed: 0,
        aggroRange: 0,
        preferredDistance: 0,
        attackRange: 0,
        attackDamage: 0,
        attackCooldown: 999999,
        telegraphMs: 0,
        bossBar: true,
        radius: 46,
        trickBoss: true
    },
    // ---- 11층부터. 여기서부터 적이 한 단계 세진다. ----
    // 11층: 쓰러뜨리면 둘로 갈라진다. 한 방에 정리했다고 끝이 아니다.
    sugar_golem: {
        name: '설탕 골렘',
        color: '#d9c39a',
        colorLeft: '#f3e3c3',
        colorRight: '#a8895f',
        health: 260,
        speed: 2,
        aggroRange: 700,
        preferredDistance: 60,
        attackRange: 160,
        attackDamage: 18,
        attackCooldown: 2600,
        telegraphMs: 500,
        splitOnDeath: { type: 'sugar_shard', count: 2, spread: 45 }
    },
    // 골렘이 갈라져 나오는 조각. 표에 splitOnDeath가 없으므로 여기서 끝난다.
    sugar_shard: {
        name: '설탕 조각',
        color: '#f0dfb8',
        health: 70,
        speed: 4.5,
        aggroRange: 700,
        preferredDistance: 40,
        attackRange: 110,
        attackDamage: 9,
        attackCooldown: 1800,
        telegraphMs: 350
    },
    // 12층: 주변의 다른 적을 계속 채워 준다. 먼저 잡지 않으면 끝이 안 난다.
    macaron_healer: {
        name: '마카롱 치유사',
        color: '#f7a1c4',
        colorLeft: '#ffd6e7',
        colorRight: '#c86b96',
        health: 190,
        speed: 2,
        aggroRange: 700,
        preferredDistance: 240,
        projectileSpeed: 420,
        attackRange: 300,
        attackDamage: 6,
        attackCooldown: 2400,
        telegraphMs: 450,
        healAura: { radius: 280, amount: 8, tickMs: 1400 }
    },
    // 13층: 체력이 40% 아래로 떨어지면 격노해서 더 세지고 빨라진다.
    frost_lancer: {
        name: '서리 창병',
        color: '#5dade2',
        colorLeft: '#aed6f1',
        colorRight: '#1f618d',
        health: 230,
        speed: 3,
        aggroRange: 720,
        preferredDistance: 70,
        attackRange: 200,
        attackDamage: 20,
        attackCooldown: 2400,
        telegraphMs: 500,
        enrage: { atHpRatio: 0.4, attackMult: 1.5, speedMult: 1.5 }
    },
    // 14층: 지금까지 나온 포탑 중 가장 빨리 따라오는 빔.
    thunder_orb: {
        name: '번개 구슬',
        color: '#f4d03f',
        colorLeft: '#fdebd0',
        colorRight: '#b7950b',
        health: 150,
        speed: 0,
        aggroRange: 560,
        preferredDistance: 0,
        attackRange: 560,
        attackCooldown: 2000,
        telegraphMs: 350,
        laser: true,
        laserDurationMs: 1200,
        laserDamage: 3,
        laserTickMs: 100,
        laserRange: 560,
        laserWidth: 46,
        laserTrackSpeed: 130
    },
    // 15층: 계속 부하를 부른다. 최대 8마리까지만 부르므로 끝은 있다.
    choco_queen: {
        name: '초콜릿 여왕',
        color: '#6e3b1f',
        colorLeft: '#c68642',
        colorRight: '#3e1f0d',
        health: 340,
        speed: 2,
        aggroRange: 760,
        preferredDistance: 280,
        projectileSpeed: 500,
        attackRange: 380,
        attackDamage: 15,
        attackCooldown: 2200,
        telegraphMs: 450,
        summonOnTimer: { type: 'chocolate_cake_slice', count: 2, everyMs: 6000, max: 8 }
    },
    // 16층: 어둠의 쿠키보다 빠르고, 쓰러지면 둘로 갈라진다.
    shadow_twin: {
        name: '그림자 쌍둥이',
        color: '#2c2340',
        colorLeft: '#6c5ce7',
        colorRight: '#141018',
        health: 200,
        speed: 5,
        aggroRange: 800,
        preferredDistance: 60,
        attackRange: 150,
        attackDamage: 14,
        attackCooldown: 1800,
        telegraphMs: 350,
        splitOnDeath: { type: 'shadow_wisp', count: 2, spread: 40 }
    },
    shadow_wisp: {
        name: '그림자 조각',
        color: '#5b4b8a',
        health: 60,
        speed: 5.5,
        aggroRange: 800,
        preferredDistance: 40,
        attackRange: 120,
        attackDamage: 8,
        attackCooldown: 1500,
        telegraphMs: 300
    },
    // 17층: 때릴수록 자라는 잡몹판. 케이크 보스의 장치를 그대로 쓴다.
    taffy_brute: {
        name: '엿 괴수',
        color: '#e67e22',
        colorLeft: '#f8c471',
        colorRight: '#a04000',
        health: 300,
        speed: 2.5,
        aggroRange: 760,
        preferredDistance: 60,
        attackRange: 170,
        attackDamage: 16,
        attackCooldown: 2400,
        telegraphMs: 500,
        growOnAttack: { attack: 0.4, speed: 0.05, heal: 1 }
    },
    // 18층: 한 번은 반드시 버틴다. 다 잡았다 싶을 때 되살아나는 느낌.
    royal_guard: {
        name: '왕실 근위대',
        color: '#c0392b',
        colorLeft: '#f5b7b1',
        colorRight: '#78281f',
        health: 320,
        speed: 3,
        aggroRange: 760,
        preferredDistance: 70,
        attackRange: 180,
        attackDamage: 22,
        attackCooldown: 2400,
        telegraphMs: 500,
        lowHpGuard: { atHp: 60, heal: 60, shield: 80 },
        enrage: { atHpRatio: 0.35, attackMult: 1.4, speedMult: 1.3 }
    },
    dark_cookie: {
        name: '어둠의 쿠키',
        color: '#4a1d7a',
        health: 160,
        speed: 4,
        aggroRange: 640,
        preferredDistance: 200,
        projectileSpeed: 480,
        attackRange: 340,
        attackDamage: 10,
        attackCooldown: 2200,
        telegraphMs: 450
    },
    flame_turret: {
        name: '화염 포탑',
        color: '#c0392b',
        health: 90,
        speed: 0,
        aggroRange: 620,
        preferredDistance: 0,
        attackRange: 620,
        attackCooldown: 3000,
        telegraphMs: 400,
        laser: true,
        laserDurationMs: 500,
        laserDamage: 2,
        laserTickMs: 100,
        laserRange: 620,
        laserWidth: 26,
        laserTrackSpeed: 80
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

// ---- 꼬불꼬불한 다리 ----
// 4층부터는 다리가 한 방향으로만 뻗지 않는다. `path`에 꺾이는 지점을 순서대로
// 적어 두면(시작점 [0,0]부터), along/across의 뜻은 그대로 둔 채 길만 휘어진다:
// along은 시작점에서 길을 따라 걸어온 거리(음수), across는 길 한가운데에서
// 옆으로 벗어난 거리. 덕분에 게이트·몬스터·클램프 같은 기존 계산이 전부
// 그대로 돌아간다.
function pathSegs(floorDef) {
    if (!floorDef || !floorDef.path) return null;
    if (floorDef.__segs) return floorDef.__segs;
    const segs = [];
    let acc = 0;
    for (let i = 0; i + 1 < floorDef.path.length; i++) {
        const [x0, y0] = floorDef.path[i];
        const [x1, y1] = floorDef.path[i + 1];
        const dx = x1 - x0, dy = y1 - y0;
        const len = Math.hypot(dx, dy);
        if (len < 1e-6) continue;
        segs.push({ x0, y0, ux: dx / len, uy: dy / len, len, start: acc });
        acc += len;
    }
    floorDef.__segs = segs;
    floorDef.__pathLength = acc;
    return segs;
}

function pathLength(floorDef) {
    pathSegs(floorDef);
    return (floorDef && floorDef.__pathLength) || 0;
}

// 가장 가까운 구간에 붙여서 (along, across)를 뽑는다. 모퉁이에서는 두 구간이
// 다 후보가 되는데, 실제로 더 가까운 쪽을 고른다.
function projectOnPath(floorDef, x, y) {
    const segs = pathSegs(floorDef);
    let best = null;
    for (const s of segs) {
        let t = (x - s.x0) * s.ux + (y - s.y0) * s.uy;
        t = Math.max(0, Math.min(s.len, t));
        const px = s.x0 + s.ux * t, py = s.y0 + s.uy * t;
        const d = Math.hypot(x - px, y - py);
        if (!best || d < best.d) {
            best = {
                d,
                along: -(s.start + t),
                across: -s.uy * (x - s.x0) + s.ux * (y - s.y0)
            };
        }
    }
    return best || { d: 0, along: 0, across: 0 };
}

function pointOnPath(floorDef, along, across) {
    const segs = pathSegs(floorDef);
    const total = pathLength(floorDef);
    const d = Math.max(0, Math.min(total, -along));
    let s = segs[segs.length - 1];
    for (const seg of segs) {
        if (d <= seg.start + seg.len) { s = seg; break; }
    }
    const t = Math.max(0, Math.min(s.len, d - s.start));
    return {
        x: s.x0 + s.ux * t - s.uy * (across || 0),
        y: s.y0 + s.uy * t + s.ux * (across || 0)
    };
}

// 층 데이터를 사람이 적기 쉬운 형태(길을 따라 얼마나 갔는지 + 옆으로 얼마)로
// 적어 두고, 실제 좌표는 여기서 한 번에 계산한다. 꺾인 길의 x,y를 손으로
// 세는 것은 사람이 할 짓이 아니다.
function makePathFloor(spec) {
    const def = {
        levelType: 'bridge',
        path: spec.path,
        laneHalfWidth: spec.laneHalfWidth || 70,
        gates: spec.gates || [],
        monsters: [],
        star: null
    };
    def.levelLength = Math.round(pathLength(def));
    def.monsters = (spec.monsters || []).map(m => {
        const pt = pointOnPath(def, m.at, m.off || 0);
        return { type: m.type, x: Math.round(pt.x), y: Math.round(pt.y), room: m.room || 0 };
    });
    if (spec.star != null) {
        const pt = pointOnPath(def, spec.star.at, spec.star.off || 0);
        def.star = { x: Math.round(pt.x), y: Math.round(pt.y) };
    }
    return def;
}

function alongOf(floorDef, x, y) {
    if (floorDef && floorDef.path) return projectOnPath(floorDef, x, y).along;
    return floorAxis(floorDef) === 'y' ? y : x;
}
function acrossOf(floorDef, x, y) {
    if (floorDef && floorDef.path) return projectOnPath(floorDef, x, y).across;
    return floorAxis(floorDef) === 'y' ? x : y;
}
function fromAlongAcross(floorDef, along, across) {
    if (floorDef && floorDef.path) return pointOnPath(floorDef, along, across);
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
    },
    // ---- 4층부터는 다리가 꺾인다 (makePathFloor / path 참고) ----
    // 4층: 위로 900 올라갔다가 오른쪽으로 800. 첫 꺾임이라 딱 한 번만 꺾는다.
    4: makePathFloor({
        path: [[0, 0], [0, -900], [800, -900]],
        gates: [
            { entrance: -500, exit: -1050, room: 0 },
            { entrance: -1050, exit: -1600, room: 1 }
        ],
        monsters: [
            // 방 0: 젤리 덩어리가 처음 나온다. 느리지만 아주 질기다.
            { type: 'jelly_blob', at: -650, off: -35, room: 0 },
            { type: 'jelly_blob', at: -650, off: 35, room: 0 },
            { type: 'cake_slice', at: -800, off: 0, room: 0 },
            { type: 'chocolate_cake_slice', at: -950, off: -40, room: 0 },
            { type: 'chocolate_cake_slice', at: -950, off: 40, room: 0 },
            // 방 1: 꺾어진 뒤쪽. 젤리 벽 + 뒤에서 쏘는 초코.
            { type: 'jelly_blob', at: -1200, off: -40, room: 1 },
            { type: 'jelly_blob', at: -1200, off: 0, room: 1 },
            { type: 'jelly_blob', at: -1200, off: 40, room: 1 },
            { type: 'chocolate_cake_slice', at: -1400, off: -45, room: 1 },
            { type: 'chocolate_cake_slice', at: -1400, off: 45, room: 1 },
            { type: 'cake_slice', at: -1500, off: 0, room: 1 }
        ],
        star: { at: -1660 }
    }),
    // 5층: 왼쪽 -> 위 -> 왼쪽. 민트 다트가 처음 나온다.
    5: makePathFloor({
        path: [[0, 0], [-700, 0], [-700, -800], [-1500, -800]],
        gates: [
            { entrance: -450, exit: -1000, room: 0 },
            { entrance: -1000, exit: -1750, room: 1 },
            { entrance: -1750, exit: -2250, room: 2 }
        ],
        monsters: [
            // 방 0: 앞줄 젤리 + 민트 다트 둘.
            { type: 'jelly_blob', at: -600, off: -30, room: 0 },
            { type: 'jelly_blob', at: -600, off: 30, room: 0 },
            { type: 'mint_dart', at: -850, off: -45, room: 0 },
            { type: 'mint_dart', at: -850, off: 45, room: 0 },
            // 방 1: 첫 꺾임 뒤. 다트가 여섯이라 계속 날아온다.
            { type: 'mint_dart', at: -1150, off: -50, room: 1 },
            { type: 'mint_dart', at: -1150, off: 0, room: 1 },
            { type: 'mint_dart', at: -1150, off: 50, room: 1 },
            { type: 'cake_slice', at: -1350, off: -35, room: 1 },
            { type: 'cake_slice', at: -1350, off: 35, room: 1 },
            { type: 'mint_dart', at: -1550, off: -40, room: 1 },
            { type: 'mint_dart', at: -1550, off: 40, room: 1 },
            { type: 'mint_dart', at: -1650, off: 0, room: 1 },
            // 방 2: 두 번째 꺾임 뒤. 젤리 벽으로 마무리.
            { type: 'jelly_blob', at: -1900, off: -40, room: 2 },
            { type: 'jelly_blob', at: -1900, off: 40, room: 2 },
            { type: 'jelly_blob', at: -2050, off: 0, room: 2 },
            { type: 'chocolate_cake_slice', at: -2150, off: -45, room: 2 },
            { type: 'chocolate_cake_slice', at: -2150, off: 45, room: 2 }
        ],
        star: { at: -2290 }
    }),
    // 6층: 계단처럼 위-오른쪽-위-오른쪽. 사탕 폭탄병이 처음 나온다.
    6: makePathFloor({
        path: [[0, 0], [0, -600], [600, -600], [600, -1200], [1200, -1200]],
        gates: [
            { entrance: -400, exit: -1000, room: 0 },
            { entrance: -1000, exit: -1750, room: 1 },
            { entrance: -1750, exit: -2300, room: 2 }
        ],
        monsters: [
            // 방 0: 폭탄병을 처음 만나는 자리. 수는 적게.
            { type: 'candy_bomber', at: -550, off: -30, room: 0 },
            { type: 'candy_bomber', at: -550, off: 30, room: 0 },
            { type: 'jelly_blob', at: -800, off: 0, room: 0 },
            { type: 'mint_dart', at: -900, off: -45, room: 0 },
            // 방 1: 폭탄병이 달려오는 사이 다트가 뒤에서 쏜다.
            { type: 'candy_bomber', at: -1150, off: -40, room: 1 },
            { type: 'candy_bomber', at: -1150, off: 0, room: 1 },
            { type: 'candy_bomber', at: -1150, off: 40, room: 1 },
            { type: 'mint_dart', at: -1400, off: -50, room: 1 },
            { type: 'mint_dart', at: -1400, off: 50, room: 1 },
            { type: 'jelly_blob', at: -1600, off: -30, room: 1 },
            { type: 'jelly_blob', at: -1600, off: 30, room: 1 },
            // 방 2: 레이저 로봇 사이로 폭탄병이 섞여 온다.
            { type: 'laser_robot', at: -1950, off: -45, room: 2 },
            { type: 'laser_robot', at: -2050, off: 45, room: 2 },
            { type: 'candy_bomber', at: -2150, off: -30, room: 2 },
            { type: 'candy_bomber', at: -2150, off: 30, room: 2 }
        ],
        star: { at: -2360 }
    }),
    // 7층: 좌우로 접히는 지그재그. 크림 기사가 처음 나온다.
    7: makePathFloor({
        path: [[0, 0], [-800, 0], [-800, -600], [-200, -600], [-200, -1200], [-1000, -1200]],
        gates: [
            { entrance: -500, exit: -1200, room: 0 },
            { entrance: -1200, exit: -2000, room: 1 },
            { entrance: -2000, exit: -3200, room: 2 }
        ],
        monsters: [
            // 방 0: 크림 기사 둘. 여기서부터 앞줄이 확 단단해진다.
            { type: 'cream_knight', at: -700, off: -35, room: 0 },
            { type: 'cream_knight', at: -700, off: 35, room: 0 },
            { type: 'mint_dart', at: -950, off: -45, room: 0 },
            { type: 'mint_dart', at: -950, off: 45, room: 0 },
            { type: 'candy_bomber', at: -1100, off: 0, room: 0 },
            // 방 1: 지그재그 안쪽. 기사 뒤로 폭탄병이 돌아 나온다.
            { type: 'cream_knight', at: -1400, off: -40, room: 1 },
            { type: 'cream_knight', at: -1400, off: 40, room: 1 },
            { type: 'candy_bomber', at: -1600, off: -30, room: 1 },
            { type: 'candy_bomber', at: -1600, off: 30, room: 1 },
            { type: 'chocolate_cake_slice', at: -1800, off: -50, room: 1 },
            { type: 'chocolate_cake_slice', at: -1800, off: 0, room: 1 },
            { type: 'chocolate_cake_slice', at: -1800, off: 50, room: 1 },
            // 방 2: 마지막 직선. 기사 셋에 레이저까지.
            { type: 'laser_robot', at: -2300, off: -45, room: 2 },
            { type: 'laser_robot', at: -2300, off: 45, room: 2 },
            { type: 'cream_knight', at: -2600, off: -40, room: 2 },
            { type: 'cream_knight', at: -2600, off: 0, room: 2 },
            { type: 'cream_knight', at: -2600, off: 40, room: 2 },
            { type: 'mint_dart', at: -2900, off: -50, room: 2 },
            { type: 'mint_dart', at: -2900, off: 50, room: 2 }
        ],
        star: { at: -3330 }
    }),
    // 8층: 길게 올라갔다가 오른쪽 -> 아래 -> 오른쪽. 내려가는 구간이 처음 나온다.
    // 서리 포탑이 처음 나오는데, 사거리가 짧아서 파고들면 된다.
    8: makePathFloor({
        path: [[0, 0], [0, -1000], [700, -1000], [700, -400], [1400, -400]],
        gates: [
            { entrance: -600, exit: -1300, room: 0 },
            { entrance: -1300, exit: -2100, room: 1 },
            { entrance: -2100, exit: -2850, room: 2 }
        ],
        monsters: [
            // 방 0: 서리 포탑 둘을 기사들이 지킨다.
            { type: 'frost_turret', at: -800, off: -45, room: 0 },
            { type: 'frost_turret', at: -900, off: 45, room: 0 },
            { type: 'cream_knight', at: -1100, off: -35, room: 0 },
            { type: 'cream_knight', at: -1100, off: 35, room: 0 },
            // 방 1: 꺾이고 내려가는 구간. 포탑이 길목을 막는다.
            { type: 'frost_turret', at: -1500, off: 0, room: 1 },
            { type: 'candy_bomber', at: -1650, off: -40, room: 1 },
            { type: 'candy_bomber', at: -1650, off: 40, room: 1 },
            { type: 'frost_turret', at: -1850, off: -45, room: 1 },
            { type: 'frost_turret', at: -1850, off: 45, room: 1 },
            { type: 'mint_dart', at: -2000, off: 0, room: 1 },
            // 방 2: 마지막. 기사 벽 뒤에 포탑 셋.
            { type: 'cream_knight', at: -2300, off: -40, room: 2 },
            { type: 'cream_knight', at: -2300, off: 0, room: 2 },
            { type: 'cream_knight', at: -2300, off: 40, room: 2 },
            { type: 'frost_turret', at: -2550, off: -45, room: 2 },
            { type: 'frost_turret', at: -2550, off: 45, room: 2 },
            { type: 'frost_turret', at: -2700, off: 0, room: 2 },
            { type: 'jelly_blob', at: -2800, off: -30, room: 2 },
            { type: 'jelly_blob', at: -2800, off: 30, room: 2 }
        ],
        star: { at: -2960 }
    }),
    // 9층: 가장 꼬불꼬불한 길 (여섯 구간). 어둠의 쿠키가 지킨다. 10층 보스로
    // 올라가기 직전이라 지금까지 나온 것들이 전부 섞여 나온다.
    9: makePathFloor({
        path: [[0, 0], [-600, 0], [-600, -700], [100, -700], [100, -1400], [-700, -1400], [-700, -2000]],
        gates: [
            { entrance: -400, exit: -1300, room: 0 },
            { entrance: -1300, exit: -2100, room: 1 },
            { entrance: -2100, exit: -3000, room: 2 },
            { entrance: -3000, exit: -3900, room: 3 }
        ],
        monsters: [
            // 방 0
            { type: 'cream_knight', at: -600, off: -35, room: 0 },
            { type: 'cream_knight', at: -600, off: 35, room: 0 },
            { type: 'mint_dart', at: -850, off: -45, room: 0 },
            { type: 'mint_dart', at: -850, off: 45, room: 0 },
            { type: 'candy_bomber', at: -1100, off: 0, room: 0 },
            { type: 'jelly_blob', at: -1200, off: -30, room: 0 },
            // 방 1: 어둠의 쿠키가 처음 나온다. 하나만.
            { type: 'dark_cookie', at: -1600, off: 0, room: 1 },
            { type: 'cream_knight', at: -1800, off: -40, room: 1 },
            { type: 'cream_knight', at: -1800, off: 40, room: 1 },
            { type: 'candy_bomber', at: -1950, off: -30, room: 1 },
            { type: 'candy_bomber', at: -1950, off: 30, room: 1 },
            // 방 2: 포탑이 길목을 막고 어둠의 쿠키가 둘.
            { type: 'frost_turret', at: -2300, off: -45, room: 2 },
            { type: 'frost_turret', at: -2300, off: 45, room: 2 },
            { type: 'dark_cookie', at: -2600, off: -35, room: 2 },
            { type: 'dark_cookie', at: -2600, off: 35, room: 2 },
            { type: 'mint_dart', at: -2850, off: 0, room: 2 },
            // 방 3: 마지막 방. 어둠의 쿠키 셋에 전부 섞였다.
            { type: 'laser_robot', at: -3200, off: -45, room: 3 },
            { type: 'laser_robot', at: -3200, off: 45, room: 3 },
            { type: 'cream_knight', at: -3450, off: -40, room: 3 },
            { type: 'cream_knight', at: -3450, off: 40, room: 3 },
            { type: 'dark_cookie', at: -3650, off: -35, room: 3 },
            { type: 'dark_cookie', at: -3650, off: 0, room: 3 },
            { type: 'dark_cookie', at: -3650, off: 35, room: 3 },
            { type: 'candy_bomber', at: -3800, off: -30, room: 3 },
            { type: 'candy_bomber', at: -3800, off: 30, room: 3 }
        ],
        star: { at: -4060 }
    }),
    // 10층: 첫 보스전. 잡몹 없이 케이크 한 마리와만 붙는다. 다리도 짧고
    // 넓게 -- 피할 자리가 있어야 자라나는 보스를 상대할 수 있다.
    10: {
        levelType: 'bridge',
        levelLength: 1100,
        laneHalfWidth: 220,
        gates: [],
        monsters: [
            { type: 'cake_boss', x: -800, y: 0, room: 0 }
        ],
        // 별이 없다. 케이크를 쓰러뜨리는 것이 곧 클리어다.
        winOnClear: true,
        bossFloor: true
    },
    // ==================== 11~19층 ====================
    // 보스층을 지난 위층. 층마다 새 장치를 하나씩 얹고, 뒤로 갈수록 그것들이
    // 겹쳐서 나온다. 길도 점점 길고 복잡해진다.
    // 11층: 설탕 골렘. 쓰러뜨리면 둘로 갈라지므로 "다 잡았다"가 한 번 더 온다.
    11: makePathFloor({
        path: [[0, 0], [-900, 0], [-900, -800], [-100, -800]],
        laneHalfWidth: 80,
        gates: [
            { entrance: -600, exit: -1300, room: 0 },
            { entrance: -1300, exit: -2300, room: 1 }
        ],
        monsters: [
            // 방 0: 골렘 둘로 시작. 갈라지는 걸 처음 겪는 자리라 수는 적게.
            { type: 'sugar_golem', at: -800, off: -40, room: 0 },
            { type: 'sugar_golem', at: -800, off: 40, room: 0 },
            { type: 'mint_dart', at: -1050, off: -50, room: 0 },
            { type: 'mint_dart', at: -1050, off: 50, room: 0 },
            // 방 1: 골렘 셋 + 크림 기사. 갈라진 조각까지 합치면 열 마리가 넘는다.
            { type: 'sugar_golem', at: -1600, off: -45, room: 1 },
            { type: 'sugar_golem', at: -1600, off: 0, room: 1 },
            { type: 'sugar_golem', at: -1600, off: 45, room: 1 },
            { type: 'cream_knight', at: -1900, off: -40, room: 1 },
            { type: 'cream_knight', at: -1900, off: 40, room: 1 },
            { type: 'frost_turret', at: -2150, off: 0, room: 1 }
        ],
        star: { at: -2420 }
    }),
    // 12층: 마카롱 치유사. 뒤에서 계속 채워 주므로 치유사부터 잡아야 한다.
    12: makePathFloor({
        path: [[0, 0], [0, -900], [900, -900], [900, -200], [1700, -200]],
        laneHalfWidth: 80,
        gates: [
            { entrance: -600, exit: -1300, room: 0 },
            { entrance: -1300, exit: -2100, room: 1 },
            { entrance: -2100, exit: -3000, room: 2 }
        ],
        monsters: [
            // 방 0: 치유사 하나에 기사 둘. 치유사를 놔두면 기사가 안 죽는다.
            { type: 'macaron_healer', at: -1100, off: 0, room: 0 },
            { type: 'cream_knight', at: -850, off: -40, room: 0 },
            { type: 'cream_knight', at: -850, off: 40, room: 0 },
            // 방 1: 치유사 둘이 서로를 못 채우게 떨어져 있다.
            { type: 'macaron_healer', at: -1900, off: -55, room: 1 },
            { type: 'macaron_healer', at: -1900, off: 55, room: 1 },
            { type: 'sugar_golem', at: -1600, off: -40, room: 1 },
            { type: 'sugar_golem', at: -1600, off: 40, room: 1 },
            { type: 'candy_bomber', at: -1450, off: 0, room: 1 },
            // 방 2: 치유사 + 포탑. 길목이 좁다.
            { type: 'frost_turret', at: -2400, off: -50, room: 2 },
            { type: 'frost_turret', at: -2400, off: 50, room: 2 },
            { type: 'macaron_healer', at: -2700, off: 0, room: 2 },
            { type: 'cream_knight', at: -2550, off: -40, room: 2 },
            { type: 'cream_knight', at: -2550, off: 40, room: 2 },
            { type: 'sugar_golem', at: -2850, off: 0, room: 2 }
        ],
        star: { at: -3140 }
    }),
    // 13층: 서리 창병. 체력 40% 아래에서 격노해 더 세지고 빨라진다.
    13: makePathFloor({
        path: [[0, 0], [-800, 0], [-800, -700], [0, -700], [0, -1500], [-900, -1500]],
        laneHalfWidth: 80,
        gates: [
            { entrance: -600, exit: -1400, room: 0 },
            { entrance: -1400, exit: -2300, room: 1 },
            { entrance: -2300, exit: -3300, room: 2 }
        ],
        monsters: [
            // 방 0: 창병 둘. 반쯤 깎으면 갑자기 달려든다.
            { type: 'frost_lancer', at: -850, off: -40, room: 0 },
            { type: 'frost_lancer', at: -850, off: 40, room: 0 },
            { type: 'mint_dart', at: -1150, off: -50, room: 0 },
            { type: 'mint_dart', at: -1150, off: 50, room: 0 },
            // 방 1: 창병 셋 + 치유사. 격노한 창병을 치유사가 채워 준다.
            { type: 'frost_lancer', at: -1700, off: -45, room: 1 },
            { type: 'frost_lancer', at: -1700, off: 0, room: 1 },
            { type: 'frost_lancer', at: -1700, off: 45, room: 1 },
            { type: 'macaron_healer', at: -2050, off: 0, room: 1 },
            { type: 'candy_bomber', at: -2200, off: -35, room: 1 },
            { type: 'candy_bomber', at: -2200, off: 35, room: 1 },
            // 방 2: 창병 벽 뒤에 골렘.
            { type: 'frost_lancer', at: -2600, off: -45, room: 2 },
            { type: 'frost_lancer', at: -2600, off: 45, room: 2 },
            { type: 'sugar_golem', at: -2900, off: -40, room: 2 },
            { type: 'sugar_golem', at: -2900, off: 40, room: 2 },
            { type: 'dark_cookie', at: -3150, off: 0, room: 2 }
        ],
        star: { at: -3430 }
    }),
    // 14층: 번개 구슬. 빔이 훨씬 빨리 따라와서 옆으로 도는 걸로는 못 피한다.
    14: makePathFloor({
        path: [[0, 0], [700, 0], [700, -800], [-200, -800], [-200, -1600], [700, -1600]],
        laneHalfWidth: 85,
        gates: [
            { entrance: -500, exit: -1300, room: 0 },
            { entrance: -1300, exit: -2300, room: 1 },
            { entrance: -2300, exit: -3300, room: 2 }
        ],
        monsters: [
            // 방 0: 구슬 둘을 창병이 지킨다.
            { type: 'thunder_orb', at: -900, off: -55, room: 0 },
            { type: 'thunder_orb', at: -1000, off: 55, room: 0 },
            { type: 'frost_lancer', at: -700, off: -40, room: 0 },
            { type: 'frost_lancer', at: -700, off: 40, room: 0 },
            // 방 1: 구슬 셋이 길목을 완전히 덮는다.
            { type: 'thunder_orb', at: -1700, off: -55, room: 1 },
            { type: 'thunder_orb', at: -1800, off: 0, room: 1 },
            { type: 'thunder_orb', at: -1900, off: 55, room: 1 },
            { type: 'sugar_golem', at: -1550, off: -40, room: 1 },
            { type: 'sugar_golem', at: -1550, off: 40, room: 1 },
            { type: 'macaron_healer', at: -2150, off: 0, room: 1 },
            // 방 2: 구슬 + 어둠의 쿠키. 멀리서 오는 것만 셋 종류다.
            { type: 'thunder_orb', at: -2600, off: -55, room: 2 },
            { type: 'thunder_orb', at: -2600, off: 55, room: 2 },
            { type: 'dark_cookie', at: -2900, off: -45, room: 2 },
            { type: 'dark_cookie', at: -2900, off: 45, room: 2 },
            { type: 'frost_lancer', at: -3100, off: -40, room: 2 },
            { type: 'frost_lancer', at: -3100, off: 40, room: 2 }
        ],
        star: { at: -3430 }
    }),
    // 15층: 초콜릿 여왕. 부하를 계속 부르므로 여왕을 먼저 끊어야 한다.
    15: makePathFloor({
        path: [[0, 0], [0, -1000], [-900, -1000], [-900, -1900], [200, -1900]],
        laneHalfWidth: 85,
        gates: [
            { entrance: -700, exit: -1500, room: 0 },
            { entrance: -1500, exit: -2500, room: 1 },
            { entrance: -2500, exit: -3600, room: 2 }
        ],
        monsters: [
            // 방 0: 여왕 하나. 6초마다 초코 둘을 부른다 (최대 8).
            { type: 'choco_queen', at: -1200, off: 0, room: 0 },
            { type: 'cream_knight', at: -950, off: -40, room: 0 },
            { type: 'cream_knight', at: -950, off: 40, room: 0 },
            // 방 1: 여왕 + 치유사. 부르고 채우는 조합이라 오래 끌면 진다.
            { type: 'choco_queen', at: -2100, off: -50, room: 1 },
            { type: 'macaron_healer', at: -2100, off: 50, room: 1 },
            { type: 'frost_lancer', at: -1800, off: -40, room: 1 },
            { type: 'frost_lancer', at: -1800, off: 40, room: 1 },
            { type: 'thunder_orb', at: -2350, off: 0, room: 1 },
            // 방 2: 여왕 둘.
            { type: 'choco_queen', at: -3100, off: -55, room: 2 },
            { type: 'choco_queen', at: -3100, off: 55, room: 2 },
            { type: 'sugar_golem', at: -2800, off: -45, room: 2 },
            { type: 'sugar_golem', at: -2800, off: 0, room: 2 },
            { type: 'sugar_golem', at: -2800, off: 45, room: 2 },
            { type: 'thunder_orb', at: -3400, off: 0, room: 2 }
        ],
        star: { at: -3760 }
    }),
    // 16층: 그림자 쌍둥이. 아주 빠른 데다 쓰러지면 둘로 갈라진다.
    16: makePathFloor({
        path: [[0, 0], [-700, 0], [-700, -800], [200, -800], [200, -1700], [-800, -1700], [-800, -2400]],
        laneHalfWidth: 85,
        gates: [
            { entrance: -500, exit: -1300, room: 0 },
            { entrance: -1300, exit: -2400, room: 1 },
            { entrance: -2400, exit: -3400, room: 2 },
            { entrance: -3400, exit: -4300, room: 3 }
        ],
        monsters: [
            // 방 0
            { type: 'shadow_twin', at: -800, off: -40, room: 0 },
            { type: 'shadow_twin', at: -800, off: 40, room: 0 },
            { type: 'thunder_orb', at: -1100, off: 0, room: 0 },
            // 방 1
            { type: 'shadow_twin', at: -1700, off: -45, room: 1 },
            { type: 'shadow_twin', at: -1700, off: 0, room: 1 },
            { type: 'shadow_twin', at: -1700, off: 45, room: 1 },
            { type: 'macaron_healer', at: -2050, off: 0, room: 1 },
            { type: 'frost_lancer', at: -2250, off: -40, room: 1 },
            { type: 'frost_lancer', at: -2250, off: 40, room: 1 },
            // 방 2
            { type: 'choco_queen', at: -3000, off: 0, room: 2 },
            { type: 'shadow_twin', at: -2700, off: -45, room: 2 },
            { type: 'shadow_twin', at: -2700, off: 45, room: 2 },
            { type: 'thunder_orb', at: -3250, off: -55, room: 2 },
            { type: 'thunder_orb', at: -3250, off: 55, room: 2 },
            // 방 3
            { type: 'shadow_twin', at: -3800, off: -45, room: 3 },
            { type: 'shadow_twin', at: -3800, off: 0, room: 3 },
            { type: 'shadow_twin', at: -3800, off: 45, room: 3 },
            { type: 'sugar_golem', at: -4100, off: -40, room: 3 },
            { type: 'sugar_golem', at: -4100, off: 40, room: 3 },
            { type: 'macaron_healer', at: -4250, off: 0, room: 3 }
        ],
        star: { at: -4550 }
    }),
    // 17층: 엿 괴수. 케이크 보스처럼 때릴수록 자라는 잡몹이라 빨리 잡아야 한다.
    17: makePathFloor({
        path: [[0, 0], [900, 0], [900, -900], [0, -900], [0, -1800], [900, -1800], [900, -2600]],
        laneHalfWidth: 85,
        gates: [
            { entrance: -600, exit: -1400, room: 0 },
            { entrance: -1400, exit: -2500, room: 1 },
            { entrance: -2500, exit: -3600, room: 2 },
            { entrance: -3600, exit: -4600, room: 3 }
        ],
        monsters: [
            // 방 0: 괴수 둘. 오래 끌수록 손을 못 댄다.
            { type: 'taffy_brute', at: -900, off: -45, room: 0 },
            { type: 'taffy_brute', at: -900, off: 45, room: 0 },
            { type: 'thunder_orb', at: -1200, off: 0, room: 0 },
            // 방 1: 괴수 + 치유사. 자라면서 채워지기까지 한다.
            { type: 'taffy_brute', at: -1800, off: -45, room: 1 },
            { type: 'taffy_brute', at: -1800, off: 45, room: 1 },
            { type: 'macaron_healer', at: -2100, off: 0, room: 1 },
            { type: 'shadow_twin', at: -2300, off: -40, room: 1 },
            { type: 'shadow_twin', at: -2300, off: 40, room: 1 },
            // 방 2: 여왕이 부하를 붓는 사이 괴수가 자란다.
            { type: 'choco_queen', at: -3200, off: 0, room: 2 },
            { type: 'taffy_brute', at: -2900, off: -45, room: 2 },
            { type: 'taffy_brute', at: -2900, off: 45, room: 2 },
            { type: 'frost_lancer', at: -3400, off: -40, room: 2 },
            { type: 'frost_lancer', at: -3400, off: 40, room: 2 },
            // 방 3
            { type: 'taffy_brute', at: -4000, off: -45, room: 3 },
            { type: 'taffy_brute', at: -4000, off: 0, room: 3 },
            { type: 'taffy_brute', at: -4000, off: 45, room: 3 },
            { type: 'thunder_orb', at: -4300, off: -55, room: 3 },
            { type: 'thunder_orb', at: -4300, off: 55, room: 3 },
            { type: 'macaron_healer', at: -4500, off: 0, room: 3 }
        ],
        star: { at: -4800 }
    }),
    // 18층: 왕실 근위대. 한 번은 반드시 버티고, 35% 아래에서 격노까지 한다.
    18: makePathFloor({
        path: [[0, 0], [-1000, 0], [-1000, -900], [0, -900], [0, -1800], [-1000, -1800], [-1000, -2700], [0, -2700]],
        laneHalfWidth: 90,
        gates: [
            { entrance: -700, exit: -1600, room: 0 },
            { entrance: -1600, exit: -2700, room: 1 },
            { entrance: -2700, exit: -3900, room: 2 },
            { entrance: -3900, exit: -5100, room: 3 }
        ],
        monsters: [
            // 방 0: 근위대 둘. 다 깎았다 싶을 때 한 번 버틴다.
            { type: 'royal_guard', at: -1000, off: -45, room: 0 },
            { type: 'royal_guard', at: -1000, off: 45, room: 0 },
            { type: 'thunder_orb', at: -1350, off: 0, room: 0 },
            // 방 1: 근위대 + 치유사 + 여왕.
            { type: 'royal_guard', at: -2000, off: -45, room: 1 },
            { type: 'royal_guard', at: -2000, off: 45, room: 1 },
            { type: 'macaron_healer', at: -2350, off: -50, room: 1 },
            { type: 'choco_queen', at: -2350, off: 50, room: 1 },
            { type: 'shadow_twin', at: -2550, off: 0, room: 1 },
            // 방 2: 근위대 셋에 괴수까지.
            { type: 'royal_guard', at: -3200, off: -50, room: 2 },
            { type: 'royal_guard', at: -3200, off: 0, room: 2 },
            { type: 'royal_guard', at: -3200, off: 50, room: 2 },
            { type: 'taffy_brute', at: -3550, off: -45, room: 2 },
            { type: 'taffy_brute', at: -3550, off: 45, room: 2 },
            { type: 'thunder_orb', at: -3800, off: 0, room: 2 },
            // 방 3
            { type: 'royal_guard', at: -4400, off: -50, room: 3 },
            { type: 'royal_guard', at: -4400, off: 50, room: 3 },
            { type: 'choco_queen', at: -4700, off: 0, room: 3 },
            { type: 'sugar_golem', at: -4600, off: -50, room: 3 },
            { type: 'sugar_golem', at: -4600, off: 50, room: 3 },
            { type: 'macaron_healer', at: -4950, off: -45, room: 3 },
            { type: 'macaron_healer', at: -4950, off: 45, room: 3 }
        ],
        star: { at: -5320 }
    }),
    // 19층: 20층 보스로 올라가기 직전. 11층부터 나온 것이 전부 섞여 나오고,
    // 마지막 방은 여왕 둘·근위대 셋으로 사실상 작은 보스전이다.
    19: makePathFloor({
        path: [[0, 0], [0, -1000], [1000, -1000], [1000, -2000], [0, -2000], [0, -3000], [1000, -3000]],
        laneHalfWidth: 90,
        gates: [
            { entrance: -700, exit: -1700, room: 0 },
            { entrance: -1700, exit: -2900, room: 1 },
            { entrance: -2900, exit: -4200, room: 2 },
            { entrance: -4200, exit: -5600, room: 3 }
        ],
        monsters: [
            // 방 0: 갈라지는 것들로 시작.
            { type: 'sugar_golem', at: -1000, off: -50, room: 0 },
            { type: 'sugar_golem', at: -1000, off: 50, room: 0 },
            { type: 'shadow_twin', at: -1300, off: -45, room: 0 },
            { type: 'shadow_twin', at: -1300, off: 45, room: 0 },
            { type: 'thunder_orb', at: -1550, off: 0, room: 0 },
            // 방 1: 자라는 것과 격노하는 것.
            { type: 'taffy_brute', at: -2100, off: -50, room: 1 },
            { type: 'taffy_brute', at: -2100, off: 50, room: 1 },
            { type: 'frost_lancer', at: -2400, off: -45, room: 1 },
            { type: 'frost_lancer', at: -2400, off: 0, room: 1 },
            { type: 'frost_lancer', at: -2400, off: 45, room: 1 },
            { type: 'macaron_healer', at: -2700, off: -50, room: 1 },
            { type: 'macaron_healer', at: -2700, off: 50, room: 1 },
            // 방 2: 멀리서 오는 것만 모아 놓은 방.
            { type: 'thunder_orb', at: -3300, off: -60, room: 2 },
            { type: 'thunder_orb', at: -3400, off: 0, room: 2 },
            { type: 'thunder_orb', at: -3300, off: 60, room: 2 },
            { type: 'dark_cookie', at: -3700, off: -50, room: 2 },
            { type: 'dark_cookie', at: -3700, off: 50, room: 2 },
            { type: 'choco_queen', at: -4000, off: 0, room: 2 },
            { type: 'royal_guard', at: -3900, off: -50, room: 2 },
            { type: 'royal_guard', at: -3900, off: 50, room: 2 },
            // 방 3: 마지막. 여왕 둘 + 근위대 셋 + 치유사 둘.
            { type: 'royal_guard', at: -4700, off: -55, room: 3 },
            { type: 'royal_guard', at: -4700, off: 0, room: 3 },
            { type: 'royal_guard', at: -4700, off: 55, room: 3 },
            { type: 'choco_queen', at: -5100, off: -55, room: 3 },
            { type: 'choco_queen', at: -5100, off: 55, room: 3 },
            { type: 'macaron_healer', at: -5350, off: -50, room: 3 },
            { type: 'macaron_healer', at: -5350, off: 50, room: 3 },
            { type: 'taffy_brute', at: -5000, off: -50, room: 3 },
            { type: 'taffy_brute', at: -5000, off: 50, room: 3 },
            { type: 'shadow_twin', at: -5500, off: 0, room: 3 }
        ],
        star: { at: -5860 }
    }),
    // 20층: 첫 타워 보스전. 10층(케이크)과 같은 방식(직선 다리 위에 몬스터
    // 하나)이지만, 폭을 넓게 잡아서 부채꼴/9칸 격자/좌우 반쪽 같은 패턴이
    // 움직일 공간을 준다.
    [STORY_TOWER_BOSS_FLOOR]: {
        levelType: 'bridge',
        levelLength: 1000,
        laneHalfWidth: 300,
        gates: [],
        monsters: [{ type: STORY_TOWER_BOSS_MONSTER, x: -800, y: 0, room: 0 }],
        winOnClear: true,
        bossFloor: true
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
// ==================== 클리어 보상 ====================
// 깔 때마다 전액. 첫 클리어인지는 보지 않는다 -- 몇 번을 깔든 같은
// 양을 받으므로 재료가 모자라면 상위 층을 반복해서 파머는 것이 정상 경로다.
// key는 스토리는 'story<층>', 보스 레이드는 보스 id 그대로.
// ---- 악마 뽑기 ----
// 게스트 레이드에서만 나오는 티켓으로 돌린다. 일반 뽑기와 표는 같되 비스트와
// 게스트 확률만 올라가고, 늘어난 만큼은 영혼석에서 빼 온다.
const DEMON_GACHA_KEY = 'ticketDemon';
const DEMON_GACHA_RATES = { '비스트': 0.25, '게스트': 0.1 };
function demonGachaTable() {
    const t = { ...GACHA_TABLE };
    let added = 0;
    for (const [grade, rate] of Object.entries(DEMON_GACHA_RATES)) {
        added += rate - (t[grade] || 0);
        t[grade] = rate;
    }
    t[GACHA_SOUL_STONE_KEY] = Math.max(0,
        Math.round((t[GACHA_SOUL_STONE_KEY] - added) * 1000) / 1000);
    return t;
}

const CLEAR_REWARDS = {
    story1: { material: 1, potion: 1, coins: 100, diamonds: 10, ticketNormal: 1 },
    story2: { material: 3, potion: 5, coins: 300, diamonds: 10, ticketNormal: 1 },
    // 위로 갈수록 재료가 굵어진다. 5층부터 고급 재료가, 7층부터 고급 포션이
    // 섞여 나오므로 희귀 이상 장비를 강화하려면 그쯤은 올라와야 한다.
    story3: { material: 5, potion: 6, coins: 500, diamonds: 10, ticketNormal: 1 },
    story4: { material: 8, potion: 8, coins: 700, diamonds: 15, ticketNormal: 1 },
    story5: { material: 10, materialRare: 1, potion: 10, coins: 900, diamonds: 15, ticketNormal: 1 },
    story6: { material: 12, materialRare: 2, potion: 12, coins: 1100, diamonds: 20, ticketNormal: 1 },
    story7: { material: 15, materialRare: 3, potion: 14, potionRare: 2, coins: 1300, diamonds: 20, ticketNormal: 1 },
    story8: { material: 18, materialRare: 5, potion: 16, potionRare: 3, coins: 1600, diamonds: 25, ticketNormal: 1 },
    story9: { material: 20, materialRare: 8, potion: 20, potionRare: 5, coins: 2000, diamonds: 30, ticketNormal: 1 },
    // 11층부터는 보스층(10층)을 넘긴 뒤라 한 단계씩 굵어진다.
    story11: { material: 26, materialRare: 11, potion: 26, potionRare: 8, coins: 3300, diamonds: 30, ticketNormal: 2 },
    story12: { material: 29, materialRare: 13, potion: 29, potionRare: 9, coins: 3600, diamonds: 32, ticketNormal: 2 },
    story13: { material: 32, materialRare: 15, potion: 32, potionRare: 10, coins: 3900, diamonds: 34, ticketNormal: 2 },
    story14: { material: 35, materialRare: 17, potion: 35, potionRare: 11, coins: 4200, diamonds: 36, ticketNormal: 2 },
    story15: { material: 38, materialRare: 19, potion: 38, potionRare: 12, coins: 4500, diamonds: 38, ticketNormal: 2 },
    story16: { material: 41, materialRare: 21, potion: 41, potionRare: 13, coins: 4800, diamonds: 40, ticketNormal: 2 },
    story17: { material: 44, materialRare: 23, potion: 44, potionRare: 14, coins: 5100, diamonds: 42, ticketNormal: 2 },
    story18: { material: 47, materialRare: 25, potion: 47, potionRare: 15, coins: 5400, diamonds: 44, ticketNormal: 2 },
    story19: { material: 50, materialRare: 28, potion: 50, potionRare: 17, coins: 5800, diamonds: 46, ticketNormal: 2 },
    // 게스트 레이드. 악마 뽑기 티켓은 오직 여기서만 나온다.
    guest1: { materialRare: 15, potionRare: 12, coins: 4000, diamonds: 60, ticketDemon: 3 },
    guest1_phase1: { materialRare: 5, potionRare: 4, coins: 1500, diamonds: 20, ticketDemon: 1 },
    boss1: { material: 10, coins: 1000, potion: 15 },   // 스톤 골렘
    boss2: { materialRare: 10, coins: 1100, potionRare: 10 } // 시하라얼
};

// 같은 출처에서 장비도 하나 떨어진다. 보상과 마찬가지로 깔 때마다.
const CLEAR_DROPS = {
    story1: ['wood_stick', 'cloth_cap', 'rusty_sword', 'leather_hood'],
    story2: ['leather_vest', 'runner_boots', 'linen_robe', 'cotton_pants'],
    story3: ['wood_stick', 'cloth_cap', 'leather_vest', 'straw_sandals'],
    story4: ['runner_boots', 'jelly_guard', 'steel_plate'],
    story5: ['jelly_guard', 'mint_blade', 'silver_axe', 'spiked_greaves'],
    story6: ['mint_blade', 'bomber_helm', 'spiked_helm', 'wind_shoes'],
    story7: ['cream_plate', 'cream_greaves', 'ice_spear'],
    story8: ['cream_greaves', 'frost_boots', 'flame_helm'],
    story9: ['cream_plate', 'frost_boots', 'spirit_armor'],
    // 11~19층은 지금 있는 장비들 중 좋은 쪽이 계속 나온다. 새 장비는 유누가
    // 만들어 주면 여기 이름만 바꿔 넣으면 된다.
    story11: ['cream_plate', 'cream_greaves', 'ice_spear'],
    story12: ['frost_boots', 'cream_plate', 'flame_helm'],
    story13: ['cream_greaves', 'frost_boots', 'spirit_armor'],
    story14: ['cream_plate', 'mint_blade', 'storm_greaves'],
    story15: ['frost_boots', 'cream_greaves', 'gale_boots'],
    story16: ['cream_plate', 'frost_boots', 'ice_spear'],
    story17: ['cream_greaves', 'cream_plate', 'spirit_armor'],
    story18: ['frost_boots', 'cream_plate', 'cream_greaves', 'storm_greaves'],
    story19: ['cream_plate', 'cream_greaves', 'frost_boots', 'gale_boots'],
    boss1: ['golem_blade', 'golem_plate', 'golem_greaves'],
    boss2: ['shihara_spear', 'shadow_helm', 'shadow_boots', 'red_lightning_cap']
    // story20(가면광대)은 CLEAR_DROPS에 따로 안 적는다 -- clearDropsFor()의
    // isTowerBossFloor 처리로 레전더리 전체(신규 "빛의" 세트 포함)가 자동으로
    // 드랍 후보에 낀다.
};
// ---- 10층마다 오는 타워 보스전 ----
// 레전더리 장비는 오직 여기서만 나온다. 스토리 층을 아무리 돌아도 안 나오고,
// 보스를 잡으면 레전더리 중 하나가 무작위로 떨어진다.
const TOWER_BOSS_EVERY = 10;
function isTowerBossFloor(floor) {
    return typeof floor === 'number' && floor > 0 && floor % TOWER_BOSS_EVERY === 0;
}
function legendaryEquipmentIds() {
    return Object.keys(EQUIPMENT).filter(id => EQUIPMENT[id].grade === '레전더리');
}

function clearDropsFor(key) {
    if (CLEAR_DROPS[key]) return CLEAR_DROPS[key];
    // 보스전 층은 표를 따로 적지 않는다 -- 레전더리 전체가 곧 그 층의 표다.
    // 그래서 레전더리를 새로 만들면 보스 드랍에 자동으로 끼어든다.
    const m = /^story(\d+)$/.exec(key || '');
    if (m && isTowerBossFloor(Number(m[1]))) return legendaryEquipmentIds();
    return null;
}

function storyRewardKey(floor) { return 'story' + floor; }

// 보스전 층의 재화 보상. 보스 자체는 아직 없으므로 층수에 맞춰 자동으로
// 계산해 둔다 -- 진짜 보스가 들어오면 CLEAR_REWARDS에 그 층을 적어서
// 덮어쓰면 된다 (적어 둔 표가 항상 이깁니다).
// 일반 뽑기 티켓은 층마다 정해진 수만 준다 -- 1~9층 1장, 10층 3장,
// 11~19층 2장, 20층 4장. 보스층은 여기서, 나머지는 CLEAR_REWARDS에 적혀 있다.
function towerBossTickets(floor) {
    return 2 + (floor / TOWER_BOSS_EVERY); // 10층 3, 20층 4, 30층 5...
}

function towerBossReward(floor) {
    const tier = floor / TOWER_BOSS_EVERY; // 10층=1, 20층=2, ...
    return {
        material: 25 * tier,
        materialRare: 10 * tier,
        potion: 25 * tier,
        potionRare: 8 * tier,
        coins: 3000 * tier,
        diamonds: 50 * tier,
        // 티켓만은 배수로 늘리지 않는다: 10층 3장, 20층 4장, 그 뒤로 한 장씩.
        ticketNormal: towerBossTickets(floor)
    };
}

function clearRewardFor(key) {
    if (CLEAR_REWARDS[key]) return CLEAR_REWARDS[key];
    const m = /^story(\d+)$/.exec(key || '');
    if (m && isTowerBossFloor(Number(m[1]))) return towerBossReward(Number(m[1]));
    return null;
}

// ==================== 장비 ====================
// 가방은 계정 공용이고 장착은 쿠키별이다. 한 장비를 다른 쿠키에 끼우면
// 원래 끼고 있던 쿠키에서는 자동으로 벗겨진다 (한 개를 둘이 나눠 끼지 못함).
// 각성 슬롯은 등급이 에이션트 이상인 쿠키만 가진다. 무기/투구와 달리
// 모두가 가지는 칸이 아니라 EQUIP_SLOTS와 따로 둔다.
const GRADE_ORDER = ['일반', '희귀', '에픽', '레전더리', '에이션트', '비스트', '게스트'];
const AWAKEN_SLOT = { key: 'awaken', name: '각성', icon: '✨' };
function hasAwakenSlot(grade) {
    const idx = GRADE_ORDER.indexOf(grade);
    return idx >= 0 && idx >= GRADE_ORDER.indexOf('에이션트');
}

const EQUIP_SLOTS = [
    { key: 'weapon', name: '무기', icon: '🗡' },
    { key: 'helmet', name: '투구', icon: '🪖' },
    { key: 'armor', name: '갑옷', icon: '🥼' },
    { key: 'leggings', name: '레깅스', icon: '👖' },
    { key: 'boots', name: '부츠', icon: '👢' }
];
const EQUIP_SLOT_KEYS = EQUIP_SLOTS.map(s => s.key);

// 능력치는 장비마다 다르다. 지원하는 항목은 이 다섯 개뿐이고,
// 적힌 것만 적용된다 (더하기는 0, 곱하기는 1이 기본값).
//   bonusAttack       기본공격 피해 +N
//   bonusHealth       최대 체력 +N
//   bonusSpeed        이동 속도 +N
//   bonusDamageTaken  받는 피해 배수 (0.95 = 5% 감소)
//   bonusCooldown     스킬/궁극기 재사용 대기시간 배수 (0.9 = 10% 감소)
//   bonusRevive       부활 횟수 +N (각성 장비에만 붙는다)
const EQUIP_STAT_KEYS = ['bonusAttack', 'bonusHealth', 'bonusSpeed', 'bonusDamageTaken', 'bonusCooldown', 'bonusRevive'];

// ownerChar가 있는 장비는 그 쿠키가 낌 때만 ownerBonus가 붙는다.
// 다른 쿠키가 끼면 기본 능력치만 남고 전용 효과는 아예 발동하지 않는다.
const EQUIPMENT = {
    // ---- 각성 장비 ----
    // 부활이 한 번 늘어난다. 번개악마맛은 그 두 번째 부활에서 각성하기 때문에
    // 이 모자가 각성의 전제 조건이다.
    red_lightning_cap: {
        name: '붉은 번개 모자', slot: 'awaken', grade: '비스트', icon: '⚡',
        ownerChar: 'lightningdevil',
        ownerBonus: { bonusRevive: 1 },
        ownerText: '번개악마맛 쿠키 전용 — 부활 1회 추가. 번개악마맛은 그 2번째 부활에서 각성합니다.'
    },
    // 아래 넷은 쿠키 전용이다. 다른 쿠키가 껴도 아무 것도 붙지 않는다
    // (능력치를 전부 ownerBonus에 넣었고, awakenForm도 주인만 읽는다).
    lemon_armor: {
        name: '레몬갑옷', slot: 'awaken', grade: '에이션트', icon: '🍋',
        ownerChar: 'orangelemon',
        // 주먹과 발차기는 더하기로 표현할 수 없어서 수치를 통째로 덮어쓴다.
        awakenForm: { attackDamageRight: 9, attackDamageLeft: 10, skillDamage: 13 },
        // 궁극기를 쓰면 주변의 모든 적이 빛 표식을 10번씩 받는다.
        awakenUltimateMark: { radius: 260, charges: 10, multiplier: 1.3 },
        ownerText: '오렌지 레몬맛 쿠키 전용 — 주먹 7/8 → 9/10, 발차기 10 → 13, 궁극기를 쓰면 주변 모든 적에게 빛 표식을 10번씩 부여합니다.'
    },
    blue_greatsword: {
        name: '시퍼런 대검', slot: 'awaken', grade: '에이션트', icon: '🗡',
        ownerChar: 'dragonfruit',
        ownerBonus: { bonusHealth: 30 },
        awakenForm: { attackHealOnUse: 2, ultimateHealRatio: 0.4, ultimateShieldAmount: 70 },
        ownerText: '용과맛 쿠키 전용 — 체력 +30, 공격이 적중할 때마다 팀 회복 1 → 2, 궁극기 회복 25% → 40%, 보호막 40 → 70.'
    },
    nature_grass_armor: {
        name: '자연의 풀 아머', slot: 'awaken', grade: '비스트', icon: '🌿',
        ownerChar: 'blacksugar',
        ownerBonus: { bonusHealth: 50 },
        awakenForm: { ultimateHealAmount: 50, ultimateShieldAmount: 100 },
        ownerText: '블랙 슈거맛 쿠키 전용 — 체력 +50, 궁극기 회복 20 → 50, 보호막 70 → 100.'
    },
    light_dark_twinblades: {
        name: '빛과 어둠의 쌍검', slot: 'awaken', grade: '게스트', icon: '⚔',
        ownerChar: 'lightninghell',
        // 부활은 패시브 1번 + 이 검 1번 = 총 2번.
        ownerBonus: { bonusAttack: 2, bonusHealth: 60, bonusRevive: 1 },
        ownerText: '번개지옥맛 쿠키 전용 — 공격력 +2, 체력 +60, 부활 1회 추가(패시브 포함 총 2번).'
    },
    // 치즈만두맛은 부활이 곧 각성이다. 그래서 이 만두피가 주는 "부활 1회
    // 추가"는 각성한 뒤에도 한 번 더 일어난다는 뜻이 된다.
    yellow_dumpling_skin: {
        name: '노란 만두피', slot: 'awaken', grade: '게스트', icon: '🥟',
        ownerChar: 'cheesedumpling',
        ownerBonus: { bonusHealth: 40, bonusRevive: 1 },
        ownerText: '치즈만두맛 쿠키 전용 — 체력 +40, 부활 1회 추가(각성한 뒤에도 한 번 더 일어납니다).'
    },
    // ---- 스토리 1층 ----
    wood_stick: {
        name: '낡은 나무 막대', slot: 'weapon', grade: '일반', icon: '🪓',
        bonusAttack: 1
    },
    cloth_cap: {
        name: '천 모자', slot: 'helmet', grade: '일반', icon: '🧢',
        bonusHealth: 5
    },
    // ---- 스토리 2층 ----
    leather_vest: {
        name: '가죽 조끼', slot: 'armor', grade: '일반', icon: '🦺',
        bonusHealth: 8, bonusDamageTaken: 0.98
    },
    runner_boots: {
        name: '달리기 부츠', slot: 'boots', grade: '희귀', icon: '👟',
        bonusHealth: 10, bonusDamageTaken: 0.97
    },
    // ---- 스톤 골렘 ----
    golem_blade: {
        name: '골렘의 돌검', slot: 'weapon', grade: '희귀', icon: '🗡',
        bonusAttack: 2,
        ownerChar: 'kicker',
        ownerBonus: { bonusAttack: 2 },
        ownerText: '자두맛 쿠키가 착용하면 공격력이 2 더 오릅니다.'
    },
    golem_plate: {
        name: '골렘의 돌갑옷', slot: 'armor', grade: '희귀', icon: '🛡',
        bonusHealth: 20, bonusDamageTaken: 0.95,
        ownerChar: 'board',
        ownerBonus: { bonusDamageTaken: 0.9 },
        ownerText: '보드맛 쿠키가 착용하면 받는 피해가 10% 더 줄어듭니다.'
    },
    golem_greaves: {
        name: '골렘의 돌다리', slot: 'leggings', grade: '희귀', icon: '🦵',
        bonusHealth: 12, bonusDamageTaken: 0.97
    },
    // ---- 스토리 4~9층 ----
    jelly_guard: {
        name: '젤리 방패갑옷', slot: 'armor', grade: '희귀', icon: '🟣',
        bonusHealth: 22, bonusDamageTaken: 0.96,
        ownerChar: 'board',
        ownerBonus: { bonusHealth: 10 },
        ownerText: '보드맛 쿠키가 착용하면 체력이 10 더 오릅니다.'
    },
    mint_blade: {
        name: '민트 단검', slot: 'weapon', grade: '희귀', icon: '🗡',
        bonusAttack: 2, bonusCooldown: 0.95
    },
    bomber_helm: {
        name: '폭탄병 투구', slot: 'helmet', grade: '희귀', icon: '🪖',
        bonusHealth: 14, bonusAttack: 1
    },
    cream_plate: {
        name: '크림 기사 갑옷', slot: 'armor', grade: '에픽', icon: '🛡',
        bonusHealth: 30, bonusDamageTaken: 0.93
    },
    cream_greaves: {
        name: '크림 기사 레깅스', slot: 'leggings', grade: '에픽', icon: '👖',
        bonusHealth: 20, bonusCooldown: 0.96
    },
    frost_boots: {
        name: '서리 부츠', slot: 'boots', grade: '에픽', icon: '🥾',
        bonusHealth: 18, bonusDamageTaken: 0.95
    },
    dark_blade: {
        name: '어둠의 대검', slot: 'weapon', grade: '레전더리', icon: '⚔',
        bonusAttack: 5, bonusCooldown: 0.9,
        ownerChar: 'lightningdevil',
        ownerBonus: { bonusAttack: 3 },
        ownerText: '번개악마맛 쿠키가 착용하면 공격력이 3 더 오릅니다.'
    },
    dark_crown: {
        name: '어둠의 왕관', slot: 'helmet', grade: '레전더리', icon: '👑',
        bonusHealth: 26, bonusAttack: 2, bonusCooldown: 0.94
    },
    dark_mantle: {
        name: '어둠의 망토', slot: 'armor', grade: '레전더리', icon: '🧥',
        bonusHealth: 34, bonusDamageTaken: 0.91
    },
    dark_greaves: {
        name: '어둠의 각반', slot: 'leggings', grade: '레전더리', icon: '🦿',
        bonusHealth: 26, bonusCooldown: 0.93
    },
    dark_boots: {
        name: '어둠의 장화', slot: 'boots', grade: '레전더리', icon: '🥾',
        bonusHealth: 24, bonusDamageTaken: 0.93
    },
    // ---- 시하라얼 ----
    shihara_spear: {
        name: '시하라얼의 창', slot: 'weapon', grade: '에픽', icon: '🔱',
        bonusAttack: 3, bonusCooldown: 0.92,
        ownerChar: 'lightninghell',
        ownerBonus: { bonusAttack: 2, bonusCooldown: 0.9 },
        ownerText: '번개지옥맛 쿠키가 착용하면 공격력 +2, 재사용 대기시간이 10% 더 줄어듭니다.'
    },
    shadow_helm: {
        name: '그림자 투구', slot: 'helmet', grade: '에픽', icon: '⛑',
        bonusHealth: 18, bonusCooldown: 0.95
    },
    shadow_boots: {
        name: '그림자 부츠', slot: 'boots', grade: '에픽', icon: '🥾',
        bonusHealth: 16, bonusCooldown: 0.95,
        ownerChar: 'sugarfly',
        ownerBonus: { bonusCooldown: 0.9 },
        ownerText: '슈가 플라이맛 쿠키가 착용하면 재사용 대기시간이 10% 더 줄어듭니다.'
    },
    // ---- 각성 장비 (2차) ----
    dark_axe: {
        name: '어둠의 도끼', slot: 'awaken', grade: '비스트', icon: '🪓',
        ownerChar: 'hellflavor',
        ownerBonus: { bonusAttack: 5, bonusRevive: 1 },
        // 궁극기 피해는 더하기로 표현이 안 돼서(ultimateDamage는 EQUIP_BONUS_KEYS에
        // 없다) awakenForm으로 통째로 덮어쓴다: 60 -> 65.
        awakenForm: { ultimateDamage: 65 },
        ownerText: '지옥맛 쿠키 전용 — 공격력 +5, 궁극기 피해 60 → 65, 부활 1회 추가(패시브 포함 총 2번).'
    },
    pearl_necklace: {
        name: '진주목걸이', slot: 'awaken', grade: '비스트', icon: '📿',
        ownerChar: 'seapearl',
        ownerBonus: { bonusHealth: 100 },
        // 몸을 사리는 기준(lowHpAt)과 그때의 회복량(lowHpAttackHealSelf)은
        // 더하기로 표현이 안 되는 수치라 통째로 덮어쓴다.
        awakenForm: { lowHpAt: 100, lowHpAttackHealSelf: 5 },
        ownerText: '바다펄맛 쿠키 전용 — 체력 +100, 몸을 사리는 기준이 체력 60 → 100 이하로 낮아지고, 그동안 회복량이 2 → 5로 늘어납니다.'
    },
    burning_steel_plate: {
        name: '타오르는 강판', slot: 'awaken', grade: '게스트', icon: '🔥',
        ownerChar: 'flamefairy',
        ownerBonus: { bonusRevive: 1 },
        // 부활은 패시브 2번 + 이 장비 1번 = 총 3번. 다만 화염 피해 성장은
        // passiveBurnGrowthMaxRevives로 2번째 부활까지만 세서 6->7->8에서
        // 멈추고, 그 대신 3번째 부활(패시브가 못 붙잡는 몫)부터 기본 공격력이
        // +2 붙는다. 궁극기 화염지대는 15초 -> 18초로 늘어난다.
        awakenForm: {
            passiveBurnGrowthMaxRevives: 2,
            passiveReviveAttackBonusAtRevives: 3,
            passiveReviveAttackBonus: 2,
            ultimateZoneDurationMs: 18000
        },
        ownerText: '불꽃요정맛 쿠키 전용 — 부활 1회 추가(패시브 포함 총 3번). 3번째 부활부터는 화염 피해가 더 늘지 않는 대신 기본 공격력이 +2 됩니다. 궁극기 화염지대 유지시간 15초 → 18초.'
    },
    // ---- 등급 x 종류 채우기 (각성 장비 제외, 등급별 5종류 모두 하나씩) ----
    // ---- 일반 ----
    rusty_sword: { name: '녹슨 검', slot: 'weapon', grade: '일반', icon: '🗡', bonusAttack: 1 },
    leather_hood: { name: '가죽 두건', slot: 'helmet', grade: '일반', icon: '🧢', bonusHealth: 5 },
    linen_robe: { name: '삼베 옷', slot: 'armor', grade: '일반', icon: '🦺', bonusHealth: 8, bonusDamageTaken: 0.98 },
    cotton_pants: { name: '무명 바지', slot: 'leggings', grade: '일반', icon: '👖', bonusHealth: 6, bonusDamageTaken: 0.99 },
    straw_sandals: { name: '짚신', slot: 'boots', grade: '일반', icon: '🩴', bonusHealth: 5, bonusDamageTaken: 0.99 },
    // ---- 희귀 ----
    silver_axe: { name: '은도끼', slot: 'weapon', grade: '희귀', icon: '⛏', bonusAttack: 2, bonusCooldown: 0.96 },
    spiked_helm: { name: '가시 투구', slot: 'helmet', grade: '희귀', icon: '🪖', bonusHealth: 12, bonusAttack: 1 },
    steel_plate: { name: '강철 판금', slot: 'armor', grade: '희귀', icon: '🛡', bonusHealth: 20, bonusDamageTaken: 0.96 },
    spiked_greaves: { name: '가시 각반', slot: 'leggings', grade: '희귀', icon: '🦵', bonusHealth: 13, bonusCooldown: 0.97 },
    wind_shoes: { name: '바람의 신발', slot: 'boots', grade: '희귀', icon: '👟', bonusHealth: 9, bonusSpeed: 2 },
    // ---- 에픽 ----
    ice_spear: { name: '얼음 창', slot: 'weapon', grade: '에픽', icon: '🔱', bonusAttack: 3, bonusCooldown: 0.94 },
    flame_helm: { name: '화염 투구', slot: 'helmet', grade: '에픽', icon: '⛑', bonusHealth: 20, bonusAttack: 1 },
    spirit_armor: { name: '정령의 갑옷', slot: 'armor', grade: '에픽', icon: '🛡', bonusHealth: 28, bonusDamageTaken: 0.94 },
    storm_greaves: { name: '폭풍의 각반', slot: 'leggings', grade: '에픽', icon: '🦿', bonusHealth: 22, bonusSpeed: 3 },
    gale_boots: { name: '질풍 부츠', slot: 'boots', grade: '에픽', icon: '🥾', bonusHealth: 16, bonusSpeed: 4 },
    // ---- 레전더리 (어둠 세트와 짝을 이루는 빛 세트) ----
    light_blade: { name: '빛의 대검', slot: 'weapon', grade: '레전더리', icon: '⚔', bonusAttack: 6, bonusCooldown: 0.89 },
    light_crown: { name: '빛의 왕관', slot: 'helmet', grade: '레전더리', icon: '👑', bonusHealth: 28, bonusAttack: 2, bonusCooldown: 0.93 },
    light_mantle: { name: '빛의 갑옷', slot: 'armor', grade: '레전더리', icon: '🧥', bonusHealth: 36, bonusDamageTaken: 0.9 },
    light_greaves: { name: '빛의 각반', slot: 'leggings', grade: '레전더리', icon: '🦿', bonusHealth: 28, bonusCooldown: 0.92 },
    light_boots: { name: '빛의 장화', slot: 'boots', grade: '레전더리', icon: '🥾', bonusHealth: 26, bonusSpeed: 5 }
};

// 각성한 쿠키는 awakenedForm에 적힌 항목만 그 값으로 바뀜다. 적혀 있지
// 않은 항목은 원래 수치를 그대로 쓴다.
function formStat(character, awakened, key) {
    if (awakened && character.awakenedForm && character.awakenedForm[key] != null) {
        return character.awakenedForm[key];
    }
    return character[key];
}

// 부활 횟수는 패시브 + 각성 장비.
function reviveCountFor(character, equipRevive) {
    return (character.passiveReviveCount || 0) + (equipRevive || 0);
}

function equipmentFor(id) {
    return (id && Object.prototype.hasOwnProperty.call(EQUIPMENT, id)) ? EQUIPMENT[id] : null;
}

// 전용 효과가 지금 이 쿠키에게 발동하는가.
function ownerBonusActive(item, charType) {
    return !!(item && item.ownerChar && item.ownerChar === charType && item.ownerBonus);
}

// ---- 각성 장비 ----
// 각성 장비 중에는 능력치를 더하는 게 아니라 캐릭터 수치를 통째로 바꾸는 것이
// 있다 (발차기 피해나 궁극기 보호막처럼 bonusAttack/bonusHealth로는 표현할 수
// 없는 것들). 지금 각성 칸에 끼고 있고 주인이 맞을 때만 읽는다.
function awakenGearFor(charType, equipped) {
    if (!equipped) return null;
    const base = CHARACTERS[charType];
    if (!base || !hasAwakenSlot(base.grade)) return null;
    const worn = equipEntryOf(equipped[AWAKEN_SLOT.key]);
    const item = worn && equipmentFor(worn.id);
    if (!item || item.slot !== AWAKEN_SLOT.key) return null;
    if (item.ownerChar && item.ownerChar !== charType) return null;
    return item;
}

// 각성 장비를 반영한 캐릭터 수치. 바꿀 게 없으면 원본을 그대로 돌려준다
// (사본을 만들지 않으므로 === 비교도 그대로 통한다).
function characterWithGear(charType, equipped) {
    const base = CHARACTERS[charType];
    if (!base) return base;
    const gear = awakenGearFor(charType, equipped);
    if (!gear || !gear.awakenForm) return base;
    return Object.assign({}, base, gear.awakenForm);
}

// ---- 장비 강화 ----
// 재료 + 코인을 써서 장비의 Lv를 올린다. 올라갈수록 성공 확률이 떨어지고,
// 강화포션을 쓰면 확률을 건너뛰고 무조건 성공한다. 실패해도 레벨이 내려가지는
// 않는다 -- 재료와 코인만 날아간다.
const EQUIP_MAX_LEVEL = 5;
const EQUIP_BONUS_KEYS = ['bonusAttack', 'bonusHealth', 'bonusSpeed', 'bonusDamageTaken', 'bonusCooldown', 'bonusRevive'];
// [Lv0->1, Lv1->2, ...]
const EQUIP_UPGRADE_STEPS = [
    { material: 1, coins: 100, chance: 1 },
    { material: 2, coins: 200, chance: 0.8 },
    { material: 3, coins: 400, chance: 0.65 },
    { material: 5, coins: 700, chance: 0.5 },
    { material: 8, coins: 1200, chance: 0.35 }
];

// 희귀 이상은 고급 재료 / 고급 포션을 쓴다.
function equipUsesRareMaterial(grade) {
    const idx = GRADE_ORDER.indexOf(grade);
    return idx >= 0 && idx >= GRADE_ORDER.indexOf('희귀');
}

// 지금 레벨에서 한 단계 올리는 데 드는 것. 최대치면 null.
function equipUpgradeCost(item, level) {
    const lv = Math.max(0, Math.floor(level || 0));
    if (!item || lv >= EQUIP_MAX_LEVEL) return null;
    const step = EQUIP_UPGRADE_STEPS[lv];
    const rare = equipUsesRareMaterial(item.grade);
    return {
        from: lv, to: lv + 1,
        materialKey: rare ? 'materialRare' : 'material',
        material: step.material,
        coins: step.coins,
        chance: step.chance,
        potionKey: rare ? 'potionRare' : 'potion',
        potion: 1
    };
}

// Lv당 능력치가 25%씩 커진다. 배수형(받는 피해 / 재사용 대기시간)은 "줄어드는
// 폭"이 그만큼 커지고, 부활 횟수는 강화로 늘지 않는다.
function equipLevelScale(level) {
    return 1 + 0.25 * Math.max(0, Math.floor(level || 0));
}

function scaledBonus(key, value, level) {
    const lv = Math.max(0, Math.floor(level || 0));
    if (!lv || !value) return value;
    if (key === 'bonusRevive') return value;
    if (key === 'bonusDamageTaken' || key === 'bonusCooldown') {
        const cut = (1 - value) * equipLevelScale(lv);
        return Math.max(0.5, Math.round((1 - cut) * 1000) / 1000);
    }
    return Math.round(value * equipLevelScale(lv));
}

// 화면에 보여줄 용도: 이 레벨에서의 능력치만 담은 사본.
function equipStatsAtLevel(src, level) {
    const out = {};
    if (!src) return out;
    EQUIP_BONUS_KEYS.forEach(k => {
        if (src[k]) out[k] = scaledBonus(k, src[k], level);
    });
    return out;
}

// 장착 정보 한 칸을 { id, level }로 정규화한다. 그냥 문자열이면 Lv0.
// 클라이언트가 보낸 값이 여기로 들어오므로 레벨은 여기서 잘라낸다.
function equipEntryOf(v) {
    if (typeof v === 'string') return { id: v, level: 0 };
    if (v && typeof v === 'object' && typeof v.id === 'string') {
        let lv = Number(v.level);
        if (!Number.isFinite(lv) || lv < 0) lv = 0;
        return { id: v.id, level: Math.min(EQUIP_MAX_LEVEL, Math.floor(lv)) };
    }
    return null;
}

// 장착한 장비 id 목록({slot: itemId})을 합산해 하나의 보너스로 만든다.
// 슬롯이 안 맞는 id나 없는 id는 그냥 무시한다 -- 서버가 클라이언트가 보낸
// 것을 검증하는 자리이기도 하다.
function equipBonusFor(equipped, charType) {
    const out = { attack: 0, health: 0, speed: 0, damageTaken: 1, cooldown: 1, revive: 0 };
    if (!equipped) return out;
    // 각성 칸은 등급이 되는 쿠키에게만 있다. 등급이 모자라면 가방에
    // 모자가 있어도 아예 슬롯 자체가 없으므로 읽지 않는다.
    const slots = hasAwakenSlot((CHARACTERS[charType] || {}).grade)
        ? EQUIP_SLOT_KEYS.concat(AWAKEN_SLOT.key)
        : EQUIP_SLOT_KEYS;
    for (const slot of slots) {
        const worn = equipEntryOf(equipped[slot]);
        const item = worn && equipmentFor(worn.id);
        if (!item || item.slot !== slot) continue;
        const lv = worn.level;
        const parts = ownerBonusActive(item, charType) ? [item, item.ownerBonus] : [item];
        for (const p of parts) {
            if (p.bonusAttack) out.attack += scaledBonus('bonusAttack', p.bonusAttack, lv);
            if (p.bonusHealth) out.health += scaledBonus('bonusHealth', p.bonusHealth, lv);
            if (p.bonusSpeed) out.speed += scaledBonus('bonusSpeed', p.bonusSpeed, lv);
            if (p.bonusDamageTaken) out.damageTaken *= scaledBonus('bonusDamageTaken', p.bonusDamageTaken, lv);
            if (p.bonusCooldown) out.cooldown *= scaledBonus('bonusCooldown', p.bonusCooldown, lv);
            if (p.bonusRevive) out.revive += p.bonusRevive;
        }
    }
    // 속도가 0 이하가 되면 움직일 수 없으므로 바닥을 둔다.
    out.speed = Math.round(out.speed * 100) / 100;
    return out;
}

// ==================== 각성모드 ====================
// 각성 장비를 얻는 전용 모드. 어떤 쿠키의 각성 장비를 노릴지 고르면 그 쿠키의
// **보스 버전**과 싸운다 -- 보스는 그 쿠키를 그대로 쓰고 레벨별 스탯만 더한다.
// 파티는 3명이고 혼자 한다. 레벨은 순서 잠금 없이 아무거나 고를 수 있다.
// 11층부터는 스토리도 쿠키 두 명을 데려간다 (멀티도 각자 두 명씩).
// 그 아래 층은 지금까지처럼 한 명이다.
const STORY_PARTY_FROM_FLOOR = 11;
const STORY_PARTY_SIZE = 2;
function storyPartySizeFor(floor) {
    const n = Number(floor);
    return Number.isInteger(n) && n >= STORY_PARTY_FROM_FLOOR ? STORY_PARTY_SIZE : 1;
}

const AWAKEN_PARTY_SIZE = 3;
const AWAKEN_MAX_LEVEL = 10;

// 레벨마다 보스에게 더해지는 값. 적힌 것만 붙는다.
//   attack / health / speed        더하기
//   damageTaken                    받는 피해 배수 (0.9 = 10%만큼 덜 받음)
//   regenAmount / regenIntervalMs  그 간격마다 그만큼 회복
// 5레벨 체력이 4레벨보다 낮고 6레벨 공격력이 5레벨보다 낮은 것은 **일부러**
// 그런 것이다 (유누가 "그전 레벨보다 줄어든 거 맞음"이라고 확인했다).
// 받는 피해 90%는 4레벨과 10레벨에만 붙고 쌓이지 않는다.
const AWAKEN_BOSS_LEVELS = {
    1: { attack: 5, health: 70 },
    2: { attack: 10, health: 100 },
    3: { attack: 13, health: 110, speed: 1 },
    4: { attack: 15, health: 150, speed: 1.3, damageTaken: 0.9 },
    5: { attack: 30, health: 120, speed: 1.5 },
    6: { attack: 20, health: 180, speed: 1 },
    7: { attack: 23, health: 200, regenAmount: 2, regenIntervalMs: 10000 },
    8: { attack: 23, health: 230, speed: 2, regenAmount: 2, regenIntervalMs: 5000 },
    9: { attack: 27, health: 250, speed: 2, regenAmount: 2, regenIntervalMs: 5000 },
    10: { attack: 30, health: 300, speed: 1.5, regenAmount: 2, regenIntervalMs: 5000, damageTaken: 0.9 }
};
function awakenLevelStats(level) {
    return AWAKEN_BOSS_LEVELS[Number(level)] || null;
}

// 위 표만으로는 보스가 너무 물러서, 모든 레벨에 체력을 똑같이 더 얹는다.
// 레벨마다 쌓이는 게 아니라 각 레벨 값에 한 번씩만 붙는다.
// 부활하는 보스(번개악마맛·번개지옥맛)는 한 번 더 일어나므로 300,
// 한 번에 끝나는 보스는 그만큼 손해라 500을 준다.
const AWAKEN_BOSS_EXTRA_HEALTH = 300;
const AWAKEN_BOSS_EXTRA_HEALTH_NO_REVIVE = 500;
function awakenBossExtraHealth(charType) {
    const base = CHARACTERS[charType];
    return (base && base.passiveReviveCount)
        ? AWAKEN_BOSS_EXTRA_HEALTH
        : AWAKEN_BOSS_EXTRA_HEALTH_NO_REVIVE;
}
function awakenLevelHealthBonus(charType, level) {
    const stats = awakenLevelStats(level);
    if (!stats) return 0;
    return (stats.health || 0) + awakenBossExtraHealth(charType);
}
function awakenBossMaxHp(charType, level) {
    const base = CHARACTERS[charType];
    if (!base || !awakenLevelStats(level)) return null;
    return base.health + awakenLevelHealthBonus(charType, level);
}

// 각성 칸을 가진 쿠키가 곧 각성모드에 나오는 보스다. 새 쿠키가 에이션트 이상으로
// 들어오면 목록에 저절로 늘어난다 -- 여기에 이름을 적어 두지 않는다.
// 각성모드 보스가 되는 쿠키 = 전용 각성 장비가 실제로 있는 쿠키. 각성 칸이
// 있는 등급이라도 아직 장비가 없으면(바다펄맛처럼) 싸울 이유가 없으므로
// 목록에 넣지 않는다 -- 장비를 만들어 주면 그때 저절로 나타난다.
function awakenBossCharTypes() {
    const owners = new Set(awakenEquipmentIds()
        .map(id => EQUIPMENT[id].ownerChar).filter(Boolean));
    return Object.keys(CHARACTERS)
        .filter(id => hasAwakenSlot(CHARACTERS[id].grade) && owners.has(id));
}
function awakenEquipmentIds() {
    return Object.keys(EQUIPMENT).filter(id => EQUIPMENT[id].slot === AWAKEN_SLOT.key);
}

// ---- 보스마다의 특수스킬 · 궁극기 · 움직임 ----
// 유누가 보스를 하나씩 정해서 준다. 아직 안 받은 보스는 null로 비워 두고,
// 그때까지는 그 쿠키의 기본공격만 한다 (이벤트 보스를 비워 둔 것과 같은 방식).
// 구간으로 적은 것을 레벨 -> 값 표로 편다. [{upTo, value}, ...]는 위에서부터
// 처음 맞는 칸을 쓴다. 열 줄짜리 표를 손으로 적지 않으려고 둔 것.
function levelRamp(steps) {
    const out = {};
    for (let lv = 1; lv <= AWAKEN_MAX_LEVEL; lv++) {
        const step = steps.find(s => lv <= s.upTo) || steps[steps.length - 1];
        out[lv] = step.value;
    }
    return out;
}

const AWAKEN_BOSSES = {
    lightningdevil: {
        // 순간이동(blink_heal)은 레벨이 올라도 그대로다 -- 강해지지 않는다.
        skill: { perLevel: null },
        // 크게베기는 레벨마다 피해가 5씩 오른다. 10레벨이면 50 -> 100.
        ultimate: { damagePerLevel: 5 },
        movement: null
    },
    lightninghell: {
        // 지진도 번개악마의 궁극기와 똑같이 레벨마다 5씩. 10레벨이면 15 -> 65.
        skill: { damagePerLevel: 5 },
        ultimate: {
            // 궁극기 중의 기본공격이 오르는 폭. 1~5레벨 +2, 6~10레벨 +4.
            attackDamageBonus: levelRamp([{ upTo: 5, value: 2 }, { upTo: 10, value: 4 }]),
            // 부하 수: 4레벨까지는 원래대로 4마리, 5~9레벨 5마리, 10레벨 6마리.
            summonCount: levelRamp([{ upTo: 4, value: 4 }, { upTo: 9, value: 5 }, { upTo: 10, value: 6 }]),
            // 부하 체력: 1~5레벨 40, 6~10레벨 50 (원래는 30).
            summonHealth: levelRamp([{ upTo: 5, value: 40 }, { upTo: 10, value: 50 }])
        },
        movement: null
    },
    blacksugar: {
        // 끌어오기(pull_in)는 그대로 -- 레벨이 올라도 안 세진다.
        skill: { perLevel: null },
        // 보호막과 즉시 회복이 둘 다 레벨마다 5씩 오른다 (번개악마 궁극기와
        // 같은 방식). 10레벨이면 회복 20 -> 70, 보호막 70 -> 120.
        ultimate: { healAmountPerLevel: 5, shieldAmountPerLevel: 5 },
        movement: null
    },
    dragonfruit: {
        skill: {
            // 크게베기 피해 = 그 레벨에서의 기본공격력 + 레벨.
            // (5레벨이면 기본공격력 + 5, 10레벨이면 + 10)
            damageFromAttackPlusLevel: true,
            // 맞히면 회복하는 양이 레벨마다 5씩 (15 -> 10레벨 65).
            healOnHitPerLevel: 5
        },
        // 보호(궁극기)는 회복과 보호막이 둘 다 레벨마다 7씩.
        // 회복은 원래 "최대 체력의 25%"라 비율은 그대로 두고 레벨 × 7만큼
        // 더 회복한다. 보호막은 40 -> 10레벨 110.
        ultimate: { healAmountPerLevel: 7, shieldAmountPerLevel: 7 },
        passive: {
            // 화염 피해 총량이 2 + 레벨 (원래 2). 나눠 들어가는 횟수는 그대로다.
            burnTotalPerLevel: 1,
            // 적중할 때마다 회복하는 양이 레벨만큼 (원래 1).
            attackHealEqualsLevel: true
        },
        movement: null
    },
    orangelemon: {
        // 발차기 피해가 레벨마다 2씩. 10 -> 10레벨 30.
        skill: { damagePerLevel: 2 },
        // 각성(궁극기)은 그대로 둔다.
        ultimate: null,
        movement: null
    }
};
function awakenBossSpec(charType) {
    return AWAKEN_BOSSES[charType] || null;
}
function awakenLevelOf(level) {
    const lv = Math.max(0, Math.floor(Number(level) || 0));
    return Math.min(AWAKEN_MAX_LEVEL, lv);
}

// 그 레벨에서 보스의 궁극기 피해. damagePerLevel이 없으면 쿠키 원래 값 그대로.
function awakenBossUltimateDamage(charType, level) {
    const base = CHARACTERS[charType];
    if (!base || base.ultimateDamage == null) return null;
    const spec = AWAKEN_BOSSES[charType];
    const per = spec && spec.ultimate && spec.ultimate.damagePerLevel;
    if (!per) return base.ultimateDamage;
    return base.ultimateDamage + per * awakenLevelOf(level);
}

// 그 레벨에서 보스의 기본공격력. 쿠키의 원래 공격력에 레벨 표의 공격력을 더한다.
function awakenBossAttackDamage(charType, level) {
    const base = CHARACTERS[charType];
    if (!base) return null;
    const stats = awakenLevelStats(awakenLevelOf(level)) || {};
    const own = base.attackDamage != null ? base.attackDamage : 0;
    return own + (stats.attack || 0);
}

// 특수스킬 피해. 레벨마다 얼마씩 오르거나(번개지옥), 기본공격력을 따라가거나
// (용과맛), 아예 그대로다(번개악마·블랙슈거).
function awakenBossSkillDamage(charType, level) {
    const base = CHARACTERS[charType];
    if (!base) return null;
    const spec = AWAKEN_BOSSES[charType];
    const skill = spec && spec.skill;
    if (skill && skill.damageFromAttackPlusLevel) {
        return awakenBossAttackDamage(charType, level) + awakenLevelOf(level);
    }
    if (base.skillDamage == null) return null;
    const per = skill && skill.damagePerLevel;
    if (!per) return base.skillDamage;
    return base.skillDamage + per * awakenLevelOf(level);
}

// 특수스킬이 맞았을 때의 회복량 (용과맛 크게베기).
function awakenBossSkillHealOnHit(charType, level) {
    const base = CHARACTERS[charType];
    if (!base || base.skillHealOnHit == null) return null;
    const spec = AWAKEN_BOSSES[charType];
    const per = spec && spec.skill && spec.skill.healOnHitPerLevel;
    if (!per) return base.skillHealOnHit;
    return base.skillHealOnHit + per * awakenLevelOf(level);
}

// 패시브 화염 피해의 **총량**. 실제로는 attackBurnTicks번에 나눠 들어간다.
function awakenBossBurnTotal(charType, level) {
    const base = CHARACTERS[charType];
    if (!base || base.attackBurnDamage == null) return null;
    const own = base.attackBurnDamage * (base.attackBurnTicks || 1);
    const spec = AWAKEN_BOSSES[charType];
    const per = spec && spec.passive && spec.passive.burnTotalPerLevel;
    if (!per) return own;
    return own + per * awakenLevelOf(level);
}

// 적중할 때마다 회복하는 패시브 (용과맛).
function awakenBossAttackHeal(charType, level) {
    const base = CHARACTERS[charType];
    if (!base || base.attackHealOnUse == null) return null;
    const spec = AWAKEN_BOSSES[charType];
    if (spec && spec.passive && spec.passive.attackHealEqualsLevel) {
        return awakenLevelOf(level);
    }
    return base.attackHealOnUse;
}

// 궁극기를 쓰는 동안의 기본공격 피해 (번개지옥맛의 죽지않는 영혼 같은 것).
function awakenBossUltimateAttackDamage(charType, level) {
    const base = CHARACTERS[charType];
    if (!base || base.ultimateAttackDamage == null) return null;
    const spec = AWAKEN_BOSSES[charType];
    const table = spec && spec.ultimate && spec.ultimate.attackDamageBonus;
    if (!table) return base.ultimateAttackDamage;
    return base.ultimateAttackDamage + (table[awakenLevelOf(level)] || 0);
}

// 궁극기의 즉시 회복량과 보호막 (블랙 슈거맛의 guard_surge 같은 것).
function awakenBossUltimateHealAmount(charType, level) {
    const base = CHARACTERS[charType];
    if (!base) return null;
    const spec = AWAKEN_BOSSES[charType];
    const per = spec && spec.ultimate && spec.ultimate.healAmountPerLevel;
    // 용과맛처럼 원래는 비율(%)로만 회복하는 보스도 레벨만큼 더 회복하므로,
    // 정해진 회복량이 없으면 0에서 시작한다.
    if (per) return (base.ultimateHealAmount || 0) + per * awakenLevelOf(level);
    return base.ultimateHealAmount != null ? base.ultimateHealAmount : null;
}
function awakenBossUltimateShield(charType, level) {
    const base = CHARACTERS[charType];
    if (!base || base.ultimateShieldAmount == null) return null;
    const spec = AWAKEN_BOSSES[charType];
    const per = spec && spec.ultimate && spec.ultimate.shieldAmountPerLevel;
    if (!per) return base.ultimateShieldAmount;
    return base.ultimateShieldAmount + per * awakenLevelOf(level);
}

// 궁극기가 부르는 부하의 수와 체력.
function awakenBossSummonCount(charType, level) {
    const base = CHARACTERS[charType];
    if (!base || base.ultimateSummonCount == null) return null;
    const spec = AWAKEN_BOSSES[charType];
    const table = spec && spec.ultimate && spec.ultimate.summonCount;
    if (!table) return base.ultimateSummonCount;
    return table[awakenLevelOf(level)] || base.ultimateSummonCount;
}
function awakenBossSummonHealth(charType, level) {
    const base = CHARACTERS[charType];
    const summon = base && base.ultimateSummon;
    if (!summon || summon.health == null) return null;
    const spec = AWAKEN_BOSSES[charType];
    const table = spec && spec.ultimate && spec.ultimate.summonHealth;
    if (!table) return summon.health;
    return table[awakenLevelOf(level)] || summon.health;
}

// ---- 각성모드 보상 ----
// 1~5레벨은 조각을 주고, 조각 AWAKEN_FRAGMENT_GOAL개가 모이면 "랜덤 각성 장비"
// 하나로 바뀐다. 6~10레벨은 각성 장비가 확률로 바로 나온다 (꽝이면 재화만).
const AWAKEN_FRAGMENT_KEY = 'awakenFragment';
const AWAKEN_GEAR_ITEM_KEY = 'randomAwakenGear';
const AWAKEN_FRAGMENT_GOAL = 30;
const AWAKEN_LEVEL_DROPS = {
    1: { fragmentMin: 0, fragmentMax: 1 },
    2: { fragmentMin: 1, fragmentMax: 2 },
    3: { fragmentMin: 2, fragmentMax: 3 },
    4: { fragmentMin: 3, fragmentMax: 4 },
    5: { fragmentMin: 4, fragmentMax: 5 },
    // 6~10레벨은 꽝이어도 빈손으로 보내지 않는다: 조각을 (레벨 - 3)개 준다.
    6: { gearChance: 0.10, missFragments: 3 },
    7: { gearChance: 0.20, missFragments: 4 },
    8: { gearChance: 0.35, missFragments: 5 },
    9: { gearChance: 0.55, missFragments: 6 },
    10: { gearChance: 0.90, missFragments: 7 }
};
function awakenLevelDrop(level) {
    return AWAKEN_LEVEL_DROPS[Number(level)] || null;
}

// 그 쿠키의 각성 장비. 각성 장비는 전부 쿠키 전용이라 주인으로 찾으면 된다.
function awakenGearIdOf(charType) {
    return awakenEquipmentIds().find(id => EQUIPMENT[id].ownerChar === charType) || null;
}

// 한 판을 깼을 때의 드랍을 굴린다. rand는 테스트에서 갈아 끼울 수 있게 받는다.
// 1~5레벨은 조각만, 6~10레벨은 확률로 **그 보스 쿠키의** 각성 장비가 나오고,
// 꽝이면 조각으로 보상한다.
function rollAwakenDrop(level, charType, rand) {
    const drop = awakenLevelDrop(level);
    if (!drop) return { fragments: 0, gearId: null };
    const r = rand || Math.random;
    if (drop.gearChance != null) {
        if (r() < drop.gearChance) {
            return { fragments: 0, gearId: awakenGearIdOf(charType) };
        }
        return { fragments: drop.missFragments || 0, gearId: null };
    }
    const lo = drop.fragmentMin || 0;
    const hi = drop.fragmentMax || 0;
    return { fragments: lo + Math.floor(r() * (hi - lo + 1)), gearId: null };
}

// 재화 보상은 유누가 따로 정하지 않아서 레벨에 비례하게 잡았다. 6레벨부터는
// 고급 재료/고급 포션으로 바꾼다.
function awakenLevelReward(level) {
    const lv = Number(level);
    if (!AWAKEN_BOSS_LEVELS[lv]) return null;
    const bag = { coins: 200 * lv, diamonds: 5 * lv };
    if (lv >= 6) {
        bag.materialRare = 2 * (lv - 5);
        bag.potionRare = lv - 5;
    } else {
        bag.material = 3 * lv;
        bag.potion = 2 * lv;
    }
    return bag;
}

// 각성모드 한 판은 스토리 층과 같은 모양의 "판"으로 만든다. 그래야 이미 있는
// 스토리 전투(이동·공격·스킬·궁극기·부하·표식)를 그대로 쓸 수 있다.
// 다만 길이 아니라 넓은 마당이고, 안에는 보스 하나뿐이며, 별 대신 보스를
// 쓰러뜨리면 이긴다(winOnClear).
const AWAKEN_FLOOR_PREFIX = 'awaken';
const AWAKEN_ARENA_LENGTH = 900;
const AWAKEN_ARENA_HALF_WIDTH = 260;
function awakenFloorKey(charType, level) {
    return `${AWAKEN_FLOOR_PREFIX}:${charType}:${awakenLevelOf(level)}`;
}
function parseAwakenFloorKey(key) {
    const m = /^awaken:([a-z_]+):(\d+)$/.exec(String(key || ''));
    if (!m) return null;
    const base = CHARACTERS[m[1]];
    // 각성 칸이 있는 쿠키만 보스가 된다. 아무 쿠키 이름이나 보내도 판이
    // 열리지 않게 여기서 막는다 -- 안 막으면 등록되지 않은 몬스터를 만들려다
    // 서버가 죽는다.
    if (!base || !hasAwakenSlot(base.grade) || !AWAKEN_BOSS_LEVELS[Number(m[2])]) return null;
    return { charType: m[1], level: Number(m[2]) };
}

// 보스를 몬스터 한 마리로 적는다. 쿠키를 그대로 쓰고 레벨 스탯만 얹는다.
function awakenBossMonsterType(charType, level) {
    return `awakenboss_${charType}_${awakenLevelOf(level)}`;
}
function awakenBossMonsterDef(charType, level) {
    const base = CHARACTERS[charType];
    const stats = awakenLevelStats(level);
    if (!base || !stats) return null;
    const def = {
        name: `${base.name} 보스`,
        color: base.color,
        colorLeft: base.colorLeft,
        colorRight: base.colorRight,
        health: awakenBossMaxHp(charType, level),
        speed: (base.speed || 2) + (stats.speed || 0),
        aggroRange: 900,
        preferredDistance: Math.max(40, (base.attackRange || 90) - 20),
        attackRange: (base.attackRange || 90) + 20,
        attackDamage: awakenBossAttackDamage(charType, level),
        attackCooldown: Math.max(400, base.attackCooldown || 500),
        telegraphMs: 350,
        // 레벨 표에서 오는 것들.
        damageTaken: stats.damageTaken || 1,
        regenAmount: stats.regenAmount || 0,
        regenIntervalMs: stats.regenIntervalMs || 0,
        // 화면에 이 쿠키의 얼굴로 그리라고 알려 준다.
        awakenCharType: charType,
        awakenLevel: awakenLevelOf(level)
    };
    const burn = awakenBossBurnTotal(charType, level);
    if (burn) {
        const ticks = base.attackBurnTicks || 2;
        def.burnDamage = Math.max(1, Math.round(burn / ticks));
        def.burnTicks = ticks;
        def.burnIntervalMs = base.attackBurnIntervalMs || 1000;
    }
    return def;
}

// 궁극기로 부하를 부르는 보스(번개지옥맛)의 부하도 몬스터 한 마리로 적는다.
// 보스와 똑같이 **미리** 표에 넣어 두어야 한다 -- 서버에서만 만들어 두면
// 화면이 이 type을 모르는 채로 그리려다 그림이 멈춘다.
function awakenMinionMonsterType(charType, level) {
    return `awakenminion_${charType}_${awakenLevelOf(level)}`;
}
function awakenMinionMonsterDef(charType, level) {
    const base = CHARACTERS[charType];
    const summon = base && base.ultimateSummon;
    if (!summon) return null;
    const health = awakenBossSummonHealth(charType, level);
    if (!health) return null;
    return {
        name: summon.name,
        color: summon.color,
        health,
        speed: summon.speed,
        aggroRange: 900,
        preferredDistance: Math.max(30, (summon.attackRange || 110) - 30),
        attackRange: summon.attackRange || 110,
        attackDamage: summon.attackDamage || 2,
        attackCooldown: summon.attackCooldown || 300,
        telegraphMs: 150
    };
}

// 보스 × 10레벨(과 그 부하)을 미리 몬스터 표에 넣어 둔다. 서버와 화면이 같은
// 표를 읽어야 이름과 색이 어긋나지 않는다.
(function registerAwakenBosses() {
    awakenBossCharTypes().forEach(charType => {
        for (let lv = 1; lv <= AWAKEN_MAX_LEVEL; lv++) {
            const def = awakenBossMonsterDef(charType, lv);
            if (def) MONSTERS[awakenBossMonsterType(charType, lv)] = def;
            const minion = awakenMinionMonsterDef(charType, lv);
            if (minion) MONSTERS[awakenMinionMonsterType(charType, lv)] = minion;
        }
    });
})();

function awakenFloorDef(charType, level) {
    return {
        levelType: 'bridge',
        levelLength: AWAKEN_ARENA_LENGTH,
        laneHalfWidth: AWAKEN_ARENA_HALF_WIDTH,
        gates: [],
        // 보스는 마당 안쪽에 서서 기다린다.
        monsters: [{ type: awakenBossMonsterType(charType, level), x: -600, y: 0, room: 0 }],
        // 별이 없다. 보스를 쓰러뜨리는 것이 곧 클리어다.
        winOnClear: true,
        awaken: { charType, level: awakenLevelOf(level) }
    };
}

const AWAKEN_FLOOR_CACHE = {};

// ==================== 아이템 ====================
// 재화(currencies)와 달리 "쓰는" 것들. 아이템창에 이 표대로 그려진다.
// goal이 있으면 그만큼 모였을 때 becomes로 바뀐다 (자동).
const ITEMS = {
    randomAwakenGear: {
        name: '랜덤 각성 장비', icon: '🎁',
        desc: '사용하면 각성 장비 하나가 무작위로 나옵니다.',
        usable: true
    },
    awakenFragment: {
        name: '각성 장비 조각', icon: '🧩',
        desc: '모으면 랜덤 각성 장비 하나로 바뀝니다.',
        goal: AWAKEN_FRAGMENT_GOAL,
        becomes: AWAKEN_GEAR_ITEM_KEY
    }
};
const ITEM_KEYS = Object.keys(ITEMS);

const SOUL_STONES_PER_CHARACTER = 100;

// 레전더리 뽑기. One banner per featured legendary, bought with ITS OWN ticket
// (earned from that element's 레전더리 이벤트 stages). It is the normal banner
// with exactly ONE change: the featured cookie sits at LEGENDARY_BANNER_RATE.
// 영혼석 behaves exactly as it does on the normal banner -- any cookie's stone,
// one at a time -- and keeps its normal rate.
const LEGENDARY_BANNER_RATE = 1.5; // %
// Where the featured cookie's share is taken from. 영혼석 deliberately keeps its
// full normal-banner rate, so the room is made in the commonest cookie grade
// instead -- that keeps the table at exactly 100 without touching what matters.
const LEGENDARY_BANNER_TAKEN_FROM = '일반';
const LEGENDARY_BANNERS = [
    { id: 'waterdrop', charType: 'waterdrop', icon: '💧', ticketKey: 'ticketWaterdrop', side: 'water' },
    { id: 'magma', charType: 'magma', icon: '🔥', ticketKey: 'ticketMagma', side: 'fire' },
    { id: 'lightning', charType: 'lightning', icon: '⚡', ticketKey: 'ticketLightning', side: 'lightning' }
];

// The banner's own table: the normal one with the featured cookie carved out of
// the 영혼석 share, so the listed numbers still add to 100.
function legendaryGachaTable(charType) {
    const base = { ...GACHA_TABLE };
    base[LEGENDARY_BANNER_TAKEN_FROM] -= LEGENDARY_BANNER_RATE;
    return { featured: LEGENDARY_BANNER_RATE, ...base };
}
function legendaryBannerFor(id) {
    return LEGENDARY_BANNERS.find(b => b.id === id) || null;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ARENA_RADIUS, BOSS_RADIUS, PLAYER_RADIUS, CHARACTERS, BOSS_DEFS, BOSS_LIST, MONSTER_RADIUS, monsterRadiusOf, SUMMON_RADIUS, STAR_RADIUS, PROJECTILE_RADIUS, PROJECTILE_MAX_LIFETIME_MS, MONSTERS, STORY_FLOOR_DEFS, GACHA_SOUL_STONE_KEY, GACHA_TABLE, DEMON_GACHA_KEY, DEMON_GACHA_RATES, demonGachaTable, EVENTS, EVENT, EVENT_STAGE_DEFS, allEventStages, allEventBosses, allEventPlayable, floorDefFor, isEventStage, SOUL_STONES_PER_CHARACTER, CLEAR_REWARDS, storyRewardKey, clearRewardFor, CLEAR_DROPS, clearDropsFor, TOWER_BOSS_EVERY, isTowerBossFloor, legendaryEquipmentIds, towerBossReward, EQUIP_SLOTS, EQUIP_SLOT_KEYS, EQUIPMENT, equipmentFor, ownerBonusActive, awakenGearFor, characterWithGear, equipBonusFor, EQUIP_MAX_LEVEL, EQUIP_BONUS_KEYS, EQUIP_UPGRADE_STEPS, equipUsesRareMaterial, equipUpgradeCost, equipLevelScale, scaledBonus, equipStatsAtLevel, equipEntryOf, GRADE_ORDER, AWAKEN_SLOT, hasAwakenSlot, formStat, reviveCountFor, STORY_PARTY_FROM_FLOOR, STORY_PARTY_SIZE, storyPartySizeFor, AWAKEN_PARTY_SIZE, AWAKEN_MAX_LEVEL, AWAKEN_BOSS_LEVELS, awakenLevelStats, AWAKEN_BOSS_EXTRA_HEALTH, AWAKEN_BOSS_EXTRA_HEALTH_NO_REVIVE, awakenBossExtraHealth, awakenLevelHealthBonus, awakenBossMaxHp, awakenBossCharTypes, awakenEquipmentIds, awakenFloorKey, parseAwakenFloorKey, awakenBossMonsterType, awakenBossMonsterDef, awakenMinionMonsterType, awakenMinionMonsterDef, AWAKEN_BOSSES, awakenBossSpec, awakenBossUltimateDamage, awakenBossSkillDamage, awakenBossAttackDamage, awakenBossSkillHealOnHit, awakenBossBurnTotal, awakenBossAttackHeal, awakenBossUltimateAttackDamage, awakenBossUltimateHealAmount, awakenBossUltimateShield, awakenBossSummonCount, awakenBossSummonHealth, AWAKEN_FRAGMENT_KEY, AWAKEN_GEAR_ITEM_KEY, AWAKEN_FRAGMENT_GOAL, AWAKEN_LEVEL_DROPS, awakenLevelDrop, rollAwakenDrop, awakenGearIdOf, awakenLevelReward, ITEMS, ITEM_KEYS, LEGENDARY_BANNERS, LEGENDARY_BANNER_RATE, LEGENDARY_BANNER_TAKEN_FROM, legendaryGachaTable, legendaryBannerFor, GUEST_ARENA_HALF_W, GUEST_ARENA_HALF_H, GUEST_PARTY_SIZE, GUEST_BOSS_DEFS, guestDefFor, BOSS3_COLOR_HONEST, BOSS3_COLOR_TRICK, BOSS3_PATTERN_DEFS, BOSS3_PHASES, boss3PhaseFor, boss3PatternStat, STORY_TOWER_BOSS_FLOOR, STORY_TOWER_BOSS_MONSTER, LEVEL_START_SLACK, floorAxis, alongOf, acrossOf, fromAlongAcross, clampToLane, pathSegs, pathLength, projectOnPath, pointOnPath, makePathFloor };
} else {
    window.SHARED = { ARENA_RADIUS, BOSS_RADIUS, PLAYER_RADIUS, CHARACTERS, BOSS_DEFS, BOSS_LIST, MONSTER_RADIUS, monsterRadiusOf, SUMMON_RADIUS, STAR_RADIUS, PROJECTILE_RADIUS, PROJECTILE_MAX_LIFETIME_MS, MONSTERS, STORY_FLOOR_DEFS, GACHA_SOUL_STONE_KEY, GACHA_TABLE, DEMON_GACHA_KEY, DEMON_GACHA_RATES, demonGachaTable, EVENTS, EVENT, EVENT_STAGE_DEFS, allEventStages, allEventBosses, allEventPlayable, floorDefFor, isEventStage, SOUL_STONES_PER_CHARACTER, CLEAR_REWARDS, storyRewardKey, clearRewardFor, CLEAR_DROPS, clearDropsFor, TOWER_BOSS_EVERY, isTowerBossFloor, legendaryEquipmentIds, towerBossReward, EQUIP_SLOTS, EQUIP_SLOT_KEYS, EQUIPMENT, equipmentFor, ownerBonusActive, awakenGearFor, characterWithGear, equipBonusFor, EQUIP_MAX_LEVEL, EQUIP_BONUS_KEYS, EQUIP_UPGRADE_STEPS, equipUsesRareMaterial, equipUpgradeCost, equipLevelScale, scaledBonus, equipStatsAtLevel, equipEntryOf, GRADE_ORDER, AWAKEN_SLOT, hasAwakenSlot, formStat, reviveCountFor, STORY_PARTY_FROM_FLOOR, STORY_PARTY_SIZE, storyPartySizeFor, AWAKEN_PARTY_SIZE, AWAKEN_MAX_LEVEL, AWAKEN_BOSS_LEVELS, awakenLevelStats, AWAKEN_BOSS_EXTRA_HEALTH, AWAKEN_BOSS_EXTRA_HEALTH_NO_REVIVE, awakenBossExtraHealth, awakenLevelHealthBonus, awakenBossMaxHp, awakenBossCharTypes, awakenEquipmentIds, awakenFloorKey, parseAwakenFloorKey, awakenBossMonsterType, awakenBossMonsterDef, awakenMinionMonsterType, awakenMinionMonsterDef, AWAKEN_BOSSES, awakenBossSpec, awakenBossUltimateDamage, awakenBossSkillDamage, awakenBossAttackDamage, awakenBossSkillHealOnHit, awakenBossBurnTotal, awakenBossAttackHeal, awakenBossUltimateAttackDamage, awakenBossUltimateHealAmount, awakenBossUltimateShield, awakenBossSummonCount, awakenBossSummonHealth, AWAKEN_FRAGMENT_KEY, AWAKEN_GEAR_ITEM_KEY, AWAKEN_FRAGMENT_GOAL, AWAKEN_LEVEL_DROPS, awakenLevelDrop, rollAwakenDrop, awakenGearIdOf, awakenLevelReward, ITEMS, ITEM_KEYS, LEGENDARY_BANNERS, LEGENDARY_BANNER_RATE, LEGENDARY_BANNER_TAKEN_FROM, legendaryGachaTable, legendaryBannerFor, GUEST_ARENA_HALF_W, GUEST_ARENA_HALF_H, GUEST_PARTY_SIZE, GUEST_BOSS_DEFS, guestDefFor, BOSS3_COLOR_HONEST, BOSS3_COLOR_TRICK, BOSS3_PATTERN_DEFS, BOSS3_PHASES, boss3PhaseFor, boss3PatternStat, STORY_TOWER_BOSS_FLOOR, STORY_TOWER_BOSS_MONSTER, LEVEL_START_SLACK, floorAxis, alongOf, acrossOf, fromAlongAcross, clampToLane, pathSegs, pathLength, projectOnPath, pointOnPath, makePathFloor };
}
