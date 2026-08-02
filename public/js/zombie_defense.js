// ==================== 좀비막기 ====================
// 원형 아레나 한가운데서 좀비 웨이브를 막는 생존 모드. 캐릭터는 로비에서
// 고른 것을 그대로 쓴다(게스트 레이드처럼 파티를 새로 짜지 않는다). 준비
// 시간에 나무를 베어 목재를 모으고, 그 목재로 링 위 울타리 칸을 채워 좀비의
// 진입을 막는다. 콤보/스킬/궁극기 같은 캐릭터별 특수 전투는 재현하지 않고
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
const zombieWaveLabel = document.getElementById('zombie-wave-label');
const zombiePhaseLabel = document.getElementById('zombie-phase-label');
const zombieWoodCountEl = document.getElementById('zombie-wood-count');
const zombieCoinCountEl = document.getElementById('zombie-coin-count');
const zombieBuildHintEl = document.getElementById('zombie-build-hint');
const zombieBuildBtn = document.getElementById('zombie-build-btn');
const zombieMyHpBar = document.getElementById('zombie-my-hp-bar');
const zombieMyHpText = document.getElementById('zombie-my-hp-text');
const zombiePartnerHpContainer = document.getElementById('zombie-partner-hp-container');
const zombiePartnerHpBar = document.getElementById('zombie-partner-hp-bar');
const zombiePartnerHpText = document.getElementById('zombie-partner-hp-text');

let zombiePhase = 'idle';   // 'idle' | 'searching' | 'matched'
let zombieMyReady = false;
let zombieState = null;     // 서버의 최신 zombieTick/zombieStarted
let zombieTrees = {};       // treeId -> {x, y, hitsLeft} (틱에 안 실려서 따로 관리)
let zombieLoopHandle = null;
let zombieMouseX = null, zombieMouseY = null;
let zombieLocal = null;     // 내 캐릭터의 로컬 예측 { x, y, facing, lastAttackClientTime, attackEffectUntil }
let zombieLastMoveEmit = 0;
let zombieBuildHintTimer = null;

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
            socket.emit('joinZombieDefense', { charType, equip: equipPayload(charType) });
        } else {
            zombieMultiBtn.disabled = true;
            zombieSoloBtn.disabled = true;
            socket.emit('joinZombieDefense', { charType, solo: true, equip: equipPayload(charType) });
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
        players: data.players, zombies: {}, fences: data.fences || {},
        wave: data.wave, wavePhase: data.wavePhase, phaseUntil: data.phaseUntil,
        pendingSpawns: 0, wood: data.wood, coins: data.coins
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
    zombieState.fences = data.fences || {};
    zombieState.wave = data.wave;
    zombieState.wavePhase = data.wavePhase;
    zombieState.phaseUntil = data.phaseUntil;
    zombieState.pendingSpawns = data.pendingSpawns || 0;
    zombieState.wood = data.wood;
    zombieState.coins = data.coins;
    updateZombieHud();
    updateZombieHpBars();
});

socket.on('zombieTreeSpawned', ({ id, x, y, hitsLeft }) => {
    zombieTrees[id] = { x, y, hitsLeft };
});
socket.on('zombieTreeChopped', ({ id, gone, hitsLeft }) => {
    if (gone) delete zombieTrees[id];
    else if (zombieTrees[id]) zombieTrees[id].hitsLeft = hitsLeft;
});

socket.on('zombieResult', ({ wave, coins }) => {
    stopZombieLoop();
    zombieState = null;
    zombieTrees = {};
    zombieLocal = null;
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
// 내 위치에서 지을 수 있는 범위 안에 있는 빈 칸 중 가장 가까운 것을 찾는다.
function zombieNearestBuildableSlot() {
    if (!zombieLocal) return -1;
    let best = -1, bestDist = Infinity;
    SHARED.ZOMBIE_WALL_SLOT_POSITIONS.forEach((pos, i) => {
        if (zombieState.fences[i]) return;
        const d = Math.hypot(zombieLocal.x - pos.x, zombieLocal.y - pos.y);
        if (d <= SHARED.ZOMBIE_BUILD_RANGE && d < bestDist) { bestDist = d; best = i; }
    });
    return best;
}

function tryZombieBuild() {
    if (!zombieState || !zombieLocal) return;
    if (zombieState.wood < SHARED.ZOMBIE_FENCE_WOOD_COST) {
        zombieHintShow(`목재가 부족합니다 (🪵 ${zombieState.wood}/${SHARED.ZOMBIE_FENCE_WOOD_COST})`);
        return;
    }
    const slot = zombieNearestBuildableSlot();
    if (slot < 0) {
        zombieHintShow('울타리 칸에 더 가까이 가세요');
        return;
    }
    socket.emit('zombieBuildWall', { slot });
}
zombieBuildBtn.addEventListener('click', tryZombieBuild);

// ---------------- 입력 ----------------
zombieCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
zombieCanvas.addEventListener('mousemove', (e) => {
    const rect = zombieCanvas.getBoundingClientRect();
    zombieMouseX = (e.clientX - rect.left) * (zombieCanvas.width / rect.width);
    zombieMouseY = (e.clientY - rect.top) * (zombieCanvas.height / rect.height);
});
zombieCanvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        if (autoAimActive()) fireZombieAutoAimedAttack();
        else tryZombieAttack();
    }
});

function zombieWorldFromMouse() {
    return { x: zombieMouseX - zombieCanvas.width / 2, y: zombieMouseY - zombieCanvas.height / 2 };
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

document.addEventListener('keydown', (e) => {
    if (!zombieState || screens.zombieFight.classList.contains('hidden')) return;
    if (e.key === 'b' || e.key === 'B') tryZombieBuild();
});

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
        const speed = moveSpeedFor(stats, now, 0, 0, false, zombieLocal.equipSpeed);
        let dx = 0, dy = 0;
        if (keys['w'] || keys['W']) dy -= speed;
        if (keys['s'] || keys['S']) dy += speed;
        if (keys['a'] || keys['A']) dx -= speed;
        if (keys['d'] || keys['D']) dx += speed;
        if (dx !== 0 || dy !== 0) {
            let nx = zombieLocal.x + dx, ny = zombieLocal.y + dy;
            const dist = Math.hypot(nx, ny);
            if (dist > SHARED.ZOMBIE_ARENA_RADIUS) {
                const scale = SHARED.ZOMBIE_ARENA_RADIUS / dist;
                nx *= scale; ny *= scale;
            }
            zombieLocal.x = nx; zombieLocal.y = ny;
        }
        if (autoAimEnabled) {
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

function zombieDrawSlot(ctx, pos, index, fence, now) {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    if (fence) {
        ctx.beginPath();
        ctx.arc(0, 0, SHARED.ZOMBIE_SLOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#8d6238';
        ctx.fill();
        ctx.strokeStyle = '#5a3d21';
        ctx.lineWidth = 3;
        ctx.stroke();
        const pct = Math.max(0, fence.hp / fence.maxHp);
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(-16, -SHARED.ZOMBIE_SLOT_RADIUS - 10, 32, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(-16, -SHARED.ZOMBIE_SLOT_RADIUS - 10, 32 * pct, 4);
    } else {
        const inRange = zombieLocal && Math.hypot(zombieLocal.x - pos.x, zombieLocal.y - pos.y) <= SHARED.ZOMBIE_BUILD_RANGE;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, SHARED.ZOMBIE_SLOT_RADIUS, 0, Math.PI * 2);
        ctx.strokeStyle = inRange ? 'rgba(241, 196, 15, 0.9)' : 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
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

    const R = SHARED.ZOMBIE_ARENA_RADIUS;
    zombieCtx.beginPath();
    zombieCtx.arc(0, 0, R, 0, Math.PI * 2);
    zombieCtx.fillStyle = '#2a3320';
    zombieCtx.fill();
    zombieCtx.strokeStyle = 'rgba(241, 196, 15, 0.4)';
    zombieCtx.lineWidth = 4;
    zombieCtx.stroke();

    zombieCtx.setLineDash([8, 8]);
    zombieCtx.beginPath();
    zombieCtx.arc(0, 0, SHARED.ZOMBIE_WALL_RING_RADIUS, 0, Math.PI * 2);
    zombieCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    zombieCtx.lineWidth = 2;
    zombieCtx.stroke();
    zombieCtx.setLineDash([]);

    if (!zombieState) { zombieCtx.restore(); return; }

    Object.values(zombieTrees).forEach(t => zombieDrawTree(zombieCtx, t));
    SHARED.ZOMBIE_WALL_SLOT_POSITIONS.forEach((pos, i) => zombieDrawSlot(zombieCtx, pos, i, zombieState.fences[i], now));
    Object.values(zombieState.zombies).forEach(z => zombieDrawMob(zombieCtx, z));
    Object.entries(zombieState.players).forEach(([id, p]) => {
        zombieDrawPlayer(zombieCtx, p, id === socket.id, now);
    });

    zombieCtx.restore();
}
