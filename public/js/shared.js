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
        color: '#ff6b9d', // pink, solid (no weapon)
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
        color: '#8e44ad', // purple, solid
        weaponShape: 'hook',
        weaponColor: '#ad1457', // 자주색 (magenta-purple hook)
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
        color: '#27ae60', // green, solid
        weaponShape: 'whip',
        weaponColor: '#e74c3c', // red whip
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
        color: '#e74c3c',
        colorLeft: '#e74c3c', // red
        colorRight: '#ffffff', // white
        weaponShape: 'shield',
        weaponColor: '#3498db', // blue shield
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
        color: '#2980b9', // blue, solid
        weaponShape: 'fist',
        weaponColor: '#e74c3c', // red volcano fist
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
        color: '#3498db', // blue, solid
        weaponShape: 'board',
        weaponColor: '#f1c40f', // yellow board
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
        color: '#e67e22', // orange, solid
        weaponShape: 'sword',
        weaponColor: '#e74c3c', // red lightning-sword
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
        color: '#1f6fb2', // blue, solid
        weaponShape: 'drop',
        weaponColor: '#5dade2', // giant blue water-drop
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
        color: '#a93226', // deep red, solid
        weaponShape: 'spear',
        weaponColor: '#e74c3c', // red spear
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
        weaponShape: 'club',
        weaponColor: '#27ae60', // 초록 막대 (green club)
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
        color: '#ff7ab6', // pink, solid
        weaponShape: 'sword',
        weaponColor: '#2ecc71', // 초록색 타오르는 검 (green flame sword)
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
        weaponShape: 'rollingpin',
        weaponColor: '#3498db', // 파랑 밀대
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
        color: '#e67e22', // 주황, solid
        weaponShape: 'greatsword',
        weaponColor: '#6c3483', // 보라빛 대검
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
        colorRight: '#7f8c8d', // 회색
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
        // 자색 고구마맛은 이제 보라 단색이라 더 이상 노랑+보라 조합이 겹치지 않는다.
        color: '#f1c40f',
        colorLeft: '#f1c40f', // 노랑
        colorRight: '#e67e22', // 주황
        weaponShape: 'dualswords',
        weaponColor: '#6c3483', // 보라빛 쌍검
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
        color: '#f1c40f',
        colorLeft: '#f1c40f', // 노랑
        colorRight: '#3d0a66', // 보라
        weaponShape: 'axe',
        weaponColor: '#6c3483', // 보라색 도끼
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
        color: '#e74c3c', // 빨강, solid
        weaponShape: 'shield',
        weaponColor: '#c0392b', // 빨간 방패
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
        attackBurnDamage: 2,
        attackBurnTicks: 6,
        attackBurnIntervalMs: 1000,
        // 패시브: 전투당 두 번 부활한다(항상 풀피). 부활할 때마다 화염 피해가
        // 1씩 늘어서 2 -> 3(1차 부활) -> 4(2차 부활)이 된다.
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
    },
    // 유누 엄마 신청작. 빛 속성 원거리 힐러 -- 이 게임에서 가장 두꺼운 몸으로
    // 멀리서 구슬을 퍼부으면서, 얼리기로 자힐하고 궁극기로 팀을 회복시키는 컨셉이다.
    plaincookie: {
        name: '쿠키맛 쿠키',
        shortName: '쿠키맛', // shown on the lobby's character-select button
        color: '#c8791b', // 갈색, solid
        weaponShape: 'orb',
        weaponColor: '#8b5a2b', // 갈색 쿠키구슬
        grade: '게스트',
        element: '빛',
        role: '힐러',
        health: 250,
        speed: 2,
        // 빛의 구슬 4개를 부채꼴로 쏘아, 저마다 가장 가까운 적을 스스로 쫓아
        // 간다. 유도탄이긴 하지만 사거리 안에 따라잡지 못하면 그냥 빗나가므로
        // 무조건 맞는 건 아니다 -- 실제 명중 판정은 서버의 homing steer가 맡는다.
        attackType: 'homing_burst',
        attackHoming: true,
        attackProjectileCount: 4,
        attackProjectileStaggerMs: 100, // 4발이 한 번에 안 나가고 0.1초 간격으로 하나씩 나간다
        attackProjectileSpreadDeg: 18, // 발사 순간 4발이 부채꼴로 퍼지는 각도
        attackProjectileRadius: 8,
        attackProjectileSpeed: 380,
        attackRange: 480,
        attackWidth: 40, // 몸 옆의 발사 이펙트 폭(장식용)
        attackDamage: 5, // 구슬 1개당 피해
        attackCooldown: 500,
        // 얼리기: 조준 없이 반경 안의 적을 그 자리에서 얼려 skillFreezeMs 동안
        // 아무 행동도 못 하게 한다. 자기 체력 회복은 적중 여부와 상관없이
        // 스킬을 쓰는 순간 항상 들어간다.
        skillType: 'freeze_burst',
        skillRange: 100,
        skillFreezeMs: 3000,
        skillSelfHeal: 100,
        skillCooldown: 10000,
        // 빛의 심판: 원하는 위치를 지정하면 원이 아니라 가로로 긴 띠 모양
        // 범위에 피해를 준다. 그 한 방으로 맞힌 적의 수 * ultimateHealPerEnemy
        // 만큼 팀 전체를 회복시킨다 (보스 레이드는 적이 하나뿐이라 최대 한
        // 번 분량이다).
        ultimateType: 'targeted_line_aoe',
        ultimateWidth: 480, // 가로 폭
        ultimateHeight: 90, // 세로 폭
        ultimateDamage: 40,
        ultimateHealPerEnemy: 50,
        ultimateRadius: 200, // 조준 UI/모바일 낙하 거리 계산용 (판정은 사각형)
        ultimateCooldownMs: 30000
    },
    // 빛 속성 원거리 마커. 치즈만두맛처럼 표식을 쌓기만 하고 자기 것은 먹지
    // 않는(keepsOwnMarks) 컨셉을 원거리로 옮긴 버전 -- 던지는 펄이 스스로
    // 피해를 크게 뽑기보다는, 팀 딜러들이 먹을 표식을 계속 깔아 주는 역할이다.
    bubbletea: {
        name: '버블티맛 쿠키',
        shortName: '버블티', // shown on the lobby's character-select button
        color: '#a9744f',
        colorLeft: '#6f4423', // 갈색 밀크티
        colorRight: '#f3e0c4', // 크림/타피오카
        grade: '에픽',
        element: '빛',
        role: '스트라이커',
        health: 100,
        speed: 2,
        // 버블티 펄 던지기: 실제로 날아가는 투사체라 빗나갈 수 있다. 맞을
        // 때마다 빛 표식을 attackMarkUses번 쌓지만, keepsOwnMarks라 자기
        // 스스로는 그 표식을 먹지(소모하지) 않는다.
        attackType: 'throw_projectile',
        attackProjectileRadius: 9,
        attackProjectileSpeed: 480,
        attackRange: 480,
        attackDamage: 5,
        attackCooldown: 500,
        attackMarkUses: 1,
        attackMarkMultiplier: 1.5,
        keepsOwnMarks: true,
        // 큰 거 던지기: 치즈만두맛의 만두 주먹(mark_punch)과 같은 방식으로
        // 전방의 적 전부(관통)에게 표식을 15개나 박는다. burst 계열 필드가
        // 없어서 표식을 터뜨리진 않고, 그 한 방의 피해는 5로 고정이다.
        skillType: 'mark_punch',
        skillRange: 320,
        skillWidth: 70,
        skillDamage: 5,
        skillMarkUses: 15,
        skillMarkMultiplier: 1.5,
        skillCooldown: 10000,
        // 무한: 오렌지 레몬맛과 같은 awakening_rapid를 발차기 없이 그대로
        // 쓴다 -- 10초 동안 기본 공격의 재사용 대기시간이 사실상 사라진다.
        ultimateType: 'awakening_rapid',
        ultimateDurationMs: 10000,
        ultimateRapidCooldown: 100,
        ultimateCooldownMs: 30000
    },
    // 레전더리 이벤트 한정(바람 side). 빛 속성 원거리 힐러 -- 기본 공격 자체가
    // 팀을 회복시키고, 특수스킬은 조준 없는 팀 지속회복, 궁극기는 쓸 때마다
    // 강해지는 3단계 각성(바다펄맛의 밀물처럼 순환하되, 자리는 스킬이 아니라
    // 궁극기)이다.
    windarcher: {
        name: '바람궁수맛 쿠키',
        shortName: '바람궁수', // shown on the lobby's character-select button
        color: '#2ecc71',
        colorLeft: '#27ae60', // 진한 초록
        colorRight: '#82e0aa', // 연한 초록
        weaponShape: 'bow',
        weaponColor: '#27ae60',
        grade: '레전더리',
        element: '빛',
        role: '힐러',
        seasonLimited: true,
        health: 140,
        speed: 2,
        // 초록 화살: 실제로 날아가는 투사체라 빗나갈 수 있지만, 재사용
        // 대기시간이 0.3초로 이 게임에서 가장 빠른 기본 공격이다. 적중하면
        // 피해와 별개로 팀 전체를 항상(확률 없이) 조금 회복시킨다.
        attackType: 'throw_projectile',
        attackProjectileTheme: 'wind', // 빛 속성이지만 금빛이 아니라 초록으로 그린다
        attackProjectileNoun: '화살',
        attackProjectileRadius: 6,
        attackProjectileSpeed: 800,
        attackRange: 520,
        attackDamage: 3,
        attackCooldown: 300,
        attackHealOnUse: 2,
        // 자연의 힘: 조준 없이 즉시 발동, 팀 전체에게 초당 회복 버프를 건다.
        // team_heal_over_time 궁극기와 같은 버프를 스킬 쪽 필드로 재사용한다.
        skillType: 'team_heal_over_time',
        skillHealPerTick: 5,
        skillTickMs: 1000,
        skillDurationMs: 4000,
        skillCooldown: 10000,
        // 각성: 쓸 때마다 1→2→3단계, 그다음 다시 1단계로 순환한다.
        // 1단계: 10초 동안 기본 공격 재사용 대기시간이 사실상 사라진다.
        // 2단계: 1단계 효과에 이동 속도와 적중마다 팀 회복이 더해진다.
        // 3단계: 조준 없이 즉시 발동. 죽은 팀원이 있으면 부활시키고, 없으면
        // 마법진으로 팀을 꽉 채우고 적 체력을 깎는다.
        ultimateType: 'nature_awaken',
        ultimateDurationMs: 10000,
        ultimateRapidCooldown: 100,
        ultimateLevel2SpeedBonus: 0.5,
        // attackHealOnUse의 boosted 버전. server.js의 attack_heal_boost 소비
        // 로직이 ultimateType 상관없이 이 필드+attackHealBoostUntil만 본다.
        ultimateHealPerAttack: 3,
        ultimateReviveHpRatio: 0.5,
        ultimateSanctuaryEnemyDamageRatio: 0.3,
        ultimateCooldownMs: 30000
    },
    seaguardian: {
        name: '바다 수호자맛 쿠키',
        shortName: '수호자', // shown on the lobby's character-select button
        color: '#3498db', // 파랑, solid
        weaponShape: 'shield',
        weaponColor: '#2471a3', // 파랑 방패
        grade: '에픽',
        element: '물',
        role: '탱커',
        health: 150,
        speed: 2,
        attackType: 'melee_kick',
        attackRange: 85,
        attackWidth: 38,
        attackDamage: 4,
        attackCooldown: 500,
        // 특수스킬 "바다로 들어가기": 조준 없이 즉시 몸을 숨긴다.
        // skillDurationMs 동안은 damageReductionMultiplier가 받는 피해를 통째로
        // 0으로 막아 아무 공격도 안 통하고, 서버가 자기 자신의 기본공격 입력도
        // 같은 시간 동안 무시한다(untouchableUntil 체크, playerAttack 계열
        // 핸들러). 숨는 순간 체력을 고정값만큼 채운다.
        skillType: 'sea_hide',
        skillDurationMs: 2000,
        skillHealAmount: 60,
        skillCooldown: 14000,
        // 궁극기 "막기": 팀 전체에게 즉시 보호막을 씌우고, 초당 회복 버프를
        // 5초간 얹는다. 회복 버프는 team_heal_over_time과 같은 걸 그대로
        // 재사용한다(틱 처리가 세 모드 다 이미 있다).
        ultimateType: 'team_hot_shield',
        ultimateShieldAmount: 60,
        ultimateHealPerTick: 15,
        ultimateTickMs: 1000,
        ultimateDurationMs: 5000,
        ultimateCooldownMs: 30000
    },
    // 유누 신청작. 비스트 등급의 어둠 속성 탱커. 검정+짙은 파랑 몸에 창을
    // 들고 다니며, 때릴 때마다 팀에게 작은 보호막을 얹어 주고, 물속으로
    // 끌고 들어가는 기절기와 전방 돌진 궁극기로 자리를 잡는다.
    darksea: {
        name: '암흑바다맛 쿠키',
        shortName: '암흑바다', // shown on the lobby's character-select button
        color: '#0d0d12',
        colorLeft: '#0d0d12', // 검정
        colorRight: '#1b4f72', // 짙은 파랑
        weaponShape: 'spear',
        weaponColor: '#1b4f72', // 짙은 파랑 창
        grade: '비스트',
        element: '어둠',
        role: '탱커',
        health: 200,
        speed: 2,
        attackType: 'melee_kick', // 창으로 후려친다
        attackRange: 110,
        attackWidth: 44,
        attackDamage: 6,
        attackCooldown: 500,
        // 패시브: 기본 공격이 적중할 때마다 팀 전체에게 보호막을 더해
        // 준다. 덮어쓰지 않는다 -- 궁극기가 준 큰 보호막을 다음 공격
        // 한 번에 깎아 먹지 않도록 addShieldTeam 계열 훅을 쓴다(server.js).
        attackShieldOnUse: 10,
        // 특수스킬 "물속으로 데려가기": 직접 지정한 좁은 반경 안에 있는 적을
        // 물속으로 끌고 들어가 기절시킨다. 피해도 표식도 없다.
        skillType: 'water_drag',
        skillRadius: 35,
        skillStunMs: 5000,
        skillCooldown: 10000,
        // 궁극기: 조준 없이 지금 보는 방향으로 빠르게 돌진하고(피해 없음),
        // 팀 전체에게 보호막과 회복을 준다.
        ultimateType: 'dash_guard',
        ultimateRange: 350,
        ultimateShieldAmount: 150,
        ultimateHealAmount: 80,
        ultimateCooldownMs: 30000
    },
    // 에이션트 등급 다크 스트라이커. 간지나는데 착한 캐릭터라는 컨셉(유누,
    // 2026-08-11) -- 원거리로 아주 빠르게 연사하고, 3초만 가만있으면 예민하게
    // 집중해서 적 공격을 피해내는 쿠키.
    magicblock: {
        name: '매직블록맛 쿠키',
        shortName: '매직블록',
        color: '#8e44ad',
        colorLeft: '#e67e22', // 주황
        colorRight: '#8e44ad', // 보라
        weaponShape: 'orb',
        weaponColor: '#8e44ad',
        grade: '에이션트',
        element: '어둠',
        role: '스트라이커',
        health: 150,
        speed: 2,
        // 원거리, 아주 빠른 연사(공속 200ms). 명중하면 0.3초간 대상 이속을
        // 60%로 늦춘다(attackSlowMult/attackSlowDurationMs -- 몬스터 엔진의
        // monsterSpeed가 읽는다, server.js landStoryHitOnMonster 참고).
        attackType: 'throw_projectile',
        attackRange: 500,
        attackProjectileSpeed: 800,
        attackProjectileRadius: 8,
        attackDamage: 5,
        attackCooldown: 200,
        attackSlowMult: 0.6,
        attackSlowDurationMs: 300,
        // 패시브 "집중": 3초간 공격도 안 받지도 않으면 집중모드(이속+0.3).
        // 맞으면 즉시 풀린다(lastHitAt이 idleMs 기준을 다시 늘린다). 집중모드
        // 중에는 근접 몹의 공격이 명중하는 순간 20px 자동으로 물러나 피한다
        // (5초 쿨타임, tickMonsterSet의 tryFocusDodge만 해당 -- 보스 패턴/
        // 레이저처럼 다른 경로로 들어오는 공격은 대상이 아니다).
        focusPassive: { idleMs: 3000, speedBonus: 0.3, dodgeDistance: 20, dodgeCooldownMs: 5000 },
        // 스킬: 지점을 찍지 않고 자기 중심 반경 80px에 바로 터뜨려 자기
        // 속성(어둠) 표식 20개(1.3배)를 남긴다. keepsOwnMarks가 없어서
        // 본인 공격도 그 표식을 그대로 먹는다.
        skillType: 'self_mark_burst',
        skillRadius: 80,
        skillMarkUses: 20,
        skillMarkMultiplier: 1.3,
        attackMarkMultiplier: 1.3,
        skillCooldown: 10000,
        // 궁극기: 11초간 각성(몸이 흰색으로, ultimateColorOverride) -- 공격할
        // 때마다 표식 5개(ultimateAttackMarkUses, attackMarkChargesOf가 각성
        // 중에만 확인), 공격력 7로 대체, 받는 피해 50%, 이속 그냥 +0.5(배수가
        // 아니라 덧셈 -- moveSpeedFor의 ultimateSpeedBonus 분기).
        ultimateType: 'awakening',
        ultimateDurationMs: 11000,
        ultimateCooldownMs: 30000,
        ultimateSpeedBonus: 0.5,
        ultimateAttackDamage: 7,
        ultimateDamageMultiplier: 0.5,
        ultimateAttackMarkUses: 5,
        ultimateColorOverride: { colorLeft: '#ffffff', colorRight: '#ffffff' }
    },
    poppingcandy: {
        name: '파핑캔디맛 쿠키',
        shortName: '파핑캔디', // shown on the lobby's character-select button
        color: '#7B68EE', // 보라와 파랑 사이
        weaponShape: 'gatling',
        weaponColor: '#e67e22', // 주황 개틀링건
        grade: '에이션트', // 너무 세서 에픽에서 상향(뽑기 확률을 낮춰 희소성으로 완충)
        element: '어둠',
        role: '대미지 딜러',
        health: 120,
        speed: 2.3, // 바람궁수(2)보다 빠르다
        // 기본공격: 개틀링건으로 파핑캔디를 마구 쏜다. throw_projectile을
        // 그대로 쓰되(맞아야 피해가 들어가는 실제 투사체), attackAmmoMax가
        // 있는 유일한 캐릭터라 공격 버튼을 꾹 누르면 연사가 나간다 -- 연사
        // 자체는 클라이언트가 재사용 대기시간(0.1초)마다 같은 함수를 계속
        // 불러서 만든다 (main.js의 "연사" 절 참고). 100발을 쏘면 자동으로
        // 3초 재장전에 들어간다 (server.js consumeAmmoOrBlock이 판정).
        attackType: 'throw_projectile',
        attackProjectileTheme: 'candy',
        attackProjectileNoun: '파핑캔디',
        attackProjectileRadius: 5,
        attackProjectileSpeed: 700,
        attackRange: 420,
        attackDamage: 1,
        attackCooldown: 100, // 0.1초에 한 발
        attackAmmoMax: 100, // 100발 쏘면 재장전
        attackReloadMs: 5000, // 재장전 5초
        attackFireSpeedPenalty: 0.3, // 연사 중(마지막 발 후 잠깐) 이동속도가 이만큼 줄어든다
        // 특수스킬 없음 -- skillType 자체를 생략한다. 전투 중 스킬 칸에는
        // 대신 남은 탄수/재장전 상태가 뜬다 (main.js updateCooldownDisplay류).
        ultimateType: 'self_ratio_guard', // 자기 자신에게만: 최대체력 비율 회복 + 고정 보호막
        ultimateHealRatio: 0.5,
        ultimateShieldAmount: 50,
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
        },
        // 바람 side: 바람궁수맛 쿠키 전용. 물 side와 같은 짝 구성(근접+원거리)
        // 이지만 근접이 앞장서고 궁수가 뒤에서 쏘는 순서라 물 side와는 체감이
        // 다르다.
        wind: {
            label: '🍃 바람',
            icon: '🍃',
            ticketKey: 'ticketWindarcher',
            stages: [
                {
                    id: 'ev_a1', name: '산들바람', reward: 1,
                    def: {
                        levelType: 'bridge', levelLength: 1500, laneHalfWidth: 70,
                        gates: [{ entrance: -800, exit: -1300, room: 0 }],
                        monsters: [
                            { type: 'wind_slice', x: -950, y: -35, room: 0 },
                            { type: 'wind_slice', x: -950, y: 35, room: 0 },
                            { type: 'wind_slice', x: -1100, y: 0, room: 0 },
                            { type: 'wind_slice', x: -1220, y: -35, room: 0 }
                        ],
                        star: { x: -1420, y: 0 }
                    }
                },
                {
                    id: 'ev_a2', name: '돌풍', reward: 2,
                    def: {
                        levelType: 'bridge', levelLength: 1900, laneHalfWidth: 70,
                        gates: [{ entrance: -800, exit: -1700, room: 0 }],
                        monsters: [
                            { type: 'wind_slice', x: -950, y: -40, room: 0 },
                            { type: 'wind_slice', x: -950, y: 0, room: 0 },
                            { type: 'wind_slice', x: -950, y: 40, room: 0 },
                            { type: 'wind_slice', x: -1150, y: -25, room: 0 },
                            { type: 'wind_arrow', x: -1450, y: -35, room: 0 },
                            { type: 'wind_arrow', x: -1450, y: 35, room: 0 }
                        ],
                        star: { x: -1820, y: 0 }
                    }
                },
                {
                    id: 'ev_a3', name: '바람의 참호', reward: 2,
                    def: {
                        levelType: 'bridge', levelLength: 2300, laneHalfWidth: 70,
                        gates: [
                            { entrance: -700, exit: -1150, room: 0 },
                            { entrance: -1150, exit: -2150, room: 1 }
                        ],
                        monsters: [
                            { type: 'wind_slice', x: -850, y: -35, room: 0 },
                            { type: 'wind_slice', x: -850, y: 35, room: 0 },
                            { type: 'wind_slice', x: -1000, y: 0, room: 0 },
                            { type: 'wind_arrow', x: -1500, y: -50, room: 1 },
                            { type: 'wind_arrow', x: -1500, y: 0, room: 1 },
                            { type: 'wind_arrow', x: -1500, y: 50, room: 1 },
                            { type: 'wind_arrow', x: -1800, y: 0, room: 1 }
                        ],
                        star: { x: -2250, y: 0 }
                    }
                },
                {
                    id: 'ev_a4', name: '거센 폭풍', reward: 3,
                    def: {
                        levelType: 'bridge', levelLength: 2600, laneHalfWidth: 70,
                        gates: [
                            { entrance: -700, exit: -1350, room: 0 },
                            { entrance: -1350, exit: -2400, room: 1 }
                        ],
                        monsters: [
                            { type: 'wind_slice', x: -850, y: -45, room: 0 },
                            { type: 'wind_slice', x: -850, y: 0, room: 0 },
                            { type: 'wind_slice', x: -850, y: 45, room: 0 },
                            { type: 'wind_slice', x: -1000, y: -25, room: 0 },
                            { type: 'wind_arrow', x: -1200, y: -40, room: 0 },
                            { type: 'wind_arrow', x: -1200, y: 40, room: 0 },
                            { type: 'wind_arrow', x: -1600, y: -45, room: 1 },
                            { type: 'wind_arrow', x: -1600, y: 0, room: 1 },
                            { type: 'wind_arrow', x: -1600, y: 45, room: 1 },
                            { type: 'wind_arrow', x: -1850, y: -30, room: 1 },
                            { type: 'wind_slice', x: -1850, y: 30, room: 1 },
                            { type: 'wind_slice', x: -2100, y: 0, room: 1 }
                        ],
                        star: { x: -2520, y: 0 }
                    }
                }
            ],
            // 4개를 다 깨야 열리는 보스. 반복 도전 가능(임시 보스 -- 진짜
            // 보스가 오면 이 def만 갈아끼우면 된다).
            boss: {
                id: 'ev_ab', name: '바람의 수호자', reward: 1, repeatable: true,
                def: {
                    levelType: 'bridge', levelLength: 1800, laneHalfWidth: 90,
                    gates: [{ entrance: -700, exit: -1600, room: 0 }],
                    monsters: [
                        { type: 'wind_guardian', x: -1200, y: 0, room: 0 },
                        { type: 'wind_arrow', x: -1000, y: -60, room: 0 },
                        { type: 'wind_arrow', x: -1000, y: 60, room: 0 },
                        { type: 'wind_slice', x: -900, y: -30, room: 0 },
                        { type: 'wind_slice', x: -900, y: 30, room: 0 }
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
    const known = STORY_FLOOR_DEFS[floor] || EVENT_STAGE_DEFS[floor] || LEGEND_STORY_FLOOR_DEFS[floor] || EXP_DUNGEON_FLOOR_DEFS[floor];
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
    },
    // ==================== guest2: 불꽃요정맛 쿠키 ====================
    // 골자만 잡아둔 상태 -- 유누가 패턴(1~3차 스킬)을 직접 정해서 줄 예정이니
    // patterns를 임의로 채우거나 숫자를 다듬지 말 것. 아직 서버 쪽 페이즈 전환
    // 로직(damageGuestBoss/startGuestPhase2 등)과 게스트 보스 선택 UI도 guest1
    // 전용으로 짜여 있어 guest2까지 이어지지 않는다 -- 패턴이 정해지면 그것부터
    // 같이 손볼 것.
    guest2: {
        id: 'guest2',
        name: '불꽃요정맛 쿠키',
        charType: 'flamefairy',
        maxHp: 20000, // 유누 확정 (2026-08-15), 1차
        radius: 46,
        homeY: -235,
        skillIntervalMs: 2000, // 유누 확정 (2026-08-15): 기본 공격이 2초에 한 번
        patterns: {
            // 기본(평범) 공격: 원거리, 구체 모양의 크고 빠른 불구슬을 예고 없이
            // 던진다 (유누, 2026-08-15: "구체로 하고 크기를 키우고 예고하지마").
            // 그래서 telegraphMs/guestTelegraph 경고 없이 beginGuestSkill에서
            // 바로 발사까지 끝낸다 (server.js basic_attack 분기 참고).
            // 적중 시 damage(10) 즉발 + burnDamage(1)를 burnIntervalMs(1초)마다
            // burnTicks(20)번, 총 20 추가 -- 한 방에 합치지 않고 실제 화상
            // 디버프로 처리한다 (유누 확정, 2026-08-15: "10 들어가고 1초에 1씩
            // 20번"). server.js guestMonsterCtx.onHit이 room.activeBuffs에
            // player_burn을 붙여서 매 초 applyDamageToGuestPlayer로 깎는다.
            // radius(더 키움)/speed는 "크게"/"빠르게"라는 방향만 정해져서 기존
            // 수치 스케일(캐릭터 투사체 반지름 6~15, 속도 380~800)에 맞춰 임의로
            // 채운 값 -- 다르면 알려줄 것.
            basic_attack: {
                speed: 900,
                radius: 60,
                damage: 10,
                burnDamage: 1,
                burnTicks: 20,
                burnIntervalMs: 1000
            }
        },
        phase2: {
            maxHp: 400,
            skillIntervalMs: 1000,
            patterns: {} // TODO: 2차 패턴 (유누 디자인 대기)
        },
        phase3: {
            maxHp: 300,
            skillIntervalMs: 1000,
            patterns: {} // TODO: 3차 패턴 (유누 디자인 대기)
        }
    }
};

// The definition in force right now: phase 2/3 override maxHp/skillIntervalMs/
// patterns while keeping the shared body fields (radius, homeY, charType).
// Overrides apply cumulatively (phase 3 layers on top of phase 2's shape) so a
// phase3 block only needs to list what actually changes from phase 2.
function guestDefFor(room) {
    const base = GUEST_BOSS_DEFS[room.guestId];
    if (!base) return null;
    let def = base;
    if (room.phase >= 2 && base.phase2) def = { ...def, ...base.phase2 };
    if (room.phase >= 3 && base.phase3) def = { ...def, ...base.phase3 };
    return def;
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
    // 바람 side: 근접 조각과 원거리 궁수를 섞어 쓴다(물 side와 같은 짝 구성).
    wind_slice: {
        name: '바람 조각',
        color: '#27ae60',
        health: 45,
        speed: 4,
        aggroRange: 560,
        preferredDistance: 70,
        attackRange: 110,
        attackDamage: 6,
        attackCooldown: 2300,
        telegraphMs: 350
    },
    wind_arrow: {
        name: '바람 궁수병',
        color: '#58d68d',
        health: 35,
        speed: 2,
        aggroRange: 540,
        preferredDistance: 260,
        projectileSpeed: 460,
        attackRange: 320,
        attackDamage: 4,
        attackCooldown: 2400,
        telegraphMs: 450
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
    wind_guardian: {
        name: '바람의 수호자',
        color: '#1e8449',
        health: 400,
        speed: 3,
        aggroRange: 700,
        preferredDistance: 240,
        projectileSpeed: 480,
        attackRange: 340,
        attackDamage: 7,
        attackCooldown: 1500,
        telegraphMs: 380
    },
    // ---- 레전드 지하 보스 ----
    // 지하 2층 보스. 레드 드레곤맛 쿠키가 "아무도 자길 안 써준다"는 분노로
    // 폭주한 모습 -- 원래 캐릭터(CHARACTERS.reddragon, 탱커/불 속성/방패)의
    // 색을 그대로 쓴다. 유누가 정한 실제 수치(2026-08-11):
    // - 화가 나서 공격이 아주 빠르다(공속 0.2초 = attackCooldown 200ms).
    // - 때릴 때마다 2씩 회복(growOnAttack -- 몬스터 엔진에 이미 있던 필드 재사용).
    // - 특수스킬: 10초 쿨타임, 5초간 받는 피해 50%. 켤 때 체력 30 회복 + 보호막 50.
    // - 궁극기: 30초 쿨타임, 10초간 이속3·공격력15·받는 피해 60%. 켤 때 체력
    //   50 회복 + 보호막 100.
    // monsterSkill/monsterUltimate는 이 보스를 위해 새로 만든 범용 필드라
    // (tickMonsterSkillUltimate, server.js) 다른 몬스터도 그대로 가져다 쓸 수
    // 있다. 아레나에 놓을 구조물은 아직 미정.
    reddragon_rampage: {
        name: '폭주한 레드 드레곤',
        color: '#e74c3c',
        colorLeft: '#e74c3c',
        colorRight: '#ffffff',
        health: 15000,
        speed: 2,
        aggroRange: 1000,
        preferredDistance: 70,
        attackRange: 130,
        attackDamage: 7,
        attackCooldown: 200,
        telegraphMs: 400,
        growOnAttack: { heal: 2 },
        monsterSkill: {
            cooldownMs: 10000,
            durationMs: 5000,
            damageTakenMult: 0.5,
            healOnCast: 30,
            shieldOnCast: 50
        },
        monsterUltimate: {
            cooldownMs: 30000,
            durationMs: 10000,
            damageTakenMult: 0.6,
            speed: 3,
            attackDamage: 15,
            healOnCast: 50,
            shieldOnCast: 100
        },
        bossBar: true,
        radius: 36
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
    },
    // ---- 21층부터. 가면광대(20층)를 넘은 뒤 남은 서커스 잔당. ----
    // 21층: 몸빵. 오래 버티고, 한 번은 반드시 버틴다.
    circus_strongman: {
        name: '서커스 차력사',
        color: '#d35400',
        colorLeft: '#f0b27a',
        colorRight: '#7e3300',
        health: 420,
        speed: 3,
        aggroRange: 780,
        preferredDistance: 75,
        attackRange: 190,
        attackDamage: 30,
        attackCooldown: 2600,
        telegraphMs: 550,
        lowHpGuard: { atHp: 90, heal: 80, shield: 100 }
    },
    // 23층: 원거리 딜이 지금까지 나온 포탑 아닌 몹 중 가장 세다. 붙어서 끊어야 한다.
    fire_juggler: {
        name: '불쇼 저글러',
        color: '#f39c12',
        colorLeft: '#fdebd0',
        colorRight: '#9c640c',
        health: 220,
        speed: 4,
        aggroRange: 780,
        preferredDistance: 260,
        projectileSpeed: 560,
        attackRange: 400,
        attackDamage: 20,
        attackCooldown: 1800,
        telegraphMs: 380
    },
    // 25층: 가면광대처럼 반사/거울 속임수. 쓰러뜨리면 조각으로 갈라진다.
    mirror_clown: {
        name: '거울광대',
        color: '#9b59b6',
        colorLeft: '#d2b4de',
        colorRight: '#512e5f',
        health: 300,
        speed: 4,
        aggroRange: 800,
        preferredDistance: 65,
        attackRange: 170,
        attackDamage: 22,
        attackCooldown: 2200,
        telegraphMs: 400,
        splitOnDeath: { type: 'mirror_shard', count: 2, spread: 45 }
    },
    mirror_shard: {
        name: '거울 조각',
        color: '#bb8fce',
        health: 90,
        speed: 5.5,
        aggroRange: 800,
        preferredDistance: 40,
        attackRange: 120,
        attackDamage: 12,
        attackCooldown: 1500,
        telegraphMs: 300
    },
    // 27층: 지금까지 나온 포탑 중 빔이 가장 빨리 따라온다.
    carnival_turret: {
        name: '회전목마 포탑',
        color: '#2980b9',
        colorLeft: '#aed6f1',
        colorRight: '#1b4f72',
        health: 200,
        speed: 0,
        aggroRange: 640,
        preferredDistance: 0,
        attackRange: 640,
        attackCooldown: 2200,
        telegraphMs: 350,
        laser: true,
        laserDurationMs: 1300,
        laserDamage: 4,
        laserTickMs: 100,
        laserRange: 640,
        laserWidth: 44,
        laserTrackSpeed: 150
    },
    // 29층: 서커스 챕터(21~29층)의 마지막 방을 지키는 서커스 단장. 체력이
    // 40% 아래로 떨어지면 격노하고, 저글러를 계속 불러들인다.
    ringmaster: {
        name: '서커스 단장',
        color: '#6c3483',
        colorLeft: '#f1c40f',
        colorRight: '#4a235a',
        health: 550,
        speed: 3,
        aggroRange: 820,
        preferredDistance: 85,
        attackRange: 210,
        attackDamage: 32,
        attackCooldown: 2400,
        telegraphMs: 500,
        enrage: { atHpRatio: 0.4, attackMult: 1.5, speedMult: 1.4 },
        summonOnTimer: { type: 'fire_juggler', count: 1, everyMs: 7000, max: 3 }
    },
    // ==================== 30~49층: 얼음/서리 챕터 ====================
    // 보스전 없이 웨이브만 있는 구간이라(30층/40층도 다른 층과 동일하게
    // 취급 -- isTowerBossFloor는 bossFloor 플래그로 판정하므로 이 챕터엔
    // 전혀 안 걸린다) 여기 10종을 30~39층에 하나씩 새로 풀고, 40~49층은
    // 그 10종을 섞어서 수만 늘려 나간다.
    // 30층: 얼음 정령. 초콜릿맛 궁수 자리를 잇는 뒷줄 캐스터.
    ice_spirit: {
        name: '얼음 정령',
        color: '#aed6f1',
        colorLeft: '#eaf6fd',
        colorRight: '#5dade2',
        health: 170,
        speed: 4,
        aggroRange: 780,
        preferredDistance: 220,
        projectileSpeed: 480,
        attackRange: 340,
        attackDamage: 14,
        attackCooldown: 2200,
        telegraphMs: 420
    },
    // 31층: 고드름 궁수. 체력은 종잇장이지만 화살 하나가 매섭다.
    icicle_archer: {
        name: '고드름 궁수',
        color: '#d6eaf8',
        colorLeft: '#ffffff',
        colorRight: '#7fb3d5',
        health: 90,
        speed: 3,
        aggroRange: 760,
        preferredDistance: 260,
        projectileSpeed: 560,
        attackRange: 380,
        attackDamage: 20,
        attackCooldown: 1800,
        telegraphMs: 350
    },
    // 32층: 눈보라 늑대. 지금까지 나온 근접 중 가장 빠르게 파고든다.
    snow_wolf: {
        name: '눈보라 늑대',
        color: '#eaeded',
        colorLeft: '#ffffff',
        colorRight: '#95a5a6',
        health: 210,
        speed: 6,
        aggroRange: 820,
        preferredDistance: 55,
        attackRange: 140,
        attackDamage: 20,
        attackCooldown: 1700,
        telegraphMs: 320
    },
    // 33층: 서리 골렘. 설탕 골렘처럼 쓰러지면 조각으로 갈라진다.
    frost_golem: {
        name: '서리 골렘',
        color: '#aab7c4',
        colorLeft: '#dfe9f3',
        colorRight: '#5f6b76',
        health: 480,
        speed: 2,
        aggroRange: 760,
        preferredDistance: 65,
        attackRange: 180,
        attackDamage: 26,
        attackCooldown: 2800,
        telegraphMs: 550,
        splitOnDeath: { type: 'frost_shard', count: 2, spread: 45 }
    },
    // 서리 골렘이 갈라져 나오는 조각. splitOnDeath가 없으므로 여기서 끝난다.
    frost_shard: {
        name: '서리 조각',
        color: '#dfe9f3',
        health: 100,
        speed: 5,
        aggroRange: 760,
        preferredDistance: 40,
        attackRange: 120,
        attackDamage: 12,
        attackCooldown: 1700,
        telegraphMs: 320
    },
    // 34층: 눈꽃 치유사. 마카롱 치유사보다 오라가 더 넓고 세다.
    snowflake_healer: {
        name: '눈꽃 치유사',
        color: '#d6eaf8',
        colorLeft: '#ffffff',
        colorRight: '#85c1e9',
        health: 230,
        speed: 2,
        aggroRange: 780,
        preferredDistance: 260,
        projectileSpeed: 440,
        attackRange: 340,
        attackDamage: 9,
        attackCooldown: 2400,
        telegraphMs: 460,
        healAura: { radius: 300, amount: 10, tickMs: 1300 }
    },
    // 35층: 얼음 기사. 왕실 근위대처럼 한 번은 반드시 버틴다.
    ice_knight: {
        name: '얼음 기사',
        color: '#a9cce3',
        colorLeft: '#eaf2f8',
        colorRight: '#21618c',
        health: 400,
        speed: 3,
        aggroRange: 800,
        preferredDistance: 75,
        attackRange: 190,
        attackDamage: 28,
        attackCooldown: 2600,
        telegraphMs: 520,
        lowHpGuard: { atHp: 90, heal: 70, shield: 90 }
    },
    // 36층: 서리 대포. 지금까지 나온 포탑 중 빔이 가장 세고 잘 따라온다.
    frost_cannon: {
        name: '서리 대포',
        color: '#5dade2',
        colorLeft: '#d6eaf8',
        colorRight: '#1b4f72',
        health: 220,
        speed: 0,
        aggroRange: 680,
        preferredDistance: 0,
        attackRange: 680,
        attackCooldown: 2200,
        telegraphMs: 360,
        laser: true,
        laserDurationMs: 1300,
        laserDamage: 5,
        laserTickMs: 100,
        laserRange: 680,
        laserWidth: 46,
        laserTrackSpeed: 160
    },
    // 37층: 눈사람 폭탄병. 사탕 폭탄병보다 빨리 달려들고 더 세게 터진다.
    snowman_bomber: {
        name: '눈사람 폭탄병',
        color: '#f4f6f7',
        colorLeft: '#ffffff',
        colorRight: '#aeb6bf',
        health: 60,
        speed: 5.5,
        aggroRange: 700,
        preferredDistance: 40,
        attackRange: 100,
        attackDamage: 30,
        attackCooldown: 2000,
        telegraphMs: 700,
        explode: true,
        explodeRadius: 150
    },
    // 38층: 눈보라 주술사. 초콜릿 여왕처럼 부하(눈보라 늑대)를 계속 부른다.
    blizzard_shaman: {
        name: '눈보라 주술사',
        color: '#d2b4de',
        colorLeft: '#f4ecf7',
        colorRight: '#7d3c98',
        health: 380,
        speed: 2,
        aggroRange: 800,
        preferredDistance: 280,
        projectileSpeed: 500,
        attackRange: 380,
        attackDamage: 18,
        attackCooldown: 2200,
        telegraphMs: 460,
        summonOnTimer: { type: 'snow_wolf', count: 2, everyMs: 6500, max: 8 }
    },
    // 39층: 서리 여왕. 40~49층 내내 섞여 나오는 이 챕터의 정예. 체력이 40%
    // 아래로 떨어지면 격노하고, 고드름 궁수를 계속 불러들인다.
    frost_queen: {
        name: '서리 여왕',
        color: '#aed6f1',
        colorLeft: '#ffffff',
        colorRight: '#21618c',
        health: 650,
        speed: 3,
        aggroRange: 840,
        preferredDistance: 85,
        attackRange: 220,
        attackDamage: 36,
        attackCooldown: 2400,
        telegraphMs: 520,
        enrage: { atHpRatio: 0.4, attackMult: 1.5, speedMult: 1.4 },
        summonOnTimer: { type: 'icicle_archer', count: 1, everyMs: 7000, max: 3 }
    },
    // 50층 보스. 서리 여왕의 보스급 상위 버전 -- 공격 자체는 약하지만
    // (35 dmg, 1초마다) 맞힐 때마다 5씩 회복하는 데다 체력이 10000이라
    // 장기전으로 깎아내야 한다. 케이크 보스와 같은 방식(일반 몬스터 AI +
    // growOnAttack/enrage/lowHpGuard/summonOnTimer 데이터)이라 서버에
    // 새 코드가 필요 없다.
    frost_empress_boss: {
        name: '서리 여제',
        color: '#aed6f1',
        colorLeft: '#ffffff',
        colorRight: '#154360',
        health: 10000,
        speed: 3,
        aggroRange: 840,
        preferredDistance: 85,
        attackRange: 220,
        attackDamage: 35,
        attackCooldown: 1000,
        telegraphMs: 500,
        // 때릴 때마다 5씩 회복한다 (성장은 없음 -- attack/speed 필드가 없어서
        // growMonsterOnAttack이 heal만 적용한다).
        growOnAttack: { heal: 5 },
        enrage: { atHpRatio: 0.4, attackMult: 1.5, speedMult: 1.4 },
        // 막타 직전 한 번: 체력 20% 아래에서 보호막 1000 + 회복 1000.
        lowHpGuard: { atHp: 2000, heal: 1000, shield: 1000 },
        // 고드름 궁수 대신 더 묵직한 서리 골렘을 불러들인다.
        summonOnTimer: { type: 'frost_golem', count: 1, everyMs: 8000, max: 2 },
        // 시간과 별개로, 10대 맞을 때마다 고드름 궁수를 하나 더 부른다.
        summonOnHits: { type: 'icicle_archer', count: 1, every: 10, max: 4 },
        bossBar: true,
        radius: 44
    },
    // ==================== 51~59층: 용암 챕터 ====================
    // 50층(서리 여제)을 넘은 뒤 이어지는 새 챕터. 얼음/서리 챕터처럼 이 챕터도
    // 이전 챕터 몹과 안 섞고 자기 몹만 쓴다. 51~56층에 하나씩 새로 풀고,
    // 57~59층은 그 6종을 섞어서 수만 늘려 나간다. 보스전은 없다(다음 보스는
    // 60층 몫 -- 지금은 웨이브만).
    // 51층: 용암 임프. 고드름 궁수 자리를 잇는 종잇장 원거리.
    lava_imp: {
        name: '용암 임프',
        color: '#e8590c',
        colorLeft: '#ffa94d',
        colorRight: '#7a1e00',
        health: 110,
        speed: 4,
        aggroRange: 780,
        preferredDistance: 260,
        projectileSpeed: 580,
        attackRange: 400,
        attackDamage: 24,
        attackCooldown: 1700,
        telegraphMs: 340
    },
    // 52층: 마그마 하운드. 눈보라 늑대보다 더 빨리 파고든다.
    magma_hound: {
        name: '마그마 하운드',
        color: '#bf2600',
        colorLeft: '#ff8787',
        colorRight: '#4d0000',
        health: 260,
        speed: 6.5,
        aggroRange: 830,
        preferredDistance: 55,
        attackRange: 150,
        attackDamage: 24,
        attackCooldown: 1600,
        telegraphMs: 300
    },
    // 53층: 흑요석 골렘. 서리 골렘처럼 쓰러지면 조각으로 갈라진다.
    obsidian_golem: {
        name: '흑요석 골렘',
        color: '#2b0f06',
        colorLeft: '#5c3a21',
        colorRight: '#100603',
        health: 540,
        speed: 2,
        aggroRange: 780,
        preferredDistance: 65,
        attackRange: 190,
        attackDamage: 30,
        attackCooldown: 2800,
        telegraphMs: 550,
        splitOnDeath: { type: 'obsidian_shard', count: 2, spread: 45 }
    },
    obsidian_shard: {
        name: '흑요석 조각',
        color: '#5c3a21',
        health: 110,
        speed: 5,
        aggroRange: 780,
        preferredDistance: 40,
        attackRange: 120,
        attackDamage: 14,
        attackCooldown: 1700,
        telegraphMs: 320
    },
    // 54층: 불씨 사제. 눈꽃 치유사보다 오라가 더 넓고 세다.
    ember_priest: {
        name: '불씨 사제',
        color: '#ff922b',
        colorLeft: '#ffd8a8',
        colorRight: '#c1440e',
        health: 260,
        speed: 2,
        aggroRange: 800,
        preferredDistance: 270,
        projectileSpeed: 450,
        attackRange: 350,
        attackDamage: 10,
        attackCooldown: 2400,
        telegraphMs: 460,
        healAura: { radius: 310, amount: 11, tickMs: 1300 }
    },
    // 55층: 용암 기사. 얼음 기사처럼 한 번은 반드시 버틴다.
    molten_knight: {
        name: '용암 기사',
        color: '#d9480f',
        colorLeft: '#ffc078',
        colorRight: '#5c1a00',
        health: 440,
        speed: 3,
        aggroRange: 800,
        preferredDistance: 75,
        attackRange: 200,
        attackDamage: 32,
        attackCooldown: 2600,
        telegraphMs: 520,
        lowHpGuard: { atHp: 100, heal: 80, shield: 100 }
    },
    // 56층: 화산 대포. 지금까지 나온 포탑 중 빔이 가장 세고 잘 따라온다.
    volcano_cannon: {
        name: '화산 대포',
        color: '#e03131',
        colorLeft: '#ffa8a8',
        colorRight: '#5c0000',
        health: 240,
        speed: 0,
        aggroRange: 700,
        preferredDistance: 0,
        attackRange: 700,
        attackCooldown: 2200,
        telegraphMs: 360,
        laser: true,
        laserDurationMs: 1300,
        laserDamage: 6,
        laserTickMs: 100,
        laserRange: 700,
        laserWidth: 48,
        laserTrackSpeed: 170
    },
    // 57층: 화산 군주. 서리 여왕처럼 57~59층 내내 섞여 나오는 이 챕터의 정예.
    // 체력이 40% 아래로 떨어지면 격노하고, 용암 임프를 계속 불러들인다.
    volcano_lord: {
        name: '화산 군주',
        color: '#c92a2a',
        colorLeft: '#ff8787',
        colorRight: '#3d0000',
        health: 700,
        speed: 3,
        aggroRange: 850,
        preferredDistance: 90,
        attackRange: 225,
        attackDamage: 38,
        attackCooldown: 2400,
        telegraphMs: 520,
        enrage: { atHpRatio: 0.4, attackMult: 1.5, speedMult: 1.4 },
        summonOnTimer: { type: 'lava_imp', count: 1, everyMs: 7000, max: 3 }
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
// 각 점에는 [x, y] 뒤에 세 번째 값으로 half-width를 얹을 수 있다(예: [x, y, 220]).
// 그 점에서 시작하는 구간이 그 폭을 쓰고, 안 적으면 floorDef.laneHalfWidth를
// 그대로 쓴다 -- 레전드 스토리처럼 방(넓게)과 다리(좁게)를 한 길 안에서
// 번갈아 쓰려고 만들었다.
// `floorDef.forks`가 있으면 trunk(=path)가 끝나는 지점에서 갈라지는 추가
// 구간들이다. 각 fork는 첫 점이 trunk의 마지막 점과 같아야 이어져 보이고,
// along 누적은 trunk가 끝난 지점부터 fork마다 독립적으로 다시 시작한다
// (물리적으로 다른 자리에 있으니 projectOnPath의 최근접 탐색이 알아서
// 갈래를 구분한다 -- along 값 자체는 두 갈래가 겹쳐도 상관없다).
function pathSegsFromPoints(points, startAcc, defaultHalfWidth) {
    const segs = [];
    let acc = startAcc;
    for (let i = 0; i + 1 < points.length; i++) {
        const [x0, y0, w0] = points[i];
        const [x1, y1] = points[i + 1];
        const dx = x1 - x0, dy = y1 - y0;
        const len = Math.hypot(dx, dy);
        if (len < 1e-6) continue;
        segs.push({
            x0, y0, ux: dx / len, uy: dy / len, len, start: acc,
            halfWidth: typeof w0 === 'number' ? w0 : defaultHalfWidth
        });
        acc += len;
    }
    return { segs, end: acc };
}
function pathSegs(floorDef) {
    if (!floorDef || !floorDef.path) return null;
    if (floorDef.__segs) return floorDef.__segs;
    const defW = floorDef.laneHalfWidth || 70;
    const trunk = pathSegsFromPoints(floorDef.path, 0, defW);
    let segs = trunk.segs;
    let maxEnd = trunk.end;
    if (floorDef.forks && floorDef.forks.length) {
        floorDef.forks.forEach(fork => {
            const built = pathSegsFromPoints(fork, trunk.end, defW);
            segs = segs.concat(built.segs);
            maxEnd = Math.max(maxEnd, built.end);
        });
    }
    floorDef.__segs = segs;
    floorDef.__pathLength = maxEnd;
    return segs;
}

function pathLength(floorDef) {
    pathSegs(floorDef);
    return (floorDef && floorDef.__pathLength) || 0;
}

// 가장 가까운 구간에 붙여서 (along, across, 그 구간의 halfWidth)를 뽑는다.
// 모퉁이(그리고 갈림길)에서는 여러 구간이 다 후보가 되는데, 실제로 더
// 가까운 쪽을 고른다 -- 갈림길도 이 최근접 탐색 하나로 자연히 구분된다.
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
                across: -s.uy * (x - s.x0) + s.ux * (y - s.y0),
                halfWidth: s.halfWidth
            };
        }
    }
    return best || { d: 0, along: 0, across: 0, halfWidth: (floorDef && floorDef.laneHalfWidth) || 70 };
}

// 지금 서 있는 자리의 실제 통행 가능 폭. 길 전체가 한 폭이면(floorDef.path가
// 없으면) 그냥 floorDef.laneHalfWidth, 방/다리가 섞인 길이면 가장 가까운
// 구간의 폭을 쓴다.
function laneHalfWidthAt(floorDef, x, y) {
    if (floorDef && floorDef.path) return projectOnPath(floorDef, x, y).halfWidth;
    return (floorDef && floorDef.laneHalfWidth) || 70;
}

// along 값 하나만으로는 갈림길 너머를 가리킬 수 없다(어느 쪽 구간인지
// 알 길이 없어서 항상 배열에서 먼저 나오는 쪽으로 붙는다) -- trunk 구간
// 범위 안에서만 쓴다. 갈림길 너머의 몬스터/별/스위치/보물상자는 authoring
// 스펙에 x,y를 직접 적어서 이 함수를 거치지 않는다.
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

// 그 자리의 길 방향(단위벡터). 문(gate)처럼 길과 수직으로 세워야 하는 걸
// 그릴 때 쓴다. pointOnPath를 두 번(along, along-1) 불러서 빼는 식으로
// 방향을 구하면 모퉁이 바로 앞뒤 1 이내에서는 두 점이 서로 다른 구간에
// 걸쳐 엉뚱하게 꺾인 각도가 나온다 -- 구간 자체의 단위벡터를 바로 쓴다.
function pathTangentAt(floorDef, along) {
    const segs = pathSegs(floorDef);
    const total = pathLength(floorDef);
    const d = Math.max(0, Math.min(total, -along));
    let s = segs[segs.length - 1];
    for (const seg of segs) {
        if (d <= seg.start + seg.len) { s = seg; break; }
    }
    return { ux: s.ux, uy: s.uy };
}

// at/off(길을 따라 잰 거리)나 x/y(절대 좌표) 어느 쪽으로 적혀 있든 실제
// 좌표로 바꾼다. 갈림길 너머는 along 값이 갈래를 구분 못 하므로 x,y로
// 직접 적어야 한다(makePathFloor 주석 참고).
function resolvePathPoint(def, spec) {
    if (spec.x != null && spec.y != null) return { x: spec.x, y: spec.y };
    return pointOnPath(def, spec.at, spec.off || 0);
}

// 층 데이터를 사람이 적기 쉬운 형태(길을 따라 얼마나 갔는지 + 옆으로 얼마)로
// 적어 두고, 실제 좌표는 여기서 한 번에 계산한다. 꺾인 길의 x,y를 손으로
// 세는 것은 사람이 할 짓이 아니다.
function makePathFloor(spec) {
    const def = {
        levelType: 'bridge',
        path: spec.path,
        forks: spec.forks || null,
        laneHalfWidth: spec.laneHalfWidth || 70,
        deckColor: spec.deckColor || null,
        deckGlow: spec.deckGlow || null,
        gates: spec.gates || [],
        monsters: [],
        switches: [],
        chests: [],
        star: null
    };
    def.levelLength = Math.round(pathLength(def));
    def.monsters = (spec.monsters || []).map(m => {
        const pt = resolvePathPoint(def, m);
        return { type: m.type, x: Math.round(pt.x), y: Math.round(pt.y), room: m.room || 0 };
    });
    // 레전드 스토리 전용: 밟으면 열리는 스위치(문)와 밟으면 한 번 보상을
    // 주는 보물상자. 둘 다 스타(별)와 똑같이 "그 자리를 밟으면" 발동한다
    // (server.js tickStoryRoom 참고) -- 공격으로 부수는 게 아니다.
    def.switches = (spec.switches || []).map(sw => {
        const pt = resolvePathPoint(def, sw);
        return { id: sw.id, x: Math.round(pt.x), y: Math.round(pt.y) };
    });
    def.chests = (spec.chests || []).map(ch => {
        const pt = resolvePathPoint(def, ch);
        return { id: ch.id, x: Math.round(pt.x), y: Math.round(pt.y), reward: ch.reward || null };
    });
    if (spec.star != null) {
        const pt = resolvePathPoint(def, spec.star);
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
    const halfWidth = laneHalfWidthAt(floorDef, x, y);
    const across = Math.max(-halfWidth, Math.min(halfWidth, acrossOf(floorDef, x, y)));
    return fromAlongAcross(floorDef, along, across);
}

// Story-mode floor layouts. Each floor is a bridge stretching away from the
// start (0,0) along its `axis` (see the helpers above). A floor is split into
// one or more sequential "rooms" (see `gates`); monsters are tagged with the
// room they belong to (`room`, default 0). While any monster in a room is still
// alive, an energy shield seals that room's `entrance`/`exit` -- both given as
// along-axis positions (see server's storyPlayerMove handler) -- so the player
// can't retreat or advance past it. The star sits just past the last gate --
// walking onto it (not attacking it) clears the floor.
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
    // ---- 21층부터. 20층(가면광대)을 넘은 뒤 남은 서커스 잔당이 나온다. ----
    // 21층: 차력사 등장. 오래 버티는 몸빵이라 화력을 모아야 빨리 잡는다.
    21: makePathFloor({
        path: [[0, 0], [1000, 0], [1000, -950], [0, -950], [0, -1900], [1000, -1900], [1000, -2850], [0, -2850]],
        laneHalfWidth: 95,
        gates: [
            { entrance: -700, exit: -1600, room: 0 },
            { entrance: -1600, exit: -2900, room: 1 },
            { entrance: -2900, exit: -4200, room: 2 },
            { entrance: -4200, exit: -5600, room: 3 }
        ],
        monsters: [
            { type: 'circus_strongman', at: -950, off: -40, room: 0 },
            { type: 'thunder_orb', at: -1300, off: 0, room: 0 },
            { type: 'circus_strongman', at: -1900, off: -45, room: 1 },
            { type: 'circus_strongman', at: -1900, off: 45, room: 1 },
            { type: 'macaron_healer', at: -2250, off: 0, room: 1 },
            { type: 'frost_lancer', at: -2450, off: -40, room: 1 },
            { type: 'frost_lancer', at: -2450, off: 40, room: 1 },
            { type: 'circus_strongman', at: -3200, off: -50, room: 2 },
            { type: 'royal_guard', at: -3200, off: 50, room: 2 },
            { type: 'choco_queen', at: -3550, off: 0, room: 2 },
            { type: 'thunder_orb', at: -3800, off: -55, room: 2 },
            { type: 'thunder_orb', at: -3800, off: 55, room: 2 },
            { type: 'circus_strongman', at: -4500, off: -50, room: 3 },
            { type: 'circus_strongman', at: -4500, off: 0, room: 3 },
            { type: 'circus_strongman', at: -4500, off: 50, room: 3 },
            { type: 'royal_guard', at: -4850, off: -45, room: 3 },
            { type: 'royal_guard', at: -4850, off: 45, room: 3 },
            { type: 'macaron_healer', at: -5100, off: 0, room: 3 },
            { type: 'taffy_brute', at: -5350, off: -45, room: 3 },
            { type: 'taffy_brute', at: -5350, off: 45, room: 3 }
        ],
        star: { at: -5950 }
    }),
    // 22층: 차력사가 근위대·여왕과 뒤섞여 나온다.
    22: makePathFloor({
        path: [[0, 0], [-1050, 0], [-1050, -1000], [0, -1000], [0, -2000], [-1050, -2000], [-1050, -3000], [0, -3000]],
        laneHalfWidth: 95,
        gates: [
            { entrance: -750, exit: -1700, room: 0 },
            { entrance: -1700, exit: -3050, room: 1 },
            { entrance: -3050, exit: -4400, room: 2 },
            { entrance: -4400, exit: -5900, room: 3 }
        ],
        monsters: [
            { type: 'circus_strongman', at: -1050, off: -40, room: 0 },
            { type: 'circus_strongman', at: -1050, off: 40, room: 0 },
            { type: 'dark_cookie', at: -1400, off: 0, room: 0 },
            { type: 'circus_strongman', at: -2100, off: -45, room: 1 },
            { type: 'circus_strongman', at: -2100, off: 45, room: 1 },
            { type: 'choco_queen', at: -2450, off: 0, room: 1 },
            { type: 'thunder_orb', at: -2750, off: -55, room: 1 },
            { type: 'thunder_orb', at: -2750, off: 55, room: 1 },
            { type: 'macaron_healer', at: -2900, off: 0, room: 1 },
            { type: 'circus_strongman', at: -3600, off: -50, room: 2 },
            { type: 'circus_strongman', at: -3600, off: 50, room: 2 },
            { type: 'royal_guard', at: -3900, off: -45, room: 2 },
            { type: 'royal_guard', at: -3900, off: 45, room: 2 },
            { type: 'taffy_brute', at: -4150, off: -30, room: 2 },
            { type: 'thunder_orb', at: -4150, off: 30, room: 2 },
            { type: 'circus_strongman', at: -5000, off: -50, room: 3 },
            { type: 'circus_strongman', at: -5000, off: 0, room: 3 },
            { type: 'circus_strongman', at: -5000, off: 50, room: 3 },
            { type: 'royal_guard', at: -5350, off: -45, room: 3 },
            { type: 'royal_guard', at: -5350, off: 45, room: 3 },
            { type: 'choco_queen', at: -5600, off: -50, room: 3 },
            { type: 'choco_queen', at: -5600, off: 50, room: 3 },
            { type: 'macaron_healer', at: -5750, off: -40, room: 3 },
            { type: 'macaron_healer', at: -5750, off: 40, room: 3 }
        ],
        star: { at: -6250 }
    }),
    // 23층: 불쇼 저글러 등장. 원거리 딜이 세니 붙어서 끊어야 한다.
    23: makePathFloor({
        path: [[0, 0], [0, -1050], [1050, -1050], [1050, -2100], [0, -2100], [0, -3150], [1050, -3150], [1050, -4200]],
        laneHalfWidth: 95,
        gates: [
            { entrance: -750, exit: -1750, room: 0 },
            { entrance: -1750, exit: -3100, room: 1 },
            { entrance: -3100, exit: -4500, room: 2 },
            { entrance: -4500, exit: -6000, room: 3 }
        ],
        monsters: [
            { type: 'fire_juggler', at: -1050, off: -40, room: 0 },
            { type: 'circus_strongman', at: -1050, off: 40, room: 0 },
            { type: 'thunder_orb', at: -1400, off: 0, room: 0 },
            { type: 'fire_juggler', at: -2200, off: -45, room: 1 },
            { type: 'fire_juggler', at: -2200, off: 45, room: 1 },
            { type: 'circus_strongman', at: -2200, off: 0, room: 1 },
            { type: 'macaron_healer', at: -2600, off: 0, room: 1 },
            { type: 'royal_guard', at: -2850, off: -40, room: 1 },
            { type: 'royal_guard', at: -2850, off: 40, room: 1 },
            { type: 'fire_juggler', at: -3600, off: -50, room: 2 },
            { type: 'fire_juggler', at: -3600, off: 50, room: 2 },
            { type: 'royal_guard', at: -3900, off: -45, room: 2 },
            { type: 'royal_guard', at: -3900, off: 45, room: 2 },
            { type: 'thunder_orb', at: -4200, off: -30, room: 2 },
            { type: 'choco_queen', at: -4200, off: 30, room: 2 },
            { type: 'fire_juggler', at: -5100, off: -50, room: 3 },
            { type: 'fire_juggler', at: -5100, off: 50, room: 3 },
            { type: 'circus_strongman', at: -5350, off: -45, room: 3 },
            { type: 'circus_strongman', at: -5350, off: 45, room: 3 },
            { type: 'choco_queen', at: -5600, off: -50, room: 3 },
            { type: 'choco_queen', at: -5600, off: 50, room: 3 },
            { type: 'royal_guard', at: -5800, off: -40, room: 3 },
            { type: 'royal_guard', at: -5800, off: 40, room: 3 }
        ],
        star: { at: -6350 }
    }),
    // 24층: 차력사 + 저글러가 본격적으로 섞인다.
    24: makePathFloor({
        path: [[0, 0], [-1100, 0], [-1100, -1050], [0, -1050], [0, -2100], [-1100, -2100], [-1100, -3150], [0, -3150]],
        laneHalfWidth: 100,
        gates: [
            { entrance: -800, exit: -1850, room: 0 },
            { entrance: -1850, exit: -3250, room: 1 },
            { entrance: -3250, exit: -4700, room: 2 },
            { entrance: -4700, exit: -6250, room: 3 }
        ],
        monsters: [
            { type: 'circus_strongman', at: -1150, off: -40, room: 0 },
            { type: 'fire_juggler', at: -1150, off: 40, room: 0 },
            { type: 'thunder_orb', at: -1500, off: 0, room: 0 },
            { type: 'circus_strongman', at: -2300, off: -45, room: 1 },
            { type: 'circus_strongman', at: -2300, off: 45, room: 1 },
            { type: 'fire_juggler', at: -2600, off: -50, room: 1 },
            { type: 'fire_juggler', at: -2600, off: 50, room: 1 },
            { type: 'macaron_healer', at: -2900, off: 0, room: 1 },
            { type: 'circus_strongman', at: -3600, off: -50, room: 2 },
            { type: 'circus_strongman', at: -3600, off: 50, room: 2 },
            { type: 'fire_juggler', at: -3900, off: -55, room: 2 },
            { type: 'fire_juggler', at: -3900, off: 55, room: 2 },
            { type: 'royal_guard', at: -4200, off: -45, room: 2 },
            { type: 'royal_guard', at: -4200, off: 45, room: 2 },
            { type: 'choco_queen', at: -4450, off: 0, room: 2 },
            { type: 'circus_strongman', at: -5100, off: -50, room: 3 },
            { type: 'circus_strongman', at: -5100, off: 50, room: 3 },
            { type: 'fire_juggler', at: -5400, off: -55, room: 3 },
            { type: 'fire_juggler', at: -5400, off: 0, room: 3 },
            { type: 'fire_juggler', at: -5400, off: 55, room: 3 },
            { type: 'royal_guard', at: -5700, off: -45, room: 3 },
            { type: 'royal_guard', at: -5700, off: 45, room: 3 },
            { type: 'taffy_brute', at: -5950, off: -40, room: 3 },
            { type: 'taffy_brute', at: -5950, off: 40, room: 3 },
            { type: 'macaron_healer', at: -6100, off: 0, room: 3 }
        ],
        star: { at: -6600 }
    }),
    // 25층: 거울광대 등장. 쓰러뜨리면 거울 조각으로 갈라진다.
    25: makePathFloor({
        path: [[0, 0], [0, -1150], [1150, -1150], [1150, -2300], [0, -2300], [0, -3450], [1150, -3450], [1150, -4600]],
        laneHalfWidth: 100,
        gates: [
            { entrance: -800, exit: -1900, room: 0 },
            { entrance: -1900, exit: -3350, room: 1 },
            { entrance: -3350, exit: -4850, room: 2 },
            { entrance: -4850, exit: -6450, room: 3 }
        ],
        monsters: [
            { type: 'mirror_clown', at: -1200, off: -40, room: 0 },
            { type: 'fire_juggler', at: -1200, off: 40, room: 0 },
            { type: 'mirror_clown', at: -2400, off: -45, room: 1 },
            { type: 'mirror_clown', at: -2400, off: 45, room: 1 },
            { type: 'circus_strongman', at: -2700, off: 0, room: 1 },
            { type: 'macaron_healer', at: -3000, off: 0, room: 1 },
            { type: 'mirror_clown', at: -3800, off: -50, room: 2 },
            { type: 'mirror_clown', at: -3800, off: 50, room: 2 },
            { type: 'fire_juggler', at: -4100, off: -55, room: 2 },
            { type: 'fire_juggler', at: -4100, off: 55, room: 2 },
            { type: 'royal_guard', at: -4400, off: -30, room: 2 },
            { type: 'thunder_orb', at: -4400, off: 30, room: 2 },
            { type: 'mirror_clown', at: -5300, off: -50, room: 3 },
            { type: 'mirror_clown', at: -5300, off: 50, room: 3 },
            { type: 'circus_strongman', at: -5600, off: -45, room: 3 },
            { type: 'circus_strongman', at: -5600, off: 45, room: 3 },
            { type: 'fire_juggler', at: -5900, off: -55, room: 3 },
            { type: 'fire_juggler', at: -5900, off: 55, room: 3 },
            { type: 'choco_queen', at: -6200, off: -50, room: 3 },
            { type: 'choco_queen', at: -6200, off: 50, room: 3 }
        ],
        star: { at: -6800 }
    }),
    // 26층: 거울광대까지 섞인 종합전.
    26: makePathFloor({
        path: [[0, 0], [-1200, 0], [-1200, -1100], [0, -1100], [0, -2200], [-1200, -2200], [-1200, -3300], [0, -3300]],
        laneHalfWidth: 100,
        gates: [
            { entrance: -850, exit: -2000, room: 0 },
            { entrance: -2000, exit: -3500, room: 1 },
            { entrance: -3500, exit: -5050, room: 2 },
            { entrance: -5050, exit: -6700, room: 3 }
        ],
        monsters: [
            { type: 'mirror_clown', at: -1300, off: -40, room: 0 },
            { type: 'circus_strongman', at: -1300, off: 40, room: 0 },
            { type: 'thunder_orb', at: -1650, off: 0, room: 0 },
            { type: 'mirror_clown', at: -2600, off: -45, room: 1 },
            { type: 'mirror_clown', at: -2600, off: 45, room: 1 },
            { type: 'fire_juggler', at: -2900, off: -50, room: 1 },
            { type: 'fire_juggler', at: -2900, off: 50, room: 1 },
            { type: 'macaron_healer', at: -3250, off: 0, room: 1 },
            { type: 'mirror_clown', at: -4000, off: -50, room: 2 },
            { type: 'mirror_clown', at: -4000, off: 50, room: 2 },
            { type: 'circus_strongman', at: -4300, off: -55, room: 2 },
            { type: 'circus_strongman', at: -4300, off: 55, room: 2 },
            { type: 'royal_guard', at: -4650, off: -45, room: 2 },
            { type: 'royal_guard', at: -4650, off: 45, room: 2 },
            { type: 'choco_queen', at: -4900, off: 0, room: 2 },
            { type: 'mirror_clown', at: -5600, off: -50, room: 3 },
            { type: 'mirror_clown', at: -5600, off: 50, room: 3 },
            { type: 'fire_juggler', at: -5900, off: -55, room: 3 },
            { type: 'fire_juggler', at: -5900, off: 55, room: 3 },
            { type: 'circus_strongman', at: -6200, off: -45, room: 3 },
            { type: 'circus_strongman', at: -6200, off: 45, room: 3 },
            { type: 'royal_guard', at: -6450, off: -40, room: 3 },
            { type: 'royal_guard', at: -6450, off: 40, room: 3 },
            { type: 'taffy_brute', at: -6600, off: 0, room: 3 }
        ],
        star: { at: -7050 }
    }),
    // 27층: 회전목마 포탑 등장. 지금까지 나온 포탑 중 빔이 가장 빨리 따라온다.
    27: makePathFloor({
        path: [[0, 0], [0, -1200], [1200, -1200], [1200, -2400], [0, -2400], [0, -3600], [1200, -3600], [1200, -4800]],
        laneHalfWidth: 105,
        gates: [
            { entrance: -850, exit: -2050, room: 0 },
            { entrance: -2050, exit: -3600, room: 1 },
            { entrance: -3600, exit: -5200, room: 2 },
            { entrance: -5200, exit: -6900, room: 3 }
        ],
        monsters: [
            { type: 'carnival_turret', at: -1350, off: 0, room: 0 },
            { type: 'fire_juggler', at: -1650, off: 0, room: 0 },
            { type: 'carnival_turret', at: -2700, off: -50, room: 1 },
            { type: 'carnival_turret', at: -2700, off: 50, room: 1 },
            { type: 'mirror_clown', at: -3000, off: 0, room: 1 },
            { type: 'circus_strongman', at: -3300, off: 0, room: 1 },
            { type: 'carnival_turret', at: -4100, off: -55, room: 2 },
            { type: 'carnival_turret', at: -4100, off: 55, room: 2 },
            { type: 'fire_juggler', at: -4400, off: -50, room: 2 },
            { type: 'fire_juggler', at: -4400, off: 50, room: 2 },
            { type: 'royal_guard', at: -4800, off: -45, room: 2 },
            { type: 'royal_guard', at: -4800, off: 45, room: 2 },
            { type: 'macaron_healer', at: -5050, off: 0, room: 2 },
            { type: 'carnival_turret', at: -5700, off: -55, room: 3 },
            { type: 'carnival_turret', at: -5700, off: 55, room: 3 },
            { type: 'mirror_clown', at: -6000, off: -50, room: 3 },
            { type: 'mirror_clown', at: -6000, off: 50, room: 3 },
            { type: 'circus_strongman', at: -6300, off: -45, room: 3 },
            { type: 'circus_strongman', at: -6300, off: 45, room: 3 },
            { type: 'choco_queen', at: -6600, off: -50, room: 3 },
            { type: 'choco_queen', at: -6600, off: 50, room: 3 }
        ],
        star: { at: -7250 }
    }),
    // 28층: 29층 직전. 지금까지 나온 서커스 잔당(차력사·저글러·거울광대·
    // 회전목마 포탑)이 전부 뒤섞인 마지막 방이 기다린다.
    28: makePathFloor({
        path: [[0, 0], [-1250, 0], [-1250, -1150], [0, -1150], [0, -2300], [-1250, -2300], [-1250, -3450], [0, -3450], [0, -4600]],
        laneHalfWidth: 105,
        gates: [
            { entrance: -900, exit: -2150, room: 0 },
            { entrance: -2150, exit: -3800, room: 1 },
            { entrance: -3800, exit: -5500, room: 2 },
            { entrance: -5500, exit: -7300, room: 3 }
        ],
        monsters: [
            { type: 'carnival_turret', at: -1400, off: -30, room: 0 },
            { type: 'mirror_clown', at: -1400, off: 30, room: 0 },
            { type: 'fire_juggler', at: -1800, off: 0, room: 0 },
            { type: 'carnival_turret', at: -2700, off: -50, room: 1 },
            { type: 'carnival_turret', at: -2700, off: 50, room: 1 },
            { type: 'circus_strongman', at: -3100, off: -45, room: 1 },
            { type: 'circus_strongman', at: -3100, off: 45, room: 1 },
            { type: 'macaron_healer', at: -3500, off: 0, room: 1 },
            { type: 'carnival_turret', at: -4200, off: -55, room: 2 },
            { type: 'carnival_turret', at: -4200, off: 55, room: 2 },
            { type: 'mirror_clown', at: -4500, off: -50, room: 2 },
            { type: 'mirror_clown', at: -4500, off: 50, room: 2 },
            { type: 'fire_juggler', at: -4900, off: -50, room: 2 },
            { type: 'fire_juggler', at: -4900, off: 50, room: 2 },
            { type: 'royal_guard', at: -5250, off: -45, room: 2 },
            { type: 'royal_guard', at: -5250, off: 45, room: 2 },
            { type: 'carnival_turret', at: -5900, off: -55, room: 3 },
            { type: 'carnival_turret', at: -5900, off: 55, room: 3 },
            { type: 'circus_strongman', at: -6200, off: -50, room: 3 },
            { type: 'circus_strongman', at: -6200, off: 50, room: 3 },
            { type: 'mirror_clown', at: -6500, off: -45, room: 3 },
            { type: 'mirror_clown', at: -6500, off: 45, room: 3 },
            { type: 'fire_juggler', at: -6800, off: -50, room: 3 },
            { type: 'fire_juggler', at: -6800, off: 50, room: 3 },
            { type: 'choco_queen', at: -7050, off: -55, room: 3 },
            { type: 'choco_queen', at: -7050, off: 55, room: 3 },
            { type: 'royal_guard', at: -7200, off: -40, room: 3 },
            { type: 'royal_guard', at: -7200, off: 40, room: 3 }
        ],
        star: { at: -7650 }
    }),
    // 29층: 30층 보스 직전 마지막 층. 마지막 방에서 서커스 단장이 저글러를
    // 계속 불러들이며 버틴다 -- 19층의 마지막 방(여왕 둘 + 근위대 셋)이
    // 그랬듯, 사실상 작은 보스전이다.
    29: makePathFloor({
        path: [[0, 0], [0, -1300], [1300, -1300], [1300, -2600], [0, -2600], [0, -3900], [1300, -3900], [1300, -5200], [0, -5200]],
        laneHalfWidth: 105,
        gates: [
            { entrance: -900, exit: -2250, room: 0 },
            { entrance: -2250, exit: -4000, room: 1 },
            { entrance: -4000, exit: -5900, room: 2 },
            { entrance: -5900, exit: -8100, room: 3 }
        ],
        monsters: [
            { type: 'carnival_turret', at: -1500, off: -50, room: 0 },
            { type: 'mirror_clown', at: -1500, off: 0, room: 0 },
            { type: 'fire_juggler', at: -1500, off: 50, room: 0 },
            { type: 'circus_strongman', at: -1900, off: 0, room: 0 },
            { type: 'circus_strongman', at: -3000, off: -45, room: 1 },
            { type: 'circus_strongman', at: -3000, off: 45, room: 1 },
            { type: 'mirror_clown', at: -3300, off: -50, room: 1 },
            { type: 'mirror_clown', at: -3300, off: 50, room: 1 },
            { type: 'fire_juggler', at: -3600, off: -55, room: 1 },
            { type: 'fire_juggler', at: -3600, off: 55, room: 1 },
            { type: 'macaron_healer', at: -3850, off: 0, room: 1 },
            { type: 'carnival_turret', at: -4700, off: -55, room: 2 },
            { type: 'carnival_turret', at: -4700, off: 55, room: 2 },
            { type: 'circus_strongman', at: -5000, off: -50, room: 2 },
            { type: 'circus_strongman', at: -5000, off: 50, room: 2 },
            { type: 'mirror_clown', at: -5300, off: -45, room: 2 },
            { type: 'mirror_clown', at: -5300, off: 45, room: 2 },
            { type: 'royal_guard', at: -5600, off: -40, room: 2 },
            { type: 'royal_guard', at: -5600, off: 40, room: 2 },
            { type: 'choco_queen', at: -5800, off: 0, room: 2 },
            { type: 'ringmaster', at: -6800, off: 0, room: 3 },
            { type: 'circus_strongman', at: -7100, off: -50, room: 3 },
            { type: 'circus_strongman', at: -7100, off: 50, room: 3 },
            { type: 'fire_juggler', at: -7350, off: -55, room: 3 },
            { type: 'fire_juggler', at: -7350, off: 55, room: 3 },
            { type: 'mirror_clown', at: -7600, off: -50, room: 3 },
            { type: 'mirror_clown', at: -7600, off: 50, room: 3 },
            { type: 'royal_guard', at: -7800, off: -45, room: 3 },
            { type: 'royal_guard', at: -7800, off: 45, room: 3 },
            { type: 'choco_queen', at: -7950, off: -50, room: 3 },
            { type: 'choco_queen', at: -7950, off: 50, room: 3 },
            { type: 'macaron_healer', at: -8050, off: -40, room: 3 },
            { type: 'macaron_healer', at: -8050, off: 40, room: 3 }
        ],
        star: { at: -8450 }
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
    },
    // ==================== 30~49층: 얼음/서리 챕터 ====================
    // 이 구간은 보스전이 없다 -- 30층/40층도 다른 층과 똑같이 별까지 걸어가면
    // 클리어되는 웨이브 층이다(bossFloor를 안 붙였으므로 isTowerBossFloor도
    // 걸리지 않는다). 30~39층에 새 몬스터를 하나씩 풀고, 40~49층은 그 10종을
    // 섞어서 규모만 키운다.
    // 30층: 챕터 시작. 얼음 정령만 나온다.
    30: makePathFloor({
        path: [[0, 0], [0, -1000], [1000, -1000], [1000, -2000], [0, -2000], [0, -3000], [1000, -3000]],
        laneHalfWidth: 100,
        gates: [
            { entrance: -700, exit: -1700, room: 0 },
            { entrance: -1700, exit: -2900, room: 1 },
            { entrance: -2900, exit: -4200, room: 2 },
            { entrance: -4200, exit: -5600, room: 3 }
        ],
        monsters: [
            { type: 'ice_spirit', at: -1000, off: -55, room: 0 },
            { type: 'ice_spirit', at: -1300, off: 55, room: 0 },
            { type: 'ice_spirit', at: -1550, off: -30, room: 0 },
            { type: 'ice_spirit', at: -2060, off: -55, room: 1 },
            { type: 'ice_spirit', at: -2420, off: 55, room: 1 },
            { type: 'ice_spirit', at: -2720, off: -30, room: 1 },
            { type: 'ice_spirit', at: -2060, off: 30, room: 1 },
            { type: 'ice_spirit', at: -2420, off: -15, room: 1 },
            { type: 'ice_spirit', at: -3290, off: -55, room: 2 },
            { type: 'ice_spirit', at: -3680, off: 55, room: 2 },
            { type: 'ice_spirit', at: -4005, off: -30, room: 2 },
            { type: 'ice_spirit', at: -3290, off: 30, room: 2 },
            { type: 'ice_spirit', at: -3680, off: -15, room: 2 },
            { type: 'ice_spirit', at: -4005, off: 15, room: 2 },
            { type: 'ice_spirit', at: -4620, off: -55, room: 3 },
            { type: 'ice_spirit', at: -5040, off: 55, room: 3 },
            { type: 'ice_spirit', at: -5390, off: -30, room: 3 },
            { type: 'ice_spirit', at: -4620, off: 30, room: 3 },
            { type: 'ice_spirit', at: -5040, off: -15, room: 3 },
            { type: 'ice_spirit', at: -5390, off: 15, room: 3 }
        ],
        star: { at: -5860 }
    }),
    // 31층: 고드름 궁수 등장.
    31: makePathFloor({
        path: [[0, 0], [0, -1020], [-1020, -1020], [-1020, -2040], [0, -2040], [0, -3060], [-1020, -3060]],
        laneHalfWidth: 100,
        gates: [
            { entrance: -714, exit: -1734, room: 0 },
            { entrance: -1734, exit: -2958, room: 1 },
            { entrance: -2958, exit: -4284, room: 2 },
            { entrance: -4284, exit: -5712, room: 3 }
        ],
        monsters: [
            { type: 'ice_spirit', at: -1020, off: -55, room: 0 },
            { type: 'ice_spirit', at: -1326, off: 55, room: 0 },
            { type: 'icicle_archer', at: -1581, off: -30, room: 0 },
            { type: 'icicle_archer', at: -1020, off: 30, room: 0 },
            { type: 'ice_spirit', at: -2101, off: -55, room: 1 },
            { type: 'ice_spirit', at: -2468, off: 55, room: 1 },
            { type: 'ice_spirit', at: -2774, off: -30, room: 1 },
            { type: 'icicle_archer', at: -2101, off: 30, room: 1 },
            { type: 'icicle_archer', at: -2468, off: -15, room: 1 },
            { type: 'icicle_archer', at: -2774, off: 15, room: 1 },
            { type: 'ice_spirit', at: -3356, off: -55, room: 2 },
            { type: 'ice_spirit', at: -3754, off: 55, room: 2 },
            { type: 'ice_spirit', at: -4085, off: -30, room: 2 },
            { type: 'icicle_archer', at: -3356, off: 30, room: 2 },
            { type: 'icicle_archer', at: -3754, off: -15, room: 2 },
            { type: 'icicle_archer', at: -4085, off: 15, room: 2 },
            { type: 'ice_spirit', at: -4712, off: -55, room: 3 },
            { type: 'ice_spirit', at: -5141, off: 55, room: 3 },
            { type: 'ice_spirit', at: -5498, off: -30, room: 3 },
            { type: 'icicle_archer', at: -4712, off: 30, room: 3 },
            { type: 'icicle_archer', at: -5141, off: -15, room: 3 },
            { type: 'icicle_archer', at: -5498, off: 15, room: 3 },
            { type: 'icicle_archer', at: -4712, off: 0, room: 3 }
        ],
        star: { at: -5977 }
    }),
    // 32층: 눈보라 늑대 등장. 지금까지 나온 근접 중 가장 빠르다.
    32: makePathFloor({
        path: [[0, 0], [0, -1040], [1040, -1040], [1040, -2080], [0, -2080], [0, -3120], [1040, -3120]],
        laneHalfWidth: 100,
        gates: [
            { entrance: -728, exit: -1768, room: 0 },
            { entrance: -1768, exit: -3016, room: 1 },
            { entrance: -3016, exit: -4368, room: 2 },
            { entrance: -4368, exit: -5824, room: 3 }
        ],
        monsters: [
            { type: 'snow_wolf', at: -1040, off: -55, room: 0 },
            { type: 'snow_wolf', at: -1352, off: 55, room: 0 },
            { type: 'ice_spirit', at: -1612, off: -30, room: 0 },
            { type: 'ice_spirit', at: -1040, off: 30, room: 0 },
            { type: 'snow_wolf', at: -2142, off: -55, room: 1 },
            { type: 'snow_wolf', at: -2517, off: 55, room: 1 },
            { type: 'icicle_archer', at: -2829, off: -30, room: 1 },
            { type: 'icicle_archer', at: -2142, off: 30, room: 1 },
            { type: 'ice_spirit', at: -2517, off: -15, room: 1 },
            { type: 'ice_spirit', at: -2829, off: 15, room: 1 },
            { type: 'snow_wolf', at: -3422, off: -55, room: 2 },
            { type: 'snow_wolf', at: -3827, off: 55, room: 2 },
            { type: 'snow_wolf', at: -4165, off: -30, room: 2 },
            { type: 'icicle_archer', at: -3422, off: 30, room: 2 },
            { type: 'icicle_archer', at: -3827, off: -15, room: 2 },
            { type: 'ice_spirit', at: -4165, off: 15, room: 2 },
            { type: 'ice_spirit', at: -3422, off: 0, room: 2 },
            { type: 'snow_wolf', at: -4805, off: -55, room: 3 },
            { type: 'snow_wolf', at: -5242, off: 55, room: 3 },
            { type: 'snow_wolf', at: -5606, off: -30, room: 3 },
            { type: 'icicle_archer', at: -4805, off: 30, room: 3 },
            { type: 'icicle_archer', at: -5242, off: -15, room: 3 },
            { type: 'ice_spirit', at: -5606, off: 15, room: 3 },
            { type: 'ice_spirit', at: -4805, off: 0, room: 3 }
        ],
        star: { at: -6094 }
    }),
    // 33층: 서리 골렘 등장. 설탕 골렘처럼 쓰러지면 조각으로 갈라진다.
    33: makePathFloor({
        path: [[0, 0], [0, -1060], [-1060, -1060], [-1060, -2120], [0, -2120], [0, -3180], [-1060, -3180]],
        laneHalfWidth: 100,
        gates: [
            { entrance: -742, exit: -1802, room: 0 },
            { entrance: -1802, exit: -3074, room: 1 },
            { entrance: -3074, exit: -4452, room: 2 },
            { entrance: -4452, exit: -5936, room: 3 }
        ],
        monsters: [
            { type: 'frost_golem', at: -1060, off: -55, room: 0 },
            { type: 'frost_golem', at: -1378, off: 55, room: 0 },
            { type: 'snow_wolf', at: -1643, off: -30, room: 0 },
            { type: 'snow_wolf', at: -1060, off: 30, room: 0 },
            { type: 'frost_golem', at: -2184, off: -55, room: 1 },
            { type: 'frost_golem', at: -2565, off: 55, room: 1 },
            { type: 'snow_wolf', at: -2883, off: -30, room: 1 },
            { type: 'snow_wolf', at: -2184, off: 30, room: 1 },
            { type: 'icicle_archer', at: -2565, off: -15, room: 1 },
            { type: 'icicle_archer', at: -2883, off: 15, room: 1 },
            { type: 'frost_golem', at: -3487, off: -55, room: 2 },
            { type: 'frost_golem', at: -3901, off: 55, room: 2 },
            { type: 'snow_wolf', at: -4245, off: -30, room: 2 },
            { type: 'snow_wolf', at: -3487, off: 30, room: 2 },
            { type: 'ice_spirit', at: -3901, off: -15, room: 2 },
            { type: 'ice_spirit', at: -4245, off: 15, room: 2 },
            { type: 'icicle_archer', at: -3487, off: 0, room: 2 },
            { type: 'frost_golem', at: -4897, off: -55, room: 3 },
            { type: 'frost_golem', at: -5342, off: 55, room: 3 },
            { type: 'frost_golem', at: -5713, off: -30, room: 3 },
            { type: 'snow_wolf', at: -4897, off: 30, room: 3 },
            { type: 'snow_wolf', at: -5342, off: -15, room: 3 },
            { type: 'icicle_archer', at: -5713, off: 15, room: 3 },
            { type: 'icicle_archer', at: -4897, off: 0, room: 3 },
            { type: 'ice_spirit', at: -5342, off: -45, room: 3 }
        ],
        star: { at: -6212 }
    }),
    // 34층: 눈꽃 치유사 등장. 마카롱 치유사보다 오라가 넓고 세다.
    34: makePathFloor({
        path: [[0, 0], [0, -1080], [1080, -1080], [1080, -2160], [0, -2160], [0, -3240], [1080, -3240]],
        laneHalfWidth: 105,
        gates: [
            { entrance: -756, exit: -1836, room: 0 },
            { entrance: -1836, exit: -3132, room: 1 },
            { entrance: -3132, exit: -4536, room: 2 },
            { entrance: -4536, exit: -6048, room: 3 }
        ],
        monsters: [
            { type: 'snowflake_healer', at: -1080, off: -60, room: 0 },
            { type: 'frost_golem', at: -1404, off: 60, room: 0 },
            { type: 'frost_golem', at: -1674, off: -30, room: 0 },
            { type: 'snowflake_healer', at: -2225, off: -60, room: 1 },
            { type: 'snowflake_healer', at: -2614, off: 60, room: 1 },
            { type: 'snow_wolf', at: -2938, off: -30, room: 1 },
            { type: 'snow_wolf', at: -2225, off: 30, room: 1 },
            { type: 'frost_golem', at: -2614, off: -15, room: 1 },
            { type: 'frost_golem', at: -2938, off: 15, room: 1 },
            { type: 'snowflake_healer', at: -3553, off: -60, room: 2 },
            { type: 'frost_golem', at: -3974, off: 60, room: 2 },
            { type: 'frost_golem', at: -4325, off: -30, room: 2 },
            { type: 'snow_wolf', at: -3553, off: 30, room: 2 },
            { type: 'snow_wolf', at: -3974, off: -15, room: 2 },
            { type: 'icicle_archer', at: -4325, off: 15, room: 2 },
            { type: 'snowflake_healer', at: -4990, off: -60, room: 3 },
            { type: 'snowflake_healer', at: -5443, off: 60, room: 3 },
            { type: 'frost_golem', at: -5821, off: -30, room: 3 },
            { type: 'frost_golem', at: -4990, off: 30, room: 3 },
            { type: 'snow_wolf', at: -5443, off: -15, room: 3 },
            { type: 'snow_wolf', at: -5821, off: 15, room: 3 },
            { type: 'icicle_archer', at: -4990, off: 0, room: 3 },
            { type: 'icicle_archer', at: -5443, off: -45, room: 3 }
        ],
        star: { at: -6329 }
    }),
    // 35층: 얼음 기사 등장. 왕실 근위대처럼 한 번은 반드시 버틴다.
    35: makePathFloor({
        path: [[0, 0], [0, -1100], [-1100, -1100], [-1100, -2200], [0, -2200], [0, -3300], [-1100, -3300]],
        laneHalfWidth: 105,
        gates: [
            { entrance: -770, exit: -1870, room: 0 },
            { entrance: -1870, exit: -3190, room: 1 },
            { entrance: -3190, exit: -4620, room: 2 },
            { entrance: -4620, exit: -6160, room: 3 }
        ],
        monsters: [
            { type: 'ice_knight', at: -1100, off: -60, room: 0 },
            { type: 'ice_knight', at: -1430, off: 60, room: 0 },
            { type: 'snow_wolf', at: -1705, off: -30, room: 0 },
            { type: 'snow_wolf', at: -1100, off: 30, room: 0 },
            { type: 'ice_knight', at: -2266, off: -60, room: 1 },
            { type: 'ice_knight', at: -2662, off: 60, room: 1 },
            { type: 'snowflake_healer', at: -2992, off: -30, room: 1 },
            { type: 'snowflake_healer', at: -2266, off: 30, room: 1 },
            { type: 'frost_golem', at: -2662, off: -15, room: 1 },
            { type: 'frost_golem', at: -2992, off: 15, room: 1 },
            { type: 'ice_knight', at: -3619, off: -60, room: 2 },
            { type: 'ice_knight', at: -4048, off: 60, room: 2 },
            { type: 'snow_wolf', at: -4406, off: -30, room: 2 },
            { type: 'snow_wolf', at: -3619, off: 30, room: 2 },
            { type: 'icicle_archer', at: -4048, off: -15, room: 2 },
            { type: 'icicle_archer', at: -4406, off: 15, room: 2 },
            { type: 'frost_golem', at: -3619, off: 0, room: 2 },
            { type: 'ice_knight', at: -5082, off: -60, room: 3 },
            { type: 'ice_knight', at: -5544, off: 60, room: 3 },
            { type: 'ice_knight', at: -5929, off: -30, room: 3 },
            { type: 'snowflake_healer', at: -5082, off: 30, room: 3 },
            { type: 'snowflake_healer', at: -5544, off: -15, room: 3 },
            { type: 'snow_wolf', at: -5929, off: 15, room: 3 },
            { type: 'snow_wolf', at: -5082, off: 0, room: 3 },
            { type: 'frost_golem', at: -5544, off: -45, room: 3 }
        ],
        star: { at: -6446 }
    }),
    // 36층: 서리 대포 등장. 지금까지 나온 포탑 중 빔이 가장 세다.
    36: makePathFloor({
        path: [[0, 0], [0, -1120], [1120, -1120], [1120, -2240], [0, -2240], [0, -3360], [1120, -3360]],
        laneHalfWidth: 105,
        gates: [
            { entrance: -784, exit: -1904, room: 0 },
            { entrance: -1904, exit: -3248, room: 1 },
            { entrance: -3248, exit: -4704, room: 2 },
            { entrance: -4704, exit: -6272, room: 3 }
        ],
        monsters: [
            { type: 'frost_cannon', at: -1120, off: -60, room: 0 },
            { type: 'ice_knight', at: -1456, off: 60, room: 0 },
            { type: 'ice_knight', at: -1736, off: -30, room: 0 },
            { type: 'frost_cannon', at: -2307, off: -60, room: 1 },
            { type: 'frost_cannon', at: -2710, off: 60, room: 1 },
            { type: 'snow_wolf', at: -3046, off: -30, room: 1 },
            { type: 'snow_wolf', at: -2307, off: 30, room: 1 },
            { type: 'ice_knight', at: -2710, off: -15, room: 1 },
            { type: 'ice_knight', at: -3046, off: 15, room: 1 },
            { type: 'frost_cannon', at: -3685, off: -60, room: 2 },
            { type: 'ice_knight', at: -4122, off: 60, room: 2 },
            { type: 'ice_knight', at: -4486, off: -30, room: 2 },
            { type: 'snowflake_healer', at: -3685, off: 30, room: 2 },
            { type: 'snowflake_healer', at: -4122, off: -15, room: 2 },
            { type: 'frost_golem', at: -4486, off: 15, room: 2 },
            { type: 'frost_cannon', at: -5174, off: -60, room: 3 },
            { type: 'frost_cannon', at: -5645, off: 60, room: 3 },
            { type: 'ice_knight', at: -6037, off: -30, room: 3 },
            { type: 'ice_knight', at: -5174, off: 30, room: 3 },
            { type: 'snow_wolf', at: -5645, off: -15, room: 3 },
            { type: 'snow_wolf', at: -6037, off: 15, room: 3 },
            { type: 'frost_golem', at: -5174, off: 0, room: 3 },
            { type: 'frost_golem', at: -5645, off: -45, room: 3 }
        ],
        star: { at: -6563 }
    }),
    // 37층: 눈사람 폭탄병 등장. 사탕 폭탄병보다 빨리 달려들고 더 세게 터진다.
    37: makePathFloor({
        path: [[0, 0], [0, -1140], [-1140, -1140], [-1140, -2280], [0, -2280], [0, -3420], [-1140, -3420]],
        laneHalfWidth: 105,
        gates: [
            { entrance: -798, exit: -1938, room: 0 },
            { entrance: -1938, exit: -3306, room: 1 },
            { entrance: -3306, exit: -4788, room: 2 },
            { entrance: -4788, exit: -6384, room: 3 }
        ],
        monsters: [
            { type: 'snowman_bomber', at: -1140, off: -60, room: 0 },
            { type: 'snowman_bomber', at: -1482, off: 60, room: 0 },
            { type: 'snow_wolf', at: -1767, off: -30, room: 0 },
            { type: 'snow_wolf', at: -1140, off: 30, room: 0 },
            { type: 'snowman_bomber', at: -2348, off: -60, room: 1 },
            { type: 'snowman_bomber', at: -2759, off: 60, room: 1 },
            { type: 'frost_cannon', at: -3101, off: -30, room: 1 },
            { type: 'frost_cannon', at: -2348, off: 30, room: 1 },
            { type: 'ice_knight', at: -2759, off: -15, room: 1 },
            { type: 'ice_knight', at: -3101, off: 15, room: 1 },
            { type: 'snowman_bomber', at: -3751, off: -60, room: 2 },
            { type: 'snowman_bomber', at: -4195, off: 60, room: 2 },
            { type: 'icicle_archer', at: -4566, off: -30, room: 2 },
            { type: 'icicle_archer', at: -3751, off: 30, room: 2 },
            { type: 'frost_golem', at: -4195, off: -15, room: 2 },
            { type: 'frost_golem', at: -4566, off: 15, room: 2 },
            { type: 'ice_knight', at: -3751, off: 0, room: 2 },
            { type: 'snowman_bomber', at: -5267, off: -60, room: 3 },
            { type: 'snowman_bomber', at: -5746, off: 60, room: 3 },
            { type: 'snowman_bomber', at: -6145, off: -30, room: 3 },
            { type: 'ice_knight', at: -5267, off: 30, room: 3 },
            { type: 'ice_knight', at: -5746, off: -15, room: 3 },
            { type: 'frost_cannon', at: -6145, off: 15, room: 3 },
            { type: 'frost_cannon', at: -5267, off: 0, room: 3 },
            { type: 'snowflake_healer', at: -5746, off: -45, room: 3 }
        ],
        star: { at: -6680 }
    }),
    // 38층: 눈보라 주술사 등장. 초콜릿 여왕처럼 부하(눈보라 늑대)를 계속 부른다.
    38: makePathFloor({
        path: [[0, 0], [0, -1160], [1160, -1160], [1160, -2320], [0, -2320], [0, -3480], [1160, -3480]],
        laneHalfWidth: 110,
        gates: [
            { entrance: -812, exit: -1972, room: 0 },
            { entrance: -1972, exit: -3364, room: 1 },
            { entrance: -3364, exit: -4872, room: 2 },
            { entrance: -4872, exit: -6496, room: 3 }
        ],
        monsters: [
            { type: 'blizzard_shaman', at: -1160, off: -60, room: 0 },
            { type: 'snowman_bomber', at: -1508, off: 60, room: 0 },
            { type: 'snowman_bomber', at: -1798, off: -35, room: 0 },
            { type: 'blizzard_shaman', at: -2390, off: -60, room: 1 },
            { type: 'snow_wolf', at: -2807, off: 60, room: 1 },
            { type: 'snow_wolf', at: -3155, off: -35, room: 1 },
            { type: 'snow_wolf', at: -2390, off: 35, room: 1 },
            { type: 'ice_knight', at: -2807, off: -15, room: 1 },
            { type: 'ice_knight', at: -3155, off: 15, room: 1 },
            { type: 'blizzard_shaman', at: -3816, off: -60, room: 2 },
            { type: 'blizzard_shaman', at: -4269, off: 60, room: 2 },
            { type: 'frost_cannon', at: -4646, off: -35, room: 2 },
            { type: 'frost_cannon', at: -3816, off: 35, room: 2 },
            { type: 'icicle_archer', at: -4269, off: -15, room: 2 },
            { type: 'icicle_archer', at: -4646, off: 15, room: 2 },
            { type: 'frost_golem', at: -3816, off: 0, room: 2 },
            { type: 'blizzard_shaman', at: -5359, off: -60, room: 3 },
            { type: 'blizzard_shaman', at: -5846, off: 60, room: 3 },
            { type: 'snowman_bomber', at: -6252, off: -35, room: 3 },
            { type: 'snowman_bomber', at: -5359, off: 35, room: 3 },
            { type: 'ice_knight', at: -5846, off: -15, room: 3 },
            { type: 'ice_knight', at: -6252, off: 15, room: 3 },
            { type: 'snowflake_healer', at: -5359, off: 0, room: 3 },
            { type: 'snowflake_healer', at: -5846, off: -50, room: 3 }
        ],
        star: { at: -6798 }
    }),
    // 39층: 서리 여왕 등장. 40~49층 내내 섞여 나오는 이 챕터의 정예로, 체력이
    // 40% 아래로 떨어지면 격노하고 고드름 궁수를 계속 불러들인다.
    39: makePathFloor({
        path: [[0, 0], [0, -1220], [-1220, -1220], [-1220, -2440], [0, -2440], [0, -3660], [-1220, -3660]],
        laneHalfWidth: 110,
        gates: [
            { entrance: -854, exit: -2074, room: 0 },
            { entrance: -2074, exit: -3538, room: 1 },
            { entrance: -3538, exit: -5124, room: 2 },
            { entrance: -5124, exit: -6832, room: 3 }
        ],
        monsters: [
            { type: 'frost_queen', at: -1220, off: -60, room: 0 },
            { type: 'blizzard_shaman', at: -1586, off: 60, room: 0 },
            { type: 'snow_wolf', at: -1891, off: -35, room: 0 },
            { type: 'snow_wolf', at: -1220, off: 35, room: 0 },
            { type: 'frost_queen', at: -2513, off: -60, room: 1 },
            { type: 'ice_knight', at: -2952, off: 60, room: 1 },
            { type: 'ice_knight', at: -3318, off: -35, room: 1 },
            { type: 'ice_knight', at: -2513, off: 35, room: 1 },
            { type: 'snowman_bomber', at: -2952, off: -15, room: 1 },
            { type: 'snowman_bomber', at: -3318, off: 15, room: 1 },
            { type: 'icicle_archer', at: -2513, off: 0, room: 1 },
            { type: 'frost_queen', at: -4014, off: -60, room: 2 },
            { type: 'frost_cannon', at: -4490, off: 60, room: 2 },
            { type: 'frost_cannon', at: -4886, off: -35, room: 2 },
            { type: 'frost_golem', at: -4014, off: 35, room: 2 },
            { type: 'frost_golem', at: -4490, off: -15, room: 2 },
            { type: 'snowflake_healer', at: -4886, off: 15, room: 2 },
            { type: 'snowflake_healer', at: -4014, off: 0, room: 2 },
            { type: 'snow_wolf', at: -4490, off: -50, room: 2 },
            { type: 'frost_queen', at: -5636, off: -60, room: 3 },
            { type: 'frost_queen', at: -6149, off: 60, room: 3 },
            { type: 'blizzard_shaman', at: -6576, off: -35, room: 3 },
            { type: 'blizzard_shaman', at: -5636, off: 35, room: 3 },
            { type: 'ice_knight', at: -6149, off: -15, room: 3 },
            { type: 'ice_knight', at: -6576, off: 15, room: 3 },
            { type: 'snowman_bomber', at: -5636, off: 0, room: 3 },
            { type: 'snowman_bomber', at: -6149, off: -50, room: 3 }
        ],
        star: { at: -7149 }
    }),
    // ---- 40층부터. 정예 관문(39층)을 넘은 뒤, 10종을 섞어 규모를 키운다. ----
    40: makePathFloor({
        path: [[0, 0], [0, -1050], [1050, -1050], [1050, -2100], [0, -2100], [0, -3150], [1050, -3150]],
        laneHalfWidth: 110,
        gates: [
            { entrance: -735, exit: -1785, room: 0 },
            { entrance: -1785, exit: -3045, room: 1 },
            { entrance: -3045, exit: -4410, room: 2 },
            { entrance: -4410, exit: -5880, room: 3 }
        ],
        monsters: [
            { type: 'ice_spirit', at: -1050, off: -60, room: 0 },
            { type: 'ice_spirit', at: -1365, off: 60, room: 0 },
            { type: 'snow_wolf', at: -1628, off: -35, room: 0 },
            { type: 'snow_wolf', at: -1050, off: 35, room: 0 },
            { type: 'icicle_archer', at: -2163, off: -60, room: 1 },
            { type: 'icicle_archer', at: -2541, off: 60, room: 1 },
            { type: 'frost_golem', at: -2856, off: -35, room: 1 },
            { type: 'frost_golem', at: -2163, off: 35, room: 1 },
            { type: 'ice_knight', at: -2541, off: -15, room: 1 },
            { type: 'ice_knight', at: -2856, off: 15, room: 1 },
            { type: 'snowflake_healer', at: -3455, off: -60, room: 2 },
            { type: 'snowflake_healer', at: -3864, off: 60, room: 2 },
            { type: 'frost_cannon', at: -4205, off: -35, room: 2 },
            { type: 'frost_cannon', at: -3455, off: 35, room: 2 },
            { type: 'snow_wolf', at: -3864, off: -15, room: 2 },
            { type: 'snow_wolf', at: -4205, off: 15, room: 2 },
            { type: 'frost_queen', at: -4851, off: -60, room: 3 },
            { type: 'blizzard_shaman', at: -5292, off: 60, room: 3 },
            { type: 'snowman_bomber', at: -5660, off: -35, room: 3 },
            { type: 'snowman_bomber', at: -4851, off: 35, room: 3 },
            { type: 'ice_knight', at: -5292, off: -15, room: 3 },
            { type: 'ice_knight', at: -5660, off: 15, room: 3 }
        ],
        star: { at: -6153 }
    }),
    41: makePathFloor({
        path: [[0, 0], [0, -1090], [-1090, -1090], [-1090, -2180], [0, -2180], [0, -3270], [-1090, -3270]],
        laneHalfWidth: 110,
        gates: [
            { entrance: -763, exit: -1853, room: 0 },
            { entrance: -1853, exit: -3161, room: 1 },
            { entrance: -3161, exit: -4578, room: 2 },
            { entrance: -4578, exit: -6104, room: 3 }
        ],
        monsters: [
            { type: 'frost_golem', at: -1090, off: -60, room: 0 },
            { type: 'frost_golem', at: -1417, off: 60, room: 0 },
            { type: 'icicle_archer', at: -1690, off: -35, room: 0 },
            { type: 'icicle_archer', at: -1090, off: 35, room: 0 },
            { type: 'snow_wolf', at: -2245, off: -60, room: 1 },
            { type: 'snow_wolf', at: -2638, off: 60, room: 1 },
            { type: 'snowflake_healer', at: -2965, off: -35, room: 1 },
            { type: 'snowflake_healer', at: -2245, off: 35, room: 1 },
            { type: 'ice_knight', at: -2638, off: -15, room: 1 },
            { type: 'ice_knight', at: -2965, off: 15, room: 1 },
            { type: 'frost_cannon', at: -3586, off: -60, room: 2 },
            { type: 'frost_cannon', at: -4011, off: 60, room: 2 },
            { type: 'snowman_bomber', at: -4365, off: -35, room: 2 },
            { type: 'snowman_bomber', at: -3586, off: 35, room: 2 },
            { type: 'frost_golem', at: -4011, off: -15, room: 2 },
            { type: 'frost_golem', at: -4365, off: 15, room: 2 },
            { type: 'frost_queen', at: -5036, off: -60, room: 3 },
            { type: 'blizzard_shaman', at: -5494, off: 60, room: 3 },
            { type: 'blizzard_shaman', at: -5875, off: -35, room: 3 },
            { type: 'ice_knight', at: -5036, off: 35, room: 3 },
            { type: 'ice_knight', at: -5494, off: -15, room: 3 },
            { type: 'icicle_archer', at: -5875, off: 15, room: 3 },
            { type: 'icicle_archer', at: -5036, off: 0, room: 3 }
        ],
        star: { at: -6387 }
    }),
    42: makePathFloor({
        path: [[0, 0], [0, -1130], [1130, -1130], [1130, -2260], [0, -2260], [0, -3390], [1130, -3390]],
        laneHalfWidth: 115,
        gates: [
            { entrance: -791, exit: -1921, room: 0 },
            { entrance: -1921, exit: -3277, room: 1 },
            { entrance: -3277, exit: -4746, room: 2 },
            { entrance: -4746, exit: -6328, room: 3 }
        ],
        monsters: [
            { type: 'ice_knight', at: -1130, off: -65, room: 0 },
            { type: 'ice_knight', at: -1469, off: 65, room: 0 },
            { type: 'snow_wolf', at: -1752, off: -35, room: 0 },
            { type: 'snow_wolf', at: -1130, off: 35, room: 0 },
            { type: 'frost_cannon', at: -2328, off: -65, room: 1 },
            { type: 'frost_cannon', at: -2735, off: 65, room: 1 },
            { type: 'snowman_bomber', at: -3074, off: -35, room: 1 },
            { type: 'snowman_bomber', at: -2328, off: 35, room: 1 },
            { type: 'snowflake_healer', at: -2735, off: -15, room: 1 },
            { type: 'frost_golem', at: -3074, off: 15, room: 1 },
            { type: 'frost_golem', at: -2328, off: 0, room: 1 },
            { type: 'blizzard_shaman', at: -3718, off: -65, room: 2 },
            { type: 'blizzard_shaman', at: -4158, off: 65, room: 2 },
            { type: 'icicle_archer', at: -4526, off: -35, room: 2 },
            { type: 'icicle_archer', at: -3718, off: 35, room: 2 },
            { type: 'snow_wolf', at: -4158, off: -15, room: 2 },
            { type: 'snow_wolf', at: -4526, off: 15, room: 2 },
            { type: 'snow_wolf', at: -3718, off: 0, room: 2 },
            { type: 'frost_queen', at: -5221, off: -65, room: 3 },
            { type: 'frost_queen', at: -5695, off: 65, room: 3 },
            { type: 'ice_knight', at: -6091, off: -35, room: 3 },
            { type: 'ice_knight', at: -5221, off: 35, room: 3 },
            { type: 'frost_golem', at: -5695, off: -15, room: 3 },
            { type: 'frost_golem', at: -6091, off: 15, room: 3 },
            { type: 'snowman_bomber', at: -5221, off: 0, room: 3 }
        ],
        star: { at: -6622 }
    }),
    43: makePathFloor({
        path: [[0, 0], [0, -1170], [-1170, -1170], [-1170, -2340], [0, -2340], [0, -3510], [-1170, -3510]],
        laneHalfWidth: 115,
        gates: [
            { entrance: -819, exit: -1989, room: 0 },
            { entrance: -1989, exit: -3393, room: 1 },
            { entrance: -3393, exit: -4914, room: 2 },
            { entrance: -4914, exit: -6552, room: 3 }
        ],
        monsters: [
            { type: 'snowflake_healer', at: -1170, off: -65, room: 0 },
            { type: 'frost_golem', at: -1521, off: 65, room: 0 },
            { type: 'frost_golem', at: -1814, off: -35, room: 0 },
            { type: 'snow_wolf', at: -1170, off: 35, room: 0 },
            { type: 'frost_cannon', at: -2410, off: -65, room: 1 },
            { type: 'frost_cannon', at: -2831, off: 65, room: 1 },
            { type: 'ice_knight', at: -3182, off: -35, room: 1 },
            { type: 'ice_knight', at: -2410, off: 35, room: 1 },
            { type: 'icicle_archer', at: -2831, off: -15, room: 1 },
            { type: 'icicle_archer', at: -3182, off: 15, room: 1 },
            { type: 'blizzard_shaman', at: -3849, off: -65, room: 2 },
            { type: 'blizzard_shaman', at: -4306, off: 65, room: 2 },
            { type: 'snowman_bomber', at: -4686, off: -35, room: 2 },
            { type: 'snowman_bomber', at: -3849, off: 35, room: 2 },
            { type: 'snow_wolf', at: -4306, off: -15, room: 2 },
            { type: 'snow_wolf', at: -4686, off: 15, room: 2 },
            { type: 'snowflake_healer', at: -3849, off: 0, room: 2 },
            { type: 'snowflake_healer', at: -4306, off: -50, room: 2 },
            { type: 'frost_queen', at: -5405, off: -65, room: 3 },
            { type: 'frost_queen', at: -5897, off: 65, room: 3 },
            { type: 'ice_knight', at: -6306, off: -35, room: 3 },
            { type: 'ice_knight', at: -5405, off: 35, room: 3 },
            { type: 'frost_golem', at: -5897, off: -15, room: 3 },
            { type: 'frost_golem', at: -6306, off: 15, room: 3 },
            { type: 'icicle_archer', at: -5405, off: 0, room: 3 },
            { type: 'icicle_archer', at: -5897, off: -50, room: 3 }
        ],
        star: { at: -6856 }
    }),
    44: makePathFloor({
        path: [[0, 0], [0, -1200], [1200, -1200], [1200, -2400], [0, -2400], [0, -3600], [1200, -3600]],
        laneHalfWidth: 115,
        gates: [
            { entrance: -840, exit: -2040, room: 0 },
            { entrance: -2040, exit: -3480, room: 1 },
            { entrance: -3480, exit: -5040, room: 2 },
            { entrance: -5040, exit: -6720, room: 3 }
        ],
        monsters: [
            { type: 'ice_spirit', at: -1200, off: -65, room: 0 },
            { type: 'ice_spirit', at: -1560, off: 65, room: 0 },
            { type: 'icicle_archer', at: -1860, off: -35, room: 0 },
            { type: 'snow_wolf', at: -1200, off: 35, room: 0 },
            { type: 'snow_wolf', at: -1560, off: -15, room: 0 },
            { type: 'frost_golem', at: -2472, off: -65, room: 1 },
            { type: 'frost_golem', at: -2904, off: 65, room: 1 },
            { type: 'snowflake_healer', at: -3264, off: -35, room: 1 },
            { type: 'snowflake_healer', at: -2472, off: 35, room: 1 },
            { type: 'frost_cannon', at: -2904, off: -15, room: 1 },
            { type: 'frost_cannon', at: -3264, off: 15, room: 1 },
            { type: 'blizzard_shaman', at: -3948, off: -65, room: 2 },
            { type: 'blizzard_shaman', at: -4416, off: 65, room: 2 },
            { type: 'snowman_bomber', at: -4806, off: -35, room: 2 },
            { type: 'snowman_bomber', at: -3948, off: 35, room: 2 },
            { type: 'ice_knight', at: -4416, off: -15, room: 2 },
            { type: 'ice_knight', at: -4806, off: 15, room: 2 },
            { type: 'snow_wolf', at: -3948, off: 0, room: 2 },
            { type: 'snow_wolf', at: -4416, off: -50, room: 2 },
            { type: 'frost_queen', at: -5544, off: -65, room: 3 },
            { type: 'frost_queen', at: -6048, off: 65, room: 3 },
            { type: 'blizzard_shaman', at: -6468, off: -35, room: 3 },
            { type: 'ice_knight', at: -5544, off: 35, room: 3 },
            { type: 'ice_knight', at: -6048, off: -15, room: 3 },
            { type: 'frost_cannon', at: -6468, off: 15, room: 3 },
            { type: 'frost_cannon', at: -5544, off: 0, room: 3 },
            { type: 'snowman_bomber', at: -6048, off: -50, room: 3 }
        ],
        star: { at: -7032 }
    }),
    45: makePathFloor({
        path: [[0, 0], [0, -1240], [-1240, -1240], [-1240, -2480], [0, -2480], [0, -3720], [-1240, -3720]],
        laneHalfWidth: 115,
        gates: [
            { entrance: -868, exit: -2108, room: 0 },
            { entrance: -2108, exit: -3596, room: 1 },
            { entrance: -3596, exit: -5208, room: 2 },
            { entrance: -5208, exit: -6944, room: 3 }
        ],
        monsters: [
            { type: 'snow_wolf', at: -1240, off: -65, room: 0 },
            { type: 'snow_wolf', at: -1612, off: 65, room: 0 },
            { type: 'icicle_archer', at: -1922, off: -35, room: 0 },
            { type: 'icicle_archer', at: -1240, off: 35, room: 0 },
            { type: 'frost_golem', at: -2554, off: -65, room: 1 },
            { type: 'frost_golem', at: -3001, off: 65, room: 1 },
            { type: 'snowflake_healer', at: -3373, off: -35, room: 1 },
            { type: 'snowflake_healer', at: -2554, off: 35, room: 1 },
            { type: 'ice_knight', at: -3001, off: -15, room: 1 },
            { type: 'ice_knight', at: -3373, off: 15, room: 1 },
            { type: 'frost_cannon', at: -2554, off: 0, room: 1 },
            { type: 'blizzard_shaman', at: -4080, off: -65, room: 2 },
            { type: 'blizzard_shaman', at: -4563, off: 65, room: 2 },
            { type: 'snowman_bomber', at: -4966, off: -35, room: 2 },
            { type: 'snowman_bomber', at: -4080, off: 35, room: 2 },
            { type: 'icicle_archer', at: -4563, off: -15, room: 2 },
            { type: 'icicle_archer', at: -4966, off: 15, room: 2 },
            { type: 'snow_wolf', at: -4080, off: 0, room: 2 },
            { type: 'snow_wolf', at: -4563, off: -50, room: 2 },
            { type: 'frost_queen', at: -5729, off: -65, room: 3 },
            { type: 'frost_queen', at: -6250, off: 65, room: 3 },
            { type: 'ice_knight', at: -6684, off: -35, room: 3 },
            { type: 'ice_knight', at: -5729, off: 35, room: 3 },
            { type: 'frost_golem', at: -6250, off: -15, room: 3 },
            { type: 'frost_golem', at: -6684, off: 15, room: 3 },
            { type: 'blizzard_shaman', at: -5729, off: 0, room: 3 },
            { type: 'snowman_bomber', at: -6250, off: -50, room: 3 }
        ],
        star: { at: -7266 }
    }),
    46: makePathFloor({
        path: [[0, 0], [0, -1280], [1280, -1280], [1280, -2560], [0, -2560], [0, -3840], [1280, -3840]],
        laneHalfWidth: 120,
        gates: [
            { entrance: -896, exit: -2176, room: 0 },
            { entrance: -2176, exit: -3712, room: 1 },
            { entrance: -3712, exit: -5376, room: 2 },
            { entrance: -5376, exit: -7168, room: 3 }
        ],
        monsters: [
            { type: 'ice_knight', at: -1280, off: -65, room: 0 },
            { type: 'ice_knight', at: -1664, off: 65, room: 0 },
            { type: 'snow_wolf', at: -1984, off: -35, room: 0 },
            { type: 'snow_wolf', at: -1280, off: 35, room: 0 },
            { type: 'icicle_archer', at: -1664, off: -20, room: 0 },
            { type: 'frost_cannon', at: -2637, off: -65, room: 1 },
            { type: 'frost_cannon', at: -3098, off: 65, room: 1 },
            { type: 'frost_golem', at: -3482, off: -35, room: 1 },
            { type: 'frost_golem', at: -2637, off: 35, room: 1 },
            { type: 'snowflake_healer', at: -3098, off: -20, room: 1 },
            { type: 'snowflake_healer', at: -3482, off: 20, room: 1 },
            { type: 'blizzard_shaman', at: -4211, off: -65, room: 2 },
            { type: 'blizzard_shaman', at: -4710, off: 65, room: 2 },
            { type: 'snowman_bomber', at: -5126, off: -35, room: 2 },
            { type: 'snowman_bomber', at: -4211, off: 35, room: 2 },
            { type: 'ice_knight', at: -4710, off: -20, room: 2 },
            { type: 'ice_knight', at: -5126, off: 20, room: 2 },
            { type: 'snow_wolf', at: -4211, off: 0, room: 2 },
            { type: 'snow_wolf', at: -4710, off: -55, room: 2 },
            { type: 'snow_wolf', at: -5126, off: 55, room: 2 },
            { type: 'frost_queen', at: -5914, off: -65, room: 3 },
            { type: 'frost_queen', at: -6451, off: 65, room: 3 },
            { type: 'blizzard_shaman', at: -6899, off: -35, room: 3 },
            { type: 'blizzard_shaman', at: -5914, off: 35, room: 3 },
            { type: 'frost_golem', at: -6451, off: -20, room: 3 },
            { type: 'frost_golem', at: -6899, off: 20, room: 3 },
            { type: 'icicle_archer', at: -5914, off: 0, room: 3 },
            { type: 'icicle_archer', at: -6451, off: -55, room: 3 }
        ],
        star: { at: -7501 }
    }),
    47: makePathFloor({
        path: [[0, 0], [0, -1320], [-1320, -1320], [-1320, -2640], [0, -2640], [0, -3960], [-1320, -3960]],
        laneHalfWidth: 120,
        gates: [
            { entrance: -924, exit: -2244, room: 0 },
            { entrance: -2244, exit: -3828, room: 1 },
            { entrance: -3828, exit: -5544, room: 2 },
            { entrance: -5544, exit: -7392, room: 3 }
        ],
        monsters: [
            { type: 'snowflake_healer', at: -1320, off: -65, room: 0 },
            { type: 'snowflake_healer', at: -1716, off: 65, room: 0 },
            { type: 'frost_golem', at: -2046, off: -35, room: 0 },
            { type: 'frost_golem', at: -1320, off: 35, room: 0 },
            { type: 'snow_wolf', at: -1716, off: -20, room: 0 },
            { type: 'frost_cannon', at: -2719, off: -65, room: 1 },
            { type: 'frost_cannon', at: -3194, off: 65, room: 1 },
            { type: 'ice_knight', at: -3590, off: -35, room: 1 },
            { type: 'ice_knight', at: -2719, off: 35, room: 1 },
            { type: 'ice_knight', at: -3194, off: -20, room: 1 },
            { type: 'icicle_archer', at: -3590, off: 20, room: 1 },
            { type: 'icicle_archer', at: -2719, off: 0, room: 1 },
            { type: 'blizzard_shaman', at: -4343, off: -65, room: 2 },
            { type: 'blizzard_shaman', at: -4858, off: 65, room: 2 },
            { type: 'snowman_bomber', at: -5287, off: -35, room: 2 },
            { type: 'snowman_bomber', at: -4343, off: 35, room: 2 },
            { type: 'snow_wolf', at: -4858, off: -20, room: 2 },
            { type: 'snow_wolf', at: -5287, off: 20, room: 2 },
            { type: 'frost_golem', at: -4343, off: 0, room: 2 },
            { type: 'frost_golem', at: -4858, off: -55, room: 2 },
            { type: 'frost_queen', at: -6098, off: -65, room: 3 },
            { type: 'frost_queen', at: -6653, off: 65, room: 3 },
            { type: 'ice_knight', at: -7115, off: -35, room: 3 },
            { type: 'ice_knight', at: -6098, off: 35, room: 3 },
            { type: 'ice_knight', at: -6653, off: -20, room: 3 },
            { type: 'blizzard_shaman', at: -7115, off: 20, room: 3 },
            { type: 'blizzard_shaman', at: -6098, off: 0, room: 3 },
            { type: 'icicle_archer', at: -6653, off: -55, room: 3 },
            { type: 'icicle_archer', at: -7115, off: 55, room: 3 }
        ],
        star: { at: -7735 }
    }),
    48: makePathFloor({
        path: [[0, 0], [0, -1360], [1360, -1360], [1360, -2720], [0, -2720], [0, -4080], [1360, -4080]],
        laneHalfWidth: 120,
        gates: [
            { entrance: -952, exit: -2312, room: 0 },
            { entrance: -2312, exit: -3944, room: 1 },
            { entrance: -3944, exit: -5712, room: 2 },
            { entrance: -5712, exit: -7616, room: 3 }
        ],
        monsters: [
            { type: 'ice_knight', at: -1360, off: -65, room: 0 },
            { type: 'ice_knight', at: -1768, off: 65, room: 0 },
            { type: 'icicle_archer', at: -2108, off: -35, room: 0 },
            { type: 'icicle_archer', at: -1360, off: 35, room: 0 },
            { type: 'snow_wolf', at: -1768, off: -20, room: 0 },
            { type: 'frost_golem', at: -2802, off: -65, room: 1 },
            { type: 'frost_golem', at: -3291, off: 65, room: 1 },
            { type: 'frost_golem', at: -3699, off: -35, room: 1 },
            { type: 'frost_cannon', at: -2802, off: 35, room: 1 },
            { type: 'frost_cannon', at: -3291, off: -20, room: 1 },
            { type: 'snowflake_healer', at: -3699, off: 20, room: 1 },
            { type: 'snowflake_healer', at: -2802, off: 0, room: 1 },
            { type: 'blizzard_shaman', at: -4474, off: -65, room: 2 },
            { type: 'blizzard_shaman', at: -5005, off: 65, room: 2 },
            { type: 'snowman_bomber', at: -5447, off: -35, room: 2 },
            { type: 'snowman_bomber', at: -4474, off: 35, room: 2 },
            { type: 'ice_knight', at: -5005, off: -20, room: 2 },
            { type: 'ice_knight', at: -5447, off: 20, room: 2 },
            { type: 'icicle_archer', at: -4474, off: 0, room: 2 },
            { type: 'icicle_archer', at: -5005, off: -55, room: 2 },
            { type: 'snow_wolf', at: -5447, off: 55, room: 2 },
            { type: 'snow_wolf', at: -4474, off: -70, room: 2 },
            { type: 'frost_queen', at: -6283, off: -65, room: 3 },
            { type: 'frost_queen', at: -6854, off: 65, room: 3 },
            { type: 'blizzard_shaman', at: -7330, off: -35, room: 3 },
            { type: 'blizzard_shaman', at: -6283, off: 35, room: 3 },
            { type: 'frost_golem', at: -6854, off: -20, room: 3 },
            { type: 'frost_golem', at: -7330, off: 20, room: 3 },
            { type: 'snowman_bomber', at: -6283, off: 0, room: 3 },
            { type: 'snowman_bomber', at: -6854, off: -55, room: 3 }
        ],
        star: { at: -7970 }
    }),
    // 49층: 얼음/서리 챕터의 마지막. 서리 여왕 셋을 포함해 10종이 전부 나온다.
    49: makePathFloor({
        path: [[0, 0], [0, -1420], [-1420, -1420], [-1420, -2840], [0, -2840], [0, -4260], [-1420, -4260]],
        laneHalfWidth: 120,
        gates: [
            { entrance: -994, exit: -2414, room: 0 },
            { entrance: -2414, exit: -4118, room: 1 },
            { entrance: -4118, exit: -5964, room: 2 },
            { entrance: -5964, exit: -7952, room: 3 }
        ],
        monsters: [
            { type: 'ice_knight', at: -1420, off: -65, room: 0 },
            { type: 'ice_knight', at: -1846, off: 65, room: 0 },
            { type: 'snow_wolf', at: -2201, off: -35, room: 0 },
            { type: 'snow_wolf', at: -1420, off: 35, room: 0 },
            { type: 'icicle_archer', at: -1846, off: -20, room: 0 },
            { type: 'icicle_archer', at: -2201, off: 20, room: 0 },
            { type: 'frost_golem', at: -2925, off: -65, room: 1 },
            { type: 'frost_golem', at: -3436, off: 65, room: 1 },
            { type: 'frost_cannon', at: -3862, off: -35, room: 1 },
            { type: 'frost_cannon', at: -2925, off: 35, room: 1 },
            { type: 'snowflake_healer', at: -3436, off: -20, room: 1 },
            { type: 'snowflake_healer', at: -3862, off: 20, room: 1 },
            { type: 'snow_wolf', at: -2925, off: 0, room: 1 },
            { type: 'snow_wolf', at: -3436, off: -55, room: 1 },
            { type: 'blizzard_shaman', at: -4672, off: -65, room: 2 },
            { type: 'blizzard_shaman', at: -5226, off: 65, room: 2 },
            { type: 'snowman_bomber', at: -5687, off: -35, room: 2 },
            { type: 'snowman_bomber', at: -4672, off: 35, room: 2 },
            { type: 'ice_knight', at: -5226, off: -20, room: 2 },
            { type: 'ice_knight', at: -5687, off: 20, room: 2 },
            { type: 'icicle_archer', at: -4672, off: 0, room: 2 },
            { type: 'icicle_archer', at: -5226, off: -55, room: 2 },
            { type: 'frost_golem', at: -5687, off: 55, room: 2 },
            { type: 'frost_golem', at: -4672, off: -70, room: 2 },
            { type: 'frost_queen', at: -6560, off: -65, room: 3 },
            { type: 'frost_queen', at: -7157, off: 65, room: 3 },
            { type: 'frost_queen', at: -7654, off: -35, room: 3 },
            { type: 'blizzard_shaman', at: -6560, off: 35, room: 3 },
            { type: 'ice_knight', at: -7157, off: -20, room: 3 },
            { type: 'ice_knight', at: -7654, off: 20, room: 3 },
            { type: 'frost_cannon', at: -6560, off: 0, room: 3 },
            { type: 'frost_cannon', at: -7157, off: -55, room: 3 },
            { type: 'snowman_bomber', at: -7654, off: 55, room: 3 },
            { type: 'snowman_bomber', at: -6560, off: -70, room: 3 }
        ],
        star: { at: -8321 }
    }),
    // 50층: 얼음/서리 챕터를 마무리하는 보스전. 10층/20층과 같은 틀(짧고
    // 넓은 다리 위에 보스 하나, 잡몹 없음) -- winOnClear/bossFloor라
    // 레전더리 드랍도 자동으로 붙는다.
    50: {
        levelType: 'bridge',
        levelLength: 1100,
        laneHalfWidth: 300,
        gates: [],
        monsters: [
            { type: 'frost_empress_boss', x: -800, y: 0, room: 0 }
        ],
        winOnClear: true,
        bossFloor: true
    },
    // ==================== 51~59층: 용암 챕터 ====================
    // 얼음/서리 챕터처럼 이 챕터도 이전 챕터 몹과 안 섞고 자기 몹만 쓴다.
    // 보스전은 없다(60층 몫). 다리 색을 붉게 칠해서(deckColor/deckGlow) 눈으로
    // 봐도 챕터가 바뀐 걸 알 수 있게 했다 -- 안 적은 층은 지금까지처럼 갈색
    // 그대로다.
    // 51층: 챕터 시작. 용암 임프만 나온다.
    51: makePathFloor({
        path: [[0, 0], [0, -1000], [1000, -1000], [1000, -2000], [0, -2000], [0, -3000], [1000, -3000]],
        laneHalfWidth: 120,
        deckColor: '#2b0f06',
        deckGlow: 'rgba(255, 110, 40, 0.35)',
        gates: [
            { entrance: -700, exit: -1700, room: 0 },
            { entrance: -1700, exit: -2900, room: 1 },
            { entrance: -2900, exit: -4200, room: 2 },
            { entrance: -4200, exit: -5600, room: 3 }
        ],
        monsters: [
            { type: 'lava_imp', at: -950, off: -50, room: 0 },
            { type: 'lava_imp', at: -1250, off: 50, room: 0 },
            { type: 'lava_imp', at: -1550, off: -30, room: 0 },
            { type: 'lava_imp', at: -1950, off: -55, room: 1 },
            { type: 'lava_imp', at: -1950, off: 55, room: 1 },
            { type: 'lava_imp', at: -2350, off: -30, room: 1 },
            { type: 'lava_imp', at: -2700, off: 30, room: 1 },
            { type: 'lava_imp', at: -3200, off: -55, room: 2 },
            { type: 'lava_imp', at: -3200, off: 55, room: 2 },
            { type: 'lava_imp', at: -3600, off: -30, room: 2 },
            { type: 'lava_imp', at: -3900, off: 30, room: 2 },
            { type: 'lava_imp', at: -4050, off: 0, room: 2 },
            { type: 'lava_imp', at: -4500, off: -60, room: 3 },
            { type: 'lava_imp', at: -4500, off: 0, room: 3 },
            { type: 'lava_imp', at: -4500, off: 60, room: 3 },
            { type: 'lava_imp', at: -5000, off: -40, room: 3 },
            { type: 'lava_imp', at: -5000, off: 40, room: 3 },
            { type: 'lava_imp', at: -5400, off: 0, room: 3 }
        ],
        star: { at: -5900 }
    }),
    // 52층: 마그마 하운드 등장. 눈보라 늑대보다 더 빨리 파고든다.
    52: makePathFloor({
        path: [[0, 0], [0, -1040], [-1040, -1040], [-1040, -2080], [0, -2080], [0, -3120], [-1040, -3120]],
        laneHalfWidth: 123,
        deckColor: '#2b0f06',
        deckGlow: 'rgba(255, 110, 40, 0.35)',
        gates: [
            { entrance: -728, exit: -1768, room: 0 },
            { entrance: -1768, exit: -3016, room: 1 },
            { entrance: -3016, exit: -4368, room: 2 },
            { entrance: -4368, exit: -5824, room: 3 }
        ],
        monsters: [
            { type: 'lava_imp', at: -1050, off: -45, room: 0 },
            { type: 'magma_hound', at: -1350, off: 45, room: 0 },
            { type: 'magma_hound', at: -1600, off: 0, room: 0 },
            { type: 'lava_imp', at: -2100, off: -50, room: 1 },
            { type: 'lava_imp', at: -2100, off: 50, room: 1 },
            { type: 'magma_hound', at: -2450, off: -30, room: 1 },
            { type: 'magma_hound', at: -2450, off: 30, room: 1 },
            { type: 'magma_hound', at: -2800, off: 0, room: 1 },
            { type: 'lava_imp', at: -3350, off: -55, room: 2 },
            { type: 'lava_imp', at: -3350, off: 55, room: 2 },
            { type: 'magma_hound', at: -3700, off: -35, room: 2 },
            { type: 'magma_hound', at: -3700, off: 0, room: 2 },
            { type: 'magma_hound', at: -3700, off: 35, room: 2 },
            { type: 'magma_hound', at: -4100, off: 0, room: 2 },
            { type: 'lava_imp', at: -4650, off: -60, room: 3 },
            { type: 'lava_imp', at: -4650, off: 60, room: 3 },
            { type: 'magma_hound', at: -5000, off: -40, room: 3 },
            { type: 'magma_hound', at: -5000, off: 0, room: 3 },
            { type: 'magma_hound', at: -5000, off: 40, room: 3 },
            { type: 'magma_hound', at: -5400, off: -20, room: 3 },
            { type: 'magma_hound', at: -5400, off: 20, room: 3 },
            { type: 'lava_imp', at: -5700, off: 0, room: 3 }
        ],
        star: { at: -6136 }
    }),
    // 53층: 흑요석 골렘 등장. 서리 골렘처럼 쓰러지면 조각으로 갈라진다.
    53: makePathFloor({
        path: [[0, 0], [0, -1080], [1080, -1080], [1080, -2160], [0, -2160], [0, -3240], [1080, -3240]],
        laneHalfWidth: 126,
        deckColor: '#2b0f06',
        deckGlow: 'rgba(255, 110, 40, 0.35)',
        gates: [
            { entrance: -756, exit: -1836, room: 0 },
            { entrance: -1836, exit: -3132, room: 1 },
            { entrance: -3132, exit: -4536, room: 2 },
            { entrance: -4536, exit: -6048, room: 3 }
        ],
        monsters: [
            { type: 'magma_hound', at: -1100, off: -45, room: 0 },
            { type: 'obsidian_golem', at: -1500, off: 0, room: 0 },
            { type: 'lava_imp', at: -2200, off: -55, room: 1 },
            { type: 'magma_hound', at: -2200, off: 55, room: 1 },
            { type: 'obsidian_golem', at: -2600, off: -30, room: 1 },
            { type: 'obsidian_golem', at: -2900, off: 30, room: 1 },
            { type: 'lava_imp', at: -3500, off: -55, room: 2 },
            { type: 'lava_imp', at: -3500, off: 55, room: 2 },
            { type: 'magma_hound', at: -3900, off: -35, room: 2 },
            { type: 'magma_hound', at: -3900, off: 35, room: 2 },
            { type: 'obsidian_golem', at: -4300, off: 0, room: 2 },
            { type: 'obsidian_golem', at: -4900, off: -50, room: 3 },
            { type: 'obsidian_golem', at: -4900, off: 50, room: 3 },
            { type: 'magma_hound', at: -5300, off: -35, room: 3 },
            { type: 'magma_hound', at: -5300, off: 35, room: 3 },
            { type: 'lava_imp', at: -5700, off: -20, room: 3 },
            { type: 'lava_imp', at: -5700, off: 20, room: 3 },
            { type: 'obsidian_golem', at: -6000, off: 0, room: 3 }
        ],
        star: { at: -6372 }
    }),
    // 54층: 불씨 사제 등장. 눈꽃 치유사보다 오라가 더 넓고 세다.
    54: makePathFloor({
        path: [[0, 0], [0, -1120], [-1120, -1120], [-1120, -2240], [0, -2240], [0, -3360], [-1120, -3360]],
        laneHalfWidth: 129,
        deckColor: '#2b0f06',
        deckGlow: 'rgba(255, 110, 40, 0.35)',
        gates: [
            { entrance: -784, exit: -1904, room: 0 },
            { entrance: -1904, exit: -3248, room: 1 },
            { entrance: -3248, exit: -4704, room: 2 },
            { entrance: -4704, exit: -6272, room: 3 }
        ],
        monsters: [
            { type: 'obsidian_golem', at: -1200, off: -40, room: 0 },
            { type: 'ember_priest', at: -1600, off: 40, room: 0 },
            { type: 'obsidian_golem', at: -2300, off: -45, room: 1 },
            { type: 'obsidian_golem', at: -2300, off: 45, room: 1 },
            { type: 'ember_priest', at: -2700, off: 0, room: 1 },
            { type: 'magma_hound', at: -3000, off: -30, room: 1 },
            { type: 'magma_hound', at: -3000, off: 30, room: 1 },
            { type: 'obsidian_golem', at: -3700, off: -50, room: 2 },
            { type: 'obsidian_golem', at: -3700, off: 50, room: 2 },
            { type: 'ember_priest', at: -4100, off: -30, room: 2 },
            { type: 'ember_priest', at: -4100, off: 30, room: 2 },
            { type: 'magma_hound', at: -4450, off: 0, room: 2 },
            { type: 'lava_imp', at: -4450, off: -55, room: 2 },
            { type: 'obsidian_golem', at: -5100, off: -55, room: 3 },
            { type: 'obsidian_golem', at: -5100, off: 55, room: 3 },
            { type: 'ember_priest', at: -5500, off: -35, room: 3 },
            { type: 'ember_priest', at: -5500, off: 35, room: 3 },
            { type: 'magma_hound', at: -5900, off: -20, room: 3 },
            { type: 'magma_hound', at: -5900, off: 20, room: 3 },
            { type: 'lava_imp', at: -6150, off: 0, room: 3 }
        ],
        star: { at: -6608 }
    }),
    // 55층: 용암 기사 등장. 얼음 기사처럼 한 번은 반드시 버틴다.
    55: makePathFloor({
        path: [[0, 0], [0, -1160], [1160, -1160], [1160, -2320], [0, -2320], [0, -3480], [1160, -3480]],
        laneHalfWidth: 132,
        deckColor: '#2b0f06',
        deckGlow: 'rgba(255, 110, 40, 0.35)',
        gates: [
            { entrance: -812, exit: -1972, room: 0 },
            { entrance: -1972, exit: -3364, room: 1 },
            { entrance: -3364, exit: -4872, room: 2 },
            { entrance: -4872, exit: -6496, room: 3 }
        ],
        monsters: [
            { type: 'ember_priest', at: -1300, off: -40, room: 0 },
            { type: 'molten_knight', at: -1700, off: 40, room: 0 },
            { type: 'molten_knight', at: -2400, off: -45, room: 1 },
            { type: 'molten_knight', at: -2400, off: 45, room: 1 },
            { type: 'ember_priest', at: -2800, off: 0, room: 1 },
            { type: 'obsidian_golem', at: -3100, off: -30, room: 1 },
            { type: 'molten_knight', at: -3800, off: -50, room: 2 },
            { type: 'molten_knight', at: -3800, off: 50, room: 2 },
            { type: 'obsidian_golem', at: -4200, off: -35, room: 2 },
            { type: 'obsidian_golem', at: -4200, off: 35, room: 2 },
            { type: 'ember_priest', at: -4600, off: 0, room: 2 },
            { type: 'lava_imp', at: -4600, off: -55, room: 2 },
            { type: 'molten_knight', at: -5300, off: -55, room: 3 },
            { type: 'molten_knight', at: -5300, off: 55, room: 3 },
            { type: 'obsidian_golem', at: -5700, off: -35, room: 3 },
            { type: 'obsidian_golem', at: -5700, off: 35, room: 3 },
            { type: 'ember_priest', at: -6100, off: -20, room: 3 },
            { type: 'ember_priest', at: -6100, off: 20, room: 3 },
            { type: 'magma_hound', at: -6300, off: 0, room: 3 }
        ],
        star: { at: -6844 }
    }),
    // 56층: 화산 대포 등장. 지금까지 나온 포탑 중 빔이 가장 세고 잘 따라온다.
    56: makePathFloor({
        path: [[0, 0], [0, -1200], [-1200, -1200], [-1200, -2400], [0, -2400], [0, -3600], [-1200, -3600]],
        laneHalfWidth: 135,
        deckColor: '#2b0f06',
        deckGlow: 'rgba(255, 110, 40, 0.35)',
        gates: [
            { entrance: -840, exit: -2040, room: 0 },
            { entrance: -2040, exit: -3480, room: 1 },
            { entrance: -3480, exit: -5040, room: 2 },
            { entrance: -5040, exit: -6720, room: 3 }
        ],
        monsters: [
            { type: 'volcano_cannon', at: -1400, off: 0, room: 0 },
            { type: 'molten_knight', at: -1800, off: 0, room: 0 },
            { type: 'volcano_cannon', at: -2500, off: -50, room: 1 },
            { type: 'volcano_cannon', at: -2500, off: 50, room: 1 },
            { type: 'molten_knight', at: -2900, off: 0, room: 1 },
            { type: 'ember_priest', at: -3200, off: -30, room: 1 },
            { type: 'volcano_cannon', at: -3900, off: -55, room: 2 },
            { type: 'volcano_cannon', at: -3900, off: 55, room: 2 },
            { type: 'molten_knight', at: -4300, off: -35, room: 2 },
            { type: 'molten_knight', at: -4300, off: 35, room: 2 },
            { type: 'obsidian_golem', at: -4700, off: 0, room: 2 },
            { type: 'ember_priest', at: -4700, off: -60, room: 2 },
            { type: 'volcano_cannon', at: -5400, off: -55, room: 3 },
            { type: 'volcano_cannon', at: -5400, off: 55, room: 3 },
            { type: 'molten_knight', at: -5800, off: -40, room: 3 },
            { type: 'molten_knight', at: -5800, off: 40, room: 3 },
            { type: 'obsidian_golem', at: -6200, off: -20, room: 3 },
            { type: 'obsidian_golem', at: -6200, off: 20, room: 3 },
            { type: 'ember_priest', at: -6500, off: 0, room: 3 },
            { type: 'lava_imp', at: -6500, off: -65, room: 3 }
        ],
        star: { at: -7080 }
    }),
    // 57층: 화산 군주 등장. 서리 여왕처럼 57~59층 내내 섞여 나오는 이 챕터의
    // 정예다.
    57: makePathFloor({
        path: [[0, 0], [0, -1240], [1240, -1240], [1240, -2480], [0, -2480], [0, -3720], [1240, -3720]],
        laneHalfWidth: 138,
        deckColor: '#2b0f06',
        deckGlow: 'rgba(255, 110, 40, 0.35)',
        gates: [
            { entrance: -868, exit: -2108, room: 0 },
            { entrance: -2108, exit: -3596, room: 1 },
            { entrance: -3596, exit: -5208, room: 2 },
            { entrance: -5208, exit: -6944, room: 3 }
        ],
        monsters: [
            { type: 'volcano_lord', at: -1500, off: 0, room: 0 },
            { type: 'lava_imp', at: -1900, off: -40, room: 0 },
            { type: 'volcano_cannon', at: -2600, off: -50, room: 1 },
            { type: 'volcano_cannon', at: -2600, off: 50, room: 1 },
            { type: 'molten_knight', at: -3000, off: 0, room: 1 },
            { type: 'magma_hound', at: -3300, off: -35, room: 1 },
            { type: 'magma_hound', at: -3300, off: 35, room: 1 },
            { type: 'obsidian_golem', at: -4000, off: -50, room: 2 },
            { type: 'obsidian_golem', at: -4000, off: 50, room: 2 },
            { type: 'ember_priest', at: -4400, off: -30, room: 2 },
            { type: 'ember_priest', at: -4400, off: 30, room: 2 },
            { type: 'volcano_cannon', at: -4800, off: 0, room: 2 },
            { type: 'molten_knight', at: -4800, off: -60, room: 2 },
            { type: 'molten_knight', at: -4800, off: 60, room: 2 },
            { type: 'volcano_lord', at: -5700, off: 0, room: 3 },
            { type: 'obsidian_golem', at: -6100, off: -45, room: 3 },
            { type: 'obsidian_golem', at: -6100, off: 45, room: 3 },
            { type: 'magma_hound', at: -6500, off: -30, room: 3 },
            { type: 'magma_hound', at: -6500, off: 30, room: 3 },
            { type: 'lava_imp', at: -6800, off: -15, room: 3 },
            { type: 'lava_imp', at: -6800, off: 15, room: 3 }
        ],
        star: { at: -7316 }
    }),
    // 58층: 화산 군주가 두 번 나오는 종합전.
    58: makePathFloor({
        path: [[0, 0], [0, -1280], [-1280, -1280], [-1280, -2560], [0, -2560], [0, -3840], [-1280, -3840]],
        laneHalfWidth: 141,
        deckColor: '#2b0f06',
        deckGlow: 'rgba(255, 110, 40, 0.35)',
        gates: [
            { entrance: -896, exit: -2176, room: 0 },
            { entrance: -2176, exit: -3712, room: 1 },
            { entrance: -3712, exit: -5376, room: 2 },
            { entrance: -5376, exit: -7168, room: 3 }
        ],
        monsters: [
            { type: 'volcano_lord', at: -1600, off: 0, room: 0 },
            { type: 'molten_knight', at: -2000, off: -40, room: 0 },
            { type: 'magma_hound', at: -2000, off: 40, room: 0 },
            { type: 'volcano_cannon', at: -2700, off: -50, room: 1 },
            { type: 'volcano_cannon', at: -2700, off: 50, room: 1 },
            { type: 'obsidian_golem', at: -3100, off: -35, room: 1 },
            { type: 'obsidian_golem', at: -3100, off: 35, room: 1 },
            { type: 'ember_priest', at: -3500, off: 0, room: 1 },
            { type: 'lava_imp', at: -3500, off: -60, room: 1 },
            { type: 'volcano_lord', at: -4200, off: 0, room: 2 },
            { type: 'molten_knight', at: -4600, off: -50, room: 2 },
            { type: 'molten_knight', at: -4600, off: 50, room: 2 },
            { type: 'obsidian_golem', at: -5000, off: -30, room: 2 },
            { type: 'obsidian_golem', at: -5000, off: 30, room: 2 },
            { type: 'magma_hound', at: -5300, off: -15, room: 2 },
            { type: 'magma_hound', at: -5300, off: 15, room: 2 },
            { type: 'volcano_lord', at: -5900, off: 0, room: 3 },
            { type: 'volcano_cannon', at: -6300, off: -55, room: 3 },
            { type: 'volcano_cannon', at: -6300, off: 55, room: 3 },
            { type: 'molten_knight', at: -6700, off: -40, room: 3 },
            { type: 'molten_knight', at: -6700, off: 40, room: 3 },
            { type: 'ember_priest', at: -7000, off: -20, room: 3 },
            { type: 'ember_priest', at: -7000, off: 20, room: 3 },
            { type: 'obsidian_golem', at: -7100, off: 0, room: 3 }
        ],
        star: { at: -7552 }
    }),
    // 59층: 60층 보스 직전 마지막 층. 화산 군주 셋이 마지막 방을 지킨다 --
    // 49층의 마지막 방(서리 여왕 셋)이 그랬듯, 사실상 작은 보스전이다.
    59: makePathFloor({
        path: [[0, 0], [0, -1320], [1320, -1320], [1320, -2640], [0, -2640], [0, -3960], [1320, -3960]],
        laneHalfWidth: 144,
        deckColor: '#2b0f06',
        deckGlow: 'rgba(255, 110, 40, 0.35)',
        gates: [
            { entrance: -924, exit: -2244, room: 0 },
            { entrance: -2244, exit: -3828, room: 1 },
            { entrance: -3828, exit: -5544, room: 2 },
            { entrance: -5544, exit: -7392, room: 3 }
        ],
        monsters: [
            { type: 'volcano_lord', at: -1600, off: 0, room: 0 },
            { type: 'volcano_cannon', at: -2000, off: -45, room: 0 },
            { type: 'volcano_cannon', at: -2000, off: 45, room: 0 },
            { type: 'volcano_lord', at: -2900, off: 0, room: 1 },
            { type: 'molten_knight', at: -3300, off: -45, room: 1 },
            { type: 'molten_knight', at: -3300, off: 45, room: 1 },
            { type: 'ember_priest', at: -3600, off: 0, room: 1 },
            { type: 'magma_hound', at: -3600, off: -60, room: 1 },
            { type: 'magma_hound', at: -3600, off: 60, room: 1 },
            { type: 'volcano_lord', at: -4400, off: 0, room: 2 },
            { type: 'obsidian_golem', at: -4800, off: -50, room: 2 },
            { type: 'obsidian_golem', at: -4800, off: 50, room: 2 },
            { type: 'molten_knight', at: -5200, off: -30, room: 2 },
            { type: 'molten_knight', at: -5200, off: 30, room: 2 },
            { type: 'volcano_cannon', at: -5400, off: -65, room: 2 },
            { type: 'volcano_cannon', at: -5400, off: 65, room: 2 },
            { type: 'volcano_lord', at: -6200, off: -50, room: 3 },
            { type: 'volcano_lord', at: -6200, off: 50, room: 3 },
            { type: 'obsidian_golem', at: -6600, off: -55, room: 3 },
            { type: 'obsidian_golem', at: -6600, off: 55, room: 3 },
            { type: 'molten_knight', at: -6900, off: -35, room: 3 },
            { type: 'molten_knight', at: -6900, off: 35, room: 3 },
            { type: 'ember_priest', at: -7100, off: -20, room: 3 },
            { type: 'ember_priest', at: -7100, off: 20, room: 3 },
            { type: 'magma_hound', at: -7250, off: -60, room: 3 },
            { type: 'magma_hound', at: -7250, off: 60, room: 3 },
            { type: 'lava_imp', at: -7300, off: 0, room: 3 }
        ],
        star: { at: -7788 }
    })
};

// ==================== 레전드 스토리 ====================
// 탑을 "위로" 올라가는 스토리 모드와 짝을 이루는, 지하로 "내려가는" 별도
// 모드. 보통 스토리 층은 길 전체가 laneHalfWidth 하나로 고정인데, 여기는
// 넓은 네모난 방에서 싸우고 좁은 다리로 방과 방 사이를 건너간다 -- path의
// 각 점에 세 번째 값(half-width)을 얹어 구간마다 폭을 다르게 준다
// (pathSegs 주석 참고). 화면은 배경/벽만 검정으로(deckColor/deckGlow --
// 용암 챕터와 같은 메커니즘) -- 캐릭터·몬스터 색은 다른 층과 같다.
//
// 파티 규칙이 STORY_FLOOR_DEFS의 11층+와 다르다: 혼자면 3명을 데려가
// 바꿔가며 싸우고(각성모드와 같은 파티 구조), 2인 멀티면 한 사람당 1명씩만
// 데려간다(교체 없이, 1~10층처럼 캐릭터 하나). storyPartySizeFor(floor, solo)의
// solo 인자가 이 둘을 가른다 -- 층 번호만 보던 기존 규칙과 이 부분만 다르다.
const LEGEND_STORY_FLOOR_DEFS = {
    // 지하 1층: 입구 스위치를 밟아야 문이 열린다 -> 방1(잡몹 4) -> 좁은 다리
    // -> 방2(잡몹 6, 방1보다 세다) -> 갈림길. 한쪽은 별로 바로 이어지는
    // 정규 루트, 다른 한쪽은 보물상자 하나만 있는 막다른 샛길이다.
    legend1: makePathFloor({
        // 배경/벽만 검정 -- 캐릭터·몬스터 색은 다른 층과 같다(deckColor/deckGlow
        // 하나로 용암 챕터와 같은 메커니즘을 재사용한다).
        deckColor: '#0a0a0a',
        deckGlow: 'rgba(255, 255, 255, 0.10)',
        path: [
            [0, 0],
            [-300, 0, 240],    // 여기부터 방1 (넓게)
            [-300, -500, 70],  // 여기부터 다리 (좁게)
            [-300, -900, 240], // 여기부터 방2 (넓게)
            [-700, -900]       // 갈림길 시작점
        ],
        forks: [
            [[-700, -900], [-700, -1250]], // 정규 루트: 별로 바로 이어진다
            [[-700, -900], [-1000, -900]]  // 샛길: 막다른 곳에 보물상자
        ],
        gates: [
            // 몬스터가 아니라 스위치로 여는 문 -- switches의 'entry'를 밟기
            // 전엔 방1로 들어갈 수 없다.
            { manual: true, entrance: -100, exit: -100, room: 'entry' },
            { entrance: -300, exit: -800, room: 0 },
            { entrance: -1200, exit: -1600, room: 1 }
        ],
        switches: [
            { id: 'entry', at: -80, off: 0 }
        ],
        monsters: [
            // 방1: 케이크 조각 넷.
            { type: 'cake_slice', at: -450, off: -150, room: 0 },
            { type: 'cake_slice', at: -450, off: 150, room: 0 },
            { type: 'cake_slice', at: -650, off: -150, room: 0 },
            { type: 'cake_slice', at: -650, off: 150, room: 0 },
            // 방2: 케이크 조각 셋 + 초콜릿 궁수 셋. 방1보다 조금 세다.
            { type: 'cake_slice', at: -1300, off: -160, room: 1 },
            { type: 'cake_slice', at: -1300, off: 0, room: 1 },
            { type: 'cake_slice', at: -1300, off: 160, room: 1 },
            { type: 'chocolate_cake_slice', at: -1480, off: -100, room: 1 },
            { type: 'chocolate_cake_slice', at: -1480, off: 100, room: 1 },
            { type: 'chocolate_cake_slice', at: -1550, off: 0, room: 1 }
        ],
        // 갈림길 너머라 along만으로는 어느 갈래인지 못 짚는다 -- x,y로 직접
        // 적는다(resolvePathPoint 주석 참고).
        chests: [
            { id: 'legend1_chest1', x: -1000, y: -900 }
        ],
        star: { x: -700, y: -1250 }
    }),
    // 지하 2층: 첫 지하 보스전. 지하 1층은 잡몹만 있는 맛보기였고, 이제부터
    // 지하는 원칙적으로 층마다 보스 하나씩이다. 10층/20층 보스전과 같은
    // 모양(짧고 넓은 외길, 잡몹 없음, winOnClear) -- 넓어야 보스 패턴이
    // 움직일 공간이 나온다. 보스는 MONSTERS.reddragon_rampage(위 주석 참고).
    // 아레나 안에 놓을 구조물은 아직 미정이다.
    //
    // 층 이벤트(charEventMultiplier, joinStoryFloor에서 적용, server.js
    // applyFloorCharEvent): "아무도 안 써준다"는 레드 드레곤의 분노가 층
    // 전체를 짓눌러서, 레드 드레곤맛 쿠키 말고는 다들 약해진다 -- 공격력
    // 60%·체력 70%. 레드 드레곤맛 쿠키만 데려오면 오히려 공격력 200%·체력
    // 250%로 확 강해진다. overrides에 없는 캐릭터는 전부 default를 쓴다.
    legend2: {
        levelType: 'bridge',
        levelLength: 1000,
        laneHalfWidth: 260,
        deckColor: '#0a0a0a',
        deckGlow: 'rgba(231, 76, 60, 0.12)', // 암전 + 분노의 붉은 기
        gates: [],
        monsters: [
            { type: 'reddragon_rampage', x: -750, y: 0, room: 0 }
        ],
        charEventMultiplier: {
            default: { health: 0.7, attackDamage: 0.6 },
            overrides: {
                reddragon: { health: 2.5, attackDamage: 2.0 }
            }
        },
        winOnClear: true,
        bossFloor: true
    }
};
const LEGEND_PARTY_SIZE = 3;
// 혼자 갈 때(3명) 자리마다 데려갈 수 있는 최대 등급. 1번째는 게스트까지
// (사실상 제한 없음), 2번째는 레전더리까지, 3번째는 에픽까지 -- 파티
// 하나가 전부 최상급으로만 채워지지 않게 하려는 밸런스 규칙. 등급 순서는
// GRADE_ORDER 기준(일반<희귀<에픽<레전더리<에이션트<비스트<게스트). 멀티
// (1명 자리)에는 적용하지 않는다.
const LEGEND_PARTY_SLOT_MAX_GRADE = ['게스트', '레전더리', '에픽'];
function legendPartySlotAllowsGrade(slot, grade) {
    const cap = LEGEND_PARTY_SLOT_MAX_GRADE[slot];
    if (!cap) return true;
    return GRADE_ORDER.indexOf(grade) <= GRADE_ORDER.indexOf(cap);
}
// 지금까지 만든 지하층 수. 스토리 타워의 STORY_TOTAL_FLOORS와 같은 역할 --
// 새 층(legend2, legend3, ...)을 추가할 때마다 이 숫자부터 올릴 것. 탑은
// 위로 올라가지만 이쪽은 아래로 내려가므로, 층 목록은 위(1층)에서
// 아래(더 깊은 층)로 자연스러운 순서 그대로 보여주면 된다(뒤집지 않는다).
const LEGEND_TOTAL_FLOORS = 2;
function legendFloorKey(n) {
    return `legend${n}`;
}
function isLegendFloor(floor) {
    return Object.prototype.hasOwnProperty.call(LEGEND_STORY_FLOOR_DEFS, floor);
}
// 층 클리어(별) 보상. 아직 지하 1층 하나뿐이라 표 하나로 충분하고, 늘어나면
// CLEAR_REWARDS처럼 층별로 나누면 된다.
const LEGEND_CLEAR_REWARDS = {
    legend1: { coins: 500, diamonds: 15, material: 8 },
    // 첫 지하 보스전이라 1층보다 후하게 -- 진짜 패턴이 정해지면 다시 손볼 것.
    legend2: { coins: 900, diamonds: 25, material: 12 }
};
function legendClearReward(floor) {
    return LEGEND_CLEAR_REWARDS[floor] || null;
}
// 보물상자 보상. chests[].id로 찾는다 -- 한 판에 여러 상자가 생겨도 되게
// 층 구분 없이 하나의 표로 둔다.
const LEGEND_CHEST_REWARDS = {
    legend1_chest1: { coins: 300, diamonds: 8, material: 5 }
};
function legendChestReward(chestId) {
    return LEGEND_CHEST_REWARDS[chestId] || null;
}

// ==================== 캐릭터 레벨(성장던전) ====================
// 캐릭터별 영구 레벨업. 성장던전에서 번 EXP는 재화처럼 charExp[charType]에
// 그냥 쌓이기만 하고, 레벨은 저절로 오르지 않는다 -- 캐릭터 상세 화면의
// "레벨업" 버튼을 직접 눌러야 그 시점의 다음 레벨 비용(charLevelExpToNext)만큼
// charExp에서 깎고 charLevels[charType]을 1 올린다. 그래서 레벨은
// charLevels에 그대로 저장해 두고(파생값이 아니다), charExp는 "아직 안 쓴
// 잔액"이라는 뜻으로 남는다.
const CHAR_LEVEL_MAX = 100;
const CHAR_LEVEL_BASE_EXP = 100; // 1강(레벨1->2)에 필요한 EXP
const CHAR_LEVEL_EXP_GROWTH = 1.08; // 레벨이 오를수록 다음 레벨 요구 EXP가 이 배율로 커진다
const CHAR_LEVEL_STAT_PCT_PER_LEVEL = 0.02; // 레벨당 체력/공격력 +2% (레벨1 기준 누적)

// level -> level+1에 필요한 EXP. 이미 최대 레벨이면 null.
function charLevelExpToNext(level) {
    const lv = Math.max(1, Math.floor(level || 1));
    if (lv >= CHAR_LEVEL_MAX) return null;
    return Math.round(CHAR_LEVEL_BASE_EXP * Math.pow(CHAR_LEVEL_EXP_GROWTH, lv - 1));
}

// 예전 세이브 마이그레이션 전용: 그때는 누적 EXP에서 레벨을 자동 계산했다.
// 누적 EXP -> { level, expIntoLevel(레벨업 버튼을 안 눌러서 남는 EXP), expToNext }
function charLevelFromExp(totalExp) {
    let exp = Math.max(0, Math.floor(totalExp || 0));
    let level = 1;
    while (level < CHAR_LEVEL_MAX) {
        const need = charLevelExpToNext(level);
        if (need == null || exp < need) break;
        exp -= need;
        level++;
    }
    return { level, expIntoLevel: exp, expToNext: charLevelExpToNext(level) };
}

function charExpOf(charExpBag, charType) {
    const n = Number(charExpBag && charExpBag[charType]);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

// charLevels(레벨업 버튼으로 확정된 레벨 저장소)에서 직접 읽는다. 값이
// 없으면 기본 1레벨.
function charLevelOf(charLevels, charType) {
    const n = Number(charLevels && charLevels[charType]);
    return Number.isFinite(n) && n >= 1 ? Math.min(CHAR_LEVEL_MAX, Math.floor(n)) : 1;
}

function charLevelStatMultiplier(level) {
    const lv = Math.max(1, Math.min(CHAR_LEVEL_MAX, Math.floor(level || 1)));
    return 1 + CHAR_LEVEL_STAT_PCT_PER_LEVEL * (lv - 1);
}

// 레벨 보너스가 실제로 붙는 수치. 전투에 쓰이는 데미지/체력 수치만 대상으로
// 한다 -- 쿨타임이나 지속시간 같은 건 손대지 않는다.
const CHAR_LEVEL_SCALED_KEYS = ['health', 'attackDamage', 'skillDamage', 'ultimateDamage'];

// 레벨 보너스를 반영한 캐릭터 수치. 장비/본능해제와 같은 합성 자리에서 쓴다
// (characterWithGear -> characterWithInstinct -> characterWithLevel 순).
function characterWithLevel(character, level) {
    const lv = Math.max(1, Math.floor(level || 1));
    if (!character || lv <= 1) return character;
    const mult = charLevelStatMultiplier(lv);
    const out = Object.assign({}, character);
    CHAR_LEVEL_SCALED_KEYS.forEach(k => { if (out[k] != null) out[k] = Math.round(out[k] * mult); });
    return out;
}

// ==================== 성장던전 ====================
// 다이아 1회 결제(EXP_DUNGEON_UNLOCK_COST, main.js)로 영구 해금하는 솔로
// 전용 모드. 지금은 3칸 중 "EXP 던전" 하나만 실제로 만들고 나머지 둘은
// UI에 잠김/준비중으로만 걸어 둔다.
// EXP 던전은 스토리 10층(케이크 보스, 잡몹 없이 짧고 넓은 외길+winOnClear)과
// 완전히 같은 모양의 방을 10단계 반복한다. 1단계는 원본 케이크 보스 그대로,
// 2단계부터는 체력·공격력이 전 단계 대비 2배씩 누적으로 커져서 10단계는
// 원본의 512배 -- 사실상 클리어 불가능한 극한 단계다. 깬 단계는 몇 번이고
// 다시 들어가 반복 파밍할 수 있다(스토리처럼 첫 클리어에만 주는 보상이
// 아니라, 이길 때마다 그 단계의 EXP를 그대로 준다).
const EXP_DUNGEON_STAGE_COUNT = 10;
const EXP_DUNGEON_EXP_BASE = 100; // 1단계 클리어 보상. 단계마다 2배씩.

// 그 단계 클리어로 받는 캐릭터 EXP.
function expDungeonExpForStage(stage) {
    const st = Math.max(1, Math.min(EXP_DUNGEON_STAGE_COUNT, Math.floor(stage || 1)));
    return EXP_DUNGEON_EXP_BASE * Math.pow(2, st - 1);
}

// 그 단계의 케이크 보스 몬스터 id. 1단계는 원본 cake_boss를 그대로 쓰고,
// 2단계부터는 스탯을 2배씩 누적으로 키운 사본을 MONSTERS에 새로 등록해 둔다
// (아래 for문 참고) -- floorDefFor 등 몬스터 조회 경로를 하나도 안 건드리고
// id 하나로 스탯 스케일링이 끝난다.
function expDungeonMonsterType(stage) {
    const st = Math.max(1, Math.min(EXP_DUNGEON_STAGE_COUNT, Math.floor(stage || 1)));
    return st <= 1 ? 'cake_boss' : `cake_boss_ed${st}`;
}
for (let st = 2; st <= EXP_DUNGEON_STAGE_COUNT; st++) {
    const mult = Math.pow(2, st - 1);
    MONSTERS[`cake_boss_ed${st}`] = Object.assign({}, MONSTERS.cake_boss, {
        health: Math.round(MONSTERS.cake_boss.health * mult),
        attackDamage: Math.round(MONSTERS.cake_boss.attackDamage * mult)
    });
}

function expDungeonFloorKey(stage) {
    return `expdungeon${stage}`;
}
// 스토리 10층과 똑같은 모양(짧고 넓은 외길, 잡몹 없이 보스 하나, winOnClear).
const EXP_DUNGEON_FLOOR_DEFS = {};
for (let st = 1; st <= EXP_DUNGEON_STAGE_COUNT; st++) {
    EXP_DUNGEON_FLOOR_DEFS[expDungeonFloorKey(st)] = {
        levelType: 'bridge',
        levelLength: 1100,
        laneHalfWidth: 220,
        gates: [],
        monsters: [
            { type: expDungeonMonsterType(st), x: -800, y: 0, room: 0 }
        ],
        winOnClear: true,
        bossFloor: true,
        expDungeonStage: st
    };
}
function isExpDungeonFloor(floor) {
    return Object.prototype.hasOwnProperty.call(EXP_DUNGEON_FLOOR_DEFS, floor);
}
function expDungeonStageOfFloor(floor) {
    const def = EXP_DUNGEON_FLOOR_DEFS[floor];
    return def ? def.expDungeonStage : null;
}

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
    // 21층부터는 20층(가면광대) 보스전을 넘긴 뒤라 뽑기 티켓이 한 장 더 늘어
    // 3장씩 준다. 29층이 30층 보스 직전 마지막 층이라 다른 층보다 조금 더 굵다.
    story21: { material: 54, materialRare: 22, potion: 54, potionRare: 18, coins: 6200, diamonds: 48, ticketNormal: 3 },
    story22: { material: 57, materialRare: 24, potion: 57, potionRare: 19, coins: 6500, diamonds: 50, ticketNormal: 3 },
    story23: { material: 60, materialRare: 26, potion: 60, potionRare: 20, coins: 6800, diamonds: 52, ticketNormal: 3 },
    story24: { material: 63, materialRare: 28, potion: 63, potionRare: 21, coins: 7100, diamonds: 54, ticketNormal: 3 },
    story25: { material: 66, materialRare: 30, potion: 66, potionRare: 22, coins: 7400, diamonds: 56, ticketNormal: 3 },
    story26: { material: 69, materialRare: 32, potion: 69, potionRare: 23, coins: 7700, diamonds: 58, ticketNormal: 3 },
    story27: { material: 72, materialRare: 34, potion: 72, potionRare: 24, coins: 8000, diamonds: 60, ticketNormal: 3 },
    story28: { material: 75, materialRare: 36, potion: 75, potionRare: 25, coins: 8300, diamonds: 62, ticketNormal: 3 },
    story29: { material: 80, materialRare: 40, potion: 80, potionRare: 28, coins: 8800, diamonds: 66, ticketNormal: 3 },
    // 30~49층(얼음/서리 챕터)은 보스전이 없지만 뽑기 티켓은 계속 늘어난다:
    // 30층부터 4장, 40층부터 5장(유누 요청). 재료/코인은 층마다 조금씩 굵어진다.
    story30: { material: 83, materialRare: 42, potion: 83, potionRare: 29, coins: 9100, diamonds: 68, ticketNormal: 4 },
    story31: { material: 86, materialRare: 44, potion: 86, potionRare: 30, coins: 9400, diamonds: 70, ticketNormal: 4 },
    story32: { material: 89, materialRare: 46, potion: 89, potionRare: 31, coins: 9700, diamonds: 72, ticketNormal: 4 },
    story33: { material: 92, materialRare: 48, potion: 92, potionRare: 32, coins: 10000, diamonds: 74, ticketNormal: 4 },
    story34: { material: 95, materialRare: 50, potion: 95, potionRare: 33, coins: 10300, diamonds: 76, ticketNormal: 4 },
    story35: { material: 98, materialRare: 52, potion: 98, potionRare: 34, coins: 10600, diamonds: 78, ticketNormal: 4 },
    story36: { material: 101, materialRare: 54, potion: 101, potionRare: 35, coins: 10900, diamonds: 80, ticketNormal: 4 },
    story37: { material: 104, materialRare: 56, potion: 104, potionRare: 36, coins: 11200, diamonds: 82, ticketNormal: 4 },
    story38: { material: 107, materialRare: 58, potion: 107, potionRare: 37, coins: 11500, diamonds: 84, ticketNormal: 4 },
    // 39층은 이 챕터 전반부의 정예 관문(서리 여왕 등장)이라 29층처럼 조금 더 굵다.
    story39: { material: 112, materialRare: 62, potion: 112, potionRare: 40, coins: 12000, diamonds: 88, ticketNormal: 4 },
    story40: { material: 115, materialRare: 64, potion: 115, potionRare: 41, coins: 12300, diamonds: 90, ticketNormal: 5 },
    story41: { material: 118, materialRare: 66, potion: 118, potionRare: 42, coins: 12600, diamonds: 92, ticketNormal: 5 },
    story42: { material: 121, materialRare: 68, potion: 121, potionRare: 43, coins: 12900, diamonds: 94, ticketNormal: 5 },
    story43: { material: 124, materialRare: 70, potion: 124, potionRare: 44, coins: 13200, diamonds: 96, ticketNormal: 5 },
    story44: { material: 127, materialRare: 72, potion: 127, potionRare: 45, coins: 13500, diamonds: 98, ticketNormal: 5 },
    story45: { material: 130, materialRare: 74, potion: 130, potionRare: 46, coins: 13800, diamonds: 100, ticketNormal: 5 },
    story46: { material: 133, materialRare: 76, potion: 133, potionRare: 47, coins: 14100, diamonds: 102, ticketNormal: 5 },
    story47: { material: 136, materialRare: 78, potion: 136, potionRare: 48, coins: 14400, diamonds: 104, ticketNormal: 5 },
    story48: { material: 139, materialRare: 80, potion: 139, potionRare: 49, coins: 14700, diamonds: 106, ticketNormal: 5 },
    // 49층은 챕터 마지막(서리 여왕 셋)이라 다른 층보다 조금 더 굵다.
    story49: { material: 145, materialRare: 85, potion: 145, potionRare: 52, coins: 15300, diamonds: 110, ticketNormal: 5 },
    // 51~59층(용암 챕터)은 50층(서리 여제) 보스전을 넘긴 뒤라 뽑기 티켓이
    // 한 장 더 늘어 6장씩 준다. 59층은 60층 보스 직전 마지막 층이라 다른
    // 층보다 조금 더 굵다.
    story51: { material: 149, materialRare: 87, potion: 149, potionRare: 53, coins: 15600, diamonds: 112, ticketNormal: 6 },
    story52: { material: 152, materialRare: 89, potion: 152, potionRare: 54, coins: 15900, diamonds: 114, ticketNormal: 6 },
    story53: { material: 155, materialRare: 91, potion: 155, potionRare: 55, coins: 16200, diamonds: 116, ticketNormal: 6 },
    story54: { material: 158, materialRare: 93, potion: 158, potionRare: 56, coins: 16500, diamonds: 118, ticketNormal: 6 },
    story55: { material: 161, materialRare: 95, potion: 161, potionRare: 57, coins: 16800, diamonds: 120, ticketNormal: 6 },
    story56: { material: 164, materialRare: 97, potion: 164, potionRare: 58, coins: 17100, diamonds: 122, ticketNormal: 6 },
    story57: { material: 167, materialRare: 99, potion: 167, potionRare: 59, coins: 17400, diamonds: 124, ticketNormal: 6 },
    story58: { material: 170, materialRare: 101, potion: 170, potionRare: 60, coins: 17700, diamonds: 126, ticketNormal: 6 },
    story59: { material: 178, materialRare: 106, potion: 178, potionRare: 63, coins: 18300, diamonds: 130, ticketNormal: 6 },
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
    // 21~29층도 11~19층과 같은 방침: 지금 있는 장비들 중 좋은 쪽이 계속
    // 나온다. 새 장비는 유누가 만들어 주면 여기 이름만 바꿔 넣으면 된다.
    story21: ['cream_plate', 'frost_boots', 'ice_spear'],
    story22: ['cream_greaves', 'frost_boots', 'spirit_armor'],
    story23: ['cream_plate', 'storm_greaves', 'ice_spear'],
    story24: ['frost_boots', 'cream_greaves', 'gale_boots'],
    story25: ['cream_plate', 'spirit_armor', 'storm_greaves'],
    story26: ['cream_greaves', 'frost_boots', 'mint_blade'],
    story27: ['cream_plate', 'cream_greaves', 'gale_boots'],
    story28: ['frost_boots', 'spirit_armor', 'storm_greaves', 'ice_spear'],
    story29: ['cream_plate', 'cream_greaves', 'frost_boots', 'spirit_armor'],
    // 30~49층(얼음/서리 챕터)도 같은 방침: 지금 있는 장비들 중 좋은 쪽이
    // 계속 나온다. 새 장비는 유누가 만들어 주면 여기 이름만 바꿔 넣으면 된다.
    story30: ['cream_plate', 'frost_boots', 'ice_spear'],
    story31: ['cream_greaves', 'frost_boots', 'spirit_armor'],
    story32: ['cream_plate', 'storm_greaves', 'ice_spear'],
    story33: ['frost_boots', 'cream_greaves', 'gale_boots'],
    story34: ['cream_plate', 'spirit_armor', 'storm_greaves'],
    story35: ['cream_greaves', 'frost_boots', 'mint_blade'],
    story36: ['cream_plate', 'cream_greaves', 'gale_boots'],
    story37: ['frost_boots', 'spirit_armor', 'storm_greaves', 'ice_spear'],
    story38: ['cream_plate', 'cream_greaves', 'frost_boots', 'spirit_armor'],
    story39: ['cream_plate', 'frost_boots', 'storm_greaves', 'gale_boots'],
    story40: ['cream_plate', 'frost_boots', 'ice_spear'],
    story41: ['cream_greaves', 'frost_boots', 'spirit_armor'],
    story42: ['cream_plate', 'storm_greaves', 'ice_spear'],
    story43: ['frost_boots', 'cream_greaves', 'gale_boots'],
    story44: ['cream_plate', 'spirit_armor', 'storm_greaves'],
    story45: ['cream_greaves', 'frost_boots', 'mint_blade'],
    story46: ['cream_plate', 'cream_greaves', 'gale_boots'],
    story47: ['frost_boots', 'spirit_armor', 'storm_greaves', 'ice_spear'],
    story48: ['cream_plate', 'cream_greaves', 'frost_boots', 'spirit_armor'],
    story49: ['cream_plate', 'frost_boots', 'storm_greaves', 'gale_boots'],
    // 51~59층(용암 챕터)도 같은 방침: 지금 있는 장비들 중 좋은 쪽이 계속
    // 나온다. 새 장비는 유누가 만들어 주면 여기 이름만 바꿔 넣으면 된다.
    story51: ['cream_plate', 'frost_boots', 'ice_spear'],
    story52: ['cream_greaves', 'frost_boots', 'spirit_armor'],
    story53: ['cream_plate', 'storm_greaves', 'ice_spear'],
    story54: ['frost_boots', 'cream_greaves', 'gale_boots'],
    story55: ['cream_plate', 'spirit_armor', 'storm_greaves'],
    story56: ['cream_greaves', 'frost_boots', 'mint_blade'],
    story57: ['cream_plate', 'cream_greaves', 'gale_boots'],
    story58: ['frost_boots', 'spirit_armor', 'storm_greaves', 'ice_spear'],
    story59: ['cream_plate', 'cream_greaves', 'frost_boots', 'spirit_armor'],
    boss1: ['golem_blade', 'golem_plate', 'golem_greaves'],
    boss2: ['shihara_spear', 'shadow_helm', 'shadow_boots', 'red_lightning_cap']
    // story20(가면광대)은 CLEAR_DROPS에 따로 안 적는다 -- clearDropsFor()의
    // isTowerBossFloor 처리로 레전더리 전체(신규 "빛의" 세트 포함)가 자동으로
    // 드랍 후보에 낀다.
};
// ---- 타워 보스전 ----
// 레전더리 장비는 오직 여기서만 나온다. 스토리 층을 아무리 돌아도 안 나오고,
// 보스를 잡으면 레전더리 중 하나가 무작위로 떨어진다. 원래는 10층마다
// (10/20/...) 자동으로 보스층이었지만, 30~49층(얼음/서리 챕터)은 보스전 없이
// 웨이브만 있기로 했으므로 층수 나머지 계산이 아니라 그 층의 floorDef에
// bossFloor: true가 실제로 적혀 있는지로 판정한다 -- 그래야 30층/40층이
// UI에도(레전더리 확정 칩 등) 보통 층과 똑같이 뜬다.
const TOWER_BOSS_EVERY = 10;
function isTowerBossFloor(floor) {
    const def = floorDefFor(floor);
    return !!(def && def.bossFloor);
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
        bonusAttack: 2
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
        bonusHealth: 20
    },
    frost_boots: {
        name: '서리 부츠', slot: 'boots', grade: '에픽', icon: '🥾',
        bonusHealth: 18, bonusDamageTaken: 0.95
    },
    dark_blade: {
        name: '어둠의 대검', slot: 'weapon', grade: '레전더리', icon: '⚔',
        bonusAttack: 5,
        ownerChar: 'lightningdevil',
        ownerBonus: { bonusAttack: 3 },
        ownerText: '번개악마맛 쿠키가 착용하면 공격력이 3 더 오릅니다.'
    },
    dark_crown: {
        name: '어둠의 왕관', slot: 'helmet', grade: '레전더리', icon: '👑',
        bonusHealth: 26, bonusAttack: 2
    },
    dark_mantle: {
        name: '어둠의 망토', slot: 'armor', grade: '레전더리', icon: '🧥',
        bonusHealth: 34, bonusDamageTaken: 0.91
    },
    dark_greaves: {
        name: '어둠의 각반', slot: 'leggings', grade: '레전더리', icon: '🦿',
        bonusHealth: 26
    },
    dark_boots: {
        name: '어둠의 장화', slot: 'boots', grade: '레전더리', icon: '🥾',
        bonusHealth: 24, bonusDamageTaken: 0.93
    },
    // ---- 시하라얼 ----
    shihara_spear: {
        name: '시하라얼의 창', slot: 'weapon', grade: '에픽', icon: '🔱',
        bonusAttack: 3,
        ownerChar: 'lightninghell',
        ownerBonus: { bonusAttack: 2 },
        ownerText: '번개지옥맛 쿠키가 착용하면 공격력이 2 더 오릅니다.'
    },
    shadow_helm: {
        name: '그림자 투구', slot: 'helmet', grade: '에픽', icon: '⛑',
        bonusHealth: 18
    },
    shadow_boots: {
        name: '그림자 부츠', slot: 'boots', grade: '에픽', icon: '🥾',
        bonusHealth: 16
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
        // passiveBurnGrowthMaxRevives로 2번째 부활까지만 세서 2->3->4에서
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
    // 쿠키맛쿠키는 원래 부활이 없는 쿠키라, 부활 횟수(bonusRevive)뿐 아니라
    // 부활 시 체력 비율(passiveReviveHpRatio)도 이 장비가 처음으로 준다 --
    // 다른 각성 장비들의 주인은 전부 이미 자기 패시브로 한 번은 부활하는
    // 쿠키라 이 값이 필요 없었다.
    gingerbread_man: {
        name: '진저브레드맨', slot: 'awaken', grade: '게스트', icon: '🍪',
        ownerChar: 'plaincookie',
        ownerBonus: { bonusRevive: 1 },
        // attackHealEveryHits:1 + attackHealSelf:1 -> 구슬 하나가 맞을 때마다
        // (홈잉 4발이라 한 번 쏘면 최대 4번) 자기 체력 1 회복. passiveRegenAmount/
        // passiveRegenTickMs -> 전투 중 1초마다 그냥 자기 체력 1 회복(자두맛
        // 본능해제 5강과 같은 훅을 재사용).
        awakenForm: {
            passiveReviveHpRatio: 1,
            attackHealEveryHits: 1,
            attackHealSelf: 1,
            passiveRegenAmount: 1,
            passiveRegenTickMs: 1000
        },
        ownerText: '쿠키맛 쿠키 전용 — 기본 공격(구슬)이 하나 맞을 때마다 체력 1 회복, 전투 중 1초마다 체력 1 자동 회복, 쓰러지면 체력 100%로 한 번 부활합니다.'
    },
    // ---- 등급 x 종류 채우기 (각성 장비 제외, 등급별 5종류 모두 하나씩) ----
    // ---- 일반 ----
    rusty_sword: { name: '녹슨 검', slot: 'weapon', grade: '일반', icon: '🗡', bonusAttack: 1 },
    leather_hood: { name: '가죽 두건', slot: 'helmet', grade: '일반', icon: '🧢', bonusHealth: 5 },
    linen_robe: { name: '삼베 옷', slot: 'armor', grade: '일반', icon: '🦺', bonusHealth: 8, bonusDamageTaken: 0.98 },
    cotton_pants: { name: '무명 바지', slot: 'leggings', grade: '일반', icon: '👖', bonusHealth: 6, bonusDamageTaken: 0.99 },
    straw_sandals: { name: '짚신', slot: 'boots', grade: '일반', icon: '🩴', bonusHealth: 5, bonusDamageTaken: 0.99 },
    // ---- 희귀 ----
    silver_axe: { name: '은도끼', slot: 'weapon', grade: '희귀', icon: '⛏', bonusAttack: 2 },
    spiked_helm: { name: '가시 투구', slot: 'helmet', grade: '희귀', icon: '🪖', bonusHealth: 12, bonusAttack: 1 },
    steel_plate: { name: '강철 판금', slot: 'armor', grade: '희귀', icon: '🛡', bonusHealth: 20, bonusDamageTaken: 0.96 },
    spiked_greaves: { name: '가시 각반', slot: 'leggings', grade: '희귀', icon: '🦵', bonusHealth: 13 },
    wind_shoes: { name: '바람의 신발', slot: 'boots', grade: '희귀', icon: '👟', bonusHealth: 9, bonusSpeed: 2 },
    // ---- 에픽 ----
    ice_spear: { name: '얼음 창', slot: 'weapon', grade: '에픽', icon: '🔱', bonusAttack: 3 },
    flame_helm: { name: '화염 투구', slot: 'helmet', grade: '에픽', icon: '⛑', bonusHealth: 20, bonusAttack: 1 },
    spirit_armor: { name: '정령의 갑옷', slot: 'armor', grade: '에픽', icon: '🛡', bonusHealth: 28, bonusDamageTaken: 0.94 },
    storm_greaves: { name: '폭풍의 각반', slot: 'leggings', grade: '에픽', icon: '🦿', bonusHealth: 22, bonusSpeed: 3 },
    gale_boots: { name: '질풍 부츠', slot: 'boots', grade: '에픽', icon: '🥾', bonusHealth: 16, bonusSpeed: 4 },
    // ---- 레전더리 (어둠 세트와 짝을 이루는 빛 세트) ----
    light_blade: { name: '빛의 대검', slot: 'weapon', grade: '레전더리', icon: '⚔', bonusAttack: 6 },
    light_crown: { name: '빛의 왕관', slot: 'helmet', grade: '레전더리', icon: '👑', bonusHealth: 28, bonusAttack: 2 },
    light_mantle: { name: '빛의 갑옷', slot: 'armor', grade: '레전더리', icon: '🧥', bonusHealth: 36, bonusDamageTaken: 0.9 },
    light_greaves: { name: '빛의 각반', slot: 'leggings', grade: '레전더리', icon: '🦿', bonusHealth: 28 },
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
// 레전드 스토리는 11층+ 규칙과 다르다 -- 혼자면 3명(각성모드와 같은 파티
// 구조), 2인 멀티면 한 사람당 1명씩만(교체 없이, 1~10층처럼 캐릭터 하나).
// solo는 joinStoryFloor가 받는 것과 같은 값(false면 멀티) -- 안 주면(다른
// 모든 호출자처럼) 기존 층은 그대로, 레전드 층은 혼자 온 걸로 보고 3을 준다.
function storyPartySizeFor(floor, solo) {
    if (isLegendFloor(floor)) return solo === false ? 1 : LEGEND_PARTY_SIZE;
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
    },
    soulStoneChoice: {
        name: '선택 영혼석 100개', icon: '💠',
        desc: '사용하면 케릭터를 하나 선택해서 그 케릭터에게 영혼석 100개를 줍니다.',
        usable: true
    },
    randomLegendaryGear: {
        name: '랜덤 레전더리 장비', icon: '🌟',
        desc: '사용하면 레전더리 장비 하나가 무작위로 나옵니다.',
        usable: true
    }
};
const ITEM_KEYS = Object.keys(ITEMS);

const SOUL_STONES_PER_CHARACTER = 100;

// 가챠에서 이미 보유한 케릭터가 또 나오면 그 케릭터 영혼석으로 대신 지급하는 개수.
const DUPLICATE_CHAR_SOUL_STONES = 30;

// ---- 본능해제 ----
// 이미 얻은 캐릭터를 그 캐릭터의 영혼석으로 영구 강화한다 (최대 5강).
// 1강은 기본 능력치, 2강은 스킬(공격/보호막/회복) 강화. 3~5강은 궁극기 강화이고
// 캐릭터마다 다르게 나중에 직접 채워 넣을 예정이라, 지금은 자리만 있고 효과가 없다.
const INSTINCT_MAX_LEVEL = 5;
const INSTINCT_COSTS = [100, 150, 200, 300, 500]; // index 0 = 1강 비용 ... index 4 = 5강 비용
const INSTINCT_L1_BONUS_HEALTH = 30;
const INSTINCT_L1_BONUS_ATTACK = 2;
const INSTINCT_L2_SKILL_DAMAGE_BONUS = 8;
const INSTINCT_L2_SKILL_SHIELD_BONUS = 10;
const INSTINCT_L2_SKILL_HEAL_BONUS = 10;
// 스킬 수치 중 고정값으로 표현된 필드만 2강 보너스를 받는다. 비율형(skillHealRatio 등)이나
// 단계별 배열로 표현된 스킬은 대상이 아니다 -- 캐릭터마다 형태가 달라서 안전하게 더할 수 없다.
const INSTINCT_SKILL_DAMAGE_KEYS = ['skillDamage'];
const INSTINCT_SKILL_HEAL_KEYS = ['skillHealAmount', 'skillHealOnHit', 'skillHealPerTick'];
const INSTINCT_SKILL_SHIELD_KEYS = ['skillShieldAmount'];

// 값이 이상해도(문자열, undefined, 음수, NaN 등) 항상 0~INSTINCT_MAX_LEVEL 사이의
// 정수로 떨어진다. NaN은 비교 연산(<, >=)이 전부 false라서 그냥 Math.floor(x||0)만
// 쓰면 레벨 체크를 건너뛰고 보너스가 적용되는 사고가 나므로 여기서 한 번에 막는다.
function clampInstinctLevel(level) {
    const n = Number(level);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.min(INSTINCT_MAX_LEVEL, Math.floor(n));
}

function instinctLevelOf(instinctLevels, charType) {
    return clampInstinctLevel(instinctLevels && instinctLevels[charType]);
}

// 다음 강화(1~5강)에 드는 영혼석. 이미 최대 강화면 null.
function instinctNextCost(level) {
    const lv = clampInstinctLevel(level);
    if (lv >= INSTINCT_MAX_LEVEL) return null;
    return INSTINCT_COSTS[lv];
}

// 1강의 기본 능력치 보너스. 장비 보너스와 같은 자리(등가 bonus.health/attack)에 더해서 쓴다.
// 보통은 모든 캐릭터가 같은 값을 받는 범용 보너스지만, 파핑캔디맛처럼 공격력을
// 낱발 피해(1) 그대로 쓰는 연사형 캐릭터는 공격력 보너스가 사실상 의미가 없어서
// INSTINCT_L1_OVERRIDES에 캐릭터별로 다른 배분을 적어 둘 수 있다.
const INSTINCT_L1_OVERRIDES = {
    // 연사 위주라 공격력 보너스 대신 그만큼(+20) 체력을 더 준다.
    poppingcandy: { health: INSTINCT_L1_BONUS_HEALTH + 20, attack: 0 }
};
function instinctStatBonus(level, charType) {
    const lv = clampInstinctLevel(level);
    if (lv < 1) return { health: 0, attack: 0 };
    const override = charType && INSTINCT_L1_OVERRIDES[charType];
    return override ? { ...override } : { health: INSTINCT_L1_BONUS_HEALTH, attack: INSTINCT_L1_BONUS_ATTACK };
}

// 캐릭터별 2~5강(스킬/궁극기/패시브 강화). 사용자가 캐릭터마다 직접 디자인해서
// 채워 넣는 자리 -- 없는 캐릭터/레벨은 characterWithInstinct가 그냥 건너뛰고,
// 상세화면엔 "준비 중"으로 보인다. effect는 그 레벨에서 확정되는 최종값(더하기가
// 아니라 덮어쓰기)이라, 예를 들어 ultimateDurationMs를 3강 8000 -> 4강 10000처럼
// 레벨마다 다시 정할 수 있다. 2강은 원래 범용 스킬 강화(INSTINCT_L2_SKILL_*_KEYS)
// 몫이라 대부분 여기 안 쓰지만, 파핑캔디맛처럼 특수스킬 자체가 없어서 범용 2강이
// 아무 효과도 없는 캐릭터는 여기 2강 항목으로 대신 채워 넣는다.
const INSTINCT_CHAR_LEVELS = {
    // 자두맛 쿠키: team_heal_over_time 궁극기(1초마다 10 회복)를 오래 켜 둔다.
    kicker: {
        3: {
            effect: { ultimateDurationMs: 8000 },
            desc: '궁극기 지속시간이 8초로 늘어나, 그동안 팀 전체를 1초마다 10씩 회복시킵니다.'
        },
        4: {
            effect: { ultimateDurationMs: 10000 },
            desc: '궁극기 지속시간이 10초로 늘어나, 그동안 팀 전체를 1초마다 10씩 회복시킵니다.'
        },
        5: {
            effect: { passiveRegenAmount: 1, passiveRegenTickMs: 5000 },
            desc: '패시브로 5초마다 체력을 1 회복합니다.'
        }
    },
    // 시금치맛 쿠키: attack_heal_boost 궁극기(공격 적중 시 팀 회복) 위주로 강화한다.
    spinach: {
        3: {
            effect: { instinctUltimateAttackSpeedMult: 0.2 },
            desc: '궁극기를 쓰는 동안 공격속도가 5배(재사용 대기시간 20%)로 빨라집니다.'
        },
        4: {
            effect: { ultimateDurationMs: 10000 },
            desc: '궁극기 지속시간이 10초로 늘어납니다.'
        },
        5: {
            effect: { attackHealChance: 1, attackHealOnUse: 2 },
            desc: '패시브로 기본 공격이 적중할 때마다 100% 확률로 팀 전체를 2 회복시킵니다.'
        }
    },
    // 청사과맛 쿠키: element_mark 궁극기(기본공격이 표식을 남기는 시간)를 강화한다.
    greenapple: {
        3: {
            effect: { ultimateDurationMs: 10000 },
            desc: '궁극기 지속시간이 5초에서 10초로 늘어납니다.'
        },
        4: {
            effect: { ultimateMarkUses: 5 },
            desc: '궁극기 사용 중 남기는 속성표식이 5번씩 적용됩니다.'
        },
        5: {
            effect: { attackKnockback: 40, attackMarkUses: 1, instinctAttackMarkChance: 0.3 },
            desc: '기본 공격의 밀치기가 40픽셀로 강해지고, 궁극기가 꺼져 있어도 기본 공격 적중 시 30% 확률로 속성표식을 남깁니다.'
        }
    },
    // 보드맛 쿠키: team_shield 궁극기와 물 속성 저항 패시브를 강화한다.
    board: {
        3: {
            effect: { ultimateShieldAmount: 70 },
            desc: '궁극기 보호막이 70으로 강해집니다.'
        },
        4: {
            effect: { ultimateHealAmount: 10 },
            desc: '궁극기를 쓰면 보호막과 함께 팀 전체 체력을 10 회복시킵니다.'
        },
        5: {
            effect: { passiveResistMultiplier: 0.6 },
            desc: '물 속성 표식이 붙은 상대에게 받는 피해가 60%로 줄어듭니다.'
        }
    },
    // 전기줄맛 쿠키: body_fuse 궁극기(합체)를 강화한다.
    electriccord: {
        3: {
            effect: { ultimateDurationMs: 15000 },
            desc: '궁극기(합체) 지속시간이 15초로 늘어납니다.'
        },
        4: {
            effect: { instinctFusedRegenAmount: 2, instinctFusedRegenTickMs: 1000 },
            desc: '합체 상태인 동안 1초마다 체력을 2 회복합니다.'
        },
        5: {
            effect: { upperAttackDamage: 5, lowerAttackDamage: 8 },
            desc: '상체 공격력이 5로, 하체 공격력이 8로 강해집니다.'
        }
    },
    // 레드 드레곤맛 쿠키: awakening 궁극기(속도·공격력 버프 + 자힐)를 강화한다.
    reddragon: {
        3: {
            effect: { ultimateDurationMs: 10000 },
            desc: '궁극기(각성) 지속시간이 10초로 늘어납니다.'
        },
        4: {
            effect: { ultimateAttackDamage: 11 },
            desc: '궁극기(각성) 중 공격력이 11로 강해집니다.'
        },
        5: {
            effect: { passiveDamageMultiplier: 0.8 },
            desc: '패시브로 받는 피해가 항상 80%로 줄어듭니다.'
        }
    },
    // 자색 고구마맛 쿠키: targeted_aoe 궁극기(지정 범위 피해)를 강화한다.
    sweetpotato: {
        3: {
            effect: { ultimateRadius: 120 },
            desc: '궁극기 범위가 120픽셀로 넓어집니다.'
        },
        4: {
            effect: { ultimateDamage: 20 },
            desc: '궁극기 피해가 20으로 강해집니다.'
        },
        5: {
            effect: { attackDamage: 9 },
            desc: '기본 공격력이 9로 강해집니다.'
        }
    },
    // 화산맛 쿠키: magma_zone 궁극기(지대 지속피해)와 기본공격 화상을 강화한다.
    volcano: {
        3: {
            effect: { ultimateZoneDurationMs: 12000 },
            desc: '궁극기(마그마 지대) 지속시간이 12초로 늘어납니다.'
        },
        4: {
            effect: { ultimateZoneDamagePerTick: 3 },
            desc: '궁극기 지대의 초당 피해가 3으로 강해집니다.'
        },
        5: {
            effect: { attackBurnTicks: 4 },
            desc: '기본 공격의 화상 피해가 4번 들어갑니다.'
        }
    },
    // 슈가 플라이맛 쿠키: butterfly_mode 궁극기(토글, 켜져 있는 동안 자기 체력이
    // 깎인다)와 기본공격 패시브 회복을 강화한다.
    sugarfly: {
        3: {
            effect: { ultimateAttackDamage: 9 },
            desc: '궁극기(나비모드)를 쓰는 동안 공격력이 9로 강해집니다.'
        },
        4: {
            effect: { ultimateSelfDamageIntervalMs: 3000 },
            desc: '나비모드로 자기 체력이 깎이는 주기가 2초에서 3초로 늘어나 덜 자주 깎입니다.'
        },
        5: {
            effect: { attackHealEveryHits: 3 },
            desc: '패시브로 기본 공격을 3번 적중시킬 때마다 체력을 2 회복합니다.'
        }
    },
    // 번개전사맛 쿠키: lightning_strike 궁극기와 패시브 부활을 강화한다.
    lightning: {
        3: {
            effect: { ultimateDamage: 23 },
            desc: '궁극기 피해가 23으로 강해집니다.'
        },
        4: {
            effect: { ultimateDamageDebuffMultiplier: 0.5 },
            desc: '궁극기에 맞은 적이 10초 동안 주는 피해가 50%로 줄어듭니다.'
        },
        5: {
            effect: { passiveReviveHpRatio: 1 },
            desc: '쓰러졌을 때 체력 100%로 부활합니다.'
        }
    },
    // 물방울맛 쿠키: mark_flood 궁극기(폭포, 표식만 남기고 피해는 없었다)를 강화한다.
    waterdrop: {
        3: {
            effect: { ultimateMarkDurationMs: 15000 },
            desc: '궁극기(폭포) 지속시간이 15초로 늘어납니다.'
        },
        4: {
            effect: { instinctZoneDamagePerTick: 2, instinctZoneTickMs: 1000 },
            desc: '궁극기(폭포) 범위 안의 적이 초당 2의 피해를 받습니다.'
        },
        5: {
            effect: { attackProjectileSpeed: 560 },
            desc: '기본 공격(물방울)의 날아가는 속도가 조금 빨라집니다.'
        }
    },
    // 마그마맛 쿠키: magma_pour 궁극기와 기본공격 화상을 강화한다.
    magma: {
        3: {
            effect: { ultimateDamage: 12 },
            desc: '궁극기 피해에 불 데미지 2가 추가되어 12가 됩니다.'
        },
        4: {
            effect: { ultimateRadius: 120 },
            desc: '궁극기 범위가 120픽셀로 넓어집니다.'
        },
        5: {
            effect: { attackBurnTicks: 7 },
            desc: '기본 공격의 화상 총 피해가 7이 됩니다.'
        }
    },
    // 오렌지 레몬맛 쿠키: awakening_rapid 궁극기(연타)를 강화한다.
    orangelemon: {
        3: {
            effect: { ultimateDurationMs: 15000 },
            desc: '궁극기(각성) 지속시간이 15초로 늘어납니다.'
        },
        4: {
            effect: { instinctRapidSpeedBonus: 1 },
            desc: '궁극기를 쓰는 동안 이동 속도가 1 빨라집니다.'
        },
        5: {
            effect: { attackDamageRight: 11, attackDamageLeft: 12, health: 150 },
            desc: '공격력이 4 올라(오른쪽 11 · 왼쪽 12) 세지고, 체력이 150으로 늘어납니다.'
        }
    },
    // 용과맛 쿠키: team_guard 궁극기와 기본공격 패시브(회복·화상)를 강화한다.
    dragonfruit: {
        3: {
            effect: { ultimateHealRatio: 0.4 },
            desc: '궁극기 회복량이 최대 체력의 40%로 늘어납니다.'
        },
        4: {
            effect: { ultimateShieldAmount: 70 },
            desc: '궁극기 보호막이 70으로 강해집니다.'
        },
        5: {
            effect: { attackHealOnUse: 2, attackBurnTicks: 3 },
            desc: '패시브로 공격 적중 시 팀 회복량이 2로 늘고, 화상 총 피해가 3이 됩니다.'
        }
    },
    // 블랙 슈거맛 쿠키: guard_surge 궁극기와 항상 켜져 있는 패시브 피해 감소를 강화한다.
    blacksugar: {
        3: {
            effect: { ultimateShieldAmount: 100 },
            desc: '궁극기 보호막이 100으로 강해집니다.'
        },
        4: {
            effect: { ultimateHealAmount: 40 },
            desc: '궁극기 회복량이 40으로 늘어납니다.'
        },
        5: {
            effect: { passiveDamageMultiplier: 0.7 },
            desc: '패시브로 받는 피해가 70%로 줄어듭니다.'
        }
    },
    // 번개악마맛 쿠키: great_slash 궁극기와 패시브 회복 확률을 강화한다.
    lightningdevil: {
        3: {
            effect: { ultimateDamage: 65 },
            desc: '궁극기(크게베기) 피해가 15 늘어나 65가 됩니다.'
        },
        4: {
            effect: { ultimateHealRatio: 0.25 },
            desc: '궁극기가 적중하면 최대 체력의 25%를 회복합니다.'
        },
        5: {
            effect: { passiveHitHealChance: 0.25 },
            desc: '패시브 회복 확률이 25%로 늘어납니다.'
        }
    },
    // 바다펄맛 쿠키: 궁극기 자리인 특수스킬(밀물, 4단계 순환)과 패시브 부활을 강화한다.
    // skillStages는 배열이라 덮어쓸 때마다 이전 강화분까지 포함한 배열 전체를 다시 적는다.
    seapearl: {
        3: {
            effect: {
                skillStages: [
                    { windupMs: 0, healRatio: 0.1, shieldAmount: 20 },
                    { windupMs: 1000, damageRatio: 0.2, healRatio: 0.25, shieldAmount: 50 },
                    { windupMs: 3000, damageRatio: 0.3, healRatio: 0.5, shieldAmount: 70 },
                    { windupMs: 5000, damageRatio: 0.4, healRatio: 0.8, shieldAmount: 100 }
                ]
            },
            desc: '특수스킬(밀물) 2단계 보호막이 50으로 강해집니다.'
        },
        4: {
            effect: {
                skillStages: [
                    { windupMs: 0, healRatio: 0.1, shieldAmount: 20 },
                    { windupMs: 1000, damageRatio: 0.2, healRatio: 0.25, shieldAmount: 50 },
                    { windupMs: 3000, damageRatio: 0.3, healRatio: 0.5, shieldAmount: 70 },
                    { windupMs: 3000, damageRatio: 0.4, healRatio: 0.8, shieldAmount: 100 }
                ]
            },
            desc: '특수스킬(밀물) 4단계 예열 시간이 5초에서 3초로 줄어듭니다.'
        },
        5: {
            effect: { passiveReviveCount: 1, passiveReviveHpRatio: 0.5 },
            desc: '패시브로 쓰러졌을 때 한 번, 체력 50%로 부활합니다.'
        }
    },
    // 지옥맛 쿠키: sky_slam 궁극기와 처치 시 공격력이 쌓이는 패시브를 강화한다.
    hellflavor: {
        3: {
            effect: { ultimateDamage: 70 },
            desc: '궁극기(하늘 내려찍기) 피해가 10 늘어나 70이 됩니다.'
        },
        4: {
            effect: { ultimateAttackBuffDurationMs: 15000 },
            desc: '궁극기가 적중하면 공격력 버프가 10초에서 15초로 더 오래 유지됩니다.'
        },
        5: {
            effect: { passiveKillAttackBuff: 3 },
            desc: '패시브로 적을 쓰러뜨릴 때마다 공격력이 3씩(15초간) 쌓입니다.'
        }
    },
    // 번개지옥맛 쿠키: undying_soul 궁극기(회복+부하 소환)와 패시브 부활을 강화한다.
    lightninghell: {
        3: {
            effect: { ultimateHealRatio: 0.7 },
            desc: '궁극기 회복량이 최대 체력의 70%로 늘어납니다.'
        },
        4: {
            effect: { ultimateSummonCount: 5 },
            desc: '궁극기로 소환하는 번개 부하가 5마리로 늘어납니다.'
        },
        5: {
            effect: { passiveReviveCount: 2 },
            desc: '패시브로 부활할 수 있는 횟수가 한 번 더 늘어나 총 2번이 됩니다.'
        }
    },
    // 치즈만두맛 쿠키: dumpling_zone 궁극기(화산맛 마그마 지대와 같은 방식)와
    // 부활(=각성) 시의 공격력을 강화한다.
    cheesedumpling: {
        3: {
            effect: { ultimateZoneDurationMs: 15000 },
            desc: '궁극기(만두 덩어리) 지속시간이 15초로 늘어납니다.'
        },
        4: {
            effect: { ultimateZoneDamagePerTick: 6 },
            desc: '궁극기 지대의 초당 피해가 4 늘어나 6이 됩니다.'
        },
        5: {
            // awakenedForm은 통째로 덮어써야 해서 원래 값을 그대로 옮기고 attackDamage만 바꾼다.
            effect: { awakenedForm: { health: 200, attackDamage: 9, attackMarkUses: 0, keepsOwnMarks: false, markEatBonus: 5 } },
            desc: '부활(각성)했을 때 공격력이 3 올라 9가 됩니다.'
        }
    },
    // 불꽃요정맛 쿠키: fire_line_zone 궁극기와 기본공격 화상을 강화한다.
    flamefairy: {
        3: {
            effect: { ultimateZoneDurationMs: 20000 },
            desc: '궁극기(화염지대) 지속시간이 15초에서 20초로 늘어납니다.'
        },
        4: {
            effect: { ultimateZoneDamagePerTick: 5 },
            desc: '화염지대 안의 적이 받는 초당 피해가 2 늘어나 5가 됩니다.'
        },
        5: {
            effect: { attackBurnTicks: 7 },
            desc: '기본 공격의 화상이 7번 들어가 총 피해가 14가 됩니다.'
        }
    },
    // 쿠키맛 쿠키: targeted_line_aoe 궁극기와 기본공격(빛의 구슬)을 강화한다.
    plaincookie: {
        3: {
            effect: { ultimateDamage: 60 },
            desc: '궁극기(빛의 심판) 피해가 60으로 강해집니다.'
        },
        4: {
            effect: { ultimateHealPerEnemy: 60 },
            desc: '궁극기로 회복하는 양이 맞힌 적 한 마리당 60으로 늘어납니다.'
        },
        5: {
            effect: { attackProjectileCount: 5 },
            desc: '기본 공격의 빛 구슬이 5개로 늘어납니다.'
        }
    },
    // 버블티맛 쿠키: 궁극기(무한) 공격력과 기본공격의 표식/자힐을 강화한다.
    bubbletea: {
        3: {
            effect: { instinctUltimateRapidAttackBonus: 2 },
            desc: '궁극기(무한)가 켜져 있는 동안 기본 공격 피해가 2 늘어나 7이 됩니다.'
        },
        4: {
            effect: { attackMarkUses: 2 },
            desc: '기본 공격이 맞을 때마다 붙는 빛 속성 표식이 2개로 늘어납니다.'
        },
        5: {
            effect: { attackHealEveryHits: 1, attackHealSelf: 1 },
            desc: '기본 공격이 맞을 때마다 자신의 체력을 1만큼 회복합니다.'
        }
    },
    // 바람궁수맛 쿠키: 궁극기(각성) 3단계와 2단계, 기본공격 회복을 강화한다.
    windarcher: {
        3: {
            effect: { ultimateSanctuaryEnemyDamageRatio: 0.4 },
            desc: '궁극기 3단계 마법진이 깎는 적 체력이 30%에서 40%로 늘어납니다.'
        },
        4: {
            effect: { ultimateHealPerAttack: 5 },
            desc: '궁극기 2단계 동안 기본 공격이 적중할 때마다 회복량이 5로 늘어납니다.'
        },
        5: {
            effect: { attackHealOnUse: 3 },
            desc: '기본 공격이 적중할 때마다 팀 전체를 3만큼 회복시킵니다.'
        }
    },
    // 암흑바다맛 쿠키: dash_guard 궁극기(회복량, 4강부터는 불 지대까지)와
    // 기본 공격의 보호막을 강화한다.
    darksea: {
        3: {
            effect: { ultimateHealAmount: 100 },
            desc: '궁극기 회복량이 80에서 100으로 늘어납니다.'
        },
        4: {
            // 돌진 궁극기가 도착한 자리에 5초짜리 불 지대가 생겨 초당 3의
            // 피해를 준다(magma_zone과 같은 훅을 서버에서 재사용).
            effect: {
                ultimateZoneDamagePerTick: 3, ultimateRadius: 90,
                ultimateZoneTickMs: 1000, ultimateZoneDurationMs: 5000
            },
            desc: '궁극기로 돌진한 자리에 5초 동안 불 지대가 생겨, 그 안의 적에게 1초마다 3의 피해를 줍니다.'
        },
        5: {
            effect: { attackShieldOnUse: 12 },
            desc: '기본 공격이 적중할 때마다 팀 전체에게 씌우는 보호막이 10에서 12로 늘어납니다.'
        }
    },
    // 파핑캔디맛 쿠키: 특수스킬이 없어서 범용 2강(스킬 강화)이 그냥 버려지는
    // 만큼, 여기서 체력으로 대신 채워 준다. 3~4강은 궁극기(자기 회복+보호막)를
    // 키우고, 5강은 연사 특성에 맞는 히트 카운트 패시브(passiveHitHeal이
    // 이미 범용으로 구현돼 있다 -- attackHealEveryHits/attackHealSelf만 채우면 된다).
    poppingcandy: {
        2: {
            effect: { health: 170 }, // 기본 120 + 50
            desc: '특수스킬이 없어 대신 체력이 120에서 170으로 늘어납니다.'
        },
        3: {
            effect: { ultimateHealRatio: 1 },
            desc: '궁극기 회복량이 최대 체력의 50%에서 100%로 늘어납니다.'
        },
        4: {
            effect: { ultimateShieldAmount: 150 },
            desc: '궁극기 보호막이 50에서 150으로 늘어납니다.'
        },
        5: {
            effect: { attackHealEveryHits: 3, attackHealSelf: 1 },
            desc: '패시브로 기본 공격을 3번 명중시킬 때마다 체력을 1 회복합니다.'
        }
    }
};
function instinctCharLevelEffect(charType, level) {
    const t = INSTINCT_CHAR_LEVELS[charType];
    return (t && t[level] && t[level].effect) || null;
}
function instinctCharLevelDesc(charType, level) {
    const t = INSTINCT_CHAR_LEVELS[charType];
    return (t && t[level] && t[level].desc) || null;
}

// 캐릭터 사본에 2강 스킬 강화 + 3~5강(있으면) 캐릭터별 강화를 반영한다.
// 바꿀 게 없으면 원본을 그대로 돌려준다 (사본을 만들지 않으므로 === 비교도 그대로 통한다).
function characterWithInstinct(character, level, charType) {
    const lv = clampInstinctLevel(level);
    if (!character || lv < 2) return character;
    const out = Object.assign({}, character);
    INSTINCT_SKILL_DAMAGE_KEYS.forEach(k => { if (out[k] != null) out[k] += INSTINCT_L2_SKILL_DAMAGE_BONUS; });
    INSTINCT_SKILL_HEAL_KEYS.forEach(k => { if (out[k] != null) out[k] += INSTINCT_L2_SKILL_HEAL_BONUS; });
    INSTINCT_SKILL_SHIELD_KEYS.forEach(k => { if (out[k] != null) out[k] += INSTINCT_L2_SKILL_SHIELD_BONUS; });
    if (charType) {
        // 2강도 캐릭터별 표를 볼 수 있게 3이 아니라 2부터 돈다 -- 기존
        // 캐릭터는 전부 INSTINCT_CHAR_LEVELS[..][2]가 없어서 그대로 no-op이고,
        // 특수스킬이 없어 범용 2강이 버려지는 캐릭터(파핑캔디맛)만 여기서
        // 의미 있는 효과를 받는다.
        for (let l = 2; l <= lv; l++) {
            const eff = instinctCharLevelEffect(charType, l);
            if (eff) Object.assign(out, eff);
        }
    }
    return out;
}

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
    { id: 'lightning', charType: 'lightning', icon: '⚡', ticketKey: 'ticketLightning', side: 'lightning' },
    { id: 'windarcher', charType: 'windarcher', icon: '🏹', ticketKey: 'ticketWindarcher', side: 'wind' }
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

// ==================== 속성 주식 ====================
// 속성별(물/불/바람/어둠/빛) 가상 주식. 시세는 런타임에 움직이는 게 아니라
// 이 파일의 STOCK_EVENTS 로그로만 정해진다 -- 패치(신규 캐릭터/밸런스 변경)를
// 낼 때마다 그 속성에 이벤트를 하나 추가하면, 서버/클라 양쪽이 shared.js
// 하나만 보고 항상 같은 값을 계산한다 (별도 DB 불필요).
const STOCK_ELEMENTS = ['물', '불', '바람', '어둠', '빛'];
const STOCK_BASE_PRICE = 100; // 다이아 기준 1주 시작가

// type: 'new_character' | 'buff' | 'nerf'. pct: 그 이벤트로 인한 배율
// 변동(+0.15 = 15% 상승, -0.1 = 10% 하락). 새 패치를 낼 때마다 맨 뒤에
// 이어서 추가할 것 -- 순서(날짜순)가 곧 시세 그래프가 된다.
const STOCK_EVENTS = [
    { element: '빛', type: 'new_character', pct: 0.10, note: '쿠키맛 쿠키 추가' },
    { element: '빛', type: 'new_character', pct: 0.05, note: '버블티맛 쿠키 추가' },
    { element: '바람', type: 'new_character', pct: 0.10, note: '바람궁수맛 쿠키 추가' },
    { element: '어둠', type: 'new_character', pct: 0.10, note: '암흑바다맛 쿠키 추가' },
    { element: '어둠', type: 'new_character', pct: 0.10, note: '매직블록맛 쿠키 추가' },
    { element: '어둠', type: 'new_character', pct: 0.05, note: '파핑캔디맛 쿠키 추가' }
];

// 이벤트를 기준가에 순서대로 복리 적용. 가격은 0 밑으로는 못 내려간다.
function computeStockPrice(element) {
    const price = STOCK_EVENTS
        .filter(e => e.element === element)
        .reduce((p, e) => Math.max(0, p * (1 + e.pct)), STOCK_BASE_PRICE);
    return Math.round(price);
}

function computeStockPrices() {
    const out = {};
    STOCK_ELEMENTS.forEach(el => { out[el] = computeStockPrice(el); });
    return out;
}

// ==================== 좀비막기 ====================
// 가로로 긴 직사각형 아레나에서 파티가 몰려오는 좀비 웨이브를 막아내는 생존
// 모드. 보스 레이드처럼 캐릭터 하나(장비 포함)로 1~2인이 함께 하지만, 상대는
// 정해진 패턴을 쓰는 보스가 아니라 웨이브마다 불어나는 좀비 무리다. 아레나
// 전체를 15x8(120칸) 격자로 나눠 두고, 준비 시간에 나무를 베어 모은 목재로 그
// 격자 위 아무 칸에나(내 근처 칸만) 울타리/제작대/용광로/채굴기/집/병사소환기를
// 짓는다. 채굴기가 캐낸 광석을 용광로가 철로 정련하면, 제작대 근처에서 그
// 철로 강화 울타리/강화 터렛/대포를 만들 수 있고, 강화대를 지어 코인으로
// 공격력·터렛 공격력·울타리 체력·병사 공격력을 올릴 수도 있다. 병사소환기는
// 제작대 없이도 지을 수 있고, 일정 시간마다 좀비를 향해 걸어가 싸우는 병사를
// 하나씩 뽑아낸다. 좀비는 아레나 오른쪽
// 가장자리에서만 나타나 왼쪽으로 밀려오고, 이 칸들을 장애물 삼아 제대로
// 길을 찾아 우회하며, 우회할 길이 아예 없을 때만 막고 있는 구조물을 부순다.
// 좀비를 잡으면 코인이 나오고, 파티 전원이 쓰러지면 그때까지 버틴 웨이브
// 수만큼 보상을 받는다 -- 이기고 지는 모드가 아니라 얼마나 오래 버티는지가
// 전부다.
const ZOMBIE_GRID_COLS = 15;
const ZOMBIE_GRID_ROWS = 8; // 15x8 = 120칸
const ZOMBIE_CELL_SIZE = 80;
const ZOMBIE_ARENA_HALF_W = (ZOMBIE_GRID_COLS * ZOMBIE_CELL_SIZE) / 2;
const ZOMBIE_ARENA_HALF_H = (ZOMBIE_GRID_ROWS * ZOMBIE_CELL_SIZE) / 2;
const ZOMBIE_BUILD_RANGE_CELLS = 1; // 내가 있는 칸의 8방향 이웃까지만 건설 가능

const ZOMBIE_MAX_TREES = 4;
const ZOMBIE_TREE_HITS = 3; // 나무 한 그루를 벨 때 필요한 타격 수
const ZOMBIE_WOOD_PER_HIT = 2;
const ZOMBIE_TREE_RESPAWN_MS = 15000;
const ZOMBIE_TREE_RADIUS = 22;

const ZOMBIE_PREP_MS = 8000; // 웨이브 사이 준비(건설) 시간
const ZOMBIE_COIN_PER_KILL = 3;

// 목록에 바로 뜨는 기본 건조물들. 전부 격자 한 칸을 통째로 막는 장애물이다.
// 채굴기는 10초마다 광석을 하나씩 캐내고, 용광로는 그 광석을 철로 정련한다
// (실제 처리는 tickZombieEconomy, server.js). 집은 그 위에 서 있는 동안
// 플레이어를 서서히 회복시킨다 (tickZombieHouseHealing, server.js).
const ZOMBIE_BUILDABLES = {
    fence: { name: '울타리', icon: '🧱', wood: 5, hp: 40 },
    workbench: { name: '제작대', icon: '🛠', wood: 8, hp: 30 },
    furnace: { name: '용광로', icon: '🔥', wood: 8, hp: 30 },
    miner: { name: '채굴기', icon: '⛏', wood: 10, hp: 30 },
    house: { name: '집', icon: '🏠', wood: 20, iron: 5, hp: 60 },
    // 제작대 없이도 지을 수 있다. 병사는 좀비처럼 격자 장애물은 무시하고(내
    // 편이 내가 지은 벽에 갇히면 이상하므로) 곧장 가장 가까운 좀비에게
    // 걸어가 부딪힌다 -- 오가다 마주친 좀비끼리 서로 치고받는 셈이다.
    soldierSpawner: { name: '병사소환기', icon: '🪖', wood: 20, iron: 15, hp: 50 }
};
const ZOMBIE_MINER_ORE_INTERVAL_MS = 10000; // 채굴기 한 대당 광석 1개/10초
const ZOMBIE_FURNACE_SMELT_MS = 8000; // 용광로 한 대당 광석 1개 -> 철 1개/8초
const ZOMBIE_HOUSE_HEAL_INTERVAL_MS = 500; // 집 위에 있으면 0.5초마다
const ZOMBIE_HOUSE_HEAL_AMOUNT = 1; // 체력 1씩 회복

// 병사소환기가 15초마다 하나씩 뽑아내는 병사 한 명의 스탯. 스포너 하나당
// 최대 마릿수를 넘으면 그 병사가 죽어 자리가 날 때까지 더 안 나온다
// (서버 부하/무한 증식 방지).
const ZOMBIE_SOLDIER_DEF = {
    hp: 20, radius: 14, speed: 1.5,
    attackDamage: 3, attackRange: 30, attackCooldown: 300 // 공속 0.3초
};
const ZOMBIE_SOLDIER_SPAWN_MS = 15000;
const ZOMBIE_SOLDIER_CAP_PER_SPAWNER = 5;

// 이미 지어 둔 제작대 근처에서만 만들 수 있는 것들. 터렛은 다른 건조물처럼
// 칸을 막으면서 가장 가까운 좀비를 자동으로 쏘고, 강화대는 설치해 두면
// 파티가 코인으로 능력치를 강화할 수 있는 시설이다. 강화 울타리/강화
// 터렛은 철이 있어야 만들 수 있는 상위 버전 (체력/사거리/피해가 더 높다).
const ZOMBIE_WORKBENCH_ITEMS = {
    turret: {
        name: '터렛', icon: '🔫', wood: 15, hp: 30,
        range: 200, damage: 4, attackCooldown: 600
    },
    upgradeTable: { name: '강화대', icon: '📈', wood: 10, hp: 30 },
    // 기본 울타리 체력(40)의 2배.
    reinforcedFence: { name: '강화 울타리', icon: '🧱', wood: 5, iron: 1, hp: 80 },
    // 기본 터렛 체력(30)의 1.5배, 사거리는 4칸(4 x ZOMBIE_CELL_SIZE), 피해는 2배.
    reinforcedTurret: {
        name: '강화 터렛', icon: '🔫', wood: 10, iron: 3, hp: 45,
        range: ZOMBIE_CELL_SIZE * 4, damage: 8, attackCooldown: 600
    },
    // 사거리 제한이 없다 -- 맵 어디에 있는 좀비든 다 맞힌다. 대신 터렛류보다
    // 느리게 쏜다.
    cannon: {
        name: '대포', icon: '💣', iron: 10, hp: 35,
        range: Infinity, damage: 6, attackCooldown: 800
    }
};

// 강화대에서 파는 네 가지(공격력/터렛 공격력/울타리 체력/병사 공격력) 전부
// 같은 값을 쓴다. n번째 구매(0부터 시작)는 5*(n+1) 코인 -- 1번째 5, 2번째
// 10, 3번째 15... 처럼 살 때마다 5코인씩 비싸진다. 이 강화들은 방(room)에
// 붙는 값이라 그 판이 끝나면(방이 사라지면) 함께 사라진다.
function zombieUpgradeCost(level) {
    return 5 * (level + 1);
}
// 레벨당 늘어나는 값 자체는 소수점이 있는 작은 수다 -- 실제로 적용할 때는
// (레벨 * 이 값)을 한 번에 계산해서 소수점을 버린다(Math.floor). 그래서
// 낮은 레벨에서는 살아도 눈에 보이는 변화가 없다가, 버림 문턱을 넘는
// 레벨부터 정수 단위로 훅훅 오른다 -- 의도된 동작이다.
const ZOMBIE_ATK_UPGRADE_AMOUNT = 0.2; // 공격력/터렛 공격력/병사 공격력: 레벨당 +0.2
const ZOMBIE_FENCE_HP_UPGRADE_AMOUNT = 0.5; // 울타리 체력: 레벨당 +0.5

const ZOMBIE_CELL_COUNT = ZOMBIE_GRID_COLS * ZOMBIE_GRID_ROWS;

function zombieCellIndex(col, row) { return row * ZOMBIE_GRID_COLS + col; }
function zombieCellColRow(index) {
    return { col: index % ZOMBIE_GRID_COLS, row: Math.floor(index / ZOMBIE_GRID_COLS) };
}
function zombieCellCenter(index) {
    const { col, row } = zombieCellColRow(index);
    return {
        x: -ZOMBIE_ARENA_HALF_W + col * ZOMBIE_CELL_SIZE + ZOMBIE_CELL_SIZE / 2,
        y: -ZOMBIE_ARENA_HALF_H + row * ZOMBIE_CELL_SIZE + ZOMBIE_CELL_SIZE / 2
    };
}
// 아레나 밖 좌표가 들어와도(스폰 직후 좀비 등) 가장 가까운 가장자리 칸으로 붙인다.
function zombieColRowOfPos(x, y) {
    const col = Math.floor((x + ZOMBIE_ARENA_HALF_W) / ZOMBIE_CELL_SIZE);
    const row = Math.floor((y + ZOMBIE_ARENA_HALF_H) / ZOMBIE_CELL_SIZE);
    return {
        col: Math.max(0, Math.min(ZOMBIE_GRID_COLS - 1, col)),
        row: Math.max(0, Math.min(ZOMBIE_GRID_ROWS - 1, row))
    };
}
function zombieCellIndexOfPos(x, y) {
    const { col, row } = zombieColRowOfPos(x, y);
    return zombieCellIndex(col, row);
}
// 특정 칸을 기준으로 지을 수 있는 이웃 칸들 (자기 칸 자신은 제외).
function zombieBuildableCellsFrom(col, row) {
    const out = [];
    for (let dr = -ZOMBIE_BUILD_RANGE_CELLS; dr <= ZOMBIE_BUILD_RANGE_CELLS; dr++) {
        for (let dc = -ZOMBIE_BUILD_RANGE_CELLS; dc <= ZOMBIE_BUILD_RANGE_CELLS; dc++) {
            if (dr === 0 && dc === 0) continue;
            const c = col + dc, r = row + dr;
            if (c < 0 || c >= ZOMBIE_GRID_COLS || r < 0 || r >= ZOMBIE_GRID_ROWS) continue;
            out.push(zombieCellIndex(c, r));
        }
    }
    return out;
}

// 좀비 종류. unlockWave부터 그 웨이브 구성에 섞여 나오기 시작한다.
// speed는 다른 몹들처럼 50ms 틱당 아니라 "3틱 걸음"의 기준값 -- tickZombie에서
// *3을 곱해 픽셀/틱으로 쓴다 (tickMonsterSet의 monsterSpeed 관례와 맞춤).
const ZOMBIE_DEFS = {
    shambler: {
        name: '느림보 좀비', unlockWave: 1, radius: 18, color: '#6b8e4e',
        hp: 18, speed: 1.1, attackDamage: 5, attackRange: 34, attackCooldown: 900,
        structureDamage: 5
    },
    runner: {
        name: '재빠른 좀비', unlockWave: 3, radius: 15, color: '#c0392b',
        hp: 12, speed: 2.2, attackDamage: 3, attackRange: 30, attackCooldown: 700,
        structureDamage: 3
    },
    brute: {
        name: '덩치 좀비', unlockWave: 6, radius: 26, color: '#4a4a4a',
        hp: 70, speed: 0.7, attackDamage: 12, attackRange: 42, attackCooldown: 1200,
        structureDamage: 14
    }
};

// 웨이브가 올라갈수록 체력·공격력이 이전 웨이브 대비 배수로 불어난다
// (체력 x1.4, 공격력·벽 피해 x1.5, 웨이브당 누적 복리). 속도는 종류별로 고정.
const ZOMBIE_WAVE_HP_GROWTH = 1.4;
const ZOMBIE_WAVE_ATTACK_GROWTH = 1.5;
function zombieStatsForWave(type, wave) {
    const def = ZOMBIE_DEFS[type];
    const w = Math.max(1, Math.floor(wave || 1));
    const hpScale = Math.pow(ZOMBIE_WAVE_HP_GROWTH, w - 1);
    const atkScale = Math.pow(ZOMBIE_WAVE_ATTACK_GROWTH, w - 1);
    return {
        ...def,
        hp: Math.round(def.hp * hpScale),
        attackDamage: Math.round(def.attackDamage * atkScale),
        structureDamage: Math.round(def.structureDamage * atkScale)
    };
}

// 그 웨이브에 등장 가능한 종류들.
function zombieTypesForWave(wave) {
    return Object.keys(ZOMBIE_DEFS).filter(t => wave >= ZOMBIE_DEFS[t].unlockWave);
}

// 그 웨이브에 나오는 총 마릿수. 1웨이브 기준(6마리)에서 웨이브당 x1.3씩
// 복리로 불어나되, 방 하나가 너무 무거워지지 않도록 상한을 둔다.
const ZOMBIE_WAVE1_COUNT = 6;
const ZOMBIE_WAVE_COUNT_GROWTH = 1.3;
function zombieCountForWave(wave) {
    const w = Math.max(1, Math.floor(wave || 1));
    return Math.min(Math.round(ZOMBIE_WAVE1_COUNT * Math.pow(ZOMBIE_WAVE_COUNT_GROWTH, w - 1)), 40);
}

// 스폰될 좀비 한 마리의 종류를 뽑는다. 느림보가 기본이고, 웨이브가 올라가면
// 다른 종류가 섞여 든다.
function zombieRollTypeForWave(wave) {
    const types = zombieTypesForWave(wave);
    if (types.length === 1 || Math.random() < 0.55) return 'shambler';
    return types[1 + Math.floor(Math.random() * (types.length - 1))];
}

// 웨이브를 버틴 만큼 주는 보상. 죽은 순간 진행 중이던 웨이브 번호를 넣어 부른다.
// 코인·다이아는 1웨이브에 각 1개에서 시작해 웨이브마다 2배씩 복리로 불어난다
// (좀비 자체가 웨이브마다 복리로 세지는 것과 같은 곡선). 30웨이브부터는
// 강화 재료/포션류가 고정으로 추가되고, 100웨이브부터는 일반 뽑기 티켓이
// 1장에서 시작해 이것도 웨이브마다(100웨이브 기준) 2배씩 불어난다.
const ZOMBIE_REWARD_BASE_GROWTH = 2;
const ZOMBIE_REWARD_TICKET_FROM_WAVE = 100;
function zombieWaveReward(wave) {
    const w = Math.max(1, Math.floor(wave || 1));
    const base = Math.pow(ZOMBIE_REWARD_BASE_GROWTH, w - 1);
    const reward = { coins: base, diamonds: base };
    if (w >= 30) {
        reward.material = 5;
        reward.materialRare = 2;
        reward.potion = 1;
        reward.potionRare = 1;
    }
    if (w >= ZOMBIE_REWARD_TICKET_FROM_WAVE) {
        reward.ticketNormal = Math.pow(ZOMBIE_REWARD_BASE_GROWTH, w - ZOMBIE_REWARD_TICKET_FROM_WAVE);
    }
    return reward;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ARENA_RADIUS, BOSS_RADIUS, PLAYER_RADIUS, CHARACTERS, BOSS_DEFS, BOSS_LIST, MONSTER_RADIUS, monsterRadiusOf, SUMMON_RADIUS, STAR_RADIUS, PROJECTILE_RADIUS, PROJECTILE_MAX_LIFETIME_MS, MONSTERS, STORY_FLOOR_DEFS, GACHA_SOUL_STONE_KEY, GACHA_TABLE, DEMON_GACHA_KEY, DEMON_GACHA_RATES, demonGachaTable, EVENTS, EVENT, EVENT_STAGE_DEFS, allEventStages, allEventBosses, allEventPlayable, floorDefFor, isEventStage, SOUL_STONES_PER_CHARACTER, DUPLICATE_CHAR_SOUL_STONES, INSTINCT_MAX_LEVEL, INSTINCT_COSTS, INSTINCT_L1_BONUS_HEALTH, INSTINCT_L1_BONUS_ATTACK, INSTINCT_L2_SKILL_DAMAGE_BONUS, INSTINCT_L2_SKILL_SHIELD_BONUS, INSTINCT_L2_SKILL_HEAL_BONUS, instinctLevelOf, instinctNextCost, instinctStatBonus, characterWithInstinct, instinctCharLevelEffect, instinctCharLevelDesc, CLEAR_REWARDS, storyRewardKey, clearRewardFor, CLEAR_DROPS, clearDropsFor, TOWER_BOSS_EVERY, isTowerBossFloor, legendaryEquipmentIds, towerBossReward, EQUIP_SLOTS, EQUIP_SLOT_KEYS, EQUIPMENT, equipmentFor, ownerBonusActive, awakenGearFor, characterWithGear, equipBonusFor, EQUIP_MAX_LEVEL, EQUIP_BONUS_KEYS, EQUIP_UPGRADE_STEPS, equipUsesRareMaterial, equipUpgradeCost, equipLevelScale, scaledBonus, equipStatsAtLevel, equipEntryOf, GRADE_ORDER, AWAKEN_SLOT, hasAwakenSlot, formStat, reviveCountFor, STORY_PARTY_FROM_FLOOR, STORY_PARTY_SIZE, storyPartySizeFor, AWAKEN_PARTY_SIZE, AWAKEN_MAX_LEVEL, AWAKEN_BOSS_LEVELS, awakenLevelStats, AWAKEN_BOSS_EXTRA_HEALTH, AWAKEN_BOSS_EXTRA_HEALTH_NO_REVIVE, awakenBossExtraHealth, awakenLevelHealthBonus, awakenBossMaxHp, awakenBossCharTypes, awakenEquipmentIds, awakenFloorKey, parseAwakenFloorKey, awakenBossMonsterType, awakenBossMonsterDef, awakenMinionMonsterType, awakenMinionMonsterDef, AWAKEN_BOSSES, awakenBossSpec, awakenBossUltimateDamage, awakenBossSkillDamage, awakenBossAttackDamage, awakenBossSkillHealOnHit, awakenBossBurnTotal, awakenBossAttackHeal, awakenBossUltimateAttackDamage, awakenBossUltimateHealAmount, awakenBossUltimateShield, awakenBossSummonCount, awakenBossSummonHealth, AWAKEN_FRAGMENT_KEY, AWAKEN_GEAR_ITEM_KEY, AWAKEN_FRAGMENT_GOAL, AWAKEN_LEVEL_DROPS, awakenLevelDrop, rollAwakenDrop, awakenGearIdOf, awakenLevelReward, ITEMS, ITEM_KEYS, LEGENDARY_BANNERS, LEGENDARY_BANNER_RATE, LEGENDARY_BANNER_TAKEN_FROM, legendaryGachaTable, legendaryBannerFor, STOCK_ELEMENTS, STOCK_BASE_PRICE, STOCK_EVENTS, computeStockPrice, computeStockPrices, GUEST_ARENA_HALF_W, GUEST_ARENA_HALF_H, GUEST_PARTY_SIZE, GUEST_BOSS_DEFS, guestDefFor, BOSS3_COLOR_HONEST, BOSS3_COLOR_TRICK, BOSS3_PATTERN_DEFS, BOSS3_PHASES, boss3PhaseFor, boss3PatternStat, STORY_TOWER_BOSS_FLOOR, STORY_TOWER_BOSS_MONSTER, LEVEL_START_SLACK, floorAxis, alongOf, acrossOf, fromAlongAcross, clampToLane, pathSegs, pathLength, projectOnPath, pointOnPath, pathTangentAt, laneHalfWidthAt, makePathFloor, LEGEND_STORY_FLOOR_DEFS, LEGEND_PARTY_SIZE, LEGEND_PARTY_SLOT_MAX_GRADE, legendPartySlotAllowsGrade, LEGEND_TOTAL_FLOORS, legendFloorKey, isLegendFloor, LEGEND_CLEAR_REWARDS, legendClearReward, LEGEND_CHEST_REWARDS, legendChestReward, ZOMBIE_GRID_COLS, ZOMBIE_GRID_ROWS, ZOMBIE_CELL_SIZE, ZOMBIE_ARENA_HALF_W, ZOMBIE_ARENA_HALF_H, ZOMBIE_CELL_COUNT, ZOMBIE_BUILD_RANGE_CELLS, ZOMBIE_MAX_TREES, ZOMBIE_TREE_HITS, ZOMBIE_WOOD_PER_HIT, ZOMBIE_TREE_RESPAWN_MS, ZOMBIE_TREE_RADIUS, ZOMBIE_PREP_MS, ZOMBIE_COIN_PER_KILL, ZOMBIE_BUILDABLES, ZOMBIE_MINER_ORE_INTERVAL_MS, ZOMBIE_FURNACE_SMELT_MS, ZOMBIE_HOUSE_HEAL_INTERVAL_MS, ZOMBIE_HOUSE_HEAL_AMOUNT, ZOMBIE_SOLDIER_DEF, ZOMBIE_SOLDIER_SPAWN_MS, ZOMBIE_SOLDIER_CAP_PER_SPAWNER, ZOMBIE_WORKBENCH_ITEMS, zombieUpgradeCost, ZOMBIE_ATK_UPGRADE_AMOUNT, ZOMBIE_FENCE_HP_UPGRADE_AMOUNT, zombieCellIndex, zombieCellColRow, zombieCellCenter, zombieColRowOfPos, zombieCellIndexOfPos, zombieBuildableCellsFrom, ZOMBIE_DEFS, zombieStatsForWave, zombieTypesForWave, zombieCountForWave, zombieRollTypeForWave, zombieWaveReward, CHAR_LEVEL_MAX, CHAR_LEVEL_BASE_EXP, CHAR_LEVEL_EXP_GROWTH, CHAR_LEVEL_STAT_PCT_PER_LEVEL, charLevelExpToNext, charLevelFromExp, charExpOf, charLevelOf, charLevelStatMultiplier, characterWithLevel, EXP_DUNGEON_STAGE_COUNT, EXP_DUNGEON_EXP_BASE, expDungeonExpForStage, expDungeonMonsterType, expDungeonFloorKey, EXP_DUNGEON_FLOOR_DEFS, isExpDungeonFloor, expDungeonStageOfFloor };
} else {
    window.SHARED = { ARENA_RADIUS, BOSS_RADIUS, PLAYER_RADIUS, CHARACTERS, BOSS_DEFS, BOSS_LIST, MONSTER_RADIUS, monsterRadiusOf, SUMMON_RADIUS, STAR_RADIUS, PROJECTILE_RADIUS, PROJECTILE_MAX_LIFETIME_MS, MONSTERS, STORY_FLOOR_DEFS, GACHA_SOUL_STONE_KEY, GACHA_TABLE, DEMON_GACHA_KEY, DEMON_GACHA_RATES, demonGachaTable, EVENTS, EVENT, EVENT_STAGE_DEFS, allEventStages, allEventBosses, allEventPlayable, floorDefFor, isEventStage, SOUL_STONES_PER_CHARACTER, DUPLICATE_CHAR_SOUL_STONES, INSTINCT_MAX_LEVEL, INSTINCT_COSTS, INSTINCT_L1_BONUS_HEALTH, INSTINCT_L1_BONUS_ATTACK, INSTINCT_L2_SKILL_DAMAGE_BONUS, INSTINCT_L2_SKILL_SHIELD_BONUS, INSTINCT_L2_SKILL_HEAL_BONUS, instinctLevelOf, instinctNextCost, instinctStatBonus, characterWithInstinct, instinctCharLevelEffect, instinctCharLevelDesc, CLEAR_REWARDS, storyRewardKey, clearRewardFor, CLEAR_DROPS, clearDropsFor, TOWER_BOSS_EVERY, isTowerBossFloor, legendaryEquipmentIds, towerBossReward, EQUIP_SLOTS, EQUIP_SLOT_KEYS, EQUIPMENT, equipmentFor, ownerBonusActive, awakenGearFor, characterWithGear, equipBonusFor, EQUIP_MAX_LEVEL, EQUIP_BONUS_KEYS, EQUIP_UPGRADE_STEPS, equipUsesRareMaterial, equipUpgradeCost, equipLevelScale, scaledBonus, equipStatsAtLevel, equipEntryOf, GRADE_ORDER, AWAKEN_SLOT, hasAwakenSlot, formStat, reviveCountFor, STORY_PARTY_FROM_FLOOR, STORY_PARTY_SIZE, storyPartySizeFor, AWAKEN_PARTY_SIZE, AWAKEN_MAX_LEVEL, AWAKEN_BOSS_LEVELS, awakenLevelStats, AWAKEN_BOSS_EXTRA_HEALTH, AWAKEN_BOSS_EXTRA_HEALTH_NO_REVIVE, awakenBossExtraHealth, awakenLevelHealthBonus, awakenBossMaxHp, awakenBossCharTypes, awakenEquipmentIds, awakenFloorKey, parseAwakenFloorKey, awakenBossMonsterType, awakenBossMonsterDef, awakenMinionMonsterType, awakenMinionMonsterDef, AWAKEN_BOSSES, awakenBossSpec, awakenBossUltimateDamage, awakenBossSkillDamage, awakenBossAttackDamage, awakenBossSkillHealOnHit, awakenBossBurnTotal, awakenBossAttackHeal, awakenBossUltimateAttackDamage, awakenBossUltimateHealAmount, awakenBossUltimateShield, awakenBossSummonCount, awakenBossSummonHealth, AWAKEN_FRAGMENT_KEY, AWAKEN_GEAR_ITEM_KEY, AWAKEN_FRAGMENT_GOAL, AWAKEN_LEVEL_DROPS, awakenLevelDrop, rollAwakenDrop, awakenGearIdOf, awakenLevelReward, ITEMS, ITEM_KEYS, LEGENDARY_BANNERS, LEGENDARY_BANNER_RATE, LEGENDARY_BANNER_TAKEN_FROM, legendaryGachaTable, legendaryBannerFor, STOCK_ELEMENTS, STOCK_BASE_PRICE, STOCK_EVENTS, computeStockPrice, computeStockPrices, GUEST_ARENA_HALF_W, GUEST_ARENA_HALF_H, GUEST_PARTY_SIZE, GUEST_BOSS_DEFS, guestDefFor, BOSS3_COLOR_HONEST, BOSS3_COLOR_TRICK, BOSS3_PATTERN_DEFS, BOSS3_PHASES, boss3PhaseFor, boss3PatternStat, STORY_TOWER_BOSS_FLOOR, STORY_TOWER_BOSS_MONSTER, LEVEL_START_SLACK, floorAxis, alongOf, acrossOf, fromAlongAcross, clampToLane, pathSegs, pathLength, projectOnPath, pointOnPath, pathTangentAt, laneHalfWidthAt, makePathFloor, LEGEND_STORY_FLOOR_DEFS, LEGEND_PARTY_SIZE, LEGEND_PARTY_SLOT_MAX_GRADE, legendPartySlotAllowsGrade, LEGEND_TOTAL_FLOORS, legendFloorKey, isLegendFloor, LEGEND_CLEAR_REWARDS, legendClearReward, LEGEND_CHEST_REWARDS, legendChestReward, ZOMBIE_GRID_COLS, ZOMBIE_GRID_ROWS, ZOMBIE_CELL_SIZE, ZOMBIE_ARENA_HALF_W, ZOMBIE_ARENA_HALF_H, ZOMBIE_CELL_COUNT, ZOMBIE_BUILD_RANGE_CELLS, ZOMBIE_MAX_TREES, ZOMBIE_TREE_HITS, ZOMBIE_WOOD_PER_HIT, ZOMBIE_TREE_RESPAWN_MS, ZOMBIE_TREE_RADIUS, ZOMBIE_PREP_MS, ZOMBIE_COIN_PER_KILL, ZOMBIE_BUILDABLES, ZOMBIE_MINER_ORE_INTERVAL_MS, ZOMBIE_FURNACE_SMELT_MS, ZOMBIE_HOUSE_HEAL_INTERVAL_MS, ZOMBIE_HOUSE_HEAL_AMOUNT, ZOMBIE_SOLDIER_DEF, ZOMBIE_SOLDIER_SPAWN_MS, ZOMBIE_SOLDIER_CAP_PER_SPAWNER, ZOMBIE_WORKBENCH_ITEMS, zombieUpgradeCost, ZOMBIE_ATK_UPGRADE_AMOUNT, ZOMBIE_FENCE_HP_UPGRADE_AMOUNT, zombieCellIndex, zombieCellColRow, zombieCellCenter, zombieColRowOfPos, zombieCellIndexOfPos, zombieBuildableCellsFrom, ZOMBIE_DEFS, zombieStatsForWave, zombieTypesForWave, zombieCountForWave, zombieRollTypeForWave, zombieWaveReward, CHAR_LEVEL_MAX, CHAR_LEVEL_BASE_EXP, CHAR_LEVEL_EXP_GROWTH, CHAR_LEVEL_STAT_PCT_PER_LEVEL, charLevelExpToNext, charLevelFromExp, charExpOf, charLevelOf, charLevelStatMultiplier, characterWithLevel, EXP_DUNGEON_STAGE_COUNT, EXP_DUNGEON_EXP_BASE, expDungeonExpForStage, expDungeonMonsterType, expDungeonFloorKey, EXP_DUNGEON_FLOOR_DEFS, isExpDungeonFloor, expDungeonStageOfFloor };
}
