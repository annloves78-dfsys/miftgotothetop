const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const { ARENA_RADIUS, BOSS_RADIUS, PLAYER_RADIUS, CHARACTERS, BOSS_DEFS, MONSTER_RADIUS, monsterRadiusOf, SUMMON_RADIUS, STAR_RADIUS, PROJECTILE_RADIUS, PROJECTILE_MAX_LIFETIME_MS, MONSTERS, floorDefFor,
    LEVEL_START_SLACK, alongOf, acrossOf, fromAlongAcross, clampToLane, laneHalfWidthAt,
    GUEST_ARENA_HALF_W, GUEST_ARENA_HALF_H, GUEST_PARTY_SIZE, GUEST_BOSS_DEFS, guestDefFor,
    equipBonusFor, formStat, reviveCountFor, characterWithGear, awakenGearFor,
    instinctStatBonus, characterWithInstinct, characterWithLevel,
    awakenFloorKey, AWAKEN_PARTY_SIZE, storyPartySizeFor, AWAKEN_BOSS_LEVELS,
    awakenBossSkillDamage, awakenBossSkillHealOnHit, awakenBossUltimateDamage,
    awakenBossUltimateAttackDamage, awakenBossUltimateHealAmount, awakenBossUltimateShield,
    awakenBossSummonCount, awakenBossSummonHealth, awakenMinionMonsterType,
    boss3PhaseFor, boss3PatternStat,
    ZOMBIE_GRID_COLS, ZOMBIE_GRID_ROWS, ZOMBIE_CELL_SIZE, ZOMBIE_ARENA_HALF_W, ZOMBIE_ARENA_HALF_H,
    ZOMBIE_CELL_COUNT, ZOMBIE_BUILD_RANGE_CELLS, ZOMBIE_MAX_TREES,
    ZOMBIE_TREE_HITS, ZOMBIE_WOOD_PER_HIT, ZOMBIE_TREE_RESPAWN_MS, ZOMBIE_TREE_RADIUS, ZOMBIE_PREP_MS,
    ZOMBIE_COIN_PER_KILL, ZOMBIE_BUILDABLES, ZOMBIE_WORKBENCH_ITEMS, ZOMBIE_MINER_ORE_INTERVAL_MS,
    ZOMBIE_FURNACE_SMELT_MS, ZOMBIE_HOUSE_HEAL_INTERVAL_MS, ZOMBIE_HOUSE_HEAL_AMOUNT,
    ZOMBIE_SOLDIER_DEF, ZOMBIE_SOLDIER_SPAWN_MS, ZOMBIE_SOLDIER_CAP_PER_SPAWNER,
    zombieUpgradeCost, ZOMBIE_ATK_UPGRADE_AMOUNT, ZOMBIE_FENCE_HP_UPGRADE_AMOUNT, zombieCellIndex, zombieCellColRow,
    zombieCellCenter, zombieColRowOfPos, zombieCellIndexOfPos, zombieBuildableCellsFrom,
    ZOMBIE_DEFS, zombieStatsForWave, zombieCountForWave, zombieRollTypeForWave,
    zombieWaveReward } = require('./public/js/shared.js');

app.use(express.static(path.join(__dirname, 'public')));

// 관리자 콘솔은 게임과 완전히 분리된 페이지라 /admin 링크로 따로 엽니다.
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// rooms[roomId] = {
//   bossId, state: 'waiting'|'fighting'|'ended',
//   players: { [socketId]: { x, y, hp, maxHp, charType, facing, alive, lastAttackTime, lastSkillTime, lastUltimateTime, attackHealBoostUntil, guardStanceUntil, awakenUntil, elementMarkUntil, punchSequence, rapidStrikeUntil, rapidAttackCount } },
//   bossHp, bossMaxHp, bossState: 'idle'|'telegraph'|'active',
//   bossPattern, bossPatternStartAt, bossPatternRuntime, nextAttackAt, loopHandle, activeBuffs
// }
const rooms = {};

// 친구 탭의 "친구보기": 게임 방(rooms)과 별개로, 지금 이 화면을 보고 있는
// 소켓들만 모아 두는 전역 상태. 로그인 계정만 참여하며(userId = br_users.id),
// 서버 재시작 시 사라져도 되는 순수 실시간 데이터라 DB에 저장하지 않는다.
const friendsBrowsing = {}; // socket.id -> { userId, nickname, charType }
function broadcastFriendsBrowsing() {
    const list = Object.values(friendsBrowsing);
    for (const id of Object.keys(friendsBrowsing)) {
        io.to(id).emit('friendsBrowseList', list);
    }
}

// 친구 대결(PvP) 신청 수락 시, 신청 보낸 사람이 지금 어느 화면에 있든
// 매치에 불러오기 위한 "로그인 계정 -> 지금 연결된 소켓" 전역 등록.
// friendsBrowsing과 달리 친구보기 탭을 열지 않아도, 로그인만 하면 채워진다.
// 서버 재시작 시 사라져도 되는 순수 실시간 데이터라 DB에 저장하지 않는다.
const onlineUsers = {}; // userId -> { socketId, nickname, charType, equip, instinct, charLevel }

function randomRest(bossDef) {
    const [min, max] = bossDef.restMsRange;
    return min + Math.random() * (max - min);
}

function spawnPosition(slotIndex) {
    return slotIndex === 0 ? { x: -120, y: 180 } : { x: 120, y: 180 };
}

// Boss is always fixed at the arena origin (0,0). A "line kick" hits if the
// boss falls within a straight corridor (length=range, half-width=width/2)
// extending from the player toward wherever their mouse is aiming
// (facingAngle, in radians).
function meleeLineHit(px, py, facingAngle, range, width, targetRadius) {
    if (typeof facingAngle !== 'number' || !Number.isFinite(facingAngle)) return false;
    const dx = Math.cos(facingAngle), dy = Math.sin(facingAngle);
    const vx = -px, vy = -py; // vector from player to boss center
    const proj = vx * dx + vy * dy; // distance along the facing axis
    if (proj < -targetRadius || proj > range + targetRadius) return false;
    const perp = Math.abs(vx * dy - vy * dx); // distance off the facing axis
    return perp <= (width / 2 + targetRadius);
}

// Locks onto wherever a random alive player is standing right now; used by
// target-facing boss patterns (spear_thrust, spear_sweep).
function pickTargetAngle(room) {
    const alivePlayers = Object.values(room.players).filter(pl => pl.alive);
    if (!alivePlayers.length) return 0;
    const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    return Math.atan2(target.y, target.x);
}

// Same idea but returns a world position, for patterns that drop something
// at a spot (star_drop) rather than firing along a direction.
function pickTargetPosition(room) {
    const alivePlayers = Object.values(room.players).filter(pl => pl.alive);
    if (!alivePlayers.length) return { x: 0, y: 0 };
    const target = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    return { x: target.x, y: target.y };
}

// 본능해제로 붙는 시간형 패시브(예: 자두맛 5강 체력 재생). character.passiveRegenAmount/
// passiveRegenTickMs가 있는 플레이어만 대상이고, p.instinctRegenNextAt에 다음 회복
// 시각을 들고 있다가 지나면 회복시키고 다음 틱을 예약한다. 좀비막기는 캐릭터
// 고유 능력을 아예 재현하지 않는 모드라 이 훅을 부르지 않는다.
function tickInstinctPassiveRegen(room, roomId, now, healedEvent) {
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive) continue;
        const character = charOf(p);
        if (!character || !character.passiveRegenAmount || !character.passiveRegenTickMs) {
            p.instinctRegenNextAt = 0; // 강화를 내려도(또는 캐릭터를 바꿔도) 다음번엔 새로 잰다
            continue;
        }
        if (!p.instinctRegenNextAt) { p.instinctRegenNextAt = now + character.passiveRegenTickMs; continue; }
        if (now < p.instinctRegenNextAt) continue;
        p.instinctRegenNextAt += character.passiveRegenTickMs;
        const healed = Math.min(p.maxHp, p.hp + character.passiveRegenAmount);
        if (healed !== p.hp) {
            p.hp = healed;
            io.to(roomId).emit(healedEvent, { id, hp: p.hp });
        }
    }
}

function healTeam(room, roomId, amount) {
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive) continue;
        const healed = Math.min(p.maxHp, p.hp + amount);
        if (healed !== p.hp) {
            p.hp = healed;
            io.to(roomId).emit('playerHealed', { id, hp: p.hp });
        }
    }
}

// 바람궁수맛 궁극기 3단계 (보스 레이드): 죽은 사람이 있으면 부활시키고,
// 없으면 마법진을 열어 팀을 꽉 채우고 보스 체력을 깎는다. 보스 레이드는
// 파티가 없어 플레이어 한 명 = 캐릭터 한 명이라 alive만 보면 된다.
function reviveDownedPlayer(roomId, room, character) {
    const entry = Object.entries(room.players).find(([, pl]) => !pl.alive);
    if (!entry) return false;
    const [id, pl] = entry;
    pl.hp = Math.max(1, Math.round(pl.maxHp * (character.ultimateReviveHpRatio || 1)));
    pl.alive = true;
    io.to(roomId).emit('playerRevived', { id, hp: pl.hp });
    return true;
}
function natureSanctuary(roomId, room, character) {
    healTeam(room, roomId, Infinity);
    const ratio = character.ultimateSanctuaryEnemyDamageRatio || 0;
    if (ratio && room.bossHp > 0) {
        const dmg = Math.max(1, Math.round(room.bossHp * ratio));
        room.bossHp = Math.max(0, room.bossHp - dmg);
        io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp });
        if (room.bossHp <= 0) endRoom(roomId, 'win');
    }
}

function shieldTeam(room, roomId, amount) {
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive) continue;
        p.shieldHp = amount;
        io.to(roomId).emit('playerShielded', { id, shieldHp: p.shieldHp });
    }
}

// shieldTeam은 덮어쓴다(궁극기용 -- 한 번에 큰 값으로 갈아 끼우는 게 맞다).
// 암흑바다맛처럼 기본 공격이 적중할 때마다 조금씩 주는 보호막은 덮어쓰면
// 안 된다 -- 궁극기로 150을 씌운 바로 다음 공격이 3으로 깎아 버리게 된다.
// 그래서 이건 따로 더한다.
function addShieldTeam(room, roomId, amount) {
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive) continue;
        p.shieldHp = (p.shieldHp || 0) + amount;
        io.to(roomId).emit('playerShielded', { id, shieldHp: p.shieldHp });
    }
}

function publicPlayers(room) {
    const out = {};
    for (const [id, p] of Object.entries(room.players)) {
        out[id] = { x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, charType: p.charType, facing: p.facing, alive: p.alive, ready: !!p.ready, shieldHp: p.shieldHp || 0, untouchableUntil: p.untouchableUntil || 0 };
    }
    return out;
}

function findOpenRoom(bossId) {
    for (const [roomId, room] of Object.entries(rooms)) {
        if (room.bossId === bossId && room.state === 'waiting' && !room.solo && Object.keys(room.players).length < 2) {
            return roomId;
        }
    }
    return null;
}

function createRoom(bossId, solo) {
    const roomId = `${bossId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    rooms[roomId] = {
        bossId,
        solo: !!solo, // solo rooms are never matched into by findOpenRoom
        state: 'waiting',
        players: {},
        bossHp: 0,
        bossMaxHp: 0,
        bossState: 'idle',
        playerProjectiles: {}, // id -> thrown drop in flight; see spawnPlayerProjectile
        nextPlayerProjectileId: 0,
        bossPattern: null,
        bossPatternStartAt: 0,
        bossPatternRuntime: null,
        nextAttackAt: 0,
        loopHandle: null
    };
    return roomId;
}

function endRoom(roomId, result) {
    const room = rooms[roomId];
    if (!room) return;
    if (room.loopHandle) clearInterval(room.loopHandle);
    room.state = 'ended';
    io.to(roomId).emit('raidResult', { result });
    delete rooms[roomId];
}

// ---- 장비 ----
// 클라이언트는 장착한 장비 **id**만 보낸다. 수치는 여기서 shared.js의 표를
// 보고 직접 계산하므로, 클라이언트가 능력치를 지어내서 보내도 소용이 없다.
// 없는 id나 슬롯이 안 맞는 id는 equipBonusFor가 그냥 무시한다.
const AWAKEN_SWAP_COOLDOWN_MS = 1500; // 각성모드 자유 교체 쿨타임
const NO_EQUIP_BONUS = { attack: 0, health: 0, speed: 0, damageTaken: 1, cooldown: 1 };
// instinctLevel(본능해제 레벨)의 1강 몫(체력/공격력)은 장비 보너스와 같은 자리에
// 더해서 쓴다 -- 장비처럼 그 즉시 읽는 모든 곳에서 자동으로 반영된다.
function bonusFrom(equip, charType, instinctLevel) {
    const base = (!equip || typeof equip !== 'object') ? { ...NO_EQUIP_BONUS } : equipBonusFor(equip, charType);
    const inst = instinctStatBonus(instinctLevel, charType);
    base.health += inst.health;
    base.attack += inst.attack;
    return base;
}
function bonusOf(p) { return (p && p.bonus) || NO_EQUIP_BONUS; }

// 각성 장비를 낀 쿠키는 발차기 피해나 궁극기 보호막처럼 "더하기"로 표현할 수
// 없는 수치가 통째로 바뀐다. 방에 들어올 때 합쳐 둔 사본을 p.character에
// 넣어 두고, 그 뒤로는 CHARACTERS를 직접 읽지 않고 늘 이것을 읽는다.
// 본능해제 2강(스킬 강화)도 같은 사본에 얹는다 -- character.skillDamage 등을
// 읽는 수십 군데 코드를 하나도 안 건드리고 이 한 자리에서만 반영하기 위해서다.
function charFrom(charType, equip, instinctLevel, charLevel) {
    const resolved = CHARACTERS[charType] ? charType : 'kicker';
    const withGear = characterWithGear(resolved, (equip && typeof equip === 'object') ? equip : null);
    const withInstinct = characterWithInstinct(withGear, instinctLevel, resolved);
    return characterWithLevel(withInstinct, charLevel);
}
// 층 이벤트: floorDef.charEventMultiplier가 있으면 그 층에 들어오는 캐릭터의
// 공격력/체력에 곱한다 (지하 2층: 레드 드레곤 폭주에 눌려 다들 약해지고,
// 레드 드레곤맛 쿠키만 오히려 강해지는 이벤트). charFrom은 각성 장비가 없을
// 때 CHARACTERS의 원본 참조를 그대로 돌려줄 수 있어서, 여기서 항상 새
// 객체를 만들어 원본을 건드리지 않는다.
function applyFloorCharEvent(character, charType, floorDef) {
    const ev = floorDef && floorDef.charEventMultiplier;
    if (!ev) return character;
    const mult = (ev.overrides && ev.overrides[charType]) || ev.default;
    if (!mult) return character;
    return {
        ...character,
        health: mult.health != null ? character.health * mult.health : character.health,
        attackDamage: mult.attackDamage != null ? character.attackDamage * mult.attackDamage : character.attackDamage
    };
}
function gearFrom(charType, equip) {
    if (!CHARACTERS[charType] || !equip || typeof equip !== 'object') return null;
    return awakenGearFor(charType, equip);
}
function charOf(p) {
    if (p && p.character) return p.character;
    return (p && CHARACTERS[p.charType]) || null;
}

// 각성한 쿠키는 몇몇 수치가 통째로 바뀜다. 지금 각성 상태인지는 p가 들고 있다.
function stat(character, p, key) { return formStat(character, !!(p && p.awakened), key); }

// 장비의 재사용 대기시간 감소는 스킬과 궁극기에만 붙는다 (기본공격은 그대로).
function skillCooldownFor(character, p) {
    return character.skillCooldown * bonusOf(p).cooldown;
}
function ultimateCooldownFor(character, p) {
    return character.ultimateCooldownMs * bonusOf(p).cooldown;
}

// Shield-cookie defensive buffs (guard_stance skill, awakening ultimate) both
// cut incoming damage the same amount; if both happen to be active at once
// this intentionally doesn't stack, it just stays at the one multiplier.
// sourceElementMark is whatever mark (if any) the current damage source
// (the boss, or the specific monster attacking) is currently carrying --
// board's passive reduces damage taken from a source marked with its element.
function damageReductionMultiplier(character, p, now, sourceElementMark) {
    // 바다 수호자맛 특수스킬(바다로 들어가기): 숨어 있는 동안은 무슨 공격이든
    // 아예 안 맞는다. 보스레이드는 패턴마다 손으로 짠 타격 판정이 흩어져
    // 있어(각 패턴 루프가 room.players를 직접 훑는다) 하나하나 다 고치는 대신,
    // 세 모드가 전부 거쳐 가는 이 최종 피해 배수 계산 한 곳에서 0으로 눌러
    // 막는다.
    if (p.untouchableUntil && now < p.untouchableUntil) return 0;
    // guard_stance and shield_block share the timer field; they differ only in
    // that guard_stance ends early when its owner attacks.
    if ((character.skillType === 'guard_stance' || character.skillType === 'shield_block')
        && p.guardStanceUntil && now < p.guardStanceUntil) {
        return character.skillDamageMultiplier * bonusOf(p).damageTaken;
    }
    if (character.ultimateType === 'awakening' && p.awakenUntil && now < p.awakenUntil) {
        return character.ultimateDamageMultiplier * bonusOf(p).damageTaken;
    }
    if (character.passiveResistElement && sourceElementMark && sourceElementMark.element === character.passiveResistElement) {
        return character.passiveResistMultiplier * bonusOf(p).damageTaken;
    }
    // Always-on passive (블랙 슈거맛): no window to time, it just applies.
    if (character.passiveDamageMultiplier) return character.passiveDamageMultiplier * bonusOf(p).damageTaken;
    return bonusOf(p).damageTaken;
}

// 지옥맛 패시브 2부: 기본공격으로 적을 죽일 때마다 15초짜리 스택을 하나
// 쌓는다. 스택마다 자기 만료 시각을 따로 들고 있어서, 죽인 지 오래된 것부터
// 저절로 빠진다 -- 상한은 없다.
function gainKillBuffStack(character, p, killed, now) {
    if (!killed || !character.passiveKillAttackBuff) return;
    p.killBuffStacks = (p.killBuffStacks || []).filter(exp => exp > now);
    p.killBuffStacks.push(now + character.passiveKillAttackBuffDurationMs);
}
function killBuffBonus(character, p, now) {
    if (!character.passiveKillAttackBuff || !p.killBuffStacks || !p.killBuffStacks.length) return 0;
    p.killBuffStacks = p.killBuffStacks.filter(exp => exp > now);
    return p.killBuffStacks.length * character.passiveKillAttackBuff;
}
// 지옥맛 궁극기(하늘낙하)가 적중했을 때 잠깐 붙는 공격력 보너스.
function ultimateOnHitBuff(character, p, now) {
    if (character.ultimateType === 'sky_slam' && p.skySlamBuffUntil && now < p.skySlamBuffUntil) {
        return character.ultimateAttackBuff || 0;
    }
    return 0;
}

// 불꽃요정맛 각성 장비(타오르는 강판) 전용: 부활 횟수가
// passiveReviveAttackBonusAtRevives에 닿으면(3번째 부활부터) 기본공격력이
// 영구히 오른다. 장비가 없으면 이 필드 자체가 없어서 항상 0이다.
function reviveAttackBonus(character, p) {
    const at = character.passiveReviveAttackBonusAtRevives;
    if (!at) return 0;
    return (p && p.revivesUsed || 0) >= at ? (character.passiveReviveAttackBonus || 0) : 0;
}

// awakening temporarily replaces the basic attack's damage; every other
// character just uses their flat attackDamage.
function effectiveAttackDamage(character, p, now) {
    let base;
    if (character.ultimateType === 'awakening' && p.awakenUntil && now < p.awakenUntil && character.ultimateAttackDamage != null) {
        // 체리크림맛: "극대노"(ultimateRageChance)로 걸렸으면 더 센 수치를 쓴다.
        const dmg = (character.ultimateRageChance != null && p.awakenRaged)
            ? character.ultimateRageAttackDamage : character.ultimateAttackDamage;
        base = dmg + bonusOf(p).attack;
    } else if (character.ultimateType === 'undying_soul' && p.undyingSoulUntil && now < p.undyingSoulUntil
        && character.ultimateAttackDamage != null) {
        // undying_soul (lightninghell) swaps in a bigger basic attack the same way.
        base = character.ultimateAttackDamage + bonusOf(p).attack;
    } else if (butterflyActive(character, p)) {
        // 나비모드 has no end time -- it is on until it is switched off.
        base = character.ultimateAttackDamage + bonusOf(p).attack;
    } else if (character.skillType === 'body_swap') {
        // 전기줄맛: 상체/하체/합체 중 어느 몸인지에 따라 공격력이 다르다.
        base = bodyFormAttackDamage(character, p) + bonusOf(p).attack;
    } else if (character.lowHpAt && p.lowHpOn && character.lowHpAttackDamage != null) {
        // 바다펄맛: 체력이 바닥나 있는 동안에는 주먹이 약해진다 (대신 때릴 때마다
        // 스스로 회복한다 -- lowHpSelfHeal 참고).
        base = character.lowHpAttackDamage + bonusOf(p).attack;
    } else if (character.ultimateType === 'awakening_rapid' && character.instinctUltimateRapidAttackBonus
        && p.rapidStrikeUntil && now < p.rapidStrikeUntil) {
        // 본능해제 3강(버블티맛): 무한(연사) 상태인 동안 기본 공격 피해가 오른다.
        base = stat(character, p, 'attackDamage') + character.instinctUltimateRapidAttackBonus + bonusOf(p).attack;
    } else {
        base = stat(character, p, 'attackDamage') + bonusOf(p).attack;
    }
    const total = base + killBuffBonus(character, p, now) + ultimateOnHitBuff(character, p, now) + reviveAttackBonus(character, p);
    // 치즈케이크맛 특수스킬(팀 공격력 배수 버프)처럼 배수로 올리는 버프를
    // 위한 범용 훅. p.attackMultiplierUntil/Value를 세팅하는 캐릭터라면
    // 누구나(어느 모드든) 그대로 재사용 가능하다.
    if (p.attackMultiplierUntil && now < p.attackMultiplierUntil) {
        return Math.round(total * (p.attackMultiplierValue || 1));
    }
    return total;
}

// 바다펄맛: 약해진 주먹이 적중할 때마다 스스로 회복하는 양.
function lowHpSelfHeal(character, p) {
    if (!character.lowHpAt || !p.lowHpOn) return 0;
    return character.lowHpAttackHealSelf || 0;
}

// ==================== 전기줄맛: 상체/하체/합체 ====================
// 몸이 둘이라 hp/maxHp 하나로는 못 나타낸다. p.bodyForm('upper'|'lower',
// undefined도 'upper')이 지금 나온 몸, p.restingHp가 반대쪽 몸이 쉬는 동안
// 들고 있는 체력(null/undefined = 아직 한 번도 안 나와서 풀피), p.fused +
// p.fusedUntil이 합체 상태다. p.hp/p.maxHp는 항상 "지금 상태의" 값을
// 그대로 담고 있어서 다른 공용 코드(피해·회복·표시)가 손댈 게 없다.
function bodyFormAttackDamage(character, p) {
    if (p.fused) return character.ultimateAttackDamage;
    return (p.bodyForm || 'upper') === 'lower' ? character.lowerAttackDamage : character.upperAttackDamage;
}

// 파티 슬롯(11층+ · 각성모드 · 게스트 레이드)에 있을 때도 p.hp/p.maxHp가
// 지금 나온 슬롯을 그대로 비추므로 같은 필드를 쓰면 되지만, 파티 쪽 배열
// (partyHp/partyMaxHp)도 같이 맞춰 둬야 교체 줄 UI와 팀 회복이 어긋나지 않는다.
function syncBodyFormToParty(p) {
    if (p.party && p.partyHp && p.partyMaxHp) {
        p.partyHp[p.active] = p.hp;
        p.partyMaxHp[p.active] = p.maxHp;
    }
}

// 벤치에서 쉬다가(파티 교체로) 다시 나오면 늘 상체·풀피로 시작한다. 하체나
// 합체 상태를 파티 슬롯 사이로 들고 다니지 않는다 -- activatePartyCookie /
// activateGuestSlot이 다음 슬롯을 세운 직후에 호출한다.
function resetBodyFormIfNeeded(p) {
    const character = p.character;
    if (!character || character.skillType !== 'body_swap') return;
    const upperMax = character.upperHealth + bonusOf(p).health;
    p.bodyForm = 'upper';
    p.fused = false;
    p.fusedUntil = 0;
    p.restingHp = null;
    p.hp = upperMax;
    p.maxHp = upperMax;
    syncBodyFormToParty(p);
}

// 합체 10초가 다 되면 자동으로 풀린다. 매 틱 이 함수를 부른다.
function tickBodyFusion(room, roomId, now, ev, healedEvent) {
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive || !p.fused) continue;
        const character = charOf(p);
        if (!character || character.ultimateType !== 'body_fuse') continue;
        if (now < p.fusedUntil) {
            // 본능해제 4강(전기줄맛): 합체 중 일정 간격으로 체력을 재생한다.
            if (character.instinctFusedRegenAmount && character.instinctFusedRegenTickMs) {
                if (!p.fusedRegenNextAt) {
                    p.fusedRegenNextAt = now + character.instinctFusedRegenTickMs;
                } else if (now >= p.fusedRegenNextAt) {
                    p.fusedRegenNextAt += character.instinctFusedRegenTickMs;
                    const healed = Math.min(p.maxHp, p.hp + character.instinctFusedRegenAmount);
                    if (healed !== p.hp) {
                        p.hp = healed;
                        syncBodyFormToParty(p);
                        const payload = { id, hp: p.hp };
                        if (p.party && p.partyHp) payload.partyHp = p.partyHp;
                        io.to(roomId).emit(healedEvent, payload);
                    }
                }
            }
            continue;
        }
        p.fusedRegenNextAt = 0;
        const upperMax = character.upperHealth + bonusOf(p).health;
        p.fused = false;
        p.fusedUntil = 0;
        p.bodyForm = 'upper';
        p.restingHp = null; // 하체도 다시 풀피로 -- 합체가 풀리며 둘 다 새로 태어난다
        p.hp = upperMax;
        p.maxHp = upperMax;
        syncBodyFormToParty(p);
        const payload = { id, form: 'upper', hp: p.hp, maxHp: p.maxHp };
        if (p.party && p.partyHp) { payload.partyHp = p.partyHp; payload.partyMaxHp = p.partyMaxHp; }
        io.to(roomId).emit(ev, payload);
    }
}

// 나비모드 (sugarfly): a toggle rather than a timer, so it is checked by a
// flag instead of an "until" stamp.
function butterflyActive(character, p) {
    return character.ultimateType === 'butterfly_mode' && !!p.butterflyOn;
}

// Runs the self-damage clock for anyone currently in 나비모드. `hurt` applies
// one tick of damage the way that room kind does it.
function tickButterflyMode(room, now, hurt) {
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive || !p.butterflyOn) continue;
        const character = charOf(p);
        if (!character || character.ultimateType !== 'butterfly_mode') continue;
        if (now - (p.butterflyLastTickAt || 0) < character.ultimateSelfDamageIntervalMs) continue;
        p.butterflyLastTickAt = now;
        hurt(id, p, character.ultimateSelfDamage);
    }
}

// Pressing the ultimate again turns 나비모드 off; the 30s cooldown only starts
// from that moment, which is why lastUltimateTime is stamped here and not on
// activation. Returns true if this press was a switch-off.
function toggleButterflyMode(character, p, now) {
    if (character.ultimateType !== 'butterfly_mode') return false;
    if (p.butterflyOn) {
        p.butterflyOn = false;
        p.lastUltimateTime = now; // cooldown counts from release
        return true;
    }
    p.butterflyOn = true;
    p.butterflyLastTickAt = now;
    p.lastUltimateTime = Infinity; // can't be recast while it is running
    return false;
}

// 슈가 플라이맛's passive: every Nth landed hit heals the cookie itself.
// Returns how much to heal (0 most swings).
// 번개악마맛: 적중할 때마다 확률적으로 최대 체력의 일부를 회복한다.
function passiveChanceHeal(character, p, swing) {
    let heal = 0;
    if (character.passiveHitHealChance && Math.random() < character.passiveHitHealChance) {
        heal += Math.round(p.maxHp * character.passiveHitHealRatio);
    }
    return heal;
}

// 흡혈은 그 베기로 적을 쓰러뜨려야 채워진다. 다만 차례를 세지는 않는다 --
// 번개악마맛의 모든 베기가 흡혈 베기다. 몬스터든 보스든 규칙은 같다.
function vampireKillHeal(character, p, swing, killed) {
    if (!killed || !swing || !swing.vampire || !character.attackVampireHealRatio) return 0;
    return Math.round(p.maxHp * character.attackVampireHealRatio);
}

// ---- 바다펄맛 쿠키 ----
// 패시브: 체력이 lowHpAt 아래로 떨어지면 켜지고, 체력이 꽉 찰 때까지 유지된다.
// 켜져 있는 동안 주먹이 약해지는 대신 때릴 때마다 스스로 회복한다.
// 체력이 바뀔 때마다(맞을 때, 회복할 때) 이 함수를 불러 상태를 갱신한다.
function refreshLowHpMode(character, p) {
    if (!character || !character.lowHpAt) return false;
    if (p.hp <= 0) { p.lowHpOn = false; return false; }
    if (p.hp >= p.maxHp) p.lowHpOn = false;
    else if (p.hp <= character.lowHpAt) p.lowHpOn = true;
    return !!p.lowHpOn;
}

// 밀물: 지금 쓸 단계. 없으면 null.
function tideStageOf(character, p) {
    const stages = character && character.skillStages;
    if (!stages || !stages.length) return null;
    return stages[Math.min(p.tideStage || 0, stages.length - 1)] || null;
}

// 다음에 쓸 단계를 정한다. 공격이 있는 단계를 빗나갔으면 곧바로 1단계로
// 되돌아간다 -- 그래서 4단계는 2·3단계를 둘 다 맞혔을 때만 나온다.
function advanceTideStage(character, p, hit) {
    const stages = (character && character.skillStages) || [];
    if (!stages.length) return;
    const idx = Math.min(p.tideStage || 0, stages.length - 1);
    const missed = !!stages[idx].damageRatio && !hit;
    p.tideStage = (missed || idx >= stages.length - 1) ? 0 : idx + 1;
}

// 회복량은 받는 쿠키의 최대 체력 비율이다.
function tideHealFor(stage, maxHp) {
    return Math.round((maxHp || 0) * (stage.healRatio || 0));
}

// 맞은 적이 '지금 가진' 체력의 비율만큼 깎는다. 그래서 이 기술만으로는
// 절대 마지막 한 대를 넣지 못한다.
function tideDamageFor(stage, currentHp) {
    return Math.max(1, Math.round((currentHp || 0) * (stage.damageRatio || 0)));
}

// 크게베기는 베기 전에 짧게 예열한다. 방에 남아 있을 때만 터지게 하기 위해
// 매번 룸과 플레이어가 아직 있는지 다시 확인한다.
function afterWindup(roomId, playerId, windupMs, run) {
    setTimeout(() => {
        const room = rooms[roomId];
        if (!room || room.state !== 'fighting') return;
        const p = room.players[playerId];
        if (!p || !p.alive) return;
        run(room, p);
    }, windupMs || 0);
}

// 순간이동은 자기 최대 체력의 일정 비율을 채운다. 각성하면 비율이 올라간다.
function healSelfBySkill(character, p, announce) {
    if (!character.skillHealRatio) return;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * stat(character, p, 'skillHealRatio')));
    if (p.hp !== before) announce();
}

function passiveHitHeal(character, p) {
    if (!character.attackHealEveryHits) return 0;
    p.hitStreak = (p.hitStreak || 0) + 1;
    if (p.hitStreak % character.attackHealEveryHits !== 0) return 0;
    return character.attackHealSelf || 0;
}

// 파핑캔디맛 전용 탄창 게이트. attackAmmoMax가 있는 캐릭터만 해당하고, 나머지는
// 항상 true(그냥 통과)다. 재장전 중이면 못 쏘고, 마지막 발을 쏘면 자동으로
// attackReloadMs짜리 재장전이 시작된다. 클라이언트도 같은 규칙(clientConsumeAmmo,
// main.js)으로 미리 예측해서 HUD에 보여주지만, 실제 판정은 여기서만 한다.
function consumeAmmoOrBlock(character, p, now) {
    if (!character.attackAmmoMax) return true;
    if (p.reloadUntil && now < p.reloadUntil) return false;
    // 재장전이 막 끝났으면(reloadUntil이 있었는데 지금은 지났으면) 여기서
    // 다시 꽉 채운다 -- ammoLeft가 이미 0이라 아래 null 체크만으로는 절대
    // 채워지지 않아서, 재장전 끝나고 쏘면 그대로 또 재장전 걸리는 버그가 있었다.
    if (p.reloadUntil && now >= p.reloadUntil) {
        p.ammoLeft = character.attackAmmoMax;
        p.reloadUntil = 0;
    } else if (p.ammoLeft == null || p.ammoLeft > character.attackAmmoMax) {
        p.ammoLeft = character.attackAmmoMax;
    }
    p.ammoLeft -= 1;
    if (p.ammoLeft <= 0) {
        p.ammoLeft = 0;
        p.reloadUntil = now + (character.attackReloadMs || 3000);
    }
    return true;
}

// p.rapidStrikeUntil is only ever set by the awakening_rapid (orangelemon)
// and nature_awaken (바람궁수맛 1·2단계) ultimate handlers, so the timer alone
// is enough -- no need to also check which ultimateType set it.
function rapidStrikeActive(character, p, now) {
    return !!p.rapidStrikeUntil && now < p.rapidStrikeUntil;
}

// 바람궁수맛 궁극기: 쓸 때마다 1→2→3단계, 그다음 다시 1단계로 순환한다
// (p.natureAwakenLevel은 "다음에 쓸 단계"를 0-indexed로 담는다: 0=1단계,
// 1=2단계, 2=3단계). 1·2단계는 rapidStrikeUntil을 공유해 무한 연사가
// 되고, 2단계는 그 위에 이동속도(moveSpeedFor의 natureBoostUntil)와
// 적중마다 팀 회복(attackHealBoostUntil/ultimateHealPerAttack)이 더 붙는다.
// 3단계는 버프가 아니라 즉시 발동이라 모드별 핸들러에서 따로 처리한다.
function natureAwakenLevelOf(p) {
    return (p.natureAwakenLevel || 0) % 3;
}
function advanceNatureAwakenLevel(p) {
    p.natureAwakenLevel = ((p.natureAwakenLevel || 0) + 1) % 3;
}
function applyNatureAwakenBuff(p, character, now, level) {
    p.rapidStrikeUntil = now + character.ultimateDurationMs;
    p.rapidAttackCount = 0;
    if (level === 1) {
        p.natureBoostUntil = now + character.ultimateDurationMs;
        p.attackHealBoostUntil = now + character.ultimateDurationMs;
    }
}

// alternating_punch (orangelemon): right/left punches alternate in damage;
// while rapid strike is active, every ultimateAutoKickEvery-th attack
// (counted fresh from activation) becomes the kick instead.
function resolveAlternatingPunchDamage(character, p, rapid) {
    if (rapid) {
        p.rapidAttackCount = (p.rapidAttackCount || 0) + 1;
        if (p.rapidAttackCount % character.ultimateAutoKickEvery === 0) {
            return character.skillDamage;
        }
    }
    p.punchSequence = (p.punchSequence || 0) + 1;
    // 주먹도 다른 쿠키의 기본공격처럼 장비 공격력이 얹힌다.
    return ((p.punchSequence % 2 === 1) ? character.attackDamageRight : character.attackDamageLeft)
        + bonusOf(p).attack;
}

// Resolves the reach, width, damage and origin of the swing about to happen.
// Most cookies just use their flat attackRange/attackWidth/attackDamage fired
// straight from the body centre; combo_two_stage (lightning) alternates between
// two differently *shaped* stages, alternating_punch varies only its damage, and
// dual_spear (lightninghell) keeps one shape but fires it from alternating sides
// of the body -- hence originX/originY rather than always using p.x/p.y.
// Call exactly once per swing -- the alternating_punch path advances state.
function resolveAttack(character, p, now, rapid) {
    if (character.attackType === 'combo_two_stage') {
        const stage = character.attackStages[p.comboStage || 0];
        return { range: stage.range, width: stage.width, damage: stage.damage, originX: p.x, originY: p.y };
    }
    let originX = p.x, originY = p.y;
    if (character.attackType === 'dual_spear') {
        // Perpendicular to `facing`; +90deg is the player's right on screen
        // (canvas y grows downward), which is where the first shot comes from.
        const side = (p.spearSide || 0) === 0 ? 1 : -1;
        const off = character.attackSideOffset * side;
        originX += -Math.sin(p.facing) * off;
        originY += Math.cos(p.facing) * off;
    }
    const damage = character.attackType === 'alternating_punch'
        ? resolveAlternatingPunchDamage(character, p, rapid)
        : effectiveAttackDamage(character, p, now);
    if (isVampireSwing(character, p)) {
        return {
            range: character.attackVampireRange, width: character.attackVampireWidth,
            damage, originX, originY, vampire: true
        };
    }
    return { range: character.attackRange, width: character.attackWidth, damage, originX, originY };
}

// The combo's follow-up thrust opens far sooner than a fresh opening sweep.
function attackCooldownFor(character, p, rapid, now) {
    if (rapid) return character.ultimateRapidCooldown;
    if (character.attackType === 'combo_two_stage' && (p.comboStage || 0) === 1) {
        return character.comboFollowupCooldown;
    }
    let cooldown = character.attackCooldown;
    // 본능해제 3강(시금치맛): attack_heal_boost 궁극기가 켜져 있는 동안 공격속도를 올린다.
    if (character.instinctUltimateAttackSpeedMult && character.ultimateType === 'attack_heal_boost'
        && p.attackHealBoostUntil && now < p.attackHealBoostUntil) {
        cooldown *= character.instinctUltimateAttackSpeedMult;
    }
    return cooldown;
}

// Steps whichever "which swing comes next" counter this attack type keeps.
// Must run after resolveAttack, which reads that counter.
// 번개악마맛은 모든 베기가 흡혈 베기다. 차례를 세지 않는다.
function isVampireSwing(character, p) {
    return character.attackType === 'vampire_slash';
}

function advanceAttackSequence(character, p) {
    if (character.attackType === 'combo_two_stage') {
        p.comboStage = ((p.comboStage || 0) + 1) % character.attackStages.length;
    } else if (character.attackType === 'dual_spear') {
        p.spearSide = (p.spearSide || 0) === 0 ? 1 : 0;
    }
}

// lightning_strike leaves its target dealing reduced damage for a while.
// Returns the multiplier to apply to whatever damage that target is dealing.
function outgoingDamageMultiplier(target, now) {
    if (target && target.damageDebuffUntil && now < target.damageDebuffUntil) {
        return target.damageDebuffMultiplier;
    }
    return 1;
}

// Cheat-death passive (lightning). Called the moment a player's hp hits 0:
// spends one revive charge and returns them to a fraction of max hp instead of
// letting them go down. Returns true if the death was cancelled.
// `equipRevive` is the +N a 각성 장비 adds on top of the passive's own count.
function tryRevive(p, character, equipRevive) {
    const allowed = reviveCountFor(character, equipRevive);
    if (!allowed) return false;
    if ((p.revivesUsed || 0) >= allowed) return false;
    p.revivesUsed = (p.revivesUsed || 0) + 1;
    // 각성: 정해진 번째 부활에서 통째로 강해진다. 체력 상한이 올라가므로
    // 그 순간만큼은 새 최대치로 꽉 채워서 일어난다.
    if (character.awakenOnReviveNo && p.revivesUsed >= character.awakenOnReviveNo && !p.awakened) {
        p.awakened = true;
        const grown = formStat(character, true, 'health');
        // 게스트 레이드는 슬롯 껍데기를 넘기므로 장비 체력을 따로 실어 보낸다.
        const fromGear = p.equipHealth != null ? p.equipHealth : bonusOf(p).health;
        if (grown != null) p.maxHp = grown + fromGear;
        p.hp = p.maxHp;
        return true;
    }
    p.hp = Math.max(1, Math.round(p.maxHp * character.passiveReviveHpRatio));
    p.alive = true;
    return true;
}

// Part two of lightninghell's passive: the revive shockwave. Shaves a share of
// each surviving enemy's CURRENT hp -- a lone enemy loses the solo ratio, a
// crowd loses the (larger) crowd ratio each. 0 for cookies without the passive.
function reviveBlastRatio(character, enemyCount) {
    if (!character.passiveReviveEnemySoloRatio) return 0;
    if (enemyCount <= 0) return 0;
    return enemyCount === 1 ? character.passiveReviveEnemySoloRatio : character.passiveReviveEnemyCrowdRatio;
}

// The boss is always alone in its arena, so the shockwave always uses the
// solo ratio here.
// 지옥맛은 비율이 아니라 고정 데미지를 쓰고, 반경 안에 있을 때만 맞는다
// (raid의 보스는 항상 원점에 있다).
function applyReviveBlastToBoss(roomId, room, character, playerId, p) {
    const ratio = reviveBlastRatio(character, 1);
    const flatDmg = character.passiveReviveBlastDamage;
    const flatRadius = character.passiveReviveBlastRadius;
    const flatHits = !!(flatDmg && flatRadius && p && Math.hypot(p.x, p.y) <= flatRadius + BOSS_RADIUS);
    if ((!ratio && !flatHits) || room.bossHp <= 0) return;
    let dmg = ratio ? Math.max(1, Math.round(room.bossHp * ratio)) : 0;
    if (flatHits) dmg += flatDmg;
    room.bossHp = Math.max(0, room.bossHp - dmg);
    io.to(roomId).emit('reviveBlast', { id: playerId, ratio, damage: dmg });
    io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp });
    if (room.bossHp <= 0) endRoom(roomId, 'win');
}

function applyReviveBlastToMonsters(roomId, room, character, playerId, p) {
    const alive = Object.entries(room.monsters).filter(([, m]) => m.alive);
    const ratio = reviveBlastRatio(character, alive.length);
    const flatDmg = character.passiveReviveBlastDamage;
    const flatRadius = character.passiveReviveBlastRadius;
    if (!ratio && !(flatDmg && flatRadius && p)) return;
    io.to(roomId).emit('storyReviveBlast', { id: playerId, ratio, count: alive.length });
    for (const [mid, m] of alive) {
        let dmg = ratio ? Math.max(1, Math.round(m.hp * ratio)) : 0;
        if (flatDmg && flatRadius && p && Math.hypot(p.x - m.x, p.y - m.y) <= flatRadius + mR(m)) {
            dmg += flatDmg;
        }
        if (!dmg) continue;
        m.hp = Math.max(0, m.hp - dmg);
        if (m.hp <= 0) {
            m.alive = false;
            io.to(roomId).emit('monsterDefeated', { id: mid });
        } else {
            io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
        }
    }
}

function applyDamageToPlayer(roomId, playerId, dmg, extra) {
    const room = rooms[roomId];
    if (!room) return;
    const p = room.players[playerId];
    if (!p || !p.alive) return;
    p.lastHitAt = Date.now(); // 매직블록맛 패시브(focusModeActive)가 읽는다
    const character = charOf(p);
    // Every caller of this is boss damage, so the boss's own lightning_strike
    // damage debuff applies here rather than at each pattern's call site.
    const bossDebuff = (room.bossDamageDebuffUntil && Date.now() < room.bossDamageDebuffUntil)
        ? room.bossDamageDebuffMultiplier : 1;
    dmg = Math.round(dmg * bossDebuff * damageReductionMultiplier(character, p, Date.now(), room.bossElementMark));
    if (p.shieldHp > 0) {
        const absorbed = Math.min(p.shieldHp, dmg);
        p.shieldHp -= absorbed;
        dmg -= absorbed;
    }
    p.hp = Math.max(0, p.hp - dmg);
    let revived = false;
    if (p.hp <= 0) {
        revived = tryRevive(p, character, bonusOf(p).revive);
        if (!revived) p.alive = false;
    }
    io.to(roomId).emit('playerDamaged', { id: playerId, hp: p.hp, alive: p.alive, shieldHp: p.shieldHp || 0, ...(extra || {}) });
    if (revived) {
        io.to(roomId).emit('playerRevived', { id: playerId, hp: p.hp });
        applyReviveBlastToBoss(roomId, room, character, playerId, p);
        return; // this player is back up, so the wipe check below cannot fire
    }

    if (Object.values(room.players).every(pl => !pl.alive)) {
        endRoom(roomId, 'lose');
    }
}

function startFight(roomId) {
    const room = rooms[roomId];
    if (!room || room.state !== 'waiting') return;
    const bossDef = BOSS_DEFS[room.bossId];
    const playerCount = Object.keys(room.players).length;
    if (playerCount === 0) return;

    room.state = 'fighting';
    room.bossHp = bossDef.maxHpPerPlayer * playerCount;
    room.bossMaxHp = room.bossHp;
    room.bossState = 'idle';
    room.nextAttackAt = Date.now() + randomRest(bossDef);
    room.activeBuffs = [];
    room.bossStunnedUntil = 0;
    room.bossElementMark = null; // { element, charges, multiplier } | null

    io.to(roomId).emit('raidStarted', {
        bossHp: room.bossHp,
        bossMaxHp: room.bossMaxHp,
        players: publicPlayers(room)
    });

    room.loopHandle = setInterval(() => tickRoom(roomId), 50);
}

function tickRoom(roomId) {
    const room = rooms[roomId];
    if (!room || room.state !== 'fighting') return;
    const bossDef = BOSS_DEFS[room.bossId];
    const now = Date.now();

    // 바다펄맛 패시브는 체력이 오르내릴 때마다 켜지고 꺼진다. 피해와 회복이
    // 여러 갈래로 들어오므로 한 곳에서 매 틱 다시 본다.
    for (const pl of Object.values(room.players)) refreshLowHpMode(charOf(pl), pl);
    tickInstinctPassiveRegen(room, roomId, now, 'playerHealed');

    tickButterflyMode(room, now, (id, pl, dmg) => applyDamageToPlayer(roomId, id, dmg));
    if (!rooms[roomId]) return;
    tickBodyFusion(room, roomId, now, 'bodyFormChanged', 'playerHealed');

    // Thrown drops, against the one thing in this arena worth hitting. The
    // raid boss never moves from the origin, so a homing shot just has to
    // turn toward (0,0).
    tickPlayerProjectiles(roomId, room, 50, (pr) => {
        if (Math.hypot(pr.x, pr.y) > pr.radius + BOSS_RADIUS) {
            // Nothing to hit out here, and past the arena wall it is gone.
            return Math.hypot(pr.x, pr.y) > ARENA_RADIUS;
        }
        const owner = room.players[pr.ownerId];
        if (!owner) return true;
        landRaidHitOnBoss(roomId, room, pr.ownerId, owner, charOf(owner), pr.damage, Date.now());
        return true;
    }, 'dropGone', (pr, dt) => steerProjectileToward(pr, 0, 0, dt), 'dropUpdate');
    if (!rooms[roomId]) return;

    // Team-wide buffs (e.g. the healer's ultimate) tick independently of the
    // boss's own attack state machine below.
    if (room.activeBuffs && room.activeBuffs.length) {
        room.activeBuffs = room.activeBuffs.filter(buff => now < buff.endAt);
        for (const buff of room.activeBuffs) {
            if (now - buff.lastTickAt >= buff.tickMs) {
                buff.lastTickAt += buff.tickMs;
                if (buff.type === 'team_heal_over_time') {
                    healTeam(room, roomId, buff.healPerTick);
                } else if (buff.type === 'ally_heal_zone') {
                    // 체리크림맛 특수스킬: 반경 안에 있는 팀원 누구나(팀 전체가
                    // 아니라 자리에 있어야 한다) 회복한다.
                    for (const [id, pl] of Object.entries(room.players)) {
                        if (!pl.alive) continue;
                        if (Math.hypot(buff.x - pl.x, buff.y - pl.y) > buff.radius + PLAYER_RADIUS) continue;
                        const healed = Math.min(pl.maxHp, pl.hp + buff.healPerTick);
                        if (healed !== pl.hp) {
                            pl.hp = healed;
                            io.to(roomId).emit('playerHealed', { id, hp: pl.hp });
                        }
                    }
                } else if (buff.type === 'spin_heal_check' && !buff.triggered) {
                    const caster = room.players[buff.casterId];
                    if (caster && caster.alive) {
                        const distToEdge = Math.hypot(caster.x, caster.y) - BOSS_RADIUS;
                        if (distToEdge <= buff.radius) {
                            buff.triggered = true;
                            room.bossHp = Math.max(0, room.bossHp - buff.damage);
                            io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: buff.casterId });
                            if (room.bossHp <= 0) endRoom(roomId, 'win');
                            healTeam(room, roomId, buff.healAmount);
                        }
                    }
                } else if (buff.type === 'attack_burn' && buff.ticksLeft > 0) {
                    buff.ticksLeft -= 1;
                    room.bossHp = Math.max(0, room.bossHp - buff.damage);
                    io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: buff.casterId });
                    if (room.bossHp <= 0) endRoom(roomId, 'win');
                } else if (buff.type === 'magma_zone') {
                    const distToBoss = Math.hypot(buff.x, buff.y);
                    if (distToBoss <= buff.radius + BOSS_RADIUS) {
                        room.bossHp = Math.max(0, room.bossHp - buff.damage);
                        io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: buff.casterId });
                        if (room.bossHp <= 0) { endRoom(roomId, 'win'); continue; }
                        // 치즈만두 덩어리는 깎으면서 표식도 같이 박는다.
                        if (buff.markCharges && applyElementMark(bossMarkTarget(room), buff.markElement,
                            { charges: buff.markCharges, multiplier: buff.markMultiplier }, now)) {
                            io.to(roomId).emit('bossMarked', {
                                element: room.bossElementMark.element,
                                charges: room.bossElementMark.charges,
                                until: room.bossElementMark.until
                            });
                        }
                    }
                } else if (buff.type === 'fire_line_zone') {
                    // 불꽃요정맛 궁극기 지대: 보스가 사각형 안에 있으면 계속 화염 피해,
                    // 시전자 본인이 안에 있으면 계속 회복.
                    if (meleeLineHit(buff.x, buff.y, buff.facing, buff.range, buff.width, BOSS_RADIUS)) {
                        room.bossHp = Math.max(0, room.bossHp - buff.damage);
                        io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: buff.casterId });
                        if (room.bossHp <= 0) { endRoom(roomId, 'win'); continue; }
                    }
                    const caster = room.players[buff.casterId];
                    if (buff.healPerTick && caster && caster.alive
                        && meleeLineHitPoint(buff.x, buff.y, buff.facing, buff.range, buff.width, caster.x, caster.y, PLAYER_RADIUS)) {
                        caster.hp = Math.min(caster.maxHp, caster.hp + buff.healPerTick);
                        io.to(roomId).emit('playerHealed', { id: buff.casterId, hp: caster.hp });
                    }
                }
            }
        }
    }

    // 부하는 레이드에서는 늘 한가운데 보스를 친다. 보스는 부하를 무시한다
    // (패턴이 사람을 겨냥해 돌아가므로, 부하는 시간이 다 되면 사라진다).
    tickSummons(roomId, room, now, {
        nearestEnemy: () => ({ x: 0, y: 0, radius: BOSS_RADIUS, boss: true }),
        clamp: (s) => {
            const d = Math.hypot(s.x, s.y);
            const max = ARENA_RADIUS - SUMMON_RADIUS;
            if (d > max) { s.x = (s.x / d) * max; s.y = (s.y / d) * max; }
        },
        hit: (t, dmg, s) => {
            room.bossHp = Math.max(0, room.bossHp - dmg);
            io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: s.ownerId });
            if (room.bossHp <= 0) endRoom(roomId, 'win');
        }
    });
    if (!rooms[roomId]) return;
    // 레이드는 따로 상태를 매 틱 보내지 않으므로, 부하가 있을 때만 알린다.
    if (room.summons && Object.keys(room.summons).length) {
        io.to(roomId).emit('summonTick', { summons: publicSummons(room) });
    } else if (room.summonsWereShown) {
        io.to(roomId).emit('summonTick', { summons: {} });
    }
    room.summonsWereShown = !!(room.summons && Object.keys(room.summons).length);

    if (room.bossStunnedUntil && now < room.bossStunnedUntil) return; // frozen: no pattern progression at all

    // 시하라얼처럼 몸에 닿아 있는 것만으로 아픈 보스. 패턴과 따로 돌아서,
    // 붙어서 때리는 쿠키는 계속 조금씩 깎인다. 기절한 동안은 안 아프다
    // (위에서 이미 돌아갔다).
    if (bossDef.contact) {
        for (const [id, p] of Object.entries(room.players)) {
            if (!p || !p.alive) continue;
            // 서버는 애초에 보스 몸 안으로는 못 들어오게 막으므로, "닿았다"는
            // 곧 가장 가까이 붙은 상태다. 소수점 오차로 빠져나가지 않게 2px 여유.
            if (Math.hypot(p.x, p.y) > BOSS_RADIUS + PLAYER_RADIUS + 2) {
                p.contactNextAt = 0; // 떨어졌다 다시 붙으면 바로 한 대
                continue;
            }
            if (!p.contactNextAt) p.contactNextAt = now;
            if (now < p.contactNextAt) continue;
            p.contactNextAt = now + bossDef.contact.tickMs;
            applyDamageToPlayer(roomId, id, bossDef.contact.damage, { contact: true });
            if (!rooms[roomId]) return;
        }
    }

    if (room.bossState === 'idle') {
        if (now >= room.nextAttackAt) {
            const patternNames = Object.keys(bossDef.patterns);
            const pattern = patternNames[Math.floor(Math.random() * patternNames.length)];
            const patternDef = bossDef.patterns[pattern];
            room.bossPattern = pattern;
            room.bossState = 'telegraph';
            room.bossPatternStartAt = now;
            room.bossPatternRuntime = {};

            const telegraphPayload = { pattern, telegraphMs: patternDef.telegraphMs };
            if (pattern === 'spear_thrust' || pattern === 'spear_sweep') {
                const targetAngle = pickTargetAngle(room);
                room.bossPatternRuntime.targetAngle = targetAngle;
                telegraphPayload.targetAngle = targetAngle;
            }
            io.to(roomId).emit('bossTelegraph', telegraphPayload);
        }
        return;
    }

    const patternDef = bossDef.patterns[room.bossPattern];

    if (room.bossState === 'telegraph') {
        if (now - room.bossPatternStartAt >= patternDef.telegraphMs) {
            room.bossState = 'active';
            room.bossPatternStartAt = now;

            if (room.bossPattern === 'slam') {
                const hits = [];
                for (const [id, p] of Object.entries(room.players)) {
                    if (!p.alive) continue;
                    const dist = Math.hypot(p.x, p.y);
                    if (dist <= patternDef.radius) {
                        const angle = Math.atan2(p.y, p.x) || 0;
                        const kb = patternDef.knockback;
                        let nx = p.x + Math.cos(angle) * kb;
                        let ny = p.y + Math.sin(angle) * kb;
                        const nd = Math.hypot(nx, ny);
                        const maxD = ARENA_RADIUS - PLAYER_RADIUS;
                        if (nd > maxD) { nx = (nx / nd) * maxD; ny = (ny / nd) * maxD; }
                        p.x = nx; p.y = ny;
                        hits.push(id);
                        applyDamageToPlayer(roomId, id, patternDef.damage, { x: p.x, y: p.y });
                    }
                }
                io.to(roomId).emit('bossAttack', { pattern: 'slam', hits });
                room.bossState = 'idle';
                room.nextAttackAt = now + randomRest(bossDef);
            } else if (room.bossPattern === 'spear_thrust') {
                const targetAngle = room.bossPatternRuntime.targetAngle || 0;
                const dx = Math.cos(targetAngle), dy = Math.sin(targetAngle);
                const hits = [];
                for (const [id, p] of Object.entries(room.players)) {
                    if (!p.alive) continue;
                    const proj = p.x * dx + p.y * dy;
                    if (proj < 0 || proj > patternDef.range) continue;
                    const perp = Math.abs(p.x * dy - p.y * dx);
                    if (perp <= (patternDef.width / 2 + PLAYER_RADIUS)) {
                        hits.push(id);
                        applyDamageToPlayer(roomId, id, patternDef.damage);
                    }
                }
                io.to(roomId).emit('bossAttack', { pattern: 'spear_thrust', targetAngle, hits });
                room.bossState = 'idle';
                room.nextAttackAt = now + randomRest(bossDef);
            } else if (room.bossPattern === 'spear_sweep') {
                const targetAngle = room.bossPatternRuntime.targetAngle || 0;
                const hits = [];
                for (const [id, p] of Object.entries(room.players)) {
                    if (!p.alive) continue;
                    const playerAngle = Math.atan2(p.y, p.x);
                    let diff = Math.abs(playerAngle - targetAngle) % (Math.PI * 2);
                    if (diff > Math.PI) diff = Math.PI * 2 - diff;
                    if (diff <= Math.PI / 2) {
                        hits.push(id);
                        applyDamageToPlayer(roomId, id, patternDef.damage);
                    }
                }
                io.to(roomId).emit('bossAttack', { pattern: 'spear_sweep', targetAngle, hits });
                room.bossState = 'idle';
                room.nextAttackAt = now + randomRest(bossDef);
            } else if (room.bossPattern === 'spray') {
                const baseAngle = Math.random() * Math.PI * 2;
                const angles = Array.from({ length: patternDef.count }, (_, i) => baseAngle + i * (Math.PI * 2 / patternDef.count));
                room.bossPatternRuntime = { angles, hitSets: angles.map(() => new Set()) };
                io.to(roomId).emit('bossAttack', { pattern: 'spray', angles, speed: patternDef.speed });
            } else if (room.bossPattern === 'sweep') {
                const startAngle = Math.random() * Math.PI * 2;
                room.bossPatternRuntime = { startAngle, lastTickAt: now };
                io.to(roomId).emit('bossAttack', { pattern: 'sweep', startAngle, durationMs: patternDef.durationMs });
            } else if (room.bossPattern === 'star_drop') {
                // Waves are driven entirely from the 'active' tick below; this
                // just seeds the counter so wave 1 fires on the very next tick.
                room.bossPatternRuntime = { waveIndex: 0, nextWaveAt: now, currentWave: null };
            }
        }
        return;
    }

    if (room.bossState === 'active') {
        const elapsed = now - room.bossPatternStartAt;

        if (room.bossPattern === 'spray') {
            const currentRadius = (elapsed / 1000) * patternDef.speed;
            const { angles, hitSets } = room.bossPatternRuntime;
            angles.forEach((angle, i) => {
                const px = Math.cos(angle) * currentRadius;
                const py = Math.sin(angle) * currentRadius;
                for (const [id, p] of Object.entries(room.players)) {
                    if (!p.alive || hitSets[i].has(id)) continue;
                    if (Math.hypot(p.x - px, p.y - py) <= patternDef.hitRadius + PLAYER_RADIUS) {
                        hitSets[i].add(id);
                        applyDamageToPlayer(roomId, id, patternDef.damage);
                    }
                }
            });
            if (currentRadius > ARENA_RADIUS) {
                room.bossState = 'idle';
                room.nextAttackAt = now + randomRest(bossDef);
            }
        } else if (room.bossPattern === 'sweep') {
            const rt = room.bossPatternRuntime;
            if (now - rt.lastTickAt >= patternDef.tickMs) {
                rt.lastTickAt = now;
                const currentAngle = rt.startAngle + (elapsed / patternDef.durationMs) * Math.PI * 2;
                for (const [id, p] of Object.entries(room.players)) {
                    if (!p.alive) continue;
                    const dist = Math.hypot(p.x, p.y);
                    if (dist > ARENA_RADIUS) continue;
                    const playerAngle = Math.atan2(p.y, p.x);
                    let diff = Math.abs(playerAngle - currentAngle) % (Math.PI * 2);
                    if (diff > Math.PI) diff = Math.PI * 2 - diff;
                    if (diff <= patternDef.angleTolerance) {
                        applyDamageToPlayer(roomId, id, patternDef.damage);
                    }
                }
            }
            if (elapsed >= patternDef.durationMs) {
                room.bossState = 'idle';
                room.nextAttackAt = now + randomRest(bossDef);
            }
        } else if (room.bossPattern === 'star_drop') {
            const rt = room.bossPatternRuntime;
            if (!rt.currentWave) {
                if (rt.waveIndex >= patternDef.waveCount) {
                    room.bossState = 'idle';
                    room.nextAttackAt = now + randomRest(bossDef);
                } else if (now >= rt.nextWaveAt) {
                    const pos = pickTargetPosition(room);
                    rt.currentWave = { targetX: pos.x, targetY: pos.y, telegraphEndAt: now + patternDef.telegraphMs };
                    rt.nextWaveAt = now + patternDef.waveIntervalMs; // waves are spaced by START time
                    io.to(roomId).emit('bossTelegraph', {
                        pattern: 'star_drop', telegraphMs: patternDef.telegraphMs,
                        targetX: pos.x, targetY: pos.y
                    });
                }
            } else if (now >= rt.currentWave.telegraphEndAt) {
                const { targetX, targetY } = rt.currentWave;
                const hits = [];
                for (const [id, p] of Object.entries(room.players)) {
                    if (!p.alive) continue;
                    if (Math.hypot(p.x - targetX, p.y - targetY) <= patternDef.radius + PLAYER_RADIUS) {
                        hits.push(id);
                        applyDamageToPlayer(roomId, id, patternDef.damage);
                    }
                }
                io.to(roomId).emit('bossAttack', { pattern: 'star_drop', targetX, targetY, hits });
                rt.waveIndex++;
                rt.currentWave = null;
            }
        }
    }
}

// ---- Story mode (tower floors) ----
// A parallel, simpler system from the boss-raid rooms above: a line of weak
// monsters instead of one boss with patterns. Shares the `rooms` dict and
// reuses leaveRaid/disconnect. 솔로는 들어가자마자 시작하고, 멀티는 레이드와
// 똑같이 짝을 찾아 둘 다 준비를 눌러야 시작한다 (findOpenStoryRoom).

// Same idea as meleeLineHit, but against an arbitrary target position instead
// of always the world origin (monsters roam, unlike the boss).
function meleeLineHitPoint(px, py, facingAngle, range, width, targetX, targetY, targetRadius) {
    if (typeof facingAngle !== 'number' || !Number.isFinite(facingAngle)) return false;
    const dx = Math.cos(facingAngle), dy = Math.sin(facingAngle);
    const vx = targetX - px, vy = targetY - py;
    const proj = vx * dx + vy * dy;
    if (proj < -targetRadius || proj > range + targetRadius) return false;
    const perp = Math.abs(vx * dy - vy * dx);
    return perp <= (width / 2 + targetRadius);
}

// 둘이 같이 들어갈 방을 찾는다. 층이 같고, 아직 안 시작했고, 자리가 남은
// 멀티 방만 고른다. 솔로 방은 절대 매칭되지 않는다 (레이드와 같은 규칙).
function findOpenStoryRoom(floor) {
    for (const [roomId, room] of Object.entries(rooms)) {
        if (room.kind === 'story' && room.floor === floor && room.state === 'waiting'
            && !room.solo && Object.keys(room.players).length < 2) {
            return roomId;
        }
    }
    return null;
}

function createStoryRoom(floor, solo) {
    const roomId = `story${floor}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    rooms[roomId] = {
        kind: 'story',
        floor,
        solo: solo !== false,
        // 솔로는 예전 그대로 바로 시작한다. 멀티는 둘이 모여 준비를 눌러야 한다.
        state: solo !== false ? 'fighting' : 'waiting',
        players: {},
        monsters: {},
        projectiles: {}, // id -> arrow in flight; see spawnMonsterProjectile
        nextProjectileId: 0,
        playerProjectiles: {}, // id -> thrown drop in flight; see spawnPlayerProjectile
        nextPlayerProjectileId: 0,
        starDefeated: false,
        activeBuffs: [],
        loopHandle: null
    };
    return roomId;
}

function spawnStoryMonsters(room, floorDef) {
    floorDef.monsters.forEach((m, i) => {
        const def = MONSTERS[m.type];
        room.monsters[`m${i}`] = {
            type: m.type,
            x: m.x, y: m.y || 0,
            hp: def.health, maxHp: def.health,
            alive: true,
            state: 'idle', // 'idle' | 'telegraph' | 'firing' (laser_robot)
            roomIndex: m.room || 0, // which gate/room this monster belongs to
            elementMark: null, // { element, charges, multiplier } | null
            laser: null, // { angle, endAt, nextDamageAt } | null -- see tickLaser
            stunnedUntil: 0,
            telegraphStartAt: 0,
            nextAttackAt: 0
        };
    });
}

// Is any (alive) monster belonging to this room/gate index still around?
// While true, that room's shield gate stays sealed.
function anyMonsterAliveInRoom(room, roomIndex) {
    return Object.values(room.monsters).some(m => m.alive && m.roomIndex === roomIndex);
}

// 레전드 스토리의 입구 문처럼 몬스터가 아니라 스위치로 여는 문(gate.manual)도
// 있다 -- room.legendSwitchesHit[gate.room]이 true가 될 때까지 잠겨 있다.
// 나머지 문은 그대로 몬스터 생존 여부로 잠긴다.
function gateSealed(room, gate) {
    if (gate.manual) return !(room.legendSwitchesHit && room.legendSwitchesHit[gate.room]);
    return anyMonsterAliveInRoom(room, gate.room);
}

// 이 몬스터의 덩치. 케이크처럼 표에 radius가 붙은 적은 잡몹보다 크고, 판정도
// 그림과 같은 값을 쓴다.
function mR(m) {
    return monsterRadiusOf(m && m.type);
}

function publicMonsters(room) {
    const out = {};
    for (const [id, m] of Object.entries(room.monsters)) {
        // shieldHp도 같이 보낸다 -- 틱이 몬스터 객체를 통째로 갈아 끼우기
        // 때문에, 여기 없으면 보호막이 매 틱 사라져 보인다.
        out[id] = { type: m.type, x: m.x, y: m.y, hp: m.hp, maxHp: m.maxHp, alive: m.alive, state: m.state, room: m.roomIndex, elementMark: m.elementMark, shieldHp: m.shieldHp || 0,
            // Beam angle goes out so the client can draw exactly what the server
            // is judging against (laser_robot only; null otherwise).
            laserAngle: m.laser ? m.laser.angle : null };
    }
    return out;
}

// vx/vy go out with each arrow so the client can dead-reckon between the 50ms
// ticks instead of visibly stepping.
function publicProjectiles(room) {
    const out = {};
    for (const [id, pr] of Object.entries(room.projectiles || {})) {
        out[id] = { x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy, angle: pr.angle, radius: pr.radius };
    }
    return out;
}

// Fires an arrow from a monster toward a fixed point (where the target stood at
// release), so moving aside after the shot dodges it.
// Story floors and the guest raid's summoned adds run the same monsters. They
// differ only in how damage reaches a player, where a monster may stand, what
// can block its line of fire, and which events go on the wire -- so those four
// things are handed in and the behaviour itself is written once.
// 파란 벽(에너지 방벽)은 사람만 막는 게 아니다 -- 그 방의 적도 벽을 넘어
// 따라 나오지 못한다. 살아 있는 적이 있는 동안 벽은 서 있으므로, 결국
// 살아 있는 적은 늘 자기 방 안에 갇혀 있는 셈이다.
// 방(gate)이 없는 판(10층 케이크, 각성모드 마당)은 그대로 둔다.
function clampMonsterToRoom(floorDef, m) {
    if (!floorDef || !floorDef.gates || !floorDef.gates.length) return;
    const gate = floorDef.gates.find(g => (g.room || 0) === (m.roomIndex || 0));
    if (!gate) return;
    const along = alongOf(floorDef, m.x, m.y);
    // exit가 더 멀리(작은 값), entrance가 시작 쪽(큰 값)이다.
    const kept = Math.max(gate.exit, Math.min(gate.entrance, along));
    if (kept === along) return;
    const pos = fromAlongAcross(floorDef, kept, acrossOf(floorDef, m.x, m.y));
    m.x = pos.x; m.y = pos.y;
}

function storyMonsterCtx(roomId, room) {
    const floorDef = floorDefFor(room.floor);
    return {
        roomId, room, floorDef,
        damagePlayer: (playerId, dmg, mark) => applyDamageToStoryPlayer(roomId, playerId, dmg, mark),
        damageTarget: (ref, dmg, mark) => damageTargetRef(roomId, room, ref, dmg, mark,
            (pid, d, mk) => applyDamageToStoryPlayer(roomId, pid, d, mk)),
        clamp: (m) => {
            if (!floorDef) return;
            const k = clampToLane(floorDef, m.x, m.y);
            m.x = k.x; m.y = k.y;
            clampMonsterToRoom(floorDef, m);
        },
        // A raised shield stops an EMPLACEMENT firing through it; see shieldBetween.
        sightBlocked: (m, target, def) => def.speed === 0 && !!floorDef && shieldBetween(room, floorDef, m, target),
        outOfBounds: (pr) => !!floorDef && (pr.x > 200 || pr.x < -floorDef.levelLength - 200
            || Math.abs(pr.y) > floorDef.laneHalfWidth + 200),
        ev: {
            telegraph: 'monsterTelegraph', attack: 'monsterAttack',
            defeated: 'monsterDefeated', exploded: 'monsterExploded',
            projectileFired: 'storyProjectileFired', projectileGone: 'storyProjectileGone',
            dodge: 'storyPlayerFocusDodge'
        }
    };
}

function spawnMonsterProjectile(ctx, monsterId, m, def, targetX, targetY) {
    const { room, roomId } = ctx;
    const dx = targetX - m.x, dy = targetY - m.y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = def.projectileSpeed;
    const id = `pr${room.nextProjectileId++}`;
    const pr = {
        x: m.x, y: m.y,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        angle: Math.atan2(dy, dx),
        damage: def.attackDamage * outgoingDamageMultiplier(m, Date.now()),
        elementMark: m.elementMark,
        radius: def.attackProjectileRadius, // undefined for ordinary arrows -> PROJECTILE_RADIUS
        // 화상: 대부분의 발사체는 안 쓴다 (undefined -> tickMonsterProjectiles의
        // onHit 훅이 조용히 무시). guest2 기본 공격만 채워서 넘긴다.
        burnDamage: def.attackBurnDamage,
        burnTicks: def.attackBurnTicks,
        burnIntervalMs: def.attackBurnIntervalMs,
        bornAt: Date.now()
    };
    room.projectiles[id] = pr;
    io.to(roomId).emit(ctx.ev.projectileFired, { id, monsterId, ...publicProjectiles(room)[id] });
    return id;
}

// Advances every arrow and resolves hits. Returns once the room may have ended.
function tickMonsterProjectiles(ctx, alivePlayers, dtMs) {
    const { roomId, room } = ctx;
    const now = Date.now();
    const dt = dtMs / 1000;
    for (const [id, pr] of Object.entries(room.projectiles)) {
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;

        // 부하도 화살에 맞는다. 반지름이 작아서 사람보다 맞기 어렵다.
        let hitRef = null;
        for (const p of alivePlayers) {
            const r = (room.summons && Object.values(room.summons).includes(p)) ? SUMMON_RADIUS : PLAYER_RADIUS;
            if (Math.hypot(p.x - pr.x, p.y - pr.y) <= r + (pr.radius || PROJECTILE_RADIUS)) { hitRef = p; break; }
        }

        const expired = now - pr.bornAt >= PROJECTILE_MAX_LIFETIME_MS;
        if (hitRef || expired || ctx.outOfBounds(pr)) {
            delete room.projectiles[id];
            io.to(roomId).emit(ctx.ev.projectileGone, { id, hit: !!hitRef, x: pr.x, y: pr.y });
            if (hitRef) {
                ctx.damageTarget(hitRef, pr.damage, pr.elementMark);
                if (!rooms[roomId]) return; // player died; room already torn down
                if (ctx.onHit) ctx.onHit(pr, hitRef);
                if (!rooms[roomId]) return;
            }
        }
    }
}



// ==================== 부하 (소환수) ====================
// 번개지옥맛 궁극기가 불러내는 편. 몬스터와 반대로 이쪽 편에서 싸운다:
// 가장 가까운 적에게 걸어가 스스로 때리고, 궁극기 시간이 끝나면 사라진다.
// 적에게 맞으면 죽는다 -- 몬스터가 표적을 고를 때 사람과 같이 후보에 든다.
function spawnSummons(roomId, room, ownerId, character, now) {
    if (!character.ultimateSummonCount || !character.ultimateSummon) return;
    const p = room.players[ownerId];
    if (!p) return;
    const def = character.ultimateSummon;
    room.summons = room.summons || {};
    room.nextSummonId = room.nextSummonId || 0;
    for (let i = 0; i < character.ultimateSummonCount; i++) {
        const ang = (Math.PI * 2 * i) / character.ultimateSummonCount;
        room.summons['s' + (room.nextSummonId++)] = {
            ownerId,
            x: p.x + Math.cos(ang) * 48,
            y: p.y + Math.sin(ang) * 48,
            facing: ang,
            hp: def.health, maxHp: def.health,
            alive: true, lastAttackAt: 0,
            until: now + character.ultimateDurationMs
        };
    }
}

function summonDefOf(room, s) {
    const owner = room.players[s.ownerId];
    const character = owner && charOf(owner);
    return (character && character.ultimateSummon) || null;
}

function damageSummon(room, sid, dmg) {
    const s = room.summons && room.summons[sid];
    if (!s || !s.alive) return;
    s.hp = Math.max(0, s.hp - Math.round(dmg));
    if (s.hp <= 0) s.alive = false;
}

// 사람 + 부하를 한 줄로. 몬스터는 이 중에서 가장 가까운 것을 고른다.
function aliveTargetsOf(room) {
    const out = Object.values(room.players).filter(p => p.alive);
    if (room.summons) {
        for (const s of Object.values(room.summons)) if (s.alive) out.push(s);
    }
    return out;
}

// 이 참조가 사람인지 부하인지 가려서 알맞은 곳으로 피해를 보낸다.
function damageTargetRef(roomId, room, ref, dmg, mark, damagePlayer) {
    const pid = Object.keys(room.players).find(id => room.players[id] === ref);
    if (pid) { damagePlayer(pid, dmg, mark); return; }
    const sid = room.summons && Object.keys(room.summons).find(id => room.summons[id] === ref);
    if (sid) damageSummon(room, sid, dmg);
}

// 부하 한 틱. 적을 찾고, 다가가고, 사거리에 들면 때린다.
function tickSummons(roomId, room, now, api) {
    if (!room.summons || !Object.keys(room.summons).length) return;
    for (const [id, s] of Object.entries(room.summons)) {
        if (!s.alive) continue;
        if (now >= s.until) { s.alive = false; continue; }
        const def = summonDefOf(room, s);
        if (!def) { s.alive = false; continue; }
        const target = api.nearestEnemy(s);
        if (!target) continue;
        const gap = Math.hypot(target.x - s.x, target.y - s.y) - (target.radius || 0);
        s.facing = Math.atan2(target.y - s.y, target.x - s.x);
        if (gap > def.attackRange * 0.6) {
            const step = Math.min(def.speed * 3, gap);
            s.x += Math.cos(s.facing) * step;
            s.y += Math.sin(s.facing) * step;
            if (api.clamp) api.clamp(s);
        }
        if (gap <= def.attackRange && now - s.lastAttackAt >= def.attackCooldown) {
            s.lastAttackAt = now;
            api.hit(target, def.attackDamage, s);
            if (!rooms[roomId]) return;
        }
    }
    for (const id of Object.keys(room.summons)) {
        if (!room.summons[id].alive) delete room.summons[id];
    }
}

function publicSummons(room) {
    const out = {};
    if (!room.summons) return out;
    for (const [id, s] of Object.entries(room.summons)) {
        if (!s.alive) continue;
        out[id] = { x: s.x, y: s.y, facing: s.facing, hp: s.hp, maxHp: s.maxHp, ownerId: s.ownerId };
    }
    return out;
}

// ==================== Player projectiles ====================
// A melee swing resolves the instant the button is pressed. A thrown attack
// (물방울맛's 물방울 던지기) leaves the cookie and travels, so it is resolved on
// the room's 50ms tick and can miss outright. All three room kinds share the
// spawn/tick pair below; only "what it can hit" differs, and that is handed in.

function spawnPlayerProjectile(roomId, room, ownerId, p, character, now, ev, facingOverride) {
    if (!room.playerProjectiles) { room.playerProjectiles = {}; room.nextPlayerProjectileId = 0; }
    const id = `pp${room.nextPlayerProjectileId++}`;
    const speed = character.attackProjectileSpeed;
    const facing = facingOverride != null ? facingOverride : p.facing;
    const pr = {
        ownerId,
        x: p.x, y: p.y,
        vx: Math.cos(facing) * speed,
        vy: Math.sin(facing) * speed,
        radius: character.attackProjectileRadius,
        damage: effectiveAttackDamage(character, p, now),
        // It fizzles once it has flown attackRange, so the range on the
        // character card is the range you actually get.
        rangeLeft: character.attackRange,
        // The ultimate's marking window is captured at the throw: what matters
        // is whether it was open when the drop left the cookie's hand.
        marks: !!(p.elementMarkUntil && now < p.elementMarkUntil),
        charType: p.charType,
        // 쿠키맛쿠키의 구슬처럼 유도탄인 투사체는 매 틱 방향을 목표 쪽으로
        // 튼다 -- steerProjectileToward 참고. 그래도 rangeLeft 안에 따라잡지
        // 못하면 그냥 빗나간다.
        homing: !!character.attackHoming
    };
    room.playerProjectiles[id] = pr;
    io.to(roomId).emit(ev, {
        id, ownerId, charType: pr.charType,
        x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy, radius: pr.radius
    });
    return id;
}

// 쿠키맛쿠키 기본공격: attackProjectileCount발을 attackProjectileSpreadDeg 안에서
// 부채꼴로 쏜다. 한 번에 다 나가면 눈에 잘 안 띄어서 attackProjectileStaggerMs
// 간격으로 하나씩 내보낸다. 각 발은 spawnPlayerProjectile이 homing:true로
// 표시하므로 이후 각 room의 tickPlayerProjectiles steer 콜백이 알아서 가장
// 가까운 목표로 튼다.
function fireHomingBurst(roomId, room, ownerId, p, character, now, ev) {
    const count = character.attackProjectileCount || 1;
    const spread = (character.attackProjectileSpreadDeg || 0) * Math.PI / 180;
    const stagger = character.attackProjectileStaggerMs || 0;
    const fire = (facing) => {
        const rm = rooms[roomId];
        if (!rm || rm.state !== 'fighting') return;
        const pl = rm.players[ownerId];
        if (!pl || !pl.alive) return;
        spawnPlayerProjectile(roomId, rm, ownerId, pl, character, Date.now(), ev, facing);
    };
    for (let i = 0; i < count; i++) {
        const offset = count > 1 ? spread * (i / (count - 1) - 0.5) : 0;
        const facing = p.facing + offset;
        if (i === 0) fire(facing);
        else setTimeout(() => fire(facing), stagger * i);
    }
}

// 초당 이만큼(라디안) 방향을 틀 수 있다 -- 60도/초. 이 구슬의 최대 사거리
// (480px)는 380px/s 속도로 1.26초 만에 다 닳으므로, 그 안에 꺾을 수 있는
// 각도는 최대 76도 정도다. 정면에서 크게 벗어나면 거의 못 따라간다 --
// 너무 잘 따라간다는 피드백을 세 번 받고 계속 낮췄다
// (540도/초 -> 135도/초 -> 90도/초 -> 60도/초).
const HOMING_TURN_RATE = Math.PI / 3;
function steerProjectileToward(pr, tx, ty, dt) {
    const speed = Math.hypot(pr.vx, pr.vy);
    if (!speed) return;
    const desired = Math.atan2(ty - pr.y, tx - pr.x);
    const current = Math.atan2(pr.vy, pr.vx);
    let diff = desired - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxTurn = HOMING_TURN_RATE * dt;
    const applied = Math.max(-maxTurn, Math.min(maxTurn, diff));
    const angle = current + applied;
    pr.vx = Math.cos(angle) * speed;
    pr.vy = Math.sin(angle) * speed;
}

// `resolveHit(pr)` returns truthy if the drop struck something this step.
// `steer(pr, dt)` is optional: called before moving, lets a homing projectile
// (pr.homing) bend toward whatever this room kind considers its nearest
// target. `updateEv`, if given, is emitted every tick for homing projectiles
// only so the client can correct its dead-reckoned position mid-curve.
function tickPlayerProjectiles(roomId, room, dtMs, resolveHit, goneEv, steer, updateEv) {
    if (!room.playerProjectiles) return;
    const dt = dtMs / 1000;
    for (const [id, pr] of Object.entries(room.playerProjectiles)) {
        if (steer && pr.homing) steer(pr, dt);
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        pr.rangeLeft -= Math.hypot(pr.vx, pr.vy) * dt;
        if (updateEv && pr.homing) {
            io.to(roomId).emit(updateEv, { id, x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy });
        }
        const hit = resolveHit(pr);
        if (!rooms[roomId]) return; // that hit ended the room
        if (!room.playerProjectiles[id]) continue; // already cleaned up
        if (hit || pr.rangeLeft <= 0) {
            delete room.playerProjectiles[id];
            io.to(roomId).emit(goneEv, { id, hit: !!hit, x: pr.x, y: pr.y });
        }
    }
}

// One landed player hit on a story monster: mark bonus, burn, knockback and the
// ultimate's mark window. Written once so the melee swing and the thrown drop
// can never drift apart.
// 각성모드 보스는 레벨에 따라 받는 피해가 줄어든다 (4·10레벨의 90%).
// 몬스터 표에 적힌 값이므로 어떤 몬스터에든 붙일 수 있다.
// monsterSkill/monsterUltimate가 켜져 있는 동안에는 그 damageTakenMult도
// 곱한다 -- tickMonsterSkillUltimate가 스스로 버프를 켜고 끄는 타이머.
function monsterDamageTaken(m) {
    const def = m && MONSTERS[m.type];
    let mult = (def && def.damageTaken) || 1;
    if (!m || !def) return mult;
    const now = Date.now();
    if (def.monsterSkill && m.skillActiveUntil && now < m.skillActiveUntil) {
        mult *= def.monsterSkill.damageTakenMult != null ? def.monsterSkill.damageTakenMult : 1;
    }
    if (def.monsterUltimate && m.ultimateActiveUntil && now < m.ultimateActiveUntil) {
        mult *= def.monsterUltimate.damageTakenMult != null ? def.monsterUltimate.damageTakenMult : 1;
    }
    return mult;
}
// 케이크 보스처럼 때릴 때마다 자라는 몬스터. growOnAttack이 없으면 아무 일도
// 없으므로 다른 몬스터는 지금까지와 똑같이 움직인다.
// 격노(enrage): 체력이 어느 선 아래로 떨어지면 공격력과 속도가 배로 오른다.
// 표에 enrage가 없으면 1이라 다른 몬스터는 그대로다.
function enrageMult(m, def, key) {
    const en = def && def.enrage;
    if (!en || !m || !m.maxHp) return 1;
    return (m.hp / m.maxHp) <= en.atHpRatio ? (en[key] || 1) : 1;
}
// 케이크는 0.5씩 자라므로 여기서 반올림하지 않는다 -- 실제로 때릴 때
// 한 번만 반올림된다.
// 궁극기가 켜져 있는 동안엔 그 값이 공격력/이동속도를 통째로 갈아치운다
// (성장/격노와는 달리 더하는 게 아니라 대체 -- reddragon_rampage 참고).
function monsterAttackDamage(m, def) {
    if (m && def.monsterUltimate && m.ultimateActiveUntil && Date.now() < m.ultimateActiveUntil
        && def.monsterUltimate.attackDamage != null) {
        return def.monsterUltimate.attackDamage;
    }
    return ((def.attackDamage || 0) + ((m && m.growAttack) || 0))
        * enrageMult(m, def, 'attackMult');
}
function monsterSpeed(m, def) {
    if (m && def.monsterUltimate && m.ultimateActiveUntil && Date.now() < m.ultimateActiveUntil
        && def.monsterUltimate.speed != null) {
        return def.monsterUltimate.speed;
    }
    const base = ((def.speed || 0) + ((m && m.growSpeed) || 0)) * enrageMult(m, def, 'speedMult');
    // 매직블록맛 기본공격에 맞아 슬로우 걸린 동안(landStoryHitOnMonster 참고).
    if (m && m.slowUntil && Date.now() < m.slowUntil) return base * m.slowMultiplier;
    return base;
}
// 한 대 때릴 때마다 공격력·속도가 오르고 스스로 조금 회복한다.
function growMonsterOnAttack(roomId, mid, m, def) {
    const grow = def.growOnAttack;
    if (!grow || !m.alive) return;
    if (grow.attack) m.growAttack = (m.growAttack || 0) + grow.attack;
    if (grow.speed) m.growSpeed = (m.growSpeed || 0) + grow.speed;
    if (grow.heal && m.hp < m.maxHp) {
        m.hp = Math.min(m.maxHp, m.hp + grow.heal);
        io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
    }
    io.to(roomId).emit('monsterGrew', {
        id: mid, attack: monsterAttackDamage(m, def), speed: monsterSpeed(m, def), hp: m.hp
    });
}

// 스스로 켜는 스킬/궁극기: 몬스터 표에 monsterSkill/monsterUltimate가 있으면
// 쿨타임마다 자동으로 켠다(대상 지정 없이 그냥 자기 자신에게 거는 버프라
// idle/telegraph 같은 공격 상태와 무관하게 매 틱 확인한다). 켜져 있는 동안의
// 실제 효과(받는 피해 배율/공격력/이동속도 대체)는 monsterDamageTaken /
// monsterAttackDamage / monsterSpeed가 스스로 확인한다 -- 여기서는 타이머만
// 관리하고 켜지는 순간의 회복/보호막만 준다.
function tickMonsterSkillUltimate(roomId, mid, m, def, now) {
    if (def.monsterSkill) {
        if (m.skillReadyAt === undefined) m.skillReadyAt = now + def.monsterSkill.cooldownMs;
        const active = m.skillActiveUntil && now < m.skillActiveUntil;
        if (!active && now >= m.skillReadyAt) {
            const s = def.monsterSkill;
            m.skillActiveUntil = now + s.durationMs;
            m.skillReadyAt = now + s.cooldownMs;
            if (s.healOnCast) m.hp = Math.min(m.maxHp, m.hp + s.healOnCast);
            if (s.shieldOnCast) m.shieldHp = (m.shieldHp || 0) + s.shieldOnCast;
            io.to(roomId).emit('monsterSkillUsed', { id: mid, durationMs: s.durationMs, hp: m.hp, shieldHp: m.shieldHp || 0 });
        }
    }
    if (def.monsterUltimate) {
        if (m.ultimateReadyAt === undefined) m.ultimateReadyAt = now + def.monsterUltimate.cooldownMs;
        const active = m.ultimateActiveUntil && now < m.ultimateActiveUntil;
        if (!active && now >= m.ultimateReadyAt) {
            const u = def.monsterUltimate;
            m.ultimateActiveUntil = now + u.durationMs;
            m.ultimateReadyAt = now + u.cooldownMs;
            if (u.healOnCast) m.hp = Math.min(m.maxHp, m.hp + u.healOnCast);
            if (u.shieldOnCast) m.shieldHp = (m.shieldHp || 0) + u.shieldOnCast;
            io.to(roomId).emit('monsterUltimateUsed', { id: mid, durationMs: u.durationMs, hp: m.hp, shieldHp: m.shieldHp || 0 });
        }
    }
}

// ---- 11층부터 나오는 장치들. 전부 몬스터 표에 한 줄만 적으면 붙는다. ----

// 방에 몬스터를 하나 새로 세운다 (분열·소환이 같이 쓴다).
function spawnStoryMonster(room, type, x, y, roomIndex) {
    const def = MONSTERS[type];
    if (!def) return null;
    const id = `sm${room.nextSpawnId = (room.nextSpawnId || 0) + 1}`;
    const m = {
        type, x, y,
        hp: def.health, maxHp: def.health,
        alive: true, state: 'idle', roomIndex: roomIndex || 0,
        elementMark: null, laser: null,
        stunnedUntil: 0, telegraphStartAt: 0, nextAttackAt: 0
    };
    // 갈라져 나온 것도, 불려 나온 것도 길 밖이나 벽 너머로는 못 나간다.
    const floorDef = floorDefFor(room.floor);
    if (floorDef) {
        const k = clampToLane(floorDef, m.x, m.y);
        m.x = k.x; m.y = k.y;
        clampMonsterToRoom(floorDef, m);
    }
    room.monsters[id] = m;
    return id;
}

// 분열(splitOnDeath): 쓰러지면 그 자리에서 작은 것 여럿으로 갈라진다.
// 죽는 길이 여럿이라 때리는 자리마다 붙이지 않고 매 틱 한 번에 본다.
// 갈라진 것도 표에 splitOnDeath가 있으면 또 갈라지므로, 무한히 갈라지지
// 않게 하려면 자식 쪽 표에는 넣지 않는다.
function splitDeadMonsters(roomId, room) {
    let spawned = false;
    for (const [mid, m] of Object.entries(room.monsters)) {
        if (m.alive || m.splitDone) continue;
        const split = MONSTERS[m.type] && MONSTERS[m.type].splitOnDeath;
        if (!split) continue;
        m.splitDone = true;
        const count = split.count || 2;
        const spread = split.spread || 40;
        for (let i = 0; i < count; i++) {
            // 한 점에 겹치지 않게 부채꼴로 흩어 놓는다.
            const ang = (Math.PI * 2 * i) / count;
            spawnStoryMonster(room, split.type,
                m.x + Math.cos(ang) * spread, m.y + Math.sin(ang) * spread, m.roomIndex);
        }
        spawned = true;
        io.to(roomId).emit('monsterSplit', { id: mid, x: m.x, y: m.y, count });
    }
    return spawned;
}

// 회복 오라(healAura): 주변의 다른 몬스터를 계속 채워 준다. 자기 자신은
// 채우지 않으므로, 먼저 잡으라는 신호가 된다.
function tickHealAuras(roomId, room, now) {
    for (const [, healer] of Object.entries(room.monsters)) {
        if (!healer.alive) continue;
        const aura = MONSTERS[healer.type] && MONSTERS[healer.type].healAura;
        if (!aura) continue;
        if (now - (healer.lastAuraAt || 0) < aura.tickMs) continue;
        healer.lastAuraAt = now;
        let any = false;
        for (const [mid, m] of Object.entries(room.monsters)) {
            if (!m.alive || m === healer || m.hp >= m.maxHp) continue;
            if (Math.hypot(healer.x - m.x, healer.y - m.y) > aura.radius) continue;
            m.hp = Math.min(m.maxHp, m.hp + aura.amount);
            io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
            any = true;
        }
        if (any) {
            io.to(roomId).emit('monsterAura',
                { x: healer.x, y: healer.y, radius: aura.radius });
        }
    }
}

// sp.count마리를 boss 둘레에 원을 그리듯 세우고, counterKey에 부른 수를 적립한다
// (spec별로 따로 세므로 summonOnTimer/summonOnHits가 서로의 max를 갉아먹지 않는다).
function summonAroundBoss(room, roomId, boss, sp, counterKey) {
    const room0 = boss.roomIndex;
    for (let i = 0; i < (sp.count || 1); i++) {
        if ((boss[counterKey] || 0) >= sp.max) break;
        boss[counterKey] = (boss[counterKey] || 0) + 1;
        const ang = (Math.PI * 2 * i) / (sp.count || 1);
        spawnStoryMonster(room, sp.type,
            boss.x + Math.cos(ang) * 55, boss.y + Math.sin(ang) * 55, room0);
    }
    io.to(roomId).emit('monsterSummoned', { x: boss.x, y: boss.y });
}

// 소환(summonOnTimer): 정해진 간격마다 부하를 부른다.
// 소환(summonOnHits): 플레이어에게 맞아 체력이 줄어들 때마다 세다가, every번째
// 마다 한 번 더 부른다 -- 정확한 타격 "횟수"가 아니라 틱(50ms)마다 체력이
// 줄었는지만 보는 근사치다 (같은 틱에 두 명이 동시에 때리면 1번으로 친다).
// 둘 다 max까지만 부르므로 무한히 불어나지는 않는다.
function tickMonsterSummons(roomId, room, now) {
    for (const [, boss] of Object.entries(room.monsters)) {
        if (!boss.alive) continue;
        const def = MONSTERS[boss.type];
        if (!def) continue;

        const sp = def.summonOnTimer;
        if (sp) {
            if (!boss.lastSummonAt) boss.lastSummonAt = now;
            else if (now - boss.lastSummonAt >= sp.everyMs) {
                boss.lastSummonAt = now;
                if ((boss.summonedTimerTotal || 0) < sp.max) {
                    summonAroundBoss(room, roomId, boss, sp, 'summonedTimerTotal');
                }
            }
        }

        const sh = def.summonOnHits;
        if (sh) {
            if (boss.hitTrackHp === undefined) {
                boss.hitTrackHp = boss.hp;
            } else if (boss.hp < boss.hitTrackHp) {
                boss.hitsTaken = (boss.hitsTaken || 0) + 1;
                boss.hitTrackHp = boss.hp;
                if (boss.hitsTaken % sh.every === 0 && (boss.summonedHitsTotal || 0) < sh.max) {
                    summonAroundBoss(room, roomId, boss, sh, 'summonedHitsTotal');
                }
            } else if (boss.hp > boss.hitTrackHp) {
                // 자힐/보호막(growOnAttack, lowHpGuard)로 체력이 오른 것 -- 맞은 게
                // 아니니 기준선만 다시 맞추고 지나간다.
                boss.hitTrackHp = boss.hp;
            }
        }
    }
}

// 체력이 어느 선 아래로 떨어지면 딱 한 번 회복하고 보호막을 두른다.
function checkMonsterLowHpGuard(roomId, room, mid, m, def) {
    const guard = def && def.lowHpGuard;
    if (!guard || !m.alive || m.lowHpGuardUsed) return;
    if (m.hp > guard.atHp) return;
    m.lowHpGuardUsed = true;
    if (guard.heal) m.hp = Math.min(m.maxHp, m.hp + guard.heal);
    if (guard.shield) m.shieldHp = (m.shieldHp || 0) + guard.shield;
    io.to(roomId).emit('monsterGuard', {
        id: mid, hp: m.hp, shieldHp: m.shieldHp || 0, x: m.x, y: m.y,
        name: def.name
    });
}

// 각성모드 보스의 각성(awakening_rapid)처럼 공격이 빨라지는 동안에만 짧아진다.
function monsterAttackCooldown(m, def, now) {
    if (m && m.rapidUntil && now < m.rapidUntil && m.rapidCooldown) return m.rapidCooldown;
    return def.attackCooldown;
}

// 보스가 스스로 두른 보호막을 먼저 깎는다.
function absorbMonsterShield(roomId, mid, m, dmg) {
    if (!m.shieldHp || m.shieldHp <= 0) return dmg;
    const absorbed = Math.min(m.shieldHp, dmg);
    m.shieldHp -= absorbed;
    io.to(roomId).emit('monsterShield', { id: mid, shieldHp: m.shieldHp });
    return dmg - absorbed;
}

// 몬스터에게 피해를 준다. 죽었으면 true.
function hurtStoryMonster(roomId, room, mid, m, rawDamage) {
    let dmg = Math.max(1, Math.round(rawDamage * monsterDamageTaken(m)));
    dmg = absorbMonsterShield(roomId, mid, m, dmg);
    m.hp = Math.max(0, m.hp - dmg);
    if (m.hp <= 0) {
        m.alive = false;
        io.to(roomId).emit('monsterDefeated', { id: mid });
        return true;
    }
    io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
    return false;
}

// 불꽃요정맛 패시브: 부활할 때마다 화염 피해가 늘어난다 (6 -> 7 -> 8).
// 타오르는 강판(각성 장비)을 끼면 passiveBurnGrowthMaxRevives가 붙어서,
// 부활이 그 이상(3번째) 늘어도 화염 피해 성장은 거기서 멈춘다 -- 그 몫은
// reviveAttackBonus(기본 공격력 +2)로 대신 나간다.
function effectiveBurnDamage(character, p) {
    if (!character.attackBurnDamage) return 0;
    if (!character.passiveBurnGrowthPerRevive) return character.attackBurnDamage;
    const revives = (p && p.revivesUsed) || 0;
    const cap = character.passiveBurnGrowthMaxRevives;
    const counted = cap != null ? Math.min(revives, cap) : revives;
    return character.attackBurnDamage + counted * character.passiveBurnGrowthPerRevive;
}

// 불꽃요정맛 궁극기(화염지대) 안에 서 있는 적을 공격하면 화염 피해가 더 붙는다.
function zoneBurnBonus(character, room, casterId, targetX, targetY, targetRadius) {
    if (!character.ultimateZoneAttackBonusBurn || !room.activeBuffs) return 0;
    const zone = room.activeBuffs.find(b => b.type === 'fire_line_zone' && b.casterId === casterId);
    if (!zone) return 0;
    return meleeLineHitPoint(zone.x, zone.y, zone.facing, zone.range, zone.width, targetX, targetY, targetRadius)
        ? character.ultimateZoneAttackBonusBurn : 0;
}

// 가면광대 전용 속임수 두 겹. 둘 다 "이 공격은 무효, 대신 공격자가 다친다"로
// 끝나므로 정상 피해 계산보다 먼저 걸러낸다.
function clownTrickInterceptsHit(roomId, room, mid, m, attackerId, now) {
    const def = MONSTERS[m.type];
    if (!def || !def.trickBoss) return false;

    // 헛것 베기: 가짜로 보이는 순간(m.trickFlickerReal === false) 맞으면 패턴이
    // 확률이 아니라 무조건 역관광으로 끝난다.
    if (m.trickPattern === 'decoy_flicker' && m.state === 'active' && m.trickFlickerReal === false) {
        const stat = boss3PatternStat('decoy_flicker', m.trickPhaseKey);
        const attacker = room.players[attackerId];
        if (attacker && attacker.alive) applyDamageToStoryPlayer(roomId, attackerId, stat.reflectDamage);
        m.state = 'idle';
        m.trickNextAttackAt = now + boss3PhaseFor(m.hp).patternIntervalMs;
        io.to(roomId).emit('clownReflect', { id: mid, attackerId });
        return true;
    }

    // 되돌아오는 대가 패시브(2페이즈부터): 확률로 공격 자체가 무효화된다.
    const phase = boss3PhaseFor(m.hp);
    if (phase.passive && phase.passive.negateChance && Math.random() < phase.passive.negateChance) {
        const attacker = room.players[attackerId];
        if (attacker && attacker.alive) applyDamageToStoryPlayer(roomId, attackerId, phase.passive.reflectDamage);
        io.to(roomId).emit('clownReflect', { id: mid, attackerId });
        return true;
    }
    return false;
}

function landStoryHitOnMonster(roomId, room, mid, m, attackerId, character, baseDamage, now, opts) {
    if (clownTrickInterceptsHit(roomId, room, mid, m, attackerId, now)) return false;
    let dmg = Math.round(damageWithMark(m, character, baseDamage, now, opts.markUse) * monsterDamageTaken(m));
    dmg = absorbMonsterShield(roomId, mid, m, dmg);
    m.hp = Math.max(0, m.hp - dmg);
    if (m.hp <= 0) {
        m.alive = false;
        io.to(roomId).emit('monsterDefeated', { id: mid });
        return true; // 흡혈 베기가 이 한 방으로 끝냈는지 알려준다
    }
    io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });

    if (character.attackBurnDamage) {
        const attacker = room.players[attackerId];
        const burnDmg = effectiveBurnDamage(character, attacker)
            + zoneBurnBonus(character, room, attackerId, m.x, m.y, mR(m));
        room.activeBuffs.push({
            type: 'attack_burn',
            casterId: attackerId,
            targetMonsterId: mid,
            damage: burnDmg,
            tickMs: character.attackBurnIntervalMs,
            ticksLeft: character.attackBurnTicks,
            lastTickAt: now,
            endAt: now + character.attackBurnIntervalMs * character.attackBurnTicks + 200
        });
    }

    // 매직블록맛 기본공격: 맞은 몹을 짧게 슬로우(monsterSpeed가 읽는다).
    if (character.attackSlowMult) {
        m.slowUntil = now + character.attackSlowDurationMs;
        m.slowMultiplier = character.attackSlowMult;
    }

    // Shove the target back (the raid boss doesn't have this -- it's fixed in
    // place -- so this only ever fires here).
    if (opts.knockback && character.attackKnockback) {
        const floorDef = opts.floorDef;
        const dx = m.x - opts.fromX, dy = m.y - opts.fromY;
        const kdist = Math.hypot(dx, dy) || 1;
        // 길 밖으로 밀려나지 않게 한 번에 클램프한다. 꺾은선 다리에서도
        // 같은 계산이 그대로 돌아간다 (clampToLane이 길을 따라 접어 준다).
        const knocked = clampToLane(floorDef,
            m.x + (dx / kdist) * character.attackKnockback,
            m.y + (dy / kdist) * character.attackKnockback);
        m.x = knocked.x; m.y = knocked.y;
        clampMonsterToRoom(floorDef, m); // 벽 너머로는 밀려나지 않는다
    }

    // While the ultimate window is open, a landed attack marks the target --
    // unless something else already marked it with a different element.
    if (opts.marks) {
        const marked = applyElementMark(m, character.element, {
            charges: character.ultimateMarkUses,
            multiplier: character.ultimateMarkMultiplier
        }, now);
        if (marked) {
            io.to(roomId).emit('monsterMarked', {
                id: mid, element: m.elementMark.element, charges: m.elementMark.charges
            });
        }
    }

    // 치즈만두맛 패시브: 궁극기와 상관없이 주먹 자체가 표식을 남긴다. 다른
    // 속성이 이미 붙어 있으면 여기서도 거절된다 -- 표식 규칙은 하나뿐이다.
    if (opts.attackMarks) {
        const marked = applyElementMark(m, character.element,
            attackMarkOpts(character, opts.attackMarks), now);
        if (marked) {
            io.to(roomId).emit('monsterMarked', {
                id: mid, element: m.elementMark.element, charges: m.elementMark.charges
            });
        }
    }
}

// The same thing for the raid boss, which keeps its mark on the room rather
// than on itself and heals/burns through the raid room's own helpers.
function landRaidHitOnBoss(roomId, room, attackerId, p, character, baseDamage, now, swing) {
    let dmg = baseDamage;

    // Element mark: a matching-element attacker deals bonus damage vs a marked
    // boss. Goes through the shared helper so a timed mark (폭포 / 마그마 쏟기)
    // behaves the same here.
    const before = room.bossElementMark;
    // markUseOf는 keepsOwnMarks/markEatBonus가 없는 캐릭터에겐 중립값을 주므로
    // swing 여부와 상관없이 항상 계산해도 기존 캐릭터는 그대로다 (버블티맛처럼
    // 날아간 투사체도 자기 표식을 건드리지 않아야 하는 경우를 위해 필요하다).
    const markUse = markUseOf(character, p);
    dmg = Math.round(damageWithMark(bossMarkTarget(room), character, dmg, now, markUse));
    let markChanged = before !== room.bossElementMark
        || (before && room.bossElementMark && before.charges !== room.bossElementMark.charges);

    room.bossHp = Math.max(0, room.bossHp - dmg);
    io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: attackerId });
    const killedBoss = room.bossHp <= 0;
    if (killedBoss) endRoom(roomId, 'win');

    // Some cookies heal whenever the attack actually connects (only a chance to
    // proc, if attackHealChance is set). The ultimate can raise the amount.
    gainKillBuffStack(character, p, killedBoss, now);
    const selfHeal = passiveHitHeal(character, p) + passiveChanceHeal(character, p, swing)
            + lowHpSelfHeal(character, p)
        + vampireKillHeal(character, p, swing, killedBoss);
    if (selfHeal) {
        p.hp = Math.min(p.maxHp, p.hp + selfHeal);
        io.to(roomId).emit('playerHealed', { id: attackerId, hp: p.hp });
    }
    // ultimateType 체크 없이 타이머+수치만 본다 (시금치맛의 attack_heal_boost뿐
    // 아니라 바람궁수맛의 nature_awaken 2단계도 같은 타이머를 재사용한다).
    // 체리크림맛처럼 평소엔 attackHealOnUse가 아예 없고 궁극기 중에만 이 효과가
    // 붙는 캐릭터도 있어서, boosted만으로도 게이트를 통과하도록 일반화했다.
    const attackHealBoosted = character.ultimateHealPerAttack != null && p.attackHealBoostUntil && now < p.attackHealBoostUntil;
    if ((character.attackHealOnUse || attackHealBoosted) && Math.random() < (character.attackHealChance ?? 1)) {
        healTeam(room, roomId, attackHealBoosted ? character.ultimateHealPerAttack : character.attackHealOnUse);
    }
    // 체리크림맛 궁극기(분노): 지속시간 동안 명중할 때마다 팀 전체에게 보호막을
    // 더해 준다(덮어쓰지 않는다 -- addShieldTeam). attackHealBoostUntil을
    // 그대로 같이 쓴다 -- 같은 "분노 창" 안에서 회복/보호막이 함께 켜지므로
    // 타이머를 새로 만들 필요가 없다.
    if (character.ultimateShieldPerAttack && p.attackHealBoostUntil && now < p.attackHealBoostUntil) {
        addShieldTeam(room, roomId, character.ultimateShieldPerAttack);
    }
    // 체리크림맛 패시브: 기본 공격이 적중하면 3초간 이동속도가 빨라진다.
    // 이동은 클라이언트 예측이라, "명중"을 아는 서버가 확인해 줘야 한다.
    if (character.attackSpeedBonusOnHit) {
        io.to(roomId).emit('attackSpeedBoost', { id: attackerId, until: now + character.attackSpeedBoostDurationMs });
    }
    // 치즈케이크맛: 기본 공격이 적중할 때마다 team_heal_over_time과 같은
    // 버프를 하나 새로 쌓는다(덮어쓰지 않는다 -- 연타로 여러 개가 동시에 돈다).
    if (character.attackHealOverTimeOnHit) {
        room.activeBuffs.push({
            type: 'team_heal_over_time',
            tickMs: character.attackHealOverTimeTickMs,
            healPerTick: character.attackHealOverTimeOnHit,
            endAt: now + character.attackHealOverTimeDurationMs,
            lastTickAt: now
        });
    }
    // 암흑바다맛: 기본 공격이 적중할 때마다 팀 전체에게 보호막을 더해 준다
    // (덮어쓰지 않는다 -- addShieldTeam 주석 참고).
    if (character.attackShieldOnUse && Math.random() < (character.attackShieldChance ?? 1)) {
        addShieldTeam(room, roomId, character.attackShieldOnUse);
    }

    // Burn: a couple of small extra ticks after the initial hit.
    if (character.attackBurnDamage) {
        const burnDmg = effectiveBurnDamage(character, p)
            + zoneBurnBonus(character, room, attackerId, 0, 0, BOSS_RADIUS);
        room.activeBuffs.push({
            type: 'attack_burn',
            casterId: attackerId,
            damage: burnDmg,
            tickMs: character.attackBurnIntervalMs,
            ticksLeft: character.attackBurnTicks,
            lastTickAt: now,
            endAt: now + character.attackBurnIntervalMs * character.attackBurnTicks + 200
        });
    }

    // While the ultimate window is active, a landed attack marks the boss.
    if (p.elementMarkUntil && now < p.elementMarkUntil) {
        if (room.bossElementMark && room.bossElementMark.element === character.element) {
            room.bossElementMark.charges += character.ultimateMarkUses;
        } else {
            room.bossElementMark = {
                element: character.element,
                charges: character.ultimateMarkUses,
                multiplier: character.ultimateMarkMultiplier
            };
        }
        markChanged = true;
    }

    // 치즈만두맛/버블티맛 패시브: 궁극기와 상관없이 주먹(또는 던진 투사체) 자체가
    // 표식을 남긴다. attackMarkUses가 없는 캐릭터는 attackMarkChargesOf가 0을
    // 돌려주므로 swing 여부와 상관없이 항상 계산해도 기존 캐릭터는 그대로다.
    const attackMarks = !killedBoss ? attackMarkChargesOf(character, p) : 0;
    if (attackMarks && applyElementMark(bossMarkTarget(room), character.element,
        attackMarkOpts(character, attackMarks), now)) {
        markChanged = true;
    }

    if (markChanged) {
        io.to(roomId).emit('bossMarked', room.bossElementMark
            ? {
                element: room.bossElementMark.element,
                charges: room.bossElementMark.charges,
                until: room.bossElementMark.until
            }
            : { element: null, charges: 0 });
    }
}

function healStoryPlayer(room, roomId, amount) {
    healStoryTeamBy(room, roomId, () => amount);
}

// 팀 회복은 쉬고 있는 쿠키에게도 들어간다. 11층부터는 쿠키를 두 명 데려가는데,
// p.hp는 지금 나와 있는 쿠키의 것뿐이라 파티 전체를 따로 돌아야 한다
// (게스트 레이드의 healGuestTeam과 같은 규칙).
// amountFor(maxHp, index)로 받는 이유는 밀물처럼 쿠키마다 회복량이 다른
// 것(최대 체력의 몇 %)도 같은 길로 보내기 위해서다.
function healStoryTeamBy(room, roomId, amountFor) {
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive) continue;
        if (p.party && p.partyHp) {
            // 싸우는 동안 최신값은 p.hp 쪽이다 (partyHp는 교체할 때만 맞춰진다).
            p.partyHp[p.active] = p.hp;
            let changed = false;
            for (let i = 0; i < p.party.length; i++) {
                if (p.partyAlive && !p.partyAlive[i]) continue; // 쓰러진 쿠키는 회복으로 못 일으킨다
                const add = amountFor(p.partyMaxHp[i], i);
                if (!add) continue;
                const healed = Math.min(p.partyMaxHp[i], p.partyHp[i] + add);
                if (healed !== p.partyHp[i]) { p.partyHp[i] = healed; changed = true; }
            }
            if (!changed) continue;
            p.hp = p.partyHp[p.active];
            io.to(roomId).emit('storyPlayerHealed', { id, hp: p.hp, partyHp: p.partyHp });
            continue;
        }
        const add = amountFor(p.maxHp, 0);
        if (!add) continue;
        const healed = Math.min(p.maxHp, p.hp + add);
        if (healed !== p.hp) {
            p.hp = healed;
            io.to(roomId).emit('storyPlayerHealed', { id, hp: p.hp });
        }
    }
}

// 바람궁수맛 궁극기 3단계 (스토리): 팀 중 죽은 캐릭터가 있으면 하나
// 부활시킨다. 통째로 쓰러진 플레이어를 우선(파티가 있으면 1번 슬롯부터
// 다시 세운다), 없으면 어느 파티에서든 쓰러진 슬롯 하나를 되살린다.
function reviveDownedStoryTeammate(roomId, room) {
    for (const [id, pl] of Object.entries(room.players)) {
        if (pl.alive) continue;
        if (pl.party && pl.party.length) {
            activatePartyCookie(pl, 0, true);
            io.to(roomId).emit('storyPlayerSwapped', {
                id, charType: pl.charType, hp: pl.hp, maxHp: pl.maxHp,
                active: pl.active, partyAlive: pl.partyAlive, partyHp: pl.partyHp
            });
        } else {
            pl.hp = pl.maxHp;
        }
        pl.alive = true;
        io.to(id).emit('storyPlayerRevived', { hp: pl.hp });
        return true;
    }
    for (const [id, pl] of Object.entries(room.players)) {
        if (!pl.partyAlive) continue;
        const idx = pl.partyAlive.findIndex(a => !a);
        if (idx === -1) continue;
        pl.partyAlive[idx] = true;
        pl.partyHp[idx] = pl.partyMaxHp[idx];
        // 지금 나와 있는 쿠키는 그대로라 storyPlayerSwapped를 재활용하면
        // (거긴 "활성 쿠키가 바뀌었다"는 전제로 쿨다운까지 초기화한다) 안 되고,
        // 벤치 쪽 상태만 알려주는 전용 이벤트가 필요하다.
        io.to(id).emit('storyPartyRevived', { partyAlive: pl.partyAlive, partyHp: pl.partyHp });
        return true;
    }
    return false;
}
// 죽은 사람이 없을 때의 대체 효과: 마법진을 열어 팀을 꽉 채우고, 살아있는
// 몬스터 전부의 (지금) 체력을 ultimateSanctuaryEnemyDamageRatio만큼 깎는다.
// 번개지옥맛 부활 충격파와 같은 방식(직접 깎기, 방어막/피해감소 무시).
function natureStorySanctuary(roomId, room, character) {
    healStoryTeamBy(room, roomId, () => Infinity);
    const ratio = character.ultimateSanctuaryEnemyDamageRatio || 0;
    if (!ratio) return;
    for (const [mid, m] of Object.entries(room.monsters)) {
        if (!m.alive) continue;
        const dmg = Math.max(1, Math.round(m.hp * ratio));
        m.hp = Math.max(0, m.hp - dmg);
        if (m.hp <= 0) { m.alive = false; io.to(roomId).emit('monsterDefeated', { id: mid }); }
        else io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
    }
}

function shieldStoryTeam(room, roomId, amount) {
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive) continue;
        p.shieldHp = amount;
        io.to(roomId).emit('storyPlayerShielded', { id, shieldHp: p.shieldHp });
    }
}

// shieldStoryTeam은 덮어쓴다(궁극기용). 공격 적중마다 주는 보호막은 더한다
// -- addShieldTeam과 같은 이유(server.js 주석 참고).
function addShieldStoryTeam(room, roomId, amount) {
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive) continue;
        p.shieldHp = (p.shieldHp || 0) + amount;
        io.to(roomId).emit('storyPlayerShielded', { id, shieldHp: p.shieldHp });
    }
}

// 스토리 방에서 남에게 보여도 되는 사람 정보만.
function publicStoryPlayers(room) {
    const out = {};
    for (const [id, p] of Object.entries(room.players)) {
        out[id] = {
            x: p.x, y: p.y, facing: p.facing, charType: p.charType,
            hp: p.hp, maxHp: p.maxHp, alive: p.alive,
            shieldHp: p.shieldHp || 0, ready: !!p.ready,
            untouchableUntil: p.untouchableUntil || 0
        };
    }
    return out;
}

// 솔로는 들어오자마자, 멀티는 둘 다 준비를 누른 뒤에 여기로 온다.
function startStoryFight(roomId) {
    const room = rooms[roomId];
    if (!room || room.kind !== 'story' || room.loopHandle) return;
    const floorDef = floorDefFor(room.floor);
    if (!floorDef) return;
    room.state = 'fighting';
    for (const [id, p] of Object.entries(room.players)) {
        io.to(id).emit('storyFloorStarted', {
            floor: room.floor,
            floorDef: {
                // axis matters to every clamp/camera/draw on the client, so it
                // has to travel with the rest of the layout.
                axis: floorDef.axis,
                levelLength: floorDef.levelLength,
                laneHalfWidth: floorDef.laneHalfWidth,
                // 꺾은선 다리(4층부터)는 꺾이는 지점까지 넘겨야 클라이언트가
                // 같은 길을 그리고 같은 자리로 클램프한다.
                path: floorDef.path,
                // 챕터별 다리 색(용암 챕터의 붉은 다리, 레전드 스토리의 검정
                // 등) -- 안 보내면 클라이언트는 기본 갈색 다리로 그린다.
                deckColor: floorDef.deckColor,
                deckGlow: floorDef.deckGlow,
                // 레전드 스토리 전용(다른 층은 전부 undefined로 넘어가 그대로
                // 무시된다): 갈림길, 스위치/보물상자 위치.
                forks: floorDef.forks,
                switches: floorDef.switches,
                chests: floorDef.chests,
                gates: floorDef.gates,
                star: floorDef.star
            },
            player: p,
            players: publicStoryPlayers(room),
            monsters: publicMonsters(room),
            projectiles: publicProjectiles(room)
        });
    }
    room.loopHandle = setInterval(() => tickStoryRoom(roomId), 50);
}

function endStoryRoom(roomId, result) {
    const room = rooms[roomId];
    if (!room) return;
    if (room.loopHandle) clearInterval(room.loopHandle);
    room.state = 'ended';
    io.to(roomId).emit('storyFloorResult', { result, floor: room.floor });
    delete rooms[roomId];
}

// ==================== 각성모드 보스의 스킬과 궁극기 ====================
// 보스는 그 쿠키의 스킬/궁극기를 쓴다. 수치는 레벨 표를 따른다.
// 화면에는 boss-ability 하나로만 알려 주고(자리와 반경), 나머지는 이미 있는
// 충격 효과가 그려 준다.
function awakenBossSpecOf(m) {
    const def = MONSTERS[m && m.type];
    if (!def || !def.awakenCharType) return null;
    return { charType: def.awakenCharType, level: def.awakenLevel, def };
}

function nearestStoryPlayer(room, m) {
    let best = null, bestD = Infinity;
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive) continue;
        const d = Math.hypot(p.x - m.x, p.y - m.y);
        if (d < bestD) { bestD = d; best = { id, p, d }; }
    }
    return best;
}

function healAwakenBoss(roomId, mid, m, amount) {
    if (!amount) return;
    m.hp = Math.min(m.maxHp, m.hp + Math.round(amount));
    io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
}

// 보스 둘레 radius 안의 사람들을 때린다. 맞힌 사람 수를 돌려준다.
function awakenBossHitAround(roomId, room, m, radius, damage) {
    let hits = 0;
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive) continue;
        if (Math.hypot(p.x - m.x, p.y - m.y) > radius + PLAYER_RADIUS) continue;
        hits++;
        applyDamageToStoryPlayer(roomId, id, damage);
        if (!rooms[roomId]) return hits;
    }
    return hits;
}

function useAwakenBossSkill(roomId, room, mid, m, now) {
    const info = awakenBossSpecOf(m);
    if (!info) return;
    const base = CHARACTERS[info.charType];
    const dmg = awakenBossSkillDamage(info.charType, info.level) || 0;
    const radius = base.skillRange || base.skillRadius || 160;
    io.to(roomId).emit('bossAbility', {
        id: mid, kind: 'skill', type: base.skillType, x: m.x, y: m.y, radius
    });
    switch (base.skillType) {
        case 'earthquake':
            // 지진은 겨냥이 없다 -- 마당 전체가 흔들린다.
            awakenBossHitAround(roomId, room, m, 100000, dmg);
            break;
        case 'blink_heal': {
            // 가장 가까운 사람 옆으로 순간이동하고 스스로 회복한다.
            const near = nearestStoryPlayer(room, m);
            if (near) {
                const floorDef = floorDefFor(room.floor);
                const spot = clampToLane(floorDef, near.p.x + 60, near.p.y);
                m.x = spot.x; m.y = spot.y;
                io.to(roomId).emit('bossBlink', { id: mid, x: m.x, y: m.y });
            }
            healAwakenBoss(roomId, mid, m, m.maxHp * (base.skillHealRatio || 0));
            break;
        }
        case 'pull_in': {
            // 끌어오기: 둘레의 사람들을 보스 앞으로 당긴다.
            for (const [id, p] of Object.entries(room.players)) {
                if (!p.alive) continue;
                if (Math.hypot(p.x - m.x, p.y - m.y) > (base.skillRange || 260)) continue;
                const floorDef = floorDefFor(room.floor);
                const spot = clampToLane(floorDef, m.x + 70, m.y);
                p.x = spot.x; p.y = spot.y;
                io.to(roomId).emit('storyPlayerPulled', { id, x: p.x, y: p.y });
            }
            break;
        }
        case 'wide_slash': {
            // 크게베기: 맞힌 사람 수만큼 스스로 회복한다.
            const hits = awakenBossHitAround(roomId, room, m, radius, dmg);
            if (!rooms[roomId]) return;
            const heal = awakenBossSkillHealOnHit(info.charType, info.level) || 0;
            if (hits > 0) healAwakenBoss(roomId, mid, m, heal);
            break;
        }
        default:
            // 발차기(kick)를 비롯한 나머지는 앞쪽 반경을 그냥 때린다.
            awakenBossHitAround(roomId, room, m, radius, dmg);
            break;
    }
}

function useAwakenBossUltimate(roomId, room, mid, m, now) {
    const info = awakenBossSpecOf(m);
    if (!info) return;
    const base = CHARACTERS[info.charType];
    const radius = base.ultimateRange || base.ultimateRadius || 260;
    io.to(roomId).emit('bossAbility', {
        id: mid, kind: 'ultimate', type: base.ultimateType, x: m.x, y: m.y, radius
    });
    switch (base.ultimateType) {
        case 'great_slash':
            awakenBossHitAround(roomId, room, m, radius,
                awakenBossUltimateDamage(info.charType, info.level) || 0);
            break;
        case 'undying_soul': {
            // 스스로 크게 회복하고, 잠시 더 세게 때리고, 부하를 부른다.
            healAwakenBoss(roomId, mid, m, m.maxHp * (base.ultimateHealRatio || 0));
            const boosted = awakenBossUltimateAttackDamage(info.charType, info.level);
            if (boosted && info.def.attackDamage) {
                // 나가는 피해 배수는 이미 있는 장치를 그대로 쓴다.
                m.damageDebuffUntil = now + base.ultimateDurationMs;
                m.damageDebuffMultiplier = boosted / info.def.attackDamage;
            }
            spawnAwakenBossMinions(roomId, room, m, info, now);
            break;
        }
        case 'guard_surge':
        case 'team_guard': {
            const flat = awakenBossUltimateHealAmount(info.charType, info.level) || 0;
            const ratio = base.ultimateHealRatio || 0;
            healAwakenBoss(roomId, mid, m, flat + m.maxHp * ratio);
            const shield = awakenBossUltimateShield(info.charType, info.level) || 0;
            if (shield) {
                m.shieldHp = shield;
                io.to(roomId).emit('monsterShield', { id: mid, shieldHp: m.shieldHp });
            }
            break;
        }
        case 'awakening_rapid':
            // 각성: 잠시 공격이 훨씬 빨라진다.
            m.rapidUntil = now + base.ultimateDurationMs;
            m.rapidCooldown = Math.max(120, base.ultimateRapidCooldown || 150);
            break;
        default:
            awakenBossHitAround(roomId, room, m, radius, base.ultimateDamage || 0);
            break;
    }
}

// 번개지옥맛 보스의 부하. 사람을 노리는 진짜 적으로 마당에 세운다.
// summonedBy가 붙어 있어서 이기고 지는 판정에는 세지 않는다 -- 보스만 잡으면
// 이긴다.
function spawnAwakenBossMinions(roomId, room, boss, info, now) {
    const count = awakenBossSummonCount(info.charType, info.level);
    const health = awakenBossSummonHealth(info.charType, info.level);
    const summon = CHARACTERS[info.charType].ultimateSummon;
    if (!count || !summon) return;
    // 부하 표는 shared.js가 미리 등록해 둔다 (화면도 같은 표를 읽어야 한다).
    // 표에 없으면 화면이 이 type을 몰라서 그림이 멈추므로 아예 부르지 않는다.
    const type = awakenMinionMonsterType(info.charType, info.level);
    if (!MONSTERS[type]) return;
    const floorDef = floorDefFor(room.floor);
    const until = now + (CHARACTERS[info.charType].ultimateDurationMs || 10000);
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const spot = clampToLane(floorDef, boss.x + Math.cos(angle) * 60, boss.y + Math.sin(angle) * 60);
        room.monsters[`bm${room.nextMinionId = (room.nextMinionId || 0) + 1}`] = {
            type, x: spot.x, y: spot.y,
            hp: health, maxHp: health,
            alive: true, state: 'idle', roomIndex: 0,
            elementMark: null,
            summonedBy: 'boss', expiresAt: until
        };
    }
    io.to(roomId).emit('bossMinions', { monsters: publicMonsters(room) });
}

// 보스도 그 쿠키의 부활 패시브를 그대로 쓴다. 번개악마맛은 체력 절반으로,
// 번개지옥맛은 가득 채워 일어나면서 주위를 쓸어버린다.
// 죽는 길이 여럿(기본공격·스킬·부하·화염·마그마…)이라 한 군데에서 잡지 않고,
// 틱마다 "쓰러졌는데 아직 일어날 수 있는 보스"를 찾아 세운다.
function tryReviveAwakenBoss(roomId, room, mid, m) {
    const info = awakenBossSpecOf(m);
    if (!info) return false;
    const base = CHARACTERS[info.charType];
    const count = base.passiveReviveCount || 0;
    if (!count || (m.revivesUsed || 0) >= count) return false;

    m.revivesUsed = (m.revivesUsed || 0) + 1;
    m.alive = true;
    m.hp = Math.max(1, Math.round(m.maxHp * (base.passiveReviveHpRatio || 0.5)));
    m.shieldHp = 0;
    io.to(roomId).emit('bossRevived', {
        id: mid, hp: m.hp, maxHp: m.maxHp,
        left: count - m.revivesUsed,
        x: m.x, y: m.y,
        monsters: publicMonsters(room)
    });

    // 일어나면서 터지는 충격파 (번개지옥맛). 사람 수로 단독/다수를 고른다.
    const targets = Object.entries(room.players).filter(([, p]) => p.alive);
    const ratio = reviveBlastRatio(base, targets.length);
    if (ratio) {
        io.to(roomId).emit('bossReviveBlast', { id: mid, x: m.x, y: m.y, ratio });
        for (const [id, p] of targets) {
            applyDamageToStoryPlayer(roomId, id, Math.max(1, Math.round(p.hp * ratio)));
            if (!rooms[roomId]) return true;
        }
    }
    return true;
}

// 보스가 스스로 스킬과 궁극기를 쓴다. 쿨타임은 그 쿠키의 것을 그대로 쓴다.
function tickAwakenBoss(roomId, room, now) {
    // 먼저 부활부터 본다 -- 안 그러면 쓰러진 그 틱에 이긴 것으로 끝나 버린다.
    for (const [mid, m] of Object.entries(room.monsters)) {
        if (m.alive || m.summonedBy) continue;
        if (tryReviveAwakenBoss(roomId, room, mid, m)) {
            if (!rooms[roomId]) return;
        }
    }
    for (const [mid, m] of Object.entries(room.monsters)) {
        if (!m.alive || m.summonedBy) continue;
        const info = awakenBossSpecOf(m);
        if (!info) continue;
        const base = CHARACTERS[info.charType];
        // 처음부터 바로 쓰지 않게 한 박자 쉬고 시작한다.
        if (!m.abilityStartAt) m.abilityStartAt = now + 2500;
        if (now < m.abilityStartAt) continue;
        if (base.skillCooldown && now - (m.lastSkillAt || 0) >= base.skillCooldown) {
            m.lastSkillAt = now;
            useAwakenBossSkill(roomId, room, mid, m, now);
            if (!rooms[roomId]) return;
        }
        if (base.ultimateCooldownMs && now - (m.lastUltAt || 0) >= base.ultimateCooldownMs) {
            m.lastUltAt = now;
            useAwakenBossUltimate(roomId, room, mid, m, now);
            if (!rooms[roomId]) return;
        }
    }
    // 시간이 다 된 부하는 사라진다.
    for (const [mid, m] of Object.entries(room.monsters)) {
        if (m.summonedBy && m.alive && m.expiresAt && now >= m.expiresAt) {
            m.alive = false;
            io.to(roomId).emit('monsterDefeated', { id: mid });
        }
    }
}

// 각성모드 파티: 쓰러진 쿠키 대신 아직 살아 있는 다음 쿠키를 세운다.
// 파티가 없거나 남은 쿠키가 없으면 null.
function swapToNextPartyCookie(p) {
    if (!p.party || !p.party.length) return null;
    p.partyAlive[p.active] = false;
    const next = p.partyAlive.findIndex(a => a);
    if (next < 0) return null;
    activatePartyCookie(p, next, true);
    return next;
}

// 파티의 index번째 쿠키를 세운다. fresh면 체력을 가득 채워 새로 들어온다.
// 자유 교체는 fresh가 아니라 그 쿠키가 쉬는 동안의 체력을 그대로 가져간다.
function activatePartyCookie(p, next, fresh) {
    if (p.party && p.partyHp && !fresh) p.partyHp[p.active] = p.hp;
    p.active = next;
    p.charType = p.party[next];
    p.character = p.partyCharacter[next];
    p.awakenGear = p.partyAwakenGear[next];
    p.bonus = p.partyBonus[next];
    p.maxHp = p.partyMaxHp[next];
    // 쓰러져서 바뀐 것이면 새 쿠키가 가득 찬 체력으로 들어오고,
    // 자유 교체면 그 쿠키가 쉬는 동안 남아 있던 체력을 그대로 쓴다.
    p.hp = fresh ? p.partyMaxHp[next] : (p.partyHp ? p.partyHp[next] : p.partyMaxHp[next]);
    p.shieldHp = 0;
    if (fresh) { p.revivesUsed = 0; p.awakened = false; p.natureAwakenLevel = 0; }
    // 새로 들어온 쿠키는 쿨다운을 처음부터 쓴다.
    p.lastAttackTime = 0; p.lastSkillTime = 0; p.lastUltimateTime = 0;
    p.undyingSoulUntil = 0; p.rapidStrikeUntil = 0; p.awakenUntil = 0;
    p.guardStanceUntil = 0; p.elementMarkUntil = 0; p.attackHealBoostUntil = 0;
    resetBodyFormIfNeeded(p);
    return next;
}

function applyDamageToStoryPlayer(roomId, playerId, dmg, sourceElementMark) {
    const room = rooms[roomId];
    if (!room) return;
    const p = room.players[playerId];
    if (!p || !p.alive) return;
    p.lastHitAt = Date.now(); // 매직블록맛 패시브(focusModeActive)가 읽는다
    const character = charOf(p);
    dmg = Math.round(dmg * damageReductionMultiplier(character, p, Date.now(), sourceElementMark));
    if (p.shieldHp > 0) {
        const absorbed = Math.min(p.shieldHp, dmg);
        p.shieldHp -= absorbed;
        dmg -= absorbed;
    }
    p.hp = Math.max(0, p.hp - dmg);
    let revived = false;
    let swapped = null;
    if (p.hp <= 0) {
        revived = tryRevive(p, character, bonusOf(p).revive);
        // 각성모드는 쿠키 3명을 데려간다. 하나가 쓰러지면 다음 쿠키가 들어오고,
        // 셋이 다 쓰러져야 진다.
        if (!revived) swapped = swapToNextPartyCookie(p);
        if (!revived && !swapped) p.alive = false;
    }
    io.to(roomId).emit('storyPlayerDamaged', { id: playerId, hp: p.hp, alive: p.alive, shieldHp: p.shieldHp || 0 });
    if (revived) {
        io.to(roomId).emit('storyPlayerRevived', { id: playerId, hp: p.hp });
        applyReviveBlastToMonsters(roomId, room, character, playerId, p);
        return;
    }
    if (swapped) {
        io.to(roomId).emit('storyPlayerSwapped', {
            id: playerId, charType: p.charType, hp: p.hp, maxHp: p.maxHp,
            active: p.active, partyAlive: p.partyAlive
        });
        return;
    }
    if (!p.alive && Object.values(room.players).every(pl => !pl.alive)) {
        endStoryRoom(roomId, 'lose');
    }
}

// A raised energy shield is solid to attacks, not just to walking. Without this
// a laser_robot in the next room (620px reach) happily burns the player through
// the shield while they're still fighting the room in front of it.
function shieldBetween(room, floorDef, m, p) {
    if (!floorDef.gates) return false;
    const mAlong = alongOf(floorDef, m.x, m.y);
    const pAlong = alongOf(floorDef, p.x, p.y);
    for (const gate of floorDef.gates) {
        if (!gateSealed(room, gate)) continue;
        for (const edge of [gate.entrance, gate.exit]) {
            if ((mAlong < edge) !== (pAlong < edge)) return true;
        }
    }
    return false;
}

// ==================== 속성부여 (element marks) ====================
// A target carries at most ONE mark. If it is already marked with a DIFFERENT
// element, the new mark is refused outright -- 먼저 부여한 속성만 적용된다 --
// so a 물 mark can't wipe a 바람 mark (or the other way round) mid-fight.
// Marking again with the SAME element tops the existing mark up instead.
//
// A mark is either charge-based ({ charges }) or timed ({ until, unlimited }).
// Timed marks ignore charges entirely for their whole window.
function applyElementMark(target, element, opts, now) {
    const cur = target.elementMark;
    if (cur && !elementMarkExpired(cur, now) && cur.element !== element) return false;
    if (cur && !elementMarkExpired(cur, now) && cur.element === element) {
        if (opts.durationMs) {
            cur.unlimited = true;
            cur.until = Math.max(cur.until || 0, now + opts.durationMs);
        } else {
            cur.charges = (cur.charges || 0) + opts.charges;
        }
        cur.multiplier = Math.max(cur.multiplier || 1, opts.multiplier);
        return true;
    }
    target.elementMark = opts.durationMs
        ? { element, unlimited: true, until: now + opts.durationMs, multiplier: opts.multiplier }
        : { element, charges: opts.charges, multiplier: opts.multiplier };
    return true;
}

// A raid/guest boss keeps its mark on the room instead of on a monster object.
// This wrapper lets the mark helpers above work on it without a second copy.
function bossMarkTarget(room) {
    return {
        get elementMark() { return room.bossElementMark; },
        set elementMark(v) { room.bossElementMark = v; }
    };
}

// 물방울맛 / 마그마맛 both hand out an element mark over a circle rather than on
// a hit. `opts` is either { charges, multiplier } or { durationMs, multiplier }.
function markMonstersInCircle(roomId, room, x, y, radius, element, opts) {
    const now = Date.now();
    let marked = 0;
    for (const [mid, m] of Object.entries(room.monsters || {})) {
        if (!m.alive) continue;
        if (Math.hypot(x - m.x, y - m.y) > radius + mR(m)) continue;
        if (!applyElementMark(m, element, opts, now)) continue; // another element got there first
        marked++;
        io.to(roomId).emit('monsterMarked', {
            id: mid, element: m.elementMark.element,
            charges: m.elementMark.charges, until: m.elementMark.until
        });
    }
    return marked;
}

// Same thing for the single boss in a raid/guest room.
function markBossInCircle(roomId, room, x, y, radius, element, opts, ev) {
    if (Math.hypot(x, y) > radius + BOSS_RADIUS) return 0;
    if (!applyElementMark(bossMarkTarget(room), element, opts, Date.now())) return 0;
    io.to(roomId).emit(ev, {
        element: room.bossElementMark.element,
        charges: room.bossElementMark.charges,
        until: room.bossElementMark.until
    });
    return 1;
}

// The options bag for a cookie's mark-granting skill / ultimate.
// A click-to-place ability's target, validated. Returns null for anything that
// isn't a real pair of finite numbers so a garbage payload can't place a zone.
function targetPoint(payload) {
    const x = payload && payload.targetX;
    const y = payload && payload.targetY;
    if (typeof x !== 'number' || typeof y !== 'number') return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
}

// Keeps a placed point inside the round arena the raid/guest rooms use.
function clampToArena(x, y, radius) {
    const dist = Math.hypot(x, y);
    if (dist <= radius) return { x, y };
    const scale = dist > 0 ? radius / dist : 0;
    return { x: x * scale, y: y * scale };
}

function skillMarkOpts(character) {
    return { charges: character.skillMarkUses, multiplier: character.skillMarkMultiplier };
}
function ultimateMarkOpts(character) {
    return { durationMs: character.ultimateMarkDurationMs, multiplier: character.ultimateMarkMultiplier };
}

// 치즈만두맛 패시브: 기본공격이 적중할 때마다 스스로 표식을 남긴다. 각성하면
// awakenedForm이 attackMarkUses를 0으로 덮어써서 더 이상 남기지 않는다.
// 본능해제 5강(청사과맛): instinctAttackMarkChance가 있으면 매번이 아니라 그
// 확률만큼만 표식을 남긴다 (없는 캐릭터는 지금까지처럼 항상 남긴다).
// 매직블록맛 궁극기: 각성 중엔 공격할 때마다 자기 속성 표식을 남긴다
// (평소엔 안 남김). ultimateAttackMarkUses가 있는 캐릭터에서만 확인한다.
function attackMarkChargesOf(character, p) {
    if (character.ultimateAttackMarkUses && p && p.awakenUntil && Date.now() < p.awakenUntil) {
        return character.ultimateAttackMarkUses;
    }
    const charges = stat(character, p, 'attackMarkUses') || 0;
    if (!charges) return 0;
    if (character.instinctAttackMarkChance != null && Math.random() >= character.instinctAttackMarkChance) return 0;
    return charges;
}
function attackMarkOpts(character, charges) {
    return { charges, multiplier: character.attackMarkMultiplier || 1.3 };
}

// 이 쿠키가 자기 앞의 표식을 어떻게 대하는가. 기본은 "먹고 배수를 받는다"이고,
// 표식을 쌓는 쿠키(치즈만두맛)만 두 가지가 다르다:
//   skip  = 자기 표식을 아예 건드리지 않는다 (쌓기만 한다)
//   bonus = 먹을 때 배수 대신 한 개당 이만큼을 더한다 (각성한 뒤)
function markUseOf(character, p) {
    return {
        skip: !!stat(character, p, 'keepsOwnMarks'),
        bonus: stat(character, p, 'markEatBonus') || 0
    };
}

// 표식이 붙은 대상에 한 방 넣을 때의 최종 피해. use가 없으면 지금까지와 똑같이
// 배수만 적용된다.
function damageWithMark(target, character, baseDamage, now, use) {
    if (use && use.skip) return baseDamage;
    const mult = consumeElementMark(target, character, now);
    if (mult === 1) return baseDamage;
    if (use && use.bonus) return baseDamage + use.bonus; // 배수 대신 더하기
    return baseDamage * mult;
}

// 만두 주먹: 대상에 쌓인 자기 속성 표식을 한 번에 터뜨린다. 터진 만큼 표식이
// 사라지고, 표식 한 개당 skillMarkBurstDamage의 추가 피해를 돌려준다.
// 시간짜리 표식(폭포·마그마 쏟기)은 횟수가 없으므로 터지지 않는다.
function burstElementMarks(target, character) {
    const per = character.skillMarkBurstDamage;
    if (!per) return 0;
    const mark = target.elementMark;
    if (!mark || mark.element !== character.element || !mark.charges) return 0;
    const n = Math.min(mark.charges, character.skillMarkBurstMax || Infinity);
    mark.charges -= n;
    if (mark.charges <= 0) target.elementMark = null;
    return n * per;
}

// 지대 궁극기(화산맛 마그마 지대 · 치즈만두맛 덩어리)는 같은 buff 하나로
// 돌아간다. 표식을 같이 박는지, 화면에 무엇으로 그리는지만 다르다.
function zoneMarkFields(character) {
    if (!character.ultimateZoneMarkUses) return {};
    return {
        markElement: character.element,
        markCharges: character.ultimateZoneMarkUses,
        markMultiplier: character.ultimateZoneMarkMultiplier || 1.3
    };
}
function zoneLookOf(character) {
    return character.ultimateType === 'dumpling_zone' ? 'dumpling' : 'magma';
}

// 레몬갑옷: 궁극기를 쓰면 주변의 모든 적이 그 쿠키의 속성 표식을 여러 번
// 받는다. 표식 규칙은 마그마맛/물방울맛의 것과 똑같다 -- 다른 속성이 이미
// 붙어 있으면 거절되고, 같은 속성이면 횟수가 쌓인다.
function applyAwakenUltimateMark(roomId, room, p, character, bossEvent) {
    const spec = p && p.awakenGear && p.awakenGear.awakenUltimateMark;
    if (!spec) return;
    const opts = { charges: spec.charges, multiplier: spec.multiplier };
    markMonstersInCircle(roomId, room, p.x, p.y, spec.radius, character.element, opts);
    if (bossEvent) {
        markBossInCircle(roomId, room, p.x, p.y, spec.radius, character.element, opts, bossEvent);
    }
}

function elementMarkExpired(mark, now) {
    if (!mark) return true;
    if (mark.until && now >= mark.until) return true;
    return !mark.unlimited && mark.charges <= 0;
}

// Damage multiplier this attacker gets against the target's mark, burning a
// charge if it uses one. Returns 1 when the mark doesn't apply.
function consumeElementMark(target, character, now) {
    const mark = target.elementMark;
    if (!mark) return 1;
    if (elementMarkExpired(mark, now)) { target.elementMark = null; return 1; }
    if (mark.element !== character.element) return 1;
    if (!mark.unlimited) {
        mark.charges -= 1;
        if (mark.charges <= 0) target.elementMark = null;
    }
    return mark.multiplier;
}

function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}

// One tick of a laser_robot's held beam. The beam swings toward the nearest
// player, but its tip is limited to laserTrackSpeed px/sec sideways -- a cookie
// moves ~120 px/sec, so running out of the beam is always possible. Anyone
// caught in the corridor takes laserDamage every laserTickMs.
function tickLaser(ctx, m, mid, def, nearest, alivePlayers, now) {
    const { roomId, room } = ctx;
    if (now >= m.laser.endAt) {
        m.laser = null;
        m.state = 'idle';
        m.nextAttackAt = now + monsterAttackCooldown(m, def, now);
        return;
    }

    // Convert the allowed sideways travel into an angular step at the target's
    // current distance, so the limit means the same thing near and far.
    const dist = Math.max(1, Math.hypot(nearest.x - m.x, nearest.y - m.y));
    const maxStep = (def.laserTrackSpeed * (50 / 1000)) / dist;
    const want = normalizeAngle(Math.atan2(nearest.y - m.y, nearest.x - m.x) - m.laser.angle);
    m.laser.angle = normalizeAngle(m.laser.angle + Math.max(-maxStep, Math.min(maxStep, want)));

    if (now < m.laser.nextDamageAt) return;
    m.laser.nextDamageAt += def.laserTickMs;
    for (const p of alivePlayers) {
        if (!meleeLineHitPoint(m.x, m.y, m.laser.angle, def.laserRange, def.laserWidth, p.x, p.y, PLAYER_RADIUS)) continue;
        ctx.damageTarget(p, def.laserDamage * outgoingDamageMultiplier(m, now), m.elementMark);
        if (!rooms[roomId]) return; // that hit may have ended the floor
    }
}

// Fisher-Yates. Only used for the 20층 boss's nine_cells pattern so far.
function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// nine_cells: which of the 3x3 grid (centered on the boss) a player is
// standing in. Grid cell size/half-extent are fixed constants -- not derived
// from the lane width -- so the grid always reads the same regardless of how
// wide a given floor's lane is.
const CLOWN_CELL_SIZE = 180;
const CLOWN_GRID_HALF = 270; // 1.5 * CLOWN_CELL_SIZE
function clownCellOf(floorDef, m, p) {
    const alongBoss = alongOf(floorDef, m.x, m.y);
    const along = alongOf(floorDef, p.x, p.y);
    const across = acrossOf(floorDef, p.x, p.y);
    const col = Math.min(2, Math.max(0, Math.floor((across + CLOWN_GRID_HALF) / CLOWN_CELL_SIZE)));
    const row = Math.min(2, Math.max(0, Math.floor((along - (alongBoss - CLOWN_GRID_HALF)) / CLOWN_CELL_SIZE)));
    return row * 3 + col;
}

// 되돌아오는 대가 패시브(2페이즈부터): 보스가 플레이어를 맞출 때마다 회복.
// 모든 가면광대 패턴의 데미지 적용은 이 헬퍼를 거친다.
function dealClownDamage(ctx, m, mid, playerId, dmg, phase) {
    ctx.damagePlayer(playerId, dmg);
    if (!rooms[ctx.roomId] || !m.alive) return;
    if (phase.passive && phase.passive.healOnHit && m.hp < m.maxHp) {
        m.hp = Math.min(m.maxHp, m.hp + phase.passive.healOnHit);
        io.to(ctx.roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
    }
}

// ---- 20층 보스: 가면광대 ----
// 일반 몬스터 AI(추격+단발 공격, tickMonsterSet 본문)와 완전히 분리된 상태
// 머신. m.state(idle/telegraph/active)는 그대로 재사용하고, 패턴별 진행
// 상황은 m.trick* 필드에 둔다. 페이즈는 매 틱 현재 체력으로 다시 구한다
// (boss3PhaseFor) -- 체력이 깎여 페이즈가 바뀌는 순간 다음 패턴부터 자동으로
// 그 페이즈의 조합/수치를 쓰게 된다.
function tickClownBoss(ctx, m, mid, now) {
    const { roomId, room, floorDef } = ctx;
    if (!floorDef || !m.alive) return;
    const phase = boss3PhaseFor(m.hp);

    // 발악(3페이즈)부터 붙는 초당 자연 회복. 50ms 틱이라 분수로 누적한다.
    if (phase.passive && phase.passive.regenPerSec) {
        m.trickRegenAcc = (m.trickRegenAcc || 0) + phase.passive.regenPerSec * 0.05;
        if (m.trickRegenAcc >= 1 && m.hp < m.maxHp) {
            const amt = Math.floor(m.trickRegenAcc);
            m.trickRegenAcc -= amt;
            m.hp = Math.min(m.maxHp, m.hp + amt);
            io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
        }
    }

    if (m.state === 'idle') {
        if (!m.trickNextAttackAt) m.trickNextAttackAt = now + phase.patternIntervalMs;
        if (now < m.trickNextAttackAt) return;
        const pattern = phase.patternKeys[Math.floor(Math.random() * phase.patternKeys.length)];
        const stat = boss3PatternStat(pattern, phase.key);
        m.trickPattern = pattern;
        m.trickPhaseKey = phase.key;
        m.trickPatternStartAt = now;
        m.trickRuntime = {};
        m.state = 'telegraph';

        if (pattern === 'fake_slash') {
            const baseAngle = Math.random() * Math.PI * 2;
            const reversed = Math.random() < stat.reverseChance;
            const halfSpan = stat.arcFraction * Math.PI;
            m.trickRuntime = { baseAngle, reversed, halfSpan, damage: stat.damage };
            io.to(roomId).emit('clownTelegraph', {
                id: mid, pattern, telegraphMs: stat.telegraphMs, baseAngle, halfSpan, reversed
            });
        } else if (pattern === 'decoy_flicker') {
            m.trickRuntime = { endAt: now + stat.maxDurationMs, flickerNextAt: now, fakeWeight: stat.fakeWeight };
            m.trickFlickerReal = true;
            m.state = 'active'; // no telegraph beat -- the flicker window starts immediately
            io.to(roomId).emit('clownTelegraph', { id: mid, pattern, telegraphMs: 0, maxDurationMs: stat.maxDurationMs });
        } else if (pattern === 'reverse_steps') {
            const until = now + stat.durationMs;
            m.trickRuntime = { until, dot: stat.dotDamagePerSec, heal: stat.bossHealPerSec, lastTickAt: now };
            m.state = 'active';
            io.to(roomId).emit('clownTelegraph', { id: mid, pattern, telegraphMs: 0, until });
            io.to(roomId).emit('storyReverseControls', { until });
        } else if (pattern === 'nine_cells') {
            const cellIds = shuffled([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, stat.safeCellCount);
            const fakeCount = Math.floor(Math.random() * (stat.maxFakeCount + 1));
            const fakeSet = new Set(shuffled(cellIds).slice(0, fakeCount));
            const cells = cellIds.map(id => ({ id, fake: fakeSet.has(id) }));
            m.trickRuntime = { cells, damage: stat.damage };
            io.to(roomId).emit('clownTelegraph', { id: mid, pattern, telegraphMs: stat.telegraphMs, cells });
        } else if (pattern === 'vanish_strike') {
            const hitCount = stat.hitCountMin + Math.floor(Math.random() * (stat.hitCountMax - stat.hitCountMin + 1));
            m.trickRuntime = {
                hitCount, hitIndex: 0, intervalMs: stat.intervalMs, hintMs: stat.hintMs,
                damage: stat.damage, nextHitAt: now + stat.intervalMs, realSide: null
            };
            m.state = 'active';
            io.to(roomId).emit('clownTelegraph', { id: mid, pattern, telegraphMs: 0, hitCount, intervalMs: stat.intervalMs });
        }
        return;
    }

    if (m.state === 'telegraph') {
        const stat = boss3PatternStat(m.trickPattern, m.trickPhaseKey);
        if (now - m.trickPatternStartAt < stat.telegraphMs) return;

        if (m.trickPattern === 'fake_slash') {
            const { baseAngle, reversed, halfSpan, damage } = m.trickRuntime;
            const hits = [];
            for (const [pid, p] of Object.entries(room.players)) {
                if (!p.alive) continue;
                const angle = Math.atan2(p.y - m.y, p.x - m.x);
                let diff = Math.abs(angle - baseAngle) % (Math.PI * 2);
                if (diff > Math.PI) diff = Math.PI * 2 - diff;
                const inArc = diff <= halfSpan;
                const danger = reversed ? !inArc : inArc;
                if (danger) { hits.push(pid); dealClownDamage(ctx, m, mid, pid, damage, phase); if (!rooms[roomId]) return; }
            }
            io.to(roomId).emit('clownAttack', { id: mid, pattern: 'fake_slash', hits });
        } else if (m.trickPattern === 'nine_cells') {
            const hits = [];
            for (const [pid, p] of Object.entries(room.players)) {
                if (!p.alive) continue;
                const cell = clownCellOf(floorDef, m, p);
                const found = m.trickRuntime.cells.find(c => c.id === cell);
                if (!found || found.fake) {
                    hits.push(pid);
                    dealClownDamage(ctx, m, mid, pid, m.trickRuntime.damage, phase);
                    if (!rooms[roomId]) return;
                }
            }
            io.to(roomId).emit('clownAttack', { id: mid, pattern: 'nine_cells', hits });
        }
        m.state = 'idle';
        m.trickNextAttackAt = now + phase.patternIntervalMs;
        return;
    }

    if (m.state === 'active') {
        if (m.trickPattern === 'decoy_flicker') {
            const rt = m.trickRuntime;
            if (now >= rt.endAt) { m.state = 'idle'; m.trickNextAttackAt = now + phase.patternIntervalMs; return; }
            if (now >= rt.flickerNextAt) {
                m.trickFlickerReal = !m.trickFlickerReal;
                // 가짜로 보이는 구간이 fakeWeight배 더 길다 -- 뒷페이즈일수록 속기 쉽다.
                rt.flickerNextAt = now + (m.trickFlickerReal ? 900 : 900 * rt.fakeWeight);
                io.to(roomId).emit('clownFlicker', { id: mid, real: m.trickFlickerReal });
            }
        } else if (m.trickPattern === 'reverse_steps') {
            const rt = m.trickRuntime;
            if (now - rt.lastTickAt >= 1000) {
                rt.lastTickAt += 1000;
                if (rt.dot) {
                    for (const [pid, p] of Object.entries(room.players)) {
                        if (!p.alive) continue;
                        ctx.damagePlayer(pid, rt.dot);
                        if (!rooms[roomId]) return;
                    }
                }
                if (rt.heal && m.hp < m.maxHp) {
                    m.hp = Math.min(m.maxHp, m.hp + rt.heal);
                    io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
                }
            }
            if (now >= rt.until) { m.state = 'idle'; m.trickNextAttackAt = now + phase.patternIntervalMs; return; }
        } else if (m.trickPattern === 'vanish_strike') {
            const rt = m.trickRuntime;
            if (rt.hitIndex >= rt.hitCount) { m.state = 'idle'; m.trickNextAttackAt = now + phase.patternIntervalMs; return; }
            if (rt.realSide === null && now >= rt.nextHitAt - rt.hintMs) {
                rt.realSide = Math.random() < 0.5 ? -1 : 1; // -1 = 왼쪽(across<0), 1 = 오른쪽
                io.to(roomId).emit('clownHint', { id: mid, realSide: rt.realSide });
            }
            if (now >= rt.nextHitAt) {
                const hits = [];
                for (const [pid, p] of Object.entries(room.players)) {
                    if (!p.alive) continue;
                    const side = acrossOf(floorDef, p.x, p.y) < 0 ? -1 : 1;
                    if (side === rt.realSide) {
                        hits.push(pid);
                        dealClownDamage(ctx, m, mid, pid, rt.damage, phase);
                        if (!rooms[roomId]) return;
                    }
                }
                io.to(roomId).emit('clownAttack', { id: mid, pattern: 'vanish_strike', hits, realSide: rt.realSide });
                rt.hitIndex++;
                rt.realSide = null;
                rt.nextHitAt = now + rt.intervalMs;
            }
        }
    }
}

// 매직블록맛 패시브: 공격도 안 받지도 않고 idleMs(3초)가 지나면 집중모드다.
// 맞은 시각(lastHitAt)도 기준에 들어가서 -- 맞으면 그 순간부터 다시 idleMs를
// 기다려야 한다("맞으면 집중모드가 풀린다"와 같은 효과).
function focusModeActive(character, p, now) {
    const fp = character && character.focusPassive;
    if (!fp || !p) return false;
    const since = Math.max(p.lastAttackTime || 0, p.lastHitAt || 0);
    return now - since >= fp.idleMs;
}

// 집중모드 중 근접 몹의 공격이 막 명중하려는 순간(텔레그래프가 끝난 그
// 자리, tickMonsterSet 안)에만 확인한다 -- 자폭/화살/레이저/보스 패턴처럼
// 다른 경로로 들어오는 공격은 대상이 아니다. 성공하면 대상을 몹 반대
// 방향으로 밀어내고 이번 공격 자체를 무효로 만든다(피해 호출을 안 함).
function tryFocusDodge(ctx, target, character, m, now) {
    const fp = character && character.focusPassive;
    if (!fp || !fp.dodgeDistance) return false;
    if (!focusModeActive(character, target, now)) return false;
    if (target.focusDodgeReadyAt && now < target.focusDodgeReadyAt) return false;
    target.focusDodgeReadyAt = now + fp.dodgeCooldownMs;
    const dx = target.x - m.x, dy = target.y - m.y;
    const dist = Math.hypot(dx, dy) || 1;
    target.x += (dx / dist) * fp.dodgeDistance;
    target.y += (dy / dist) * fp.dodgeDistance;
    if (ctx.clamp) ctx.clamp(target);
    const pid = Object.keys(ctx.room.players).find(id => ctx.room.players[id] === target);
    if (pid) io.to(ctx.roomId).emit(ctx.ev.dodge, { id: pid, x: target.x, y: target.y });
    return true;
}

// One tick of every monster in a room: kiting, telegraphs, beams and arrows.
// Shared by story floors and the guest raid's summoned adds -- see storyMonsterCtx.
function tickMonsterSet(ctx, alivePlayers, now) {
    const { roomId, room } = ctx;
    for (const [mid, m] of Object.entries(room.monsters)) {
        if (!m.alive) continue;
        if (m.stunnedUntil && now < m.stunnedUntil) {
            // Frozen: no movement, no attacks. A stun also cuts a beam that was
            // mid-fire, rather than leaving it hanging in the air unattended.
            if (m.laser) {
                m.laser = null;
                m.state = 'idle';
                m.nextAttackAt = now + MONSTERS[m.type].attackCooldown;
            }
            continue;
        }
        const def = MONSTERS[m.type];
        if (def.trickBoss) { tickClownBoss(ctx, m, mid, now); continue; }
        // 자기 자신에게 거는 버프라 대상을 찾았는지와 무관하게 매 틱 확인한다.
        if (def.monsterSkill || def.monsterUltimate) tickMonsterSkillUltimate(roomId, mid, m, def, now);

        let nearest = null, nearestDist = Infinity;
        for (const p of alivePlayers) {
            const d = Math.hypot(p.x - m.x, p.y - m.y);
            if (d < nearestDist) { nearestDist = d; nearest = p; }
        }
        if (!nearest) continue;
        const blockedByShield = ctx.sightBlocked(m, nearest, def);
        if (blockedByShield && m.laser) {
            m.laser = null;
            m.state = 'idle';
            m.nextAttackAt = now + monsterAttackCooldown(m, def, now);
            continue;
        }
        if (m.state === 'idle' && nearestDist > def.aggroRange) continue; // dormant until approached

        if (m.state === 'idle') {
            // Kites the nearest player: closes in if too far, backs off if the
            // player gets right up next to it, hovering at preferredDistance
            // instead of standing adjacent like a melee mob would.
            const step = monsterSpeed(m, def) * 3; // ~px per 50ms tick
            if (nearestDist > def.preferredDistance) {
                const dx = nearest.x - m.x, dy = nearest.y - m.y;
                const dist = Math.hypot(dx, dy) || 1;
                const move = Math.min(step, dist - def.preferredDistance);
                m.x += (dx / dist) * move;
                m.y += (dy / dist) * move;
            } else if (nearestDist < def.preferredDistance * 0.7) {
                const dx = m.x - nearest.x, dy = m.y - nearest.y;
                const dist = Math.hypot(dx, dy) || 1;
                m.x += (dx / dist) * step;
                m.y += (dy / dist) * step;
            }
            ctx.clamp(m);

            if (nearestDist <= def.attackRange && now >= m.nextAttackAt && !blockedByShield) {
                m.state = 'telegraph';
                m.telegraphStartAt = now;
                io.to(roomId).emit(ctx.ev.telegraph, { id: mid });
            }
        } else if (m.state === 'firing') {
            tickLaser(ctx, m, mid, def, nearest, alivePlayers, now);
            if (!rooms[roomId]) return;
        } else if (m.state === 'telegraph') {
            if (blockedByShield) {
                // A shield came up (or the player ducked back behind one) while
                // this was winding up -- drop the swing rather than firing through it.
                m.state = 'idle';
                m.nextAttackAt = now + monsterAttackCooldown(m, def, now);
                continue;
            }
            if (now - m.telegraphStartAt >= def.telegraphMs) {
                if (def.laser) {
                    // The beam starts locked on and then can only drift after
                    // the player at laserTrackSpeed; see tickLaser.
                    m.state = 'firing';
                    m.laser = {
                        angle: Math.atan2(nearest.y - m.y, nearest.x - m.x),
                        endAt: now + def.laserDurationMs,
                        nextDamageAt: now
                    };
                    io.to(roomId).emit(ctx.ev.attack, { id: mid });
                    continue;
                }
                m.state = 'idle';
                m.nextAttackAt = now + monsterAttackCooldown(m, def, now);
                const d = Math.hypot(nearest.x - m.x, nearest.y - m.y);
                // 자폭: 예열이 끝나면 제자리에서 터진다. 반경 안에 있는 사람은
                // 전부 맞고, 터진 본인은 죽는다. 예열이 길어서 보고 빠지면 된다.
                if (def.explode) {
                    m.alive = false;
                    io.to(roomId).emit(ctx.ev.attack, { id: mid });
                    io.to(roomId).emit(ctx.ev.defeated, { id: mid });
                    io.to(roomId).emit(ctx.ev.exploded, {
                        id: mid, x: m.x, y: m.y, radius: def.explodeRadius
                    });
                    const dmg = def.attackDamage * outgoingDamageMultiplier(m, now);
                    for (const p of alivePlayers) {
                        if (Math.hypot(p.x - m.x, p.y - m.y) > def.explodeRadius + PLAYER_RADIUS) continue;
                        ctx.damageTarget(p, dmg, m.elementMark);
                        if (!rooms[roomId]) return;
                    }
                    continue;
                }
                if (def.projectileSpeed) {
                    // Archers release an arrow regardless of current range: it
                    // flies to where the player was and can be sidestepped.
                    io.to(roomId).emit(ctx.ev.attack, { id: mid });
                    spawnMonsterProjectile(ctx, mid, m, def, nearest.x, nearest.y);
                } else if (d <= def.attackRange) {
                    if (tryFocusDodge(ctx, nearest, charOf(nearest), m, now)) {
                        continue; // 매직블록맛 집중모드: 회피 성공, 이번 공격은 불발
                    }
                    io.to(roomId).emit(ctx.ev.attack, { id: mid });
                    ctx.damageTarget(nearest, monsterAttackDamage(m, def) * outgoingDamageMultiplier(m, now), m.elementMark);
                    if (!rooms[roomId]) return;
                    growMonsterOnAttack(roomId, mid, m, def);
                }
            }
        }
    }
}

function tickStoryRoom(roomId) {
    const room = rooms[roomId];
    if (!room || room.state !== 'fighting') return;
    const now = Date.now();

    // 나비모드 burns its owner while it is on; it can kill them.
    // 바다펄맛 패시브는 체력이 오르내릴 때마다 켜지고 꺼진다. 피해와 회복이
    // 여러 갈래로 들어오므로 한 곳에서 매 틱 다시 본다.
    for (const pl of Object.values(room.players)) refreshLowHpMode(charOf(pl), pl);
    tickInstinctPassiveRegen(room, roomId, now, 'storyPlayerHealed');

    tickButterflyMode(room, now, (id, pl, dmg) => applyDamageToStoryPlayer(roomId, id, dmg));
    if (!rooms[roomId]) return;
    tickBodyFusion(room, roomId, now, 'storyBodyFormChanged', 'storyPlayerHealed');

    const alivePlayers = Object.values(room.players).filter(p => p.alive);
    if (!alivePlayers.length) return; // applyDamageToStoryPlayer already ends the room on death

    // 별은 공격으로 깨는 게 아니라 그 위로 걸어 올라가야 클리어된다 -- 별이
    // 웨이브 바로 근처에 있을 때 공격 판정만으로 몬스터를 안 잡고 넘어가는
    // 문제가 있었다.
    const starFloorDef = floorDefFor(room.floor);
    if (starFloorDef && starFloorDef.star && !room.starDefeated) {
        for (const p of alivePlayers) {
            if (Math.hypot(p.x - starFloorDef.star.x, p.y - starFloorDef.star.y) <= PLAYER_RADIUS + STAR_RADIUS) {
                room.starDefeated = true;
                io.to(roomId).emit('starHit', {});
                endStoryRoom(roomId, 'win');
                return;
            }
        }
    }

    // 레전드 스토리 스위치: 공격이 아니라 밟으면 열린다. gateSealed가
    // room.legendSwitchesHit[gate.room]을 읽으므로 여기서 채워 둔다(입구
    // 문처럼 manual 게이트를 여는 용도).
    if (starFloorDef && starFloorDef.switches && starFloorDef.switches.length) {
        if (!room.legendSwitchesHit) room.legendSwitchesHit = {};
        for (const sw of starFloorDef.switches) {
            if (room.legendSwitchesHit[sw.id]) continue;
            for (const p of alivePlayers) {
                if (Math.hypot(p.x - sw.x, p.y - sw.y) <= PLAYER_RADIUS + STAR_RADIUS) {
                    room.legendSwitchesHit[sw.id] = true;
                    io.to(roomId).emit('legendSwitchHit', { id: sw.id });
                    break;
                }
            }
        }
    }
    // 레전드 스토리 보물상자: 밟으면 한 번만 열린다. 실제 재화 지급은 다른
    // 스토리 보상과 같은 자리(main.js, 로컬 저장)에서 하고, 서버는 "열렸다"는
    // 사실만 알린다.
    if (starFloorDef && starFloorDef.chests && starFloorDef.chests.length) {
        if (!room.legendChestsHit) room.legendChestsHit = {};
        for (const ch of starFloorDef.chests) {
            if (room.legendChestsHit[ch.id]) continue;
            for (const p of alivePlayers) {
                if (Math.hypot(p.x - ch.x, p.y - ch.y) <= PLAYER_RADIUS + STAR_RADIUS) {
                    room.legendChestsHit[ch.id] = true;
                    io.to(roomId).emit('legendChestHit', { id: ch.id });
                    break;
                }
            }
        }
    }

    // 체력이 바닥나기 직전에 한 번만 버티는 몬스터(10층 케이크). 죽는 길이
    // 여럿이라 때리는 자리마다 붙이지 않고 여기서 한 번에 본다.
    for (const [mid, m] of Object.entries(room.monsters)) {
        if (!m.alive) continue;
        checkMonsterLowHpGuard(roomId, room, mid, m, MONSTERS[m.type]);
    }
    // 분열은 문(gate)이나 클리어 판정보다 먼저 돌려야 한다 -- 안 그러면
    // 갈라지기 직전 한 틱 동안 "다 잡았다"로 보인다.
    if (splitDeadMonsters(roomId, room)) {
        io.to(roomId).emit('storyMonstersChanged', { monsters: publicMonsters(room) });
    }
    tickHealAuras(roomId, room, now);
    tickMonsterSummons(roomId, room, now);

    // 각성모드에는 별이 없다. 보스를 쓰러뜨리는 것이 곧 클리어다.
    const tickFloorDef = floorDefFor(room.floor);
    if (tickFloorDef && tickFloorDef.winOnClear) {
        // 보스가 스스로 회복하는 레벨(7~10).
        for (const [mid, m] of Object.entries(room.monsters)) {
            if (!m.alive) continue;
            const def = MONSTERS[m.type];
            if (!def || !def.regenAmount || !def.regenIntervalMs) continue;
            if (now - (m.lastRegenAt || 0) < def.regenIntervalMs) continue;
            m.lastRegenAt = now;
            if (m.hp >= m.maxHp) continue;
            m.hp = Math.min(m.maxHp, m.hp + def.regenAmount);
            io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
        }
        tickAwakenBoss(roomId, room, now);
        if (!rooms[roomId]) return;
        // 마당에 서 있는 것을 하나도 남기지 않아야 끝난다 -- 보스가 부른
        // 부하까지 전부 정리해야 이긴다.
        if (!Object.values(room.monsters).some(m => m.alive)) {
            endStoryRoom(roomId, 'win');
            return;
        }
    }

    if (room.activeBuffs && room.activeBuffs.length) {
        room.activeBuffs = room.activeBuffs.filter(buff => now < buff.endAt);
        for (const buff of room.activeBuffs) {
            if (now - buff.lastTickAt < buff.tickMs) continue;
            buff.lastTickAt += buff.tickMs;
            if (buff.type === 'team_heal_over_time') {
                healStoryPlayer(room, roomId, buff.healPerTick);
            } else if (buff.type === 'ally_heal_zone') {
                // 체리크림맛 특수스킬: 위 보스 레이드 분기 주석 참고. 지금 나와
                // 있는 캐릭터의 위치만 의미가 있으므로(벤치는 자리에 없다)
                // p.x/p.y로 판정하고 partyHp도 같이 맞춘다.
                for (const [id, pl] of Object.entries(room.players)) {
                    if (!pl.alive) continue;
                    if (Math.hypot(buff.x - pl.x, buff.y - pl.y) > buff.radius + PLAYER_RADIUS) continue;
                    const healed = Math.min(pl.maxHp, pl.hp + buff.healPerTick);
                    if (healed !== pl.hp) {
                        pl.hp = healed;
                        if (pl.party && pl.partyHp) pl.partyHp[pl.active] = pl.hp;
                        io.to(roomId).emit('storyPlayerHealed', { id, hp: pl.hp, partyHp: pl.partyHp });
                    }
                }
            } else if (buff.type === 'story_spin_heal_check' && !buff.triggered) {
                const caster = room.players[buff.casterId];
                if (caster && caster.alive) {
                    for (const [mid, m] of Object.entries(room.monsters)) {
                        if (!m.alive) continue;
                        const dist = Math.hypot(caster.x - m.x, caster.y - m.y) - mR(m);
                        if (dist <= buff.radius) {
                            buff.triggered = true;
                            m.hp = Math.max(0, m.hp - buff.damage);
                            if (m.hp <= 0) { m.alive = false; io.to(roomId).emit('monsterDefeated', { id: mid }); }
                            else io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
                            healStoryPlayer(room, roomId, buff.healAmount);
                            break;
                        }
                    }
                }
            } else if (buff.type === 'attack_burn' && buff.ticksLeft > 0) {
                const m = room.monsters[buff.targetMonsterId];
                buff.ticksLeft -= 1;
                if (m && m.alive) {
                    m.hp = Math.max(0, m.hp - buff.damage);
                    if (m.hp <= 0) { m.alive = false; io.to(roomId).emit('monsterDefeated', { id: buff.targetMonsterId }); }
                    else io.to(roomId).emit('monsterDamaged', { id: buff.targetMonsterId, hp: m.hp });
                }
            } else if (buff.type === 'magma_zone') {
                for (const [mid, m] of Object.entries(room.monsters)) {
                    if (!m.alive) continue;
                    if (Math.hypot(buff.x - m.x, buff.y - m.y) <= buff.radius + mR(m)) {
                        m.hp = Math.max(0, m.hp - buff.damage);
                        if (m.hp <= 0) { m.alive = false; io.to(roomId).emit('monsterDefeated', { id: mid }); continue; }
                        io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
                        // 치즈만두 덩어리는 깎으면서 표식도 같이 박는다.
                        if (buff.markCharges && applyElementMark(m, buff.markElement,
                            { charges: buff.markCharges, multiplier: buff.markMultiplier }, now)) {
                            io.to(roomId).emit('monsterMarked', {
                                id: mid, element: m.elementMark.element, charges: m.elementMark.charges
                            });
                        }
                    }
                }
            } else if (buff.type === 'fire_line_zone') {
                // 불꽃요정맛 궁극기 지대: 사각형 안의 몬스터는 계속 화염 피해,
                // 시전자 본인이 안에 있으면 계속 회복.
                for (const [mid, m] of Object.entries(room.monsters)) {
                    if (!m.alive) continue;
                    if (!meleeLineHitPoint(buff.x, buff.y, buff.facing, buff.range, buff.width, m.x, m.y, mR(m))) continue;
                    m.hp = Math.max(0, m.hp - buff.damage);
                    if (m.hp <= 0) { m.alive = false; io.to(roomId).emit('monsterDefeated', { id: mid }); }
                    else io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
                }
                const caster = room.players[buff.casterId];
                if (buff.healPerTick && caster && caster.alive
                    && meleeLineHitPoint(buff.x, buff.y, buff.facing, buff.range, buff.width, caster.x, caster.y, PLAYER_RADIUS)) {
                    caster.hp = Math.min(caster.maxHp, caster.hp + buff.healPerTick);
                    io.to(roomId).emit('storyPlayerHealed', { id: buff.casterId, hp: caster.hp });
                }
            }
        }
    }

    const ctx = storyMonsterCtx(roomId, room);
    // 부하도 몬스터의 표적이 된다 (사람과 같은 줄에 세운다).
    const targets = aliveTargetsOf(room);
    tickMonsterSet(ctx, targets, now);
    if (!rooms[roomId]) return;

    // 부하는 살아 있는 몬스터 중 가장 가까운 것을 스스로 때린다.
    const floorForSummons = floorDefFor(room.floor);
    tickSummons(roomId, room, now, {
        nearestEnemy: (s) => {
            let best = null, bestD = Infinity;
            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                const d = Math.hypot(m.x - s.x, m.y - s.y);
                if (d < bestD) { bestD = d; best = { x: m.x, y: m.y, radius: mR(m), mid, m }; }
            }
            return best;
        },
        clamp: (s) => { if (floorForSummons) { const k = clampToLane(floorForSummons, s.x, s.y); s.x = k.x; s.y = k.y; } },
        hit: (t, dmg) => {
            t.m.hp = Math.max(0, t.m.hp - dmg);
            if (t.m.hp <= 0) { t.m.alive = false; io.to(roomId).emit('monsterDefeated', { id: t.mid }); }
            else io.to(roomId).emit('monsterDamaged', { id: t.mid, hp: t.m.hp });
        }
    });
    if (!rooms[roomId]) return; // room may have just ended (player died) mid-loop above
    tickMonsterProjectiles(ctx, targets, 50);
    if (!rooms[roomId]) return; // an arrow may have just killed the last player

    tickPlayerProjectiles(roomId, room, 50, (pr) => {
        for (const [mid, m] of Object.entries(room.monsters)) {
            if (!m.alive) continue;
            if (Math.hypot(pr.x - m.x, pr.y - m.y) > pr.radius + mR(m)) continue;
            const owner = room.players[pr.ownerId];
            const oc = owner ? charOf(owner) : CHARACTERS[pr.charType];
            // 버블티맛 패시브: 던진 펄이 맞아도 표식이 쌓인다 (attackMarkUses가
            // 없는 캐릭터는 항상 0이라 다른 캐릭터는 그대로다).
            landStoryHitOnMonster(roomId, room, mid, m, pr.ownerId, oc, pr.damage, Date.now(), {
                knockback: false, marks: pr.marks,
                attackMarks: owner ? attackMarkChargesOf(oc, owner) : 0,
                markUse: owner ? markUseOf(oc, owner) : null
            });
            if (owner && owner.alive) {
                const selfHeal = passiveHitHeal(oc, owner);
                if (selfHeal) {
                    owner.hp = Math.min(owner.maxHp, owner.hp + selfHeal);
                    io.to(roomId).emit('storyPlayerHealed', { id: pr.ownerId, hp: owner.hp });
                }
                if (oc.attackHealOnUse && Math.random() < (oc.attackHealChance ?? 1)) {
                    // 던진 화살/구슬도 근접과 같은 나선(attack_heal_boost류) 증폭을 받는다.
                    const boosted = oc.ultimateHealPerAttack != null && owner.attackHealBoostUntil
                        && Date.now() < owner.attackHealBoostUntil;
                    healStoryPlayer(room, roomId, boosted ? oc.ultimateHealPerAttack : oc.attackHealOnUse);
                }
                if (oc.attackShieldOnUse && Math.random() < (oc.attackShieldChance ?? 1)) {
                    addShieldStoryTeam(room, roomId, oc.attackShieldOnUse);
                }
            }
            return true;
        }
        return false;
    }, 'storyDropGone', (pr, dt) => {
        let best = null, bestDist = Infinity;
        for (const m of Object.values(room.monsters)) {
            if (!m.alive) continue;
            const d = Math.hypot(pr.x - m.x, pr.y - m.y);
            if (d < bestDist) { bestDist = d; best = m; }
        }
        if (best) steerProjectileToward(pr, best.x, best.y, dt);
    }, 'storyDropUpdate');
    if (!rooms[roomId]) return; // a drop may have just killed the last player

    io.to(roomId).emit('storyTick', {
        monsters: publicMonsters(room),
        projectiles: publicProjectiles(room),
        summons: publicSummons(room),
        // 파트너를 그리려면 위치가 필요하다. 솔로 방이면 자기 자신 하나뿐이라
        // 클라이언트가 그냥 무시한다.
        players: publicStoryPlayers(room)
    });
}

// ==================== Guest raid ====================
// Square arena, a fixed boss (no boss picking), and a party of GUEST_PARTY_SIZE
// cookies per player that you swap between mid-fight. Each cookie keeps its own
// hp across swaps -- benching a hurt cookie does not heal it.

function createGuestRoom(guestId, solo) {
    const roomId = `guest_${guestId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const def = GUEST_BOSS_DEFS[guestId];
    rooms[roomId] = {
        kind: 'guest',
        guestId,
        solo: !!solo,
        state: 'waiting',
        players: {},
        bossHp: def.maxHp,
        bossMaxHp: def.maxHp,
        bossX: 0,
        bossY: def.homeY,
        bossFacing: Math.PI / 2, // faces down the field, toward the party
        bossState: 'idle', // 'idle' | 'casting'
        bossPattern: null,
        bossRuntime: null,
        nextSkillAt: 0,
        stuckSpears: [], // 창 찍기 leaves these behind; see tickGuestRoom
        activeBuffs: [],
        phase: 1,
        desperationUsed: false, // 2차 last-stand shield fires once
        phaseTransitioned: false, // the boss doesn't die -- the floor collapses instead
        discardChoices: {}, // playerId -> the slot they threw away entering 2차
        monsters: {}, // 부하 소환 (2차) fills this
        nextMonsterId: 0,
        projectiles: {}, // arrows from summoned chocolate_cake_slices
        playerProjectiles: {}, // id -> thrown drop in flight; see spawnPlayerProjectile
        nextPlayerProjectileId: 0,
        nextProjectileId: 0,
        bossShieldHp: 0, // 흑화 puts one on the boss
        playerDamageDebuffUntil: 0, // ...and dulls everyone's damage until then
        playerDamageMultiplier: 1,
        fallZones: [], // 낙하물 left on the ground by 반갈라 베기
        wall: null, // 벽 가르기 pens the party into one half while this is up
        loopHandle: null
    };
    return roomId;
}

function findOpenGuestRoom(guestId) {
    for (const [roomId, room] of Object.entries(rooms)) {
        if (room.kind === 'guest' && room.guestId === guestId && room.state === 'waiting'
            && !room.solo && Object.keys(room.players).length < 2) {
            return roomId;
        }
    }
    return null;
}

// Timers that belong to the cookie, not to the player holding it: its own
// skill/ultimate cooldowns plus the buff windows those opened. Each of the four
// cookies therefore has its own skill and its own ultimate -- using one cookie's
// ultimate leaves the other three free to use theirs.
const GUEST_SLOT_TIMERS = ['lastSkillTime', 'lastUltimateTime', 'guardStanceUntil',
    'attackHealBoostUntil', 'awakenUntil', 'rapidStrikeUntil'];

// Hand the active cookie's hp and timers back to its slot before leaving it.
function bankGuestSlot(p) {
    p.partyHp[p.active] = p.hp;
    const slot = p.partySlotTimers[p.active];
    GUEST_SLOT_TIMERS.forEach(f => { slot[f] = p[f] || 0; });
}

// A party entry's cookie is the source of truth for its max hp. p.charType/hp/
// maxHp mirror whichever slot is active so all the shared combat helpers
// (resolveAttack, damageReductionMultiplier, ...) keep working unchanged.
function activateGuestSlot(p, index) {
    p.active = index;
    p.charType = p.party[index];
    p.hp = p.partyHp[index];
    p.maxHp = p.partyMaxHp[index];
    p.bonus = (p.partyBonus && p.partyBonus[index]) || NO_EQUIP_BONUS;
    // 각성 장비도 쿠키마다 다르므로 슬롯을 바꿀 때 같이 갈아 끼운다.
    p.character = (p.partyCharacter && p.partyCharacter[index]) || CHARACTERS[p.charType];
    p.awakenGear = (p.partyAwakenGear && p.partyAwakenGear[index]) || null;
    const slot = p.partySlotTimers[index];
    GUEST_SLOT_TIMERS.forEach(f => { p[f] = slot[f] || 0; });
    resetBodyFormIfNeeded(p);
}

function makeGuestPlayer(party, slotIndex, equipParty, instinctParty, charLevelParty) {
    // 게스트 레이드는 쿠키 4명을 번갈아 쓰므로 장비도 슬롯마다 따로 가진다.
    const bonuses = party.map((id, i) => bonusFrom(equipParty && equipParty[i], id, instinctParty && instinctParty[i]));
    const characters = party.map((id, i) => charFrom(id, equipParty && equipParty[i], instinctParty && instinctParty[i], charLevelParty && charLevelParty[i]));
    const gears = party.map((id, i) => gearFrom(id, equipParty && equipParty[i]));
    const maxHp = party.map((id, i) => characters[i].health + bonuses[i].health);
    const p = {
        party,
        partyBonus: bonuses,
        partyCharacter: characters,
        partyAwakenGear: gears,
        partyHp: maxHp.slice(),
        partyMaxHp: maxHp.slice(),
        partyAlive: party.map(() => true),
        partyDiscarded: party.map(() => false), // 2차 진입 때 버린 쿠키
        partyRevivesUsed: party.map(() => 0),
        partySlotTimers: party.map(() => ({})),
        active: 0,
        x: slotIndex === 0 ? -90 : 90,
        y: GUEST_ARENA_HALF_H - 70,
        facing: -Math.PI / 2,
        alive: true,
        ready: false,
        shieldHp: 0,
        lastAttackTime: 0, lastSkillTime: 0, lastUltimateTime: 0,
        lastSwapTime: 0,
        attackHealBoostUntil: 0
    };
    activateGuestSlot(p, 0);
    return p;
}

function publicGuestPlayers(room) {
    const out = {};
    for (const [id, p] of Object.entries(room.players)) {
        out[id] = {
            x: p.x, y: p.y, facing: p.facing, alive: p.alive, ready: !!p.ready,
            charType: p.charType, hp: p.hp, maxHp: p.maxHp, shieldHp: p.shieldHp || 0,
            party: p.party, partyHp: p.partyHp, partyMaxHp: p.partyMaxHp,
            partyAlive: p.partyAlive, partyDiscarded: p.partyDiscarded, active: p.active,
            untouchableUntil: p.untouchableUntil || 0
        };
    }
    return out;
}

function endGuestRoom(roomId, result) {
    const room = rooms[roomId];
    if (!room) return;
    if (room.loopHandle) clearInterval(room.loopHandle);
    room.state = 'ended';
    io.to(roomId).emit('guestResult', { result });
    delete rooms[roomId];
}

// Heals EVERY cookie of every player, benched ones included -- the whole point
// of "팀 전체를 힐하는 능력을 쓰면 사용하고 있지 않아도 전부 회복".
function healGuestTeam(room, roomId, amount) {
    for (const [id, p] of Object.entries(room.players)) {
        let changed = false;
        for (let i = 0; i < p.party.length; i++) {
            if (!p.partyAlive[i]) continue; // a downed cookie needs more than a heal
            const healed = Math.min(p.partyMaxHp[i], p.partyHp[i] + amount);
            if (healed !== p.partyHp[i]) { p.partyHp[i] = healed; changed = true; }
        }
        if (!changed) continue;
        p.hp = p.partyHp[p.active];
        io.to(roomId).emit('guestPlayerHealed', {
            id, hp: p.hp, partyHp: p.partyHp
        });
    }
}

// 바다펄맛 밀물의 회복. 파티마다 최대 체력이 달라서 비율로 계산한다.
function healGuestTeamByRatio(room, roomId, ratio) {
    if (!ratio) return;
    for (const [id, p] of Object.entries(room.players)) {
        let changed = false;
        for (let i = 0; i < p.party.length; i++) {
            if (!p.partyAlive[i]) continue;
            const healed = Math.min(p.partyMaxHp[i],
                p.partyHp[i] + Math.round(p.partyMaxHp[i] * ratio));
            if (healed !== p.partyHp[i]) { p.partyHp[i] = healed; changed = true; }
        }
        if (!changed) continue;
        p.hp = p.partyHp[p.active];
        io.to(roomId).emit('guestPlayerHealed', { id, hp: p.hp, partyHp: p.partyHp });
    }
}

// 바람궁수맛 궁극기 3단계 (게스트 레이드): 팀 중 죽은 캐릭터가 있으면
// 하나 부활시킨다. 통째로 쓰러진 플레이어를 우선(슬롯 0부터 다시 세운다),
// 없으면 어느 파티에서든 쓰러진 슬롯 하나를 되살린다.
function reviveDownedGuestTeammate(roomId, room) {
    for (const [id, pl] of Object.entries(room.players)) {
        if (pl.alive) continue;
        pl.partyAlive[0] = true;
        pl.partyHp[0] = pl.partyMaxHp[0];
        activateGuestSlot(pl, 0);
        pl.alive = true;
        io.to(roomId).emit('guestForcedSwap', { id, active: 0, charType: pl.charType });
        io.to(id).emit('guestPlayerRevived', { hp: pl.hp });
        io.to(roomId).emit('guestPlayerDamaged', {
            id, hp: pl.hp, alive: true, shieldHp: pl.shieldHp || 0,
            partyHp: pl.partyHp, partyAlive: pl.partyAlive, active: pl.active, charType: pl.charType
        });
        return true;
    }
    for (const pl of Object.values(room.players)) {
        if (!pl.partyAlive) continue;
        const idx = pl.partyAlive.findIndex(a => !a);
        if (idx === -1) continue;
        pl.partyAlive[idx] = true;
        pl.partyHp[idx] = pl.partyMaxHp[idx];
        return true;
    }
    return false;
}
// 죽은 사람이 없을 때의 대체 효과: 마법진을 열어 팀을 꽉 채우고, 보스와
// 살아있는 부하 전부의 (지금) 체력을 ultimateSanctuaryEnemyDamageRatio만큼 깎는다.
function natureGuestSanctuary(roomId, room, character, casterId) {
    healGuestTeam(room, roomId, Infinity);
    const ratio = character.ultimateSanctuaryEnemyDamageRatio || 0;
    if (!ratio) return;
    if (!room.phaseTransitioned && room.bossHp > 0) {
        damageGuestBoss(roomId, room, Math.max(1, Math.round(room.bossHp * ratio)), casterId);
        if (!rooms[roomId]) return;
    }
    for (const mid of Object.keys(room.monsters)) {
        const m = room.monsters[mid];
        if (!m || !m.alive) continue;
        damageGuestMonster(roomId, room, mid, Math.max(1, Math.round(m.hp * ratio)));
    }
}

function shieldGuestTeam(room, roomId, amount) {
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive) continue;
        p.shieldHp = amount;
        io.to(roomId).emit('guestPlayerShielded', { id, shieldHp: p.shieldHp });
    }
}

// shieldGuestTeam은 덮어쓴다(궁극기용). 공격 적중마다 주는 보호막은 더한다
// -- addShieldTeam과 같은 이유(server.js 주석 참고).
function addShieldGuestTeam(room, roomId, amount) {
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive) continue;
        p.shieldHp = (p.shieldHp || 0) + amount;
        io.to(roomId).emit('guestPlayerShielded', { id, shieldHp: p.shieldHp });
    }
}

// 번개지옥맛의 부활 충격파, 게스트 레이드판. 보스와 소환된 적이 함께 있으므로
// 적의 수를 둘 다 세서 단독/다수 비율을 고른다.
// 지옥맛(비율 없음)은 대신 guestCircleTargets로 반경 안의 대상만 고정
// 데미지로 때린다.
function applyReviveBlastToGuest(roomId, room, character, playerId, p) {
    const adds = Object.entries(room.monsters).filter(([, m]) => m.alive);
    const bossUp = !room.phaseTransitioned && room.bossHp > 0;
    const ratio = reviveBlastRatio(character, adds.length + (bossUp ? 1 : 0));
    if (ratio) {
        io.to(roomId).emit('guestReviveBlast', { id: playerId, ratio, count: adds.length + (bossUp ? 1 : 0) });
        for (const [mid, m] of adds) {
            damageGuestMonster(roomId, room, mid, Math.max(1, Math.round(m.hp * ratio)));
            if (!rooms[roomId]) return;
        }
        if (bossUp) damageGuestBoss(roomId, room, Math.max(1, Math.round(room.bossHp * ratio)), playerId);
        return;
    }
    const flatDmg = character.passiveReviveBlastDamage;
    const flatRadius = character.passiveReviveBlastRadius;
    if (!flatDmg || !flatRadius || !p) return;
    const targets = guestCircleTargets(room, p.x, p.y, flatRadius);
    if (!targets.length) return;
    io.to(roomId).emit('guestReviveBlast', { id: playerId, ratio: 0, count: targets.length });
    damageGuestTargets(roomId, room, targets, flatDmg, playerId);
}

function applyDamageToGuestPlayer(roomId, playerId, dmg) {
    const room = rooms[roomId];
    if (!room || room.state !== 'fighting') return;
    const p = room.players[playerId];
    if (!p || !p.alive) return;
    p.lastHitAt = Date.now(); // 매직블록맛 패시브(focusModeActive)가 읽는다
    const character = charOf(p);
    dmg = Math.round(dmg * damageReductionMultiplier(character, p, Date.now(), null));
    if (p.shieldHp > 0) {
        const absorbed = Math.min(p.shieldHp, dmg);
        p.shieldHp -= absorbed;
        dmg -= absorbed;
    }
    p.hp = Math.max(0, p.hp - dmg);

    let revived = false, swappedTo = null;
    if (p.hp <= 0) {
        // The cheat-death passive is per cookie, so it uses that slot's counter.
        const slotState = {
            hp: p.hp, maxHp: p.maxHp, revivesUsed: p.partyRevivesUsed[p.active],
            alive: true, awakened: !!p.awakened, equipHealth: bonusOf(p).health
        };
        revived = tryRevive(slotState, character, bonusOf(p).revive);
        if (revived) {
            p.hp = slotState.hp;
            p.maxHp = slotState.maxHp;
            p.partyMaxHp[p.active] = slotState.maxHp;
            p.awakened = slotState.awakened;
            p.partyRevivesUsed[p.active] = slotState.revivesUsed;
        } else {
            p.partyAlive[p.active] = false;
            // Auto-swap to the next cookie still standing; the player is only
            // out once the whole party is down.
            const next = p.partyAlive.findIndex(a => a);
            if (next >= 0) {
                bankGuestSlot(p); // p.hp is already 0 here
                activateGuestSlot(p, next);
                swappedTo = next;
            } else {
                p.alive = false;
            }
        }
    }
    p.partyHp[p.active] = p.hp;

    io.to(roomId).emit('guestPlayerDamaged', {
        id: playerId, hp: p.hp, alive: p.alive, shieldHp: p.shieldHp || 0,
        partyHp: p.partyHp, partyAlive: p.partyAlive, active: p.active, charType: p.charType
    });
    if (revived) {
        io.to(roomId).emit('guestPlayerRevived', { id: playerId, hp: p.hp });
        applyReviveBlastToGuest(roomId, room, character, playerId, p);
        if (!rooms[roomId]) return; // the blast finished the boss off
    }
    if (swappedTo !== null) io.to(roomId).emit('guestForcedSwap', { id: playerId, active: swappedTo, charType: p.charType });

    if (Object.values(room.players).every(pl => !pl.alive)) endGuestRoom(roomId, 'lose');
}

// Every point of damage the boss takes funnels through here so the phase
// transition can't be missed. At 0 in 1차 the boss does NOT die -- the ground
// gives way, you throw a cookie away, and 2차 begins. At 0 in 2차 it is over.
function damageGuestBoss(roomId, room, amount, byId) {
    if (!room || room.state !== 'fighting' || room.phaseTransitioned) return;
    amount = Math.max(0, Math.round(amount * guestPlayerDamageScale(room)));
    if (room.bossShieldHp > 0) {
        const absorbed = Math.min(room.bossShieldHp, amount);
        room.bossShieldHp -= absorbed;
        amount -= absorbed;
        io.to(roomId).emit('guestBossShield', { shieldHp: room.bossShieldHp });
    }
    room.bossHp = Math.max(0, room.bossHp - amount);
    io.to(roomId).emit('guestBossDamaged', { bossHp: room.bossHp, by: byId });

    // Last stand: crossing under the threshold for the first time buys it a
    // fresh shield. Checked after the hp update so the hit that takes it there
    // still lands in full.
    const def = guestDefFor(room);
    if (def.desperationShield && !room.desperationUsed
        && room.bossHp > 0 && room.bossHp <= def.desperationHpThreshold) {
        room.desperationUsed = true;
        room.bossShieldHp = def.desperationShield;
        io.to(roomId).emit('guestBossDesperation', { shieldHp: room.bossShieldHp });
    }
    if (room.bossHp > 0) return;
    room.phaseTransitioned = true;
    room.bossState = 'idle';
    room.bossPattern = null;
    room.bossRuntime = null;
    room.stuckSpears = [];
    room.fallZones = [];
    if (room.wall) { room.wall = null; io.to(roomId).emit('guestWallDropped', {}); }

    if (room.phase === 2) {
        setTimeout(() => endGuestRoom(roomId, 'win'), 1200);
        return;
    }
    io.to(roomId).emit('guestFloorCollapse', {});
    setTimeout(() => beginGuestDiscardChoice(roomId), 2600);
}

// 흑화 dulls everyone's damage for a while. Non-stacking: recasting refreshes
// the window rather than multiplying 0.8 by itself into nothing.
function guestPlayerDamageScale(room) {
    if (!room.playerDamageDebuffUntil || Date.now() >= room.playerDamageDebuffUntil) return 1;
    return room.playerDamageMultiplier;
}

// Between the two raids: everyone with more than one cookie throws one away for
// good. The fight is frozen until every such player has chosen.
function beginGuestDiscardChoice(roomId) {
    const room = rooms[roomId];
    if (!room || room.kind !== 'guest' || room.state !== 'fighting') return;
    room.state = 'choosing';
    room.discardChoices = {};
    let anyone = false;
    for (const [id, p] of Object.entries(room.players)) {
        if (p.party.length <= 1) {
            // Nothing to choose from -- a multiplayer run brings one cookie each.
            room.discardChoices[id] = -1;
            continue;
        }
        anyone = true;
        io.to(id).emit('guestDiscardPrompt', {
            party: p.party, partyHp: p.partyHp, partyMaxHp: p.partyMaxHp, partyAlive: p.partyAlive
        });
    }
    if (!anyone) startGuestPhase2(roomId);
}

function startGuestPhase2(roomId) {
    const room = rooms[roomId];
    if (!room || room.kind !== 'guest') return;
    const def = guestDefFor({ ...room, phase: 2 });

    room.phase = 2;
    room.phaseTransitioned = false;
    room.state = 'fighting';
    room.bossHp = def.maxHp;
    room.bossMaxHp = def.maxHp;
    room.bossShieldHp = 0;
    room.desperationUsed = false;
    room.playerDamageDebuffUntil = 0;
    room.playerDamageMultiplier = 1;
    room.bossState = 'idle';
    room.bossPattern = null;
    room.bossRuntime = null;
    room.stuckSpears = [];
    room.fallZones = [];
    room.wall = null;
    room.monsters = {};
    room.projectiles = {};
    room.activeBuffs = [];
    room.nextSkillAt = Date.now() + def.skillIntervalMs;

    // A fresh raid, so the cookies you kept come back whole. The one you threw
    // away does not come back at all -- that is what the choice costs.
    for (const [id, p] of Object.entries(room.players)) {
        const discarded = room.discardChoices[id];
        p.partyDiscarded = p.party.map((_, i) => i === discarded);
        for (let i = 0; i < p.party.length; i++) {
            p.partyAlive[i] = !p.partyDiscarded[i];
            p.partyHp[i] = p.partyDiscarded[i] ? 0 : p.partyMaxHp[i];
            p.partySlotTimers[i] = {};
            p.partyRevivesUsed[i] = 0; // 새 싸움 = 부활 횟수도 다시
        }
        const first = p.partyAlive.findIndex(a => a);
        p.alive = first >= 0;
        p.shieldHp = 0;
        if (first >= 0) activateGuestSlot(p, first);
        p.x = 0;
        p.y = GUEST_ARENA_HALF_H - 70;
    }

    io.to(roomId).emit('guestPhase2Started', {
        bossHp: room.bossHp, bossMaxHp: room.bossMaxHp,
        bossX: room.bossX, bossY: room.bossY,
        players: publicGuestPlayers(room)
    });
}

function guestAlivePlayers(room) {
    return Object.values(room.players).filter(p => p.alive);
}

function pickGuestTarget(room) {
    const alive = guestAlivePlayers(room);
    if (!alive.length) return null;
    return alive[Math.floor(Math.random() * alive.length)];
}

function startGuestFight(roomId) {
    const room = rooms[roomId];
    if (!room || room.kind !== 'guest' || room.state !== 'waiting') return;
    if (Object.keys(room.players).length === 0) return;
    const def = guestDefFor(room);

    room.state = 'fighting';
    room.bossHp = def.maxHp;
    room.bossMaxHp = def.maxHp;
    room.nextSkillAt = Date.now() + def.skillIntervalMs;

    io.to(roomId).emit('guestStarted', {
        guestId: room.guestId,
        bossHp: room.bossHp,
        bossMaxHp: room.bossMaxHp,
        bossX: room.bossX, bossY: room.bossY,
        players: publicGuestPlayers(room)
    });

    room.loopHandle = setInterval(() => tickGuestRoom(roomId), 50);
}

function beginGuestSkill(roomId, room, def, now) {
    // Pick the target FIRST: committing to 'casting' without a runtime would
    // leave the boss stuck in a state no tick branch can advance.
    const target = pickGuestTarget(room);
    if (!target) {
        room.nextSkillAt = now + def.skillIntervalMs;
        return;
    }
    // 부하 소환 is skipped while its last squad is still standing, so the field
    // can't silently fill up with three squads at once.
    const keys = Object.keys(def.patterns)
        .filter(k => k !== 'summon_minions' || !guestMonstersAlive(room));
    if (!keys.length) {
        room.nextSkillAt = now + def.skillIntervalMs;
        return;
    }
    const pick = keys[Math.floor(Math.random() * keys.length)];
    room.bossPattern = pick;
    room.bossState = 'casting';

    if (pick === 'spear_jab') {
        const p = def.patterns.spear_jab;
        room.bossRuntime = {
            wave: 0,
            phase: 'telegraph',
            at: now,
            angle: Math.atan2(target.y - room.bossY, target.x - room.bossX)
        };
        io.to(roomId).emit('guestTelegraph', {
            skill: 'spear_jab', wave: 0, angle: room.bossRuntime.angle,
            range: p.range, width: p.width, telegraphMs: p.telegraphMs
        });
    } else if (pick === 'spear_drop') {
        const p = def.patterns.spear_drop;
        room.bossRuntime = { wave: 0, phase: 'telegraph', at: now, x: target.x, y: target.y };
        io.to(roomId).emit('guestTelegraph', {
            skill: 'spear_drop', wave: 0, x: target.x, y: target.y,
            radius: p.markRadius, telegraphMs: p.telegraphMs
        });
    } else if (pick === 'big_slash') {
        const p = def.patterns.big_slash;
        const dist = Math.hypot(target.x - room.bossX, target.y - room.bossY);
        const near = dist <= p.nearThreshold;
        room.bossRuntime = {
            phase: 'windup',
            at: now,
            near,
            windupMs: near ? p.nearWindupMs : p.farWindupMs,
            x: near ? room.bossX : target.x,
            y: near ? room.bossY : target.y,
            radius: near ? p.nearRadius : p.farRadius
        };
        // Deliberately NOT a red danger zone -- 크게 베기 is 예고 없이. The client
        // only gets a "the boss is winding up" cue.
        io.to(roomId).emit('guestWindup', {
            skill: 'big_slash', near, windupMs: room.bossRuntime.windupMs
        });
    } else if (pick === 'basic_attack') {
        // 원거리 기본 공격: 예고 없이(유누 지시) 즉시 큰 불구슬을 던진다 --
        // 다른 패턴들과 달리 telegraph 대기 단계가 없어서 캐스팅 한 틱 안에
        // 전부 끝난다.
        const p = def.patterns.basic_attack;
        spawnMonsterProjectile(guestMonsterCtx(roomId, room), 'boss',
            { x: room.bossX, y: room.bossY, elementMark: null },
            {
                projectileSpeed: p.speed, attackDamage: p.damage, attackProjectileRadius: p.radius,
                attackBurnDamage: p.burnDamage, attackBurnTicks: p.burnTicks, attackBurnIntervalMs: p.burnIntervalMs
            },
            target.x, target.y);
        room.bossState = 'idle';
        room.bossPattern = null;
        room.nextSkillAt = now + def.skillIntervalMs;
    } else if (pick === 'summon_minions') {
        const p = def.patterns.summon_minions;
        room.bossRuntime = {
            phase: 'telegraph', at: now,
            variant: p.variants[Math.floor(Math.random() * p.variants.length)]
        };
        io.to(roomId).emit('guestWindup', { skill: 'summon_minions', windupMs: p.telegraphMs });
    } else if (pick === 'half_sweep') {
        const p = def.patterns.half_sweep;
        // Right half first, then the left -- "오른쪽" is relative to the boss's
        // own facing, so it cleaves the field in two either way.
        room.bossRuntime = { stage: 'sweep', side: 'right', phase: 'telegraph', at: now, swung: 0 };
        io.to(roomId).emit('guestTelegraph', {
            skill: 'half_sweep', side: 'right',
            angle: room.bossFacing - Math.PI / 2, halfAngle: Math.PI / 2,
            range: p.sweepRange, telegraphMs: p.telegraphMs + p.sweepDelayMs
        });
    } else if (pick === 'empower') {
        const p = def.patterns.empower;
        room.bossRuntime = { phase: 'telegraph', at: now };
        io.to(roomId).emit('guestWindup', { skill: 'empower', windupMs: p.telegraphMs });
    } else if (pick === 'spear_throw') {
        const p = def.patterns.spear_throw;
        room.bossRuntime = { wave: 0, phase: 'telegraph', at: now, x: target.x, y: target.y };
        io.to(roomId).emit('guestTelegraph', {
            skill: 'spear_throw', wave: 0, x: target.x, y: target.y,
            radius: p.radius, telegraphMs: p.telegraphMs
        });
    } else if (pick === 'arena_split') {
        const p = def.patterns.arena_split;
        // The wall goes across the middle; the party is penned into whichever
        // half it is standing in, and the squad lands in there with them.
        const side = target.y >= 0 ? 1 : -1;
        room.wall = { y: 0, side, thickness: p.wallThickness };
        room.bossRuntime = { phase: 'telegraph', at: now, side };
        io.to(roomId).emit('guestWallRaised', { y: 0, side, thickness: p.wallThickness });
    } else if (pick === 'barrage') {
        const p = def.patterns.barrage;
        room.bossRuntime = { wave: 0, phase: 'live', at: now, spears: rollGuestBarrage(p.firstWaveCount, p.size, []) };
        io.to(roomId).emit('guestBarrageWave', {
            wave: 0, size: p.size, spears: room.bossRuntime.spears
        });
    }
}

// 총공격 spear positions: anywhere on the field, and never repeating a spot the
// previous volley already used ("처음이랑 다른").
function rollGuestBarrage(count, size, avoid) {
    const spears = [];
    const half = size / 2;
    for (let i = 0; i < count; i++) {
        let x = 0, y = 0;
        for (let tries = 0; tries < 12; tries++) {
            x = (Math.random() * 2 - 1) * (GUEST_ARENA_HALF_W - half);
            y = (Math.random() * 2 - 1) * (GUEST_ARENA_HALF_H - half);
            if (!avoid.some(s => Math.hypot(s.x - x, s.y - y) < size)) break;
        }
        spears.push({ x, y });
    }
    return spears;
}

// The guest arena is an open square, and nothing in it blocks line of fire.
function guestMonsterCtx(roomId, room) {
    return {
        roomId, room,
        damagePlayer: (playerId, dmg, mark) => applyDamageToGuestPlayer(roomId, playerId, dmg, mark),
        damageTarget: (ref, dmg, mark) => damageTargetRef(roomId, room, ref, dmg, mark,
            (pid, d, mk) => applyDamageToGuestPlayer(roomId, pid, d, mk)),
        clamp: (m) => {
            m.x = Math.max(-GUEST_ARENA_HALF_W, Math.min(GUEST_ARENA_HALF_W, m.x));
            m.y = Math.max(-GUEST_ARENA_HALF_H, Math.min(GUEST_ARENA_HALF_H, m.y));
        },
        sightBlocked: () => false,
        outOfBounds: (pr) => Math.abs(pr.x) > GUEST_ARENA_HALF_W + 200
            || Math.abs(pr.y) > GUEST_ARENA_HALF_H + 200,
        // Ordinary arrows (summoned adds) never set pr.burnDamage, so this is a
        // no-op for them -- only guest2 기본 공격's fireball carries it.
        onHit: (pr, hitRef) => {
            if (!pr.burnDamage) return;
            const pid = Object.keys(room.players).find(k => room.players[k] === hitRef);
            if (!pid) return; // 부하만 맞았을 땐 화상 없음
            room.activeBuffs.push({
                type: 'player_burn', targetId: pid,
                damage: pr.burnDamage, tickMs: pr.burnIntervalMs,
                lastTickAt: Date.now(),
                endAt: Date.now() + pr.burnIntervalMs * pr.burnTicks
            });
        },
        ev: {
            telegraph: 'guestMonsterTelegraph', attack: 'guestMonsterAttack',
            defeated: 'guestMonsterDefeated', exploded: 'guestMonsterExploded',
            projectileFired: 'guestProjectileFired', projectileGone: 'guestProjectileGone',
            dodge: 'guestPlayerFocusDodge'
        }
    };
}

function guestMonstersAlive(room) {
    return Object.values(room.monsters).some(m => m.alive);
}

// 부하 소환. Spreads the squad across the field between the boss and the party
// so they have to be fought through rather than all landing in one lump.
function spawnGuestMinions(roomId, room, variant) {
    const spawned = {};
    for (let i = 0; i < variant.count; i++) {
        const id = `gm${room.nextMonsterId++}`;
        // Even columns across the field, staggered rows going down from the boss.
        const perRow = Math.min(variant.count, 8);
        const col = i % perRow, row = Math.floor(i / perRow);
        const spread = (GUEST_ARENA_HALF_W - 60) * 2;
        const x = -GUEST_ARENA_HALF_W + 60 + (perRow === 1 ? spread / 2 : (col * spread) / (perRow - 1));
        const y = room.bossY + 110 + row * 90;
        const m = {
            type: variant.type,
            x, y: Math.min(GUEST_ARENA_HALF_H - 40, y),
            hp: MONSTERS[variant.type].health,
            maxHp: MONSTERS[variant.type].health,
            alive: true,
            state: 'idle',
            nextAttackAt: 0,
            telegraphStartAt: 0,
            laser: null
        };
        room.monsters[id] = m;
        spawned[id] = { type: m.type, x: m.x, y: m.y, hp: m.hp, maxHp: m.maxHp, alive: true };
    }
    io.to(roomId).emit('guestMinionsSummoned', { monsters: spawned });
}

// Same as spawnGuestMinions, but confined to one half of the field -- 벽 가르기
// drops its squad in with whoever it just walled in.
function spawnGuestMinionsOnSide(roomId, room, group, side) {
    const spawned = {};
    const ids = [];
    const yLo = side > 0 ? 60 : -GUEST_ARENA_HALF_H + 40;
    const yHi = side > 0 ? GUEST_ARENA_HALF_H - 40 : -60;
    for (let i = 0; i < group.count; i++) {
        const id = `gm${room.nextMonsterId++}`;
        const spread = (GUEST_ARENA_HALF_W - 60) * 2;
        const x = -GUEST_ARENA_HALF_W + 60
            + (group.count === 1 ? spread / 2 : (i * spread) / (group.count - 1));
        const y = yLo + ((yHi - yLo) * (i % 2 === 0 ? 0.3 : 0.7));
        const m = {
            type: group.type, x, y,
            hp: MONSTERS[group.type].health, maxHp: MONSTERS[group.type].health,
            alive: true, state: 'idle', nextAttackAt: 0, telegraphStartAt: 0, laser: null
        };
        room.monsters[id] = m;
        ids.push(id);
        spawned[id] = { type: m.type, x: m.x, y: m.y, hp: m.hp, maxHp: m.maxHp, alive: true };
    }
    io.to(roomId).emit('guestMinionsSummoned', { monsters: spawned });
    return ids;
}

function damageGuestMonster(roomId, room, mid, amount) {
    const m = room.monsters[mid];
    if (!m || !m.alive) return;
    m.hp = Math.max(0, m.hp - Math.max(0, Math.round(amount * guestPlayerDamageScale(room))));
    if (m.hp > 0) { io.to(roomId).emit('guestMonsterDamaged', { id: mid, hp: m.hp }); return; }
    m.alive = false;
    m.laser = null;
    io.to(roomId).emit('guestMonsterDefeated', { id: mid });
}

// Everything a player attack can land on: the boss, plus any summoned add.
function guestLineTargets(room, originX, originY, facing, range, width) {
    const out = [];
    const def = guestDefFor(room);
    if (meleeLineHitPoint(originX, originY, facing, range, width, room.bossX, room.bossY, def.radius)) {
        out.push({ boss: true });
    }
    for (const [mid, m] of Object.entries(room.monsters)) {
        if (!m.alive) continue;
        if (meleeLineHitPoint(originX, originY, facing, range, width, m.x, m.y, mR(m))) out.push({ mid });
    }
    return out;
}

// 게스트 레이드는 보스와 부하가 한 판에 같이 있어서, 표식도 둘 다에게 같은
// 규칙으로 붙는다 (보스 것만 방 쪽에 얹혀 있다).
function markGuestTargets(roomId, room, targets, element, opts) {
    const now = Date.now();
    for (const t of targets) {
        if (t.boss) {
            if (!applyElementMark(bossMarkTarget(room), element, opts, now)) continue;
            io.to(roomId).emit('guestBossMarked', {
                element: room.bossElementMark.element,
                charges: room.bossElementMark.charges,
                until: room.bossElementMark.until
            });
        } else {
            const m = room.monsters[t.mid];
            if (!m || !m.alive) continue;
            if (!applyElementMark(m, element, opts, now)) continue;
            io.to(roomId).emit('monsterMarked', {
                id: t.mid, element: m.elementMark.element,
                charges: m.elementMark.charges, until: m.elementMark.until
            });
        }
    }
}

function guestCircleTargets(room, x, y, radius) {
    const out = [];
    const def = guestDefFor(room);
    if (Math.hypot(x - room.bossX, y - room.bossY) <= radius + def.radius) out.push({ boss: true });
    for (const [mid, m] of Object.entries(room.monsters)) {
        if (!m.alive) continue;
        if (Math.hypot(x - m.x, y - m.y) <= radius + mR(m)) out.push({ mid });
    }
    return out;
}

// 쿠키맛쿠키 궁극기처럼 원이 아니라 (x,y) 중심의 직사각형 범위인 경우.
function guestRectTargets(room, x, y, halfWidth, halfHeight) {
    const out = [];
    const def = guestDefFor(room);
    if (Math.abs(x - room.bossX) <= halfWidth + def.radius
        && Math.abs(y - room.bossY) <= halfHeight + def.radius) out.push({ boss: true });
    for (const [mid, m] of Object.entries(room.monsters)) {
        if (!m.alive) continue;
        if (Math.abs(x - m.x) <= halfWidth + mR(m) && Math.abs(y - m.y) <= halfHeight + mR(m)) out.push({ mid });
    }
    return out;
}

function damageGuestTargets(roomId, room, targets, amount, byId) {
    for (const t of targets) {
        if (t.boss) damageGuestBoss(roomId, room, amount, byId);
        else damageGuestMonster(roomId, room, t.mid, amount);
        if (!rooms[roomId]) return;
    }
}

function guestCircleHit(room, roomId, x, y, radius, damage) {
    for (const p of guestAlivePlayers(room)) {
        if (Math.hypot(p.x - x, p.y - y) > radius + PLAYER_RADIUS) continue;
        const id = Object.keys(room.players).find(k => room.players[k] === p);
        applyDamageToGuestPlayer(roomId, id, damage);
        if (!rooms[roomId]) return;
    }
}

// One half of the field, split along whichever way the boss is facing.
// side 'right' is clockwise of its facing, 'left' anticlockwise.
function guestHalfHit(roomId, room, side, range, damage) {
    for (const p of guestAlivePlayers(room)) {
        const dx = p.x - room.bossX, dy = p.y - room.bossY;
        if (Math.hypot(dx, dy) > range + PLAYER_RADIUS) continue;
        // Component along the boss's left-hand normal: positive is its left.
        const rel = -Math.sin(room.bossFacing) * dx + Math.cos(room.bossFacing) * dy;
        if (side === 'right' ? rel > PLAYER_RADIUS : rel < -PLAYER_RADIUS) continue;
        const id = Object.keys(room.players).find(k => room.players[k] === p);
        applyDamageToGuestPlayer(roomId, id, damage);
        if (!rooms[roomId]) return;
    }
}

function endGuestPattern(room, def, now) {
    room.bossState = 'idle';
    room.bossPattern = null;
    room.bossRuntime = null;
    room.nextSkillAt = now + def.skillIntervalMs;
}

function healGuestBoss(roomId, room, amount) {
    if (room.phaseTransitioned) return;
    const before = room.bossHp;
    room.bossHp = Math.min(room.bossMaxHp, room.bossHp + amount);
    if (room.bossHp !== before) io.to(roomId).emit('guestBossHealed', { bossHp: room.bossHp });
}

// 2. 반갈라 베기 -> 레이저 -> 낙하물, in that order, as one skill.
function tickGuestHalfSweep(roomId, room, def, now) {
    const p = def.patterns.half_sweep;
    const rt = room.bossRuntime;

    if (rt.stage === 'sweep') {
        const due = rt.phase === 'telegraph' ? p.telegraphMs + p.sweepDelayMs : p.sideGapMs;
        if (now - rt.at < due) return;
        io.to(roomId).emit('guestSkillHit', {
            skill: 'half_sweep', side: rt.side,
            angle: room.bossFacing, range: p.sweepRange
        });
        guestHalfHit(roomId, room, rt.side, p.sweepRange, p.sweepDamage);
        if (!rooms[roomId]) return;
        rt.swung += 1;
        if (rt.swung === 1) {
            // The left half follows 0.3s later, so you have to cross over.
            rt.side = 'left';
            rt.phase = 'gap';
            rt.at = now;
            io.to(roomId).emit('guestTelegraph', {
                skill: 'half_sweep', side: 'left',
                angle: room.bossFacing + Math.PI / 2, halfAngle: Math.PI / 2,
                range: p.sweepRange, telegraphMs: p.sideGapMs
            });
            return;
        }
        // Straight into the beam.
        const t = pickGuestTarget(room);
        rt.stage = 'laser';
        rt.at = now;
        rt.angle = t ? Math.atan2(t.y - room.bossY, t.x - room.bossX) : room.bossFacing;
        rt.endAt = now + p.laserDurationMs;
        rt.nextDamageAt = now;
        io.to(roomId).emit('guestBossLaser', {
            angle: rt.angle, range: p.laserRange, width: p.laserWidth, durationMs: p.laserDurationMs
        });
        return;
    }

    if (rt.stage === 'laser') {
        if (now >= rt.endAt) {
            io.to(roomId).emit('guestBossLaserEnd', {});
            rt.stage = 'fall';
            rt.wave = 0;
            rt.phase = 'telegraph';
            rt.at = now;
            const t = pickGuestTarget(room);
            rt.x = t ? t.x : 0;
            rt.y = t ? t.y : 0;
            io.to(roomId).emit('guestTelegraph', {
                skill: 'half_sweep_fall', wave: 0, x: rt.x, y: rt.y,
                radius: p.fallRadius, telegraphMs: p.fallTelegraphMs
            });
            return;
        }
        // Swings after the nearest player, but slower than a cookie can run.
        const target = pickGuestTargetNearest(room);
        if (target) {
            const dist = Math.max(1, Math.hypot(target.x - room.bossX, target.y - room.bossY));
            const maxStep = (p.laserTrackSpeed * (50 / 1000)) / dist;
            const want = normalizeAngle(Math.atan2(target.y - room.bossY, target.x - room.bossX) - rt.angle);
            rt.angle = normalizeAngle(rt.angle + Math.max(-maxStep, Math.min(maxStep, want)));
        }
        io.to(roomId).emit('guestBossLaserAim', { angle: rt.angle });
        if (now < rt.nextDamageAt) return;
        rt.nextDamageAt += p.laserTickMs;
        for (const pl of guestAlivePlayers(room)) {
            if (!meleeLineHitPoint(room.bossX, room.bossY, rt.angle, p.laserRange, p.laserWidth,
                pl.x, pl.y, PLAYER_RADIUS)) continue;
            const id = Object.keys(room.players).find(k => room.players[k] === pl);
            applyDamageToGuestPlayer(roomId, id, p.laserDamage);
            if (!rooms[roomId]) return;
        }
        return;
    }

    // rt.stage === 'fall'
    if (rt.phase === 'telegraph' && now - rt.at >= p.fallTelegraphMs) {
        io.to(roomId).emit('guestSkillHit', {
            skill: 'half_sweep_fall', wave: rt.wave, x: rt.x, y: rt.y, radius: p.fallRadius
        });
        // It stays where it fell until the whole skill is over.
        room.fallZones.push({
            x: rt.x, y: rt.y, radius: p.fallRadius,
            damage: p.fallDamage, tickMs: p.fallTickMs, nextTickAt: now + p.fallTickMs
        });
        io.to(roomId).emit('guestFallZone', { x: rt.x, y: rt.y, radius: p.fallRadius });
        rt.wave += 1;
        if (rt.wave >= p.fallCount) {
            room.fallZones = [];
            io.to(roomId).emit('guestFallZonesCleared', {});
            endGuestPattern(room, def, now);
            return;
        }
        rt.phase = 'wait';
        rt.at = now;
    } else if (rt.phase === 'wait' && now - rt.at >= p.fallIntervalMs - p.fallTelegraphMs) {
        const t = pickGuestTarget(room);
        rt.phase = 'telegraph';
        rt.at = now;
        if (t) { rt.x = t.x; rt.y = t.y; }
        io.to(roomId).emit('guestTelegraph', {
            skill: 'half_sweep_fall', wave: rt.wave, x: rt.x, y: rt.y,
            radius: p.fallRadius, telegraphMs: p.fallTelegraphMs
        });
    }
}

// 6. 벽 가르기: raise a wall, pen the party in with a squad, and once that squad
// is dead throw a volley of spears before the wall comes back down.
function tickGuestArenaSplit(roomId, room, def, now) {
    const p = def.patterns.arena_split;
    const rt = room.bossRuntime;

    if (rt.phase === 'telegraph') {
        if (now - rt.at < p.telegraphMs) return;
        // Track exactly what this skill put in the pen: a leftover squad from an
        // earlier 부하 소환 could be stranded on the far side of the wall, and
        // waiting on those too would lock the fight up for good.
        rt.penIds = [];
        for (const group of p.minions) {
            rt.penIds.push(...spawnGuestMinionsOnSide(roomId, room, group, rt.side));
        }
        rt.phase = 'penned';
        rt.at = now;
        return;
    }

    if (rt.phase === 'penned') {
        if (rt.penIds.some(id => room.monsters[id] && room.monsters[id].alive)) return;
        // Pen cleared -> the spear volley starts.
        rt.phase = 'spear';
        rt.wave = 0;
        rt.spearPhase = 'telegraph';
        rt.at = now;
        const t = pickGuestTarget(room);
        rt.x = t ? t.x : 0;
        rt.y = t ? t.y : 0;
        io.to(roomId).emit('guestTelegraph', {
            skill: 'spear_throw', wave: 0, x: rt.x, y: rt.y,
            radius: p.spearRadius, telegraphMs: p.spearTelegraphMs
        });
        return;
    }

    // rt.phase === 'spear'
    if (rt.spearPhase === 'telegraph' && now - rt.at >= p.spearTelegraphMs) {
        io.to(roomId).emit('guestSkillHit', {
            skill: 'spear_throw', wave: rt.wave, x: rt.x, y: rt.y, radius: p.spearRadius
        });
        let hits = 0;
        for (const pl of guestAlivePlayers(room)) {
            if (Math.hypot(pl.x - rt.x, pl.y - rt.y) > p.spearRadius + PLAYER_RADIUS) continue;
            hits += 1;
            const id = Object.keys(room.players).find(k => room.players[k] === pl);
            applyDamageToGuestPlayer(roomId, id, p.spearDamage);
            if (!rooms[roomId]) return;
        }
        if (hits) healGuestBoss(roomId, room, p.spearHealOnHit * hits);
        rt.wave += 1;
        if (rt.wave >= p.spearCount) {
            room.wall = null;
            io.to(roomId).emit('guestWallDropped', {});
            endGuestPattern(room, def, now);
            return;
        }
        rt.spearPhase = 'wait';
        rt.at = now;
    } else if (rt.spearPhase === 'wait' && now - rt.at >= p.spearIntervalMs - p.spearTelegraphMs) {
        const t = pickGuestTarget(room);
        rt.spearPhase = 'telegraph';
        rt.at = now;
        if (t) { rt.x = t.x; rt.y = t.y; }
        io.to(roomId).emit('guestTelegraph', {
            skill: 'spear_throw', wave: rt.wave, x: rt.x, y: rt.y,
            radius: p.spearRadius, telegraphMs: p.spearTelegraphMs
        });
    }
}

function pickGuestTargetNearest(room) {
    let best = null, bestD = Infinity;
    for (const p of guestAlivePlayers(room)) {
        const d = Math.hypot(p.x - room.bossX, p.y - room.bossY);
        if (d < bestD) { bestD = d; best = p; }
    }
    return best;
}

function tickGuestRoom(roomId) {
    const room = rooms[roomId];
    if (!room || room.state !== 'fighting') return;
    const def = guestDefFor(room);
    const now = Date.now();

    // 바다펄맛 패시브는 체력이 오르내릴 때마다 켜지고 꺼진다. 피해와 회복이
    // 여러 갈래로 들어오므로 한 곳에서 매 틱 다시 본다.
    for (const pl of Object.values(room.players)) refreshLowHpMode(charOf(pl), pl);

    tickButterflyMode(room, now, (id, pl, dmg) => applyDamageToGuestPlayer(roomId, id, dmg));
    if (!rooms[roomId]) return;
    tickBodyFusion(room, roomId, now, 'guestBodyFormChanged', 'guestPlayerHealed');

    // Team buffs (the healer's ultimate) tick independently of the boss.
    if (room.activeBuffs.length) {
        room.activeBuffs = room.activeBuffs.filter(b => now < b.endAt);
        for (const buff of room.activeBuffs) {
            if (now - buff.lastTickAt < buff.tickMs) continue;
            buff.lastTickAt += buff.tickMs;
            if (buff.type === 'team_heal_over_time') healGuestTeam(room, roomId, buff.healPerTick);
            else if (buff.type === 'ally_heal_zone') {
                // 체리크림맛 특수스킬: 위 보스 레이드 분기 주석 참고.
                for (const [id, pl] of Object.entries(room.players)) {
                    if (!pl.alive) continue;
                    if (Math.hypot(buff.x - pl.x, buff.y - pl.y) > buff.radius + PLAYER_RADIUS) continue;
                    const healed = Math.min(pl.maxHp, pl.hp + buff.healPerTick);
                    if (healed !== pl.hp) {
                        pl.hp = healed;
                        pl.partyHp[pl.active] = pl.hp;
                        io.to(roomId).emit('guestPlayerHealed', { id, hp: pl.hp, partyHp: pl.partyHp });
                    }
                }
            }
            else if (buff.type === 'magma_zone') {
                const inside = guestCircleTargets(room, buff.x, buff.y, buff.radius);
                damageGuestTargets(roomId, room, inside, buff.damage, buff.casterId);
                if (!rooms[roomId]) return;
                // 치즈만두 덩어리는 깎으면서 표식도 같이 박는다.
                if (buff.markCharges) {
                    markGuestTargets(roomId, room, inside, buff.markElement,
                        { charges: buff.markCharges, multiplier: buff.markMultiplier });
                }
            } else if (buff.type === 'fire_line_zone') {
                // 불꽃요정맛 궁극기 지대: 사각형 안의 대상(보스·부하)은 계속 화염
                // 피해, 시전자 본인이 안에 있으면 계속 회복.
                const inside = guestLineTargets(room, buff.x, buff.y, buff.facing, buff.range, buff.width);
                if (inside.length) damageGuestTargets(roomId, room, inside, buff.damage, buff.casterId);
                if (!rooms[roomId]) return;
                const caster = room.players[buff.casterId];
                if (buff.healPerTick && caster && caster.alive
                    && meleeLineHitPoint(buff.x, buff.y, buff.facing, buff.range, buff.width, caster.x, caster.y, PLAYER_RADIUS)) {
                    caster.hp = Math.min(caster.maxHp, caster.hp + buff.healPerTick);
                    caster.partyHp[caster.active] = caster.hp;
                    io.to(roomId).emit('guestPlayerHealed', { id: buff.casterId, hp: caster.hp, partyHp: caster.partyHp });
                }
            } else if (buff.type === 'player_burn') {
                // guest2 기본 공격의 화상: 명중한 플레이어 한 명에게만, 초당
                // buff.damage씩 endAt까지 붙는다 (guestMonsterCtx.onHit에서 만듦).
                const pl = room.players[buff.targetId];
                if (pl && pl.alive) applyDamageToGuestPlayer(roomId, buff.targetId, buff.damage);
                if (!rooms[roomId]) return;
            }
        }
    }

    // Thrown drops. The boss and any add are both in the way of the same drop.
    tickPlayerProjectiles(roomId, room, 50, (pr) => {
        if (Math.abs(pr.x) > GUEST_ARENA_HALF_W || Math.abs(pr.y) > GUEST_ARENA_HALF_H) return true;
        const targets = guestCircleTargets(room, pr.x, pr.y, pr.radius);
        if (!targets.length) return false;
        damageGuestTargets(roomId, room, targets, pr.damage, pr.ownerId);
        if (!rooms[roomId]) return true;
        const owner = room.players[pr.ownerId];
        // 버블티맛 패시브: 던진 펄이 맞아도 표식이 쌓인다 (attackMarkUses가
        // 없는 캐릭터는 항상 0이라 다른 캐릭터는 그대로다).
        if (owner) {
            const oc = charOf(owner);
            const attackMarks = attackMarkChargesOf(oc, owner);
            if (attackMarks) markGuestTargets(roomId, room, targets, oc.element, attackMarkOpts(oc, attackMarks));
            if (!rooms[roomId]) return true;
        }
        if (owner && owner.alive) {
            const oc = charOf(owner);
            const selfHeal = passiveHitHeal(oc, owner);
            if (selfHeal) {
                owner.hp = Math.min(owner.maxHp, owner.hp + selfHeal);
                owner.partyHp[owner.active] = owner.hp;
                io.to(roomId).emit('guestPlayerHealed', { id: pr.ownerId, hp: owner.hp, partyHp: owner.partyHp });
            }
            if (oc.attackHealOnUse && Math.random() < (oc.attackHealChance ?? 1)) {
                // 던진 화살/구슬도 근접과 같은 나선(attack_heal_boost류) 증폭을 받는다.
                const boosted = oc.ultimateHealPerAttack != null && owner.attackHealBoostUntil
                    && Date.now() < owner.attackHealBoostUntil;
                healGuestTeam(room, roomId, boosted ? oc.ultimateHealPerAttack : oc.attackHealOnUse);
            }
            if (oc.attackShieldOnUse && Math.random() < (oc.attackShieldChance ?? 1)) {
                addShieldGuestTeam(room, roomId, oc.attackShieldOnUse);
            }
        }
        return true;
    }, 'guestDropGone', (pr, dt) => {
        let bestX = null, bestY = null, bestDist = Math.hypot(pr.x - room.bossX, pr.y - room.bossY);
        bestX = room.bossX; bestY = room.bossY;
        for (const m of Object.values(room.monsters)) {
            if (!m.alive) continue;
            const d = Math.hypot(pr.x - m.x, pr.y - m.y);
            if (d < bestDist) { bestDist = d; bestX = m.x; bestY = m.y; }
        }
        steerProjectileToward(pr, bestX, bestY, dt);
    }, 'guestDropUpdate');
    if (!rooms[roomId]) return;

    // 보스 자신이 던진 투사체(예: 불꽃요정맛 기본 공격)도 이 큐에 들어가므로,
    // 부하가 하나도 없는 순간에도 항상 돌려야 한다 -- 예전엔 아래 if 블록
    // 안에서만 돌아서, 부하 없는 판에서 보스 투사체가 아예 움직이지 않고
    // room.projectiles에 계속 쌓이기만 하는 버그가 있었다.
    const mctx = guestMonsterCtx(roomId, room);
    const gTargets = aliveTargetsOf(room);
    tickMonsterProjectiles(mctx, gTargets, 50);
    if (!rooms[roomId]) return;

    // Summoned adds (2차) live in the same room and fight on their own clock.
    if (Object.keys(room.monsters).length) {
        // 부하는 몬스터를 먼저 치고, 없으면 보스를 친다.
        tickSummons(roomId, room, now, {
            nearestEnemy: (s) => {
                let best = null, bestD = Infinity;
                for (const [mid, m] of Object.entries(room.monsters)) {
                    if (!m.alive) continue;
                    const d = Math.hypot(m.x - s.x, m.y - s.y);
                    if (d < bestD) { bestD = d; best = { x: m.x, y: m.y, radius: mR(m), mid }; }
                }
                if (best) return best;
                const gdef = GUEST_BOSS_DEFS[room.guestId];
                return { x: room.bossX, y: room.bossY, radius: (gdef && gdef.radius) || 46, boss: true };
            },
            clamp: (s) => {
                s.x = Math.max(-GUEST_ARENA_HALF_W, Math.min(GUEST_ARENA_HALF_W, s.x));
                s.y = Math.max(-GUEST_ARENA_HALF_H, Math.min(GUEST_ARENA_HALF_H, s.y));
            },
            hit: (t, dmg, s) => {
                if (t.boss) damageGuestBoss(roomId, room, dmg, s.ownerId);
                else damageGuestMonster(roomId, room, t.mid, dmg);
            }
        });
        if (!rooms[roomId]) return;

        tickMonsterSet(mctx, gTargets, now);
        if (!rooms[roomId]) return;
    }

    // 낙하물 left on the ground burn anyone standing in one.
    for (const zone of room.fallZones) {
        if (now < zone.nextTickAt) continue;
        zone.nextTickAt += zone.tickMs;
        for (const p of guestAlivePlayers(room)) {
            if (Math.hypot(p.x - zone.x, p.y - zone.y) > zone.radius + PLAYER_RADIUS) continue;
            const id = Object.keys(room.players).find(k => room.players[k] === p);
            applyDamageToGuestPlayer(roomId, id, zone.damage);
            if (!rooms[roomId]) return;
        }
    }

    // Spears left stuck in the ground burn whoever stands on them.
    for (const spear of room.stuckSpears) {
        if (now < spear.nextTickAt) continue;
        spear.nextTickAt += def.patterns.spear_drop.stuckTickMs;
        for (const p of guestAlivePlayers(room)) {
            if (Math.hypot(p.x - spear.x, p.y - spear.y) > def.patterns.spear_drop.stuckRadius + PLAYER_RADIUS) continue;
            const id = Object.keys(room.players).find(k => room.players[k] === p);
            applyDamageToGuestPlayer(roomId, id, def.patterns.spear_drop.stuckDamage);
            if (!rooms[roomId]) return;
        }
    }

    if (room.phaseTransitioned) {
        io.to(roomId).emit('guestTick', guestTickPayload(room));
        return;
    }

    // Face whoever it is about to hit, so the body/spears point sensibly.
    const focus = guestAlivePlayers(room)[0];
    if (focus) room.bossFacing = Math.atan2(focus.y - room.bossY, focus.x - room.bossX);

    if (room.bossState === 'idle') {
        if (now >= room.nextSkillAt && guestAlivePlayers(room).length) {
            beginGuestSkill(roomId, room, def, now);
        }
    } else if (room.bossPattern === 'spear_jab') {
        const p = def.patterns.spear_jab;
        const rt = room.bossRuntime;
        if (rt.phase === 'telegraph' && now - rt.at >= p.telegraphMs) {
            io.to(roomId).emit('guestSkillHit', { skill: 'spear_jab', wave: rt.wave, angle: rt.angle, range: p.range, width: p.width });
            for (const pl of guestAlivePlayers(room)) {
                if (!meleeLineHitPoint(room.bossX, room.bossY, rt.angle, p.range, p.width, pl.x, pl.y, PLAYER_RADIUS)) continue;
                const id = Object.keys(room.players).find(k => room.players[k] === pl);
                applyDamageToGuestPlayer(roomId, id, p.damage);
                if (!rooms[roomId]) return;
            }
            rt.wave += 1;
            if (rt.wave >= p.waves) {
                room.bossState = 'idle';
                room.bossPattern = null;
                room.nextSkillAt = now + def.skillIntervalMs;
            } else {
                // Re-aims for each thrust, so standing still through all five hurts.
                const t = pickGuestTarget(room);
                rt.phase = 'telegraph';
                rt.at = now;
                rt.angle = t ? Math.atan2(t.y - room.bossY, t.x - room.bossX) : rt.angle;
                io.to(roomId).emit('guestTelegraph', {
                    skill: 'spear_jab', wave: rt.wave, angle: rt.angle,
                    range: p.range, width: p.width, telegraphMs: p.telegraphMs
                });
            }
        }
    } else if (room.bossPattern === 'spear_drop') {
        const p = def.patterns.spear_drop;
        const rt = room.bossRuntime;
        if (rt.phase === 'telegraph' && now - rt.at >= p.telegraphMs) {
            io.to(roomId).emit('guestSkillHit', { skill: 'spear_drop', wave: rt.wave, x: rt.x, y: rt.y, radius: p.markRadius });
            guestCircleHit(room, roomId, rt.x, rt.y, p.markRadius, p.damage);
            if (!rooms[roomId]) return;
            // ...and the spear stays stuck where it landed.
            room.stuckSpears.push({ x: rt.x, y: rt.y, nextTickAt: now + p.stuckTickMs });
            io.to(roomId).emit('guestSpearStuck', { x: rt.x, y: rt.y, radius: p.stuckRadius });

            rt.wave += 1;
            if (rt.wave >= p.waves) {
                // All six done -> every stuck spear vanishes at once.
                room.stuckSpears = [];
                io.to(roomId).emit('guestSpearsCleared', {});
                room.bossState = 'idle';
                room.bossPattern = null;
                room.nextSkillAt = now + def.skillIntervalMs;
            } else {
                rt.phase = 'wait';
                rt.at = now;
            }
        } else if (rt.phase === 'wait' && now - rt.at >= p.waveIntervalMs - p.telegraphMs) {
            const t = pickGuestTarget(room);
            rt.phase = 'telegraph';
            rt.at = now;
            if (t) { rt.x = t.x; rt.y = t.y; }
            io.to(roomId).emit('guestTelegraph', {
                skill: 'spear_drop', wave: rt.wave, x: rt.x, y: rt.y,
                radius: p.markRadius, telegraphMs: p.telegraphMs
            });
        }
    } else if (room.bossPattern === 'big_slash') {
        const p = def.patterns.big_slash;
        const rt = room.bossRuntime;
        if (now - rt.at >= rt.windupMs) {
            io.to(roomId).emit('guestSkillHit', {
                skill: 'big_slash', near: rt.near, x: rt.x, y: rt.y, radius: rt.radius
            });
            guestCircleHit(room, roomId, rt.x, rt.y, rt.radius, p.damage);
            if (!rooms[roomId]) return;
            room.bossState = 'idle';
            room.bossPattern = null;
            room.nextSkillAt = now + def.skillIntervalMs;
        }
    } else if (room.bossPattern === 'summon_minions') {
        const p = def.patterns.summon_minions;
        const rt = room.bossRuntime;
        if (now - rt.at >= p.telegraphMs) {
            spawnGuestMinions(roomId, room, rt.variant);
            endGuestPattern(room, def, now); // one squad and the skill is done
        }
    } else if (room.bossPattern === 'half_sweep') {
        tickGuestHalfSweep(roomId, room, def, now);
        if (!rooms[roomId]) return;
    } else if (room.bossPattern === 'empower') {
        const p = def.patterns.empower;
        const rt = room.bossRuntime;
        if (now - rt.at >= p.telegraphMs) {
            room.bossHp = Math.min(room.bossMaxHp, room.bossHp + p.healAmount);
            room.bossShieldHp = p.shieldAmount;
            // Refreshes rather than stacking -- 0.8 x 0.8 x ... would end the fight.
            room.playerDamageMultiplier = p.playerDamageMultiplier;
            room.playerDamageDebuffUntil = now + p.durationMs;
            io.to(roomId).emit('guestBossEmpowered', {
                bossHp: room.bossHp, shieldHp: room.bossShieldHp,
                damageMultiplier: p.playerDamageMultiplier, durationMs: p.durationMs
            });
            endGuestPattern(room, def, now);
        }
    } else if (room.bossPattern === 'spear_throw') {
        const p = def.patterns.spear_throw;
        const rt = room.bossRuntime;
        if (rt.phase === 'telegraph' && now - rt.at >= p.telegraphMs) {
            io.to(roomId).emit('guestSkillHit', { skill: 'spear_throw', wave: rt.wave, x: rt.x, y: rt.y, radius: p.radius });
            // Every spear that connects feeds the boss.
            let hits = 0;
            for (const pl of guestAlivePlayers(room)) {
                if (Math.hypot(pl.x - rt.x, pl.y - rt.y) > p.radius + PLAYER_RADIUS) continue;
                hits += 1;
                const id = Object.keys(room.players).find(k => room.players[k] === pl);
                applyDamageToGuestPlayer(roomId, id, p.damage);
                if (!rooms[roomId]) return;
            }
            if (hits) healGuestBoss(roomId, room, p.healOnHit * hits);
            rt.wave += 1;
            if (rt.wave >= p.count) endGuestPattern(room, def, now);
            else { rt.phase = 'wait'; rt.at = now; }
        } else if (rt.phase === 'wait' && now - rt.at >= p.intervalMs - p.telegraphMs) {
            const t = pickGuestTarget(room);
            rt.phase = 'telegraph';
            rt.at = now;
            if (t) { rt.x = t.x; rt.y = t.y; }
            io.to(roomId).emit('guestTelegraph', {
                skill: 'spear_throw', wave: rt.wave, x: rt.x, y: rt.y,
                radius: p.radius, telegraphMs: p.telegraphMs
            });
        }
    } else if (room.bossPattern === 'arena_split') {
        tickGuestArenaSplit(roomId, room, def, now);
        if (!rooms[roomId]) return;
    } else if (room.bossPattern === 'barrage') {
        const p = def.patterns.barrage;
        const rt = room.bossRuntime;
        if (now - rt.at >= p.waveMs) {
            // The volley that was on the ground for the last second lands, then
            // vanishes and a fresh one drops somewhere else.
            let hits = 0;
            for (const pl of guestAlivePlayers(room)) {
                if (!rt.spears.some(s => Math.abs(pl.x - s.x) <= p.size / 2 + PLAYER_RADIUS
                    && Math.abs(pl.y - s.y) <= p.size / 2 + PLAYER_RADIUS)) continue;
                hits += 1;
                const id = Object.keys(room.players).find(k => room.players[k] === pl);
                applyDamageToGuestPlayer(roomId, id, p.damage);
                if (!rooms[roomId]) return;
            }
            if (hits) healGuestBoss(roomId, room, p.healOnHit * hits);
            rt.wave += 1;
            if (rt.wave >= p.waves) {
                io.to(roomId).emit('guestBarrageCleared', {});
                endGuestPattern(room, def, now);
            } else {
                rt.spears = rollGuestBarrage(p.waveCount, p.size, rt.spears);
                rt.at = now;
                io.to(roomId).emit('guestBarrageWave', { wave: rt.wave, size: p.size, spears: rt.spears });
            }
        }
    }

    if (!rooms[roomId]) return;
    io.to(roomId).emit('guestTick', guestTickPayload(room));
}

function guestTickPayload(room) {
    const monsters = {};
    for (const [id, m] of Object.entries(room.monsters)) {
        if (!m.alive) continue;
        monsters[id] = {
            type: m.type, x: m.x, y: m.y, hp: m.hp, maxHp: m.maxHp, alive: true,
            state: m.state, laser: m.laser ? { angle: m.laser.angle } : null
        };
    }
    return {
        summons: publicSummons(room),
        bossHp: room.bossHp,
        bossMaxHp: room.bossMaxHp,
        bossShieldHp: room.bossShieldHp || 0,
        bossFacing: room.bossFacing,
        phase: room.phase,
        stuckSpears: room.stuckSpears.map(s => ({ x: s.x, y: s.y })),
        fallZones: room.fallZones.map(z => ({ x: z.x, y: z.y, radius: z.radius })),
        wall: room.wall,
        monsters,
        projectiles: publicProjectiles(room),
        players: publicGuestPlayers(room)
    };
}

// ==================== 좀비막기 ====================
// 다른 두 레이드처럼 rooms[roomId] 하나를 쓰지만, 상대는 보스가 아니라
// 웨이브마다 불어나는 좀비 무리다. tickMonsterSet의 텔레그래프/카이팅 같은
// 정교한 상태기계는 필요 없어서 좀비 전용으로 훨씬 단순한 길찾기+근접 로직을
// 새로 둔다. 아레나는 가로로 긴 15x8(120칸) 격자(room.grid, 인덱스 0~119)로
// 나뉘어 있고, 칸에 지어진 것(울타리/제작대/용광로/터렛)은 전부 통째로 막힌
// 장애물이다. 좀비는 항상 아레나 오른쪽 가장자리에서만 나타나 왼쪽으로
// 밀려오며, 그 장애물들을 피해 실제로 길을 찾아 우회하고
// (zombieBuildFlowField), 우회할 길이 아예 없을 때만 눈앞의 장애물을 두드려
// 부순다.
function findOpenZombieRoom() {
    for (const [roomId, room] of Object.entries(rooms)) {
        if (room.kind === 'zombie' && room.state === 'waiting' && !room.solo && Object.keys(room.players).length < 2) {
            return roomId;
        }
    }
    return null;
}

function createZombieRoom(solo) {
    const roomId = `zombie_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    rooms[roomId] = {
        kind: 'zombie',
        solo: !!solo,
        state: 'waiting',
        players: {},
        wave: 1,
        wavePhase: 'prep', // 'prep' | 'active'
        phaseUntil: 0,
        pendingSpawns: 0,
        nextSpawnAt: 0,
        zombies: {},
        nextZombieId: 0,
        grid: new Array(ZOMBIE_CELL_COUNT).fill(null), // index -> { type, hp, maxHp, nextAttackAt? }
        soldiers: {}, // id -> { spawnerIndex, x, y, hp, maxHp, facing, nextAttackAt }
        nextSoldierId: 0,
        trees: {}, // treeId -> { x, y, hitsLeft }
        nextTreeId: 0,
        nextTreeSpawnAt: 0,
        wood: 0, // 파티 공용 자원
        coins: 0, // 파티 공용, 클리어(사망) 시 실제 재화로 전환됨
        ore: 0, // 채굴기가 캐낸 광석 (파티 공용)
        iron: 0, // 용광로가 정련한 철 (파티 공용)
        // 강화대에서 산 강화 네 가지. 전부 이 판에서만(방이 사라지면) 유지된다.
        atkUpgradeLevel: 0, // 내 기본공격 피해
        turretAtkUpgradeLevel: 0, // 터렛/강화 터렛/대포의 발사 피해
        fenceHpUpgradeLevel: 0, // 새/기존 울타리 최대 체력
        soldierAtkUpgradeLevel: 0, // 병사의 공격 피해
        zombieFields: [], // 매 틱 다시 계산되는 길찾기 거리장 (recomputeZombieFields)
        loopHandle: null
    };
    return roomId;
}

function makeZombiePlayer(charType, equip, slotIndex, instinctLevel, charLevel) {
    const bonus = bonusFrom(equip, charType, instinctLevel);
    const character = charFrom(charType, equip, instinctLevel, charLevel);
    const maxHp = character.health + bonus.health;
    return {
        charType, bonus, character,
        // 좀비는 항상 오른쪽에서 오므로, 왼쪽에 자리를 잡아야 그 사이에 지을
        // 공간이 생긴다.
        x: -ZOMBIE_ARENA_HALF_W / 2, y: slotIndex === 0 ? -40 : 40,
        facing: 0,
        hp: maxHp, maxHp,
        alive: true, ready: false,
        lastAttackTime: 0,
        nextHouseHealAt: 0 // 집 위에 서 있을 때 다음 회복 시각
    };
}

function publicZombiePlayers(room) {
    const out = {};
    for (const [id, p] of Object.entries(room.players)) {
        out[id] = { x: p.x, y: p.y, facing: p.facing, alive: p.alive, ready: !!p.ready, charType: p.charType, hp: p.hp, maxHp: p.maxHp };
    }
    return out;
}

// 아레나 안, 서로 너무 붙지 않는 자리에 나무를 하나 심는다 (건물 칸과는
// 무관하게 자유 좌표를 쓴다 -- 나무는 격자에 묶이지 않는다). 20번 시도해도
// 자리가 안 나면 아무 데나 대충 심는다 -- 게임을 멈추는 것보단 낫다.
function randomZombieTreeSpot(room) {
    const margin = 40;
    for (let attempt = 0; attempt < 20; attempt++) {
        const x = -ZOMBIE_ARENA_HALF_W + margin + Math.random() * (ZOMBIE_ARENA_HALF_W * 2 - margin * 2);
        const y = -ZOMBIE_ARENA_HALF_H + margin + Math.random() * (ZOMBIE_ARENA_HALF_H * 2 - margin * 2);
        if (Math.hypot(x + ZOMBIE_ARENA_HALF_W / 2, y) < 90) continue; // 스폰 지점 바로 옆은 피한다
        const tooClose = Object.values(room.trees).some(t => Math.hypot(t.x - x, t.y - y) < 70);
        if (!tooClose) return { x, y };
    }
    return { x: ZOMBIE_ARENA_HALF_W - margin, y: 0 };
}

function spawnZombieTree(room) {
    const spot = randomZombieTreeSpot(room);
    const id = `t${room.nextTreeId++}`;
    room.trees[id] = { x: spot.x, y: spot.y, hitsLeft: ZOMBIE_TREE_HITS };
    return id;
}

function startZombieFight(roomId) {
    const room = rooms[roomId];
    if (!room || room.kind !== 'zombie' || room.state !== 'waiting') return;
    if (Object.keys(room.players).length === 0) return;

    room.state = 'fighting';
    room.wave = 1;
    room.wavePhase = 'prep';
    room.phaseUntil = Date.now() + ZOMBIE_PREP_MS;
    room.wood = 0;
    room.coins = 0;
    room.ore = 0;
    room.iron = 0;
    room.atkUpgradeLevel = 0;
    room.turretAtkUpgradeLevel = 0;
    room.fenceHpUpgradeLevel = 0;
    room.soldierAtkUpgradeLevel = 0;
    room.zombies = {};
    room.grid = new Array(ZOMBIE_CELL_COUNT).fill(null);
    room.soldiers = {};
    room.trees = {};
    for (let i = 0; i < ZOMBIE_MAX_TREES; i++) spawnZombieTree(room);

    io.to(roomId).emit('zombieStarted', {
        players: publicZombiePlayers(room),
        wave: room.wave, wavePhase: room.wavePhase, phaseUntil: room.phaseUntil,
        wood: room.wood, coins: room.coins, ore: room.ore, iron: room.iron,
        atkUpgradeLevel: room.atkUpgradeLevel, turretAtkUpgradeLevel: room.turretAtkUpgradeLevel,
        fenceHpUpgradeLevel: room.fenceHpUpgradeLevel, soldierAtkUpgradeLevel: room.soldierAtkUpgradeLevel,
        trees: room.trees, grid: room.grid, soldiers: room.soldiers
    });

    room.loopHandle = setInterval(() => tickZombieRoom(roomId), 50);
}

// 좀비는 항상 아레나 오른쪽 가장자리에서만 나타난다.
function randomZombieSpawnPos() {
    const y = (Math.random() * 2 - 1) * ZOMBIE_ARENA_HALF_H;
    return { x: ZOMBIE_ARENA_HALF_W, y };
}

function spawnZombie(roomId, room, now) {
    const type = zombieRollTypeForWave(room.wave);
    const stats = zombieStatsForWave(type, room.wave);
    const pos = randomZombieSpawnPos();
    const id = `z${room.nextZombieId++}`;
    room.zombies[id] = {
        type, x: pos.x, y: pos.y, hp: stats.hp, maxHp: stats.hp,
        // 공격력/벽 피해도 웨이브별로 커지므로, ZOMBIE_DEFS의 고정값이 아니라
        // 스폰 시점에 굳힌 이 값을 tickZombie가 쓴다.
        attackDamage: stats.attackDamage, structureDamage: stats.structureDamage,
        nextAttackAt: 0, facing: Math.atan2(-pos.y, -pos.x)
    };
    io.to(roomId).emit('zombieSpawned', { id, ...room.zombies[id] });
}

// BFS로 startIndex(플레이어가 서 있는 칸)에서부터 걸어갈 수 있는 모든 칸까지의
// 거리와, 그 칸에서 한 걸음에 밟아야 할 다음 칸(next)을 함께 구한다. 이러면
// 좀비 각자가 매번 길을 다시 찾을 필요 없이 next[내 칸]만 보면 된다.
function zombieBuildFlowField(room, startIndex) {
    const dist = new Array(ZOMBIE_CELL_COUNT).fill(Infinity);
    const next = new Array(ZOMBIE_CELL_COUNT).fill(-1);
    dist[startIndex] = 0;
    const queue = [startIndex];
    let qi = 0;
    while (qi < queue.length) {
        const cur = queue[qi++];
        const { col, row } = zombieCellColRow(cur);
        const neighbors = [[col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1]];
        for (const [c, r] of neighbors) {
            if (c < 0 || c >= ZOMBIE_GRID_COLS || r < 0 || r >= ZOMBIE_GRID_ROWS) continue;
            const idx = zombieCellIndex(c, r);
            if (dist[idx] !== Infinity) continue;
            if (room.grid[idx]) continue; // 지어진 것이 있으면 지나갈 수 없다
            dist[idx] = dist[cur] + 1;
            next[idx] = cur; // idx 칸에서는 cur로 한 걸음 가면 시작점에 가까워진다
            queue.push(idx);
        }
    }
    return { dist, next };
}

// 살아있는 플레이어별로 하나씩(같은 칸이면 하나만) 거리장을 만들어 둔다.
// 좀비 마릿수만큼 매번 새로 찾지 않고, 좀비는 이미 계산된 이 표만 읽는다.
function recomputeZombieFields(room) {
    const seen = new Set();
    const fields = [];
    for (const p of Object.values(room.players)) {
        if (!p.alive) continue;
        const cellIdx = zombieCellIndexOfPos(p.x, p.y);
        if (seen.has(cellIdx)) continue;
        seen.add(cellIdx);
        const field = zombieBuildFlowField(room, cellIdx);
        fields.push({ playerX: p.x, playerY: p.y, dist: field.dist, next: field.next });
    }
    room.zombieFields = fields;
}

// 레벨당 +0.5처럼 소수점 있는 값이 쌓인 것 -- 실제로 적용할 때만 정수로
// 버림한다. 새로 짓는 울타리(빌드 시점)와 이미 지어진 울타리(강화 살 때
// 차액만큼 보정)가 똑같은 이 계산을 공유한다.
function zombieFenceHpBonus(level) {
    return Math.floor(level * ZOMBIE_FENCE_HP_UPGRADE_AMOUNT);
}

function damageZombieStructure(roomId, room, index, amount) {
    const cell = room.grid[index];
    if (!cell) return;
    cell.hp -= amount;
    if (cell.hp <= 0) {
        room.grid[index] = null;
        io.to(roomId).emit('zombieStructureBroken', { index });
    } else {
        io.to(roomId).emit('zombieHitStructure', { index, hp: cell.hp });
    }
}

function zombieDamagePlayer(roomId, room, target, amount) {
    target.hp = Math.max(0, target.hp - amount);
    const pid = Object.keys(room.players).find(id => room.players[id] === target);
    io.to(roomId).emit('zombiePlayerDamaged', { id: pid, hp: target.hp });
    if (target.hp <= 0 && target.alive) {
        target.alive = false;
        io.to(roomId).emit('zombiePlayerDown', { id: pid });
        checkZombieWipe(roomId, room);
    }
}

// 좀비 하나의 이동/공격. 사거리 안이면 바로 때리고, 아니면 미리 계산된
// 거리장을 따라 다음 칸으로 한 걸음 옮긴다. 갈 수 있는 길이 아예 없을 때만
// (플레이어가 스스로를 완전히 막아 버렸을 때) 직선으로 다가가다 막히면
// 그 자리의 건조물을 두드린다.
function tickZombie(roomId, room, zid, z, alivePlayers, now) {
    const def = ZOMBIE_DEFS[z.type];
    let nearest = null, nearestDist = Infinity;
    for (const p of alivePlayers) {
        const d = Math.hypot(p.x - z.x, p.y - z.y);
        if (d < nearestDist) { nearestDist = d; nearest = p; }
    }
    if (!nearest) return;

    // 병사가 나보다 더 가까이 있으면(그리고 사거리 안이면) 플레이어 대신
    // 그 병사를 후려친다 -- 지나가다 마주친 병사와 서로 치고받는 셈이다.
    // 경로 자체는 여전히 플레이어를 향한다 (병사를 쫓아다니지는 않는다).
    let nearestSoldierId = null, nearestSoldier = null, nearestSoldierDist = Infinity;
    for (const [sid, s] of Object.entries(room.soldiers)) {
        const d = Math.hypot(s.x - z.x, s.y - z.y);
        if (d < nearestSoldierDist) { nearestSoldierDist = d; nearestSoldier = s; nearestSoldierId = sid; }
    }

    const reach = def.attackRange + PLAYER_RADIUS;
    const reachSoldier = def.attackRange + ZOMBIE_SOLDIER_DEF.radius;
    const playerInRange = nearestDist <= reach;
    const soldierInRange = nearestSoldier && nearestSoldierDist <= reachSoldier;
    if (playerInRange || soldierInRange) {
        if (now < z.nextAttackAt) return;
        z.nextAttackAt = now + def.attackCooldown;
        if (soldierInRange && (!playerInRange || nearestSoldierDist < nearestDist)) {
            nearestSoldier.hp -= z.attackDamage;
            if (nearestSoldier.hp <= 0) {
                delete room.soldiers[nearestSoldierId];
                io.to(roomId).emit('zombieSoldierDied', { id: nearestSoldierId });
            } else {
                io.to(roomId).emit('zombieHitSoldier', { id: nearestSoldierId, hp: nearestSoldier.hp });
            }
        } else {
            zombieDamagePlayer(roomId, room, nearest, z.attackDamage);
        }
        return;
    }

    const myCell = zombieCellIndexOfPos(z.x, z.y);
    let bestField = null, bestDist = Infinity;
    for (const f of room.zombieFields) {
        const d = f.dist[myCell];
        if (d < bestDist) { bestDist = d; bestField = f; }
    }

    let dest;
    if (bestField && bestDist !== Infinity) {
        dest = bestDist <= 1
            ? { x: bestField.playerX, y: bestField.playerY }
            : zombieCellCenter(bestField.next[myCell]);
    } else {
        dest = { x: nearest.x, y: nearest.y };
    }

    z.facing = Math.atan2(dest.y - z.y, dest.x - z.x);
    const dist = Math.hypot(dest.x - z.x, dest.y - z.y) || 0.001;
    const step = def.speed * 3; // px/tick, monsterSpeed의 관례와 맞춘 값

    // 갈 수 있는 길이 없어서 직선으로 다가가는 경우에만, 코앞이 막혀 있으면
    // 이동 대신 그 칸을 두드린다.
    if (!bestField || bestDist === Infinity) {
        const aheadX = z.x + Math.cos(z.facing) * (def.radius + 12);
        const aheadY = z.y + Math.sin(z.facing) * (def.radius + 12);
        const aheadIdx = zombieCellIndexOfPos(aheadX, aheadY);
        if (room.grid[aheadIdx]) {
            if (now < z.nextAttackAt) return;
            z.nextAttackAt = now + def.attackCooldown;
            damageZombieStructure(roomId, room, aheadIdx, z.structureDamage);
            return;
        }
    }

    const move = Math.min(step, dist);
    z.x += Math.cos(z.facing) * move;
    z.y += Math.sin(z.facing) * move;
}

// 자동으로 공격하는 시설(터렛/강화 터렛/대포)의 공격. def.range가 있는
// 종류는 전부 여기서 처리한다 -- 사거리 안의 가장 가까운 좀비를 쏘고, 대포는
// range가 Infinity라 사실상 맵 전체가 사거리다. 전부 ZOMBIE_WORKBENCH_ITEMS
// 에서 자기 수치를 읽는다.
function tickZombieTurrets(roomId, room, now) {
    room.grid.forEach((cell, index) => {
        if (!cell) return;
        const def = ZOMBIE_WORKBENCH_ITEMS[cell.type];
        if (!def || def.range == null) return;
        if (now < (cell.nextAttackAt || 0)) return;
        const center = zombieCellCenter(index);
        let nearestId = null, nearest = null, nearestDist = Infinity;
        for (const [zid, z] of Object.entries(room.zombies)) {
            const d = Math.hypot(z.x - center.x, z.y - center.y);
            if (d < nearestDist) { nearestDist = d; nearest = z; nearestId = zid; }
        }
        if (!nearest || nearestDist > def.range) return;
        cell.nextAttackAt = now + def.attackCooldown;
        nearest.hp -= def.damage + Math.floor(room.turretAtkUpgradeLevel * ZOMBIE_ATK_UPGRADE_AMOUNT);
        io.to(roomId).emit('zombieTurretFired', { index, targetId: nearestId });
        if (nearest.hp <= 0) {
            delete room.zombies[nearestId];
            room.coins += ZOMBIE_COIN_PER_KILL;
            io.to(roomId).emit('zombieKilled', { id: nearestId, coins: room.coins });
        }
    });
}

// 채굴기는 10초마다 광석을 하나 캐내고, 용광로는 광석이 있을 때 8초마다
// 하나를 철로 정련한다. 광석이 없으면 용광로의 타이머는 그냥 멈춰 있다가
// (nextSmeltAt이 과거에 머물러 있으므로) 광석이 생기는 즉시 바로 돌아간다.
function tickZombieEconomy(room, now) {
    room.grid.forEach((cell) => {
        if (!cell) return;
        if (cell.type === 'miner' && now >= (cell.nextOreAt || 0)) {
            room.ore++;
            cell.nextOreAt = now + ZOMBIE_MINER_ORE_INTERVAL_MS;
        } else if (cell.type === 'furnace' && now >= (cell.nextSmeltAt || 0) && room.ore > 0) {
            room.ore--;
            room.iron++;
            cell.nextSmeltAt = now + ZOMBIE_FURNACE_SMELT_MS;
        }
    });
}

// 집 칸 위에 서 있는 살아있는 플레이어를 0.5초마다 1씩 회복시킨다.
function tickZombieHouseHealing(room, now) {
    for (const p of Object.values(room.players)) {
        if (!p.alive || p.hp >= p.maxHp) continue;
        const cell = room.grid[zombieCellIndexOfPos(p.x, p.y)];
        if (!cell || cell.type !== 'house') continue;
        if (now < (p.nextHouseHealAt || 0)) continue;
        p.hp = Math.min(p.maxHp, p.hp + ZOMBIE_HOUSE_HEAL_AMOUNT);
        p.nextHouseHealAt = now + ZOMBIE_HOUSE_HEAL_INTERVAL_MS;
    }
}

// 병사소환기가 ZOMBIE_SOLDIER_SPAWN_MS마다 병사를 하나 뽑는다. 스포너
// 하나당 살아있는 병사가 ZOMBIE_SOLDIER_CAP_PER_SPAWNER를 넘으면(그 스포너가
// 뽑은 병사만 센다) 그 병사가 죽어 자리가 날 때까지 쉰다.
function tickZombieSoldierSpawners(room, now) {
    room.grid.forEach((cell, index) => {
        if (!cell || cell.type !== 'soldierSpawner') return;
        if (now < (cell.nextSpawnAt || 0)) return;
        cell.nextSpawnAt = now + ZOMBIE_SOLDIER_SPAWN_MS;
        const alive = Object.values(room.soldiers).filter(s => s.spawnerIndex === index).length;
        if (alive >= ZOMBIE_SOLDIER_CAP_PER_SPAWNER) return;
        const pos = zombieCellCenter(index);
        const id = `s${room.nextSoldierId++}`;
        room.soldiers[id] = {
            spawnerIndex: index, x: pos.x, y: pos.y,
            hp: ZOMBIE_SOLDIER_DEF.hp, maxHp: ZOMBIE_SOLDIER_DEF.hp,
            facing: 0, nextAttackAt: 0
        };
    });
}

// 병사 하나하나의 행동: 가장 가까운 좀비가 있으면 그쪽으로 곧장 걸어가고
// (격자 장애물은 좀비와 달리 무시한다 -- 내 편이 내가 지은 벽에 갇히면
// 이상하다), 사거리 안이면 두드린다. 좀비가 없으면 제자리에 서 있는다.
function tickZombieSoldiers(roomId, room, now) {
    for (const [sid, s] of Object.entries(room.soldiers)) {
        let nearest = null, nearestId = null, nearestDist = Infinity;
        for (const [zid, z] of Object.entries(room.zombies)) {
            const d = Math.hypot(z.x - s.x, z.y - s.y);
            if (d < nearestDist) { nearestDist = d; nearest = z; nearestId = zid; }
        }
        if (!nearest) continue;

        const reach = ZOMBIE_SOLDIER_DEF.attackRange + ZOMBIE_DEFS[nearest.type].radius;
        if (nearestDist <= reach) {
            if (now < s.nextAttackAt) continue;
            s.nextAttackAt = now + ZOMBIE_SOLDIER_DEF.attackCooldown;
            nearest.hp -= ZOMBIE_SOLDIER_DEF.attackDamage + Math.floor(room.soldierAtkUpgradeLevel * ZOMBIE_ATK_UPGRADE_AMOUNT);
            io.to(roomId).emit('zombieSoldierAttacked', { id: sid, targetId: nearestId });
            if (nearest.hp <= 0) {
                delete room.zombies[nearestId];
                room.coins += ZOMBIE_COIN_PER_KILL;
                io.to(roomId).emit('zombieKilled', { id: nearestId, coins: room.coins });
            }
            continue;
        }

        s.facing = Math.atan2(nearest.y - s.y, nearest.x - s.x);
        const step = ZOMBIE_SOLDIER_DEF.speed * 3; // px/tick, monsterSpeed의 관례와 맞춘 값
        const move = Math.min(step, nearestDist - reach + 1);
        s.x += Math.cos(s.facing) * move;
        s.y += Math.sin(s.facing) * move;
    }
}

function checkZombieWipe(roomId, room) {
    if (!Object.values(room.players).some(p => p.alive)) endZombieRoom(roomId);
}

function endZombieRoom(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    if (room.loopHandle) clearInterval(room.loopHandle);
    room.state = 'ended';
    io.to(roomId).emit('zombieResult', { wave: room.wave, coins: room.coins });
    delete rooms[roomId];
}

function tickZombieRoom(roomId) {
    const room = rooms[roomId];
    if (!room || room.state !== 'fighting') return;
    const now = Date.now();
    const alivePlayers = Object.values(room.players).filter(p => p.alive);

    if (room.wavePhase === 'prep') {
        if (now >= room.phaseUntil) {
            room.wavePhase = 'active';
            room.pendingSpawns = zombieCountForWave(room.wave);
            room.nextSpawnAt = now;
            io.to(roomId).emit('zombieWaveStarted', { wave: room.wave });
        }
    } else if (room.wavePhase === 'active') {
        if (room.pendingSpawns > 0 && now >= room.nextSpawnAt) {
            spawnZombie(roomId, room, now);
            room.pendingSpawns--;
            room.nextSpawnAt = now + Math.max(220, 900 - room.wave * 25);
        }
        if (room.pendingSpawns === 0 && Object.keys(room.zombies).length === 0) {
            room.wave++;
            room.wavePhase = 'prep';
            room.phaseUntil = now + ZOMBIE_PREP_MS;
            io.to(roomId).emit('zombieWaveCleared', { wave: room.wave, phaseUntil: room.phaseUntil });
        }
    }

    if (Object.keys(room.trees).length < ZOMBIE_MAX_TREES && now >= (room.nextTreeSpawnAt || 0)) {
        const id = spawnZombieTree(room);
        io.to(roomId).emit('zombieTreeSpawned', { id, ...room.trees[id] });
    }

    recomputeZombieFields(room);
    tickZombieTurrets(roomId, room, now);
    if (!rooms[roomId]) return;
    tickZombieEconomy(room, now);
    tickZombieHouseHealing(room, now);
    tickZombieSoldierSpawners(room, now);
    tickZombieSoldiers(roomId, room, now);
    if (!rooms[roomId]) return;

    for (const [zid, z] of Object.entries(room.zombies)) {
        tickZombie(roomId, room, zid, z, alivePlayers, now);
        if (!rooms[roomId]) return;
    }

    io.to(roomId).emit('zombieTick', {
        players: publicZombiePlayers(room),
        zombies: room.zombies,
        grid: room.grid,
        soldiers: room.soldiers,
        wave: room.wave, wavePhase: room.wavePhase, phaseUntil: room.phaseUntil,
        pendingSpawns: room.pendingSpawns || 0,
        wood: room.wood, coins: room.coins, ore: room.ore, iron: room.iron,
        atkUpgradeLevel: room.atkUpgradeLevel, turretAtkUpgradeLevel: room.turretAtkUpgradeLevel,
        fenceHpUpgradeLevel: room.fenceHpUpgradeLevel, soldierAtkUpgradeLevel: room.soldierAtkUpgradeLevel
    });
}

// ==================== 친구 대결 (PvP) ====================
// 보스 레이드/스토리/게스트/좀비는 전부 "room.players 전체 = 내 편"인
// 협동 모드라 스킬/궁극기 코드가 팀 전체 회복·버프를 가정하고 있다. PvP는
// 방에 있는 단 하나의 다른 플레이어가 곧 적이라 그 코드를 그대로 못 쓴다.
// 그래서 캐릭터마다 다른 skillType/ultimateType 문자열을 하나하나 따라가는
// 대신, 정의에 있는 값 있는 필드(skillHealAmount, skillDamage처럼)를 보고
// "회복/보호막/이속·공격력 버프류는 나에게만, 피해가 있으면 상대에게"라는
// 일반 규칙으로 해석한다(applyPvpAbility). 표식(mark)·소환·부활처럼 값
// 하나로 설명 안 되는 캐릭터 전용 메커니즘은 재현하지 않는다 -- 쿨타임은
// 소모되고 이펙트는 뜨지만 그 특수 효과만 빠진다.
function pvpOpponentEntry(room, casterId) {
    const entry = Object.entries(room.players).find(([id]) => id !== casterId);
    return entry ? { id: entry[0], p: entry[1] } : null;
}

function applyPvpAbility(roomId, room, casterId, prefix, now, payload) {
    const room2 = rooms[roomId];
    if (!room2) return;
    const p = room2.players[casterId];
    if (!p || !p.alive) return;
    const character = charOf(p);
    const opp = pvpOpponentEntry(room2, casterId);

    const healAmount = character[prefix + 'HealAmount'] || character[prefix + 'SelfHeal'];
    if (healAmount) {
        p.hp = Math.min(p.maxHp, p.hp + healAmount);
        io.to(roomId).emit('playerHealed', { id: casterId, hp: p.hp });
    }
    const healRatio = character[prefix + 'HealRatio'];
    if (healRatio) {
        p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * healRatio));
        io.to(roomId).emit('playerHealed', { id: casterId, hp: p.hp });
    }
    const healPerTick = character[prefix + 'HealPerTick'];
    const tickMs = character[prefix + 'TickMs'];
    const durationMs = character[prefix + 'DurationMs'];
    if (healPerTick && tickMs && durationMs) {
        room2.activeBuffs.push({
            type: 'pvp_self_hot', target: casterId,
            healPerTick, tickMs, endAt: now + durationMs, lastTickAt: now
        });
    }
    const shieldAmount = character[prefix + 'ShieldAmount'];
    if (shieldAmount) {
        p.shieldHp = (p.shieldHp || 0) + shieldAmount;
        io.to(roomId).emit('playerShielded', { id: casterId, shieldHp: p.shieldHp });
    }
    const speedValue = character[prefix + 'SpeedValue'] || character[prefix + 'SpeedBonus'];
    const speedDurationMs = character[prefix + 'SpeedDurationMs'];
    if (speedValue && speedDurationMs) {
        p.speedBoostUntil = now + speedDurationMs;
    }
    const attackMultiplier = character[prefix + 'AttackMultiplier'];
    const attackBuffDurationMs = character[prefix + 'AttackBuffDurationMs'];
    if (attackMultiplier && attackBuffDurationMs) {
        p.attackMultiplierUntil = now + attackBuffDurationMs;
        p.attackMultiplierValue = attackMultiplier;
    }
    // 자연 성역(바람궁수맛 3단계)류: "보스 체력을 %만큼 깎는다" 필드가 있으면
    // PvP에서는 상대 체력을 그만큼 깎는 걸로 옮긴다.
    const enemyDamageRatio = character[prefix + 'SanctuaryEnemyDamageRatio'];
    if (enemyDamageRatio && opp && opp.p.alive) {
        applyDamageToPvpPlayer(roomId, opp.id, Math.max(1, Math.round(opp.p.maxHp * enemyDamageRatio)));
    }

    // 직접 피해: range(+width)면 지금 바라보는 방향의 판정선으로, radius면
    // (클릭 좌표가 왔으면 그 좌표를 중심으로, 아니면 자기 자신을 중심으로)
    // 원형 범위로 상대와의 거리를 재서 맞으면 피해를 준다.
    const damage = character[prefix + 'Damage'];
    if (damage && opp && opp.p.alive) {
        const range = character[prefix + 'Range'];
        const width = character[prefix + 'Width'];
        const radius = character[prefix + 'Radius'];
        let hit = false;
        if (range) {
            hit = meleeLineHitPoint(p.x, p.y, p.facing, range, width || 60, opp.p.x, opp.p.y, PLAYER_RADIUS);
        } else if (radius) {
            const ox = (payload && typeof payload.targetX === 'number') ? payload.targetX : p.x;
            const oy = (payload && typeof payload.targetY === 'number') ? payload.targetY : p.y;
            hit = Math.hypot(opp.p.x - ox, opp.p.y - oy) <= radius + PLAYER_RADIUS;
        }
        if (hit) applyDamageToPvpPlayer(roomId, opp.id, damage);
    }

    // 구역 지속 피해(궁극기 마법진류): 상대가 그 안에 있을 때마다 틱마다 깎는다.
    const zoneDamagePerTick = character[prefix + 'ZoneDamagePerTick'];
    const zoneTickMs = character[prefix + 'ZoneTickMs'];
    const zoneDurationMs = character[prefix + 'ZoneDurationMs'];
    if (zoneDamagePerTick && zoneTickMs && zoneDurationMs && opp) {
        const zx = (payload && typeof payload.targetX === 'number') ? payload.targetX : p.x;
        const zy = (payload && typeof payload.targetY === 'number') ? payload.targetY : p.y;
        room2.activeBuffs.push({
            type: 'pvp_zone_damage', targetId: opp.id, x: zx, y: zy,
            radius: character[prefix + 'Radius'] || character[prefix + 'Width'] || 80,
            damagePerTick: zoneDamagePerTick, tickMs: zoneTickMs,
            endAt: now + zoneDurationMs, lastTickAt: now
        });
    }
}

function applyDamageToPvpPlayer(roomId, playerId, dmg) {
    const room = rooms[roomId];
    if (!room || room.state !== 'fighting') return;
    const p = room.players[playerId];
    if (!p || !p.alive) return;
    const character = charOf(p);
    const now = Date.now();
    dmg = Math.round(dmg * damageReductionMultiplier(character, p, now, null));
    if (p.shieldHp > 0) {
        const absorbed = Math.min(p.shieldHp, dmg);
        p.shieldHp -= absorbed;
        dmg -= absorbed;
    }
    p.hp = Math.max(0, p.hp - dmg);
    if (p.hp <= 0) p.alive = false;
    io.to(roomId).emit('pvpPlayerDamaged', { id: playerId, hp: p.hp, alive: p.alive, shieldHp: p.shieldHp || 0 });
    if (!p.alive) {
        const winner = Object.keys(room.players).find(id => id !== playerId);
        endPvpRoom(roomId, winner || null);
    }
}

function pvpLoadout(entry) {
    const bonus = bonusFrom(entry.equip, entry.charType, entry.instinct);
    const character = charFrom(entry.charType, entry.equip, entry.instinct, entry.charLevel);
    return { bonus, character, awakenGear: gearFrom(entry.charType, entry.equip) };
}

// 배경은 스토리모드 10층과 똑같은 다리(bridge) 모양을 그대로 빌려 쓴다 --
// 새로 만들지 않고 floorDefFor(10)의 치수를 그대로 읽는다.
function createPvpRoom(entryA, entryB) {
    const roomId = `pvp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const floorDef = floorDefFor(10) || { levelLength: 1100, laneHalfWidth: 220 };
    const halfLen = (floorDef.levelLength || 1100) / 2;
    const laneHalfWidth = floorDef.laneHalfWidth || 220;
    const loadA = pvpLoadout(entryA);
    const loadB = pvpLoadout(entryB);
    const mk = (entry, load, x, facing) => ({
        x, y: 0, facing,
        bonus: load.bonus, character: load.character, awakenGear: load.awakenGear,
        hp: load.character.health + load.bonus.health, maxHp: load.character.health + load.bonus.health,
        charType: entry.charType, nickname: entry.nickname,
        alive: true, lastAttackTime: 0, lastSkillTime: 0, lastUltimateTime: 0
    });
    rooms[roomId] = {
        kind: 'pvp',
        state: 'waiting',
        players: {
            [entryA.socketId]: mk(entryA, loadA, -halfLen + 90, 0),
            [entryB.socketId]: mk(entryB, loadB, halfLen - 90, Math.PI)
        },
        halfLen, laneHalfWidth,
        activeBuffs: [],
        loopHandle: null
    };
    return roomId;
}

function publicPvpPlayers(room) {
    const out = {};
    for (const [id, p] of Object.entries(room.players)) {
        out[id] = {
            x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, charType: p.charType, nickname: p.nickname,
            facing: p.facing, alive: p.alive, shieldHp: p.shieldHp || 0
        };
    }
    return out;
}

const PVP_COUNTDOWN_MS = 3000;
function startPvpFight(roomId) {
    const room = rooms[roomId];
    if (!room) return;
    room.state = 'countdown';
    io.to(roomId).emit('pvpMatchFound', {
        roomId, startAt: Date.now() + PVP_COUNTDOWN_MS,
        players: publicPvpPlayers(room), halfLen: room.halfLen, laneHalfWidth: room.laneHalfWidth
    });
    setTimeout(() => {
        const r = rooms[roomId];
        if (!r || r.state !== 'countdown') return;
        r.state = 'fighting';
        io.to(roomId).emit('pvpFightStart');
        r.loopHandle = setInterval(() => tickPvpRoom(roomId), 50);
    }, PVP_COUNTDOWN_MS);
}

function tickPvpRoom(roomId) {
    const room = rooms[roomId];
    if (!room || room.state !== 'fighting') return;
    const now = Date.now();
    if (!room.activeBuffs || !room.activeBuffs.length) return;
    room.activeBuffs = room.activeBuffs.filter(b => now < b.endAt);
    for (const buff of room.activeBuffs) {
        if (now - buff.lastTickAt < buff.tickMs) continue;
        buff.lastTickAt += buff.tickMs;
        if (buff.type === 'pvp_self_hot') {
            const p = room.players[buff.target];
            if (p && p.alive) {
                p.hp = Math.min(p.maxHp, p.hp + buff.healPerTick);
                io.to(roomId).emit('playerHealed', { id: buff.target, hp: p.hp });
            }
        } else if (buff.type === 'pvp_zone_damage') {
            const target = room.players[buff.targetId];
            if (target && target.alive && Math.hypot(target.x - buff.x, target.y - buff.y) <= buff.radius) {
                applyDamageToPvpPlayer(roomId, buff.targetId, buff.damagePerTick);
            }
        }
    }
}

function endPvpRoom(roomId, winnerId) {
    const room = rooms[roomId];
    if (!room) return;
    if (room.loopHandle) clearInterval(room.loopHandle);
    room.state = 'ended';
    io.to(roomId).emit('pvpResult', { winnerId: winnerId || null });
    delete rooms[roomId];
}

io.on('connection', (socket) => {
    // 로그인 계정의 "지금 이 소켓에 연결돼 있다"를 등록. 친구 대결 신청을
    // 수락했을 때 신청 보낸 사람을 화면과 무관하게 찾아내기 위해 쓴다.
    // 캐릭터/장비 스냅샷은 로그인 직후와 로비에 들어올 때마다 다시 보내
    // 최신으로 유지한다(마지막으로 보낸 값이 살짝 오래됐을 수는 있다).
    socket.on('identify', ({ userId, nickname, charType, equip, instinct, charLevel }) => {
        if (!userId || !nickname) return;
        socket.data.userId = String(userId);
        onlineUsers[String(userId)] = {
            socketId: socket.id, nickname: String(nickname).slice(0, 20),
            charType: charType && CHARACTERS[charType] ? charType : 'kicker',
            equip, instinct, charLevel
        };
    });

    // 친구 대결 신청 수락: br_battle_challenge_respond(수락)로 신청 행을 이미
    // 지운 뒤, 클라이언트가 실제 매치를 만들어 달라고 여기로 알려준다.
    // 신청 보낸 쪽(opponentUserId)이 지금 접속해 있지 않으면 시작할 수 없다.
    socket.on('pvpChallengeAccept', ({ opponentUserId }) => {
        const myUserId = socket.data.userId;
        if (!myUserId || !opponentUserId) return;
        const me = onlineUsers[myUserId];
        const opp = onlineUsers[String(opponentUserId)];
        if (!me || me.socketId !== socket.id) return;
        if (!opp) { socket.emit('pvpMatchError', { message: '상대가 접속해 있지 않습니다.' }); return; }
        const oppSocket = io.sockets.sockets.get(opp.socketId);
        if (!oppSocket) { socket.emit('pvpMatchError', { message: '상대가 접속해 있지 않습니다.' }); return; }

        const roomId = createPvpRoom(
            { socketId: socket.id, nickname: me.nickname, charType: me.charType, equip: me.equip, instinct: me.instinct, charLevel: me.charLevel },
            { socketId: oppSocket.id, nickname: opp.nickname, charType: opp.charType, equip: opp.equip, instinct: opp.instinct, charLevel: opp.charLevel }
        );
        socket.join(roomId);
        socket.data.roomId = roomId;
        oppSocket.join(roomId);
        oppSocket.data.roomId = roomId;
        startPvpFight(roomId);
    });

    socket.on('pvpPlayerMove', ({ x, y, facing }) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'pvp') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        if (Math.abs(x) > room.halfLen + 1 || Math.abs(y) > room.laneHalfWidth + 1) return;
        p.x = x; p.y = y; p.facing = facing;
        socket.to(roomId).emit('pvpPlayerMoved', { id: socket.id, x, y, facing });
    });

    socket.on('pvpPlayerAttack', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'pvp' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const opp = pvpOpponentEntry(room, socket.id);
        if (!opp || !opp.p.alive) return;
        const character = charOf(p);
        const now = Date.now();
        const rapid = rapidStrikeActive(character, p, now);
        const cooldown = attackCooldownFor(character, p, rapid, now);
        if (now - p.lastAttackTime < cooldown) return;
        if (!consumeAmmoOrBlock(character, p, now)) return;
        p.lastAttackTime = now;
        if (character.skillType === 'guard_stance') p.guardStanceUntil = 0;

        const swing = resolveAttack(character, p, now, rapid);
        advanceAttackSequence(character, p);
        const width = swing.width || (character.attackProjectileRadius ? character.attackProjectileRadius * 2 : 50);
        if (meleeLineHitPoint(swing.originX, swing.originY, p.facing, swing.range, width, opp.p.x, opp.p.y, PLAYER_RADIUS)) {
            applyDamageToPvpPlayer(roomId, opp.id, swing.damage);
        }
    });

    socket.on('pvpPlayerSkill', (payload) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'pvp' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const character = charOf(p);
        if (!character.skillType) return;
        const now = Date.now();
        if (now - p.lastSkillTime < skillCooldownFor(character, p)) return;
        p.lastSkillTime = now;
        io.to(roomId).emit('playerSkillUsed', { id: socket.id });
        applyPvpAbility(roomId, room, socket.id, 'skill', now, payload);
    });

    socket.on('pvpPlayerUltimate', (payload) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'pvp' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const character = charOf(p);
        if (!character.ultimateType) return;
        const now = Date.now();
        if (now - p.lastUltimateTime < ultimateCooldownFor(character, p)) return;
        p.lastUltimateTime = now;
        io.to(roomId).emit('playerUltimateUsed', { id: socket.id });
        applyPvpAbility(roomId, room, socket.id, 'ultimate', now, payload);
    });

    // 친구 탭 > 친구보기: 화면을 여는 동안만 자신을 노출하고, 같은 시간에
    // 보고 있는 다른 계정들을 서로에게 보여준다. 닉네임/캐릭터는 클라이언트가
    // 보내는 값을 그대로 믿는다(표시용일 뿐 서버 authoritative 데이터가 아님).
    socket.on('friendsBrowseJoin', ({ userId, nickname, charType }) => {
        if (!userId || !nickname) return;
        friendsBrowsing[socket.id] = {
            userId: String(userId),
            nickname: String(nickname).slice(0, 20),
            charType: charType && CHARACTERS[charType] ? charType : 'kicker'
        };
        broadcastFriendsBrowsing();
    });
    socket.on('friendsBrowseLeave', () => {
        if (friendsBrowsing[socket.id]) {
            delete friendsBrowsing[socket.id];
            broadcastFriendsBrowsing();
        }
    });

    socket.on('joinRaid', ({ bossId, charType, solo, equip, instinct, charLevel }) => {
        if (!BOSS_DEFS[bossId]) return;
        const character = charFrom(charType, equip, instinct, charLevel);
        const bonus = bonusFrom(equip, charType, instinct);

        let roomId = solo ? null : findOpenRoom(bossId);
        if (!roomId) roomId = createRoom(bossId, solo);
        const room = rooms[roomId];

        const slotIndex = Object.keys(room.players).length;
        const pos = spawnPosition(slotIndex);
        room.players[socket.id] = {
            x: pos.x, y: pos.y,
            bonus,
            character, awakenGear: gearFrom(charType, equip),
            hp: character.health + bonus.health, maxHp: character.health + bonus.health,
            charType: charType && CHARACTERS[charType] ? charType : 'kicker',
            facing: 0, alive: true, lastAttackTime: 0, lastSkillTime: 0, lastUltimateTime: 0, attackHealBoostUntil: 0,
            ready: false
        };

        socket.join(roomId);
        socket.data.roomId = roomId;

        io.to(roomId).emit('raidRoomUpdate', {
            roomId, bossId, count: Object.keys(room.players).length,
            players: publicPlayers(room)
        });
        // Fight no longer auto-starts once 2 players are present -- each
        // player must explicitly click "ready" (playerReady) once matched.
    });

    // ---- 각성모드 ----
    // 스토리 방을 그대로 쓴다. 판(floor)이 'awaken:쿠키:레벨' 꼴이면
    // floorDefFor가 넓은 마당과 보스 한 마리를 만들어 준다. 솔로는 쿠키 3명을
    // 데려가서(하나가 쓰러지면 다음 쿠키가 들어온다) 혼자 싸우고, 멀티는
    // 스토리 타워와 같은 방식으로 짝을 찾아(findOpenStoryRoom) 각자 캐릭터
    // 하나씩만 데리고 함께 싸운다 -- 파티 교체는 멀티에는 없다.
    socket.on('joinAwakenBoss', ({ charType, level, party, equipParty, instinctParty, solo, myChar, equip, instinct, charLevel, charLevelParty }) => {
        // 레벨은 여기서 자르지 않고 그대로 본다. awakenFloorKey는 범위를 넘는
        // 값을 10으로 맞추는데, 그러면 99를 보낸 사람이 10레벨을 받게 된다.
        if (!AWAKEN_BOSS_LEVELS[Number(level)]) return;
        const floor = awakenFloorKey(charType, level);
        const floorDef = floorDefFor(floor);
        if (!floorDef) return;

        const isSolo = solo !== false;

        let roomId = !isSolo ? findOpenStoryRoom(floor) : null;
        if (!roomId) {
            roomId = createStoryRoom(floor, isSolo);
            spawnStoryMonsters(rooms[roomId], floorDef);
        }
        const room = rooms[roomId];

        if (isSolo) {
            const wanted = Array.isArray(party) ? party.filter(id => CHARACTERS[id]) : [];
            const chosen = wanted.slice(0, AWAKEN_PARTY_SIZE);
            while (chosen.length < AWAKEN_PARTY_SIZE) chosen.push('kicker');

            const bonuses = chosen.map((id, i) => bonusFrom(equipParty && equipParty[i], id, instinctParty && instinctParty[i]));
            const characters = chosen.map((id, i) => charFrom(id, equipParty && equipParty[i], instinctParty && instinctParty[i], charLevelParty && charLevelParty[i]));
            const gears = chosen.map((id, i) => gearFrom(id, equipParty && equipParty[i]));
            const maxHp = chosen.map((id, i) => characters[i].health + bonuses[i].health);
            room.players[socket.id] = {
                x: 0, y: 0,
                facing: Math.PI,
                party: chosen,
                partyBonus: bonuses,
                partyCharacter: characters,
                partyAwakenGear: gears,
                partyMaxHp: maxHp.slice(),
                partyHp: maxHp.slice(),
                partyAlive: chosen.map(() => true),
                active: 0,
                charType: chosen[0],
                character: characters[0],
                awakenGear: gears[0],
                bonus: bonuses[0],
                hp: maxHp[0], maxHp: maxHp[0],
                alive: true,
                lastAttackTime: 0, lastSkillTime: 0, lastUltimateTime: 0, attackHealBoostUntil: 0,
                ready: true
            };
        } else {
            const myCharType = myChar && CHARACTERS[myChar] ? myChar : 'kicker';
            const bonus = bonusFrom(equip, myCharType, instinct);
            const character = charFrom(myCharType, equip, instinct, charLevel);
            const slot = Object.keys(room.players).length;
            const spot = slot === 0 ? { x: 0, y: 0 } : fromAlongAcross(floorDef, 0, 30);
            room.players[socket.id] = {
                x: spot.x, y: spot.y,
                facing: Math.PI,
                bonus, character, awakenGear: gearFrom(myCharType, equip),
                hp: character.health + bonus.health, maxHp: character.health + bonus.health,
                charType: myCharType,
                alive: true, lastAttackTime: 0, lastSkillTime: 0, lastUltimateTime: 0, attackHealBoostUntil: 0,
                ready: false
            };
        }

        socket.join(roomId);
        socket.data.roomId = roomId;

        if (room.solo) { startStoryFight(roomId); return; }
        io.to(roomId).emit('storyRoomUpdate', {
            roomId, floor,
            count: Object.keys(room.players).length,
            players: publicStoryPlayers(room)
        });
    });

    // 자유 교체. 살아 있는 쿠키끼리 아무 때나 바꿀 수 있고, 너무 자주 바꾸지
    // 못하게 짧은 쿨타임만 둔다. 바꾼 쿠키의 체력은 그대로 남아 있다.
    socket.on('awakenSwap', ({ index }) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'story' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive || !p.party) return;
        const i = Number(index);
        if (!Number.isInteger(i) || i < 0 || i >= p.party.length) return;
        if (i === p.active || !p.partyAlive[i]) return;
        const now = Date.now();
        if (now - (p.lastSwapTime || 0) < AWAKEN_SWAP_COOLDOWN_MS) return;
        p.lastSwapTime = now;
        activatePartyCookie(p, i, false);
        io.to(roomId).emit('storyPlayerSwapped', {
            id: socket.id, charType: p.charType, hp: p.hp, maxHp: p.maxHp,
            active: p.active, partyAlive: p.partyAlive, partyHp: p.partyHp
        });
    });

    socket.on('startRaid', () => {
        const roomId = socket.data.roomId;
        if (roomId) startFight(roomId);
    });

    socket.on('playerReady', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.state !== 'waiting') return;
        const p = room.players[socket.id];
        if (!p) return;
        p.ready = true;

        io.to(roomId).emit('raidRoomUpdate', {
            roomId, bossId: room.bossId, count: Object.keys(room.players).length,
            players: publicPlayers(room)
        });

        const playerList = Object.values(room.players);
        if (playerList.length >= 2 && playerList.every(pl => pl.ready)) {
            startFight(roomId);
        }
    });

    socket.on('joinStoryFloor', ({ floor, charType, equip, solo, party, equipParty, instinct, instinctParty, charLevel, charLevelParty }) => {
        const floorDef = floorDefFor(floor);
        if (!floorDef) return; // no content for this floor yet
        const resolvedCharType = CHARACTERS[charType] ? charType : 'kicker';
        const character = applyFloorCharEvent(charFrom(charType, equip, instinct, charLevel), resolvedCharType, floorDef);
        const bonus = bonusFrom(equip, charType, instinct);

        // 멀티면 먼저 기다리는 방을 찾고, 없으면 새로 판다.
        let roomId = solo === false ? findOpenStoryRoom(floor) : null;
        if (!roomId) {
            roomId = createStoryRoom(floor, solo);
            spawnStoryMonsters(rooms[roomId], floorDef);
        }
        const room = rooms[roomId];

        // 둘이 겹쳐서 시작하지 않게 두 번째 사람은 옆으로 조금 비켜 세운다.
        const slot = Object.keys(room.players).length;
        const spot = slot === 0 ? { x: 0, y: 0 } : fromAlongAcross(floorDef, 0, 30);
        // 11층부터는 쿠키 두 명을 데려간다. 레전드 스토리는 혼자면 세 명,
        // 멀티면 한 명(storyPartySizeFor가 solo로 가른다). 각성모드와 같은
        // 파티 구조를 쓰므로 교체·죽음·부활이 전부 그대로 돌아간다.
        const partySize = storyPartySizeFor(floor, solo);
        if (partySize > 1) {
            const wanted = Array.isArray(party) ? party.filter(id => CHARACTERS[id]) : [];
            const chosen = wanted.slice(0, partySize);
            // 빈 자리는 고른 쿠키(없으면 자두맛)로 채운다.
            const fallback = (charType && CHARACTERS[charType]) ? charType : 'kicker';
            while (chosen.length < partySize) chosen.push(fallback);
            const equips = Array.isArray(equipParty) ? equipParty : [];
            const instincts = Array.isArray(instinctParty) ? instinctParty : [];
            const levels = Array.isArray(charLevelParty) ? charLevelParty : [];
            const bonuses = chosen.map((id, i) => bonusFrom(equips[i], id, instincts[i]));
            const characters = chosen.map((id, i) => applyFloorCharEvent(charFrom(id, equips[i], instincts[i], levels[i]), id, floorDef));
            const gears = chosen.map((id, i) => gearFrom(id, equips[i]));
            const maxHp = chosen.map((id, i) => characters[i].health + bonuses[i].health);
            room.players[socket.id] = {
                x: spot.x, y: spot.y,
                facing: Math.PI,
                party: chosen,
                partyBonus: bonuses,
                partyCharacter: characters,
                partyAwakenGear: gears,
                partyMaxHp: maxHp.slice(),
                partyHp: maxHp.slice(),
                partyAlive: chosen.map(() => true),
                active: 0,
                charType: chosen[0],
                character: characters[0],
                awakenGear: gears[0],
                bonus: bonuses[0],
                hp: maxHp[0], maxHp: maxHp[0],
                alive: true,
                lastAttackTime: 0, lastSkillTime: 0, lastUltimateTime: 0, attackHealBoostUntil: 0,
                ready: false
            };
        } else {
        room.players[socket.id] = {
            x: spot.x, y: spot.y,
            bonus,
            character, awakenGear: gearFrom(charType, equip),
            hp: character.health + bonus.health, maxHp: character.health + bonus.health,
            charType: charType && CHARACTERS[charType] ? charType : 'kicker',
            facing: Math.PI, // faces left, toward the bridge
            alive: true, lastAttackTime: 0, lastSkillTime: 0, lastUltimateTime: 0, attackHealBoostUntil: 0,
            ready: false
        };
        }

        socket.join(roomId);
        socket.data.roomId = roomId;

        if (room.solo) { startStoryFight(roomId); return; }
        io.to(roomId).emit('storyRoomUpdate', {
            roomId, floor,
            count: Object.keys(room.players).length,
            players: publicStoryPlayers(room)
        });
    });

    // 멀티 스토리: 둘 다 준비를 눌러야 시작한다 (레이드와 같은 규칙).
    socket.on('storyPlayerReady', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'story' || room.state !== 'waiting') return;
        const p = room.players[socket.id];
        if (!p) return;
        p.ready = true;
        io.to(roomId).emit('storyRoomUpdate', {
            roomId, floor: room.floor,
            count: Object.keys(room.players).length,
            players: publicStoryPlayers(room)
        });
        const list = Object.values(room.players);
        if (list.length >= 2 && list.every(pl => pl.ready)) startStoryFight(roomId);
    });

    // 시작 전에 나가기. 시작한 뒤에 나가는 건 기존 leaveStory/disconnect가 본다.
    socket.on('leaveStoryRoom', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'story' || room.state !== 'waiting') return;
        delete room.players[socket.id];
        socket.leave(roomId);
        socket.data.roomId = null;
        if (!Object.keys(room.players).length) {
            if (room.loopHandle) clearInterval(room.loopHandle);
            delete rooms[roomId];
            return;
        }
        io.to(roomId).emit('storyRoomUpdate', {
            roomId, floor: room.floor,
            count: Object.keys(room.players).length,
            players: publicStoryPlayers(room)
        });
    });

    socket.on('storyPlayerMove', ({ x, y, facing }) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'story') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const floorDef = floorDefFor(room.floor);
        // Bounds are checked along the bridge's own axis, so a floor running
        // upward (axis: 'y') is clamped the same way a leftward one is.
        let along = alongOf(floorDef, x, y);
        const across = acrossOf(floorDef, x, y);
        if (along > LEVEL_START_SLACK || along < -floorDef.levelLength - 1) return; // out-of-bounds claim
        // 레전드 스토리는 방마다 폭이 다르므로(넓은 방/좁은 다리) 층 전체에
        // 하나뿐인 laneHalfWidth 대신 지금 서 있는 자리의 실제 폭을 본다.
        if (Math.abs(across) > laneHalfWidthAt(floorDef, x, y) + 1) return;

        // Energy-shield gates: once inside (or moving into) a room, neither
        // of its edges can be crossed until every monster in that room is
        // dead (or, for a manual gate, until its switch is hit -- gateSealed
        // covers both). A floor can have several rooms back to back (see
        // `gates`); each is checked independently against the (possibly
        // already reclamped) position, since only one room's shield is ever
        // actually up at any given point along the bridge.
        if (floorDef.gates) {
            const wasAlong = alongOf(floorDef, p.x, p.y);
            for (const gate of floorDef.gates) {
                if (!gateSealed(room, gate)) continue;
                if (wasAlong <= gate.entrance || along <= gate.entrance) {
                    if (along > gate.entrance) along = gate.entrance;
                    if (along < gate.exit) along = gate.exit;
                }
            }
        }

        const pos = fromAlongAcross(floorDef, along, across);
        p.x = pos.x; p.y = pos.y; p.facing = facing;
    });

    socket.on('storyPlayerAttack', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'story' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const character = charOf(p);
        const now = Date.now();
        // 바다 수호자맛 특수스킬로 숨어 있는 동안은 자기도 공격을 못 한다.
        if (p.untouchableUntil && now < p.untouchableUntil) return;
        const rapid = rapidStrikeActive(character, p, now);
        const cooldown = attackCooldownFor(character, p, rapid, now);
        if (now - p.lastAttackTime < cooldown) return;
        if (!consumeAmmoOrBlock(character, p, now)) return;
        p.lastAttackTime = now;
        if (character.skillType === 'guard_stance') p.guardStanceUntil = 0; // attacking breaks guard

        // 던지는 기본공격: nothing is resolved here -- the drop is put in the
        // air and the room's tick decides whether it ever reaches anything.
        if (character.attackType === 'throw_projectile') {
            spawnPlayerProjectile(roomId, room, socket.id, p, character, now, 'storyDropThrown');
            return;
        }
        // 쿠키맛쿠키 기본공격: 유도탄 구슬 여러 발을 부채꼴로 한 번에 쏜다.
        if (character.attackType === 'homing_burst') {
            fireHomingBurst(roomId, room, socket.id, p, character, now, 'storyDropThrown');
            return;
        }
        if (character.attackType !== 'melee_kick' && character.attackType !== 'alternating_punch'
            && character.attackType !== 'combo_two_stage' && character.attackType !== 'dual_spear'
            && character.attackType !== 'vampire_slash') return;

        let anyHit = false;
        let anyKill = false;
        const swing = resolveAttack(character, p, now, rapid);
        const baseAttackDamage = swing.damage;
        advanceAttackSequence(character, p);
        const floorDef = floorDefFor(room.floor);
        for (const [mid, m] of Object.entries(room.monsters)) {
            if (!m.alive) continue;
            if (meleeLineHitPoint(swing.originX, swing.originY, p.facing, swing.range, swing.width, m.x, m.y, mR(m))) {
                anyHit = true;
                if (landStoryHitOnMonster(roomId, room, mid, m, socket.id, character, baseAttackDamage, now, {
                    knockback: true, floorDef, fromX: p.x, fromY: p.y,
                    marks: !!(p.elementMarkUntil && now < p.elementMarkUntil),
                    attackMarks: attackMarkChargesOf(character, p),
                    markUse: markUseOf(character, p)
                })) anyKill = true;
            }
        }

        if (anyHit) {
            gainKillBuffStack(character, p, anyKill, now);
            const selfHeal = passiveHitHeal(character, p) + passiveChanceHeal(character, p, swing)
            + lowHpSelfHeal(character, p)
                + vampireKillHeal(character, p, swing, anyKill);
            if (selfHeal) {
                p.hp = Math.min(p.maxHp, p.hp + selfHeal);
                io.to(roomId).emit('storyPlayerHealed', { id: socket.id, hp: p.hp });
            }
        }
        // 체리크림맛처럼 attackHealOnUse가 없어도 궁극기 중이면 게이트를 통과한다.
        const storyHealBoosted = character.ultimateHealPerAttack != null && p.attackHealBoostUntil && now < p.attackHealBoostUntil;
        if (anyHit && (character.attackHealOnUse || storyHealBoosted) && Math.random() < (character.attackHealChance ?? 1)) {
            healStoryPlayer(room, roomId, storyHealBoosted ? character.ultimateHealPerAttack : character.attackHealOnUse);
        }
        // 치즈케이크맛: 위 보스 레이드 분기 주석 참고.
        if (anyHit && character.attackHealOverTimeOnHit) {
            room.activeBuffs.push({
                type: 'team_heal_over_time',
                tickMs: character.attackHealOverTimeTickMs,
                healPerTick: character.attackHealOverTimeOnHit,
                endAt: now + character.attackHealOverTimeDurationMs,
                lastTickAt: now
            });
        }
        if (anyHit && character.attackShieldOnUse && Math.random() < (character.attackShieldChance ?? 1)) {
            addShieldStoryTeam(room, roomId, character.attackShieldOnUse);
        }
        // 체리크림맛 궁극기(분노): 위 보스 레이드 분기 주석 참고.
        if (anyHit && character.ultimateShieldPerAttack && p.attackHealBoostUntil && now < p.attackHealBoostUntil) {
            addShieldStoryTeam(room, roomId, character.ultimateShieldPerAttack);
        }
        // 체리크림맛 패시브: 위 보스 레이드 분기 주석 참고.
        if (anyHit && character.attackSpeedBonusOnHit) {
            io.to(roomId).emit('storyAttackSpeedBoost', { id: socket.id, until: now + character.attackSpeedBoostDurationMs });
        }
    });

    socket.on('storyPlayerSkill', (payload) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'story' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const character = charOf(p);
        if (!character.skillType) return;
        const now = Date.now();
        if (now - p.lastSkillTime < skillCooldownFor(character, p)) return;
        p.lastSkillTime = now;

        socket.to(roomId).emit('playerSkillUsed', { id: socket.id });

        // 바람궁수맛 특수스킬: 조준 없이 즉시 발동, 팀 전체에게 초당 회복
        // 버프를 건다. team_heal_over_time 궁극기와 같은 버프를 스킬 쪽
        // 필드(skill*)로 채워서 그대로 재사용한다.
        if (character.skillType === 'team_heal_over_time') {
            room.activeBuffs.push({
                type: 'team_heal_over_time',
                tickMs: character.skillTickMs,
                healPerTick: character.skillHealPerTick,
                endAt: now + character.skillDurationMs,
                lastTickAt: now
            });
        }
        // 치즈케이크맛 특수스킬: 위 보스 레이드 분기 주석 참고. 파티(벤치)까지
        // 포함해 healStoryTeamBy로 비율 회복시키고, 지금 나와 있는 캐릭터에만
        // 공격력 배수 버프를 건다.
        else if (character.skillType === 'team_ratio_heal_attack_buff') {
            healStoryTeamBy(room, roomId, maxHp => Math.round(maxHp * character.skillHealRatio));
            for (const pl of Object.values(room.players)) {
                if (!pl.alive) continue;
                pl.attackMultiplierUntil = now + character.skillAttackBuffDurationMs;
                pl.attackMultiplierValue = character.skillAttackMultiplier;
            }
        } else if (character.skillType === 'spin_kick' || character.skillType === 'lava_burst') {
            // lava_burst (volcano cookie) uses the exact same self-centered AoE shape.
            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                const dist = Math.hypot(p.x - m.x, p.y - m.y) - mR(m);
                if (dist <= character.skillRange) {
                    m.hp = Math.max(0, m.hp - character.skillDamage);
                    if (m.hp <= 0) {
                        m.alive = false;
                        io.to(roomId).emit('monsterDefeated', { id: mid });
                    } else {
                        io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
                    }
                }
            }
        } else if (character.skillType === 'spin_heal') {
            room.activeBuffs.push({
                type: 'story_spin_heal_check',
                casterId: socket.id,
                radius: character.skillRadius,
                damage: character.skillDamage,
                healAmount: character.skillHealOnHit,
                endAt: now + character.skillDurationMs,
                tickMs: 150,
                lastTickAt: now,
                triggered: false
            });
        } else if (character.skillType === 'guard_stance' || character.skillType === 'shield_block') {
            // Same timer; only guard_stance is broken early by attacking.
            p.guardStanceUntil = now + character.skillDurationMs;
        } else if (character.skillType === 'flying_kick') {
            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                if (meleeLineHitPoint(p.x, p.y, p.facing, character.skillRange, character.skillWidth, m.x, m.y, mR(m))) {
                    m.stunnedUntil = now + character.skillStunMs;
                    io.to(roomId).emit('monsterStunned', { id: mid });
                }
            }
        }
        // 쿠키맛쿠키 특수스킬: 조준 없이 즉시 자기 체력을 채우고(적중 여부와
        // 무관), 반경 안의 적 전부를 얼려 그동안 아무 행동도 못 하게 한다.
        else if (character.skillType === 'freeze_burst') {
            p.hp = Math.min(p.maxHp, p.hp + character.skillSelfHeal);
            io.to(roomId).emit('storyPlayerHealed', { id: socket.id, hp: p.hp });
            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                if (Math.hypot(p.x - m.x, p.y - m.y) - mR(m) > character.skillRange) continue;
                m.stunnedUntil = now + character.skillFreezeMs;
                io.to(roomId).emit('monsterStunned', { id: mid });
            }
        } else if (character.skillType === 'kick') {
            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                if (meleeLineHitPoint(p.x, p.y, p.facing, character.skillRange, character.skillWidth, m.x, m.y, mR(m))) {
                    hurtStoryMonster(roomId, room, mid, m, character.skillDamage);
                }
            }
        } else if (character.skillType === 'self_heal') {
            const healed = Math.min(p.maxHp, p.hp + character.skillHealAmount);
            if (healed !== p.hp) {
                p.hp = healed;
                io.to(roomId).emit('storyPlayerHealed', { id: socket.id, hp: p.hp });
            }
        }
        // 지옥맛 특수스킬: 조준 없이 즉시 자기 체력을 채우고, 반경 안의 적
        // 전부에게 데미지를 준다.
        else if (character.skillType === 'life_burst') {
            p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * character.skillHealRatio));
            io.to(roomId).emit('storyPlayerHealed', { id: socket.id, hp: p.hp });
            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                if (Math.hypot(p.x - m.x, p.y - m.y) - mR(m) > character.skillRadius) continue;
                m.hp = Math.max(0, m.hp - character.skillDamage);
                if (m.hp <= 0) { m.alive = false; io.to(roomId).emit('monsterDefeated', { id: mid }); }
                else io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
            }
        }
        // 불꽃요정맛 특수스킬: 방패로 막는다. 고정값 회복 + 자기 자신에게만
        // 보호막을 씌운다 (팀 전체가 아니다).
        else if (character.skillType === 'self_guard_surge') {
            p.hp = Math.min(p.maxHp, p.hp + character.skillHealAmount);
            p.shieldHp = character.skillShieldAmount;
            io.to(roomId).emit('storyPlayerHealed', { id: socket.id, hp: p.hp });
            io.to(roomId).emit('storyPlayerShielded', { id: socket.id, shieldHp: p.shieldHp });
        }
        // 바다 수호자맛 특수스킬: 바다로 들어가기. 순간 몸을 숨겨 skillDurationMs
        // 동안 아무 공격도 안 통하고(damageReductionMultiplier가 0으로 눌러
        // 준다) 자기도 공격을 못 하는 상태가 되면서, 그 사이 체력을 고정값만큼
        // 채운다.
        else if (character.skillType === 'sea_hide') {
            // 파트너 쪽 무적 상태는 storyTick의 publicStoryPlayers가 매번
            // untouchableUntil을 실어 보내므로 따로 이벤트를 안 쏴도 된다.
            p.untouchableUntil = now + character.skillDurationMs;
            p.hp = Math.min(p.maxHp, p.hp + character.skillHealAmount);
            io.to(roomId).emit('storyPlayerHealed', { id: socket.id, hp: p.hp });
        } else if (character.skillType === 'earthquake') {
            // No aiming: the whole floor shakes. A small group all takes
            // skillDamage; past skillThresholdCount the ground swallows the
            // single nearest enemy instead.
            const alive = Object.entries(room.monsters).filter(([, m]) => m.alive);
            io.to(roomId).emit('storyEarthquake', { id: socket.id, count: alive.length });
            if (!alive.length) return;
            if (alive.length <= character.skillThresholdCount) {
                for (const [mid, m] of alive) {
                    m.hp = Math.max(0, m.hp - character.skillDamage);
                    if (m.hp <= 0) {
                        m.alive = false;
                        io.to(roomId).emit('monsterDefeated', { id: mid });
                    } else {
                        io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
                    }
                }
            } else {
                let victimId = null, victim = null, best = Infinity;
                for (const [mid, m] of alive) {
                    const d = Math.hypot(m.x - p.x, m.y - p.y);
                    if (d < best) { best = d; victimId = mid; victim = m; }
                }
                victim.hp = 0;
                victim.alive = false;
                io.to(roomId).emit('monsterDefeated', { id: victimId });
            }
        }
        // 블랙 슈거맛 적 끌어들이기: drag whatever can walk over to us; anything
        // rooted (a turret) can't be dragged, so it eats skillDamage instead.
        else if (character.skillType === 'pull_in') {
            io.to(roomId).emit('storyPullIn', { id: socket.id, x: p.x, y: p.y, radius: character.skillRange });
            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                if (Math.hypot(p.x - m.x, p.y - m.y) > character.skillRange + mR(m)) continue;
                const def = MONSTERS[m.type];
                if (def && def.speed > 0) {
                    const ang = Math.atan2(m.y - p.y, m.x - p.x);
                    const at = mR(m) + PLAYER_RADIUS + 6;
                    const lane = floorDefFor(room.floor);
                    const spot = clampToLane(lane,
                        p.x + Math.cos(ang) * at, p.y + Math.sin(ang) * at);
                    m.x = spot.x; m.y = spot.y;
                    clampMonsterToRoom(lane, m); // 끌어와도 벽은 못 넘는다
                } else {
                    m.hp = Math.max(0, m.hp - character.skillDamage);
                    if (m.hp <= 0) { m.alive = false; io.to(roomId).emit('monsterDefeated', { id: mid }); }
                    else io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
                }
            }
        }
        // 용과맛 크게베기: a broad forward arc; landing it heals the team once.
        else if (character.skillType === 'wide_slash') {
            let hitAny = false;
            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                if (!meleeLineHitPoint(p.x, p.y, p.facing, character.skillRange, character.skillWidth, m.x, m.y, mR(m))) continue;
                hitAny = true;
                m.hp = Math.max(0, m.hp - character.skillDamage);
                if (m.hp <= 0) { m.alive = false; io.to(roomId).emit('monsterDefeated', { id: mid }); }
                else io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
            }
            if (hitAny) healStoryPlayer(room, roomId, character.skillHealOnHit);
        }
        // 치즈만두맛 만두 주먹: 앞을 한 대 치면서 표식을 한 번에 크게 박는다.
        // 피해는 주먹과 같은 1이고, 값어치는 전부 표식 쪽에 있다.
        else if (character.skillType === 'mark_punch') {
            io.to(roomId).emit('storySkillMark', {
                id: socket.id,
                x: p.x + Math.cos(p.facing) * character.skillRange * 0.5,
                y: p.y + Math.sin(p.facing) * character.skillRange * 0.5,
                radius: character.skillWidth, element: character.element
            });
            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                if (!meleeLineHitPoint(p.x, p.y, p.facing, character.skillRange, character.skillWidth, m.x, m.y, mR(m))) continue;
                // 먼저 10개를 박고, 쌓여 있던 것까지 한꺼번에 터뜨린다.
                if (applyElementMark(m, character.element, skillMarkOpts(character), now)) {
                    io.to(roomId).emit('monsterMarked', {
                        id: mid, element: m.elementMark.element, charges: m.elementMark.charges
                    });
                }
                hurtStoryMonster(roomId, room, mid, m,
                    character.skillDamage + burstElementMarks(m, character));
            }
        }
        // 슈가 플라이맛 돌진: rush forward, hit the first thing in the lane,
        // and end up standing next to it.
        else if (character.skillType === 'charge_dash') {
            let best = null, bestId = null, bestDist = Infinity;
            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                if (!meleeLineHitPoint(p.x, p.y, p.facing, character.skillRange, character.skillWidth, m.x, m.y, mR(m))) continue;
                const d = Math.hypot(m.x - p.x, m.y - p.y);
                if (d < bestDist) { bestDist = d; best = m; bestId = mid; }
            }
            const reach = best ? Math.max(0, bestDist - (mR(best) + PLAYER_RADIUS)) : character.skillRange;
            const land = clampToLane(floorDefFor(room.floor),
                p.x + Math.cos(p.facing) * reach, p.y + Math.sin(p.facing) * reach);
            p.x = land.x; p.y = land.y;
            io.to(roomId).emit('storyPlayerTeleported', { id: socket.id, x: p.x, y: p.y });
            if (best) {
                best.hp = Math.max(0, best.hp - character.skillDamage);
                if (best.hp <= 0) { best.alive = false; io.to(roomId).emit('monsterDefeated', { id: bestId }); }
                else io.to(roomId).emit('monsterDamaged', { id: bestId, hp: best.hp });
            }
        }
        // 마그마맛 때파기 / 물방울맛 물방울 터트리기: both pick a spot and
        // mark whatever is standing near it. 때파기 also puts the cookie there.
        else if (character.skillType === 'burrow_mark' || character.skillType === 'mark_burst'
            || character.skillType === 'blink_heal') {
            const t = targetPoint(payload);
            if (!t) return;
            const floorDef = floorDefFor(room.floor);
            const spot = clampToLane(floorDef, t.x, t.y);
            if (character.skillType === 'burrow_mark' || character.skillType === 'blink_heal') {
                p.x = spot.x; p.y = spot.y;
                io.to(roomId).emit('storyPlayerTeleported', { id: socket.id, x: p.x, y: p.y });
            }
            if (character.skillType !== 'blink_heal') {
                io.to(roomId).emit('storySkillMark', {
                    id: socket.id, x: spot.x, y: spot.y,
                    radius: character.skillRadius, element: character.element
                });
                markMonstersInCircle(roomId, room, spot.x, spot.y,
                    character.skillRadius, character.element, skillMarkOpts(character));
            }
            healSelfBySkill(character, p, () =>
                io.to(roomId).emit('storyPlayerHealed', { id: socket.id, hp: p.hp }));
        }
        // 매직블록맛 스킬: 지점을 찍지 않고 자기 중심으로 바로 터뜨린다.
        else if (character.skillType === 'self_mark_burst') {
            io.to(roomId).emit('storySkillMark', {
                id: socket.id, x: p.x, y: p.y,
                radius: character.skillRadius, element: character.element
            });
            markMonstersInCircle(roomId, room, p.x, p.y,
                character.skillRadius, character.element, skillMarkOpts(character));
        }
        // 체리크림맛 특수스킬: 조준 없이 자기 발밑에 회복 지대를 소환한다.
        // magma_zone과 같은 원형 시각 효과를 look:'heal'로 재사용하고, 틱 처리는
        // ally_heal_zone이라는 새 버프 타입으로 room.activeBuffs 루프에서 돈다.
        else if (character.skillType === 'self_heal_zone') {
            io.to(roomId).emit('storyMagmaZonePlaced', {
                id: socket.id, x: p.x, y: p.y, radius: character.skillRadius,
                durationMs: character.skillDurationMs, look: 'heal'
            });
            room.activeBuffs.push({
                type: 'ally_heal_zone', x: p.x, y: p.y, radius: character.skillRadius,
                healPerTick: character.skillHealPerTick, tickMs: character.skillTickMs,
                endAt: now + character.skillDurationMs, lastTickAt: now
            });
        }
        // 암흑바다맛 물속으로 데려가기: 직접 지정한 좁은 반경(skillRadius) 안의
        // 몬스터를 그 자리에서 기절시킨다. 피해도 표식도 없다.
        else if (character.skillType === 'water_drag') {
            const t = targetPoint(payload);
            if (!t) return;
            const spot = clampToLane(floorDefFor(room.floor), t.x, t.y);
            io.to(roomId).emit('storySkillMark', { id: socket.id, x: spot.x, y: spot.y, radius: character.skillRadius });
            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                if (Math.hypot(spot.x - m.x, spot.y - m.y) > character.skillRadius + mR(m)) continue;
                m.stunnedUntil = now + character.skillStunMs;
                io.to(roomId).emit('monsterStunned', { id: mid });
            }
        }
        // 바다펄맛 밀물: 특수스킬 자리에 있지만 실제로는 궁극기다.
        else if (character.skillType === 'tide_cycle') {
            const stage = tideStageOf(character, p);
            if (!stage) return;
            const stageNo = (p.tideStage || 0) + 1;
            const t = stage.damageRatio ? targetPoint(payload) : null;
            if (stage.damageRatio && !t) {
                // 자리를 못 받았으면 쓰지 않은 것으로 되돌린다.
                p.lastSkillTime = 0;
                return;
            }
            // 예열은 쿨타임에 들어가지 않는다: 물결이 터진 순간부터 15초를 센다.
            p.lastSkillTime = now + (stage.windupMs || 0);
            io.to(roomId).emit('storyTideCast', {
                id: socket.id, stage: stageNo, windupMs: stage.windupMs || 0,
                x: t ? t.x : p.x, y: t ? t.y : p.y, radius: character.skillRadius
            });
            afterWindup(roomId, socket.id, stage.windupMs || 0, (rm, pl) => {
                let hit = true;
                if (t) {
                    hit = false;
                    for (const [mid, m] of Object.entries(rm.monsters)) {
                        if (!m.alive) continue;
                        if (Math.hypot(t.x - m.x, t.y - m.y) > character.skillRadius + mR(m)) continue;
                        hit = true;
                        hurtStoryMonster(roomId, rm, mid, m, tideDamageFor(stage, m.hp));
                    }
                    io.to(roomId).emit('storyUltimateMark',
                        { x: t.x, y: t.y, radius: character.skillRadius });
                }
                // 회복은 쿠키마다 자기 최대 체력의 비율만큼. 쉬고 있는 쿠키도 받는다.
                healStoryTeamBy(rm, roomId, maxHp => tideHealFor(stage, maxHp));
                shieldStoryTeam(rm, roomId, stage.shieldAmount);
                advanceTideStage(character, pl, hit);
                io.to(roomId).emit('storyTideStage',
                    { id: socket.id, stage: (pl.tideStage || 0) + 1, hit });
            });
        }
        // 전기줄맛: 상체 <-> 하체 변신. 합체 중엔 못 바꾼다.
        else if (character.skillType === 'body_swap') {
            if (p.fused) return;
            const bonus = bonusOf(p);
            const toLower = (p.bodyForm || 'upper') === 'upper';
            const newForm = toLower ? 'lower' : 'upper';
            const newMax = (toLower ? character.lowerHealth : character.upperHealth) + bonus.health;
            const incomingHp = p.restingHp != null ? Math.min(newMax, p.restingHp) : newMax;
            p.restingHp = p.hp;
            p.bodyForm = newForm;
            p.hp = incomingHp;
            p.maxHp = newMax;
            syncBodyFormToParty(p);
            io.to(roomId).emit('storyBodyFormChanged', { id: socket.id, form: newForm, hp: p.hp, maxHp: p.maxHp, partyHp: p.partyHp, partyMaxHp: p.partyMaxHp });
        }
        // speed_boost is purely client-side; nothing more to do here.
    });

    socket.on('storyPlayerUltimate', (payload) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'story' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const character = charOf(p);
        if (!character.ultimateType) return;
        const now = Date.now();
        // 나비모드 is a toggle: while it is running the press means "switch
        // off", so the cooldown gate must not swallow it.
        if (!(character.ultimateType === 'butterfly_mode' && p.butterflyOn)
            && now - p.lastUltimateTime < ultimateCooldownFor(character, p)) return;
        if (character.ultimateType !== 'butterfly_mode') p.lastUltimateTime = now;

        socket.to(roomId).emit('playerUltimateUsed', { id: socket.id });

        if (character.ultimateType === 'nature_awaken') {
            const level = natureAwakenLevelOf(p);
            if (level < 2) {
                applyNatureAwakenBuff(p, character, now, level);
                io.to(roomId).emit('natureAwaken', { id: socket.id, level: level + 1 });
            } else if (!reviveDownedStoryTeammate(roomId, room)) {
                natureStorySanctuary(roomId, room, character);
                io.to(roomId).emit('natureSanctuary', { id: socket.id });
            }
            advanceNatureAwakenLevel(p);
        } else if (character.ultimateType === 'team_heal_over_time') {
            room.activeBuffs.push({
                type: 'team_heal_over_time',
                tickMs: character.ultimateTickMs,
                healPerTick: character.ultimateHealPerTick,
                endAt: now + character.ultimateDurationMs,
                lastTickAt: now
            });
        }
        // 치즈케이크맛 궁극기: 위 보스 레이드 분기 주석 참고.
        else if (character.ultimateType === 'revive_team_hot') {
            reviveDownedStoryTeammate(roomId, room);
            room.activeBuffs.push({
                type: 'team_heal_over_time',
                tickMs: character.ultimateTickMs,
                healPerTick: character.ultimateHealPerTick,
                endAt: now + character.ultimateDurationMs,
                lastTickAt: now
            });
        } else if (character.ultimateType === 'targeted_aoe') {
            const targetX = payload && payload.targetX;
            const targetY = payload && payload.targetY;
            if (typeof targetX !== 'number' || typeof targetY !== 'number' || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return;
            const floorDef = floorDefFor(room.floor);
            const t = clampToLane(floorDef, targetX, targetY);
            const tx = t.x, ty = t.y;

            io.to(roomId).emit('storyUltimateImpact', { id: socket.id, x: tx, y: ty, radius: character.ultimateRadius });

            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                if (Math.hypot(tx - m.x, ty - m.y) <= character.ultimateRadius + mR(m)) {
                    m.hp = Math.max(0, m.hp - character.ultimateDamage);
                    if (m.hp <= 0) {
                        m.alive = false;
                        io.to(roomId).emit('monsterDefeated', { id: mid });
                    } else {
                        io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
                    }
                }
            }
        }
        // 쿠키맛쿠키 궁극기: 원이 아니라 가로로 긴 직사각형 범위. 맞힌 적의
        // 수만큼 팀 전체를 회복시킨다.
        else if (character.ultimateType === 'targeted_line_aoe') {
            const t0 = targetPoint(payload);
            if (!t0) return;
            const floorDef = floorDefFor(room.floor);
            const spot = clampToLane(floorDef, t0.x, t0.y);
            io.to(roomId).emit('storyUltimateLineImpact', {
                id: socket.id, x: spot.x, y: spot.y,
                width: character.ultimateWidth, height: character.ultimateHeight
            });
            let hitCount = 0;
            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                const r = mR(m);
                if (Math.abs(spot.x - m.x) > character.ultimateWidth / 2 + r) continue;
                if (Math.abs(spot.y - m.y) > character.ultimateHeight / 2 + r) continue;
                hitCount++;
                m.hp = Math.max(0, m.hp - character.ultimateDamage);
                if (m.hp <= 0) {
                    m.alive = false;
                    io.to(roomId).emit('monsterDefeated', { id: mid });
                } else {
                    io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
                }
            }
            if (hitCount) healStoryPlayer(room, roomId, character.ultimateHealPerEnemy * hitCount);
        } else if (character.ultimateType === 'sky_slam') {
            // 지옥맛 궁극기: 지정한 자리로 날아올랐다가 떨어진다. targeted_aoe와
            // 텔레그래프는 같지만, 예열 뒤에 자기 자신도 그 자리로 옮겨간다.
            const targetX = payload && payload.targetX;
            const targetY = payload && payload.targetY;
            if (typeof targetX !== 'number' || typeof targetY !== 'number' || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return;
            const floorDef = floorDefFor(room.floor);
            const t = clampToLane(floorDef, targetX, targetY);
            io.to(roomId).emit('storyUltimateImpact', { id: socket.id, x: t.x, y: t.y, radius: character.ultimateRadius });
            afterWindup(roomId, socket.id, character.ultimateWindupMs, (rm, pl) => {
                pl.x = t.x; pl.y = t.y;
                io.to(roomId).emit('storyPlayerTeleported', { id: socket.id, x: pl.x, y: pl.y });
                let landed = false;
                for (const [mid, m] of Object.entries(rm.monsters)) {
                    if (!m.alive) continue;
                    if (Math.hypot(t.x - m.x, t.y - m.y) > character.ultimateRadius + mR(m)) continue;
                    landed = true;
                    m.hp = Math.max(0, m.hp - character.ultimateDamage);
                    if (m.hp <= 0) { m.alive = false; io.to(roomId).emit('monsterDefeated', { id: mid }); }
                    else io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
                }
                if (!landed) return;
                pl.skySlamBuffUntil = Date.now() + character.ultimateAttackBuffDurationMs;
                if (character.ultimateHealRatioOnHit) {
                    pl.hp = Math.min(pl.maxHp, pl.hp + Math.round(pl.maxHp * character.ultimateHealRatioOnHit));
                    io.to(roomId).emit('storyPlayerHealed', { id: socket.id, hp: pl.hp });
                }
            });
        } else if (character.ultimateType === 'fire_line_zone') {
            // 불꽃요정맛 궁극기: 번개악마맛 크게베기처럼 조준 없이 지금 보는
            // 방향으로 길고 큰 화염지대를 깐다. 15초 동안 유지된다.
            io.to(roomId).emit('storyFireLineZonePlaced', {
                id: socket.id, x: p.x, y: p.y, facing: p.facing,
                range: character.ultimateRange, width: character.ultimateWidth,
                durationMs: character.ultimateZoneDurationMs
            });
            room.activeBuffs.push({
                type: 'fire_line_zone', casterId: socket.id,
                x: p.x, y: p.y, facing: p.facing,
                range: character.ultimateRange, width: character.ultimateWidth,
                damage: character.ultimateZoneDamagePerTick,
                healPerTick: character.ultimateZoneSelfHealPerTick,
                tickMs: character.ultimateZoneTickMs,
                endAt: now + character.ultimateZoneDurationMs,
                lastTickAt: now
            });
        } else if (character.ultimateType === 'guard_surge') {
            shieldStoryTeam(room, roomId, character.ultimateShieldAmount);
            healStoryPlayer(room, roomId, character.ultimateHealAmount);
        } else if (character.ultimateType === 'team_guard') {
            for (const [id, pl] of Object.entries(room.players)) {
                if (!pl.alive) continue;
                pl.hp = Math.min(pl.maxHp, pl.hp + Math.round(pl.maxHp * character.ultimateHealRatio));
                io.to(roomId).emit('storyPlayerHealed', { id, hp: pl.hp });
            }
            shieldStoryTeam(room, roomId, character.ultimateShieldAmount);
        } else if (character.ultimateType === 'self_ratio_guard') {
            // 파핑캔디맛: team_guard와 같은 모양이지만 자기 자신에게만 건다.
            // 11층+ 파티 쿠키라면 partyHp도 같이 맞춰 준다(team_guard는 이
            // 경우를 안 챙기지만, 자기 자신뿐이라 여기서는 직접 해 준다).
            const healed = Math.round(p.maxHp * character.ultimateHealRatio);
            if (p.party) {
                p.partyHp[p.active] = Math.min(p.partyMaxHp[p.active], p.partyHp[p.active] + healed);
                p.hp = p.partyHp[p.active];
            } else {
                p.hp = Math.min(p.maxHp, p.hp + healed);
            }
            io.to(roomId).emit('storyPlayerHealed', { id: socket.id, hp: p.hp, partyHp: p.partyHp });
            p.shieldHp = character.ultimateShieldAmount;
            io.to(roomId).emit('storyPlayerShielded', { id: socket.id, shieldHp: p.shieldHp });
        } else if (character.ultimateType === 'great_slash') {
            // 0.3초 예열 -> 엄청 큰 반공간 베기. 예열을 먼저 알려서 피할 틈을 준다.
            io.to(roomId).emit('storyGreatSlash', {
                id: socket.id, x: p.x, y: p.y, facing: p.facing,
                range: character.ultimateRange, width: character.ultimateWidth,
                windupMs: character.ultimateWindupMs
            });
            p.speedBoostUntil = now + character.ultimateSpeedDurationMs;
            afterWindup(roomId, socket.id, character.ultimateWindupMs, (rm, pl) => {
                let landed = false;
                const dmg = stat(character, pl, 'ultimateDamage');
                for (const [mid, m] of Object.entries(rm.monsters)) {
                    if (!m.alive) continue;
                    if (!meleeLineHitPoint(pl.x, pl.y, pl.facing, character.ultimateRange,
                        character.ultimateWidth, m.x, m.y, mR(m))) continue;
                    landed = true;
                    m.hp = Math.max(0, m.hp - dmg);
                    if (m.hp <= 0) { m.alive = false; io.to(roomId).emit('monsterDefeated', { id: mid }); }
                    else io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
                }
                if (landed && character.ultimateHealRatio) {
                    pl.hp = Math.min(pl.maxHp, pl.hp + Math.round(pl.maxHp * character.ultimateHealRatio));
                    io.to(roomId).emit('storyPlayerHealed', { id: socket.id, hp: pl.hp });
                }
            });
        } else if (character.ultimateType === 'butterfly_mode') {
            const off = toggleButterflyMode(character, p, now);
            io.to(roomId).emit('storyButterflyMode', { id: socket.id, on: !off });
        } else if (character.ultimateType === 'magma_pour' || character.ultimateType === 'mark_flood') {
            // 마그마 쏟기 / 폭포: both drop a marked circle on a chosen spot;
            // only 마그마 쏟기 also deals damage.
            const t0 = targetPoint(payload);
            if (!t0) return;
            const floorDef = floorDefFor(room.floor);
            const spot = clampToLane(floorDef, t0.x, t0.y);
            io.to(roomId).emit('storyUltimateMark', {
                id: socket.id, x: spot.x, y: spot.y, radius: character.ultimateRadius,
                element: character.element, durationMs: character.ultimateMarkDurationMs,
                damage: character.ultimateDamage || 0
            });
            if (character.ultimateDamage) {
                for (const [mid, m] of Object.entries(room.monsters)) {
                    if (!m.alive) continue;
                    if (Math.hypot(spot.x - m.x, spot.y - m.y) > character.ultimateRadius + mR(m)) continue;
                    m.hp = Math.max(0, m.hp - character.ultimateDamage);
                    if (m.hp <= 0) { m.alive = false; io.to(roomId).emit('monsterDefeated', { id: mid }); }
                    else io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
                }
            }
            markMonstersInCircle(roomId, room, spot.x, spot.y, character.ultimateRadius,
                character.element, ultimateMarkOpts(character));
            // 본능해제 4강(물방울맛): 표식만 남기던 폭포/마그마 쏟기 자리에 초당 피해를 더한다.
            if (character.instinctZoneDamagePerTick) {
                room.activeBuffs.push({
                    type: 'magma_zone', casterId: socket.id, x: spot.x, y: spot.y,
                    radius: character.ultimateRadius, damage: character.instinctZoneDamagePerTick,
                    tickMs: character.instinctZoneTickMs || 1000,
                    endAt: now + character.ultimateMarkDurationMs, lastTickAt: now
                });
            }
        } else if (character.ultimateType === 'lightning_strike') {
            const targetX = payload && payload.targetX;
            const targetY = payload && payload.targetY;
            if (typeof targetX !== 'number' || typeof targetY !== 'number' || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return;
            const floorDef = floorDefFor(room.floor);
            const t = clampToLane(floorDef, targetX, targetY);
            const tx = t.x, ty = t.y;

            io.to(roomId).emit('storyLightningStrike', { id: socket.id, x: tx, y: ty, radius: character.ultimateRadius });

            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                if (Math.hypot(tx - m.x, ty - m.y) > character.ultimateRadius + mR(m)) continue;
                m.hp = Math.max(0, m.hp - character.ultimateDamage);
                if (m.hp <= 0) {
                    m.alive = false;
                    io.to(roomId).emit('monsterDefeated', { id: mid });
                    continue;
                }
                io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
                m.stunnedUntil = now + character.ultimateStunMs;
                io.to(roomId).emit('monsterStunned', { id: mid });
                // ...and it hits softer for a while afterwards.
                m.damageDebuffUntil = now + character.ultimateDebuffDurationMs;
                m.damageDebuffMultiplier = character.ultimateDamageDebuffMultiplier;
            }
        } else if (character.ultimateType === 'attack_heal_boost') {
            p.attackHealBoostUntil = now + character.ultimateDurationMs;
        } else if (character.ultimateType === 'awakening') {
            p.awakenUntil = now + character.ultimateDurationMs;
            // 체리크림맛: 30% 확률로 "극대노"(더 강한 수치)가 된다. 서버가 굴리는
            // 이 값이 피해 계산의 진짜 기준이고, 클라이언트는 이동속도 표현용으로
            // 따로(독립적으로) 굴린다 -- moveSpeedFor 쪽 주석 참고.
            if (character.ultimateRageChance != null) {
                p.awakenRaged = Math.random() < character.ultimateRageChance;
            }
            // 체리크림맛: 그 8초 동안 명중할 때마다 회복/보호막을 준다. 시금치맛의
            // attack_heal_boost 타이머를 그대로 재사용한다.
            if (character.ultimateHealPerAttack != null || character.ultimateShieldPerAttack != null) {
                p.attackHealBoostUntil = now + character.ultimateDurationMs;
            }
            if (character.ultimateSelfHeal) {
                const healed = Math.min(p.maxHp, p.hp + character.ultimateSelfHeal);
                if (healed !== p.hp) {
                    p.hp = healed;
                    io.to(roomId).emit('storyPlayerHealed', { id: socket.id, hp: p.hp });
                }
            }
        } else if (character.ultimateType === 'magma_zone' || character.ultimateType === 'dumpling_zone') {
            const targetX = payload && payload.targetX;
            const targetY = payload && payload.targetY;
            if (typeof targetX !== 'number' || typeof targetY !== 'number' || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return;
            const floorDef = floorDefFor(room.floor);
            const t = clampToLane(floorDef, targetX, targetY);
            const tx = t.x, ty = t.y;

            io.to(roomId).emit('storyMagmaZonePlaced', {
                id: socket.id, x: tx, y: ty, radius: character.ultimateRadius,
                durationMs: character.ultimateZoneDurationMs, look: zoneLookOf(character)
            });

            room.activeBuffs.push(Object.assign({
                type: 'magma_zone',
                casterId: socket.id,
                x: tx, y: ty,
                radius: character.ultimateRadius,
                damage: character.ultimateZoneDamagePerTick,
                tickMs: character.ultimateZoneTickMs,
                endAt: now + character.ultimateZoneDurationMs,
                lastTickAt: now
            }, zoneMarkFields(character)));
        } else if (character.ultimateType === 'element_mark') {
            // No immediate effect -- read by the storyPlayerAttack handler,
            // which marks whatever it hits for the rest of this window.
            p.elementMarkUntil = now + character.ultimateDurationMs;
        } else if (character.ultimateType === 'awakening_rapid') {
            p.rapidStrikeUntil = now + character.ultimateDurationMs;
            p.rapidAttackCount = 0;
            if (p.awakenGear && p.awakenGear.awakenUltimateMark) {
                io.to(roomId).emit('storyUltimateMark', {
                    id: socket.id, x: p.x, y: p.y,
                    radius: p.awakenGear.awakenUltimateMark.radius, element: character.element
                });
                applyAwakenUltimateMark(roomId, room, p, character, null);
            }
        } else if (character.ultimateType === 'team_shield') {
            shieldStoryTeam(room, roomId, character.ultimateShieldAmount);
            // 본능해제 4강(보드맛): 방어막에 회복도 얹는다.
            if (character.ultimateHealAmount) healStoryPlayer(room, roomId, character.ultimateHealAmount);
        }
        // 암흑바다맛 궁극기: 전방으로 빠르게 돌진하고(조준 없음, 피해 없음),
        // 팀 전체에게 보호막과 회복을 준다. 본능해제 4강을 찍으면 도착한 자리에
        // 불 지대가 생겨(magma_zone과 같은 훅) 초당 피해를 준다.
        else if (character.ultimateType === 'dash_guard') {
            const floorDef = floorDefFor(room.floor);
            const land = clampToLane(floorDef,
                p.x + Math.cos(p.facing) * character.ultimateRange,
                p.y + Math.sin(p.facing) * character.ultimateRange);
            p.x = land.x; p.y = land.y;
            io.to(roomId).emit('storyPlayerTeleported', { id: socket.id, x: p.x, y: p.y });
            shieldStoryTeam(room, roomId, character.ultimateShieldAmount);
            healStoryPlayer(room, roomId, character.ultimateHealAmount);
            if (character.ultimateZoneDamagePerTick) {
                io.to(roomId).emit('storyMagmaZonePlaced', {
                    id: socket.id, x: p.x, y: p.y, radius: character.ultimateRadius,
                    durationMs: character.ultimateZoneDurationMs, look: zoneLookOf(character)
                });
                room.activeBuffs.push(Object.assign({
                    type: 'magma_zone',
                    casterId: socket.id,
                    x: p.x, y: p.y,
                    radius: character.ultimateRadius,
                    damage: character.ultimateZoneDamagePerTick,
                    tickMs: character.ultimateZoneTickMs,
                    endAt: now + character.ultimateZoneDurationMs,
                    lastTickAt: now
                }, zoneMarkFields(character)));
            }
        }
        // 바다 수호자맛 궁극기: 막기. 팀 전체에게 즉시 보호막을 씌우고, 초당
        // 회복 버프도 얹는다 -- 버프 자체는 team_heal_over_time과 완전히
        // 같은 걸 재사용한다(틱 처리가 이미 모드별로 다 있다).
        else if (character.ultimateType === 'team_hot_shield') {
            shieldStoryTeam(room, roomId, character.ultimateShieldAmount);
            room.activeBuffs.push({
                type: 'team_heal_over_time',
                tickMs: character.ultimateTickMs,
                healPerTick: character.ultimateHealPerTick,
                endAt: now + character.ultimateDurationMs,
                lastTickAt: now
            });
        } else if (character.ultimateType === 'undying_soul') {
            // Heals a share of max hp, then the timer is read by
            // effectiveAttackDamage (the speed part is client-side movement).
            p.undyingSoulUntil = now + character.ultimateDurationMs;
            const healed = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * character.ultimateHealRatio));
            if (healed !== p.hp) {
                p.hp = healed;
                io.to(roomId).emit('storyPlayerHealed', { id: socket.id, hp: p.hp });
            }
            spawnSummons(roomId, room, socket.id, character, now);
        }
        // 전기줄맛 합체: 10초 동안 상체+하체 체력을 하나로 합치고 공격력이 6이 된다.
        else if (character.ultimateType === 'body_fuse') {
            if (p.fused) return;
            const bonus = bonusOf(p);
            const upperMax = character.upperHealth + bonus.health;
            const lowerMax = character.lowerHealth + bonus.health;
            const restingHp = p.restingHp != null ? p.restingHp
                : ((p.bodyForm || 'upper') === 'upper' ? lowerMax : upperMax);
            p.fused = true;
            p.fusedUntil = now + character.ultimateDurationMs;
            p.maxHp = upperMax + lowerMax;
            p.hp = Math.min(p.maxHp, p.hp + restingHp);
            syncBodyFormToParty(p);
            io.to(roomId).emit('storyBodyFormChanged', { id: socket.id, form: 'fused', hp: p.hp, maxHp: p.maxHp, partyHp: p.partyHp, partyMaxHp: p.partyMaxHp });
        }
    });

    socket.on('playerMove', ({ x, y, facing }) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room) return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const dist = Math.hypot(x, y);
        if (dist > ARENA_RADIUS - PLAYER_RADIUS + 1) return; // ignore out-of-bounds claims
        if (dist < BOSS_RADIUS + PLAYER_RADIUS - 1) return; // ignore positions overlapping the boss
        p.x = x; p.y = y; p.facing = facing;
        socket.to(roomId).emit('playerMoved', { id: socket.id, x, y, facing });
    });

    socket.on('playerAttack', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const character = charOf(p);
        const now = Date.now();
        // 바다 수호자맛 특수스킬로 숨어 있는 동안은 자기도 공격을 못 한다.
        if (p.untouchableUntil && now < p.untouchableUntil) return;
        const rapid = rapidStrikeActive(character, p, now);
        const cooldown = attackCooldownFor(character, p, rapid, now);
        if (now - p.lastAttackTime < cooldown) return;
        if (!consumeAmmoOrBlock(character, p, now)) return;
        p.lastAttackTime = now;
        if (character.skillType === 'guard_stance') p.guardStanceUntil = 0; // attacking breaks guard

        if (character.attackType === 'throw_projectile') {
            spawnPlayerProjectile(roomId, room, socket.id, p, character, now, 'dropThrown');
            return;
        }
        if (character.attackType === 'homing_burst') {
            fireHomingBurst(roomId, room, socket.id, p, character, now, 'dropThrown');
            return;
        }
        if (character.attackType === 'melee_kick' || character.attackType === 'alternating_punch'
            || character.attackType === 'combo_two_stage' || character.attackType === 'dual_spear'
            || character.attackType === 'vampire_slash') {
            const swing = resolveAttack(character, p, now, rapid);
            advanceAttackSequence(character, p);
            if (meleeLineHit(swing.originX, swing.originY, p.facing, swing.range, swing.width, BOSS_RADIUS)) {
                landRaidHitOnBoss(roomId, room, socket.id, p, character, swing.damage, now, swing);
            }
        }
    });

    socket.on('playerSkill', (payload) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const character = charOf(p);
        if (!character.skillType) return;
        const now = Date.now();
        if (now - p.lastSkillTime < skillCooldownFor(character, p)) return;
        p.lastSkillTime = now;

        socket.to(roomId).emit('playerSkillUsed', { id: socket.id });

        // 바람궁수맛 특수스킬: 조준 없이 즉시 발동, 팀 전체에게 초당 회복
        // 버프를 건다. team_heal_over_time 궁극기와 같은 버프를 스킬 쪽
        // 필드(skill*)로 채워서 그대로 재사용한다.
        if (character.skillType === 'team_heal_over_time') {
            room.activeBuffs.push({
                type: 'team_heal_over_time',
                tickMs: character.skillTickMs,
                healPerTick: character.skillHealPerTick,
                endAt: now + character.skillDurationMs,
                lastTickAt: now
            });
        }
        // 치즈케이크맛 특수스킬: 조준 없이 즉시 발동, 팀 전체 체력을 최대
        // 체력의 skillHealRatio만큼 채우고 skillAttackBuffDurationMs 동안
        // 공격력을 skillAttackMultiplier배로 올린다(p.attackMultiplierUntil/
        // Value, effectiveAttackDamage가 읽는다).
        else if (character.skillType === 'team_ratio_heal_attack_buff') {
            for (const [id, pl] of Object.entries(room.players)) {
                if (!pl.alive) continue;
                pl.hp = Math.min(pl.maxHp, pl.hp + Math.round(pl.maxHp * character.skillHealRatio));
                io.to(roomId).emit('playerHealed', { id, hp: pl.hp });
                pl.attackMultiplierUntil = now + character.skillAttackBuffDurationMs;
                pl.attackMultiplierValue = character.skillAttackMultiplier;
            }
        } else if (character.skillType === 'pull_in') {
            // The raid boss is bolted to the middle of the arena, so there is
            // nothing to drag -- it takes the "can't be pulled" damage instead.
            io.to(roomId).emit('pullIn', { id: socket.id, x: p.x, y: p.y, radius: character.skillRange });
            if (Math.hypot(p.x, p.y) - BOSS_RADIUS <= character.skillRange) {
                room.bossHp = Math.max(0, room.bossHp - character.skillDamage);
                io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: socket.id });
                if (room.bossHp <= 0) endRoom(roomId, 'win');
            }
        } else if (character.skillType === 'wide_slash') {
            if (meleeLineHit(p.x, p.y, p.facing, character.skillRange, character.skillWidth, BOSS_RADIUS)) {
                room.bossHp = Math.max(0, room.bossHp - character.skillDamage);
                io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: socket.id });
                if (room.bossHp <= 0) { endRoom(roomId, 'win'); return; }
                healTeam(room, roomId, character.skillHealOnHit);
            }
        } else if (character.skillType === 'charge_dash') {
            const hit = meleeLineHit(p.x, p.y, p.facing, character.skillRange, character.skillWidth, BOSS_RADIUS);
            const reach = hit
                ? Math.max(0, Math.hypot(p.x, p.y) - (BOSS_RADIUS + PLAYER_RADIUS))
                : character.skillRange;
            const land = clampToArena(p.x + Math.cos(p.facing) * reach,
                p.y + Math.sin(p.facing) * reach, ARENA_RADIUS - PLAYER_RADIUS);
            p.x = land.x; p.y = land.y;
            io.to(roomId).emit('playerTeleported', { id: socket.id, x: p.x, y: p.y });
            if (hit) {
                room.bossHp = Math.max(0, room.bossHp - character.skillDamage);
                io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: socket.id });
                if (room.bossHp <= 0) endRoom(roomId, 'win');
            }
        } else if (character.skillType === 'burrow_mark' || character.skillType === 'mark_burst'
            || character.skillType === 'blink_heal') {
            const t = targetPoint(payload);
            if (!t) return;
            const spot = clampToArena(t.x, t.y, ARENA_RADIUS - PLAYER_RADIUS);
            if (character.skillType === 'burrow_mark' || character.skillType === 'blink_heal') {
                p.x = spot.x; p.y = spot.y;
                io.to(roomId).emit('playerTeleported', { id: socket.id, x: p.x, y: p.y });
            }
            if (character.skillType !== 'blink_heal') {
                io.to(roomId).emit('skillMark', {
                    id: socket.id, x: spot.x, y: spot.y,
                    radius: character.skillRadius, element: character.element
                });
                markBossInCircle(roomId, room, spot.x, spot.y, character.skillRadius,
                    character.element, skillMarkOpts(character), 'bossMarked');
            }
            healSelfBySkill(character, p, () =>
                io.to(roomId).emit('playerHealed', { id: socket.id, hp: p.hp }));
        }
        // 매직블록맛 스킬: 지점을 찍지 않고 자기 중심으로 바로 터뜨린다.
        else if (character.skillType === 'self_mark_burst') {
            io.to(roomId).emit('skillMark', {
                id: socket.id, x: p.x, y: p.y,
                radius: character.skillRadius, element: character.element
            });
            markBossInCircle(roomId, room, p.x, p.y, character.skillRadius,
                character.element, skillMarkOpts(character), 'bossMarked');
        }
        // 체리크림맛 특수스킬: 위 스토리 모드 분기 주석 참고.
        else if (character.skillType === 'self_heal_zone') {
            io.to(roomId).emit('magmaZonePlaced', {
                id: socket.id, x: p.x, y: p.y, radius: character.skillRadius,
                durationMs: character.skillDurationMs, look: 'heal'
            });
            room.activeBuffs.push({
                type: 'ally_heal_zone', x: p.x, y: p.y, radius: character.skillRadius,
                healPerTick: character.skillHealPerTick, tickMs: character.skillTickMs,
                endAt: now + character.skillDurationMs, lastTickAt: now
            });
        }
        // 암흑바다맛 물속으로 데려가기: 직접 지정한 좁은 반경(skillRadius) 안에
        // 보스가 있으면 그 자리에서 기절시킨다. 피해도 표식도 없다.
        else if (character.skillType === 'water_drag') {
            const t = targetPoint(payload);
            if (!t) return;
            const spot = clampToArena(t.x, t.y, ARENA_RADIUS);
            io.to(roomId).emit('skillMark', { id: socket.id, x: spot.x, y: spot.y, radius: character.skillRadius });
            if (Math.hypot(spot.x, spot.y) <= character.skillRadius + BOSS_RADIUS) {
                room.bossStunnedUntil = now + character.skillStunMs;
                io.to(roomId).emit('bossStunned', { until: room.bossStunnedUntil });
            }
        }
        // 바다펄맛 밀물. 보스는 경기장 한가운데에 박혀 있으므로, 찍은 자리가
        // 보스에 닿았는지만 본다.
        else if (character.skillType === 'tide_cycle') {
            const stage = tideStageOf(character, p);
            if (!stage) return;
            const stageNo = (p.tideStage || 0) + 1;
            const t = stage.damageRatio ? targetPoint(payload) : null;
            if (stage.damageRatio && !t) { p.lastSkillTime = 0; return; }
            const spot = t ? clampToArena(t.x, t.y, ARENA_RADIUS - PLAYER_RADIUS) : null;
            // 예열은 쿨타임에 들어가지 않는다.
            p.lastSkillTime = now + (stage.windupMs || 0);
            io.to(roomId).emit('tideCast', {
                id: socket.id, stage: stageNo, windupMs: stage.windupMs || 0,
                x: spot ? spot.x : p.x, y: spot ? spot.y : p.y, radius: character.skillRadius
            });
            afterWindup(roomId, socket.id, stage.windupMs || 0, (rm, pl) => {
                let hit = true;
                if (spot) {
                    hit = Math.hypot(spot.x, spot.y) <= character.skillRadius + BOSS_RADIUS;
                    if (hit) {
                        rm.bossHp = Math.max(0, rm.bossHp - tideDamageFor(stage, rm.bossHp));
                        io.to(roomId).emit('bossDamaged', { bossHp: rm.bossHp, by: socket.id });
                    }
                    io.to(roomId).emit('ultimateMark',
                        { x: spot.x, y: spot.y, radius: character.skillRadius });
                    if (rm.bossHp <= 0) { endRoom(roomId, 'win'); return; }
                }
                for (const [id, tp] of Object.entries(rm.players)) {
                    if (!tp.alive) continue;
                    const healed = Math.min(tp.maxHp, tp.hp + tideHealFor(stage, tp.maxHp));
                    if (healed !== tp.hp) {
                        tp.hp = healed;
                        io.to(roomId).emit('playerHealed', { id, hp: tp.hp });
                    }
                }
                shieldTeam(rm, roomId, stage.shieldAmount);
                advanceTideStage(character, pl, hit);
                io.to(roomId).emit('tideStage',
                    { id: socket.id, stage: (pl.tideStage || 0) + 1, hit });
            });
        } else if (character.skillType === 'spin_kick' || character.skillType === 'lava_burst') {
            // A spinning kick hits regardless of facing, unlike the basic attack.
            // lava_burst (volcano cookie) uses the exact same self-centered AoE shape.
            const distToEdge = Math.hypot(p.x, p.y) - BOSS_RADIUS;
            if (distToEdge <= character.skillRange) {
                room.bossHp = Math.max(0, room.bossHp - character.skillDamage);
                io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: socket.id });
                if (room.bossHp <= 0) endRoom(roomId, 'win');
            }
        } else if (character.skillType === 'spin_heal') {
            // Channels for skillDurationMs; if the boss is ever in range during
            // that window, it lands once (damage + team heal) and stops checking.
            room.activeBuffs.push({
                type: 'spin_heal_check',
                casterId: socket.id,
                radius: character.skillRadius,
                damage: character.skillDamage,
                healAmount: character.skillHealOnHit,
                endAt: now + character.skillDurationMs,
                tickMs: 150,
                lastTickAt: now,
                triggered: false
            });
        } else if (character.skillType === 'guard_stance' || character.skillType === 'shield_block') {
            // Same timer; only guard_stance is broken early by attacking.
            p.guardStanceUntil = now + character.skillDurationMs;
        } else if (character.skillType === 'flying_kick') {
            if (meleeLineHit(p.x, p.y, p.facing, character.skillRange, character.skillWidth, BOSS_RADIUS)) {
                room.bossStunnedUntil = now + character.skillStunMs;
                io.to(roomId).emit('bossStunned', { durationMs: character.skillStunMs });
            }
        }
        // 쿠키맛쿠키 특수스킬: 조준 없이 즉시 자기 체력을 채우고(적중 여부와
        // 무관), 반경 안에 보스가 있으면 얼려서 그동안 아무 행동도 못 하게 한다.
        else if (character.skillType === 'freeze_burst') {
            p.hp = Math.min(p.maxHp, p.hp + character.skillSelfHeal);
            io.to(roomId).emit('playerHealed', { id: socket.id, hp: p.hp });
            if (Math.hypot(p.x, p.y) - BOSS_RADIUS <= character.skillRange) {
                room.bossStunnedUntil = now + character.skillFreezeMs;
                io.to(roomId).emit('bossStunned', { durationMs: character.skillFreezeMs, freeze: true });
            }
        } else if (character.skillType === 'kick') {
            if (meleeLineHit(p.x, p.y, p.facing, character.skillRange, character.skillWidth, BOSS_RADIUS)) {
                room.bossHp = Math.max(0, room.bossHp - character.skillDamage);
                io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: socket.id });
                if (room.bossHp <= 0) endRoom(roomId, 'win');
            }
        }
        // 치즈만두맛 만두 주먹: 보스에 표식을 박고, 쌓여 있던 것까지 터뜨린다.
        else if (character.skillType === 'mark_punch') {
            if (meleeLineHit(p.x, p.y, p.facing, character.skillRange, character.skillWidth, BOSS_RADIUS)) {
                const target = bossMarkTarget(room);
                let burst = 0;
                if (applyElementMark(target, character.element, skillMarkOpts(character), now)) {
                    burst = burstElementMarks(target, character);
                }
                io.to(roomId).emit('bossMarked', room.bossElementMark
                    ? {
                        element: room.bossElementMark.element,
                        charges: room.bossElementMark.charges,
                        until: room.bossElementMark.until
                    }
                    : { element: null, charges: 0 });
                room.bossHp = Math.max(0, room.bossHp - (character.skillDamage + burst));
                io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: socket.id });
                if (room.bossHp <= 0) { endRoom(roomId, 'win'); return; }
            }
        } else if (character.skillType === 'self_heal') {
            const healed = Math.min(p.maxHp, p.hp + character.skillHealAmount);
            if (healed !== p.hp) {
                p.hp = healed;
                io.to(roomId).emit('playerHealed', { id: socket.id, hp: p.hp });
            }
        }
        // 지옥맛 특수스킬: 자기 체력을 채우고, 반경 안에 보스가 있으면
        // 데미지를 준다 (raid는 보스 하나뿐이라 몬스터 루프가 필요 없다).
        else if (character.skillType === 'life_burst') {
            p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * character.skillHealRatio));
            io.to(roomId).emit('playerHealed', { id: socket.id, hp: p.hp });
            if (Math.hypot(p.x, p.y) - BOSS_RADIUS <= character.skillRadius) {
                room.bossHp = Math.max(0, room.bossHp - character.skillDamage);
                io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: socket.id });
                if (room.bossHp <= 0) endRoom(roomId, 'win');
            }
        }
        // 불꽃요정맛 특수스킬: 방패로 막는다. 고정값 회복 + 자기 자신에게만
        // 보호막을 씌운다.
        else if (character.skillType === 'self_guard_surge') {
            p.hp = Math.min(p.maxHp, p.hp + character.skillHealAmount);
            p.shieldHp = character.skillShieldAmount;
            io.to(roomId).emit('playerHealed', { id: socket.id, hp: p.hp });
            io.to(roomId).emit('playerShielded', { id: socket.id, shieldHp: p.shieldHp });
        }
        // 바다 수호자맛 특수스킬: 바다로 들어가기. 실제 무적 판정은
        // damageReductionMultiplier가 담당한다(위 스토리 모드 분기 주석 참고).
        else if (character.skillType === 'sea_hide') {
            p.untouchableUntil = now + character.skillDurationMs;
            p.hp = Math.min(p.maxHp, p.hp + character.skillHealAmount);
            io.to(roomId).emit('playerHealed', { id: socket.id, hp: p.hp });
            io.to(roomId).emit('playerHidden', { id: socket.id, until: p.untouchableUntil });
        } else if (character.skillType === 'earthquake') {
            // A raid only ever has one enemy (the boss), so this always takes
            // the small-group branch -- the boss is never one-shot.
            io.to(roomId).emit('earthquake', { id: socket.id, count: 1 });
            room.bossHp = Math.max(0, room.bossHp - character.skillDamage);
            io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: socket.id });
            if (room.bossHp <= 0) endRoom(roomId, 'win');
        }
        // 전기줄맛: 상체 <-> 하체 변신. 합체 중엔 못 바꾼다.
        else if (character.skillType === 'body_swap') {
            if (p.fused) return;
            const bonus = bonusOf(p);
            const toLower = (p.bodyForm || 'upper') === 'upper';
            const newForm = toLower ? 'lower' : 'upper';
            const newMax = (toLower ? character.lowerHealth : character.upperHealth) + bonus.health;
            const incomingHp = p.restingHp != null ? Math.min(newMax, p.restingHp) : newMax;
            p.restingHp = p.hp;
            p.bodyForm = newForm;
            p.hp = incomingHp;
            p.maxHp = newMax;
            io.to(roomId).emit('bodyFormChanged', { id: socket.id, form: newForm, hp: p.hp, maxHp: p.maxHp });
        }
    });

    socket.on('playerUltimate', (payload) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const character = charOf(p);
        if (!character.ultimateType) return;
        const now = Date.now();
        // 나비모드 is a toggle: while it is running the press means "switch
        // off", so the cooldown gate must not swallow it.
        if (!(character.ultimateType === 'butterfly_mode' && p.butterflyOn)
            && now - p.lastUltimateTime < ultimateCooldownFor(character, p)) return;
        if (character.ultimateType !== 'butterfly_mode') p.lastUltimateTime = now;

        socket.to(roomId).emit('playerUltimateUsed', { id: socket.id });

        if (character.ultimateType === 'nature_awaken') {
            const level = natureAwakenLevelOf(p);
            if (level < 2) {
                applyNatureAwakenBuff(p, character, now, level);
                io.to(roomId).emit('natureAwaken', { id: socket.id, level: level + 1 });
            } else if (!reviveDownedPlayer(roomId, room, character)) {
                natureSanctuary(roomId, room, character);
                io.to(roomId).emit('natureSanctuary', { id: socket.id });
            }
            advanceNatureAwakenLevel(p);
        } else if (character.ultimateType === 'team_heal_over_time') {
            room.activeBuffs.push({
                type: 'team_heal_over_time',
                tickMs: character.ultimateTickMs,
                healPerTick: character.ultimateHealPerTick,
                endAt: now + character.ultimateDurationMs,
                lastTickAt: now
            });
        }
        // 치즈케이크맛 궁극기: 팀 중 쓰러진 동료가 있으면 부활시키고(없으면
        // 그냥 넘어간다), 그와 별개로 항상 team_heal_over_time 버프를 얹는다.
        else if (character.ultimateType === 'revive_team_hot') {
            reviveDownedPlayer(roomId, room, character);
            room.activeBuffs.push({
                type: 'team_heal_over_time',
                tickMs: character.ultimateTickMs,
                healPerTick: character.ultimateHealPerTick,
                endAt: now + character.ultimateDurationMs,
                lastTickAt: now
            });
        } else if (character.ultimateType === 'guard_surge') {
            shieldTeam(room, roomId, character.ultimateShieldAmount);
            healTeam(room, roomId, character.ultimateHealAmount);
        } else if (character.ultimateType === 'team_guard') {
            for (const [id, pl] of Object.entries(room.players)) {
                if (!pl.alive) continue;
                pl.hp = Math.min(pl.maxHp, pl.hp + Math.round(pl.maxHp * character.ultimateHealRatio));
                io.to(roomId).emit('playerHealed', { id, hp: pl.hp });
            }
            shieldTeam(room, roomId, character.ultimateShieldAmount);
        } else if (character.ultimateType === 'self_ratio_guard') {
            // 파핑캔디맛: team_guard와 같은 모양이지만 자기 자신에게만 건다.
            p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * character.ultimateHealRatio));
            io.to(roomId).emit('playerHealed', { id: socket.id, hp: p.hp });
            p.shieldHp = character.ultimateShieldAmount;
            io.to(roomId).emit('playerShielded', { id: socket.id, shieldHp: p.shieldHp });
        } else if (character.ultimateType === 'great_slash') {
            io.to(roomId).emit('greatSlash', {
                id: socket.id, x: p.x, y: p.y, facing: p.facing,
                range: character.ultimateRange, width: character.ultimateWidth,
                windupMs: character.ultimateWindupMs
            });
            p.speedBoostUntil = now + character.ultimateSpeedDurationMs;
            afterWindup(roomId, socket.id, character.ultimateWindupMs, (rm, pl) => {
                if (!meleeLineHit(pl.x, pl.y, pl.facing, character.ultimateRange,
                    character.ultimateWidth, BOSS_RADIUS)) return;
                rm.bossHp = Math.max(0, rm.bossHp - stat(character, pl, 'ultimateDamage'));
                io.to(roomId).emit('bossDamaged', { bossHp: rm.bossHp, by: socket.id });
                if (rm.bossHp <= 0) { endRoom(roomId, 'win'); return; }
                if (character.ultimateHealRatio) {
                    pl.hp = Math.min(pl.maxHp, pl.hp + Math.round(pl.maxHp * character.ultimateHealRatio));
                    io.to(roomId).emit('playerHealed', { id: socket.id, hp: pl.hp });
                }
            });
        } else if (character.ultimateType === 'butterfly_mode') {
            const off = toggleButterflyMode(character, p, now);
            io.to(roomId).emit('butterflyMode', { id: socket.id, on: !off });
        } else if (character.ultimateType === 'magma_pour' || character.ultimateType === 'mark_flood') {
            const t0 = targetPoint(payload);
            if (!t0) return;
            const spot = clampToArena(t0.x, t0.y, ARENA_RADIUS);
            io.to(roomId).emit('ultimateMark', {
                id: socket.id, x: spot.x, y: spot.y, radius: character.ultimateRadius,
                element: character.element, durationMs: character.ultimateMarkDurationMs,
                damage: character.ultimateDamage || 0
            });
            markBossInCircle(roomId, room, spot.x, spot.y, character.ultimateRadius,
                character.element, ultimateMarkOpts(character), 'bossMarked');
            if (character.ultimateDamage && Math.hypot(spot.x, spot.y) <= character.ultimateRadius + BOSS_RADIUS) {
                room.bossHp = Math.max(0, room.bossHp - character.ultimateDamage);
                io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: socket.id });
                if (room.bossHp <= 0) endRoom(roomId, 'win');
            }
            // 본능해제 4강(물방울맛): 표식만 남기던 폭포/마그마 쏟기 자리에 초당 피해를 더한다.
            if (character.instinctZoneDamagePerTick) {
                room.activeBuffs.push({
                    type: 'magma_zone', casterId: socket.id, x: spot.x, y: spot.y,
                    radius: character.ultimateRadius, damage: character.instinctZoneDamagePerTick,
                    tickMs: character.instinctZoneTickMs || 1000,
                    endAt: now + character.ultimateMarkDurationMs, lastTickAt: now
                });
            }
        } else if (character.ultimateType === 'targeted_aoe') {
            const targetX = payload && payload.targetX;
            const targetY = payload && payload.targetY;
            if (typeof targetX !== 'number' || typeof targetY !== 'number' || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return;

            // Clamp the click to the arena so an off-screen/garbage click can't
            // be reported as a valid strike point.
            const dist = Math.hypot(targetX, targetY);
            const clampedDist = Math.min(dist, ARENA_RADIUS);
            const scale = dist > 0 ? clampedDist / dist : 0;
            const tx = targetX * scale, ty = targetY * scale;

            io.to(roomId).emit('ultimateImpact', { id: socket.id, x: tx, y: ty, radius: character.ultimateRadius });

            const distToBoss = Math.hypot(tx, ty);
            if (distToBoss <= character.ultimateRadius + BOSS_RADIUS) {
                room.bossHp = Math.max(0, room.bossHp - character.ultimateDamage);
                io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: socket.id });
                if (room.bossHp <= 0) endRoom(roomId, 'win');
            }
        }
        // 쿠키맛쿠키 궁극기: 원이 아니라 가로로 긴 직사각형 범위. 보스는
        // 원점에 고정이므로 지정한 자리가 그 직사각형 안에 원점을 담는지만 본다.
        else if (character.ultimateType === 'targeted_line_aoe') {
            const t0 = targetPoint(payload);
            if (!t0) return;
            const spot = clampToArena(t0.x, t0.y, ARENA_RADIUS);
            io.to(roomId).emit('ultimateLineImpact', {
                id: socket.id, x: spot.x, y: spot.y,
                width: character.ultimateWidth, height: character.ultimateHeight
            });
            const hit = Math.abs(spot.x) <= character.ultimateWidth / 2 + BOSS_RADIUS
                && Math.abs(spot.y) <= character.ultimateHeight / 2 + BOSS_RADIUS;
            if (hit) {
                room.bossHp = Math.max(0, room.bossHp - character.ultimateDamage);
                io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: socket.id });
                if (room.bossHp <= 0) { endRoom(roomId, 'win'); return; }
                healTeam(room, roomId, character.ultimateHealPerEnemy);
            }
        } else if (character.ultimateType === 'sky_slam') {
            // 지옥맛 궁극기: raid는 보스가 항상 원점이라 targeted_aoe의 텔레그래프를
            // 그대로 쓰고, 예열 뒤에 자기 자신도 그 자리로 옮겨간다.
            const targetX = payload && payload.targetX;
            const targetY = payload && payload.targetY;
            if (typeof targetX !== 'number' || typeof targetY !== 'number' || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return;
            const dist0 = Math.hypot(targetX, targetY);
            const clamped0 = Math.min(dist0, ARENA_RADIUS);
            const scale0 = dist0 > 0 ? clamped0 / dist0 : 0;
            const tx0 = targetX * scale0, ty0 = targetY * scale0;
            io.to(roomId).emit('ultimateImpact', { id: socket.id, x: tx0, y: ty0, radius: character.ultimateRadius });
            afterWindup(roomId, socket.id, character.ultimateWindupMs, (rm, pl) => {
                pl.x = tx0; pl.y = ty0;
                io.to(roomId).emit('playerTeleported', { id: socket.id, x: pl.x, y: pl.y });
                if (Math.hypot(tx0, ty0) > character.ultimateRadius + BOSS_RADIUS) return;
                rm.bossHp = Math.max(0, rm.bossHp - character.ultimateDamage);
                io.to(roomId).emit('bossDamaged', { bossHp: rm.bossHp, by: socket.id });
                if (rm.bossHp <= 0) { endRoom(roomId, 'win'); return; }
                pl.skySlamBuffUntil = Date.now() + character.ultimateAttackBuffDurationMs;
                if (character.ultimateHealRatioOnHit) {
                    pl.hp = Math.min(pl.maxHp, pl.hp + Math.round(pl.maxHp * character.ultimateHealRatioOnHit));
                    io.to(roomId).emit('playerHealed', { id: socket.id, hp: pl.hp });
                }
            });
        } else if (character.ultimateType === 'fire_line_zone') {
            // 불꽃요정맛 궁극기: 조준 없이 지금 보는 방향으로 길고 큰 화염지대를
            // 깐다. 15초 동안 유지된다.
            io.to(roomId).emit('fireLineZonePlaced', {
                id: socket.id, x: p.x, y: p.y, facing: p.facing,
                range: character.ultimateRange, width: character.ultimateWidth,
                durationMs: character.ultimateZoneDurationMs
            });
            room.activeBuffs.push({
                type: 'fire_line_zone', casterId: socket.id,
                x: p.x, y: p.y, facing: p.facing,
                range: character.ultimateRange, width: character.ultimateWidth,
                damage: character.ultimateZoneDamagePerTick,
                healPerTick: character.ultimateZoneSelfHealPerTick,
                tickMs: character.ultimateZoneTickMs,
                endAt: now + character.ultimateZoneDurationMs,
                lastTickAt: now
            });
        } else if (character.ultimateType === 'lightning_strike') {
            const targetX = payload && payload.targetX;
            const targetY = payload && payload.targetY;
            if (typeof targetX !== 'number' || typeof targetY !== 'number' || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return;
            const dist = Math.hypot(targetX, targetY);
            const clampedDist = Math.min(dist, ARENA_RADIUS);
            const scale = dist > 0 ? clampedDist / dist : 0;
            const tx = targetX * scale, ty = targetY * scale;

            io.to(roomId).emit('lightningStrike', { id: socket.id, x: tx, y: ty, radius: character.ultimateRadius });

            if (Math.hypot(tx, ty) <= character.ultimateRadius + BOSS_RADIUS) {
                room.bossHp = Math.max(0, room.bossHp - character.ultimateDamage);
                io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: socket.id });
                if (room.bossHp <= 0) { endRoom(roomId, 'win'); return; }
                // Freeze the boss mid-pattern, then leave it hitting softer.
                room.bossStunnedUntil = now + character.ultimateStunMs;
                io.to(roomId).emit('bossStunned', { until: room.bossStunnedUntil });
                room.bossDamageDebuffUntil = now + character.ultimateDebuffDurationMs;
                room.bossDamageDebuffMultiplier = character.ultimateDamageDebuffMultiplier;
            }
        } else if (character.ultimateType === 'attack_heal_boost') {
            // Read by the playerAttack handler for the duration of the buff.
            p.attackHealBoostUntil = now + character.ultimateDurationMs;
        } else if (character.ultimateType === 'awakening') {
            p.awakenUntil = now + character.ultimateDurationMs;
            // 체리크림맛: 위 스토리 모드 분기 주석 참고.
            if (character.ultimateRageChance != null) {
                p.awakenRaged = Math.random() < character.ultimateRageChance;
            }
            if (character.ultimateHealPerAttack != null || character.ultimateShieldPerAttack != null) {
                p.attackHealBoostUntil = now + character.ultimateDurationMs;
            }
            if (character.ultimateSelfHeal) {
                const healed = Math.min(p.maxHp, p.hp + character.ultimateSelfHeal);
                if (healed !== p.hp) {
                    p.hp = healed;
                    io.to(roomId).emit('playerHealed', { id: socket.id, hp: p.hp });
                }
            }
        } else if (character.ultimateType === 'magma_zone' || character.ultimateType === 'dumpling_zone') {
            const targetX = payload && payload.targetX;
            const targetY = payload && payload.targetY;
            if (typeof targetX !== 'number' || typeof targetY !== 'number' || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return;

            const dist = Math.hypot(targetX, targetY);
            const clampedDist = Math.min(dist, ARENA_RADIUS);
            const scale = dist > 0 ? clampedDist / dist : 0;
            const tx = targetX * scale, ty = targetY * scale;

            io.to(roomId).emit('magmaZonePlaced', {
                id: socket.id, x: tx, y: ty, radius: character.ultimateRadius,
                durationMs: character.ultimateZoneDurationMs, look: zoneLookOf(character)
            });

            room.activeBuffs.push(Object.assign({
                type: 'magma_zone',
                casterId: socket.id,
                x: tx, y: ty,
                radius: character.ultimateRadius,
                damage: character.ultimateZoneDamagePerTick,
                tickMs: character.ultimateZoneTickMs,
                endAt: now + character.ultimateZoneDurationMs,
                lastTickAt: now
            }, zoneMarkFields(character)));
        } else if (character.ultimateType === 'element_mark') {
            // No immediate effect -- read by the playerAttack handler, which
            // marks whatever it hits for the rest of this window.
            p.elementMarkUntil = now + character.ultimateDurationMs;
        } else if (character.ultimateType === 'awakening_rapid') {
            p.rapidStrikeUntil = now + character.ultimateDurationMs;
            p.rapidAttackCount = 0;
            if (p.awakenGear && p.awakenGear.awakenUltimateMark) {
                io.to(roomId).emit('ultimateMark', {
                    id: socket.id, x: p.x, y: p.y,
                    radius: p.awakenGear.awakenUltimateMark.radius, element: character.element
                });
                applyAwakenUltimateMark(roomId, room, p, character, 'bossMarked');
            }
        } else if (character.ultimateType === 'team_shield') {
            shieldTeam(room, roomId, character.ultimateShieldAmount);
            // 본능해제 4강(보드맛): 방어막에 회복도 얹는다.
            if (character.ultimateHealAmount) healTeam(room, roomId, character.ultimateHealAmount);
        }
        // 암흑바다맛 궁극기: 위 스토리 모드 분기 주석 참고.
        else if (character.ultimateType === 'dash_guard') {
            const land = clampToArena(p.x + Math.cos(p.facing) * character.ultimateRange,
                p.y + Math.sin(p.facing) * character.ultimateRange, ARENA_RADIUS - PLAYER_RADIUS);
            p.x = land.x; p.y = land.y;
            io.to(roomId).emit('playerTeleported', { id: socket.id, x: p.x, y: p.y });
            shieldTeam(room, roomId, character.ultimateShieldAmount);
            healTeam(room, roomId, character.ultimateHealAmount);
            if (character.ultimateZoneDamagePerTick) {
                io.to(roomId).emit('magmaZonePlaced', {
                    id: socket.id, x: p.x, y: p.y, radius: character.ultimateRadius,
                    durationMs: character.ultimateZoneDurationMs, look: zoneLookOf(character)
                });
                room.activeBuffs.push(Object.assign({
                    type: 'magma_zone',
                    casterId: socket.id,
                    x: p.x, y: p.y,
                    radius: character.ultimateRadius,
                    damage: character.ultimateZoneDamagePerTick,
                    tickMs: character.ultimateZoneTickMs,
                    endAt: now + character.ultimateZoneDurationMs,
                    lastTickAt: now
                }, zoneMarkFields(character)));
            }
        }
        // 바다 수호자맛 궁극기: 막기. 위 스토리 모드 분기 주석 참고.
        else if (character.ultimateType === 'team_hot_shield') {
            shieldTeam(room, roomId, character.ultimateShieldAmount);
            room.activeBuffs.push({
                type: 'team_heal_over_time',
                tickMs: character.ultimateTickMs,
                healPerTick: character.ultimateHealPerTick,
                endAt: now + character.ultimateDurationMs,
                lastTickAt: now
            });
        } else if (character.ultimateType === 'undying_soul') {
            p.undyingSoulUntil = now + character.ultimateDurationMs;
            const healed = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * character.ultimateHealRatio));
            if (healed !== p.hp) {
                p.hp = healed;
                io.to(roomId).emit('playerHealed', { id: socket.id, hp: p.hp });
            }
            spawnSummons(roomId, room, socket.id, character, now);
        }
        // 전기줄맛 합체: 10초 동안 상체+하체 체력을 하나로 합치고 공격력이 6이 된다.
        else if (character.ultimateType === 'body_fuse') {
            if (p.fused) return;
            const bonus = bonusOf(p);
            const upperMax = character.upperHealth + bonus.health;
            const lowerMax = character.lowerHealth + bonus.health;
            const restingHp = p.restingHp != null ? p.restingHp
                : ((p.bodyForm || 'upper') === 'upper' ? lowerMax : upperMax);
            p.fused = true;
            p.fusedUntil = now + character.ultimateDurationMs;
            p.maxHp = upperMax + lowerMax;
            p.hp = Math.min(p.maxHp, p.hp + restingHp);
            io.to(roomId).emit('bodyFormChanged', { id: socket.id, form: 'fused', hp: p.hp, maxHp: p.maxHp });
        }
    });

    socket.on('requestLeaveRaid', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.state !== 'fighting') return;
        const otherIds = Object.keys(room.players).filter(id => id !== socket.id);
        if (otherIds.length === 0) {
            endRoom(roomId, 'left');
            return;
        }
        otherIds.forEach(id => io.to(id).emit('leaveRaidRequested'));
    });

    socket.on('leaveRaidResponse', ({ accept }) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.state !== 'fighting') return;
        if (accept) {
            endRoom(roomId, 'left');
        } else {
            const otherIds = Object.keys(room.players).filter(id => id !== socket.id);
            otherIds.forEach(id => io.to(id).emit('leaveRaidRejected'));
        }
    });

    socket.on('leaveRaid', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room) return;
        delete room.players[socket.id];
        socket.leave(roomId);
        socket.data.roomId = null;
        if (Object.keys(room.players).length === 0) {
            if (room.loopHandle) clearInterval(room.loopHandle);
            delete rooms[roomId];
            return;
        }
        if (room.state === 'waiting') {
            Object.values(room.players).forEach(pl => { pl.ready = false; });
        }
        if (room.kind === 'story') {
            io.to(roomId).emit('storyRoomUpdate', {
                roomId, floor: room.floor, count: Object.keys(room.players).length,
                players: publicStoryPlayers(room)
            });
            return;
        }
        io.to(roomId).emit('raidRoomUpdate', {
            roomId, bossId: room.bossId, count: Object.keys(room.players).length,
            players: publicPlayers(room)
        });
    });

    // ---- Guest raid ----
    socket.on('joinGuestRaid', ({ guestId, party, solo, equipParty, instinctParty, charLevelParty }) => {
        if (!GUEST_BOSS_DEFS[guestId]) return;
        // Both modes bring a full party of four; only the cookie you are
        // actually controlling is ever drawn, so two players is still two
        // cookies on the field.
        const wanted = Array.isArray(party) ? party.filter(id => CHARACTERS[id]) : [];
        const chosen = wanted.slice(0, GUEST_PARTY_SIZE);
        while (chosen.length < GUEST_PARTY_SIZE) chosen.push('kicker');

        let roomId = solo ? null : findOpenGuestRoom(guestId);
        if (!roomId) roomId = createGuestRoom(guestId, solo);
        const room = rooms[roomId];
        if (room.state !== 'waiting') return;

        room.players[socket.id] = makeGuestPlayer(chosen, Object.keys(room.players).length,
            Array.isArray(equipParty) ? equipParty : [], Array.isArray(instinctParty) ? instinctParty : [],
            Array.isArray(charLevelParty) ? charLevelParty : []);
        socket.join(roomId);
        socket.data.roomId = roomId;

        io.to(roomId).emit('guestRoomUpdate', {
            roomId, guestId, count: Object.keys(room.players).length,
            players: publicGuestPlayers(room)
        });
    });

    socket.on('startGuestRaid', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (room && room.kind === 'guest') startGuestFight(roomId);
    });

    socket.on('guestPlayerReady', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'guest' || room.state !== 'waiting') return;
        const p = room.players[socket.id];
        if (!p) return;
        p.ready = true;
        io.to(roomId).emit('guestRoomUpdate', {
            roomId, guestId: room.guestId, count: Object.keys(room.players).length,
            players: publicGuestPlayers(room)
        });
        const list = Object.values(room.players);
        if (list.length >= 2 && list.every(pl => pl.ready)) startGuestFight(roomId);
    });

    socket.on('leaveGuestRaid', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'guest') return;
        delete room.players[socket.id];
        socket.leave(roomId);
        socket.data.roomId = null;
        if (Object.keys(room.players).length === 0) {
            if (room.loopHandle) clearInterval(room.loopHandle);
            delete rooms[roomId];
            return;
        }
        io.to(roomId).emit('guestRoomUpdate', {
            roomId, guestId: room.guestId, count: Object.keys(room.players).length,
            players: publicGuestPlayers(room)
        });
    });

    socket.on('guestPlayerMove', ({ x, y, facing }) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'guest' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
        // Square field, so the bounds are a box rather than a radius.
        if (Math.abs(x) > GUEST_ARENA_HALF_W + 1 || Math.abs(y) > GUEST_ARENA_HALF_H + 1) return;
        p.x = Math.max(-GUEST_ARENA_HALF_W, Math.min(GUEST_ARENA_HALF_W, x));
        p.y = Math.max(-GUEST_ARENA_HALF_H, Math.min(GUEST_ARENA_HALF_H, y));
        // 벽 가르기: while the wall is up you are penned into your own half.
        if (room.wall) {
            const edge = room.wall.y + room.wall.side * (room.wall.thickness / 2 + PLAYER_RADIUS);
            p.y = room.wall.side > 0 ? Math.max(edge, p.y) : Math.min(edge, p.y);
        }
        p.facing = facing;
    });

    // Swapping keeps the incoming cookie's hp exactly where it was left.
    socket.on('guestSwap', ({ index }) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'guest' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        if (typeof index !== 'number' || index < 0 || index >= p.party.length) return;
        if (index === p.active || !p.partyAlive[index]) return;
        bankGuestSlot(p); // the outgoing cookie keeps its damage AND its cooldowns
        activateGuestSlot(p, index);
        io.to(roomId).emit('guestSwapped', {
            id: socket.id, active: p.active, charType: p.charType,
            hp: p.hp, maxHp: p.maxHp, partyHp: p.partyHp
        });
    });

    // 2차 진입 전에 버릴 쿠키 하나. Everyone who has a choice has to make it
    // before the second raid starts.
    socket.on('guestDiscardCookie', ({ index }) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'guest' || room.state !== 'choosing') return;
        const p = room.players[socket.id];
        if (!p || p.party.length <= 1) return;
        if (typeof index !== 'number' || index < 0 || index >= p.party.length) return;
        if (room.discardChoices[socket.id] !== undefined) return; // no take-backs
        room.discardChoices[socket.id] = index;
        io.to(socket.id).emit('guestDiscardAccepted', { index, charType: p.party[index] });
        const everyone = Object.keys(room.players).every(id => room.discardChoices[id] !== undefined);
        if (everyone) startGuestPhase2(roomId);
    });

    socket.on('guestPlayerAttack', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'guest' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const character = charOf(p);
        const now = Date.now();
        // 바다 수호자맛 특수스킬로 숨어 있는 동안은 자기도 공격을 못 한다.
        if (p.untouchableUntil && now < p.untouchableUntil) return;
        const rapid = rapidStrikeActive(character, p, now);
        if (now - p.lastAttackTime < attackCooldownFor(character, p, rapid, now)) return;
        if (!consumeAmmoOrBlock(character, p, now)) return;
        p.lastAttackTime = now;
        if (character.skillType === 'guard_stance') p.guardStanceUntil = 0;
        if (character.attackType === 'throw_projectile') {
            spawnPlayerProjectile(roomId, room, socket.id, p, character, now, 'guestDropThrown');
            return;
        }
        if (character.attackType === 'homing_burst') {
            fireHomingBurst(roomId, room, socket.id, p, character, now, 'guestDropThrown');
            return;
        }
        if (character.attackType !== 'melee_kick' && character.attackType !== 'alternating_punch'
            && character.attackType !== 'combo_two_stage' && character.attackType !== 'dual_spear'
            && character.attackType !== 'vampire_slash') return;

        const swing = resolveAttack(character, p, now, rapid);
        advanceAttackSequence(character, p);
        // The boss and any summoned add are both in the way of the same swing.
        const targets = guestLineTargets(room, swing.originX, swing.originY, p.facing, swing.range, swing.width);
        if (!targets.length) return;

        // 표식이 붙어 있으면 같은 속성의 공격이 더 아프다 -- 스토리 층과 레이드는
        // 원래 그랬는데 게스트 레이드만 표식을 아예 안 보고 있었다.
        const markUse = markUseOf(character, p);
        for (const t of targets) {
            const ref = t.boss ? bossMarkTarget(room) : room.monsters[t.mid];
            const dmg = ref ? damageWithMark(ref, character, swing.damage, now, markUse) : swing.damage;
            damageGuestTargets(roomId, room, [t], dmg, socket.id);
            if (!rooms[roomId]) return;
        }
        // 치즈만두맛 패시브: 주먹 자체가 표식을 남긴다.
        const attackMarks = attackMarkChargesOf(character, p);
        if (attackMarks) {
            markGuestTargets(roomId, room, targets, character.element,
                attackMarkOpts(character, attackMarks));
        }
        const killedAny = targets.some(t => (t.boss
            ? room.bossHp <= 0
            : !(room.monsters[t.mid] && room.monsters[t.mid].alive)));
        gainKillBuffStack(character, p, killedAny, now);
        const selfHeal = passiveHitHeal(character, p) + passiveChanceHeal(character, p, swing)
            + lowHpSelfHeal(character, p)
            + vampireKillHeal(character, p, swing, killedAny);
        if (selfHeal) {
            p.hp = Math.min(p.maxHp, p.hp + selfHeal);
            p.partyHp[p.active] = p.hp;
            io.to(roomId).emit('guestPlayerHealed', { id: socket.id, hp: p.hp, partyHp: p.partyHp });
        }
        // 체리크림맛처럼 attackHealOnUse가 없어도 궁극기 중이면 게이트를 통과한다.
        const guestHealBoosted = character.ultimateHealPerAttack != null && p.attackHealBoostUntil && now < p.attackHealBoostUntil;
        if ((character.attackHealOnUse || guestHealBoosted) && Math.random() < (character.attackHealChance ?? 1)) {
            healGuestTeam(room, roomId, guestHealBoosted ? character.ultimateHealPerAttack : character.attackHealOnUse);
        }
        // 치즈케이크맛: 위 보스 레이드 분기 주석 참고.
        if (character.attackHealOverTimeOnHit) {
            room.activeBuffs.push({
                type: 'team_heal_over_time',
                tickMs: character.attackHealOverTimeTickMs,
                healPerTick: character.attackHealOverTimeOnHit,
                endAt: now + character.attackHealOverTimeDurationMs,
                lastTickAt: now
            });
        }
        if (character.attackShieldOnUse && Math.random() < (character.attackShieldChance ?? 1)) {
            addShieldGuestTeam(room, roomId, character.attackShieldOnUse);
        }
        // 체리크림맛 궁극기(분노): 위 보스 레이드 분기 주석 참고.
        if (character.ultimateShieldPerAttack && p.attackHealBoostUntil && now < p.attackHealBoostUntil) {
            addShieldGuestTeam(room, roomId, character.ultimateShieldPerAttack);
        }
        // 체리크림맛 패시브: 위 보스 레이드 분기 주석 참고.
        if (character.attackSpeedBonusOnHit) {
            io.to(roomId).emit('guestAttackSpeedBoost', { id: socket.id, until: now + character.attackSpeedBoostDurationMs });
        }
    });

    socket.on('guestPlayerSkill', (payload) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'guest' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const character = charOf(p);
        if (!character.skillType) return;
        const now = Date.now();
        if (now - p.lastSkillTime < skillCooldownFor(character, p)) return;
        p.lastSkillTime = now;
        socket.to(roomId).emit('guestPlayerSkillUsed', { id: socket.id });

        // 바람궁수맛 특수스킬: 조준 없이 즉시 발동, 팀 전체에게 초당 회복
        // 버프를 건다. team_heal_over_time 궁극기와 같은 버프를 스킬 쪽
        // 필드(skill*)로 채워서 그대로 재사용한다.
        if (character.skillType === 'team_heal_over_time') {
            room.activeBuffs.push({
                type: 'team_heal_over_time',
                tickMs: character.skillTickMs,
                healPerTick: character.skillHealPerTick,
                endAt: now + character.skillDurationMs,
                lastTickAt: now
            });
        }
        // 치즈케이크맛 특수스킬: 위 보스 레이드 분기 주석 참고. 게스트는
        // healGuestTeamByRatio(바다펄맛 밀물이 쓰는 것과 같은 함수)로 파티
        // 전체를 비율 회복시키고, 지금 나와 있는 캐릭터에만 공격력 배수
        // 버프를 건다.
        else if (character.skillType === 'team_ratio_heal_attack_buff') {
            healGuestTeamByRatio(room, roomId, character.skillHealRatio);
            for (const pl of Object.values(room.players)) {
                if (!pl.alive) continue;
                pl.attackMultiplierUntil = now + character.skillAttackBuffDurationMs;
                pl.attackMultiplierValue = character.skillAttackMultiplier;
            }
        } else if (character.skillType === 'spin_kick' || character.skillType === 'lava_burst') {
            damageGuestTargets(roomId, room,
                guestCircleTargets(room, p.x, p.y, character.skillRange), character.skillDamage, socket.id);
        } else if (character.skillType === 'guard_stance' || character.skillType === 'shield_block') {
            p.guardStanceUntil = now + character.skillDurationMs;
        } else if (character.skillType === 'kick' || character.skillType === 'flying_kick') {
            if (!character.skillDamage) return;
            damageGuestTargets(roomId, room,
                guestLineTargets(room, p.x, p.y, p.facing, character.skillRange, character.skillWidth),
                character.skillDamage, socket.id);
        }
        // 쿠키맛쿠키 특수스킬: 조준 없이 즉시 자기 체력을 채우고(적중 여부와
        // 무관), 반경 안의 부하를 얼린다. 게스트 레이드는 보스 쪽 기절
        // 파이프라인이 아예 없어서 (flying_kick·lightning_strike도 마찬가지)
        // 보스는 얼지 않는다 -- 기존에 있던 한계다.
        else if (character.skillType === 'freeze_burst') {
            p.hp = Math.min(p.maxHp, p.hp + character.skillSelfHeal);
            p.partyHp[p.active] = p.hp;
            io.to(roomId).emit('guestPlayerHealed', { id: socket.id, hp: p.hp, partyHp: p.partyHp });
            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                if (Math.hypot(p.x - m.x, p.y - m.y) - mR(m) > character.skillRange) continue;
                m.stunnedUntil = now + character.skillFreezeMs;
                io.to(roomId).emit('monsterStunned', { id: mid });
            }
        }
        // 치즈만두맛 만두 주먹: 앞에 있는 것(보스든 부하든) 전부에 표식을 박고,
        // 그 대상에 쌓여 있던 표식까지 한꺼번에 터뜨린다.
        else if (character.skillType === 'mark_punch') {
            const targets = guestLineTargets(room, p.x, p.y, p.facing, character.skillRange, character.skillWidth);
            if (!targets.length) return;
            markGuestTargets(roomId, room, targets, character.element, skillMarkOpts(character));
            let bossBurst = false;
            for (const t of targets) {
                const ref = t.boss ? bossMarkTarget(room) : room.monsters[t.mid];
                if (!ref || (!t.boss && !ref.alive)) continue;
                const burst = burstElementMarks(ref, character);
                if (burst && t.boss) bossBurst = true;
                damageGuestTargets(roomId, room, [t], character.skillDamage + burst, socket.id);
                if (!rooms[roomId]) return;
            }
            if (bossBurst) {
                io.to(roomId).emit('guestBossMarked', room.bossElementMark
                    ? {
                        element: room.bossElementMark.element,
                        charges: room.bossElementMark.charges,
                        until: room.bossElementMark.until
                    }
                    : { element: null, charges: 0 });
            }
        } else if (character.skillType === 'self_heal') {
            p.hp = Math.min(p.maxHp, p.hp + character.skillHealAmount);
            p.partyHp[p.active] = p.hp;
            io.to(roomId).emit('guestPlayerHealed', { id: socket.id, hp: p.hp, partyHp: p.partyHp });
        }
        // 지옥맛 특수스킬: 자기 체력을 채우고, 반경 안의 대상(보스·부하) 전부를
        // 때린다.
        else if (character.skillType === 'life_burst') {
            p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * character.skillHealRatio));
            p.partyHp[p.active] = p.hp;
            io.to(roomId).emit('guestPlayerHealed', { id: socket.id, hp: p.hp, partyHp: p.partyHp });
            const targets = guestCircleTargets(room, p.x, p.y, character.skillRadius);
            if (targets.length) damageGuestTargets(roomId, room, targets, character.skillDamage, socket.id);
        }
        // 불꽃요정맛 특수스킬: 방패로 막는다. 고정값 회복 + 자기 자신에게만
        // 보호막을 씌운다.
        else if (character.skillType === 'self_guard_surge') {
            p.hp = Math.min(p.maxHp, p.hp + character.skillHealAmount);
            p.shieldHp = character.skillShieldAmount;
            p.partyHp[p.active] = p.hp;
            io.to(roomId).emit('guestPlayerHealed', { id: socket.id, hp: p.hp, partyHp: p.partyHp });
            io.to(roomId).emit('guestPlayerShielded', { id: socket.id, shieldHp: p.shieldHp });
        }
        // 바다 수호자맛 특수스킬: 바다로 들어가기. 실제 무적 판정은
        // damageReductionMultiplier가 담당한다(위 스토리 모드 분기 주석 참고).
        else if (character.skillType === 'sea_hide') {
            // 파트너/다른 슬롯 쪽 무적 상태는 guestTick의 publicGuestPlayers가
            // 매번 untouchableUntil을 실어 보내므로 따로 이벤트를 안 쏴도 된다.
            p.untouchableUntil = now + character.skillDurationMs;
            p.hp = Math.min(p.maxHp, p.hp + character.skillHealAmount);
            p.partyHp[p.active] = p.hp;
            io.to(roomId).emit('guestPlayerHealed', { id: socket.id, hp: p.hp, partyHp: p.partyHp });
        } else if (character.skillType === 'spin_heal') {
            const hit = guestCircleTargets(room, p.x, p.y, character.skillRadius);
            if (hit.length) {
                damageGuestTargets(roomId, room, hit, character.skillDamage, socket.id);
                if (rooms[roomId]) healGuestTeam(room, roomId, character.skillHealOnHit);
            }
        }
        // 바다펄맛 밀물. 게스트 레이드는 보스와 부하가 같이 있으므로 찍은
        // 자리에 들어온 것 전부가 자기 체력의 비율만큼 깎인다.
        else if (character.skillType === 'tide_cycle') {
            const stage = tideStageOf(character, p);
            if (!stage) return;
            const stageNo = (p.tideStage || 0) + 1;
            const t = stage.damageRatio ? targetPoint(payload) : null;
            if (stage.damageRatio && !t) { p.lastSkillTime = 0; return; }
            const spot = t ? {
                x: Math.max(-GUEST_ARENA_HALF_W, Math.min(GUEST_ARENA_HALF_W, t.x)),
                y: Math.max(-GUEST_ARENA_HALF_H, Math.min(GUEST_ARENA_HALF_H, t.y))
            } : null;
            // 예열은 쿨타임에 들어가지 않는다.
            p.lastSkillTime = now + (stage.windupMs || 0);
            io.to(roomId).emit('guestTideCast', {
                id: socket.id, stage: stageNo, windupMs: stage.windupMs || 0,
                x: spot ? spot.x : p.x, y: spot ? spot.y : p.y, radius: character.skillRadius
            });
            afterWindup(roomId, socket.id, stage.windupMs || 0, (rm, pl) => {
                let hit = true;
                if (spot) {
                    const targets = guestCircleTargets(rm, spot.x, spot.y, character.skillRadius);
                    hit = targets.length > 0;
                    io.to(roomId).emit('guestUltimateMark',
                        { x: spot.x, y: spot.y, radius: character.skillRadius });
                    for (const tg of targets) {
                        const hpNow = tg.boss ? rm.bossHp
                            : (rm.monsters[tg.mid] && rm.monsters[tg.mid].hp);
                        if (!hpNow) continue;
                        damageGuestTargets(roomId, rm, [tg], tideDamageFor(stage, hpNow), socket.id);
                        if (!rooms[roomId]) return;
                    }
                }
                healGuestTeamByRatio(rm, roomId, stage.healRatio);
                shieldGuestTeam(rm, roomId, stage.shieldAmount);
                advanceTideStage(character, pl, hit);
                io.to(roomId).emit('guestTideStage',
                    { id: socket.id, stage: (pl.tideStage || 0) + 1, hit });
            });
        } else if (character.skillType === 'earthquake') {
            io.to(roomId).emit('guestEarthquake', { id: socket.id });
            // 지진: with a crowd on the field it kills one outright instead of
            // chipping everyone -- the same rule the story floors use.
            const adds = Object.entries(room.monsters).filter(([, m]) => m.alive);
            const enemyCount = adds.length + (room.phaseTransitioned ? 0 : 1);
            if (enemyCount > character.skillThresholdCount) {
                const victim = adds[0];
                if (victim) damageGuestMonster(roomId, room, victim[0], room.monsters[victim[0]].hp);
                else damageGuestBoss(roomId, room, character.skillDamage, socket.id);
            } else {
                damageGuestBoss(roomId, room, character.skillDamage, socket.id);
                for (const [mid] of adds) {
                    if (!rooms[roomId]) return;
                    damageGuestMonster(roomId, room, mid, character.skillDamage);
                }
            }
        } else if (character.skillType === 'pull_in') {
            io.to(roomId).emit('guestPullIn', { id: socket.id, x: p.x, y: p.y, radius: character.skillRange });
            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                if (Math.hypot(p.x - m.x, p.y - m.y) > character.skillRange + mR(m)) continue;
                const def = MONSTERS[m.type];
                if (def && def.speed > 0) {
                    const ang = Math.atan2(m.y - p.y, m.x - p.x);
                    const at = mR(m) + PLAYER_RADIUS + 6;
                    m.x = Math.max(-GUEST_ARENA_HALF_W, Math.min(GUEST_ARENA_HALF_W, p.x + Math.cos(ang) * at));
                    m.y = Math.max(-GUEST_ARENA_HALF_H, Math.min(GUEST_ARENA_HALF_H, p.y + Math.sin(ang) * at));
                } else {
                    damageGuestMonster(roomId, room, mid, character.skillDamage);
                    if (!rooms[roomId]) return;
                }
            }
            // The guest boss holds the middle and never moves, so it takes the
            // damage rather than being dragged.
            if (Math.hypot(p.x - room.bossX, p.y - room.bossY) - BOSS_RADIUS <= character.skillRange) {
                damageGuestBoss(roomId, room, character.skillDamage, socket.id);
            }
        } else if (character.skillType === 'wide_slash') {
            const hit = guestLineTargets(room, p.x, p.y, p.facing, character.skillRange, character.skillWidth);
            if (hit.length) {
                damageGuestTargets(roomId, room, hit, character.skillDamage, socket.id);
                if (rooms[roomId]) healGuestTeam(room, roomId, character.skillHealOnHit);
            }
        } else if (character.skillType === 'charge_dash') {
            const hit = guestLineTargets(room, p.x, p.y, p.facing, character.skillRange, character.skillWidth);
            const reach = hit.length ? character.skillRange * 0.6 : character.skillRange;
            p.x = Math.max(-GUEST_ARENA_HALF_W, Math.min(GUEST_ARENA_HALF_W, p.x + Math.cos(p.facing) * reach));
            p.y = Math.max(-GUEST_ARENA_HALF_H, Math.min(GUEST_ARENA_HALF_H, p.y + Math.sin(p.facing) * reach));
            io.to(roomId).emit('guestPlayerTeleported', { id: socket.id, x: p.x, y: p.y });
            if (hit.length) damageGuestTargets(roomId, room, hit.slice(0, 1), character.skillDamage, socket.id);
        } else if (character.skillType === 'burrow_mark' || character.skillType === 'mark_burst'
            || character.skillType === 'blink_heal') {
            const t = targetPoint(payload);
            if (!t) return;
            const spot = {
                x: Math.max(-GUEST_ARENA_HALF_W, Math.min(GUEST_ARENA_HALF_W, t.x)),
                y: Math.max(-GUEST_ARENA_HALF_H, Math.min(GUEST_ARENA_HALF_H, t.y))
            };
            if (character.skillType === 'burrow_mark' || character.skillType === 'blink_heal') {
                p.x = spot.x; p.y = spot.y;
                io.to(roomId).emit('guestPlayerTeleported', { id: socket.id, x: p.x, y: p.y });
            }
            if (character.skillType !== 'blink_heal') {
                io.to(roomId).emit('guestSkillMark', {
                    id: socket.id, x: spot.x, y: spot.y,
                    radius: character.skillRadius, element: character.element
                });
                markMonstersInCircle(roomId, room, spot.x, spot.y,
                    character.skillRadius, character.element, skillMarkOpts(character));
                markBossInCircle(roomId, room, spot.x, spot.y, character.skillRadius,
                    character.element, skillMarkOpts(character), 'guestBossMarked');
            }
            healSelfBySkill(character, p, () => {
                p.partyHp[p.active] = p.hp;
                io.to(roomId).emit('guestPlayerHealed', { id: socket.id, hp: p.hp, partyHp: p.partyHp });
            });
        }
        // 매직블록맛 스킬: 지점을 찍지 않고 자기 중심으로 바로 터뜨린다.
        else if (character.skillType === 'self_mark_burst') {
            io.to(roomId).emit('guestSkillMark', {
                id: socket.id, x: p.x, y: p.y,
                radius: character.skillRadius, element: character.element
            });
            markMonstersInCircle(roomId, room, p.x, p.y,
                character.skillRadius, character.element, skillMarkOpts(character));
            markBossInCircle(roomId, room, p.x, p.y, character.skillRadius,
                character.element, skillMarkOpts(character), 'guestBossMarked');
        }
        // 체리크림맛 특수스킬: 위 스토리 모드 분기 주석 참고.
        else if (character.skillType === 'self_heal_zone') {
            io.to(roomId).emit('guestMagmaZonePlaced', {
                id: socket.id, x: p.x, y: p.y, radius: character.skillRadius,
                durationMs: character.skillDurationMs, look: 'heal'
            });
            room.activeBuffs.push({
                type: 'ally_heal_zone', x: p.x, y: p.y, radius: character.skillRadius,
                healPerTick: character.skillHealPerTick, tickMs: character.skillTickMs,
                endAt: now + character.skillDurationMs, lastTickAt: now
            });
        }
        // 암흑바다맛 물속으로 데려가기: 직접 지정한 좁은 반경(skillRadius) 안의
        // 부하를 그 자리에서 기절시킨다. 게스트 레이드 보스는 raid의 보스와
        // 달리 기절 매커니즘이 없어 보스에게는 걸리지 않는다.
        else if (character.skillType === 'water_drag') {
            const t = targetPoint(payload);
            if (!t) return;
            const spot = {
                x: Math.max(-GUEST_ARENA_HALF_W, Math.min(GUEST_ARENA_HALF_W, t.x)),
                y: Math.max(-GUEST_ARENA_HALF_H, Math.min(GUEST_ARENA_HALF_H, t.y))
            };
            io.to(roomId).emit('guestSkillMark', { id: socket.id, x: spot.x, y: spot.y, radius: character.skillRadius });
            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                if (Math.hypot(spot.x - m.x, spot.y - m.y) > character.skillRadius + mR(m)) continue;
                m.stunnedUntil = now + character.skillStunMs;
                io.to(roomId).emit('monsterStunned', { id: mid });
            }
        }
        // 전기줄맛: 상체 <-> 하체 변신. 합체 중엔 못 바꾼다.
        else if (character.skillType === 'body_swap') {
            if (p.fused) return;
            const bonus = bonusOf(p);
            const toLower = (p.bodyForm || 'upper') === 'upper';
            const newForm = toLower ? 'lower' : 'upper';
            const newMax = (toLower ? character.lowerHealth : character.upperHealth) + bonus.health;
            const incomingHp = p.restingHp != null ? Math.min(newMax, p.restingHp) : newMax;
            p.restingHp = p.hp;
            p.bodyForm = newForm;
            p.hp = incomingHp;
            p.maxHp = newMax;
            syncBodyFormToParty(p);
            io.to(roomId).emit('guestBodyFormChanged', { id: socket.id, form: newForm, hp: p.hp, maxHp: p.maxHp, partyHp: p.partyHp, partyMaxHp: p.partyMaxHp });
        }
        // speed_boost is client-side only.
    });

    socket.on('guestPlayerUltimate', (payload) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'guest' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const character = charOf(p);
        if (!character.ultimateType) return;
        const now = Date.now();
        // 나비모드: while it is on, the press means "switch off".
        if (!(character.ultimateType === 'butterfly_mode' && p.butterflyOn)
            && now - p.lastUltimateTime < ultimateCooldownFor(character, p)) return;
        if (character.ultimateType !== 'butterfly_mode') p.lastUltimateTime = now;
        socket.to(roomId).emit('guestPlayerUltimateUsed', { id: socket.id });

        if (character.ultimateType === 'nature_awaken') {
            const level = natureAwakenLevelOf(p);
            if (level < 2) {
                applyNatureAwakenBuff(p, character, now, level);
                io.to(roomId).emit('natureAwaken', { id: socket.id, level: level + 1 });
            } else if (!reviveDownedGuestTeammate(roomId, room)) {
                natureGuestSanctuary(roomId, room, character, socket.id);
                io.to(roomId).emit('natureSanctuary', { id: socket.id });
            }
            advanceNatureAwakenLevel(p);
            return;
        }
        if (character.ultimateType === 'guard_surge') {
            shieldGuestTeam(room, roomId, character.ultimateShieldAmount);
            healGuestTeam(room, roomId, character.ultimateHealAmount);
            return;
        }
        if (character.ultimateType === 'team_guard') {
            for (const [id, pl] of Object.entries(room.players)) {
                if (!pl.alive) continue;
                pl.hp = Math.min(pl.maxHp, pl.hp + Math.round(pl.maxHp * character.ultimateHealRatio));
                pl.partyHp[pl.active] = pl.hp;
                io.to(roomId).emit('guestPlayerHealed', { id, hp: pl.hp, partyHp: pl.partyHp });
            }
            shieldGuestTeam(room, roomId, character.ultimateShieldAmount);
            return;
        }
        if (character.ultimateType === 'self_ratio_guard') {
            // 파핑캔디맛: team_guard와 같은 모양이지만 자기 자신에게만 건다.
            // 게스트 레이드는 항상 4명 파티라 partyHp 동기화가 필수.
            const healed = Math.round(p.maxHp * character.ultimateHealRatio);
            p.partyHp[p.active] = Math.min(p.partyMaxHp[p.active], p.partyHp[p.active] + healed);
            p.hp = p.partyHp[p.active];
            io.to(roomId).emit('guestPlayerHealed', { id: socket.id, hp: p.hp, partyHp: p.partyHp });
            p.shieldHp = character.ultimateShieldAmount;
            io.to(roomId).emit('guestPlayerShielded', { id: socket.id, shieldHp: p.shieldHp });
            return;
        }
        if (character.ultimateType === 'great_slash') {
            io.to(roomId).emit('guestGreatSlash', {
                id: socket.id, x: p.x, y: p.y, facing: p.facing,
                range: character.ultimateRange, width: character.ultimateWidth,
                windupMs: character.ultimateWindupMs
            });
            p.speedBoostUntil = now + character.ultimateSpeedDurationMs;
            afterWindup(roomId, socket.id, character.ultimateWindupMs, (rm, pl) => {
                const hit = guestLineTargets(rm, pl.x, pl.y, pl.facing,
                    character.ultimateRange, character.ultimateWidth);
                if (!hit.length) return;
                damageGuestTargets(roomId, rm, hit, stat(character, pl, 'ultimateDamage'), socket.id);
                if (!rooms[roomId] || !character.ultimateHealRatio) return;
                pl.hp = Math.min(pl.maxHp, pl.hp + Math.round(pl.maxHp * character.ultimateHealRatio));
                pl.partyHp[pl.active] = pl.hp;
                io.to(roomId).emit('guestPlayerHealed', { id: socket.id, hp: pl.hp, partyHp: pl.partyHp });
            });
            return;
        }
        if (character.ultimateType === 'butterfly_mode') {
            const off = toggleButterflyMode(character, p, now);
            io.to(roomId).emit('guestButterflyMode', { id: socket.id, on: !off });
            return;
        }
        if (character.ultimateType === 'magma_pour' || character.ultimateType === 'mark_flood') {
            const t0 = targetPoint(payload);
            if (!t0) return;
            const spot = {
                x: Math.max(-GUEST_ARENA_HALF_W, Math.min(GUEST_ARENA_HALF_W, t0.x)),
                y: Math.max(-GUEST_ARENA_HALF_H, Math.min(GUEST_ARENA_HALF_H, t0.y))
            };
            io.to(roomId).emit('guestUltimateMark', {
                id: socket.id, x: spot.x, y: spot.y, radius: character.ultimateRadius,
                element: character.element, durationMs: character.ultimateMarkDurationMs,
                damage: character.ultimateDamage || 0
            });
            markMonstersInCircle(roomId, room, spot.x, spot.y, character.ultimateRadius,
                character.element, ultimateMarkOpts(character));
            markBossInCircle(roomId, room, spot.x, spot.y, character.ultimateRadius,
                character.element, ultimateMarkOpts(character), 'guestBossMarked');
            if (character.ultimateDamage) {
                const hit = guestCircleTargets(room, spot.x, spot.y, character.ultimateRadius);
                if (hit.length) damageGuestTargets(roomId, room, hit, character.ultimateDamage, socket.id);
            }
            // 본능해제 4강(물방울맛): 표식만 남기던 폭포/마그마 쏟기 자리에 초당 피해를 더한다.
            if (character.instinctZoneDamagePerTick) {
                room.activeBuffs.push({
                    type: 'magma_zone', casterId: socket.id, x: spot.x, y: spot.y,
                    radius: character.ultimateRadius, damage: character.instinctZoneDamagePerTick,
                    tickMs: character.instinctZoneTickMs || 1000,
                    endAt: now + character.ultimateMarkDurationMs, lastTickAt: now
                });
            }
            return;
        }
        // 치즈케이크맛 궁극기: 위 보스 레이드 분기 주석 참고.
        if (character.ultimateType === 'revive_team_hot') {
            reviveDownedGuestTeammate(roomId, room);
            room.activeBuffs.push({
                type: 'team_heal_over_time', tickMs: character.ultimateTickMs,
                healPerTick: character.ultimateHealPerTick,
                endAt: now + character.ultimateDurationMs, lastTickAt: now
            });
            return;
        }

        const aimed = () => {
            const tx = payload && payload.targetX, ty = payload && payload.targetY;
            if (typeof tx !== 'number' || typeof ty !== 'number' || !Number.isFinite(tx) || !Number.isFinite(ty)) return null;
            return {
                x: Math.max(-GUEST_ARENA_HALF_W, Math.min(GUEST_ARENA_HALF_W, tx)),
                y: Math.max(-GUEST_ARENA_HALF_H, Math.min(GUEST_ARENA_HALF_H, ty))
            };
        };
        if (character.ultimateType === 'team_heal_over_time') {
            room.activeBuffs.push({
                type: 'team_heal_over_time', tickMs: character.ultimateTickMs,
                healPerTick: character.ultimateHealPerTick,
                endAt: now + character.ultimateDurationMs, lastTickAt: now
            });
        } else if (character.ultimateType === 'targeted_aoe' || character.ultimateType === 'lightning_strike') {
            const t = aimed();
            if (!t) return;
            io.to(roomId).emit('guestUltimateImpact', {
                id: socket.id, x: t.x, y: t.y, radius: character.ultimateRadius,
                bolt: character.ultimateType === 'lightning_strike'
            });
            damageGuestTargets(roomId, room,
                guestCircleTargets(room, t.x, t.y, character.ultimateRadius),
                character.ultimateDamage, socket.id);
        }
        // 쿠키맛쿠키 궁극기: 원이 아니라 가로로 긴 직사각형 범위. 맞힌 대상
        // (보스·부하 통틀어) 수만큼 팀 전체를 회복시킨다.
        else if (character.ultimateType === 'targeted_line_aoe') {
            const t = aimed();
            if (!t) return;
            io.to(roomId).emit('guestUltimateLineImpact', {
                id: socket.id, x: t.x, y: t.y,
                width: character.ultimateWidth, height: character.ultimateHeight
            });
            const targets = guestRectTargets(room, t.x, t.y,
                character.ultimateWidth / 2, character.ultimateHeight / 2);
            if (targets.length) {
                damageGuestTargets(roomId, room, targets, character.ultimateDamage, socket.id);
                if (rooms[roomId]) healGuestTeam(room, roomId, character.ultimateHealPerEnemy * targets.length);
            }
        } else if (character.ultimateType === 'sky_slam') {
            // 지옥맛 궁극기: 지정한 자리로 날아올랐다가 떨어진다.
            const t = aimed();
            if (!t) return;
            io.to(roomId).emit('guestUltimateImpact', { id: socket.id, x: t.x, y: t.y, radius: character.ultimateRadius });
            afterWindup(roomId, socket.id, character.ultimateWindupMs, (rm, pl) => {
                pl.x = t.x; pl.y = t.y;
                io.to(roomId).emit('guestPlayerTeleported', { id: socket.id, x: pl.x, y: pl.y });
                const hit = guestCircleTargets(rm, t.x, t.y, character.ultimateRadius);
                if (!hit.length) return;
                damageGuestTargets(roomId, rm, hit, character.ultimateDamage, socket.id);
                if (!rooms[roomId]) return;
                pl.skySlamBuffUntil = Date.now() + character.ultimateAttackBuffDurationMs;
                if (character.ultimateHealRatioOnHit) {
                    pl.hp = Math.min(pl.maxHp, pl.hp + Math.round(pl.maxHp * character.ultimateHealRatioOnHit));
                    pl.partyHp[pl.active] = pl.hp;
                    io.to(roomId).emit('guestPlayerHealed', { id: socket.id, hp: pl.hp, partyHp: pl.partyHp });
                }
            });
        } else if (character.ultimateType === 'fire_line_zone') {
            // 불꽃요정맛 궁극기: 조준 없이 지금 보는 방향으로 길고 큰 화염지대를
            // 깐다. 15초 동안 유지된다.
            io.to(roomId).emit('guestFireLineZonePlaced', {
                id: socket.id, x: p.x, y: p.y, facing: p.facing,
                range: character.ultimateRange, width: character.ultimateWidth,
                durationMs: character.ultimateZoneDurationMs
            });
            room.activeBuffs.push({
                type: 'fire_line_zone', casterId: socket.id,
                x: p.x, y: p.y, facing: p.facing,
                range: character.ultimateRange, width: character.ultimateWidth,
                damage: character.ultimateZoneDamagePerTick,
                healPerTick: character.ultimateZoneSelfHealPerTick,
                tickMs: character.ultimateZoneTickMs,
                endAt: now + character.ultimateZoneDurationMs,
                lastTickAt: now
            });
        } else if (character.ultimateType === 'magma_zone' || character.ultimateType === 'dumpling_zone') {
            const t = aimed();
            if (!t) return;
            io.to(roomId).emit('guestMagmaZonePlaced', {
                id: socket.id, x: t.x, y: t.y, radius: character.ultimateRadius,
                durationMs: character.ultimateZoneDurationMs, look: zoneLookOf(character)
            });
            room.activeBuffs.push(Object.assign({
                type: 'magma_zone', casterId: socket.id, x: t.x, y: t.y,
                radius: character.ultimateRadius, damage: character.ultimateZoneDamagePerTick,
                tickMs: character.ultimateZoneTickMs,
                endAt: now + character.ultimateZoneDurationMs, lastTickAt: now
            }, zoneMarkFields(character)));
        } else if (character.ultimateType === 'attack_heal_boost') {
            p.attackHealBoostUntil = now + character.ultimateDurationMs;
        } else if (character.ultimateType === 'awakening') {
            p.awakenUntil = now + character.ultimateDurationMs;
            // 체리크림맛: 위 스토리 모드 분기 주석 참고.
            if (character.ultimateRageChance != null) {
                p.awakenRaged = Math.random() < character.ultimateRageChance;
            }
            if (character.ultimateHealPerAttack != null || character.ultimateShieldPerAttack != null) {
                p.attackHealBoostUntil = now + character.ultimateDurationMs;
            }
            if (character.ultimateSelfHeal) {
                p.hp = Math.min(p.maxHp, p.hp + character.ultimateSelfHeal);
                p.partyHp[p.active] = p.hp;
                io.to(roomId).emit('guestPlayerHealed', { id: socket.id, hp: p.hp, partyHp: p.partyHp });
            }
        } else if (character.ultimateType === 'awakening_rapid') {
            p.rapidStrikeUntil = now + character.ultimateDurationMs;
            p.rapidAttackCount = 0;
            if (p.awakenGear && p.awakenGear.awakenUltimateMark) {
                io.to(roomId).emit('guestUltimateMark', {
                    id: socket.id, x: p.x, y: p.y,
                    radius: p.awakenGear.awakenUltimateMark.radius, element: character.element
                });
                applyAwakenUltimateMark(roomId, room, p, character, 'guestBossMarked');
            }
        } else if (character.ultimateType === 'team_shield') {
            shieldGuestTeam(room, roomId, character.ultimateShieldAmount);
            // 본능해제 4강(보드맛): 방어막에 회복도 얹는다.
            if (character.ultimateHealAmount) healGuestTeam(room, roomId, character.ultimateHealAmount);
        }
        // 암흑바다맛 궁극기: 위 스토리 모드 분기 주석 참고.
        else if (character.ultimateType === 'dash_guard') {
            p.x = Math.max(-GUEST_ARENA_HALF_W, Math.min(GUEST_ARENA_HALF_W, p.x + Math.cos(p.facing) * character.ultimateRange));
            p.y = Math.max(-GUEST_ARENA_HALF_H, Math.min(GUEST_ARENA_HALF_H, p.y + Math.sin(p.facing) * character.ultimateRange));
            io.to(roomId).emit('guestPlayerTeleported', { id: socket.id, x: p.x, y: p.y });
            shieldGuestTeam(room, roomId, character.ultimateShieldAmount);
            healGuestTeam(room, roomId, character.ultimateHealAmount);
            if (character.ultimateZoneDamagePerTick) {
                io.to(roomId).emit('guestMagmaZonePlaced', {
                    id: socket.id, x: p.x, y: p.y, radius: character.ultimateRadius,
                    durationMs: character.ultimateZoneDurationMs, look: zoneLookOf(character)
                });
                room.activeBuffs.push(Object.assign({
                    type: 'magma_zone',
                    casterId: socket.id,
                    x: p.x, y: p.y,
                    radius: character.ultimateRadius,
                    damage: character.ultimateZoneDamagePerTick,
                    tickMs: character.ultimateZoneTickMs,
                    endAt: now + character.ultimateZoneDurationMs,
                    lastTickAt: now
                }, zoneMarkFields(character)));
            }
        }
        // 바다 수호자맛 궁극기: 막기. 위 스토리 모드 분기 주석 참고.
        else if (character.ultimateType === 'team_hot_shield') {
            shieldGuestTeam(room, roomId, character.ultimateShieldAmount);
            room.activeBuffs.push({
                type: 'team_heal_over_time',
                tickMs: character.ultimateTickMs,
                healPerTick: character.ultimateHealPerTick,
                endAt: now + character.ultimateDurationMs,
                lastTickAt: now
            });
        } else if (character.ultimateType === 'undying_soul') {
            p.undyingSoulUntil = now + character.ultimateDurationMs;
            p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * character.ultimateHealRatio));
            p.partyHp[p.active] = p.hp;
            io.to(roomId).emit('guestPlayerHealed', { id: socket.id, hp: p.hp, partyHp: p.partyHp });
            spawnSummons(roomId, room, socket.id, character, now);
        } else if (character.ultimateType === 'element_mark') {
            p.elementMarkUntil = now + character.ultimateDurationMs;
        }
        // 전기줄맛 합체: 10초 동안 상체+하체 체력을 하나로 합치고 공격력이 6이 된다.
        else if (character.ultimateType === 'body_fuse') {
            if (p.fused) return;
            const bonus = bonusOf(p);
            const upperMax = character.upperHealth + bonus.health;
            const lowerMax = character.lowerHealth + bonus.health;
            const restingHp = p.restingHp != null ? p.restingHp
                : ((p.bodyForm || 'upper') === 'upper' ? lowerMax : upperMax);
            p.fused = true;
            p.fusedUntil = now + character.ultimateDurationMs;
            p.maxHp = upperMax + lowerMax;
            p.hp = Math.min(p.maxHp, p.hp + restingHp);
            syncBodyFormToParty(p);
            io.to(roomId).emit('guestBodyFormChanged', { id: socket.id, form: 'fused', hp: p.hp, maxHp: p.maxHp, partyHp: p.partyHp, partyMaxHp: p.partyMaxHp });
        }
    });

    // ---------------- 좀비막기 ----------------
    socket.on('joinZombieDefense', ({ charType, solo, equip, instinct, charLevel }) => {
        if (!CHARACTERS[charType]) return;
        let roomId = solo ? null : findOpenZombieRoom();
        if (!roomId) roomId = createZombieRoom(solo);
        const room = rooms[roomId];
        if (room.state !== 'waiting') return;

        room.players[socket.id] = makeZombiePlayer(charType, equip, Object.keys(room.players).length, instinct, charLevel);
        socket.join(roomId);
        socket.data.roomId = roomId;

        io.to(roomId).emit('zombieRoomUpdate', {
            roomId, count: Object.keys(room.players).length, players: publicZombiePlayers(room)
        });
    });

    socket.on('startZombieDefense', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (room && room.kind === 'zombie') startZombieFight(roomId);
    });

    socket.on('zombiePlayerReady', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'zombie' || room.state !== 'waiting') return;
        const p = room.players[socket.id];
        if (!p) return;
        p.ready = true;
        io.to(roomId).emit('zombieRoomUpdate', {
            roomId, count: Object.keys(room.players).length, players: publicZombiePlayers(room)
        });
        const list = Object.values(room.players);
        if (list.length >= 2 && list.every(pl => pl.ready)) startZombieFight(roomId);
    });

    socket.on('leaveZombieDefense', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'zombie') return;
        delete room.players[socket.id];
        socket.leave(roomId);
        socket.data.roomId = null;
        if (Object.keys(room.players).length === 0) {
            if (room.loopHandle) clearInterval(room.loopHandle);
            delete rooms[roomId];
            return;
        }
        if (room.state === 'fighting') { checkZombieWipe(roomId, room); return; }
        io.to(roomId).emit('zombieRoomUpdate', {
            roomId, count: Object.keys(room.players).length, players: publicZombiePlayers(room)
        });
    });

    socket.on('zombiePlayerMove', ({ x, y, facing }) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'zombie' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
        if (Math.abs(x) > ZOMBIE_ARENA_HALF_W + 1 || Math.abs(y) > ZOMBIE_ARENA_HALF_H + 1) return;
        p.x = x; p.y = y;
        if (typeof facing === 'number') p.facing = facing;
    });

    // 근접 공격 한 방으로 사거리 안의 좀비와 나무를 한꺼번에 때린다 -- 콤보/이도류
    // 등 캐릭터별 특수 공격 로직은 여기서는 재현하지 않고, resolveAttack이 계산한
    // 평범한 부채꼴 판정만 그대로 쓴다 (보스 상대 전용 계산인 흡혈/유도탄 등은 스킵).
    socket.on('zombiePlayerAttack', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'zombie' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const character = p.character;
        const now = Date.now();
        if (now - p.lastAttackTime < character.attackCooldown) return;
        p.lastAttackTime = now;
        const swing = resolveAttack(character, p, now, false);
        swing.damage += Math.floor(room.atkUpgradeLevel * ZOMBIE_ATK_UPGRADE_AMOUNT); // 강화대에서 산 만큼 이 판 내내 붙는다
        advanceAttackSequence(character, p);

        for (const [zid, z] of Object.entries(room.zombies)) {
            if (meleeLineHitPoint(swing.originX, swing.originY, p.facing, swing.range, swing.width, z.x, z.y, ZOMBIE_DEFS[z.type].radius)) {
                z.hp -= swing.damage;
                if (z.hp <= 0) {
                    delete room.zombies[zid];
                    room.coins += ZOMBIE_COIN_PER_KILL;
                    io.to(roomId).emit('zombieKilled', { id: zid, coins: room.coins });
                } else {
                    io.to(roomId).emit('zombieDamaged', { id: zid, hp: z.hp });
                }
            }
        }
        for (const [tid, t] of Object.entries(room.trees)) {
            if (meleeLineHitPoint(swing.originX, swing.originY, p.facing, swing.range, swing.width, t.x, t.y, ZOMBIE_TREE_RADIUS)) {
                t.hitsLeft -= 1;
                room.wood += ZOMBIE_WOOD_PER_HIT;
                if (t.hitsLeft <= 0) {
                    delete room.trees[tid];
                    room.nextTreeSpawnAt = now + ZOMBIE_TREE_RESPAWN_MS;
                    io.to(roomId).emit('zombieTreeChopped', { id: tid, gone: true, wood: room.wood });
                } else {
                    io.to(roomId).emit('zombieTreeChopped', { id: tid, gone: false, hitsLeft: t.hitsLeft, wood: room.wood });
                }
            }
        }
    });

    // 울타리/제작대/용광로/채굴기는 목록에서 고르면 바로 지을 수 있고,
    // ZOMBIE_WORKBENCH_ITEMS에 있는 것들(터렛/강화대/강화 울타리/강화 터렛)은
    // 맵 어딘가에 제작대가 하나라도 지어져 있어야만 만들 수 있다 -- 바로
    // 옆일 필요는 없고, 있기만 하면 내 근처 아무 칸에나 지을 수 있다. 그
    // 조건이 될 때만 클라이언트 목록에 뜨고, 여기서도 다시 검증한다.
    socket.on('zombieBuild', ({ type, index }) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'zombie' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        if (!Number.isInteger(index) || index < 0 || index >= ZOMBIE_CELL_COUNT) return;
        if (room.grid[index]) return;

        const needsWorkbench = !!ZOMBIE_WORKBENCH_ITEMS[type];
        const def = needsWorkbench ? ZOMBIE_WORKBENCH_ITEMS[type] : ZOMBIE_BUILDABLES[type];
        if (!def) return;
        if (room.wood < (def.wood || 0)) return;
        if (room.iron < (def.iron || 0)) return;

        const { col, row } = zombieColRowOfPos(p.x, p.y);
        const buildable = zombieBuildableCellsFrom(col, row);
        if (!buildable.includes(index)) return;
        if (needsWorkbench && !room.grid.some(c => c && c.type === 'workbench')) return;

        room.wood -= (def.wood || 0);
        room.iron -= (def.iron || 0);
        const now = Date.now();
        // 울타리는 지금까지 산 울타리 체력 강화만큼 처음부터 더 튼튼하게 지어진다.
        const hp = def.hp + (type === 'fence' ? zombieFenceHpBonus(room.fenceHpUpgradeLevel) : 0);
        let cell;
        if (def.range != null) {
            // 자동으로 공격하는 시설(터렛류/대포) -- 다음 발사 시각을 따로 든다.
            cell = { type, hp, maxHp: hp, nextAttackAt: 0 };
        } else if (type === 'miner') {
            cell = { type, hp, maxHp: hp, nextOreAt: now + ZOMBIE_MINER_ORE_INTERVAL_MS };
        } else if (type === 'furnace') {
            cell = { type, hp, maxHp: hp, nextSmeltAt: now + ZOMBIE_FURNACE_SMELT_MS };
        } else if (type === 'soldierSpawner') {
            cell = { type, hp, maxHp: hp, nextSpawnAt: now + ZOMBIE_SOLDIER_SPAWN_MS };
        } else {
            cell = { type, hp, maxHp: hp };
        }
        room.grid[index] = cell;
        io.to(roomId).emit('zombieBuilt', { index, type, wood: room.wood, iron: room.iron });
    });

    // 강화대(설치된 어느 칸이든 하나) 근처에서만 강화를 살 수 있다. 세 가지
    // 다 같은 값을 쓴다 (5코인부터, 살 때마다 5코인씩 오름) -- 이 강화들은
    // 방에 붙어 있어서 판이 끝나면(방이 사라지면) 함께 사라진다. 울타리
    // 체력은 다른 둘과 달리 전투 중 계산이 아니라 이미 지어진 울타리를
    // 그 자리에서 즉시 더 튼튼하게 만든다.
    const ZOMBIE_UPGRADE_LEVEL_KEYS = {
        attack: 'atkUpgradeLevel',
        turretAttack: 'turretAtkUpgradeLevel',
        fenceHp: 'fenceHpUpgradeLevel',
        soldierAttack: 'soldierAtkUpgradeLevel'
    };
    socket.on('zombieUpgradeStat', ({ stat }) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'zombie' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const levelKey = ZOMBIE_UPGRADE_LEVEL_KEYS[stat];
        if (!levelKey) return;

        const { col, row } = zombieColRowOfPos(p.x, p.y);
        const nearby = [zombieCellIndexOfPos(p.x, p.y), ...zombieBuildableCellsFrom(col, row)];
        if (!nearby.some(i => room.grid[i] && room.grid[i].type === 'upgradeTable')) return;

        const cost = zombieUpgradeCost(room[levelKey]);
        if (room.coins < cost) return;
        room.coins -= cost;

        if (stat === 'fenceHp') {
            // 레벨당 +0.5는 매번 정수로 안 떨어지므로, 버림 문턱을 넘을 때만
            // (예: 1강->2강처럼) 이미 지어진 울타리에 그 차액을 더한다.
            const before = zombieFenceHpBonus(room[levelKey]);
            room[levelKey]++;
            const delta = zombieFenceHpBonus(room[levelKey]) - before;
            if (delta > 0) {
                room.grid.forEach(cell => {
                    if (cell && cell.type === 'fence') {
                        cell.maxHp += delta;
                        cell.hp += delta;
                    }
                });
            }
        } else {
            room[levelKey]++;
        }

        io.to(roomId).emit('zombieStatUpgraded', { stat, level: room[levelKey], coins: room.coins });
    });

    socket.on('disconnect', () => {
        if (friendsBrowsing[socket.id]) {
            delete friendsBrowsing[socket.id];
            broadcastFriendsBrowsing();
        }
        // 이 소켓이 지금도 그 계정의 "현재 연결"로 등록돼 있을 때만 지운다 --
        // 새 탭/기기로 다시 접속해 덮어쓴 뒤라면 그 새 연결을 지우면 안 된다.
        if (socket.data.userId && onlineUsers[socket.data.userId] && onlineUsers[socket.data.userId].socketId === socket.id) {
            delete onlineUsers[socket.data.userId];
        }
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room) return;
        // PvP는 남은 한 명이 보스 없이 계속 싸울 방법이 없다 -- 상대가 나가면
        // 그 즉시 남은 쪽 승리로 끝낸다.
        if (room.kind === 'pvp') {
            const winner = Object.keys(room.players).find(id => id !== socket.id);
            endPvpRoom(roomId, winner || null);
            return;
        }
        delete room.players[socket.id];
        if (Object.keys(room.players).length === 0) {
            if (room.loopHandle) clearInterval(room.loopHandle);
            delete rooms[roomId];
            return;
        }
        if (room.state === 'waiting') {
            Object.values(room.players).forEach(pl => { pl.ready = false; });
        }
        // Don't leave the survivor frozen on a discard that will never arrive:
        // drop the leaver's slot and start 2차 once everyone left has chosen.
        if (room.kind === 'guest' && room.state === 'choosing') {
            delete room.discardChoices[socket.id];
            if (Object.keys(room.players).every(id => room.discardChoices[id] !== undefined)) {
                startGuestPhase2(roomId);
            }
            return;
        }
        if (room.kind === 'zombie') {
            if (room.state === 'fighting') { checkZombieWipe(roomId, room); return; }
            io.to(roomId).emit('zombieRoomUpdate', {
                roomId, count: Object.keys(room.players).length, players: publicZombiePlayers(room)
            });
            return;
        }
        // 스토리 방은 스토리 쪽 알림을 받아야 한다 (같이 기다리던 사람이
        // 나가면 다시 혼자 기다리는 상태로 돌아간다).
        if (room.kind === 'story') {
            io.to(roomId).emit('storyRoomUpdate', {
                roomId, floor: room.floor, count: Object.keys(room.players).length,
                players: publicStoryPlayers(room)
            });
            return;
        }
        io.to(roomId).emit('raidRoomUpdate', {
            roomId, bossId: room.bossId, count: Object.keys(room.players).length,
            players: publicPlayers(room)
        });
    });
});

const PORT = process.env.PORT || 8080;
http.listen(PORT, () => {
    console.log(`Boss Raid server listening on port ${PORT}`);
});
