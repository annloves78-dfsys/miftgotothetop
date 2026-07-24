const socket = io();

// ---- Screens ----
const screens = {
    lobby: document.getElementById('lobby-screen'),
    shop: document.getElementById('shop-screen'),
    modeSelect: document.getElementById('mode-select-screen'),
    characterSelect: document.getElementById('character-select-screen'),
    bossSelect: document.getElementById('boss-select-screen'),
    bossDetail: document.getElementById('boss-detail-screen'),
    fight: document.getElementById('fight-screen'),
    result: document.getElementById('result-screen')
};
function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
}

const playBtn = document.getElementById('play-btn');
const characterSelectBtn = document.getElementById('character-select-btn');
const selectedCharNameEl = document.getElementById('selected-char-name');
const characterListEl = document.getElementById('character-list');
const backFromCharacterBtn = document.getElementById('back-from-character-btn');
const backFromModeBtn = document.getElementById('back-from-mode-btn');
const storyModeCard = document.getElementById('story-mode-card');
const bossRaidModeCard = document.getElementById('boss-raid-mode-card');
const backToLobbyBtn = document.getElementById('back-to-lobby-btn');
const bossListEl = document.getElementById('boss-list');
const backFromDetailBtn = document.getElementById('back-from-detail-btn');
const detailCharIcon = document.getElementById('detail-char-icon');
const detailCharName = document.getElementById('detail-char-name');
const detailChangeCharBtn = document.getElementById('detail-change-char-btn');
const detailBossName = document.getElementById('detail-boss-name');
const detailBossIcon = document.getElementById('detail-boss-icon');
const detailBossPower = document.getElementById('detail-boss-power');
const detailBossHp = document.getElementById('detail-boss-hp');
const detailMultiBtn = document.getElementById('detail-multi-btn');
const detailSoloBtn = document.getElementById('detail-solo-btn');
const detailLeaveBtn = document.getElementById('detail-leave-btn');
const detailPartnerPreview = document.getElementById('detail-partner-preview');
const detailPartnerIcon = document.getElementById('detail-partner-icon');
const detailPartnerName = document.getElementById('detail-partner-name');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const bossHpBar = document.getElementById('boss-hp-bar');
const bossHpLabel = document.getElementById('boss-hp-label');
const myHpBar = document.getElementById('my-hp-bar');
const mySkillCdEl = document.getElementById('my-skill-cd');
const myUltimateCdEl = document.getElementById('my-ultimate-cd');
const partnerHpContainer = document.getElementById('partner-hp-container');
const partnerHpBar = document.getElementById('partner-hp-bar');
const resultTitle = document.getElementById('result-title');
const resultDesc = document.getElementById('result-desc');
const resultBackBtn = document.getElementById('result-back-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsMenu = document.getElementById('settings-menu');
const leaveRaidBtn = document.getElementById('leave-raid-btn');
const leavePendingBanner = document.getElementById('leave-pending-banner');
const leaveRequestModal = document.getElementById('leave-request-modal');
const leaveConfirmYes = document.getElementById('leave-confirm-yes');
const leaveConfirmNo = document.getElementById('leave-confirm-no');

let gameData = loadGameData();

// ---- Character select ----
function updateSelectedCharLabel() {
    const stats = SHARED.CHARACTERS[gameData.selectedCharacter] || SHARED.CHARACTERS.kicker;
    selectedCharNameEl.textContent = stats.shortName || stats.name;
}
updateSelectedCharLabel();

let characterReturnScreen = 'lobby'; // where "뒤로"/selecting a character sends you back to

function renderCharacterList() {
    characterListEl.innerHTML = '';
    Object.entries(SHARED.CHARACTERS).forEach(([id, stats]) => {
        const unlocked = gameData.unlockedCharacters.includes(id);
        const card = document.createElement('div');
        card.className = 'boss-card' + (unlocked ? '' : ' locked') + (id === gameData.selectedCharacter ? ' selected' : '');
        card.innerHTML = `<div class="icon">${unlocked ? '🧑' : '🔒'}</div><div class="name">${stats.name}</div>`;
        if (unlocked) {
            card.addEventListener('click', () => {
                gameData.selectedCharacter = id;
                saveGameData(gameData);
                updateSelectedCharLabel();
                if (characterReturnScreen === 'bossDetail') updateDetailCharPreview();
                showScreen(characterReturnScreen);
            });
        }
        characterListEl.appendChild(card);
    });
}

characterSelectBtn.addEventListener('click', () => {
    characterReturnScreen = 'lobby';
    renderCharacterList();
    showScreen('characterSelect');
});
backFromCharacterBtn.addEventListener('click', () => showScreen(characterReturnScreen));

// ---- Shop ----
const shopBtn = document.getElementById('shop-btn');
const backFromShopBtn = document.getElementById('back-from-shop-btn');
const shopContent = document.getElementById('shop-content');
const shopCatButtons = {
    currency: document.getElementById('shop-cat-currency'),
    iap: document.getElementById('shop-cat-iap'),
    item: document.getElementById('shop-cat-item')
};
const SHOP_CATEGORIES = {
    currency: '아직 판매 중인 재화가 없습니다.',
    iap: '아직 판매 중인 상품이 없습니다.',
    item: '아직 판매 중인 아이템이 없습니다.'
};

function renderShopCategory(key) {
    Object.entries(shopCatButtons).forEach(([k, btn]) => btn.classList.toggle('selected', k === key));
    shopContent.innerHTML = `<p class="shop-empty">${SHOP_CATEGORIES[key]}</p>`;
}

Object.entries(shopCatButtons).forEach(([key, btn]) => {
    btn.addEventListener('click', () => renderShopCategory(key));
});

shopBtn.addEventListener('click', () => {
    renderShopCategory('currency');
    showScreen('shop');
});
backFromShopBtn.addEventListener('click', () => showScreen('lobby'));

detailChangeCharBtn.addEventListener('click', () => {
    characterReturnScreen = 'bossDetail';
    renderCharacterList();
    showScreen('characterSelect');
});

// ---- Mode select ----
playBtn.addEventListener('click', () => showScreen('modeSelect'));
backFromModeBtn.addEventListener('click', () => showScreen('lobby'));
bossRaidModeCard.addEventListener('click', () => {
    renderBossList();
    showScreen('bossSelect');
});
// storyModeCard is intentionally left without a click handler: locked/unreachable for now.

// ---- Boss select ----
function renderBossList() {
    bossListEl.innerHTML = '';
    SHARED.BOSS_LIST.forEach(b => {
        const card = document.createElement('div');
        card.className = 'boss-card' + (b.locked ? ' locked' : '');
        card.innerHTML = `<div class="icon">${b.locked ? '🔒' : (b.icon || '🗿')}</div><div class="name">${b.name}</div>`;
        if (!b.locked) card.addEventListener('click', () => openBossDetail(b.id));
        bossListEl.appendChild(card);
    });
}

backToLobbyBtn.addEventListener('click', () => showScreen('modeSelect'));

// ---- Boss detail ----
let selectedBossId = null;
let currentRoomState = null; // { roomId, bossId, count, players }
let raidPhase = 'idle'; // 'idle' | 'searching' | 'matched' -- 'idle' covers solo too (it starts instantly)
let myReady = false;
let searchStartAt = 0;
let searchTimerHandle = null;

function updateDetailCharPreview() {
    const stats = SHARED.CHARACTERS[gameData.selectedCharacter] || SHARED.CHARACTERS.kicker;
    detailCharIcon.style.background = stats.color;
    detailCharName.textContent = stats.name;
}

function stopSearchTimer() {
    if (searchTimerHandle) clearInterval(searchTimerHandle);
    searchTimerHandle = null;
}

function updateSearchTimerLabel() {
    const secs = Math.floor((Date.now() - searchStartAt) / 1000);
    const label = `대기중 (${secs}초)`;
    detailMultiBtn.textContent = label;
    detailSoloBtn.textContent = label;
}

function startSearchTimer() {
    stopSearchTimer();
    searchStartAt = Date.now();
    updateSearchTimerLabel();
    searchTimerHandle = setInterval(updateSearchTimerLabel, 1000);
}

function resetDetailActions() {
    raidPhase = 'idle';
    myReady = false;
    stopSearchTimer();
    detailMultiBtn.textContent = '멀티플레이';
    detailMultiBtn.disabled = false;
    detailSoloBtn.textContent = '솔로플레이';
    detailSoloBtn.disabled = false;
    detailLeaveBtn.classList.add('hidden');
    detailPartnerPreview.classList.add('hidden');
}

function leaveCurrentRaidIfAny() {
    if (raidPhase !== 'idle') {
        socket.emit('leaveRaid');
        currentRoomState = null;
    }
    resetDetailActions();
}

function openBossDetail(bossId) {
    leaveCurrentRaidIfAny();
    selectedBossId = bossId;
    const bossDef = SHARED.BOSS_DEFS[bossId];
    const bossListEntry = SHARED.BOSS_LIST.find(b => b.id === bossId);
    detailBossName.textContent = bossDef.name;
    detailBossIcon.textContent = (bossListEntry && bossListEntry.icon) || '🗿';
    detailBossIcon.style.background = bossDef.color || '#7f8c8d';
    detailBossPower.textContent = '미정';
    detailBossHp.textContent = `${bossDef.maxHpPerPlayer} (1인 기준)`;
    updateDetailCharPreview();
    showScreen('bossDetail');
}

backFromDetailBtn.addEventListener('click', () => {
    leaveCurrentRaidIfAny();
    showScreen('bossSelect');
});

detailLeaveBtn.addEventListener('click', () => leaveCurrentRaidIfAny());

// Multiplayer: click arms a search + ready-check (both players must click
// "플레이" once matched before the fight actually starts). Solo: starts
// immediately with no waiting, in its own room (never matched with a
// multiplayer searcher -- see the `solo` flag on joinRaid/createRoom).
function handleMultiOrSoloClick(isMulti) {
    const charType = gameData.selectedCharacter || 'kicker';
    if (raidPhase === 'idle') {
        if (isMulti) {
            raidPhase = 'searching';
            detailMultiBtn.disabled = true;
            detailSoloBtn.disabled = true;
            detailLeaveBtn.classList.remove('hidden');
            startSearchTimer();
            socket.emit('joinRaid', { bossId: selectedBossId, charType });
        } else {
            detailMultiBtn.disabled = true;
            detailSoloBtn.disabled = true;
            socket.emit('joinRaid', { bossId: selectedBossId, charType, solo: true });
            socket.emit('startRaid');
        }
    } else if (raidPhase === 'matched' && !myReady) {
        myReady = true;
        detailMultiBtn.disabled = true;
        detailSoloBtn.disabled = true;
        detailMultiBtn.textContent = '플레이 (대기중)';
        detailSoloBtn.textContent = '플레이 (대기중)';
        socket.emit('playerReady');
    }
}
detailMultiBtn.addEventListener('click', () => handleMultiOrSoloClick(true));
detailSoloBtn.addEventListener('click', () => handleMultiOrSoloClick(false));

socket.on('raidRoomUpdate', (data) => {
    currentRoomState = data;
    if (screens.bossDetail.classList.contains('hidden')) return;
    if (data.count >= 2) {
        raidPhase = 'matched';
        stopSearchTimer();
        const partnerEntry = Object.entries(data.players).find(([id]) => id !== socket.id);
        if (partnerEntry) {
            const pStats = SHARED.CHARACTERS[partnerEntry[1].charType] || SHARED.CHARACTERS.kicker;
            detailPartnerIcon.style.background = pStats.color;
            detailPartnerName.textContent = pStats.name;
            detailPartnerPreview.classList.remove('hidden');
        }
        if (!myReady) {
            detailMultiBtn.textContent = '플레이';
            detailSoloBtn.textContent = '플레이';
            detailMultiBtn.disabled = false;
            detailSoloBtn.disabled = false;
        }
    } else if (raidPhase !== 'idle') {
        // partner left before the fight started -- go back to searching alone
        raidPhase = 'searching';
        myReady = false;
        detailPartnerPreview.classList.add('hidden');
        detailMultiBtn.disabled = true;
        detailSoloBtn.disabled = true;
        detailLeaveBtn.classList.remove('hidden');
        startSearchTimer();
    }
});

// ---- Fight state ----
let boss = null;
let players = {}; // id -> Player
let raidStartAt = 0;
let loopHandle = null;
const keys = {};
let lastMoveEmit = 0;
let mouseX = null;
let mouseY = null; // canvas-space; null until the mouse first moves over it
let isTargetingUltimate = false; // armed by F for targeted_aoe ultimates, fired by left-click
let impactEffects = []; // [{x, y, radius, until}] fading impact markers, in arena space

socket.on('raidStarted', (data) => {
    boss = new Boss(currentRoomState.bossId);
    boss.setHp(data.bossHp, data.bossMaxHp);
    players = {};
    Object.entries(data.players).forEach(([id, p]) => {
        const pl = new Player(id, p.charType, p.x, p.y, id === socket.id);
        pl.hp = p.hp; pl.maxHp = p.maxHp; pl.facing = p.facing; pl.alive = p.alive;
        players[id] = pl;
    });
    partnerHpContainer.classList.toggle('hidden', Object.keys(players).length < 2);
    raidStartAt = performance.now();
    isTargetingUltimate = false;
    impactEffects = [];
    resetDetailActions();
    settingsMenu.classList.add('hidden');
    leavePendingBanner.classList.add('hidden');
    leaveRequestModal.classList.add('hidden');
    updateHpBars();
    showScreen('fight');
    startLoop();
});

socket.on('playerMoved', ({ id, x, y, facing }) => {
    const p = players[id];
    if (p) { p.x = x; p.y = y; p.facing = facing; }
});

socket.on('bossTelegraph', (data) => { if (boss) boss.onTelegraph(data); });
socket.on('bossAttack', (data) => { if (boss) boss.onAttack(data); });

socket.on('playerSkillUsed', ({ id }) => {
    const p = players[id];
    if (p) p.triggerSkillEffect();
});

socket.on('playerUltimateUsed', ({ id }) => {
    const p = players[id];
    if (p) p.triggerUltimateEffect();
});

socket.on('ultimateImpact', ({ x, y, radius }) => {
    impactEffects.push({ x, y, radius, until: performance.now() + 400 });
});

socket.on('playerHealed', ({ id, hp }) => {
    const p = players[id];
    if (!p) return;
    p.hp = hp;
    p.triggerHealEffect();
    updateHpBars();
});

socket.on('bossDamaged', ({ bossHp }) => {
    if (boss) boss.setHp(bossHp);
    updateHpBars();
});

socket.on('playerDamaged', ({ id, hp, alive, x, y }) => {
    const p = players[id];
    if (!p) return;
    p.hp = hp; p.alive = alive;
    if (x !== undefined) { p.x = x; p.y = y; }
    updateHpBars();
});

// ---- Settings / leave raid ----
settingsBtn.addEventListener('click', () => settingsMenu.classList.toggle('hidden'));

leaveRaidBtn.addEventListener('click', () => {
    settingsMenu.classList.add('hidden');
    const hasPartner = Object.keys(players).length > 1;
    socket.emit('requestLeaveRaid');
    if (hasPartner) leavePendingBanner.classList.remove('hidden');
});

socket.on('leaveRaidRequested', () => {
    leaveRequestModal.classList.remove('hidden');
});

leaveConfirmYes.addEventListener('click', () => {
    leaveRequestModal.classList.add('hidden');
    socket.emit('leaveRaidResponse', { accept: true });
});
leaveConfirmNo.addEventListener('click', () => {
    leaveRequestModal.classList.add('hidden');
    socket.emit('leaveRaidResponse', { accept: false });
});

socket.on('leaveRaidRejected', () => {
    leavePendingBanner.classList.add('hidden');
});

socket.on('raidResult', ({ result }) => {
    stopLoop();
    settingsMenu.classList.add('hidden');
    leavePendingBanner.classList.add('hidden');
    leaveRequestModal.classList.add('hidden');
    if (result === 'left') {
        renderBossList();
        showScreen('bossSelect');
        return;
    }
    if (result === 'win') {
        resultTitle.textContent = '승리!';
        resultTitle.style.color = '#2ecc71';
        resultDesc.textContent = '보스를 물리쳤습니다.';
        if (currentRoomState) recordClear(currentRoomState.bossId, performance.now() - raidStartAt);
    } else {
        resultTitle.textContent = '전멸...';
        resultTitle.style.color = '#e74c3c';
        resultDesc.textContent = '파티가 전멸했습니다.';
    }
    showScreen('result');
});

resultBackBtn.addEventListener('click', () => {
    renderBossList();
    showScreen('bossSelect');
});

function updateHpBars() {
    if (!boss) return;
    bossHpBar.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
    bossHpLabel.textContent = `${boss.def.name} (${Math.max(0, Math.ceil(boss.hp))}/${boss.maxHp})`;
    const me = players[socket.id];
    if (me) myHpBar.style.width = `${Math.max(0, (me.hp / me.maxHp) * 100)}%`;
    const partner = Object.values(players).find(p => p.id !== socket.id);
    if (partner) partnerHpBar.style.width = `${Math.max(0, (partner.hp / partner.maxHp) * 100)}%`;
}

function updateCooldownDisplay(now) {
    const me = players[socket.id];
    if (!me) return;
    if (me.stats.skillType) {
        const remain = Math.max(0, me.stats.skillCooldown - (now - me.lastSkillClientTime)) / 1000;
        mySkillCdEl.textContent = remain > 0.05 ? `${remain.toFixed(1)}s` : '사용가능';
    }
    if (me.stats.ultimateType) {
        const remain = Math.max(0, me.stats.ultimateCooldownMs - (now - me.lastUltimateClientTime)) / 1000;
        myUltimateCdEl.textContent = remain > 0.05 ? `${remain.toFixed(1)}s` : '사용가능';
    }
}

// ---- Input ----
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === 'f' || e.key === 'F') handleUltimateKey();
    if (e.key === 'Escape') isTargetingUltimate = false;
});
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        if (isTargetingUltimate) confirmUltimateTarget();
        else tryAttack();
    } else if (e.button === 2) {
        tryUseSkill();
    }
});
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouseX = (e.clientX - rect.left) * scaleX;
    mouseY = (e.clientY - rect.top) * scaleY;
});

function tryAttack() {
    const me = players[socket.id];
    if (!me) return;
    const now = performance.now();
    if (!me.canAttack(now)) return;
    me.triggerAttackEffect();
    socket.emit('playerAttack');
}

function tryUseSkill() {
    const me = players[socket.id];
    if (!me) return;
    const now = performance.now();
    if (!me.canUseSkill(now)) return;
    me.triggerSkillEffect();
    socket.emit('playerSkill');
}

function tryUseUltimate() {
    const me = players[socket.id];
    if (!me) return;
    const now = performance.now();
    if (!me.canUseUltimate(now)) return;
    me.triggerUltimateEffect();
    socket.emit('playerUltimate');
}

// F does different things depending on the character: instant cast for
// heal-over-time, or arm targeting mode for a click-to-place AOE.
function handleUltimateKey() {
    const me = players[socket.id];
    if (!me) return;
    if (me.stats.ultimateType === 'targeted_aoe') {
        if (isTargetingUltimate) { isTargetingUltimate = false; return; } // F again cancels
        if (!me.canUseUltimate(performance.now())) return;
        isTargetingUltimate = true;
    } else {
        tryUseUltimate();
    }
}

function confirmUltimateTarget() {
    const me = players[socket.id];
    isTargetingUltimate = false;
    if (!me || mouseX === null) return;
    if (!me.canUseUltimate(performance.now())) return;
    me.markUltimateUsed();
    socket.emit('playerUltimate', {
        targetX: mouseX - canvas.width / 2,
        targetY: mouseY - canvas.height / 2
    });
}

// ---- Loop ----
function startLoop() {
    stopLoop();
    loopHandle = requestAnimationFrame(frame);
}
function stopLoop() {
    if (loopHandle) cancelAnimationFrame(loopHandle);
    loopHandle = null;
}

function frame() {
    const now = performance.now();
    const me = players[socket.id];
    if (me) {
        me.updateLocal(keys);
        if (mouseX !== null) {
            me.aimAt(mouseX - canvas.width / 2, mouseY - canvas.height / 2);
        }
        if (now - lastMoveEmit > 33) {
            socket.emit('playerMove', { x: me.x, y: me.y, facing: me.facing });
            lastMoveEmit = now;
        }
        updateCooldownDisplay(now);
    }
    if (boss) boss.update(now);

    render(now);
    loopHandle = requestAnimationFrame(frame);
}

function render(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);

    ctx.beginPath();
    ctx.arc(0, 0, SHARED.ARENA_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (boss) boss.draw(ctx, now);
    Object.values(players).forEach(p => p.draw(ctx, now));

    impactEffects = impactEffects.filter(fx => now < fx.until);
    impactEffects.forEach(fx => {
        const t = 1 - Math.max(0, (fx.until - now) / 400); // 0 -> 1 as it fades
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(142, 68, 173, ${0.5 * (1 - t)})`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(142, 68, 173, 0.9)';
        ctx.lineWidth = 3;
        ctx.stroke();
    });

    if (isTargetingUltimate && mouseX !== null) {
        const me = players[socket.id];
        const radius = me ? me.stats.ultimateRadius : 90;
        ctx.beginPath();
        ctx.setLineDash([8, 6]);
        ctx.arc(mouseX - canvas.width / 2, mouseY - canvas.height / 2, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(142, 68, 173, 0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.restore();
}
