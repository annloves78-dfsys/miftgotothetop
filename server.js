const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const { ARENA_RADIUS, BOSS_RADIUS, PLAYER_RADIUS, CHARACTERS, BOSS_DEFS, MONSTER_RADIUS, monsterRadiusOf, SUMMON_RADIUS, STAR_RADIUS, PROJECTILE_RADIUS, PROJECTILE_MAX_LIFETIME_MS, MONSTERS, floorDefFor,
    LEVEL_START_SLACK, alongOf, acrossOf, fromAlongAcross, clampToLane,
    GUEST_ARENA_HALF_W, GUEST_ARENA_HALF_H, GUEST_PARTY_SIZE, GUEST_BOSS_DEFS, guestDefFor,
    equipBonusFor, formStat, reviveCountFor, characterWithGear, awakenGearFor,
    awakenFloorKey, AWAKEN_PARTY_SIZE, storyPartySizeFor, AWAKEN_BOSS_LEVELS,
    awakenBossSkillDamage, awakenBossSkillHealOnHit, awakenBossUltimateDamage,
    awakenBossUltimateAttackDamage, awakenBossUltimateHealAmount, awakenBossUltimateShield,
    awakenBossSummonCount, awakenBossSummonHealth, awakenMinionMonsterType,
    boss3PhaseFor, boss3PatternStat } = require('./public/js/shared.js');

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

function shieldTeam(room, roomId, amount) {
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive) continue;
        p.shieldHp = amount;
        io.to(roomId).emit('playerShielded', { id, shieldHp: p.shieldHp });
    }
}

function publicPlayers(room) {
    const out = {};
    for (const [id, p] of Object.entries(room.players)) {
        out[id] = { x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, charType: p.charType, facing: p.facing, alive: p.alive, ready: !!p.ready, shieldHp: p.shieldHp || 0 };
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
function bonusFrom(equip, charType) {
    if (!equip || typeof equip !== 'object') return { ...NO_EQUIP_BONUS };
    return equipBonusFor(equip, charType);
}
function bonusOf(p) { return (p && p.bonus) || NO_EQUIP_BONUS; }

// 각성 장비를 낀 쿠키는 발차기 피해나 궁극기 보호막처럼 "더하기"로 표현할 수
// 없는 수치가 통째로 바뀐다. 방에 들어올 때 합쳐 둔 사본을 p.character에
// 넣어 두고, 그 뒤로는 CHARACTERS를 직접 읽지 않고 늘 이것을 읽는다.
function charFrom(charType, equip) {
    const resolved = CHARACTERS[charType] ? charType : 'kicker';
    return characterWithGear(resolved, (equip && typeof equip === 'object') ? equip : null);
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
        base = character.ultimateAttackDamage + bonusOf(p).attack;
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
    } else {
        base = stat(character, p, 'attackDamage') + bonusOf(p).attack;
    }
    return base + killBuffBonus(character, p, now) + ultimateOnHitBuff(character, p, now) + reviveAttackBonus(character, p);
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
function tickBodyFusion(room, roomId, now, ev) {
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive || !p.fused) continue;
        const character = charOf(p);
        if (!character || character.ultimateType !== 'body_fuse') continue;
        if (now < p.fusedUntil) continue;
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

// Is the awakening_rapid ultimate (orangelemon) currently active for this player?
function rapidStrikeActive(character, p, now) {
    return character.ultimateType === 'awakening_rapid' && !!p.rapidStrikeUntil && now < p.rapidStrikeUntil;
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
function attackCooldownFor(character, p, rapid) {
    if (rapid) return character.ultimateRapidCooldown;
    if (character.attackType === 'combo_two_stage' && (p.comboStage || 0) === 1) {
        return character.comboFollowupCooldown;
    }
    return character.attackCooldown;
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

    tickButterflyMode(room, now, (id, pl, dmg) => applyDamageToPlayer(roomId, id, dmg));
    if (!rooms[roomId]) return;
    tickBodyFusion(room, roomId, now, 'bodyFormChanged');

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
        out[id] = { x: pr.x, y: pr.y, vx: pr.vx, vy: pr.vy, angle: pr.angle };
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
            projectileFired: 'storyProjectileFired', projectileGone: 'storyProjectileGone'
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
            if (Math.hypot(p.x - pr.x, p.y - pr.y) <= r + PROJECTILE_RADIUS) { hitRef = p; break; }
        }

        const expired = now - pr.bornAt >= PROJECTILE_MAX_LIFETIME_MS;
        if (hitRef || expired || ctx.outOfBounds(pr)) {
            delete room.projectiles[id];
            io.to(roomId).emit(ctx.ev.projectileGone, { id, hit: !!hitRef, x: pr.x, y: pr.y });
            if (hitRef) {
                ctx.damageTarget(hitRef, pr.damage, pr.elementMark);
                if (!rooms[roomId]) return; // player died; room already torn down
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
// 부채꼴로 한 번에 쏜다. 각 발은 spawnPlayerProjectile이 homing:true로 표시하므로
// 이후 각 room의 tickPlayerProjectiles steer 콜백이 알아서 가장 가까운 목표로 튼다.
function fireHomingBurst(roomId, room, ownerId, p, character, now, ev) {
    const count = character.attackProjectileCount || 1;
    const spread = (character.attackProjectileSpreadDeg || 0) * Math.PI / 180;
    for (let i = 0; i < count; i++) {
        const offset = count > 1 ? spread * (i / (count - 1) - 0.5) : 0;
        spawnPlayerProjectile(roomId, room, ownerId, p, character, now, ev, p.facing + offset);
    }
}

// 초당 이만큼(라디안) 방향을 틀 수 있다 -- 540도/초, 유도탄이라 빠르게 꺾이지만
// 순간적으로 정반대를 보고 있으면 못 따라잡고 사거리 밖으로 빗나갈 수 있다.
const HOMING_TURN_RATE = Math.PI * 3;
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
function monsterDamageTaken(m) {
    const def = m && MONSTERS[m.type];
    return (def && def.damageTaken) || 1;
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
function monsterAttackDamage(m, def) {
    return ((def.attackDamage || 0) + ((m && m.growAttack) || 0))
        * enrageMult(m, def, 'attackMult');
}
function monsterSpeed(m, def) {
    return ((def.speed || 0) + ((m && m.growSpeed) || 0)) * enrageMult(m, def, 'speedMult');
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

// 소환(summonOnTimer): 정해진 간격마다 부하를 부른다. max까지만 부르므로
// 무한히 불어나지는 않는다.
function tickMonsterSummons(roomId, room, now) {
    for (const [, boss] of Object.entries(room.monsters)) {
        if (!boss.alive) continue;
        const sp = MONSTERS[boss.type] && MONSTERS[boss.type].summonOnTimer;
        if (!sp) continue;
        if (!boss.lastSummonAt) { boss.lastSummonAt = now; continue; }
        if (now - boss.lastSummonAt < sp.everyMs) continue;
        boss.lastSummonAt = now;
        if ((boss.summonedTotal || 0) >= sp.max) continue;
        const room0 = boss.roomIndex;
        for (let i = 0; i < (sp.count || 1); i++) {
            if ((boss.summonedTotal || 0) >= sp.max) break;
            boss.summonedTotal = (boss.summonedTotal || 0) + 1;
            const ang = (Math.PI * 2 * i) / (sp.count || 1);
            spawnStoryMonster(room, sp.type,
                boss.x + Math.cos(ang) * 55, boss.y + Math.sin(ang) * 55, room0);
        }
        io.to(roomId).emit('monsterSummoned', { x: boss.x, y: boss.y });
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
    // swing이 있는 호출만 기본공격이다 (날아간 물방울은 표식 규칙이 그대로).
    const markUse = swing ? markUseOf(character, p) : null;
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
    if (character.attackHealOnUse && Math.random() < (character.attackHealChance ?? 1)) {
        const boosted = character.ultimateType === 'attack_heal_boost' && p.attackHealBoostUntil && now < p.attackHealBoostUntil;
        healTeam(room, roomId, boosted ? character.ultimateHealPerAttack : character.attackHealOnUse);
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

    // 치즈만두맛 패시브: 궁극기와 상관없이 주먹 자체가 표식을 남긴다. swing이
    // 없는 호출(날아간 물방울)은 기본공격이 아니므로 제외된다.
    const attackMarks = swing && !killedBoss ? attackMarkChargesOf(character, p) : 0;
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

function shieldStoryTeam(room, roomId, amount) {
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive) continue;
        p.shieldHp = amount;
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
            shieldHp: p.shieldHp || 0, ready: !!p.ready
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
    if (fresh) { p.revivesUsed = 0; p.awakened = false; }
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
        if (!anyMonsterAliveInRoom(room, gate.room)) continue;
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
function attackMarkChargesOf(character, p) {
    return stat(character, p, 'attackMarkUses') || 0;
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

    tickButterflyMode(room, now, (id, pl, dmg) => applyDamageToStoryPlayer(roomId, id, dmg));
    if (!rooms[roomId]) return;
    tickBodyFusion(room, roomId, now, 'storyBodyFormChanged');

    const alivePlayers = Object.values(room.players).filter(p => p.alive);
    if (!alivePlayers.length) return; // applyDamageToStoryPlayer already ends the room on death

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

    // Thrown drops. A drop can also pop the stage's star, so 물방울맛 can
    // actually finish a floor without ever touching anything.
    const dropFloorDef = floorDefFor(room.floor);
    tickPlayerProjectiles(roomId, room, 50, (pr) => {
        for (const [mid, m] of Object.entries(room.monsters)) {
            if (!m.alive) continue;
            if (Math.hypot(pr.x - m.x, pr.y - m.y) > pr.radius + mR(m)) continue;
            const owner = room.players[pr.ownerId];
            const oc = owner ? charOf(owner) : CHARACTERS[pr.charType];
            landStoryHitOnMonster(roomId, room, mid, m, pr.ownerId, oc, pr.damage, Date.now(),
                { knockback: false, marks: pr.marks });
            if (owner && owner.alive) {
                const selfHeal = passiveHitHeal(oc, owner);
                if (selfHeal) {
                    owner.hp = Math.min(owner.maxHp, owner.hp + selfHeal);
                    io.to(roomId).emit('storyPlayerHealed', { id: pr.ownerId, hp: owner.hp });
                }
                if (oc.attackHealOnUse && Math.random() < (oc.attackHealChance ?? 1)) {
                    healStoryPlayer(room, roomId, oc.attackHealOnUse);
                }
            }
            return true;
        }
        if (dropFloorDef && dropFloorDef.star && !room.starDefeated
            && Math.hypot(pr.x - dropFloorDef.star.x, pr.y - dropFloorDef.star.y) <= pr.radius + STAR_RADIUS) {
            room.starDefeated = true;
            io.to(roomId).emit('starHit', {});
            endStoryRoom(roomId, 'win');
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
    if (!rooms[roomId]) return; // a drop just hit the star

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

function makeGuestPlayer(party, slotIndex, equipParty) {
    // 게스트 레이드는 쿠키 4명을 번갈아 쓰므로 장비도 슬롯마다 따로 가진다.
    const bonuses = party.map((id, i) => bonusFrom(equipParty && equipParty[i], id));
    const characters = party.map((id, i) => charFrom(id, equipParty && equipParty[i]));
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
            partyAlive: p.partyAlive, partyDiscarded: p.partyDiscarded, active: p.active
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

function shieldGuestTeam(room, roomId, amount) {
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive) continue;
        p.shieldHp = amount;
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
        ev: {
            telegraph: 'guestMonsterTelegraph', attack: 'guestMonsterAttack',
            defeated: 'guestMonsterDefeated', exploded: 'guestMonsterExploded',
            projectileFired: 'guestProjectileFired', projectileGone: 'guestProjectileGone'
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
    tickBodyFusion(room, roomId, now, 'guestBodyFormChanged');

    // Team buffs (the healer's ultimate) tick independently of the boss.
    if (room.activeBuffs.length) {
        room.activeBuffs = room.activeBuffs.filter(b => now < b.endAt);
        for (const buff of room.activeBuffs) {
            if (now - buff.lastTickAt < buff.tickMs) continue;
            buff.lastTickAt += buff.tickMs;
            if (buff.type === 'team_heal_over_time') healGuestTeam(room, roomId, buff.healPerTick);
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
        if (owner && owner.alive) {
            const oc = charOf(owner);
            const selfHeal = passiveHitHeal(oc, owner);
            if (selfHeal) {
                owner.hp = Math.min(owner.maxHp, owner.hp + selfHeal);
                owner.partyHp[owner.active] = owner.hp;
                io.to(roomId).emit('guestPlayerHealed', { id: pr.ownerId, hp: owner.hp, partyHp: owner.partyHp });
            }
            if (oc.attackHealOnUse && Math.random() < (oc.attackHealChance ?? 1)) {
                healGuestTeam(room, roomId, oc.attackHealOnUse);
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

        const mctx = guestMonsterCtx(roomId, room);
        const gTargets = aliveTargetsOf(room);
        tickMonsterSet(mctx, gTargets, now);
        if (!rooms[roomId]) return;
        tickMonsterProjectiles(mctx, gTargets, 50);
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

io.on('connection', (socket) => {
    socket.on('joinRaid', ({ bossId, charType, solo, equip }) => {
        if (!BOSS_DEFS[bossId]) return;
        const character = charFrom(charType, equip);
        const bonus = bonusFrom(equip, charType);

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
    // floorDefFor가 넓은 마당과 보스 한 마리를 만들어 준다. 다른 점은
    // 쿠키 3명을 데려가고, 하나가 쓰러지면 다음 쿠키가 들어온다는 것뿐이다.
    socket.on('joinAwakenBoss', ({ charType, level, party, equipParty }) => {
        // 레벨은 여기서 자르지 않고 그대로 본다. awakenFloorKey는 범위를 넘는
        // 값을 10으로 맞추는데, 그러면 99를 보낸 사람이 10레벨을 받게 된다.
        if (!AWAKEN_BOSS_LEVELS[Number(level)]) return;
        const floor = awakenFloorKey(charType, level);
        const floorDef = floorDefFor(floor);
        if (!floorDef) return;

        const wanted = Array.isArray(party) ? party.filter(id => CHARACTERS[id]) : [];
        const chosen = wanted.slice(0, AWAKEN_PARTY_SIZE);
        while (chosen.length < AWAKEN_PARTY_SIZE) chosen.push('kicker');

        const roomId = createStoryRoom(floor, true);
        const room = rooms[roomId];
        spawnStoryMonsters(room, floorDef);

        const bonuses = chosen.map((id, i) => bonusFrom(equipParty && equipParty[i], id));
        const characters = chosen.map((id, i) => charFrom(id, equipParty && equipParty[i]));
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
        socket.join(roomId);
        socket.data.roomId = roomId;
        startStoryFight(roomId);
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

    socket.on('joinStoryFloor', ({ floor, charType, equip, solo, party, equipParty }) => {
        const floorDef = floorDefFor(floor);
        if (!floorDef) return; // no content for this floor yet
        const character = charFrom(charType, equip);
        const bonus = bonusFrom(equip, charType);

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
        // 11층부터는 쿠키 두 명을 데려간다. 각성모드와 같은 파티 구조를 쓰므로
        // 교체·죽음·부활이 전부 그대로 돌아간다.
        const partySize = storyPartySizeFor(floor);
        if (partySize > 1) {
            const wanted = Array.isArray(party) ? party.filter(id => CHARACTERS[id]) : [];
            const chosen = wanted.slice(0, partySize);
            // 빈 자리는 고른 쿠키(없으면 자두맛)로 채운다.
            const fallback = (charType && CHARACTERS[charType]) ? charType : 'kicker';
            while (chosen.length < partySize) chosen.push(fallback);
            const equips = Array.isArray(equipParty) ? equipParty : [];
            const bonuses = chosen.map((id, i) => bonusFrom(equips[i], id));
            const characters = chosen.map((id, i) => charFrom(id, equips[i]));
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
        if (Math.abs(across) > floorDef.laneHalfWidth + 1) return;

        // Energy-shield gates: once inside (or moving into) a room, neither
        // of its edges can be crossed until every monster in that room is
        // dead. A floor can have several rooms back to back (see `gates`);
        // each is checked independently against the (possibly already
        // reclamped) position, since only one room's shield is ever actually
        // up at any given point along the bridge.
        if (floorDef.gates) {
            const wasAlong = alongOf(floorDef, p.x, p.y);
            for (const gate of floorDef.gates) {
                if (!anyMonsterAliveInRoom(room, gate.room)) continue;
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
        const rapid = rapidStrikeActive(character, p, now);
        const cooldown = attackCooldownFor(character, p, rapid);
        if (now - p.lastAttackTime < cooldown) return;
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
        if (anyHit && character.attackHealOnUse && Math.random() < (character.attackHealChance ?? 1)) {
            const boosted = character.ultimateType === 'attack_heal_boost' && p.attackHealBoostUntil && now < p.attackHealBoostUntil;
            healStoryPlayer(room, roomId, boosted ? character.ultimateHealPerAttack : character.attackHealOnUse);
        }

        if (floorDef.star && !room.starDefeated) {
            // Must use the resolved swing, not character.attackRange/Width --
            // multi-stage attacks (combo_two_stage) leave those undefined, which
            // made the star impossible to hit.
            if (meleeLineHitPoint(swing.originX, swing.originY, p.facing, swing.range, swing.width, floorDef.star.x, floorDef.star.y, STAR_RADIUS)) {
                room.starDefeated = true;
                io.to(roomId).emit('starHit', {});
                endStoryRoom(roomId, 'win');
            }
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

        if (character.skillType === 'spin_kick' || character.skillType === 'lava_burst') {
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

        if (character.ultimateType === 'team_heal_over_time') {
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
        const rapid = rapidStrikeActive(character, p, now);
        const cooldown = attackCooldownFor(character, p, rapid);
        if (now - p.lastAttackTime < cooldown) return;
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

        if (character.skillType === 'pull_in') {
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

        if (character.ultimateType === 'team_heal_over_time') {
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
    socket.on('joinGuestRaid', ({ guestId, party, solo, equipParty }) => {
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
            Array.isArray(equipParty) ? equipParty : []);
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
        const rapid = rapidStrikeActive(character, p, now);
        if (now - p.lastAttackTime < attackCooldownFor(character, p, rapid)) return;
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
        if (character.attackHealOnUse && Math.random() < (character.attackHealChance ?? 1)) {
            const boosted = character.ultimateType === 'attack_heal_boost' && p.attackHealBoostUntil && now < p.attackHealBoostUntil;
            healGuestTeam(room, roomId, boosted ? character.ultimateHealPerAttack : character.attackHealOnUse);
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

        if (character.skillType === 'spin_kick' || character.skillType === 'lava_burst') {
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

    socket.on('disconnect', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room) return;
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
