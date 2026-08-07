// Fills the cookie's body with the same hard 50/50 two-colour split its icon
// uses (see charIconBackground in main.js): left half colorLeft, right half
// colorRight. Assumes the context is already translated to the body centre and
// NOT rotated, so the split stays vertical on screen like the icon's does.
// Falls back to the flat `color` for any cookie without both halves defined.
function drawCookieBody(ctx, radius, stats, alive) {
    if (!alive) {
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#7f8c8d';
        ctx.fill();
        return;
    }
    if (!stats.colorLeft || !stats.colorRight) {
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fillStyle = stats.color;
        ctx.fill();
        return;
    }
    // Canvas angles: 0 = right, PI/2 = down, PI = left. Sweeping down->up the
    // short way covers the left half; up->down covers the right half.
    ctx.beginPath();
    ctx.arc(0, 0, radius, Math.PI / 2, Math.PI * 1.5);
    ctx.closePath();
    ctx.fillStyle = stats.colorLeft;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, radius, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = stats.colorRight;
    ctx.fill();
}

// Draws a character's held weapon, if it has one (stats.weaponShape/weaponColor
// in shared.js -- most cookies have neither and this is a no-op). Call this
// AFTER the context has been rotated to facingAngle, same as the facing
// triangle, so the weapon points the way the cookie is looking. `R` is the
// body radius; the weapon is drawn just outside it on the facing side.
function drawCharacterWeapon(ctx, R, stats, alive) {
    if (!alive || !stats.weaponShape) return;
    const color = stats.weaponColor || '#7f8c8d';
    const hx = R + 4; // where the "hand" is, just past the body edge

    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    switch (stats.weaponShape) {
        case 'hook': {
            const len = R * 1.5;
            ctx.beginPath();
            ctx.moveTo(hx, R * 0.1);
            ctx.lineTo(hx + len * 0.55, -R * 0.35);
            ctx.quadraticCurveTo(hx + len, -R * 0.85, hx + len * 0.65, -R * 1.4);
            ctx.lineWidth = Math.max(3, R * 0.32);
            ctx.lineCap = 'round';
            ctx.stroke();
            break;
        }
        case 'whip': {
            const len = R * 2.1;
            ctx.beginPath();
            ctx.moveTo(hx, 0);
            for (let i = 1; i <= 5; i++) {
                const t = i / 5;
                ctx.lineTo(hx + len * t, Math.sin(t * Math.PI * 2.2) * R * 0.5);
            }
            ctx.lineWidth = Math.max(2, R * 0.11);
            ctx.lineCap = 'round';
            ctx.stroke();
            break;
        }
        case 'shield': {
            const w = R * 0.85, h = R * 1.25;
            ctx.beginPath();
            ctx.ellipse(hx + w * 0.35, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.stroke();
            break;
        }
        case 'fist': {
            const fr = R * 0.55;
            ctx.beginPath();
            ctx.arc(hx + fr, R * 0.15, fr, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.stroke();
            break;
        }
        case 'board': {
            const w = R * 1.7, h = R * 0.6;
            ctx.save();
            ctx.translate(hx + w * 0.45, 0);
            ctx.rotate(-0.5);
            ctx.beginPath();
            ctx.rect(0, -h / 2, w, h);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.stroke();
            ctx.restore();
            break;
        }
        case 'sword': {
            const len = R * 1.9, w = R * 0.32;
            ctx.beginPath();
            ctx.moveTo(hx, -w / 2);
            ctx.lineTo(hx + len * 0.8, -w / 2);
            ctx.lineTo(hx + len, 0);
            ctx.lineTo(hx + len * 0.8, w / 2);
            ctx.lineTo(hx, w / 2);
            ctx.closePath();
            ctx.fill();
            // crossguard
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(hx - R * 0.08, -w * 1.1, R * 0.16, w * 2.2);
            break;
        }
        case 'spear': {
            const len = R * 2.3, w = R * 0.5;
            ctx.beginPath();
            ctx.moveTo(hx, -R * 0.14);
            ctx.lineTo(hx + len * 0.85, -R * 0.14);
            ctx.lineTo(hx + len, 0);
            ctx.lineTo(hx + len * 0.85, R * 0.14);
            ctx.lineTo(hx, R * 0.14);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(hx + len * 0.85, -w / 2);
            ctx.lineTo(hx + len * 1.15, 0);
            ctx.lineTo(hx + len * 0.85, w / 2);
            ctx.closePath();
            ctx.fill();
            break;
        }
        case 'drop': {
            const dr = R * 0.55;
            const dx = hx + dr * 0.9;
            ctx.beginPath();
            ctx.moveTo(dx, -dr * 1.6);
            ctx.quadraticCurveTo(dx + dr * 1.1, -dr * 0.2, dx, dr * 0.9);
            ctx.quadraticCurveTo(dx - dr * 1.1, -dr * 0.2, dx, -dr * 1.6);
            ctx.closePath();
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.stroke();
            break;
        }
        case 'club': {
            // Handle + a fat rounded head, like a bat/mace.
            const len = R * 1.6, headR = R * 0.5;
            ctx.lineWidth = R * 0.22;
            ctx.lineCap = 'round';
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.moveTo(hx, 0);
            ctx.lineTo(hx + len * 0.65, -R * 0.1);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(hx + len * 0.8, -R * 0.15, headR, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.stroke();
            break;
        }
        case 'rollingpin': {
            // Long capsule barrel with two small handle knobs at each end.
            const len = R * 1.9, barrelR = R * 0.28;
            ctx.beginPath();
            ctx.arc(hx + barrelR, 0, barrelR, Math.PI / 2, -Math.PI / 2);
            ctx.arc(hx + len - barrelR, 0, barrelR, -Math.PI / 2, Math.PI / 2);
            ctx.closePath();
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(hx - barrelR * 0.4, 0, barrelR * 0.55, 0, Math.PI * 2);
            ctx.arc(hx + len + barrelR * 0.4, 0, barrelR * 0.55, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'greatsword': {
            // Same silhouette as 'sword', scaled up, with a soft glow ring.
            const len = R * 2.4, w = R * 0.5;
            ctx.save();
            ctx.shadowColor = color;
            ctx.shadowBlur = R * 0.6;
            ctx.beginPath();
            ctx.moveTo(hx, -w / 2);
            ctx.lineTo(hx + len * 0.8, -w / 2);
            ctx.lineTo(hx + len, 0);
            ctx.lineTo(hx + len * 0.8, w / 2);
            ctx.lineTo(hx, w / 2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(hx - R * 0.1, -w * 1.15, R * 0.2, w * 2.3);
            break;
        }
        case 'dualswords': {
            // Two shorter blades, one angled up and one down, same colour.
            const len = R * 1.5, w = R * 0.24;
            [-1, 1].forEach(side => {
                ctx.save();
                ctx.rotate(side * 0.35);
                ctx.beginPath();
                ctx.moveTo(hx, -w / 2);
                ctx.lineTo(hx + len * 0.8, -w / 2);
                ctx.lineTo(hx + len, 0);
                ctx.lineTo(hx + len * 0.8, w / 2);
                ctx.lineTo(hx, w / 2);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            });
            break;
        }
        case 'axe': {
            const len = R * 1.4, headR = R * 0.6;
            ctx.lineWidth = R * 0.16;
            ctx.strokeStyle = 'rgba(90,60,20,0.9)'; // wooden handle
            ctx.beginPath();
            ctx.moveTo(hx, R * 0.1);
            ctx.lineTo(hx + len, -R * 0.5);
            ctx.stroke();
            // Crescent axe-head at the far end of the handle.
            ctx.beginPath();
            ctx.arc(hx + len, -R * 0.5, headR, Math.PI * 0.15, Math.PI * 1.35);
            ctx.lineTo(hx + len - headR * 0.35, -R * 0.5);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0,0,0,0.35)';
            ctx.stroke();
            break;
        }
        case 'orb': {
            const orbR = R * 0.42;
            const ox = hx + orbR * 1.2;
            ctx.beginPath();
            ctx.arc(ox, -R * 0.2, orbR, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            ctx.stroke();
            break;
        }
    }
    ctx.restore();
}

// Skills whose self-aura lasts the whole buff instead of a quick 350ms flash,
// because the buff being up is information the player needs while fighting.
const SKILL_FULL_DURATION_EFFECTS = ['spin_heal', 'guard_stance', 'sea_hide'];

// How far off the body centre this swing's corridor sits, in the frame already
// rotated to `facing` (+y = the player's right). Only dual_spear uses it; keep in
// step with resolveAttack's originX/originY in server.js.
// 가로로 베는 모션. 칼이 한쪽 끝에서 반대쪽 끝까지 훑고 지나가고 지나간
// 자리에 잔상이 짧게 남는다. 판정은 서버가 직사각형으로 보므로, 훑는
// 부채꼴은 그 직사각형을 덮을 만큼 크게 그린다. 흡혈 베기일 때는 붉게.
const SWEEP_MS = 180;
function drawSweepSlash(c, R, range, width, t, vampire) {
    const half = Math.max(0.55, Math.atan2(width / 2, range * 0.55));
    const a = -half + 2 * half * Math.min(1, t);
    const tail = Math.max(-half, a - 0.6);
    const outer = R + range;
    const fade = t > 0.7 ? Math.max(0, 1 - (t - 0.7) / 0.3) : 1;
    c.save();
    c.beginPath();
    c.arc(0, 0, outer, tail, a);
    c.arc(0, 0, R, a, tail, true);
    c.closePath();
    c.fillStyle = vampire ? `rgba(192, 57, 43, ${0.4 * fade})` : `rgba(142, 68, 173, ${0.32 * fade})`;
    c.fill();
    // 칼날이 지금 지나가는 자리
    c.beginPath();
    c.moveTo(Math.cos(a) * R, Math.sin(a) * R);
    c.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
    c.strokeStyle = vampire ? `rgba(255, 130, 110, ${fade})` : `rgba(206, 160, 255, ${fade})`;
    c.lineWidth = 5;
    c.stroke();
    c.restore();
}

// ---- 바다펄맛 밀물 ----
// 지금 쓸 단계(1~4). 방마다 플레이어 객체가 달라서 단계만 읽어 온다.
function tideStageNoOf(o) {
    const n = (o && o.tideStage) || 1;
    return Math.max(1, n);
}
function tideStageDefOf(stats, o) {
    if (!stats || stats.skillType !== 'tide_cycle') return null;
    const stages = stats.skillStages || [];
    return stages[Math.min(tideStageNoOf(o), stages.length) - 1] || null;
}
// 예열 시간은 쿨타임에 들어가지 않는다 -- 물결이 터지는 순간부터 15초를
// 센다. 서버도 같은 계산을 한다.
function skillCastStamp(stats, o, now) {
    const stage = tideStageDefOf(stats, o);
    return now + ((stage && stage.windupMs) || 0);
}

// '#e67e22' 같은 쿠키 색을 반투명하게 쓴다.
function cookieColorAlpha(hex, a) {
    const h = String(hex || '#ffffff').replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const n = parseInt(full, 16) || 0xffffff;
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// ---- 바다펄맛 패시브 (체력 50 아래) ----
// 서버와 같은 규칙을 클라이언트에서도 따라 센다: 50 아래에서 켜지고, 체력이
// 다시 꽉 차면 꺼진다. 켜져 있는 것을 눈으로 보여 주려면 여기서도 알아야 한다.
function refreshLowHpAura(stats, o) {
    if (!o || !stats || !stats.lowHpAt || !o.alive) { if (o) o.lowHpOn = false; return false; }
    if (o.hp >= o.maxHp) o.lowHpOn = false;
    else if (o.hp <= stats.lowHpAt) o.lowHpOn = true;
    return !!o.lowHpOn;
}

// 켜져 있는 동안 몸 둘레에 파란 물결이 돈다.
function drawLowHpAura(c, R, now) {
    const pulse = Math.sin(now / 180) * 3;
    c.beginPath();
    c.arc(0, 0, R + 9 + pulse, 0, Math.PI * 2);
    c.fillStyle = 'rgba(46, 134, 222, 0.18)';
    c.fill();
    c.strokeStyle = 'rgba(120, 200, 255, 0.95)';
    c.lineWidth = 3;
    c.stroke();
    c.beginPath();
    c.arc(0, 0, R + 17 + pulse * 1.5, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(46, 134, 222, 0.5)';
    c.lineWidth = 2;
    c.stroke();
}

// 쓰러졌다 다시 일어난 순간. 화면 위에 글씨를 띄우는 대신 쿠키 자기 색으로
// 고리가 겹겹이 퍼지고 몸이 잠깐 환해진다 -- 부활은 자기 쿠키에서 보여야 한다.
const REVIVE_EFFECT_MS = 1400;
function drawReviveAura(c, R, stats, t) {
    const fade = Math.max(0, 1 - t);
    for (let i = 0; i < 3; i++) {
        const w = t * 1.6 - i * 0.22;
        if (w <= 0 || w >= 1) continue;
        c.beginPath();
        c.arc(0, 0, R + 6 + w * 80, 0, Math.PI * 2);
        c.strokeStyle = cookieColorAlpha(i % 2 ? stats.colorRight : stats.colorLeft, (1 - w) * 0.9);
        c.lineWidth = 5;
        c.stroke();
    }
    // 몸을 감싸고 두근거리는 빛.
    c.beginPath();
    c.arc(0, 0, R + 5 + Math.sin(t * Math.PI * 6) * 3, 0, Math.PI * 2);
    c.strokeStyle = `rgba(255, 246, 205, ${0.9 * fade})`;
    c.lineWidth = 4;
    c.stroke();
    c.beginPath();
    c.arc(0, 0, R, 0, Math.PI * 2);
    c.fillStyle = `rgba(255, 255, 255, ${0.35 * fade})`;
    c.fill();
}

// 번개악마맛은 모든 베기가 흡혈 베기라 언제나 붉게 그린다. 서버도 같다.
function advanceSweepCount(o, stats) {
    if (stats.attackType !== 'vampire_slash') return;
    o.attackSeq = (o.attackSeq || 0) + 1;
    o.attackVampire = true;
}

// 흡혈 베기는 조금 더 크게 벤다.
function sweepShape(stats, vampire) {
    return vampire
        ? { range: stats.attackVampireRange || stats.attackRange,
            width: stats.attackVampireWidth || stats.attackWidth }
        : { range: stats.attackRange, width: stats.attackWidth };
}

function attackSideShift(stats, side) {
    if (stats.attackType !== 'dual_spear') return 0;
    return (side || 0) === 0 ? stats.attackSideOffset : -stats.attackSideOffset;
}

// Current movement speed given the two client-side buff timers. Shared by the
// raid's Player.updateLocal and story mode's plain-object player (storyFrame in
// main.js), so a new speed buff only has to be added in one place.
// speed_boost (a skill) REPLACES the base speed with an absolute value;
// undying_soul (an ultimate) ADDS to it; awakening multiplies it.
// 장비의 이동 속도 보너스. 어떤 버프가 속도를 통째로 갈아치워도 장비는
// 그 위에 그대로 더해진다.
function withEquipSpeed(base, equipSpeed) {
    return Math.max(0.5, base + (equipSpeed || 0));
}

// isJoystick: 모바일 조이스틱은 입력 특성상 실제 체감 이동속도가 키보드보다
// 느리게 느껴지므로, 계산된 이동속도에 보정값을 더해 체감을 맞춘다.
const JOYSTICK_SPEED_BONUS = 0.5;
function moveSpeedFor(stats, now, speedBoostUntil, awakenUntil, butterflyOn, equipSpeed, rapidStrikeUntil, isJoystick) {
    const bonus = isJoystick ? JOYSTICK_SPEED_BONUS : 0;
    // 나비모드 runs until it is switched off, so it wins over any timer.
    if (butterflyOn && stats.ultimateType === 'butterfly_mode') {
        return withEquipSpeed(stats.speed + stats.ultimateSpeedBonus, equipSpeed) + bonus;
    }
    if (now < (speedBoostUntil || 0)) {
        if (stats.skillType === 'speed_boost') return withEquipSpeed(stats.skillSpeedValue, equipSpeed) + bonus;
        if (stats.skillType === 'charge_dash') return withEquipSpeed(stats.speed + stats.skillSpeedBonus, equipSpeed) + bonus;
        if (stats.ultimateType === 'undying_soul') return withEquipSpeed(stats.speed + stats.ultimateSpeedBonus, equipSpeed) + bonus;
        if (stats.ultimateType === 'great_slash') return withEquipSpeed(stats.speed + stats.ultimateSpeedBonus, equipSpeed) + bonus;
    }
    if (stats.ultimateType === 'awakening' && now < (awakenUntil || 0)) {
        return stats.speed * stats.ultimateSpeedMultiplier + bonus;
    }
    // 본능해제 4강(오렌지레몬맛): awakening_rapid 궁극기가 켜져 있는 동안 이동속도를 더한다.
    if (stats.ultimateType === 'awakening_rapid' && stats.instinctRapidSpeedBonus && now < (rapidStrikeUntil || 0)) {
        return withEquipSpeed(stats.speed + stats.instinctRapidSpeedBonus, equipSpeed) + bonus;
    }
    return stats.speed + bonus;
}

class Player {
    constructor(id, charType, x, y, isLocal) {
        this.id = id;
        this.charType = SHARED.CHARACTERS[charType] ? charType : 'kicker';
        this.x = x;
        this.y = y;
        this.facing = 0; // radians; kicker aims at the mouse, see aimAt()
        this.isLocal = isLocal;

        const stats = SHARED.CHARACTERS[this.charType];
        this.hp = stats.health;
        this.maxHp = stats.health;
        this.alive = true;
        this.shieldHp = 0; // absorbs incoming damage before HP; see team_shield ultimate

        this.lastAttackClientTime = -Infinity;
        this.attackEffectUntil = 0; // performance.now() timestamp for lunge animation

        this.lastSkillClientTime = -Infinity;
        this.skillEffectUntil = 0;

        this.lastUltimateClientTime = -Infinity;
        this.ultimateEffectUntil = 0;
        this.healEffectUntil = 0;

        this.comboStage = 0; // combo_two_stage: which half of the combo comes next
        this.attackEffectStage = null; // the stage the running attack animation is drawing
        this.spearSide = 0; // dual_spear: 0 = right hand fires next, 1 = left
        this.attackEffectSide = 0; // the side the running attack animation is drawing
        this.speedBoostUntil = 0; // performance.now() timestamp; set by any speed-granting skill
        this.butterflyOn = false; // 나비모드: a toggle, not a timer
        this.equipSpeed = 0; // 장비의 이동 속도 보너스 (내 쿠키에만 의미가 있다)
        this.awakenUntil = 0; // performance.now() timestamp; see triggerUltimateEffect()
        this.rapidStrikeUntil = 0; // performance.now() timestamp; see triggerUltimateEffect()
        this.untouchableUntil = 0; // performance.now() timestamp; 바다 수호자맛 sea_hide -- 이 동안 아무도 못 때리고 자기도 못 때린다
    }

    get stats() {
        return SHARED.CHARACTERS[this.charType];
    }

    canAttack(now) {
        if (!this.alive) return false;
        if (now < this.untouchableUntil) return false; // 바다 수호자맛 sea_hide: 숨어 있는 동안은 공격 불가
        const rapid = this.stats.ultimateType === 'awakening_rapid' && now < this.rapidStrikeUntil;
        let cooldown = this.stats.attackCooldown;
        if (rapid) cooldown = this.stats.ultimateRapidCooldown;
        else if (this.stats.attackType === 'combo_two_stage' && this.comboStage === 1) {
            cooldown = this.stats.comboFollowupCooldown; // follow-up thrust opens sooner
        }
        return now - this.lastAttackClientTime >= cooldown;
    }

    // Mirrors the server's stage bookkeeping so the local effect draws the right
    // shape (see resolveAttack/advanceComboStage in server.js).
    get currentAttackStage() {
        if (this.stats.attackType !== 'combo_two_stage') return null;
        return this.stats.attackStages[this.comboStage || 0];
    }

    canUseSkill(now) {
        return this.alive && !!this.stats.skillType && now - this.lastSkillClientTime >= this.stats.skillCooldown * (this.equipCooldown || 1);
    }

    canUseUltimate(now) {
        // 나비모드: while it is on, the button switches it off instead.
        if (this.alive && this.stats.ultimateType === 'butterfly_mode' && this.butterflyOn) return true;
        return this.alive && !!this.stats.ultimateType
            && now - this.lastUltimateClientTime >= this.stats.ultimateCooldownMs * (this.equipCooldown || 1);
    }

    // Local-only movement prediction; server remains the source of truth for
    // other players (driven by playerMoved) and for all damage.
    updateLocal(keys) {
        if (!this.alive) return false;
        const speed = moveSpeedFor(this.stats, performance.now(), this.speedBoostUntil, this.awakenUntil, this.butterflyOn, this.equipSpeed, this.rapidStrikeUntil, !!joystickMoveVec);
        let dx = 0, dy = 0;
        if (joystickMoveVec) {
            dx = joystickMoveVec.x * speed;
            dy = joystickMoveVec.y * speed;
        } else {
            if (keys['w'] || keys['W']) dy -= speed;
            if (keys['s'] || keys['S']) dy += speed;
            if (keys['a'] || keys['A']) dx -= speed;
            if (keys['d'] || keys['D']) dx += speed;
        }
        if (dx === 0 && dy === 0) return false;

        let nx = this.x + dx;
        let ny = this.y + dy;
        const dist = Math.hypot(nx, ny);
        const maxDist = SHARED.ARENA_RADIUS - SHARED.PLAYER_RADIUS;
        const minDist = SHARED.BOSS_RADIUS + SHARED.PLAYER_RADIUS; // boss is solid, can't be walked through
        if (dist > maxDist) {
            const scale = maxDist / dist;
            nx *= scale; ny *= scale;
        } else if (dist < minDist && dist > 0) {
            const scale = minDist / dist;
            nx *= scale; ny *= scale;
        }
        this.x = nx; this.y = ny;
        return true;
    }

    // Local-only aiming; points the kick (and its visuals) at the mouse
    // regardless of which way the player is walking.
    aimAt(targetX, targetY) {
        if (!this.alive) return;
        this.facing = Math.atan2(targetY - this.y, targetX - this.x);
    }

    triggerAttackEffect() {
        this.lastAttackClientTime = performance.now();
        this.attackEffectUntil = performance.now() + 180;
        if (this.stats.attackType === 'combo_two_stage') {
            this.attackEffectStage = this.currentAttackStage;
            this.comboStage = ((this.comboStage || 0) + 1) % this.stats.attackStages.length;
        } else if (this.stats.attackType === 'dual_spear') {
            this.attackEffectSide = this.spearSide || 0;
            this.spearSide = (this.spearSide || 0) === 0 ? 1 : 0;
        }
        advanceSweepCount(this, this.stats);
        if (this.stats.skillType === 'guard_stance') {
            this.skillEffectUntil = 0; // attacking breaks the guard stance
        }
    }

    triggerSkillEffect() {
        this.lastSkillClientTime = skillCastStamp(this.stats, this, performance.now());
        const duration = SKILL_FULL_DURATION_EFFECTS.includes(this.stats.skillType)
            ? this.stats.skillDurationMs : 350;
        this.skillEffectUntil = performance.now() + duration;
        if (this.stats.skillType === 'speed_boost' || this.stats.skillType === 'charge_dash') {
            this.speedBoostUntil = performance.now() + this.stats.skillSpeedDurationMs;
        } else if (this.stats.skillType === 'sea_hide') {
            this.untouchableUntil = performance.now() + this.stats.skillDurationMs;
        }
    }

    // Starts the ultimate's cooldown. Split out from triggerUltimateEffect()
    // because targeted_aoe fires from a click at some point after F is
    // pressed, and its feedback is the impact marker, not a self-aura.
    markUltimateUsed() {
        this.lastUltimateClientTime = performance.now();
    }

    triggerUltimateEffect() {
        this.markUltimateUsed();
        this.ultimateEffectUntil = performance.now() + (this.stats.ultimateDurationMs || 0);
        if (this.stats.ultimateType === 'awakening') {
            this.awakenUntil = performance.now() + this.stats.ultimateDurationMs;
        } else if (this.stats.ultimateType === 'awakening_rapid') {
            this.rapidStrikeUntil = performance.now() + this.stats.ultimateDurationMs;
        } else if (this.stats.ultimateType === 'undying_soul') {
            this.speedBoostUntil = performance.now() + this.stats.ultimateDurationMs;
        }
    }

    triggerHealEffect() {
        this.healEffectUntil = performance.now() + 250;
    }

    draw(ctx, now) {
        const R = SHARED.PLAYER_RADIUS;
        const facingAngle = this.facing;
        ctx.save();
        ctx.translate(this.x, this.y);

        if (now < this.attackEffectUntil && this.stats.attackType === 'vampire_slash') {
            const sh = sweepShape(this.stats, this.attackVampire);
            ctx.save();
            ctx.rotate(facingAngle);
            drawSweepSlash(ctx, R, sh.range, sh.width,
                1 - (this.attackEffectUntil - now) / SWEEP_MS, this.attackVampire);
            ctx.restore();
        } else if (now < this.attackEffectUntil) {
            // Straight-line kick corridor, drawn extending forward from the body.
            const stage = this.attackEffectStage;
            const range = stage ? stage.range : this.stats.attackRange;
            const width = (stage ? stage.width : this.stats.attackWidth) || 40;
            ctx.save();
            ctx.rotate(facingAngle);
            // dual_spear fires from one side of the body at a time; in this
            // rotated frame +y is the player's right (see resolveAttack).
            ctx.translate(0, attackSideShift(this.stats, this.attackEffectSide));
            ctx.fillStyle = 'rgba(241, 196, 15, 0.35)';
            ctx.fillRect(R, -width / 2, range, width);
            ctx.strokeStyle = 'rgba(241, 196, 15, 0.9)';
            ctx.lineWidth = 2;
            ctx.strokeRect(R, -width / 2, range, width);
            ctx.restore();
        }

        if (now < this.skillEffectUntil) {
            if (this.stats.skillType === 'spin_heal') {
                // Shows the actual spin radius, since it matters for gameplay.
                ctx.beginPath();
                ctx.arc(0, 0, this.stats.skillRadius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(39, 174, 96, 0.2)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(39, 174, 96, 0.85)';
                ctx.lineWidth = 3;
                ctx.stroke();
            } else if (this.stats.skillType === 'sea_hide') {
                // 몸은 아래에서 옅게(투명도) 처리해서 그리고, 물결 고리로
                // "숨어서 안 맞는다"는 걸 알려 준다.
                const ripple = 6 + Math.sin(now / 120) * 4;
                ctx.beginPath();
                ctx.arc(0, 0, R + 14 + ripple, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(52, 152, 219, 0.85)';
                ctx.lineWidth = 5;
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, R + 26, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(231, 76, 60, 0.85)';
                ctx.lineWidth = 6;
                ctx.stroke();
            }
        }

        if (now < this.ultimateEffectUntil) {
            // Slow pulse for the whole heal-over-time duration.
            const pulse = 4 + Math.sin(now / 150) * 3;
            ctx.beginPath();
            ctx.arc(0, 0, R + 20 + pulse, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(46, 204, 113, 0.7)';
            ctx.lineWidth = 5;
            ctx.stroke();
        }

        if (now < this.healEffectUntil) {
            ctx.beginPath();
            ctx.arc(0, 0, R + 10, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(46, 204, 113, 0.9)';
            ctx.lineWidth = 3;
            ctx.stroke();
        }

        if (now < (this.reviveEffectUntil || 0)) {
            drawReviveAura(ctx, R, this.stats, 1 - (this.reviveEffectUntil - now) / REVIVE_EFFECT_MS);
        }

        // 바다펄맛 패시브가 켜져 있으면 파란 물결이 돈다.
        if (refreshLowHpAura(this.stats, this)) drawLowHpAura(ctx, R, now);

        const hidden = this.alive && now < this.untouchableUntil;
        ctx.globalAlpha = this.alive ? (hidden ? 0.35 : 1) : 0.5;
        drawCookieBody(ctx, R, this.stats, this.alive);
        // Outline needs its own path now that the body is two filled halves.
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.lineWidth = this.isLocal ? 4 : 2;
        ctx.strokeStyle = this.isLocal ? '#f1c40f' : '#2c3e50';
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Facing indicator — small triangle pointing the way kicks land.
        ctx.rotate(facingAngle);
        ctx.beginPath();
        ctx.moveTo(R + 12, 0);
        ctx.lineTo(R + 2, -6);
        ctx.lineTo(R + 2, 6);
        ctx.closePath();
        ctx.fillStyle = this.alive ? '#f1c40f' : '#7f8c8d';
        ctx.fill();
        drawCharacterWeapon(ctx, R, this.stats, this.alive);

        ctx.restore();

        // HP bar above the player, in world space
        const barW = 40, barH = 5;
        const hpBarY = this.y - R - 8 - barH;
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(this.x - barW / 2, hpBarY, barW, barH);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW / 2, hpBarY, barW * (this.hp / this.maxHp), barH);
    }
}
