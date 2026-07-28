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

// Skills whose self-aura lasts the whole buff instead of a quick 350ms flash,
// because the buff being up is information the player needs while fighting.
const SKILL_FULL_DURATION_EFFECTS = ['spin_heal', 'guard_stance'];

// How far off the body centre this swing's corridor sits, in the frame already
// rotated to `facing` (+y = the player's right). Only dual_spear uses it; keep in
// step with resolveAttack's originX/originY in server.js.
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

function moveSpeedFor(stats, now, speedBoostUntil, awakenUntil, butterflyOn, equipSpeed) {
    // 나비모드 runs until it is switched off, so it wins over any timer.
    if (butterflyOn && stats.ultimateType === 'butterfly_mode') {
        return withEquipSpeed(stats.speed + stats.ultimateSpeedBonus, equipSpeed);
    }
    if (now < (speedBoostUntil || 0)) {
        if (stats.skillType === 'speed_boost') return withEquipSpeed(stats.skillSpeedValue, equipSpeed);
        if (stats.skillType === 'charge_dash') return withEquipSpeed(stats.speed + stats.skillSpeedBonus, equipSpeed);
        if (stats.ultimateType === 'undying_soul') return withEquipSpeed(stats.speed + stats.ultimateSpeedBonus, equipSpeed);
        if (stats.ultimateType === 'great_slash') return withEquipSpeed(stats.speed + stats.ultimateSpeedBonus, equipSpeed);
    }
    if (stats.ultimateType === 'awakening' && now < (awakenUntil || 0)) {
        return stats.speed * stats.ultimateSpeedMultiplier;
    }
    return stats.speed;
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
    }

    get stats() {
        return SHARED.CHARACTERS[this.charType];
    }

    canAttack(now) {
        if (!this.alive) return false;
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
        const speed = moveSpeedFor(this.stats, performance.now(), this.speedBoostUntil, this.awakenUntil, this.butterflyOn, this.equipSpeed);
        let dx = 0, dy = 0;
        if (keys['w'] || keys['W']) dy -= speed;
        if (keys['s'] || keys['S']) dy += speed;
        if (keys['a'] || keys['A']) dx -= speed;
        if (keys['d'] || keys['D']) dx += speed;
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
        if (this.stats.skillType === 'guard_stance') {
            this.skillEffectUntil = 0; // attacking breaks the guard stance
        }
    }

    triggerSkillEffect() {
        this.lastSkillClientTime = performance.now();
        const duration = SKILL_FULL_DURATION_EFFECTS.includes(this.stats.skillType)
            ? this.stats.skillDurationMs : 350;
        this.skillEffectUntil = performance.now() + duration;
        if (this.stats.skillType === 'speed_boost' || this.stats.skillType === 'charge_dash') {
            this.speedBoostUntil = performance.now() + this.stats.skillSpeedDurationMs;
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

        if (now < this.attackEffectUntil) {
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

        ctx.globalAlpha = this.alive ? 1 : 0.5;
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
