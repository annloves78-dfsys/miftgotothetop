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
const guestDiscardOverlay = document.getElementById('guest-discard-overlay');
const guestDiscardChoicesEl = document.getElementById('guest-discard-choices');
const guestFightMenuBtn = document.getElementById('guest-fight-menu-btn');
const guestFightSettings = document.getElementById('guest-fight-settings');
const guestFightLeaveBtn = document.getElementById('guest-fight-leave-btn');

const GUEST_ID = 'guest1'; // the only guest raid so far, and it is never chosen from a list

// Always GUEST_PARTY_SIZE long, holes are null. Multiplayer only *shows* and
// sends the first slot, but the other three are kept so toggling back to solo
// doesn't throw away the party you built.
let guestParty = new Array(SHARED.GUEST_PARTY_SIZE).fill(null);
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
let guestIsTargetingSkill = false; // 때파기 / 물방울 터트리기 aim like an ultimate
let guestPhaseNo = 1;        // 1차 / 2차
let guestMonsters = {};      // 부하 소환 (2차)
let guestProjectiles = {};
let guestSummons = {}; // 번개지옥맛 궁극기가 부른 부하들
let guestGreatSlashes = []; // 크게베기의 벤 자리
let guestDrops = {}; // id -> thrown 물방울 in flight
let guestDropSplashes = []; // [{x, y, until}]
let guestFallZones = [];
let guestBarrage = null;     // { size, spears }
let guestBossLaser = null;   // { angle, range, width }
let guestWall = null;
let guestDebuffUntil = 0;    // 흑화: our damage is dulled until then
let guestLastMoveEmit = 0;
let guestLocal = null;      // local prediction of my own cookie
let guestQuakeUntil = 0;

// Mirror of the server's per-slot timers: each of the four cookies carries its
// own skill/ultimate cooldown and its own buff windows, so using one cookie's
// ultimate doesn't spend anybody else's.
const GUEST_SLOT_FIELDS = ['lastSkillClientTime', 'lastUltimateClientTime',
    'skillEffectUntil', 'ultimateEffectUntil', 'speedBoostUntil', 'awakenUntil', 'rapidStrikeUntil'];
const GUEST_SLOT_DEFAULTS = {
    lastSkillClientTime: -Infinity, lastUltimateClientTime: -Infinity,
    skillEffectUntil: 0, ultimateEffectUntil: 0,
    speedBoostUntil: 0, awakenUntil: 0, rapidStrikeUntil: 0
};

function guestSlotBag(i) {
    if (!guestLocal.slotTimers[i]) guestLocal.slotTimers[i] = { ...GUEST_SLOT_DEFAULTS };
    return guestLocal.slotTimers[i];
}

function activateGuestLocalSlot(index) {
    if (!guestLocal || index === guestLocal.activeSlot) return;
    const outgoing = guestSlotBag(guestLocal.activeSlot);
    GUEST_SLOT_FIELDS.forEach(f => { outgoing[f] = guestLocal[f]; });
    guestLocal.activeSlot = index;
    const incoming = guestSlotBag(index);
    GUEST_SLOT_FIELDS.forEach(f => { guestLocal[f] = incoming[f]; });
    applyGuestEquipBonus();
}

// 이동 속도와 쿠다운 표시는 클라이언트 몴이므로, 지금 슬롯의 쿠키 장비를
// 그때그때 다시 읽어둔다. 공격력·체력·받는 피해는 서버가 맡는다.
function applyGuestEquipBonus() {
    if (!guestLocal) return;
    const b = equipBonusOf(guestCurrentCharType());
    guestLocal.equipSpeed = b.speed;
    guestLocal.equipCooldown = b.cooldown;
}

function guestCurrentCharType() {
    const me = guestState && guestState.players[socket.id];
    return (me && me.charType) || 'kicker';
}

// Four cookies in both modes. (Multiplayer used to cut you down to one; only
// the cookie you're controlling is ever drawn, so there was no need.)
function guestPartyCapacity() {
    return SHARED.GUEST_PARTY_SIZE;
}

// The cookies actually taken in: the visible slots, holes dropped.
function guestPartyLineup() {
    return guestParty.slice(0, guestPartyCapacity()).filter(Boolean);
}

function guestPartyReady() {
    return guestPartyLineup().length === guestPartyCapacity();
}

// Filling a slot with a cookie that's already in another slot swaps the two
// rather than duplicating it -- that's how you reorder the party.
function setGuestPartySlot(index, id) {
    const at = guestParty.indexOf(id);
    if (at >= 0 && at !== index) guestParty[at] = guestParty[index];
    guestParty[index] = id;
    renderGuestDetail();
}

// Each slot is its own 캐릭터 선택 screen -- the same one story mode uses, so
// you see the full card list and the character detail before confirming.
function openGuestSlotPicker(index) {
    openCharacterSelect('guestDetail', {
        selectedId: guestParty[index] || null,
        onPick: (id) => setGuestPartySlot(index, id)
    });
}

function renderGuestPartySlots() {
    const cap = guestPartyCapacity();
    guestPartySlotsEl.innerHTML = '';
    for (let i = 0; i < cap; i++) {
        const id = guestParty[i];
        const stats = id ? SHARED.CHARACTERS[id] : null;
        const slot = document.createElement('div');
        slot.className = 'guest-party-slot' + (stats ? ' filled' : '');
        slot.dataset.slot = String(i);
        const circle = stats
            ? `<div class="slot-circle" style="background:${charIconBackground(stats)}"></div>`
            : '<div class="slot-circle">+</div>';
        slot.innerHTML = circle
            + `<div class="slot-name">${stats ? (stats.shortName || stats.name) : '비어있음'}</div>`;
        slot.addEventListener('click', () => openGuestSlotPicker(i));
        if (stats) {
            // Emptying a slot needs its own control now that the slot itself opens the picker.
            const clear = document.createElement('button');
            clear.className = 'slot-clear';
            clear.textContent = '×';
            clear.addEventListener('click', (e) => {
                e.stopPropagation();
                guestParty[i] = null;
                renderGuestDetail();
            });
            slot.appendChild(clear);
        }
        guestPartySlotsEl.appendChild(slot);
    }
    guestPartyHintEl.textContent = `빈 칸을 눌러 캐릭터를 고르세요. (${guestPartyLineup().length}/${cap})`;
}

function renderGuestDetail() {
    const def = SHARED.GUEST_BOSS_DEFS[GUEST_ID];
    guestBossHpSpecEl.textContent = def.maxHp;
    renderGuestPartySlots();
    if (guestPhase === 'idle') {
        guestMultiBtn.disabled = false; // multiplayer re-cuts the party to 1 on click
        guestSoloBtn.disabled = !guestPartyReady();
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
    // Seed the first slot with the lobby's selected cookie so there's a sensible
    // starting point; the other three are yours to fill.
    if (!guestParty.some(Boolean) && gameData.selectedCharacter) guestParty[0] = gameData.selectedCharacter;
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
        // Both modes take the same four cookies now, so a single click starts
        // straight away -- the old first-click-only-re-cuts step just looked
        // like the button was doing nothing.
        guestIsMulti = isMulti;
        if (!guestPartyReady()) return;
        const lineup = guestPartyLineup();
        if (isMulti) {
            guestPhase = 'searching';
            guestMultiBtn.disabled = true;
            guestSoloBtn.disabled = true;
            guestLeaveBtn.classList.remove('hidden');
            guestMultiBtn.textContent = '대기중...';
            socket.emit('joinGuestRaid', { guestId: GUEST_ID, party: lineup, equipParty: lineup.map(id => equipPayload(id)) });
        } else {
            guestMultiBtn.disabled = true;
            guestSoloBtn.disabled = true;
            socket.emit('joinGuestRaid', { guestId: GUEST_ID, party: lineup, solo: true, equipParty: lineup.map(id => equipPayload(id)) });
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

// Clicks are delegated to the bar itself, and the rows are built once and then
// updated in place. Rebuilding the rows on every server tick (which is what
// this used to do) meant a real mousedown/mouseup pair almost never landed on
// the same element, so clicking a cookie never swapped -- only the number keys
// worked.
guestPartyBarEl.addEventListener('click', (e) => {
    const row = e.target.closest ? e.target.closest('.guest-party-member') : null;
    if (!row || !guestPartyBarEl.contains(row)) return;
    const me = guestMe();
    const i = Number(row.dataset.slot);
    if (!me || !Number.isInteger(i)) return;
    if (i === me.active || !me.partyAlive[i]) return;
    socket.emit('guestSwap', { index: i });
});

function buildGuestPartyBar(party) {
    guestPartyBarEl.innerHTML = '';
    party.forEach((id, i) => {
        const stats = SHARED.CHARACTERS[id];
        const el = document.createElement('div');
        el.className = 'guest-party-member';
        el.dataset.slot = String(i);
        el.innerHTML = `<div class="pm-key">${i + 1}</div>`
            + `<div class="pm-circle" style="background:${charIconBackground(stats)}"></div>`
            + `<div class="pm-bar"><div class="pm-bar-fill"></div></div>`
            + `<div class="pm-hp"></div>`;
        guestPartyBarEl.appendChild(el);
    });
}

function renderGuestPartyBar() {
    const me = guestMe();
    if (!me) { guestPartyBarEl.innerHTML = ''; return; }
    const rows = guestPartyBarEl.children;
    if (rows.length !== me.party.length) buildGuestPartyBar(me.party);
    me.party.forEach((id, i) => {
        const el = guestPartyBarEl.children[i];
        const discarded = !!(me.partyDiscarded && me.partyDiscarded[i]);
        const down = !me.partyAlive[i];
        el.classList.toggle('active', i === me.active);
        el.classList.toggle('down', down);
        el.classList.toggle('discarded', discarded);
        const pct = Math.max(0, me.partyHp[i] / me.partyMaxHp[i]) * 100;
        el.querySelector('.pm-bar-fill').style.width = `${pct}%`;
        el.querySelector('.pm-hp').textContent = discarded ? '버림' : `${me.partyHp[i]}/${me.partyMaxHp[i]}`;
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
        lastAttackClientTime: -Infinity,
        attackEffectUntil: 0,
        comboStage: 0, attackEffectStage: null, spearSide: 0, attackEffectSide: 0,
        activeSlot: me.active || 0,
        slotTimers: me.party.map(() => ({ ...GUEST_SLOT_DEFAULTS })),
        ...GUEST_SLOT_DEFAULTS
    } : null;
    guestTelegraphs = []; guestHitFlashes = []; guestStuckSpears = [];
    guestMagmaZones = []; guestImpacts = [];
    guestIsTargetingUltimate = false;
    guestIsTargetingSkill = false;
    guestQuakeUntil = 0;
    guestCollapseOverlay.classList.add('hidden');
    guestFightSettings.classList.add('hidden');
    syncGuestMobileIcons(me ? me.charType : 'kicker');
    applyGuestEquipBonus();
    updateGuestHpBars();
    showScreen('guestFight');
    startGuestLoop();
});

socket.on('guestTick', (data) => {
    if (!guestState) return;
    guestSummons = data.summons || {};
    guestState.bossHp = data.bossHp;
    if (data.bossMaxHp) guestState.bossMaxHp = data.bossMaxHp;
    guestState.bossShieldHp = data.bossShieldHp || 0;
    guestState.bossFacing = data.bossFacing;
    guestState.players = data.players;
    guestStuckSpears = data.stuckSpears;
    guestFallZones = data.fallZones || [];
    guestMonsters = data.monsters || {};
    guestProjectiles = data.projectiles || {};
    guestWall = data.wall || null;
    if (data.phase) guestPhaseNo = data.phase;
    updateGuestHpBars();
});

// ---------------- 2차 레이드 ----------------
socket.on('guestMinionsSummoned', ({ monsters }) => { Object.assign(guestMonsters, monsters); });
socket.on('guestMonsterDamaged', ({ id, hp }) => { if (guestMonsters[id]) guestMonsters[id].hp = hp; });
socket.on('guestMonsterDefeated', ({ id }) => { delete guestMonsters[id]; });
socket.on('guestBossLaser', (d) => { guestBossLaser = { ...d }; });
socket.on('guestBossLaserAim', ({ angle }) => { if (guestBossLaser) guestBossLaser.angle = angle; });
socket.on('guestBossLaserEnd', () => { guestBossLaser = null; });
socket.on('guestFallZone', (z) => { guestFallZones.push(z); });
socket.on('guestFallZonesCleared', () => { guestFallZones = []; });
socket.on('guestBarrageWave', (d) => { guestBarrage = d; });
socket.on('guestBarrageCleared', () => { guestBarrage = null; });
socket.on('guestWallRaised', (d) => { guestWall = d; });
socket.on('guestWallDropped', () => { guestWall = null; });
socket.on('guestBossShield', ({ shieldHp }) => { if (guestState) guestState.bossShieldHp = shieldHp; });
socket.on('guestBossDesperation', ({ shieldHp }) => {
    if (!guestState) return;
    guestState.bossShieldHp = shieldHp;
    guestHitFlashes.push({ windup: true, until: performance.now() + 900 });
});
socket.on('guestBossHealed', ({ bossHp }) => { if (guestState) { guestState.bossHp = bossHp; updateGuestHpBars(); } });
socket.on('guestDiscardPrompt', ({ party, partyHp, partyMaxHp, partyAlive }) => {
    guestCollapseOverlay.classList.add('hidden');
    guestDiscardChoicesEl.innerHTML = '';
    party.forEach((id, i) => {
        const stats = SHARED.CHARACTERS[id] || SHARED.CHARACTERS.kicker;
        const el = document.createElement('div');
        el.className = 'guest-discard-choice';
        el.dataset.slot = String(i);
        el.innerHTML = `<div class="dc-circle" style="background:${charIconBackground(stats)}"></div>`
            + `<div class="dc-name">${stats.shortName || stats.name}</div>`
            + `<div class="dc-hp">${partyAlive[i] ? `${partyHp[i]}/${partyMaxHp[i]}` : '쓰러짐'}</div>`;
        guestDiscardChoicesEl.appendChild(el);
    });
    guestDiscardOverlay.classList.remove('hidden');
});

guestDiscardChoicesEl.addEventListener('click', (e) => {
    const row = e.target.closest ? e.target.closest('.guest-discard-choice') : null;
    if (!row || guestDiscardChoicesEl.classList.contains('locked')) return;
    guestDiscardChoicesEl.classList.add('locked');
    socket.emit('guestDiscardCookie', { index: Number(row.dataset.slot) });
});

socket.on('guestDiscardAccepted', ({ index }) => {
    const row = guestDiscardChoicesEl.children[index];
    if (row) row.classList.add('discarded');
});

socket.on('guestPhase2Started', (data) => {
    guestPhaseNo = 2;
    guestDiscardOverlay.classList.add('hidden');
    guestDiscardChoicesEl.classList.remove('locked');
    guestCollapseOverlay.classList.add('hidden');
    guestState = {
        bossHp: data.bossHp, bossMaxHp: data.bossMaxHp, bossShieldHp: 0,
        bossX: data.bossX, bossY: data.bossY, bossFacing: Math.PI / 2,
        players: data.players
    };
    const me = data.players[socket.id];
    if (me && guestLocal) {
        guestLocal.x = me.x; guestLocal.y = me.y;
        guestLocal.activeSlot = me.active || 0;
        guestLocal.slotTimers = me.party.map(() => ({ ...GUEST_SLOT_DEFAULTS }));
        Object.assign(guestLocal, GUEST_SLOT_DEFAULTS);
    }
    guestTelegraphs = []; guestHitFlashes = []; guestStuckSpears = [];
    guestMagmaZones = []; guestImpacts = []; guestFallZones = [];
    guestMonsters = {}; guestProjectiles = {};
    guestDrops = {}; guestDropSplashes = []; guestGreatSlashes = []; guestSummons = {};
    guestBarrage = null; guestBossLaser = null; guestWall = null; guestDebuffUntil = 0;
    if (me) syncGuestMobileIcons(me.charType);
    updateGuestHpBars();
    buildGuestPartyBar(me ? me.party : []);
    renderGuestPartyBar();
});

socket.on('guestBossEmpowered', (d) => {
    if (!guestState) return;
    guestState.bossHp = d.bossHp;
    guestState.bossShieldHp = d.shieldHp;
    guestDebuffUntil = performance.now() + d.durationMs;
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
// 부활: 체력은 guestPlayerDamaged가 이미 실어 오지만, 부활했다는 것이
// 보이지 않으면 그냥 회복한 것처럼 보인다.
socket.on('guestPlayerRevived', ({ id, hp }) => {
    if (!guestState || !guestState.players[id]) return;
    guestState.players[id].hp = hp;
    guestState.players[id].alive = true;
    updateGuestHpBars();
});

socket.on('guestReviveBlast', ({ id }) => {
    const p = guestState && guestState.players[id];
    if (!p) return;
    guestImpacts.push({ x: p.x, y: p.y, radius: 220, until: performance.now() + 500, bolt: true });
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
    if (d.id === socket.id) {
        syncGuestMobileIcons(d.charType);
        activateGuestLocalSlot(d.active);
    }
    updateGuestHpBars();
});
socket.on('guestForcedSwap', (d) => {
    if (!guestState || !guestState.players[d.id]) return;
    guestState.players[d.id].active = d.active;
    guestState.players[d.id].charType = d.charType;
    if (d.id === socket.id) {
        syncGuestMobileIcons(d.charType);
        activateGuestLocalSlot(d.active);
    }
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
socket.on('guestSkillMark', (d) => {
    guestImpacts.push({ ...d, until: performance.now() + 500 });
});
socket.on('guestUltimateMark', (d) => {
    guestImpacts.push({ ...d, until: performance.now() + 700 });
});
socket.on('guestGreatSlash', (d) => {
    guestGreatSlashes.push({ ...d, until: performance.now() + d.windupMs + 250 });
    if (guestLocal && d.id === socket.id) {
        guestLocal.speedBoostUntil = performance.now() + guestStats().ultimateSpeedDurationMs;
    }
});

socket.on('guestButterflyMode', ({ id, on }) => {
    if (!guestLocal || id !== socket.id) return;
    guestLocal.butterflyOn = on;
    // Releasing it is what starts the cooldown -- switching it on does not.
    guestLocal.lastUltimateClientTime = on ? Infinity : performance.now();
});

socket.on('guestDropThrown', ({ id, x, y, vx, vy, radius }) => {
    guestDrops[id] = { x, y, vx, vy, radius, at: performance.now() };
});

socket.on('guestDropGone', ({ id, hit, x, y }) => {
    delete guestDrops[id];
    if (hit) guestDropSplashes.push({ x, y, until: performance.now() + 260 });
});

socket.on('guestPlayerTeleported', ({ id, x, y }) => {
    if (guestLocal && id === socket.id) { guestLocal.x = x; guestLocal.y = y; }
});
socket.on('guestEarthquake', () => { guestQuakeUntil = performance.now() + QUAKE_DURATION_MS; });

socket.on('guestFloorCollapse', () => {
    guestCollapseOverlay.classList.remove('hidden');
    guestQuakeUntil = performance.now() + 2600;
});

socket.on('guestResult', ({ result }) => {
    stopGuestLoop();
    guestState = null;
    guestPhaseNo = 1;
    guestCollapseOverlay.classList.add('hidden');
    guestDiscardOverlay.classList.add('hidden');
    guestDiscardChoicesEl.classList.remove('locked');
    guestMonsters = {}; guestProjectiles = {}; guestFallZones = [];
    guestDrops = {}; guestDropSplashes = []; guestGreatSlashes = []; guestSummons = {};
    guestBarrage = null; guestBossLaser = null; guestWall = null; guestDebuffUntil = 0;
    // 불 미션. Beating 2차 necessarily means 1차 went down too.
    const titles = { win: '격파!', phase1: '1차 격파!', lose: '패배...' };
    resultTitle.textContent = titles[result] || '나감';
    const descs = {
        win: '번개지옥맛 쿠키를 2차 레이드까지 완전히 쓰러뜨렸습니다.',
        phase1: '번개지옥맛 쿠키는 쓰러지지 않았습니다. 2차 레이드는 준비 중입니다.',
        lose: '파티가 전멸했습니다.'
    };
    resultDesc.textContent = descs[result] || '';
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
        else if (guestIsTargetingSkill) confirmGuestSkillTarget();
        else if (autoAimActive()) fireGuestAutoAimedAttack();
        else tryGuestAttack();
    } else if (e.button === 2) {
        guestHandleSkillTrigger();
    }
});

// Right-click casts on the spot for most cookies; for a placed skill it arms
// the reticle and the next left-click commits it.
function guestHandleSkillTrigger() {
    if (!guestLocal) return;
    const stats = guestStats();
    if (!isTargetedSkill(stats.skillType)) { tryGuestUseSkill(); return; }
    if (mobileControlsEnabled) {
        if (!guestCanUseSkill(performance.now())) return;
        guestLocal.lastSkillClientTime = performance.now();
        socket.emit('guestPlayerSkill',
            mobileSkillTarget(guestLocal.x, guestLocal.y, guestLocal.facing, stats));
        return;
    }
    if (guestIsTargetingSkill) { guestIsTargetingSkill = false; return; }
    if (!guestCanUseSkill(performance.now())) return;
    guestIsTargetingSkill = true;
}

function confirmGuestSkillTarget() {
    guestIsTargetingSkill = false;
    if (!guestLocal || guestMouseX === null) return;
    if (!guestCanUseSkill(performance.now())) return;
    guestLocal.lastSkillClientTime = performance.now();
    const w = guestWorldFromMouse();
    socket.emit('guestPlayerSkill', { targetX: w.x, targetY: w.y });
}

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
    advanceSweepCount(guestLocal, stats);
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
    if (stats.skillType === 'speed_boost' || stats.skillType === 'charge_dash') guestLocal.speedBoostUntil = now + stats.skillSpeedDurationMs;
    if (stats.skillType === 'earthquake') guestQuakeUntil = now + QUAKE_DURATION_MS;
    socket.emit('guestPlayerSkill');
}

function guestCanUseSkill(now) {
    const stats = guestStats();
    return !!stats.skillType
        && now - guestLocal.lastSkillClientTime >= stats.skillCooldown * guestEquipCooldown();
}

// 장비의 쿠다운 감소는 지금 나와 있는 슬롯의 쿠키 것을 따른다.
function guestEquipCooldown() {
    return (guestLocal && guestLocal.equipCooldown) || 1;
}

function guestCanUseUltimate(now) {
    const stats = guestStats();
    if (ultimateIsHeldOn(stats, guestLocal)) return true;
    return !!stats.ultimateType
        && now - guestLocal.lastUltimateClientTime >= stats.ultimateCooldownMs * guestEquipCooldown();
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
    if (stats.ultimateType === 'great_slash') guestLocal.speedBoostUntil = now + stats.ultimateSpeedDurationMs;
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
    if (e.key === 'q' || e.key === 'Q') guestHandleSkillTrigger();
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
        if (ultimateIsHeldOn(stats, guestLocal)) ultRemain = 0;
        else ultRemain = Math.max(0, stats.ultimateCooldownMs * guestEquipCooldown()
            - (now - guestLocal.lastUltimateClientTime)) / 1000;
        guestMyUltimateCdEl.textContent = ultRemain > 0.05 ? `${ultRemain.toFixed(1)}s` : '사용가능';
    }
    syncGuestMobileCooldowns(skillRemain, ultRemain);
}

function guestFrame() {
    const now = performance.now();
    const me = guestMe();
    if (guestLocal && me && me.alive) {
        const stats = guestStats();
        const speed = moveSpeedFor(stats, now, guestLocal.speedBoostUntil, guestLocal.awakenUntil, guestLocal.butterflyOn, guestLocal.equipSpeed);
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
    const def = SHARED.guestDefFor({ guestId: GUEST_ID, phase: guestPhaseNo });

    // 낙하물 left lying on the ground.
    guestFallZones.forEach(z => {
        guestCtx.beginPath();
        guestCtx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
        guestCtx.fillStyle = 'rgba(120, 60, 160, 0.28)';
        guestCtx.fill();
        guestCtx.strokeStyle = 'rgba(180, 120, 220, 0.8)';
        guestCtx.lineWidth = 2;
        guestCtx.stroke();
    });

    // 총공격: the volley currently sitting on the field.
    if (guestBarrage) {
        const s = guestBarrage.size;
        guestBarrage.spears.forEach(sp => {
            guestCtx.fillStyle = 'rgba(231, 76, 60, 0.3)';
            guestCtx.fillRect(sp.x - s / 2, sp.y - s / 2, s, s);
            guestCtx.strokeStyle = 'rgba(231, 76, 60, 0.9)';
            guestCtx.lineWidth = 2;
            guestCtx.strokeRect(sp.x - s / 2, sp.y - s / 2, s, s);
        });
    }

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
        } else if (t.skill === 'half_sweep') {
            // Half the field, split along the boss's facing.
            guestCtx.translate(guestState.bossX, guestState.bossY);
            guestCtx.beginPath();
            guestCtx.moveTo(0, 0);
            guestCtx.arc(0, 0, t.range, t.angle - t.halfAngle, t.angle + t.halfAngle);
            guestCtx.closePath();
            guestCtx.fill();
            guestCtx.stroke();
        } else {
            // spear_drop / spear_throw / half_sweep_fall all mark a circle.
            guestCtx.beginPath();
            guestCtx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
            guestCtx.fill();
            guestCtx.stroke();
        }
        guestCtx.restore();
    });

    // Spears left stuck in the floor keep burning whoever touches them.
    const stuckR = (SHARED.GUEST_BOSS_DEFS[GUEST_ID].patterns.spear_drop || {}).stuckRadius || 30;
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

    // 벽 가르기: the wall across the middle.
    if (guestWall) {
        const t = guestWall.thickness || 18;
        guestCtx.fillStyle = 'rgba(20, 12, 28, 0.95)';
        guestCtx.fillRect(-HW, guestWall.y - t / 2, HW * 2, t);
        guestCtx.strokeStyle = 'rgba(155, 89, 182, 0.9)';
        guestCtx.lineWidth = 3;
        guestCtx.strokeRect(-HW, guestWall.y - t / 2, HW * 2, t);
    }

    // The boss's own beam (반갈라 베기 stage 2).
    if (guestBossLaser) {
        guestCtx.save();
        guestCtx.translate(guestState.bossX, guestState.bossY);
        guestCtx.rotate(guestBossLaser.angle);
        const w = guestBossLaser.width;
        guestCtx.fillStyle = 'rgba(155, 89, 182, 0.35)';
        guestCtx.fillRect(0, -w / 2, guestBossLaser.range, w);
        guestCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        guestCtx.fillRect(0, -w / 6, guestBossLaser.range, w / 3);
        guestCtx.restore();
    }

    // Summoned adds and their arrows.
    Object.values(guestMonsters).forEach(m => {
        const mdef = SHARED.MONSTERS[m.type];
        if (!mdef) return;
        if (m.laser) {
            guestCtx.save();
            guestCtx.translate(m.x, m.y);
            guestCtx.rotate(m.laser.angle);
            guestCtx.fillStyle = 'rgba(231, 76, 60, 0.35)';
            guestCtx.fillRect(0, -mdef.laserWidth / 2, mdef.laserRange, mdef.laserWidth);
            guestCtx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            guestCtx.fillRect(0, -mdef.laserWidth / 6, mdef.laserRange, mdef.laserWidth / 3);
            guestCtx.restore();
        }
        const R = SHARED.MONSTER_RADIUS;
        guestCtx.beginPath();
        guestCtx.arc(m.x, m.y, R, 0, Math.PI * 2);
        guestCtx.fillStyle = mdef.color;
        guestCtx.fill();
        guestCtx.lineWidth = 2;
        guestCtx.strokeStyle = m.state === 'telegraph' ? '#e74c3c' : '#2c3e50';
        guestCtx.stroke();
        const bw = 26;
        guestCtx.fillStyle = '#c0392b';
        guestCtx.fillRect(m.x - bw / 2, m.y - R - 9, bw, 4);
        guestCtx.fillStyle = '#2ecc71';
        guestCtx.fillRect(m.x - bw / 2, m.y - R - 9, bw * Math.max(0, m.hp / m.maxHp), 4);
    });
    Object.values(guestProjectiles).forEach(pr => {
        guestCtx.save();
        guestCtx.translate(pr.x, pr.y);
        guestCtx.rotate(pr.angle);
        guestCtx.fillStyle = '#ecf0f1';
        guestCtx.fillRect(-8, -2, 16, 4);
        guestCtx.restore();
    });
    drawSummons(guestCtx, guestSummons, socket.id);
    guestGreatSlashes = guestGreatSlashes.filter(g => now < g.until);
    drawGreatSlashes(guestCtx, guestGreatSlashes, now);
    drawThrownDrops(guestCtx, guestDrops, now);
    guestDropSplashes = guestDropSplashes.filter(s => now < s.until);
    drawDropSplashes(guestCtx, guestDropSplashes, now);

    // The boss.
    const bossStats = SHARED.CHARACTERS[def.charType];
    const windingUp = guestHitFlashes.some(h => h.windup);
    guestCtx.save();
    guestCtx.translate(guestState.bossX, guestState.bossY);
    // 2차: a black aura churning around the body.
    if (def.aura) {
        for (let i = 0; i < 7; i++) {
            const a = now / 900 + (i * Math.PI * 2) / 7;
            const wob = Math.sin(now / 320 + i) * 8;
            const rr = def.radius + 26 + wob;
            guestCtx.beginPath();
            guestCtx.arc(Math.cos(a) * rr * 0.55, Math.sin(a) * rr * 0.55, 26 + wob * 0.6, 0, Math.PI * 2);
            guestCtx.fillStyle = `rgba(10, 6, 16, ${0.32 + 0.12 * Math.sin(now / 260 + i)})`;
            guestCtx.fill();
        }
        guestCtx.beginPath();
        guestCtx.arc(0, 0, def.radius + 18, 0, Math.PI * 2);
        guestCtx.strokeStyle = 'rgba(90, 40, 130, 0.7)';
        guestCtx.lineWidth = 6;
        guestCtx.stroke();
    }
    if (guestState.bossShieldHp > 0) {
        guestCtx.beginPath();
        guestCtx.arc(0, 0, def.radius + 12, 0, Math.PI * 2);
        guestCtx.strokeStyle = 'rgba(52, 152, 219, 0.9)';
        guestCtx.lineWidth = 4;
        guestCtx.stroke();
    }
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

        if (mine && guestLocal && now < guestLocal.attackEffectUntil
            && stats.attackType === 'vampire_slash') {
            const sh = sweepShape(stats, guestLocal.attackVampire);
            guestCtx.save();
            guestCtx.rotate(facing);
            drawSweepSlash(guestCtx, R, sh.range, sh.width,
                1 - (guestLocal.attackEffectUntil - now) / SWEEP_MS, guestLocal.attackVampire);
            guestCtx.restore();
        } else if (mine && guestLocal && now < guestLocal.attackEffectUntil) {
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

    // Placed-skill aiming reticle (때파기 / 물방울 터트리기).
    if (guestIsTargetingSkill && guestMouseX !== null) {
        const stats = guestStats();
        const w = guestWorldFromMouse();
        guestCtx.beginPath();
        guestCtx.arc(w.x, w.y, stats.skillRadius || 80, 0, Math.PI * 2);
        guestCtx.strokeStyle = 'rgba(142, 68, 173, 0.9)';
        guestCtx.lineWidth = 3;
        guestCtx.stroke();
    }

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
mcTap(mcSkillGuestEl, () => guestHandleSkillTrigger());
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
