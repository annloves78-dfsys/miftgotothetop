// ==================== Guest raid ====================
// Square field, a fixed boss (there is no boss list to pick from), and a party
// of GUEST_PARTY_SIZE cookies you swap between mid-fight -- each cookie keeps
// its own hp across swaps, so benching a hurt one does not heal it.
//
// Loaded after main.js, so it shares that file's globals (socket, showScreen,
// gameData, charIconBackground, autoAimActive, ...) through the page's single
// global scope.

const guestRaidModeCard = document.getElementById('guest-raid-mode-card');
const guestPartySlotsEl = document.getElementById('guest-party-slots');
const guestPartyHintEl = document.getElementById('guest-party-hint');
const guestRosterEl = document.getElementById('guest-roster');
const guestBossPowerEl = document.getElementById('guest-boss-power');
const guestBossHpSpecEl = document.getElementById('guest-boss-hp');
const guestMultiBtn = document.getElementById('guest-multi-btn');
const guestSoloBtn = document.getElementById('guest-solo-btn');
const guestLeaveBtn = document.getElementById('guest-leave-btn');
const backFromGuestDetailBtn = document.getElementById('back-from-guest-detail-btn');
const guestPartnerPreview = document.getElementById('guest-partner-preview');
const guestPartnerIcon = document.getElementById('guest-partner-icon');
const guestPartnerName = document.getElementById('guest-partner-name');
const guestCanvas = document.getElementById('guestCanvas');
const guestCtx = guestCanvas.getContext('2d');
const guestBossHpBar = document.getElementById('guest-boss-hp-bar');
const guestMyHpBar = document.getElementById('guest-my-hp-bar');
const guestMyShieldBadge = document.getElementById('guest-my-shield-badge');
const guestPartnerHpContainer = document.getElementById('guest-partner-hp-container');
const guestPartnerHpBar = document.getElementById('guest-partner-hp-bar');
const guestMySkillCdEl = document.getElementById('guest-my-skill-cd');
const guestMyUltimateCdEl = document.getElementById('guest-my-ultimate-cd');
const guestPartyBarEl = document.getElementById('guest-party-bar');
const guestCollapseOverlay = document.getElementById('guest-collapse-overlay');
const guestFightMenuBtn = document.getElementById('guest-fight-menu-btn');
const guestFightSettings = document.getElementById('guest-fight-settings');
const guestFightLeaveBtn = document.getElementById('guest-fight-leave-btn');

const GUEST_ID = 'guest1'; // the only guest raid so far, and it is never chosen from a list

let guestParty = [];        // cookies picked on the detail screen
let guestIsMulti = false;   // multiplayer shows ONE cookie each, not four
let guestPhase = 'idle';    // 'idle' | 'searching' | 'matched'
let guestMyReady = false;
let guestState = null;      // live fight state from the server
let guestLoopHandle = null;
let guestMouseX = null, guestMouseY = null;
let guestTelegraphs = [];   // red danger markers
let guestHitFlashes = [];   // the strike itself
let guestStuckSpears = [];
let guestMagmaZones = [];
let guestImpacts = [];
let guestIsTargetingUltimate = false;
let guestLastMoveEmit = 0;
let guestLocal = null;      // local prediction of my own cookie
let guestQuakeUntil = 0;

function guestPartyCapacity() {
    return guestIsMulti ? 1 : SHARED.GUEST_PARTY_SIZE;
}

function renderGuestPartySlots() {
    const cap = guestPartyCapacity();
    guestPartySlotsEl.innerHTML = '';
    for (let i = 0; i < cap; i++) {
        const id = guestParty[i];
        const stats = id ? SHARED.CHARACTERS[id] : null;
        const slot = document.createElement('div');
        slot.className = 'guest-party-slot' + (stats ? ' filled' : '');
        const circle = stats
            ? `<div class="slot-circle" style="background:${charIconBackground(stats)}"></div>`
            : '<div class="slot-circle">+</div>';
        slot.innerHTML = circle + `<div class="slot-name">${stats ? (stats.shortName || stats.name) : ''}</div>`;
        if (stats) slot.addEventListener('click', () => { guestParty.splice(i, 1); renderGuestDetail(); });
        guestPartySlotsEl.appendChild(slot);
    }
    guestPartyHintEl.textContent = guestIsMulti
        ? '멀티플레이는 캐릭터 1명만 데려갑니다.'
        : `캐릭터를 눌러 ${cap}명을 정하세요. (${guestParty.length}/${cap})`;
}

function renderGuestRoster() {
    guestRosterEl.innerHTML = '';
    charactersByGradeDesc().forEach(([id, stats]) => {
        if (!isCharacterUnlocked(id)) return;
        const row = document.createElement('div');
        row.className = 'guest-roster-item' + (guestParty.includes(id) ? ' picked' : '');
        row.innerHTML = `<div class="guest-roster-swatch" style="background:${charIconBackground(stats)}"></div>`
            + `<div class="guest-roster-name">${stats.name}</div>`;
        row.addEventListener('click', () => {
            const at = guestParty.indexOf(id);
            if (at >= 0) guestParty.splice(at, 1);
            else if (guestParty.length < guestPartyCapacity()) guestParty.push(id);
            renderGuestDetail();
        });
        guestRosterEl.appendChild(row);
    });
}

function renderGuestDetail() {
    const def = SHARED.GUEST_BOSS_DEFS[GUEST_ID];
    guestBossPowerEl.textContent = `${def.recommendedPower} (${SHARED.GUEST_PARTY_SIZE}명 합계)`;
    guestBossHpSpecEl.textContent = def.maxHp;
    if (guestParty.length > guestPartyCapacity()) guestParty.length = guestPartyCapacity();
    renderGuestPartySlots();
    renderGuestRoster();
    if (guestPhase === 'idle') {
        const ready = guestParty.length === guestPartyCapacity();
        guestMultiBtn.disabled = false; // multiplayer re-cuts the party to 1 on click
        guestSoloBtn.disabled = !ready;
    }
}

function resetGuestActions() {
    guestPhase = 'idle';
    guestMyReady = false;
    guestMultiBtn.textContent = '멀티플레이';
    guestSoloBtn.textContent = '솔로플레이';
    guestMultiBtn.classList.remove('hidden');
    guestSoloBtn.classList.remove('hidden');
    guestLeaveBtn.classList.add('hidden');
    guestPartnerPreview.classList.add('hidden');
    renderGuestDetail();
}

function leaveGuestRaidIfAny() {
    if (guestPhase !== 'idle') socket.emit('leaveGuestRaid');
    resetGuestActions();
}

function openGuestDetail() {
    leaveGuestRaidIfAny();
    guestIsMulti = false;
    // Seed with the lobby's selected cookie so there's a sensible starting point.
    if (!guestParty.length && gameData.selectedCharacter) guestParty = [gameData.selectedCharacter];
    renderGuestDetail();
    showScreen('guestDetail');
}

guestRaidModeCard.addEventListener('click', openGuestDetail);
backFromGuestDetailBtn.addEventListener('click', () => {
    leaveGuestRaidIfAny();
    showScreen('modeSelect');
});
guestLeaveBtn.addEventListener('click', () => leaveGuestRaidIfAny());

function guestStartClick(isMulti) {
    if (guestPhase === 'idle') {
        // Switching to multiplayer cuts the party down to one cookie (four each
        // would be a mess on screen). That first click only re-cuts and shows the
        // new party -- always -- so you get to pick WHICH cookie comes along
        // before a second click actually queues.
        if (guestIsMulti !== isMulti) {
            guestIsMulti = isMulti;
            renderGuestDetail();
            return;
        }
        if (guestParty.length !== guestPartyCapacity()) return;
        if (isMulti) {
            guestPhase = 'searching';
            guestMultiBtn.disabled = true;
            guestSoloBtn.disabled = true;
            guestLeaveBtn.classList.remove('hidden');
            guestMultiBtn.textContent = '대기중...';
            socket.emit('joinGuestRaid', { guestId: GUEST_ID, party: guestParty });
        } else {
            guestMultiBtn.disabled = true;
            guestSoloBtn.disabled = true;
            socket.emit('joinGuestRaid', { guestId: GUEST_ID, party: guestParty, solo: true });
            socket.emit('startGuestRaid');
        }
    } else if (guestPhase === 'matched' && !guestMyReady) {
        guestMyReady = true;
        guestMultiBtn.disabled = true;
        guestMultiBtn.textContent = '플레이 (대기중)';
        socket.emit('guestPlayerReady');
    }
}
guestMultiBtn.addEventListener('click', () => guestStartClick(true));
guestSoloBtn.addEventListener('click', () => guestStartClick(false));

socket.on('guestRoomUpdate', ({ count, players }) => {
    if (count < 2) return;
    guestPhase = 'matched';
    guestMultiBtn.textContent = guestMyReady ? '플레이 (대기중)' : '플레이';
    guestMultiBtn.disabled = guestMyReady;
    guestSoloBtn.classList.add('hidden');
    const other = Object.entries(players).find(([id]) => id !== socket.id);
    if (!other) return;
    const stats = SHARED.CHARACTERS[other[1].charType] || SHARED.CHARACTERS.kicker;
    guestPartnerIcon.style.background = charIconBackground(stats);
    guestPartnerName.textContent = stats.name;
    guestPartnerPreview.classList.remove('hidden');
});

// ---------------- the fight ----------------
function guestMe() {
    return guestState && guestState.players ? guestState.players[socket.id] : null;
}

function guestStats() {
    const me = guestMe();
    return SHARED.CHARACTERS[me ? me.charType : 'kicker'] || SHARED.CHARACTERS.kicker;
}

function renderGuestPartyBar() {
    const me = guestMe();
    if (!me) { guestPartyBarEl.innerHTML = ''; return; }
    guestPartyBarEl.innerHTML = '';
    me.party.forEach((id, i) => {
        const stats = SHARED.CHARACTERS[id];
        const down = !me.partyAlive[i];
        const el = document.createElement('div');
        el.className = 'guest-party-member' + (i === me.active ? ' active' : '') + (down ? ' down' : '');
        const pct = Math.max(0, me.partyHp[i] / me.partyMaxHp[i]) * 100;
        el.innerHTML = `<div class="pm-circle" style="background:${charIconBackground(stats)}"></div>`
            + `<div class="pm-bar"><div class="pm-bar-fill" style="width:${pct}%"></div></div>`
            + `<div class="pm-hp">${me.partyHp[i]}/${me.partyMaxHp[i]}</div>`;
        if (!down && i !== me.active) el.addEventListener('click', () => socket.emit('guestSwap', { index: i }));
        guestPartyBarEl.appendChild(el);
    });
}

function updateGuestHpBars() {
    if (!guestState) return;
    guestBossHpBar.style.width = `${Math.max(0, guestState.bossHp / guestState.bossMaxHp) * 100}%`;
    const me = guestMe();
    if (me) {
        guestMyHpBar.style.width = `${Math.max(0, me.hp / me.maxHp) * 100}%`;
        guestMyShieldBadge.classList.toggle('hidden', !(me.shieldHp > 0));
    }
    const other = Object.entries(guestState.players).find(([id]) => id !== socket.id);
    guestPartnerHpContainer.classList.toggle('hidden', !other);
    if (other) guestPartnerHpBar.style.width = `${Math.max(0, other[1].hp / other[1].maxHp) * 100}%`;
    renderGuestPartyBar();
}

socket.on('guestStarted', (data) => {
    guestState = {
        bossHp: data.bossHp, bossMaxHp: data.bossMaxHp,
        bossX: data.bossX, bossY: data.bossY, bossFacing: Math.PI / 2,
        players: data.players
    };
    const me = data.players[socket.id];
    guestLocal = me ? {
        x: me.x, y: me.y, facing: -Math.PI / 2,
        lastAttackClientTime: -Infinity, lastSkillClientTime: -Infinity, lastUltimateClientTime: -Infinity,
        attackEffectUntil: 0, skillEffectUntil: 0, ultimateEffectUntil: 0,
        speedBoostUntil: 0, awakenUntil: 0, rapidStrikeUntil: 0,
        comboStage: 0, attackEffectStage: null, spearSide: 0, attackEffectSide: 0
    } : null;
    guestTelegraphs = []; guestHitFlashes = []; guestStuckSpears = [];
    guestMagmaZones = []; guestImpacts = [];
    guestIsTargetingUltimate = false;
    guestQuakeUntil = 0;
    guestCollapseOverlay.classList.add('hidden');
    guestFightSettings.classList.add('hidden');
    syncGuestMobileIcons(me ? me.charType : 'kicker');
    updateGuestHpBars();
    showScreen('guestFight');
    startGuestLoop();
});

socket.on('guestTick', (data) => {
    if (!guestState) return;
    guestState.bossHp = data.bossHp;
    guestState.bossFacing = data.bossFacing;
    guestState.players = data.players;
    guestStuckSpears = data.stuckSpears;
    updateGuestHpBars();
});

socket.on('guestBossDamaged', ({ bossHp }) => {
    if (!guestState) return;
    guestState.bossHp = bossHp;
    updateGuestHpBars();
});
socket.on('guestPlayerDamaged', (d) => {
    if (!guestState || !guestState.players[d.id]) return;
    Object.assign(guestState.players[d.id], d);
    updateGuestHpBars();
});
socket.on('guestPlayerHealed', (d) => {
    if (!guestState || !guestState.players[d.id]) return;
    Object.assign(guestState.players[d.id], d);
    updateGuestHpBars();
});
socket.on('guestPlayerShielded', (d) => {
    if (!guestState || !guestState.players[d.id]) return;
    guestState.players[d.id].shieldHp = d.shieldHp;
    updateGuestHpBars();
});
socket.on('guestSwapped', (d) => {
    if (!guestState || !guestState.players[d.id]) return;
    Object.assign(guestState.players[d.id], d);
    if (d.id === socket.id) syncGuestMobileIcons(d.charType);
    updateGuestHpBars();
});
socket.on('guestForcedSwap', (d) => {
    if (!guestState || !guestState.players[d.id]) return;
    guestState.players[d.id].active = d.active;
    guestState.players[d.id].charType = d.charType;
    if (d.id === socket.id) syncGuestMobileIcons(d.charType);
    updateGuestHpBars();
});

socket.on('guestTelegraph', (t) => {
    guestTelegraphs.push({ ...t, until: performance.now() + t.telegraphMs });
});
socket.on('guestWindup', () => {
    // 크게 베기 is 예고 없이 on purpose: no danger zone, only the boss flares.
    guestHitFlashes.push({ windup: true, until: performance.now() + 250 });
});
socket.on('guestSkillHit', (h) => {
    guestHitFlashes.push({ ...h, until: performance.now() + 260 });
});
socket.on('guestSpearsCleared', () => { guestStuckSpears = []; });
socket.on('guestUltimateImpact', (d) => {
    guestImpacts.push({ ...d, until: performance.now() + 400 });
});
socket.on('guestMagmaZonePlaced', (d) => {
    guestMagmaZones.push({ ...d, until: performance.now() + d.durationMs });
});
socket.on('guestEarthquake', () => { guestQuakeUntil = performance.now() + QUAKE_DURATION_MS; });

socket.on('guestFloorCollapse', () => {
    guestCollapseOverlay.classList.remove('hidden');
    guestQuakeUntil = performance.now() + 2600;
});

socket.on('guestResult', ({ result }) => {
    stopGuestLoop();
    guestState = null;
    guestCollapseOverlay.classList.add('hidden');
    resultTitle.textContent = result === 'phase1' ? '1차 격파!' : (result === 'lose' ? '패배...' : '나감');
    resultDesc.textContent = result === 'phase1'
        ? '번개지옥맛 쿠키는 쓰러지지 않았습니다. 2차 레이드는 준비 중입니다.'
        : (result === 'lose' ? '파티가 전멸했습니다.' : '');
    resetGuestActions();
    showScreen('result');
});

guestFightMenuBtn.addEventListener('click', () => guestFightSettings.classList.toggle('hidden'));
guestFightLeaveBtn.addEventListener('click', () => {
    socket.emit('leaveGuestRaid');
    stopGuestLoop();
    guestState = null;
    resetGuestActions();
    showScreen('guestDetail');
});

// ---------------- input ----------------
guestCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
guestCanvas.addEventListener('mousemove', (e) => {
    const rect = guestCanvas.getBoundingClientRect();
    guestMouseX = (e.clientX - rect.left) * (guestCanvas.width / rect.width);
    guestMouseY = (e.clientY - rect.top) * (guestCanvas.height / rect.height);
});
guestCanvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        if (guestIsTargetingUltimate) confirmGuestUltimateTarget();
        else if (autoAimActive()) fireGuestAutoAimedAttack();
        else tryGuestAttack();
    } else if (e.button === 2) {
        tryGuestUseSkill();
    }
});

function guestWorldFromMouse() {
    return { x: guestMouseX - guestCanvas.width / 2, y: guestMouseY - guestCanvas.height / 2 };
}

function tryGuestAttack() {
    if (!guestLocal || !guestState) return;
    const stats = guestStats();
    const now = performance.now();
    const rapid = stats.ultimateType === 'awakening_rapid' && now < guestLocal.rapidStrikeUntil;
    let cd = stats.attackCooldown;
    if (rapid) cd = stats.ultimateRapidCooldown;
    else if (stats.attackType === 'combo_two_stage' && guestLocal.comboStage === 1) cd = stats.comboFollowupCooldown;
    if (now - guestLocal.lastAttackClientTime < cd) return;
    guestLocal.lastAttackClientTime = now;
    guestLocal.attackEffectUntil = now + 180;
    if (stats.attackType === 'combo_two_stage') {
        guestLocal.attackEffectStage = stats.attackStages[guestLocal.comboStage || 0];
        guestLocal.comboStage = ((guestLocal.comboStage || 0) + 1) % stats.attackStages.length;
    } else if (stats.attackType === 'dual_spear') {
        guestLocal.attackEffectSide = guestLocal.spearSide || 0;
        guestLocal.spearSide = (guestLocal.spearSide || 0) === 0 ? 1 : 0;
    }
    if (stats.skillType === 'guard_stance') guestLocal.skillEffectUntil = 0;
    socket.emit('guestPlayerAttack');
}

// The server judges against the last facing it received, so the aim has to be
// sent before the swing (same rule as everywhere else).
function fireGuestAutoAimedAttack() {
    if (!guestLocal || !guestState) return;
    guestLocal.facing = Math.atan2(guestState.bossY - guestLocal.y, guestState.bossX - guestLocal.x);
    socket.emit('guestPlayerMove', { x: guestLocal.x, y: guestLocal.y, facing: guestLocal.facing });
    tryGuestAttack();
}

function tryGuestUseSkill() {
    if (!guestLocal) return;
    const stats = guestStats();
    const now = performance.now();
    if (!stats.skillType || now - guestLocal.lastSkillClientTime < stats.skillCooldown) return;
    guestLocal.lastSkillClientTime = now;
    guestLocal.skillEffectUntil = now
        + (SKILL_FULL_DURATION_EFFECTS.includes(stats.skillType) ? stats.skillDurationMs : 350);
    if (stats.skillType === 'speed_boost') guestLocal.speedBoostUntil = now + stats.skillSpeedDurationMs;
    if (stats.skillType === 'earthquake') guestQuakeUntil = now + QUAKE_DURATION_MS;
    socket.emit('guestPlayerSkill');
}

function guestCanUseUltimate(now) {
    const stats = guestStats();
    return !!stats.ultimateType && now - guestLocal.lastUltimateClientTime >= stats.ultimateCooldownMs;
}

function tryGuestUseUltimate() {
    if (!guestLocal) return;
    const stats = guestStats();
    const now = performance.now();
    if (!guestCanUseUltimate(now)) return;
    guestLocal.lastUltimateClientTime = now;
    guestLocal.ultimateEffectUntil = now + (stats.ultimateDurationMs || 0);
    if (stats.ultimateType === 'awakening') guestLocal.awakenUntil = now + stats.ultimateDurationMs;
    if (stats.ultimateType === 'awakening_rapid') guestLocal.rapidStrikeUntil = now + stats.ultimateDurationMs;
    if (stats.ultimateType === 'undying_soul') guestLocal.speedBoostUntil = now + stats.ultimateDurationMs;
    socket.emit('guestPlayerUltimate');
}

function guestHandleUltimateKey() {
    if (!guestLocal) return;
    const stats = guestStats();
    if (!isTargetedUltimate(stats.ultimateType)) { tryGuestUseUltimate(); return; }
    if (mobileControlsEnabled) {
        if (!guestCanUseUltimate(performance.now())) return;
        guestLocal.lastUltimateClientTime = performance.now();
        socket.emit('guestPlayerUltimate',
            mobileUltimateTarget(guestLocal.x, guestLocal.y, guestLocal.facing, stats));
        return;
    }
    if (guestIsTargetingUltimate) { guestIsTargetingUltimate = false; return; }
    if (!guestCanUseUltimate(performance.now())) return;
    guestIsTargetingUltimate = true;
}

function confirmGuestUltimateTarget() {
    guestIsTargetingUltimate = false;
    if (!guestLocal || guestMouseX === null) return;
    if (!guestCanUseUltimate(performance.now())) return;
    guestLocal.lastUltimateClientTime = performance.now();
    const w = guestWorldFromMouse();
    socket.emit('guestPlayerUltimate', { targetX: w.x, targetY: w.y });
}

// Number keys swap party members; 1..GUEST_PARTY_SIZE.
document.addEventListener('keydown', (e) => {
    if (!guestState || screens.guestFight.classList.contains('hidden')) return;
    const n = parseInt(e.key, 10);
    const me = guestMe();
    if (me && n >= 1 && n <= me.party.length) {
        const idx = n - 1;
        if (idx !== me.active && me.partyAlive[idx]) socket.emit('guestSwap', { index: idx });
        return;
    }
    if (e.key === 'f' || e.key === 'F') guestHandleUltimateKey();
    if (e.key === 'q' || e.key === 'Q') tryGuestUseSkill();
});

// ---------------- loop + rendering ----------------
function startGuestLoop() {
    stopGuestLoop();
    guestLoopHandle = requestAnimationFrame(guestFrame);
}
function stopGuestLoop() {
    if (guestLoopHandle) cancelAnimationFrame(guestLoopHandle);
    guestLoopHandle = null;
}

function updateGuestCooldownDisplay(now) {
    const stats = guestStats();
    let skillRemain = 0, ultRemain = 0;
    if (stats.skillType) {
        skillRemain = Math.max(0, stats.skillCooldown - (now - guestLocal.lastSkillClientTime)) / 1000;
        guestMySkillCdEl.textContent = skillRemain > 0.05 ? `${skillRemain.toFixed(1)}s` : '사용가능';
    }
    if (stats.ultimateType) {
        ultRemain = Math.max(0, stats.ultimateCooldownMs - (now - guestLocal.lastUltimateClientTime)) / 1000;
        guestMyUltimateCdEl.textContent = ultRemain > 0.05 ? `${ultRemain.toFixed(1)}s` : '사용가능';
    }
    syncGuestMobileCooldowns(skillRemain, ultRemain);
}

function guestFrame() {
    const now = performance.now();
    const me = guestMe();
    if (guestLocal && me && me.alive) {
        const stats = guestStats();
        const speed = moveSpeedFor(stats, now, guestLocal.speedBoostUntil, guestLocal.awakenUntil);
        let dx = 0, dy = 0;
        if (keys['w'] || keys['W']) dy -= speed;
        if (keys['s'] || keys['S']) dy += speed;
        if (keys['a'] || keys['A']) dx -= speed;
        if (keys['d'] || keys['D']) dx += speed;
        if (dx !== 0 || dy !== 0) {
            // Square field: a box clamp, not a radius.
            guestLocal.x = Math.max(-SHARED.GUEST_ARENA_HALF_W, Math.min(SHARED.GUEST_ARENA_HALF_W, guestLocal.x + dx));
            guestLocal.y = Math.max(-SHARED.GUEST_ARENA_HALF_H, Math.min(SHARED.GUEST_ARENA_HALF_H, guestLocal.y + dy));
        }
        if (mobileControlsEnabled) {
            if (joystickFacing !== null) guestLocal.facing = joystickFacing;
        } else if (autoAimEnabled) {
            guestLocal.facing = Math.atan2(guestState.bossY - guestLocal.y, guestState.bossX - guestLocal.x);
        } else if (guestMouseX !== null) {
            const w = guestWorldFromMouse();
            guestLocal.facing = Math.atan2(w.y - guestLocal.y, w.x - guestLocal.x);
        }
        if (now - guestLastMoveEmit > 33) {
            socket.emit('guestPlayerMove', { x: guestLocal.x, y: guestLocal.y, facing: guestLocal.facing });
            guestLastMoveEmit = now;
        }
        updateGuestCooldownDisplay(now);
    }
    guestRender(now);
    guestLoopHandle = requestAnimationFrame(guestFrame);
}

// The boss is a cookie body with two spears crossed behind it, rather than the
// plain circle the story monsters use.
function drawGuestBoss(ctx, def, stats, facing, now) {
    const r = def.radius;
    // Spears first so they sit behind the body.
    ctx.save();
    ctx.rotate(facing);
    [-0.5, 0.5].forEach(off => {
        ctx.save();
        ctx.rotate(off);
        ctx.strokeStyle = '#bdc3c7';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, 0);
        ctx.lineTo(r + 62, 0);
        ctx.stroke();
        // Head
        ctx.fillStyle = '#ecf0f1';
        ctx.beginPath();
        ctx.moveTo(r + 86, 0);
        ctx.lineTo(r + 58, -11);
        ctx.lineTo(r + 58, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    });
    ctx.restore();

    drawCookieBody(ctx, r, stats, true);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#2c3e50';
    ctx.stroke();
}

function guestRender(now) {
    guestCtx.clearRect(0, 0, guestCanvas.width, guestCanvas.height);
    guestCtx.save();
    const q = quakeOffset(now, guestQuakeUntil);
    guestCtx.translate(guestCanvas.width / 2 + q.x, guestCanvas.height / 2 + q.y);

    const HW = SHARED.GUEST_ARENA_HALF_W, HH = SHARED.GUEST_ARENA_HALF_H;
    // The big square field.
    guestCtx.fillStyle = '#2b2233';
    guestCtx.fillRect(-HW, -HH, HW * 2, HH * 2);
    guestCtx.strokeStyle = 'rgba(241, 196, 15, 0.5)';
    guestCtx.lineWidth = 4;
    guestCtx.strokeRect(-HW, -HH, HW * 2, HH * 2);

    if (!guestState) { guestCtx.restore(); return; }
    const def = SHARED.GUEST_BOSS_DEFS[GUEST_ID];

    // Magma zones sit under everything.
    guestMagmaZones = guestMagmaZones.filter(z => now < z.until);
    guestMagmaZones.forEach(z => {
        guestCtx.beginPath();
        guestCtx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
        guestCtx.fillStyle = 'rgba(230, 81, 0, 0.25)';
        guestCtx.fill();
    });

    // Red danger zones for the telegraphed skills.
    guestTelegraphs = guestTelegraphs.filter(t => now < t.until);
    guestTelegraphs.forEach(t => {
        guestCtx.save();
        guestCtx.fillStyle = 'rgba(231, 76, 60, 0.32)';
        guestCtx.strokeStyle = 'rgba(231, 76, 60, 0.95)';
        guestCtx.lineWidth = 3;
        if (t.skill === 'spear_jab') {
            guestCtx.translate(guestState.bossX, guestState.bossY);
            guestCtx.rotate(t.angle);
            guestCtx.fillRect(0, -t.width / 2, t.range, t.width);
            guestCtx.strokeRect(0, -t.width / 2, t.range, t.width);
        } else if (t.skill === 'spear_drop') {
            guestCtx.beginPath();
            guestCtx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
            guestCtx.fill();
            guestCtx.stroke();
        }
        guestCtx.restore();
    });

    // Spears left stuck in the floor keep burning whoever touches them.
    const stuckR = def.patterns.spear_drop.stuckRadius;
    guestStuckSpears.forEach(s => {
        guestCtx.save();
        guestCtx.translate(s.x, s.y);
        guestCtx.beginPath();
        guestCtx.arc(0, 0, stuckR, 0, Math.PI * 2);
        guestCtx.fillStyle = 'rgba(231, 76, 60, 0.22)';
        guestCtx.fill();
        guestCtx.strokeStyle = 'rgba(231, 76, 60, 0.7)';
        guestCtx.lineWidth = 2;
        guestCtx.stroke();
        // The shaft standing in the ground.
        guestCtx.strokeStyle = '#bdc3c7';
        guestCtx.lineWidth = 6;
        guestCtx.beginPath();
        guestCtx.moveTo(0, 0);
        guestCtx.lineTo(0, -70);
        guestCtx.stroke();
        guestCtx.fillStyle = '#ecf0f1';
        guestCtx.beginPath();
        guestCtx.moveTo(0, -92);
        guestCtx.lineTo(-10, -66);
        guestCtx.lineTo(10, -66);
        guestCtx.closePath();
        guestCtx.fill();
        guestCtx.restore();
    });

    // The strikes themselves.
    guestHitFlashes = guestHitFlashes.filter(h => now < h.until);
    guestHitFlashes.forEach(h => {
        if (h.windup) return;
        const fade = Math.max(0, (h.until - now) / 260);
        guestCtx.save();
        guestCtx.strokeStyle = `rgba(255, 255, 255, ${fade})`;
        guestCtx.fillStyle = `rgba(255, 210, 210, ${0.45 * fade})`;
        guestCtx.lineWidth = 4;
        if (h.skill === 'spear_jab') {
            guestCtx.translate(guestState.bossX, guestState.bossY);
            guestCtx.rotate(h.angle);
            guestCtx.fillRect(0, -h.width / 2, h.range, h.width);
        } else {
            guestCtx.beginPath();
            guestCtx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
            guestCtx.fill();
            guestCtx.stroke();
        }
        guestCtx.restore();
    });

    // Ultimate impacts.
    guestImpacts = guestImpacts.filter(fx => now < fx.until);
    guestImpacts.forEach(fx => {
        const t = 1 - Math.max(0, (fx.until - now) / 400);
        const rgb = fx.bolt ? '241, 196, 15' : '142, 68, 173';
        guestCtx.beginPath();
        guestCtx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
        guestCtx.fillStyle = `rgba(${rgb}, ${0.5 * (1 - t)})`;
        guestCtx.fill();
        guestCtx.strokeStyle = `rgba(${rgb}, 0.9)`;
        guestCtx.lineWidth = 3;
        guestCtx.stroke();
    });

    // The boss.
    const bossStats = SHARED.CHARACTERS[def.charType];
    const windingUp = guestHitFlashes.some(h => h.windup);
    guestCtx.save();
    guestCtx.translate(guestState.bossX, guestState.bossY);
    if (windingUp) {
        guestCtx.beginPath();
        guestCtx.arc(0, 0, def.radius + 14 + Math.sin(now / 40) * 4, 0, Math.PI * 2);
        guestCtx.strokeStyle = 'rgba(241, 196, 15, 0.9)';
        guestCtx.lineWidth = 5;
        guestCtx.stroke();
    }
    drawGuestBoss(guestCtx, def, bossStats, guestState.bossFacing, now);
    guestCtx.restore();

    // Players. My own cookie uses the local prediction so it doesn't lag.
    Object.entries(guestState.players).forEach(([id, p]) => {
        const mine = id === socket.id;
        const px = mine && guestLocal ? guestLocal.x : p.x;
        const py = mine && guestLocal ? guestLocal.y : p.y;
        const facing = mine && guestLocal ? guestLocal.facing : p.facing;
        const stats = SHARED.CHARACTERS[p.charType] || SHARED.CHARACTERS.kicker;
        const R = SHARED.PLAYER_RADIUS;
        guestCtx.save();
        guestCtx.translate(px, py);

        if (mine && guestLocal && now < guestLocal.attackEffectUntil) {
            const stage = guestLocal.attackEffectStage;
            const range = stage ? stage.range : stats.attackRange;
            const width = (stage ? stage.width : stats.attackWidth) || 40;
            guestCtx.save();
            guestCtx.rotate(facing);
            guestCtx.translate(0, attackSideShift(stats, guestLocal.attackEffectSide));
            guestCtx.fillStyle = 'rgba(241, 196, 15, 0.35)';
            guestCtx.fillRect(R, -width / 2, range, width);
            guestCtx.restore();
        }
        if (mine && guestLocal && now < guestLocal.skillEffectUntil) {
            guestCtx.beginPath();
            guestCtx.arc(0, 0, R + 26, 0, Math.PI * 2);
            guestCtx.strokeStyle = 'rgba(231, 76, 60, 0.85)';
            guestCtx.lineWidth = 6;
            guestCtx.stroke();
        }

        guestCtx.globalAlpha = p.alive ? 1 : 0.45;
        drawCookieBody(guestCtx, R, stats, p.alive);
        guestCtx.beginPath();
        guestCtx.arc(0, 0, R, 0, Math.PI * 2);
        guestCtx.lineWidth = mine ? 4 : 2;
        guestCtx.strokeStyle = mine ? '#f1c40f' : '#2c3e50';
        guestCtx.stroke();
        guestCtx.globalAlpha = 1;

        guestCtx.rotate(facing);
        guestCtx.beginPath();
        guestCtx.moveTo(R + 12, 0);
        guestCtx.lineTo(R + 2, -6);
        guestCtx.lineTo(R + 2, 6);
        guestCtx.closePath();
        guestCtx.fillStyle = p.alive ? '#f1c40f' : '#7f8c8d';
        guestCtx.fill();
        guestCtx.restore();

        const barW = 40, barH = 5;
        guestCtx.fillStyle = '#c0392b';
        guestCtx.fillRect(px - barW / 2, py - R - 13, barW, barH);
        guestCtx.fillStyle = '#2ecc71';
        guestCtx.fillRect(px - barW / 2, py - R - 13, barW * Math.max(0, p.hp / p.maxHp), barH);
    });

    // Ultimate aiming reticle.
    if (guestIsTargetingUltimate && guestMouseX !== null) {
        const stats = guestStats();
        const w = guestWorldFromMouse();
        guestCtx.beginPath();
        guestCtx.arc(w.x, w.y, stats.ultimateRadius || 80, 0, Math.PI * 2);
        guestCtx.strokeStyle = 'rgba(241, 196, 15, 0.9)';
        guestCtx.lineWidth = 3;
        guestCtx.stroke();
    }

    guestCtx.restore();
}

// ---------------- mobile controls ----------------
// Reuses the boss raid's `joystickFacing` (the two fight screens are never on
// screen at the same time), so movement needs no new plumbing. The ultimate is
// a plain tap here: guestHandleUltimateKey already casts straight ahead on touch.
const mcJoystickGuestEl = document.getElementById('mc-joystick-guest');
const mcSkillGuestEl = document.getElementById('mc-skill-guest');
const mcUltimateGuestEl = document.getElementById('mc-ultimate-guest');
const mcAttackGuestEl = document.getElementById('mc-attack-guest');
const mcSkillCdGuestEl = mcSkillGuestEl.querySelector('.mc-cd');
const mcUltimateCdGuestEl = mcUltimateGuestEl.querySelector('.mc-cd');
const mcUltimateThumbGuestEl = mcUltimateGuestEl.querySelector('.mc-aim-thumb');

setupJoystick(mcJoystickGuestEl, false);
mcTap(mcAttackGuestEl, () => fireGuestAutoAimedAttack());
mcTap(mcSkillGuestEl, () => tryGuestUseSkill());
mcTap(mcUltimateGuestEl, () => guestHandleUltimateKey());

function syncGuestMobileIcons(charType) {
    const stats = SHARED.CHARACTERS[charType] || SHARED.CHARACTERS.kicker;
    mcAttackGuestEl.textContent = SKILL_ICONS[stats.attackType] || '⚔';
    mcSkillGuestEl.textContent = SKILL_ICONS[stats.skillType] || '🌀';
    mcSkillGuestEl.appendChild(mcSkillCdGuestEl);
    mcUltimateThumbGuestEl.textContent = SKILL_ICONS[stats.ultimateType] || '🔥';
    mcUltimateThumbGuestEl.appendChild(mcUltimateCdGuestEl);
}

function syncGuestMobileCooldowns(skillRemain, ultRemain) {
    if (!mobileControlsEnabled) return;
    mcSkillCdGuestEl.textContent = skillRemain > 0.05 ? skillRemain.toFixed(1) : '';
    mcUltimateCdGuestEl.textContent = ultRemain > 0.05 ? ultRemain.toFixed(1) : '';
    mcSkillGuestEl.classList.toggle('recharging', skillRemain > 0.05);
    mcUltimateGuestEl.classList.toggle('recharging', ultRemain > 0.05);
}
