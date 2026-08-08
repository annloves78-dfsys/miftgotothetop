// ==================== 좀비막기 ====================
// 가로로 긴 아레나에서 좀비 웨이브를 막는 생존 모드. 캐릭터는 로비에서 고른
// 것을 그대로 쓴다(게스트 레이드처럼 파티를 새로 짜지 않는다). 아레나
// 전체가 격자로 나뉘어 있고, F를 누르면 뜨는 목록에서 울타리/제작대/용광로/
// 채굴기/집/병사소환기를 고른 뒤 내 근처 칸을 클릭해서 짓는다. 집 위에 서
// 있으면 0.5초마다 체력을 1씩 회복하고, 병사소환기는 15초마다 좀비를 향해
// 걸어가 싸우는 병사를 하나씩 뽑는다. 제작대가 맵 어딘가에 있으면 목록에
// 터렛/강화대/강화 울타리/강화 터렛/대포가 추가로 뜬다 (대포는 사거리 제한이
// 없어 맵 어디의 좀비든 쏜다). 강화대를 지은 뒤 그걸 클릭하면 코인으로
// 공격력/터렛 공격력/울타리 체력/병사 공격력을 강화하는 패널이 뜬다 (이
// 강화들은 이 판에서만 유지된다). 콤보/스킬/궁극기 같은 캐릭터별 특수 전투는 재현하지 않고
// (서버의 resolveAttack이 계산하는) 평범한 부채꼴 근접 공격 하나만 쓴다.
//
// main.js 뒤에 로드되므로 그 파일의 전역(socket, showScreen, gameData,
// charIconBackground, keys, autoAimEnabled, hpBarLabel, equipBonusOf,
// grantCurrencies, rewardChipsHtml, resultTitle/resultDesc/resultRewardsEl,
// resultReturnScreen, resultBackBtn ...)을 그대로 공유한다.

const zombieModeCard = document.getElementById('zombie-mode-card');
const zombieLeaveBtn = document.getElementById('zombie-leave-btn');
const zombieCharIcon = document.getElementById('zombie-char-icon');
const zombieCharName = document.getElementById('zombie-char-name');
const zombieMyReadyBadge = document.getElementById('zombie-my-ready');
const zombieCampfire = document.getElementById('zombie-campfire');
const zombiePartnerPreview = document.getElementById('zombie-partner-preview');
const zombiePartnerIcon = document.getElementById('zombie-partner-icon');
const zombiePartnerName = document.getElementById('zombie-partner-name');
const zombieChangeCharBtn = document.getElementById('zombie-change-char-btn');
const zombieMultiBtn = document.getElementById('zombie-multi-btn');
const zombieSoloBtn = document.getElementById('zombie-solo-btn');
const backFromZombieDetailBtn = document.getElementById('back-from-zombie-detail-btn');

const zombieFightMenuBtn = document.getElementById('zombie-fight-menu-btn');
const zombieFightSettings = document.getElementById('zombie-fight-settings');
const zombieFightLeaveBtn = document.getElementById('zombie-fight-leave-btn');
const zombieCanvas = document.getElementById('zombieCanvas');
const zombieCtx = zombieCanvas.getContext('2d');

// 아레나(격자 15x8)는 늘 고정 크기라 기본 캔버스가 그 크기 그대로 -- 화면 크기
// 조정이 꺼져 있으면 원래처럼 고정 픽셀로 그린다. 켜져 있으면 창에 맞춰
// 축소해서 아레나 전체가 한 화면에 들어오게 한다 (보스레이드 gameCanvas가
// 늘 하는 것과 같은 방식이지만, 여긴 그 토글에만 반응하게 게이팅했다).
const ZOMBIE_BASE_CANVAS_W = SHARED.ZOMBIE_ARENA_HALF_W * 2 + 40;
const ZOMBIE_BASE_CANVAS_H = SHARED.ZOMBIE_ARENA_HALF_H * 2 + 40;
let zombieScale = 1;
function resizeZombieCanvas() {
    if (!compactModeEnabled) {
        zombieCanvas.width = ZOMBIE_BASE_CANVAS_W;
        zombieCanvas.height = ZOMBIE_BASE_CANVAS_H;
        zombieScale = 1;
        return;
    }
    const scale = Math.min(
        (window.innerWidth - 20) / ZOMBIE_BASE_CANVAS_W,
        (window.innerHeight - 20) / ZOMBIE_BASE_CANVAS_H
    );
    zombieCanvas.width = ZOMBIE_BASE_CANVAS_W * scale;
    zombieCanvas.height = ZOMBIE_BASE_CANVAS_H * scale;
    zombieScale = scale;
}
window.addEventListener('resize', resizeZombieCanvas);
resizeZombieCanvas();
const zombieWaveLabel = document.getElementById('zombie-wave-label');
const zombiePhaseLabel = document.getElementById('zombie-phase-label');
const zombieWoodCountEl = document.getElementById('zombie-wood-count');
const zombieCoinCountEl = document.getElementById('zombie-coin-count');
const zombieOreCountEl = document.getElementById('zombie-ore-count');
const zombieIronCountEl = document.getElementById('zombie-iron-count');
const zombieBuildHintEl = document.getElementById('zombie-build-hint');
const zombieBuildBtn = document.getElementById('zombie-build-btn');
const zombieBuildMenuEl = document.getElementById('zombie-build-menu');
const zombieBuildItemEls = [...zombieBuildMenuEl.querySelectorAll('.zombie-build-item')];
// 제작대 근처에서만 뜨는 항목들 (터렛/강화대/강화 울타리/강화 터렛).
const ZOMBIE_WORKBENCH_GATED_IDS = ['zombie-build-turret', 'zombie-build-upgradeTable', 'zombie-build-reinforcedFence', 'zombie-build-reinforcedTurret', 'zombie-build-cannon'];
const zombieWorkbenchGatedEls = ZOMBIE_WORKBENCH_GATED_IDS.map(id => document.getElementById(id));
const zombieUpgradePanelEl = document.getElementById('zombie-upgrade-panel');
const zombieUpgradeCloseBtn = document.getElementById('zombie-upgrade-close-btn');
// 강화대의 세 항목 (공격력/터렛 공격력/울타리 체력). stat이 곧 zombieState의
// 레벨 필드 접두어(atk/turretAtk/fenceHp + "UpgradeLevel")와 맞물린다.
const ZOMBIE_UPGRADE_STATS = [
    { stat: 'attack', levelKey: 'atkUpgradeLevel', el: 'zombie-atk' },
    { stat: 'turretAttack', levelKey: 'turretAtkUpgradeLevel', el: 'zombie-turretAtk' },
    { stat: 'fenceHp', levelKey: 'fenceHpUpgradeLevel', el: 'zombie-fenceHp' },
    { stat: 'soldierAttack', levelKey: 'soldierAtkUpgradeLevel', el: 'zombie-soldierAtk' }
].map(row => ({
    ...row,
    levelEl: document.getElementById(`${row.el}-level`),
    costEl: document.getElementById(`${row.el}-upgrade-cost`),
    btn: document.getElementById(`${row.el}-upgrade-btn`)
}));
const zombieMyHpBar = document.getElementById('zombie-my-hp-bar');
const zombieMyHpText = document.getElementById('zombie-my-hp-text');
const zombiePartnerHpContainer = document.getElementById('zombie-partner-hp-container');
const zombiePartnerHpBar = document.getElementById('zombie-partner-hp-bar');
const zombiePartnerHpText = document.getElementById('zombie-partner-hp-text');

let zombiePhase = 'idle';   // 'idle' | 'searching' | 'matched'
let zombieMyReady = false;
let zombieState = null;     // 서버의 최신 zombieTick/zombieStarted (players/zombies/grid/wave/...)
let zombieTrees = {};       // treeId -> {x, y, hitsLeft} (틱에 안 실려서 따로 관리)
let zombieLoopHandle = null;
let zombieMouseX = null, zombieMouseY = null;
let zombieLocal = null;     // 내 캐릭터의 로컬 예측 { x, y, facing, lastAttackClientTime, attackEffectUntil }
let zombieLastMoveEmit = 0;
let zombieBuildHintTimer = null;
let zombiePendingBuildType = null; // F 메뉴에서 고른 것. null이면 그냥 공격 모드.
let zombieTurretFlashes = [];      // [{fromX,fromY,toX,toY,until}] 터렛이 쏜 순간의 반짝임

function zombieHintShow(text) {
    zombieBuildHintEl.textContent = text;
    zombieBuildHintEl.classList.remove('hidden');
    if (zombieBuildHintTimer) clearTimeout(zombieBuildHintTimer);
    zombieBuildHintTimer = setTimeout(() => zombieBuildHintEl.classList.add('hidden'), 1600);
}

function resetZombieActions() {
    zombiePhase = 'idle';
    zombieMyReady = false;
    zombieMultiBtn.textContent = '멀티플레이';
    zombieSoloBtn.textContent = '솔로플레이';
    zombieMultiBtn.disabled = false;
    zombieSoloBtn.disabled = false;
    zombieMultiBtn.classList.remove('hidden');
    zombieSoloBtn.classList.remove('hidden');
    zombieLeaveBtn.classList.add('hidden');
    zombiePartnerPreview.classList.add('hidden');
    zombieCampfire.classList.add('hidden');
    zombieMyReadyBadge.classList.add('hidden');
    updateZombieDetailCharPreview();
}

function leaveZombieDefenseIfAny() {
    if (zombiePhase !== 'idle') socket.emit('leaveZombieDefense');
    resetZombieActions();
}

function updateZombieDetailCharPreview() {
    const id = gameData.selectedCharacter || 'kicker';
    const stats = SHARED.CHARACTERS[id] || SHARED.CHARACTERS.kicker;
    zombieCharIcon.style.background = charIconBackground(stats);
    zombieCharName.textContent = stats.name;
}

function openZombieDetail() {
    leaveZombieDefenseIfAny();
    updateZombieDetailCharPreview();
    showScreen('zombieDetail');
}

zombieModeCard.addEventListener('click', openZombieDetail);
backFromZombieDetailBtn.addEventListener('click', () => {
    leaveZombieDefenseIfAny();
    showScreen('modeSelect');
});
zombieLeaveBtn.addEventListener('click', () => leaveZombieDefenseIfAny());
zombieChangeCharBtn.addEventListener('click', () => openCharacterSelect('zombieDetail'));

function zombieStartClick(isMulti) {
    const charType = gameData.selectedCharacter || 'kicker';
    if (zombiePhase === 'idle') {
        if (isMulti) {
            zombiePhase = 'searching';
            zombieMultiBtn.disabled = true;
            zombieSoloBtn.disabled = true;
            zombieLeaveBtn.classList.remove('hidden');
            zombieMultiBtn.textContent = '대기중...';
            socket.emit('joinZombieDefense', { charType, equip: equipPayload(charType), instinct: instinctPayload(charType) });
        } else {
            zombieMultiBtn.disabled = true;
            zombieSoloBtn.disabled = true;
            socket.emit('joinZombieDefense', { charType, solo: true, equip: equipPayload(charType), instinct: instinctPayload(charType) });
            socket.emit('startZombieDefense');
        }
    } else if (zombiePhase === 'matched' && !zombieMyReady) {
        zombieMyReady = true;
        zombieMultiBtn.disabled = true;
        zombieMultiBtn.textContent = '플레이 (대기중)';
        zombieMyReadyBadge.classList.remove('hidden');
        socket.emit('zombiePlayerReady');
    }
}
zombieMultiBtn.addEventListener('click', () => zombieStartClick(true));
zombieSoloBtn.addEventListener('click', () => zombieStartClick(false));

socket.on('zombieRoomUpdate', ({ count, players }) => {
    if (count < 2) return;
    zombiePhase = 'matched';
    zombieMultiBtn.textContent = zombieMyReady ? '플레이 (대기중)' : '플레이';
    zombieMultiBtn.disabled = zombieMyReady;
    zombieSoloBtn.classList.add('hidden');
    const other = Object.entries(players).find(([id]) => id !== socket.id);
    if (!other) return;
    const stats = SHARED.CHARACTERS[other[1].charType] || SHARED.CHARACTERS.kicker;
    zombiePartnerIcon.style.background = charIconBackground(stats);
    zombiePartnerName.textContent = stats.name;
    zombiePartnerPreview.classList.remove('hidden');
    zombieCampfire.classList.remove('hidden');
});

// ---------------- 전투 ----------------
function zombieMe() {
    return zombieState && zombieState.players ? zombieState.players[socket.id] : null;
}
function zombieMyStats() {
    const me = zombieMe();
    return SHARED.CHARACTERS[me ? me.charType : 'kicker'] || SHARED.CHARACTERS.kicker;
}

socket.on('zombieStarted', (data) => {
    zombieState = {
        players: data.players, zombies: {}, grid: data.grid || new Array(SHARED.ZOMBIE_CELL_COUNT).fill(null),
        soldiers: data.soldiers || {},
        wave: data.wave, wavePhase: data.wavePhase, phaseUntil: data.phaseUntil,
        pendingSpawns: 0, wood: data.wood, coins: data.coins,
        ore: data.ore || 0, iron: data.iron || 0,
        atkUpgradeLevel: data.atkUpgradeLevel || 0,
        turretAtkUpgradeLevel: data.turretAtkUpgradeLevel || 0,
        fenceHpUpgradeLevel: data.fenceHpUpgradeLevel || 0,
        soldierAtkUpgradeLevel: data.soldierAtkUpgradeLevel || 0
    };
    zombieTrees = { ...data.trees };
    const me = data.players[socket.id];
    zombieLocal = me ? {
        x: me.x, y: me.y, facing: -Math.PI / 2,
        lastAttackClientTime: -Infinity, attackEffectUntil: 0
    } : null;
    if (me) {
        const b = equipBonusOf(me.charType);
        zombieLocal.equipSpeed = b.speed;
        zombieLocal.equipCooldown = b.cooldown;
    }
    zombiePendingBuildType = null;
    zombieTurretFlashes = [];
    closeZombieBuildMenu();
    resetZombieActions();
    zombiePhase = 'idle';
    zombieFightSettings.classList.add('hidden');
    updateZombieHud();
    updateZombieHpBars();
    showScreen('zombieFight');
    startZombieLoop();
});

socket.on('zombieTick', (data) => {
    if (!zombieState) return;
    zombieState.players = data.players;
    zombieState.zombies = data.zombies || {};
    zombieState.grid = data.grid || zombieState.grid;
    zombieState.soldiers = data.soldiers || {};
    zombieState.wave = data.wave;
    zombieState.wavePhase = data.wavePhase;
    zombieState.phaseUntil = data.phaseUntil;
    zombieState.pendingSpawns = data.pendingSpawns || 0;
    zombieState.wood = data.wood;
    zombieState.coins = data.coins;
    zombieState.ore = data.ore || 0;
    zombieState.iron = data.iron || 0;
    zombieState.atkUpgradeLevel = data.atkUpgradeLevel || 0;
    zombieState.turretAtkUpgradeLevel = data.turretAtkUpgradeLevel || 0;
    zombieState.fenceHpUpgradeLevel = data.fenceHpUpgradeLevel || 0;
    zombieState.soldierAtkUpgradeLevel = data.soldierAtkUpgradeLevel || 0;
    updateZombieHud();
    updateZombieHpBars();
    updateZombieUpgradePanel();
});

socket.on('zombieStatUpgraded', ({ stat, level, coins }) => {
    if (!zombieState) return;
    const row = ZOMBIE_UPGRADE_STATS.find(r => r.stat === stat);
    if (row) zombieState[row.levelKey] = level;
    zombieState.coins = coins;
    updateZombieHud();
    updateZombieUpgradePanel();
});

socket.on('zombieTreeSpawned', ({ id, x, y, hitsLeft }) => {
    zombieTrees[id] = { x, y, hitsLeft };
});
socket.on('zombieTreeChopped', ({ id, gone, hitsLeft }) => {
    if (gone) delete zombieTrees[id];
    else if (zombieTrees[id]) zombieTrees[id].hitsLeft = hitsLeft;
});

socket.on('zombieTurretFired', ({ index, targetId }) => {
    const target = zombieState && zombieState.zombies[targetId];
    if (!target) return;
    const center = SHARED.zombieCellCenter(index);
    zombieTurretFlashes.push({ fromX: center.x, fromY: center.y, toX: target.x, toY: target.y, until: performance.now() + 140 });
});

socket.on('zombieResult', ({ wave, coins }) => {
    stopZombieLoop();
    zombieState = null;
    zombieTrees = {};
    zombieLocal = null;
    zombiePendingBuildType = null;
    closeZombieBuildMenu();
    const waveReached = Math.max(1, wave);
    const bag = SHARED.zombieWaveReward(waveReached);
    if (coins) bag.coins = (bag.coins || 0) + coins;
    grantCurrencies(bag);
    resultTitle.textContent = '전멸...';
    resultTitle.style.color = '#e74c3c';
    resultDesc.textContent = `${waveReached}웨이브까지 버텼습니다.`;
    resultRewardsEl.innerHTML = rewardChipsHtml(bag);
    resultReturnScreen = 'modeSelect';
    resultBackBtn.textContent = '모드 선택으로';
    resetZombieActions();
    showScreen('result');
});

zombieFightMenuBtn.addEventListener('click', () => zombieFightSettings.classList.toggle('hidden'));
zombieFightLeaveBtn.addEventListener('click', () => {
    socket.emit('leaveZombieDefense');
    stopZombieLoop();
    zombieState = null;
    zombieTrees = {};
    zombieLocal = null;
    zombiePendingBuildType = null;
    closeZombieBuildMenu();
    resetZombieActions();
    showScreen('zombieDetail');
});

// ---------------- HUD ----------------
function updateZombieHud() {
    if (!zombieState) return;
    zombieWaveLabel.textContent = `웨이브 ${zombieState.wave}`;
    if (zombieState.wavePhase === 'prep') {
        const remain = Math.max(0, Math.ceil((zombieState.phaseUntil - Date.now()) / 1000));
        zombiePhaseLabel.textContent = `준비 중... ${remain}초`;
    } else {
        const left = Object.keys(zombieState.zombies).length + zombieState.pendingSpawns;
        zombiePhaseLabel.textContent = `좀비 ${left}마리 남음`;
    }
    zombieWoodCountEl.textContent = zombieState.wood;
    zombieCoinCountEl.textContent = zombieState.coins;
    zombieOreCountEl.textContent = zombieState.ore;
    zombieIronCountEl.textContent = zombieState.iron;
}

function updateZombieHpBars() {
    if (!zombieState) return;
    const me = zombieMe();
    if (me) {
        zombieMyHpBar.style.width = `${Math.max(0, me.hp / me.maxHp) * 100}%`;
        zombieMyHpText.textContent = hpBarLabel(me.hp, me.maxHp);
    }
    const other = Object.entries(zombieState.players).find(([id]) => id !== socket.id);
    zombiePartnerHpContainer.classList.toggle('hidden', !other);
    if (other) {
        zombiePartnerHpBar.style.width = `${Math.max(0, other[1].hp / other[1].maxHp) * 100}%`;
        zombiePartnerHpText.textContent = hpBarLabel(other[1].hp, other[1].maxHp);
    }
}

// ---------------- 건설 ----------------
// 지금 내가 서 있는 칸 기준으로 지을 수 있는 이웃 칸들.
function zombieMyBuildableCells() {
    if (!zombieLocal) return [];
    const { col, row } = SHARED.zombieColRowOfPos(zombieLocal.x, zombieLocal.y);
    return SHARED.zombieBuildableCellsFrom(col, row);
}

// 맵 어딘가에 제작대가 하나라도 지어져 있으면 (바로 옆일 필요는 없다) 터렛
// 등 제작대 전용 항목이 뜬다.
function zombieHasWorkbenchAnywhere() {
    if (!zombieState) return false;
    return zombieState.grid.some(c => c && c.type === 'workbench');
}

function openZombieBuildMenu() {
    if (!zombieState) return;
    const hasWorkbench = zombieHasWorkbenchAnywhere();
    zombieWorkbenchGatedEls.forEach(el => el.classList.toggle('hidden', !hasWorkbench));
    zombieBuildMenuEl.classList.remove('hidden');
}
function closeZombieBuildMenu() {
    zombieBuildMenuEl.classList.add('hidden');
    zombieBuildItemEls.forEach(el => el.classList.remove('selected'));
}
function toggleZombieBuildMenu() {
    if (zombieBuildMenuEl.classList.contains('hidden')) openZombieBuildMenu();
    else { closeZombieBuildMenu(); zombiePendingBuildType = null; }
}
zombieBuildBtn.addEventListener('click', toggleZombieBuildMenu);

function zombieCostOf(type) {
    return SHARED.ZOMBIE_BUILDABLES[type] || SHARED.ZOMBIE_WORKBENCH_ITEMS[type];
}

zombieBuildItemEls.forEach(el => {
    el.addEventListener('click', () => {
        const type = el.dataset.type;
        const cost = zombieCostOf(type);
        if (zombieState.wood < (cost.wood || 0) || zombieState.iron < (cost.iron || 0)) {
            zombieHintShow(`재료가 부족합니다 (🪵 ${zombieState.wood}/${cost.wood || 0} 🔩 ${zombieState.iron}/${cost.iron || 0})`);
            return;
        }
        zombiePendingBuildType = type;
        zombieBuildItemEls.forEach(b => b.classList.toggle('selected', b === el));
        // 목록이 뜬 채로 있으면 지을 칸이 가려지니, 고르자마자 접는다.
        zombieBuildMenuEl.classList.add('hidden');
        zombieHintShow('지을 칸을 클릭하세요 (Esc로 취소)');
    });
});

function cancelZombiePendingBuild() {
    zombiePendingBuildType = null;
    closeZombieBuildMenu();
}

// ---------------- 강화대 ----------------
function updateZombieUpgradePanel() {
    if (!zombieState) return;
    ZOMBIE_UPGRADE_STATS.forEach(row => {
        const level = zombieState[row.levelKey] || 0;
        row.levelEl.textContent = `Lv.${level}`;
        row.costEl.textContent = SHARED.zombieUpgradeCost(level);
    });
}
function openZombieUpgradePanel() {
    updateZombieUpgradePanel();
    zombieUpgradePanelEl.classList.remove('hidden');
}
function closeZombieUpgradePanel() {
    zombieUpgradePanelEl.classList.add('hidden');
}
ZOMBIE_UPGRADE_STATS.forEach(row => {
    row.btn.addEventListener('click', () => socket.emit('zombieUpgradeStat', { stat: row.stat }));
});
zombieUpgradeCloseBtn.addEventListener('click', closeZombieUpgradePanel);

// 내 근처(건설 가능 이웃 칸이나 내가 서 있는 칸)에 강화대가 있는지.
function zombieNearbyUpgradeTableIndex() {
    if (!zombieLocal || !zombieState) return -1;
    const myCell = SHARED.zombieCellIndexOfPos(zombieLocal.x, zombieLocal.y);
    const cells = [myCell, ...zombieMyBuildableCells()];
    return cells.find(i => zombieState.grid[i] && zombieState.grid[i].type === 'upgradeTable') ?? -1;
}

document.addEventListener('keydown', (e) => {
    if (!zombieState || screens.zombieFight.classList.contains('hidden')) return;
    if (e.key === 'f' || e.key === 'F') toggleZombieBuildMenu();
    else if (e.key === 'Escape') { cancelZombiePendingBuild(); closeZombieUpgradePanel(); }
});

// ---------------- 입력 ----------------
zombieCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
zombieCanvas.addEventListener('mousemove', (e) => {
    const rect = zombieCanvas.getBoundingClientRect();
    zombieMouseX = (e.clientX - rect.left) * (zombieCanvas.width / rect.width);
    zombieMouseY = (e.clientY - rect.top) * (zombieCanvas.height / rect.height);
});
zombieCanvas.addEventListener('mousedown', (e) => {
    if (e.button === 2) { cancelZombiePendingBuild(); return; }
    if (e.button !== 0) return;
    if (zombiePendingBuildType) { tryZombiePlaceAtMouse(); return; }
    if (tryZombieOpenUpgradeAtMouse()) return;
    // 조이스틱이 켜져 있으면 자동조준은 끈다 (조이스틱 방향과 어긋나므로) --
    // mc-attack-zombie 버튼과 같은 이유.
    if (!mobileControlsEnabled && autoAimEnabled) fireZombieAutoAimedAttack();
    else tryZombieAttack();
});

function zombieWorldFromMouse() {
    return {
        x: (zombieMouseX - zombieCanvas.width / 2) / zombieScale,
        y: (zombieMouseY - zombieCanvas.height / 2) / zombieScale
    };
}

// 클릭이 내가 지은 강화대 위에 떨어졌으면 (근처에 있을 때만) 공격 대신
// 강화 패널을 연다. 강화대를 클릭했는데 너무 멀면 힌트만 띄우고, 어느
// 쪽이든 그 클릭은 공격으로 넘기지 않는다.
function tryZombieOpenUpgradeAtMouse() {
    if (!zombieState || !zombieLocal || zombieMouseX === null) return false;
    const w = zombieWorldFromMouse();
    if (Math.abs(w.x) > SHARED.ZOMBIE_ARENA_HALF_W || Math.abs(w.y) > SHARED.ZOMBIE_ARENA_HALF_H) return false;
    const index = SHARED.zombieCellIndexOfPos(w.x, w.y);
    const cell = zombieState.grid[index];
    if (!cell || cell.type !== 'upgradeTable') return false;
    const myCell = SHARED.zombieCellIndexOfPos(zombieLocal.x, zombieLocal.y);
    if (![myCell, ...zombieMyBuildableCells()].includes(index)) {
        zombieHintShow('강화대에 더 가까이 가세요');
        return true;
    }
    openZombieUpgradePanel();
    return true;
}

function tryZombiePlaceAtMouse() {
    if (!zombieState || zombieMouseX === null) return;
    const w = zombieWorldFromMouse();
    if (Math.abs(w.x) > SHARED.ZOMBIE_ARENA_HALF_W || Math.abs(w.y) > SHARED.ZOMBIE_ARENA_HALF_H) return;
    const index = SHARED.zombieCellIndexOfPos(w.x, w.y);
    const buildable = zombieMyBuildableCells();
    if (!buildable.includes(index)) {
        zombieHintShow('내 근처 칸에만 지을 수 있어요');
        return;
    }
    if (zombieState.grid[index]) {
        zombieHintShow('이미 지어진 칸입니다');
        return;
    }
    socket.emit('zombieBuild', { type: zombiePendingBuildType, index });
    zombiePendingBuildType = null;
    closeZombieBuildMenu();
}

function tryZombieAttack() {
    if (!zombieLocal || !zombieState) return;
    const stats = zombieMyStats();
    const now = performance.now();
    if (now - zombieLocal.lastAttackClientTime < stats.attackCooldown) return;
    zombieLocal.lastAttackClientTime = now;
    zombieLocal.attackEffectUntil = now + 180;
    socket.emit('zombiePlayerAttack');
}

function zombieNearestZombieWorldPos() {
    if (!zombieState || !zombieLocal) return null;
    let nearest = null, nearestDist = Infinity;
    Object.values(zombieState.zombies).forEach(z => {
        const d = Math.hypot(z.x - zombieLocal.x, z.y - zombieLocal.y);
        if (d < nearestDist) { nearestDist = d; nearest = z; }
    });
    return nearest;
}

function fireZombieAutoAimedAttack() {
    if (!zombieLocal) return;
    const target = zombieNearestZombieWorldPos();
    if (target) zombieLocal.facing = Math.atan2(target.y - zombieLocal.y, target.x - zombieLocal.x);
    socket.emit('zombiePlayerMove', { x: zombieLocal.x, y: zombieLocal.y, facing: zombieLocal.facing });
    tryZombieAttack();
}

// ---------------- mobile controls ----------------
// Reuses the boss raid's `joystickMoveVec`/`joystickFacing` (fight screens are
// never on screen at the same time, same trick guest_raid.js uses). 좀비막기는
// 스킬/궁극기가 없으니 조이스틱과 공격 버튼만 있으면 된다 -- 건설은 여전히
// F키/건설 버튼으로.
//
// 조이스틱이 켜져 있으면(mobileControlsEnabled) 이미 조이스틱 방향이 바로
// facing이 된다(zombieFrame 참고) -- 그 위에 자동조준까지 덮어씌우면 스틱을
// 미는 방향과 실제 공격 방향이 어긋난다. 그래서 공격 버튼은 자동조준으로
// 방향을 다시 잡지 않고, 지금 향한 방향 그대로 휘두른다.
const mcJoystickZombieEl = document.getElementById('mc-joystick-zombie');
const mcAttackZombieEl = document.getElementById('mc-attack-zombie');
setupJoystick(mcJoystickZombieEl, false);
mcTap(mcAttackZombieEl, () => tryZombieAttack());

// ---------------- 루프 + 렌더 ----------------
function startZombieLoop() {
    stopZombieLoop();
    zombieLoopHandle = requestAnimationFrame(zombieFrame);
}
function stopZombieLoop() {
    if (zombieLoopHandle) cancelAnimationFrame(zombieLoopHandle);
    zombieLoopHandle = null;
}

function zombieFrame() {
    const now = performance.now();
    const me = zombieMe();
    if (zombieLocal && me && me.alive) {
        const stats = zombieMyStats();
        const speed = moveSpeedFor(stats, now, 0, 0, false, zombieLocal.equipSpeed, undefined, !!joystickMoveVec);
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
        if (dx !== 0 || dy !== 0) {
            const HW = SHARED.ZOMBIE_ARENA_HALF_W, HH = SHARED.ZOMBIE_ARENA_HALF_H;
            zombieLocal.x = Math.max(-HW, Math.min(HW, zombieLocal.x + dx));
            zombieLocal.y = Math.max(-HH, Math.min(HH, zombieLocal.y + dy));
        }
        if (mobileControlsEnabled) {
            if (joystickFacing !== null) zombieLocal.facing = joystickFacing;
        } else if (autoAimEnabled) {
            const target = zombieNearestZombieWorldPos();
            if (target) zombieLocal.facing = Math.atan2(target.y - zombieLocal.y, target.x - zombieLocal.x);
        } else if (zombieMouseX !== null) {
            const w = zombieWorldFromMouse();
            zombieLocal.facing = Math.atan2(w.y - zombieLocal.y, w.x - zombieLocal.x);
        }
        if (now - zombieLastMoveEmit > 33) {
            socket.emit('zombiePlayerMove', { x: zombieLocal.x, y: zombieLocal.y, facing: zombieLocal.facing });
            zombieLastMoveEmit = now;
        }
    }
    if (Math.floor(now / 500) !== Math.floor((now - 16) / 500)) updateZombieHud(); // 준비 시간 카운트다운 갱신
    zombieRender(now);
    zombieLoopHandle = requestAnimationFrame(zombieFrame);
}

const ZOMBIE_STRUCT_COLORS = {
    fence: { fill: '#8d6238', stroke: '#5a3d21' },
    workbench: { fill: '#7f6a4f', stroke: '#4a3c2a' },
    furnace: { fill: '#5c5c5c', stroke: '#2e2e2e' },
    miner: { fill: '#6b5638', stroke: '#3d3120' },
    house: { fill: '#c0703c', stroke: '#7a3f1f' },
    turret: { fill: '#34495e', stroke: '#1b2733' },
    upgradeTable: { fill: '#8e44ad', stroke: '#5b2c6f' },
    reinforcedFence: { fill: '#a5682f', stroke: '#5a3d21' },
    reinforcedTurret: { fill: '#2c5f7c', stroke: '#173040' },
    cannon: { fill: '#4a4a2a', stroke: '#2a2a15' },
    soldierSpawner: { fill: '#4a6b4a', stroke: '#28402a' }
};
// 칸 위에 그릴 아이콘. 기본/제작대 전용 건조물 표 양쪽에서 찾는다.
function zombieStructIcon(type) {
    const def = (SHARED.ZOMBIE_BUILDABLES && SHARED.ZOMBIE_BUILDABLES[type]) || (SHARED.ZOMBIE_WORKBENCH_ITEMS && SHARED.ZOMBIE_WORKBENCH_ITEMS[type]);
    return def ? def.icon : null;
}

function zombieDrawGrid(ctx, now) {
    const HW = SHARED.ZOMBIE_ARENA_HALF_W, HH = SHARED.ZOMBIE_ARENA_HALF_H, C = SHARED.ZOMBIE_CELL_SIZE;
    const COLS = SHARED.ZOMBIE_GRID_COLS, ROWS = SHARED.ZOMBIE_GRID_ROWS;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= COLS; i++) {
        const p = -HW + i * C;
        ctx.beginPath(); ctx.moveTo(p, -HH); ctx.lineTo(p, HH); ctx.stroke();
    }
    for (let i = 0; i <= ROWS; i++) {
        const p = -HH + i * C;
        ctx.beginPath(); ctx.moveTo(-HW, p); ctx.lineTo(HW, p); ctx.stroke();
    }

    const buildable = (zombiePendingBuildType && zombieLocal) ? zombieMyBuildableCells() : [];

    for (let index = 0; index < SHARED.ZOMBIE_CELL_COUNT; index++) {
        const cell = zombieState.grid[index];
        const center = SHARED.zombieCellCenter(index);
        if (cell) {
            const skin = ZOMBIE_STRUCT_COLORS[cell.type] || ZOMBIE_STRUCT_COLORS.fence;
            const half = C * 0.38;
            ctx.fillStyle = skin.fill;
            ctx.fillRect(center.x - half, center.y - half, half * 2, half * 2);
            ctx.strokeStyle = skin.stroke;
            ctx.lineWidth = 3;
            ctx.strokeRect(center.x - half, center.y - half, half * 2, half * 2);
            const icon = zombieStructIcon(cell.type);
            if (icon) {
                ctx.fillStyle = '#ecf0f1';
                ctx.font = 'bold 16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(icon, center.x, center.y + 6);
            }
            const pct = Math.max(0, cell.hp / cell.maxHp);
            ctx.fillStyle = '#7f1d1d';
            ctx.fillRect(center.x - half, center.y - half - 8, half * 2, 4);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(center.x - half, center.y - half - 8, half * 2 * pct, 4);
        } else if (buildable.includes(index)) {
            const half = C * 0.42;
            ctx.fillStyle = 'rgba(241, 196, 15, 0.22)';
            ctx.fillRect(center.x - half, center.y - half, half * 2, half * 2);
            ctx.strokeStyle = 'rgba(241, 196, 15, 0.85)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(center.x - half, center.y - half, half * 2, half * 2);
            ctx.setLineDash([]);
        }
    }
    ctx.restore();
}

function zombieDrawTree(ctx, t) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.beginPath();
    ctx.arc(0, 0, SHARED.ZOMBIE_TREE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#3d6b32';
    ctx.fill();
    ctx.strokeStyle = '#274a1f';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(t.hitsLeft), 0, 4);
    ctx.restore();
}

function zombieDrawMob(ctx, z) {
    const def = SHARED.ZOMBIE_DEFS[z.type];
    ctx.save();
    ctx.translate(z.x, z.y);
    ctx.beginPath();
    ctx.arc(0, 0, def.radius, 0, Math.PI * 2);
    ctx.fillStyle = def.color;
    ctx.fill();
    ctx.strokeStyle = '#1b1b1b';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    const barW = def.radius * 2, barH = 4;
    const barY = z.y - def.radius - 8 - barH;
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(z.x - barW / 2, barY, barW, barH);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(z.x - barW / 2, barY, barW * Math.max(0, z.hp / z.maxHp), barH);
}

// 병사소환기가 뽑은 병사. 좀비와 구분되게 파란 계열로 그린다.
function zombieDrawSoldier(ctx, s) {
    const R = SHARED.ZOMBIE_SOLDIER_DEF.radius;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = '#3f6fb0';
    ctx.fill();
    ctx.strokeStyle = '#1b2733';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    const barW = R * 2, barH = 4;
    const barY = s.y - R - 8 - barH;
    ctx.fillStyle = '#1d3a5f';
    ctx.fillRect(s.x - barW / 2, barY, barW, barH);
    ctx.fillStyle = '#5dade2';
    ctx.fillRect(s.x - barW / 2, barY, barW * Math.max(0, s.hp / s.maxHp), barH);
}

function zombieDrawPlayer(ctx, p, isLocal, now) {
    const R = SHARED.PLAYER_RADIUS;
    const x = isLocal ? zombieLocal.x : p.x;
    const y = isLocal ? zombieLocal.y : p.y;
    const facing = isLocal ? zombieLocal.facing : p.facing;
    const stats = SHARED.CHARACTERS[p.charType] || SHARED.CHARACTERS.kicker;
    ctx.save();
    ctx.translate(x, y);

    if (isLocal && now < zombieLocal.attackEffectUntil) {
        ctx.save();
        ctx.rotate(facing);
        ctx.fillStyle = 'rgba(241, 196, 15, 0.35)';
        ctx.fillRect(R, -(stats.attackWidth || 40) / 2, stats.attackRange || 90, stats.attackWidth || 40);
        ctx.restore();
    }

    ctx.globalAlpha = p.alive ? 1 : 0.4;
    drawCookieBody(ctx, R, stats, p.alive);
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.lineWidth = isLocal ? 4 : 2;
    ctx.strokeStyle = isLocal ? '#f1c40f' : '#2c3e50';
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.rotate(facing);
    ctx.beginPath();
    ctx.moveTo(R + 12, 0);
    ctx.lineTo(R + 2, -6);
    ctx.lineTo(R + 2, 6);
    ctx.closePath();
    ctx.fillStyle = p.alive ? '#f1c40f' : '#7f8c8d';
    ctx.fill();
    drawCharacterWeapon(ctx, R, stats, p.alive);
    ctx.restore();

    const barW = 40, barH = 5;
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(x - barW / 2, y - R - 8 - barH, barW, barH);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(x - barW / 2, y - R - 8 - barH, barW * Math.max(0, p.hp / p.maxHp), barH);
}

function zombieRender(now) {
    zombieCtx.clearRect(0, 0, zombieCanvas.width, zombieCanvas.height);
    zombieCtx.save();
    zombieCtx.translate(zombieCanvas.width / 2, zombieCanvas.height / 2);
    zombieCtx.scale(zombieScale, zombieScale);

    const HW = SHARED.ZOMBIE_ARENA_HALF_W, HH = SHARED.ZOMBIE_ARENA_HALF_H;
    zombieCtx.fillStyle = '#2a3320';
    zombieCtx.fillRect(-HW, -HH, HW * 2, HH * 2);
    zombieCtx.strokeStyle = 'rgba(241, 196, 15, 0.4)';
    zombieCtx.lineWidth = 4;
    zombieCtx.strokeRect(-HW, -HH, HW * 2, HH * 2);

    if (!zombieState) { zombieCtx.restore(); return; }

    zombieDrawGrid(zombieCtx, now);
    Object.values(zombieTrees).forEach(t => zombieDrawTree(zombieCtx, t));
    Object.values(zombieState.soldiers || {}).forEach(s => zombieDrawSoldier(zombieCtx, s));
    Object.values(zombieState.zombies).forEach(z => zombieDrawMob(zombieCtx, z));
    Object.entries(zombieState.players).forEach(([id, p]) => {
        zombieDrawPlayer(zombieCtx, p, id === socket.id, now);
    });

    zombieTurretFlashes = zombieTurretFlashes.filter(f => now < f.until);
    zombieTurretFlashes.forEach(f => {
        zombieCtx.save();
        zombieCtx.strokeStyle = 'rgba(255, 220, 120, 0.9)';
        zombieCtx.lineWidth = 2;
        zombieCtx.beginPath();
        zombieCtx.moveTo(f.fromX, f.fromY);
        zombieCtx.lineTo(f.toX, f.toY);
        zombieCtx.stroke();
        zombieCtx.restore();
    });

    zombieCtx.restore();
}
