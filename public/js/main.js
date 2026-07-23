const socket = io();

// ---- Screens ----
const screens = {
    lobby: document.getElementById('lobby-screen'),
    characterSelect: document.getElementById('character-select-screen'),
    bossSelect: document.getElementById('boss-select-screen'),
    waiting: document.getElementById('waiting-screen'),
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
const backToLobbyBtn = document.getElementById('back-to-lobby-btn');
const bossListEl = document.getElementById('boss-list');
const waitingBossName = document.getElementById('waiting-boss-name');
const waitingStatus = document.getElementById('waiting-status');
const startSoloBtn = document.getElementById('start-solo-btn');
const cancelWaitingBtn = document.getElementById('cancel-waiting-btn');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const bossHpBar = document.getElementById('boss-hp-bar');
const bossHpLabel = document.getElementById('boss-hp-label');
const myHpBar = document.getElementById('my-hp-bar');
const partnerHpContainer = document.getElementById('partner-hp-container');
const partnerHpBar = document.getElementById('partner-hp-bar');
const resultTitle = document.getElementById('result-title');
const resultDesc = document.getElementById('result-desc');
const resultBackBtn = document.getElementById('result-back-btn');

let gameData = loadGameData();

// ---- Character select ----
function updateSelectedCharLabel() {
    const stats = SHARED.CHARACTERS[gameData.selectedCharacter] || SHARED.CHARACTERS.kicker;
    selectedCharNameEl.textContent = stats.name;
}
updateSelectedCharLabel();

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
                showScreen('lobby');
            });
        }
        characterListEl.appendChild(card);
    });
}

characterSelectBtn.addEventListener('click', () => {
    renderCharacterList();
    showScreen('characterSelect');
});
backFromCharacterBtn.addEventListener('click', () => showScreen('lobby'));

// ---- Boss select ----
function renderBossList() {
    bossListEl.innerHTML = '';
    SHARED.BOSS_LIST.forEach(b => {
        const card = document.createElement('div');
        card.className = 'boss-card' + (b.locked ? ' locked' : '');
        card.innerHTML = `<div class="icon">${b.locked ? '🔒' : '🗿'}</div><div class="name">${b.name}</div>`;
        if (!b.locked) card.addEventListener('click', () => joinRaid(b.id));
        bossListEl.appendChild(card);
    });
}

playBtn.addEventListener('click', () => {
    renderBossList();
    showScreen('bossSelect');
});
backToLobbyBtn.addEventListener('click', () => showScreen('lobby'));

// ---- Waiting room ----
let currentRoomState = null; // { roomId, bossId, count, players }

function joinRaid(bossId) {
    socket.emit('joinRaid', { bossId, charType: gameData.selectedCharacter || 'kicker' });
    const bossDef = SHARED.BOSS_DEFS[bossId];
    waitingBossName.textContent = bossDef.name;
    waitingStatus.textContent = '대기 중... (1/2)';
    showScreen('waiting');
}

startSoloBtn.addEventListener('click', () => socket.emit('startRaid'));
cancelWaitingBtn.addEventListener('click', () => {
    socket.emit('leaveRaid');
    currentRoomState = null;
    showScreen('bossSelect');
});

socket.on('raidRoomUpdate', (data) => {
    currentRoomState = data;
    if (!screens.waiting.classList.contains('hidden')) {
        waitingStatus.textContent = `대기 중... (${data.count}/2)`;
    }
});

// ---- Fight state ----
let boss = null;
let players = {}; // id -> Player
let raidStartAt = 0;
let loopHandle = null;
const keys = {};
let lastMoveEmit = 0;

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

socket.on('raidResult', ({ result }) => {
    stopLoop();
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

// ---- Input ----
window.addEventListener('keydown', (e) => { keys[e.key] = true; });
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) tryAttack();
    else if (e.button === 2) tryUseSkill();
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
        const moved = me.updateLocal(keys);
        if (moved && now - lastMoveEmit > 33) {
            socket.emit('playerMove', { x: me.x, y: me.y, facing: me.facing });
            lastMoveEmit = now;
        }
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

    ctx.restore();
}
