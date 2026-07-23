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

        this.lastAttackClientTime = -Infinity;
        this.attackEffectUntil = 0; // performance.now() timestamp for lunge animation

        this.lastSkillClientTime = -Infinity;
        this.skillEffectUntil = 0;

        this.lastUltimateClientTime = -Infinity;
        this.ultimateEffectUntil = 0;
        this.healEffectUntil = 0;
    }

    get stats() {
        return SHARED.CHARACTERS[this.charType];
    }

    canAttack(now) {
        return this.alive && now - this.lastAttackClientTime >= this.stats.attackCooldown;
    }

    canUseSkill(now) {
        return this.alive && !!this.stats.skillType && now - this.lastSkillClientTime >= this.stats.skillCooldown;
    }

    canUseUltimate(now) {
        return this.alive && !!this.stats.ultimateType && now - this.lastUltimateClientTime >= this.stats.ultimateCooldownMs;
    }

    // Local-only movement prediction; server remains the source of truth for
    // other players (driven by playerMoved) and for all damage.
    updateLocal(keys) {
        if (!this.alive) return false;
        const speed = this.stats.speed;
        let dx = 0, dy = 0;
        if (keys['w'] || keys['W']) dy -= speed;
        if (keys['s'] || keys['S']) dy += speed;
        if (keys['a'] || keys['A']) dx -= speed;
        if (keys['d'] || keys['D']) dx += speed;
        if (dx === 0 && dy === 0) return false;

        const nx = this.x + dx;
        const ny = this.y + dy;
        const maxDist = SHARED.ARENA_RADIUS - SHARED.PLAYER_RADIUS;
        const dist = Math.hypot(nx, ny);
        if (dist <= maxDist) {
            this.x = nx; this.y = ny;
        } else {
            const scale = maxDist / dist;
            this.x = nx * scale; this.y = ny * scale;
        }
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
    }

    triggerSkillEffect() {
        this.lastSkillClientTime = performance.now();
        this.skillEffectUntil = performance.now() + 350;
    }

    triggerUltimateEffect() {
        this.lastUltimateClientTime = performance.now();
        this.ultimateEffectUntil = performance.now() + (this.stats.ultimateDurationMs || 0);
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
            const range = this.stats.attackRange;
            const width = this.stats.attackWidth || 40;
            ctx.save();
            ctx.rotate(facingAngle);
            ctx.fillStyle = 'rgba(241, 196, 15, 0.35)';
            ctx.fillRect(R, -width / 2, range, width);
            ctx.strokeStyle = 'rgba(241, 196, 15, 0.9)';
            ctx.lineWidth = 2;
            ctx.strokeRect(R, -width / 2, range, width);
            ctx.restore();
        }

        if (now < this.skillEffectUntil) {
            ctx.beginPath();
            ctx.arc(0, 0, R + 26, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.85)';
            ctx.lineWidth = 6;
            ctx.stroke();
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

        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.fillStyle = this.alive ? this.stats.color : '#7f8c8d';
        ctx.globalAlpha = this.alive ? 1 : 0.5;
        ctx.fill();
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

        // HP bar under the player, in world space
        const barW = 40, barH = 5;
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(this.x - barW / 2, this.y + R + 8, barW, barH);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - barW / 2, this.y + R + 8, barW * (this.hp / this.maxHp), barH);
    }
}
