class Boss {
    constructor(bossId) {
        this.bossId = bossId;
        this.def = SHARED.BOSS_DEFS[bossId];
        this.hp = 0;
        this.maxHp = 0;
        this.state = 'idle'; // idle | telegraph | active
        this.pattern = null;
        this.stateStartAt = 0;
        this.runtime = {};
    }

    setHp(hp, maxHp) {
        this.hp = hp;
        if (maxHp !== undefined) this.maxHp = maxHp;
    }

    onTelegraph({ pattern, telegraphMs }) {
        this.state = 'telegraph';
        this.pattern = pattern;
        this.stateStartAt = performance.now();
        this.runtime = { telegraphMs };
    }

    onAttack(data) {
        this.state = 'active';
        this.pattern = data.pattern;
        this.stateStartAt = performance.now();
        this.runtime = data;
    }

    // Called every frame; flips back to idle once the local visual duration
    // for the current attack has elapsed (server drives the *real* timing,
    // this is purely cosmetic so the effect doesn't linger forever).
    update(now) {
        if (this.state === 'idle') return;
        const elapsed = now - this.stateStartAt;
        const patternDef = this.def.patterns[this.pattern];
        if (this.state === 'telegraph') {
            if (elapsed >= patternDef.telegraphMs) {
                // Server will send bossAttack right around now; if it's late,
                // fall back to idle so we don't get stuck mid-telegraph.
                if (elapsed >= patternDef.telegraphMs + 300) this.state = 'idle';
            }
            return;
        }
        if (this.state === 'active') {
            let activeDurationMs = 300; // slam: instant flash
            if (this.pattern === 'spray') activeDurationMs = patternDef.travelMs;
            else if (this.pattern === 'sweep') activeDurationMs = patternDef.durationMs;
            if (elapsed >= activeDurationMs) this.state = 'idle';
        }
    }

    draw(ctx, now) {
        const R = SHARED.BOSS_RADIUS;
        const elapsed = now - this.stateStartAt;

        // Danger zone telegraphs / active effects, drawn under the boss body.
        if (this.state === 'telegraph' && this.pattern === 'slam') {
            const patternDef = this.def.patterns.slam;
            const t = Math.min(1, elapsed / patternDef.telegraphMs);
            ctx.beginPath();
            ctx.arc(0, 0, patternDef.radius * t, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(231, 76, 60, ${0.15 + 0.2 * t})`;
            ctx.fill();
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (this.state === 'active' && this.pattern === 'slam') {
            const patternDef = this.def.patterns.slam;
            ctx.beginPath();
            ctx.arc(0, 0, patternDef.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(231, 76, 60, 0.4)';
            ctx.fill();
        } else if (this.pattern === 'spray' && (this.state === 'telegraph' || this.state === 'active')) {
            const patternDef = this.def.patterns.spray;
            if (this.state === 'telegraph') {
                ctx.beginPath();
                ctx.arc(0, 0, R + 10, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(230, 126, 34, 0.9)';
                ctx.lineWidth = 4;
                ctx.stroke();
            } else if (this.runtime.angles) {
                const radius = (elapsed / 1000) * this.runtime.speed;
                ctx.fillStyle = '#e67e22';
                this.runtime.angles.forEach(angle => {
                    const px = Math.cos(angle) * radius;
                    const py = Math.sin(angle) * radius;
                    if (radius > SHARED.ARENA_RADIUS) return;
                    ctx.beginPath();
                    ctx.arc(px, py, patternDef.hitRadius, 0, Math.PI * 2);
                    ctx.fill();
                });
            }
        } else if (this.pattern === 'sweep' && (this.state === 'telegraph' || this.state === 'active')) {
            if (this.state === 'telegraph') {
                ctx.beginPath();
                ctx.arc(0, 0, R + 20, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(241, 196, 15, 0.9)';
                ctx.lineWidth = 4;
                ctx.stroke();
            } else if (this.runtime.startAngle !== undefined) {
                const patternDef = this.def.patterns.sweep;
                const angle = this.runtime.startAngle + (elapsed / this.runtime.durationMs) * Math.PI * 2;
                ctx.strokeStyle = 'rgba(241, 196, 15, 0.85)';
                ctx.lineWidth = 14;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(angle) * SHARED.ARENA_RADIUS, Math.sin(angle) * SHARED.ARENA_RADIUS);
                ctx.stroke();
            }
        }

        // Boss body
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.fillStyle = this.state === 'telegraph' ? '#95a5a6' : '#7f8c8d';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#2c3e50';
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.def.name, 0, 0);
    }
}
