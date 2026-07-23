class Player {
    constructor(id, charType, x, y, isLocal) {
        this.id = id;
        this.charType = SHARED.CHARACTERS[charType] ? charType : 'kicker';
        this.x = x;
        this.y = y;
        this.facing = 'down';
        this.isLocal = isLocal;

        const stats = SHARED.CHARACTERS[this.charType];
        this.hp = stats.health;
        this.maxHp = stats.health;
        this.alive = true;

        this.lastAttackClientTime = -Infinity;
        this.attackEffectUntil = 0; // performance.now() timestamp for lunge animation

        this.lastSkillClientTime = -Infinity;
        this.skillEffectUntil = 0;
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

        if (dx > 0 && dy > 0) this.facing = 'downright';
        else if (dx > 0 && dy < 0) this.facing = 'upright';
        else if (dx < 0 && dy > 0) this.facing = 'downleft';
        else if (dx < 0 && dy < 0) this.facing = 'upleft';
        else if (dx > 0) this.facing = 'right';
        else if (dx < 0) this.facing = 'left';
        else if (dy > 0) this.facing = 'down';
        else if (dy < 0) this.facing = 'up';

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

    triggerAttackEffect() {
        this.lastAttackClientTime = performance.now();
        this.attackEffectUntil = performance.now() + 180;
    }

    triggerSkillEffect() {
        this.lastSkillClientTime = performance.now();
        this.skillEffectUntil = performance.now() + 350;
    }

    draw(ctx, now) {
        const R = SHARED.PLAYER_RADIUS;
        const [fx, fy] = SHARED.FACING_VECTORS[this.facing] || [1, 0];
        const facingAngle = Math.atan2(fy, fx);
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
