const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const { ARENA_RADIUS, BOSS_RADIUS, PLAYER_RADIUS, CHARACTERS, BOSS_DEFS, MONSTER_RADIUS, STAR_RADIUS, PROJECTILE_RADIUS, PROJECTILE_MAX_LIFETIME_MS, MONSTERS, STORY_FLOOR_DEFS,
    LEVEL_START_SLACK, alongOf, acrossOf, fromAlongAcross, clampToLane,
    GUEST_ARENA_HALF_W, GUEST_ARENA_HALF_H, GUEST_PARTY_SIZE, GUEST_BOSS_DEFS, guestDefFor } = require('./public/js/shared.js');

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
        return character.skillDamageMultiplier;
    }
    if (character.ultimateType === 'awakening' && p.awakenUntil && now < p.awakenUntil) {
        return character.ultimateDamageMultiplier;
    }
    if (character.passiveResistElement && sourceElementMark && sourceElementMark.element === character.passiveResistElement) {
        return character.passiveResistMultiplier;
    }
    return 1;
}

// awakening temporarily replaces the basic attack's damage; every other
// character just uses their flat attackDamage.
function effectiveAttackDamage(character, p, now) {
    if (character.ultimateType === 'awakening' && p.awakenUntil && now < p.awakenUntil && character.ultimateAttackDamage != null) {
        return character.ultimateAttackDamage;
    }
    // undying_soul (lightninghell) swaps in a bigger basic attack the same way.
    if (character.ultimateType === 'undying_soul' && p.undyingSoulUntil && now < p.undyingSoulUntil
        && character.ultimateAttackDamage != null) {
        return character.ultimateAttackDamage;
    }
    return character.attackDamage;
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
    return (p.punchSequence % 2 === 1) ? character.attackDamageRight : character.attackDamageLeft;
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
function tryRevive(p, character) {
    if (!character.passiveReviveCount) return false;
    if ((p.revivesUsed || 0) >= character.passiveReviveCount) return false;
    p.revivesUsed = (p.revivesUsed || 0) + 1;
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
function applyReviveBlastToBoss(roomId, room, character, playerId) {
    const ratio = reviveBlastRatio(character, 1);
    if (!ratio || room.bossHp <= 0) return;
    const dmg = Math.max(1, Math.round(room.bossHp * ratio));
    room.bossHp = Math.max(0, room.bossHp - dmg);
    io.to(roomId).emit('reviveBlast', { id: playerId, ratio, damage: dmg });
    io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp });
    if (room.bossHp <= 0) endRoom(roomId, 'win');
}

function applyReviveBlastToMonsters(roomId, room, character, playerId) {
    const alive = Object.entries(room.monsters).filter(([, m]) => m.alive);
    const ratio = reviveBlastRatio(character, alive.length);
    if (!ratio) return;
    io.to(roomId).emit('storyReviveBlast', { id: playerId, ratio, count: alive.length });
    for (const [mid, m] of alive) {
        const dmg = Math.max(1, Math.round(m.hp * ratio));
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
    const character = CHARACTERS[p.charType];
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
        revived = tryRevive(p, character);
        if (!revived) p.alive = false;
    }
    io.to(roomId).emit('playerDamaged', { id: playerId, hp: p.hp, alive: p.alive, shieldHp: p.shieldHp || 0, ...(extra || {}) });
    if (revived) {
        io.to(roomId).emit('playerRevived', { id: playerId, hp: p.hp });
        applyReviveBlastToBoss(roomId, room, character, playerId);
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
                        if (room.bossHp <= 0) endRoom(roomId, 'win');
                    }
                }
            }
        }
    }

    if (room.bossStunnedUntil && now < room.bossStunnedUntil) return; // frozen: no pattern progression at all

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
// A parallel, much simpler system from the boss-raid rooms above: solo-only,
// no matchmaking/ready-check, a line of weak monsters instead of one boss
// with patterns. Shares the `rooms` dict and reuses leaveRaid/disconnect
// as-is (a story room always has exactly 1 player, so those generic handlers
// already clean it up correctly without any story-specific code).

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

function createStoryRoom(floor) {
    const roomId = `story${floor}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    rooms[roomId] = {
        kind: 'story',
        floor,
        state: 'fighting',
        players: {},
        monsters: {},
        projectiles: {}, // id -> arrow in flight; see spawnMonsterProjectile
        nextProjectileId: 0,
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

function publicMonsters(room) {
    const out = {};
    for (const [id, m] of Object.entries(room.monsters)) {
        out[id] = { type: m.type, x: m.x, y: m.y, hp: m.hp, maxHp: m.maxHp, alive: m.alive, state: m.state, room: m.roomIndex, elementMark: m.elementMark,
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
function storyMonsterCtx(roomId, room) {
    const floorDef = STORY_FLOOR_DEFS[room.floor];
    return {
        roomId, room, floorDef,
        damagePlayer: (playerId, dmg, mark) => applyDamageToStoryPlayer(roomId, playerId, dmg, mark),
        clamp: (m) => { if (floorDef) { const k = clampToLane(floorDef, m.x, m.y); m.x = k.x; m.y = k.y; } },
        // A raised shield stops an EMPLACEMENT firing through it; see shieldBetween.
        sightBlocked: (m, target, def) => def.speed === 0 && !!floorDef && shieldBetween(room, floorDef, m, target),
        outOfBounds: (pr) => !!floorDef && (pr.x > 200 || pr.x < -floorDef.levelLength - 200
            || Math.abs(pr.y) > floorDef.laneHalfWidth + 200),
        ev: {
            telegraph: 'monsterTelegraph', attack: 'monsterAttack',
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

        let hitPlayerId = null;
        for (const p of alivePlayers) {
            if (Math.hypot(p.x - pr.x, p.y - pr.y) <= PLAYER_RADIUS + PROJECTILE_RADIUS) {
                hitPlayerId = Object.keys(room.players).find(pid => room.players[pid] === p);
                break;
            }
        }

        const expired = now - pr.bornAt >= PROJECTILE_MAX_LIFETIME_MS;
        if (hitPlayerId || expired || ctx.outOfBounds(pr)) {
            delete room.projectiles[id];
            io.to(roomId).emit(ctx.ev.projectileGone, { id, hit: !!hitPlayerId, x: pr.x, y: pr.y });
            if (hitPlayerId) {
                ctx.damagePlayer(hitPlayerId, pr.damage, pr.elementMark);
                if (!rooms[roomId]) return; // player died; room already torn down
            }
        }
    }
}

function healStoryPlayer(room, roomId, amount) {
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive) continue;
        const healed = Math.min(p.maxHp, p.hp + amount);
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

function endStoryRoom(roomId, result) {
    const room = rooms[roomId];
    if (!room) return;
    if (room.loopHandle) clearInterval(room.loopHandle);
    room.state = 'ended';
    io.to(roomId).emit('storyFloorResult', { result, floor: room.floor });
    delete rooms[roomId];
}

function applyDamageToStoryPlayer(roomId, playerId, dmg, sourceElementMark) {
    const room = rooms[roomId];
    if (!room) return;
    const p = room.players[playerId];
    if (!p || !p.alive) return;
    const character = CHARACTERS[p.charType];
    dmg = Math.round(dmg * damageReductionMultiplier(character, p, Date.now(), sourceElementMark));
    if (p.shieldHp > 0) {
        const absorbed = Math.min(p.shieldHp, dmg);
        p.shieldHp -= absorbed;
        dmg -= absorbed;
    }
    p.hp = Math.max(0, p.hp - dmg);
    let revived = false;
    if (p.hp <= 0) {
        revived = tryRevive(p, character);
        if (!revived) p.alive = false;
    }
    io.to(roomId).emit('storyPlayerDamaged', { id: playerId, hp: p.hp, alive: p.alive, shieldHp: p.shieldHp || 0 });
    if (revived) {
        io.to(roomId).emit('storyPlayerRevived', { id: playerId, hp: p.hp });
        applyReviveBlastToMonsters(roomId, room, character, playerId);
        return;
    }
    if (!p.alive) endStoryRoom(roomId, 'lose');
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
        m.nextAttackAt = now + def.attackCooldown;
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
        const targetId = Object.keys(room.players).find(id => room.players[id] === p);
        ctx.damagePlayer(targetId, def.laserDamage * outgoingDamageMultiplier(m, now), m.elementMark);
        if (!rooms[roomId]) return; // that hit may have ended the floor
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
            m.nextAttackAt = now + def.attackCooldown;
            continue;
        }
        if (m.state === 'idle' && nearestDist > def.aggroRange) continue; // dormant until approached

        if (m.state === 'idle') {
            // Kites the nearest player: closes in if too far, backs off if the
            // player gets right up next to it, hovering at preferredDistance
            // instead of standing adjacent like a melee mob would.
            const step = def.speed * 3; // ~px per 50ms tick
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
                m.nextAttackAt = now + def.attackCooldown;
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
                m.nextAttackAt = now + def.attackCooldown;
                const d = Math.hypot(nearest.x - m.x, nearest.y - m.y);
                if (def.projectileSpeed) {
                    // Archers release an arrow regardless of current range: it
                    // flies to where the player was and can be sidestepped.
                    io.to(roomId).emit(ctx.ev.attack, { id: mid });
                    spawnMonsterProjectile(ctx, mid, m, def, nearest.x, nearest.y);
                } else if (d <= def.attackRange) {
                    const targetId = Object.keys(room.players).find(id => room.players[id] === nearest);
                    io.to(roomId).emit(ctx.ev.attack, { id: mid });
                    ctx.damagePlayer(targetId, def.attackDamage * outgoingDamageMultiplier(m, now), m.elementMark);
                    if (!rooms[roomId]) return;
                }
            }
        }
    }
}

function tickStoryRoom(roomId) {
    const room = rooms[roomId];
    if (!room || room.state !== 'fighting') return;
    const now = Date.now();

    const alivePlayers = Object.values(room.players).filter(p => p.alive);
    if (!alivePlayers.length) return; // applyDamageToStoryPlayer already ends the room on death

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
                        const dist = Math.hypot(caster.x - m.x, caster.y - m.y) - MONSTER_RADIUS;
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
                    if (Math.hypot(buff.x - m.x, buff.y - m.y) <= buff.radius + MONSTER_RADIUS) {
                        m.hp = Math.max(0, m.hp - buff.damage);
                        if (m.hp <= 0) { m.alive = false; io.to(roomId).emit('monsterDefeated', { id: mid }); }
                        else io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
                    }
                }
            }
        }
    }

    const ctx = storyMonsterCtx(roomId, room);
    tickMonsterSet(ctx, alivePlayers, now);

    if (!rooms[roomId]) return; // room may have just ended (player died) mid-loop above
    tickMonsterProjectiles(ctx, alivePlayers, 50);
    if (!rooms[roomId]) return; // an arrow may have just killed the last player
    io.to(roomId).emit('storyTick', { monsters: publicMonsters(room), projectiles: publicProjectiles(room) });
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
    const slot = p.partySlotTimers[index];
    GUEST_SLOT_TIMERS.forEach(f => { p[f] = slot[f] || 0; });
}

function makeGuestPlayer(party, slotIndex) {
    const maxHp = party.map(id => CHARACTERS[id].health);
    const p = {
        party,
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

function shieldGuestTeam(room, roomId, amount) {
    for (const [id, p] of Object.entries(room.players)) {
        if (!p.alive) continue;
        p.shieldHp = amount;
        io.to(roomId).emit('guestPlayerShielded', { id, shieldHp: p.shieldHp });
    }
}

function applyDamageToGuestPlayer(roomId, playerId, dmg) {
    const room = rooms[roomId];
    if (!room || room.state !== 'fighting') return;
    const p = room.players[playerId];
    if (!p || !p.alive) return;
    const character = CHARACTERS[p.charType];
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
        const slotState = { hp: p.hp, maxHp: p.maxHp, revivesUsed: p.partyRevivesUsed[p.active], alive: true };
        revived = tryRevive(slotState, character);
        if (revived) {
            p.hp = slotState.hp;
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
    if (revived) io.to(roomId).emit('guestPlayerRevived', { id: playerId, hp: p.hp });
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
        clamp: (m) => {
            m.x = Math.max(-GUEST_ARENA_HALF_W, Math.min(GUEST_ARENA_HALF_W, m.x));
            m.y = Math.max(-GUEST_ARENA_HALF_H, Math.min(GUEST_ARENA_HALF_H, m.y));
        },
        sightBlocked: () => false,
        outOfBounds: (pr) => Math.abs(pr.x) > GUEST_ARENA_HALF_W + 200
            || Math.abs(pr.y) > GUEST_ARENA_HALF_H + 200,
        ev: {
            telegraph: 'guestMonsterTelegraph', attack: 'guestMonsterAttack',
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
        if (meleeLineHitPoint(originX, originY, facing, range, width, m.x, m.y, MONSTER_RADIUS)) out.push({ mid });
    }
    return out;
}

function guestCircleTargets(room, x, y, radius) {
    const out = [];
    const def = guestDefFor(room);
    if (Math.hypot(x - room.bossX, y - room.bossY) <= radius + def.radius) out.push({ boss: true });
    for (const [mid, m] of Object.entries(room.monsters)) {
        if (!m.alive) continue;
        if (Math.hypot(x - m.x, y - m.y) <= radius + MONSTER_RADIUS) out.push({ mid });
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

    // Team buffs (the healer's ultimate) tick independently of the boss.
    if (room.activeBuffs.length) {
        room.activeBuffs = room.activeBuffs.filter(b => now < b.endAt);
        for (const buff of room.activeBuffs) {
            if (now - buff.lastTickAt < buff.tickMs) continue;
            buff.lastTickAt += buff.tickMs;
            if (buff.type === 'team_heal_over_time') healGuestTeam(room, roomId, buff.healPerTick);
            else if (buff.type === 'magma_zone') {
                damageGuestTargets(roomId, room,
                    guestCircleTargets(room, buff.x, buff.y, buff.radius), buff.damage, buff.casterId);
                if (!rooms[roomId]) return;
            }
        }
    }

    // Summoned adds (2차) live in the same room and fight on their own clock.
    if (Object.keys(room.monsters).length) {
        const mctx = guestMonsterCtx(roomId, room);
        tickMonsterSet(mctx, guestAlivePlayers(room), now);
        if (!rooms[roomId]) return;
        tickMonsterProjectiles(mctx, guestAlivePlayers(room), 50);
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
    socket.on('joinRaid', ({ bossId, charType, solo }) => {
        if (!BOSS_DEFS[bossId]) return;
        const character = CHARACTERS[charType] || CHARACTERS.kicker;

        let roomId = solo ? null : findOpenRoom(bossId);
        if (!roomId) roomId = createRoom(bossId, solo);
        const room = rooms[roomId];

        const slotIndex = Object.keys(room.players).length;
        const pos = spawnPosition(slotIndex);
        room.players[socket.id] = {
            x: pos.x, y: pos.y,
            hp: character.health, maxHp: character.health,
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

    socket.on('joinStoryFloor', ({ floor, charType }) => {
        const floorDef = STORY_FLOOR_DEFS[floor];
        if (!floorDef) return; // no content for this floor yet
        const character = CHARACTERS[charType] || CHARACTERS.kicker;

        const roomId = createStoryRoom(floor);
        const room = rooms[roomId];
        spawnStoryMonsters(room, floorDef);

        room.players[socket.id] = {
            x: 0, y: 0,
            hp: character.health, maxHp: character.health,
            charType: charType && CHARACTERS[charType] ? charType : 'kicker',
            facing: Math.PI, // faces left, toward the bridge
            alive: true, lastAttackTime: 0, lastSkillTime: 0, lastUltimateTime: 0, attackHealBoostUntil: 0
        };

        socket.join(roomId);
        socket.data.roomId = roomId;

        io.to(roomId).emit('storyFloorStarted', {
            floor,
            floorDef: {
                // axis matters to every clamp/camera/draw on the client, so it
                // has to travel with the rest of the layout.
                axis: floorDef.axis,
                levelLength: floorDef.levelLength,
                laneHalfWidth: floorDef.laneHalfWidth,
                gates: floorDef.gates,
                star: floorDef.star
            },
            player: room.players[socket.id],
            monsters: publicMonsters(room),
            projectiles: publicProjectiles(room)
        });

        room.loopHandle = setInterval(() => tickStoryRoom(roomId), 50);
    });

    socket.on('storyPlayerMove', ({ x, y, facing }) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'story') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const floorDef = STORY_FLOOR_DEFS[room.floor];
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
        const character = CHARACTERS[p.charType];
        const now = Date.now();
        const rapid = rapidStrikeActive(character, p, now);
        const cooldown = attackCooldownFor(character, p, rapid);
        if (now - p.lastAttackTime < cooldown) return;
        p.lastAttackTime = now;
        if (character.attackType !== 'melee_kick' && character.attackType !== 'alternating_punch'
            && character.attackType !== 'combo_two_stage' && character.attackType !== 'dual_spear') return;
        if (character.skillType === 'guard_stance') p.guardStanceUntil = 0; // attacking breaks guard

        let anyHit = false;
        const swing = resolveAttack(character, p, now, rapid);
        const baseAttackDamage = swing.damage;
        advanceAttackSequence(character, p);
        const floorDef = STORY_FLOOR_DEFS[room.floor];
        for (const [mid, m] of Object.entries(room.monsters)) {
            if (!m.alive) continue;
            if (meleeLineHitPoint(swing.originX, swing.originY, p.facing, swing.range, swing.width, m.x, m.y, MONSTER_RADIUS)) {
                anyHit = true;

                // Element mark: a matching-element attacker deals bonus
                // damage vs a marked monster and burns down one charge.
                const dmg = Math.round(baseAttackDamage * consumeElementMark(m, character, now));

                m.hp = Math.max(0, m.hp - dmg);
                if (m.hp <= 0) {
                    m.alive = false;
                    io.to(roomId).emit('monsterDefeated', { id: mid });
                } else {
                    io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
                    if (character.attackBurnDamage) {
                        room.activeBuffs.push({
                            type: 'attack_burn',
                            casterId: socket.id,
                            targetMonsterId: mid,
                            damage: character.attackBurnDamage,
                            tickMs: character.attackBurnIntervalMs,
                            ticksLeft: character.attackBurnTicks,
                            lastTickAt: now,
                            endAt: now + character.attackBurnIntervalMs * character.attackBurnTicks + 200
                        });
                    }

                    // Shove the target back (the boss doesn't have this --
                    // it's fixed in place -- so this only ever fires here).
                    if (character.attackKnockback) {
                        const dx = m.x - p.x, dy = m.y - p.y;
                        const kdist = Math.hypot(dx, dy) || 1;
                        let nx = m.x + (dx / kdist) * character.attackKnockback;
                        let ny = m.y + (dy / kdist) * character.attackKnockback;
                        if (nx > 40) nx = 40;
                        if (nx < -floorDef.levelLength) nx = -floorDef.levelLength;
                        if (ny > floorDef.laneHalfWidth) ny = floorDef.laneHalfWidth;
                        if (ny < -floorDef.laneHalfWidth) ny = -floorDef.laneHalfWidth;
                        m.x = nx; m.y = ny;
                    }

                    // While the ultimate window is active, a landed attack marks
                    // the target -- unless something else already marked it.
                    if (p.elementMarkUntil && now < p.elementMarkUntil) {
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
                }
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

    socket.on('storyPlayerSkill', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'story' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const character = CHARACTERS[p.charType];
        if (!character.skillType) return;
        const now = Date.now();
        if (now - p.lastSkillTime < character.skillCooldown) return;
        p.lastSkillTime = now;

        socket.to(roomId).emit('playerSkillUsed', { id: socket.id });

        if (character.skillType === 'spin_kick' || character.skillType === 'lava_burst') {
            // lava_burst (volcano cookie) uses the exact same self-centered AoE shape.
            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                const dist = Math.hypot(p.x - m.x, p.y - m.y) - MONSTER_RADIUS;
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
                if (meleeLineHitPoint(p.x, p.y, p.facing, character.skillRange, character.skillWidth, m.x, m.y, MONSTER_RADIUS)) {
                    m.stunnedUntil = now + character.skillStunMs;
                    io.to(roomId).emit('monsterStunned', { id: mid });
                }
            }
        } else if (character.skillType === 'kick') {
            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                if (meleeLineHitPoint(p.x, p.y, p.facing, character.skillRange, character.skillWidth, m.x, m.y, MONSTER_RADIUS)) {
                    m.hp = Math.max(0, m.hp - character.skillDamage);
                    if (m.hp <= 0) {
                        m.alive = false;
                        io.to(roomId).emit('monsterDefeated', { id: mid });
                    } else {
                        io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
                    }
                }
            }
        } else if (character.skillType === 'self_heal') {
            const healed = Math.min(p.maxHp, p.hp + character.skillHealAmount);
            if (healed !== p.hp) {
                p.hp = healed;
                io.to(roomId).emit('storyPlayerHealed', { id: socket.id, hp: p.hp });
            }
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
        // speed_boost is purely client-side; nothing more to do here.
    });

    socket.on('storyPlayerUltimate', (payload) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'story' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const character = CHARACTERS[p.charType];
        if (!character.ultimateType) return;
        const now = Date.now();
        if (now - p.lastUltimateTime < character.ultimateCooldownMs) return;
        p.lastUltimateTime = now;

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
            const floorDef = STORY_FLOOR_DEFS[room.floor];
            const t = clampToLane(floorDef, targetX, targetY);
            const tx = t.x, ty = t.y;

            io.to(roomId).emit('storyUltimateImpact', { id: socket.id, x: tx, y: ty, radius: character.ultimateRadius });

            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                if (Math.hypot(tx - m.x, ty - m.y) <= character.ultimateRadius + MONSTER_RADIUS) {
                    m.hp = Math.max(0, m.hp - character.ultimateDamage);
                    if (m.hp <= 0) {
                        m.alive = false;
                        io.to(roomId).emit('monsterDefeated', { id: mid });
                    } else {
                        io.to(roomId).emit('monsterDamaged', { id: mid, hp: m.hp });
                    }
                }
            }
        } else if (character.ultimateType === 'lightning_strike') {
            const targetX = payload && payload.targetX;
            const targetY = payload && payload.targetY;
            if (typeof targetX !== 'number' || typeof targetY !== 'number' || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return;
            const floorDef = STORY_FLOOR_DEFS[room.floor];
            const t = clampToLane(floorDef, targetX, targetY);
            const tx = t.x, ty = t.y;

            io.to(roomId).emit('storyLightningStrike', { id: socket.id, x: tx, y: ty, radius: character.ultimateRadius });

            for (const [mid, m] of Object.entries(room.monsters)) {
                if (!m.alive) continue;
                if (Math.hypot(tx - m.x, ty - m.y) > character.ultimateRadius + MONSTER_RADIUS) continue;
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
        } else if (character.ultimateType === 'magma_zone') {
            const targetX = payload && payload.targetX;
            const targetY = payload && payload.targetY;
            if (typeof targetX !== 'number' || typeof targetY !== 'number' || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return;
            const floorDef = STORY_FLOOR_DEFS[room.floor];
            const t = clampToLane(floorDef, targetX, targetY);
            const tx = t.x, ty = t.y;

            io.to(roomId).emit('storyMagmaZonePlaced', { id: socket.id, x: tx, y: ty, radius: character.ultimateRadius, durationMs: character.ultimateZoneDurationMs });

            room.activeBuffs.push({
                type: 'magma_zone',
                casterId: socket.id,
                x: tx, y: ty,
                radius: character.ultimateRadius,
                damage: character.ultimateZoneDamagePerTick,
                tickMs: character.ultimateZoneTickMs,
                endAt: now + character.ultimateZoneDurationMs,
                lastTickAt: now
            });
        } else if (character.ultimateType === 'element_mark') {
            // No immediate effect -- read by the storyPlayerAttack handler,
            // which marks whatever it hits for the rest of this window.
            p.elementMarkUntil = now + character.ultimateDurationMs;
        } else if (character.ultimateType === 'awakening_rapid') {
            p.rapidStrikeUntil = now + character.ultimateDurationMs;
            p.rapidAttackCount = 0;
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
        const character = CHARACTERS[p.charType];
        const now = Date.now();
        const rapid = rapidStrikeActive(character, p, now);
        const cooldown = attackCooldownFor(character, p, rapid);
        if (now - p.lastAttackTime < cooldown) return;
        p.lastAttackTime = now;
        if (character.skillType === 'guard_stance') p.guardStanceUntil = 0; // attacking breaks guard

        if (character.attackType === 'melee_kick' || character.attackType === 'alternating_punch'
            || character.attackType === 'combo_two_stage' || character.attackType === 'dual_spear') {
            const swing = resolveAttack(character, p, now, rapid);
            advanceAttackSequence(character, p);
            if (meleeLineHit(swing.originX, swing.originY, p.facing, swing.range, swing.width, BOSS_RADIUS)) {
                let dmg = swing.damage;

                // Element mark: a matching-element attacker deals bonus
                // damage vs a marked boss and burns down one charge.
                let markChanged = false;
                const mark = room.bossElementMark;
                if (mark && mark.element === character.element && mark.charges > 0) {
                    dmg = Math.round(dmg * mark.multiplier);
                    mark.charges -= 1;
                    markChanged = true;
                    if (mark.charges <= 0) room.bossElementMark = null;
                }

                room.bossHp = Math.max(0, room.bossHp - dmg);
                io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: socket.id });
                if (room.bossHp <= 0) endRoom(roomId, 'win');

                // Some cookies heal the team whenever the attack actually
                // connects (only a chance to proc, if attackHealChance is
                // set). The ultimate can temporarily raise the heal amount.
                if (character.attackHealOnUse && Math.random() < (character.attackHealChance ?? 1)) {
                    const boosted = character.ultimateType === 'attack_heal_boost' && p.attackHealBoostUntil && now < p.attackHealBoostUntil;
                    healTeam(room, roomId, boosted ? character.ultimateHealPerAttack : character.attackHealOnUse);
                }

                // Burn: a couple of small extra ticks after the initial hit.
                if (character.attackBurnDamage) {
                    room.activeBuffs.push({
                        type: 'attack_burn',
                        casterId: socket.id,
                        damage: character.attackBurnDamage,
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
                        room.bossElementMark = { element: character.element, charges: character.ultimateMarkUses, multiplier: character.ultimateMarkMultiplier };
                    }
                    markChanged = true;
                }

                if (markChanged) {
                    io.to(roomId).emit('bossMarked', room.bossElementMark
                        ? { element: room.bossElementMark.element, charges: room.bossElementMark.charges }
                        : { element: null, charges: 0 });
                }
            }
        }
    });

    socket.on('playerSkill', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const character = CHARACTERS[p.charType];
        if (!character.skillType) return;
        const now = Date.now();
        if (now - p.lastSkillTime < character.skillCooldown) return;
        p.lastSkillTime = now;

        socket.to(roomId).emit('playerSkillUsed', { id: socket.id });

        if (character.skillType === 'spin_kick' || character.skillType === 'lava_burst') {
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
        } else if (character.skillType === 'kick') {
            if (meleeLineHit(p.x, p.y, p.facing, character.skillRange, character.skillWidth, BOSS_RADIUS)) {
                room.bossHp = Math.max(0, room.bossHp - character.skillDamage);
                io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: socket.id });
                if (room.bossHp <= 0) endRoom(roomId, 'win');
            }
        } else if (character.skillType === 'self_heal') {
            const healed = Math.min(p.maxHp, p.hp + character.skillHealAmount);
            if (healed !== p.hp) {
                p.hp = healed;
                io.to(roomId).emit('playerHealed', { id: socket.id, hp: p.hp });
            }
        } else if (character.skillType === 'earthquake') {
            // A raid only ever has one enemy (the boss), so this always takes
            // the small-group branch -- the boss is never one-shot.
            io.to(roomId).emit('earthquake', { id: socket.id, count: 1 });
            room.bossHp = Math.max(0, room.bossHp - character.skillDamage);
            io.to(roomId).emit('bossDamaged', { bossHp: room.bossHp, by: socket.id });
            if (room.bossHp <= 0) endRoom(roomId, 'win');
        }
    });

    socket.on('playerUltimate', (payload) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const character = CHARACTERS[p.charType];
        if (!character.ultimateType) return;
        const now = Date.now();
        if (now - p.lastUltimateTime < character.ultimateCooldownMs) return;
        p.lastUltimateTime = now;

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
        } else if (character.ultimateType === 'magma_zone') {
            const targetX = payload && payload.targetX;
            const targetY = payload && payload.targetY;
            if (typeof targetX !== 'number' || typeof targetY !== 'number' || !Number.isFinite(targetX) || !Number.isFinite(targetY)) return;

            const dist = Math.hypot(targetX, targetY);
            const clampedDist = Math.min(dist, ARENA_RADIUS);
            const scale = dist > 0 ? clampedDist / dist : 0;
            const tx = targetX * scale, ty = targetY * scale;

            io.to(roomId).emit('magmaZonePlaced', { id: socket.id, x: tx, y: ty, radius: character.ultimateRadius, durationMs: character.ultimateZoneDurationMs });

            room.activeBuffs.push({
                type: 'magma_zone',
                casterId: socket.id,
                x: tx, y: ty,
                radius: character.ultimateRadius,
                damage: character.ultimateZoneDamagePerTick,
                tickMs: character.ultimateZoneTickMs,
                endAt: now + character.ultimateZoneDurationMs,
                lastTickAt: now
            });
        } else if (character.ultimateType === 'element_mark') {
            // No immediate effect -- read by the playerAttack handler, which
            // marks whatever it hits for the rest of this window.
            p.elementMarkUntil = now + character.ultimateDurationMs;
        } else if (character.ultimateType === 'awakening_rapid') {
            p.rapidStrikeUntil = now + character.ultimateDurationMs;
            p.rapidAttackCount = 0;
        } else if (character.ultimateType === 'team_shield') {
            shieldTeam(room, roomId, character.ultimateShieldAmount);
        } else if (character.ultimateType === 'undying_soul') {
            p.undyingSoulUntil = now + character.ultimateDurationMs;
            const healed = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * character.ultimateHealRatio));
            if (healed !== p.hp) {
                p.hp = healed;
                io.to(roomId).emit('playerHealed', { id: socket.id, hp: p.hp });
            }
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
        io.to(roomId).emit('raidRoomUpdate', {
            roomId, bossId: room.bossId, count: Object.keys(room.players).length,
            players: publicPlayers(room)
        });
    });

    // ---- Guest raid ----
    socket.on('joinGuestRaid', ({ guestId, party, solo }) => {
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

        room.players[socket.id] = makeGuestPlayer(chosen, Object.keys(room.players).length);
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
        const character = CHARACTERS[p.charType];
        const now = Date.now();
        const rapid = rapidStrikeActive(character, p, now);
        if (now - p.lastAttackTime < attackCooldownFor(character, p, rapid)) return;
        p.lastAttackTime = now;
        if (character.skillType === 'guard_stance') p.guardStanceUntil = 0;
        if (character.attackType !== 'melee_kick' && character.attackType !== 'alternating_punch'
            && character.attackType !== 'combo_two_stage' && character.attackType !== 'dual_spear') return;

        const swing = resolveAttack(character, p, now, rapid);
        advanceAttackSequence(character, p);
        // The boss and any summoned add are both in the way of the same swing.
        const targets = guestLineTargets(room, swing.originX, swing.originY, p.facing, swing.range, swing.width);
        if (!targets.length) return;

        damageGuestTargets(roomId, room, targets, swing.damage, socket.id);
        if (!rooms[roomId]) return;
        if (character.attackHealOnUse && Math.random() < (character.attackHealChance ?? 1)) {
            const boosted = character.ultimateType === 'attack_heal_boost' && p.attackHealBoostUntil && now < p.attackHealBoostUntil;
            healGuestTeam(room, roomId, boosted ? character.ultimateHealPerAttack : character.attackHealOnUse);
        }
    });

    socket.on('guestPlayerSkill', () => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'guest' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const character = CHARACTERS[p.charType];
        if (!character.skillType) return;
        const now = Date.now();
        if (now - p.lastSkillTime < character.skillCooldown) return;
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
        } else if (character.skillType === 'self_heal') {
            p.hp = Math.min(p.maxHp, p.hp + character.skillHealAmount);
            p.partyHp[p.active] = p.hp;
            io.to(roomId).emit('guestPlayerHealed', { id: socket.id, hp: p.hp, partyHp: p.partyHp });
        } else if (character.skillType === 'spin_heal') {
            const hit = guestCircleTargets(room, p.x, p.y, character.skillRadius);
            if (hit.length) {
                damageGuestTargets(roomId, room, hit, character.skillDamage, socket.id);
                if (rooms[roomId]) healGuestTeam(room, roomId, character.skillHealOnHit);
            }
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
        }
        // speed_boost is client-side only.
    });

    socket.on('guestPlayerUltimate', (payload) => {
        const roomId = socket.data.roomId;
        const room = rooms[roomId];
        if (!room || room.kind !== 'guest' || room.state !== 'fighting') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;
        const character = CHARACTERS[p.charType];
        if (!character.ultimateType) return;
        const now = Date.now();
        if (now - p.lastUltimateTime < character.ultimateCooldownMs) return;
        p.lastUltimateTime = now;
        socket.to(roomId).emit('guestPlayerUltimateUsed', { id: socket.id });

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
        } else if (character.ultimateType === 'magma_zone') {
            const t = aimed();
            if (!t) return;
            io.to(roomId).emit('guestMagmaZonePlaced', {
                id: socket.id, x: t.x, y: t.y, radius: character.ultimateRadius,
                durationMs: character.ultimateZoneDurationMs
            });
            room.activeBuffs.push({
                type: 'magma_zone', casterId: socket.id, x: t.x, y: t.y,
                radius: character.ultimateRadius, damage: character.ultimateZoneDamagePerTick,
                tickMs: character.ultimateZoneTickMs,
                endAt: now + character.ultimateZoneDurationMs, lastTickAt: now
            });
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
        } else if (character.ultimateType === 'team_shield') {
            shieldGuestTeam(room, roomId, character.ultimateShieldAmount);
        } else if (character.ultimateType === 'undying_soul') {
            p.undyingSoulUntil = now + character.ultimateDurationMs;
            p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * character.ultimateHealRatio));
            p.partyHp[p.active] = p.hp;
            io.to(roomId).emit('guestPlayerHealed', { id: socket.id, hp: p.hp, partyHp: p.partyHp });
        } else if (character.ultimateType === 'element_mark') {
            p.elementMarkUntil = now + character.ultimateDurationMs;
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
