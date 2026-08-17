// ==================== 대전(Arena) 모드 ====================
// 친구 대결(main.js의 pvp* 블록)과는 완전히 분리된 매치메이킹 기반 모드다.
// 1:1 / 1:1 vs 컴퓨터 / 2:2(사람) vs 컴퓨터 세 편성을 지원하며, 이동/공격/
// 스킬/궁극기 클라이언트 로직은 pvp 블록과 같은 모양이되 "상대 1명"이
// 아니라 팀(A/B)과 봇을 다룬다.
//
// Loaded after main.js/player.js, so it shares those files' globals (socket,
// showScreen, gameData, currentUser, equipPayload, instinctPayload,
// charLevelPayload, clientConsumeAmmo, moveSpeedFor, keys, Player, ...)
// through the page's single global scope.

const arenaModeCard = document.getElementById('arena-mode-card');
const arenaModeSubmenuCard = document.getElementById('arena-mode-submenu-card');
const arenaFriendFightCard = document.getElementById('arena-friend-fight-card');
const backFromArenaCategoryBtn = document.getElementById('back-from-arena-category-btn');
const arenaBackFromLobbyBtn = document.getElementById('back-from-arena-lobby-btn');
const arena1v1Card = document.getElementById('arena-1v1-card');
const arena1v1BotCard = document.getElementById('arena-1v1bot-card');
const arena2v2BotCard = document.getElementById('arena-2v2bot-card');
const arenaQueueStatusEl = document.getElementById('arena-queue-status');
const arenaQueueCancelBtn = document.getElementById('arena-queue-cancel-btn');

// "대전" 카드는 카테고리 화면(대전모드 / 싸우기)으로 들어가는 입구다.
// "싸우기"는 새로 만드는 게 아니라 기존 친구 목록의 "싸우기"(친구 대결
// 도전장) 기능 그대로 -- 친구 화면의 목록 탭으로 바로 보내준다.
arenaModeCard.addEventListener('click', () => showScreen('arenaCategory'));
backFromArenaCategoryBtn.addEventListener('click', () => showScreen('modeSelect'));
arenaModeSubmenuCard.addEventListener('click', () => {
    arenaSetQueueUi(false);
    showScreen('arenaLobby');
});
arenaFriendFightCard.addEventListener('click', () => {
    openFriendsScreen();
    showScreen('friends');
});
arenaBackFromLobbyBtn.addEventListener('click', () => {
    arenaLeaveQueueIfAny();
    showScreen('arenaCategory');
});

function arenaJoinQueue(mode) {
    if (!currentUser) { alert('로그인 후 이용할 수 있습니다.'); return; }
    const charType = gameData.selectedCharacter || 'kicker';
    arenaSetQueueUi(true, mode === '1v1bot' ? '매칭 중...' : '상대를 찾는 중...');
    socket.emit('arenaQueueJoin', {
        mode,
        nickname: currentUser.nickname,
        charType,
        equip: equipPayload(charType),
        instinct: instinctPayload(charType),
        charLevel: charLevelPayload(charType)
    });
}
arena1v1Card.addEventListener('click', () => arenaJoinQueue('1v1'));
arena1v1BotCard.addEventListener('click', () => arenaJoinQueue('1v1bot'));
arena2v2BotCard.addEventListener('click', () => arenaJoinQueue('2v2bot'));

function arenaSetQueueUi(searching, text) {
    arenaQueueStatusEl.textContent = text || '';
    arenaQueueStatusEl.classList.toggle('hidden', !searching);
    arenaQueueCancelBtn.classList.toggle('hidden', !searching);
    [arena1v1Card, arena1v1BotCard, arena2v2BotCard].forEach(c => c.classList.toggle('locked', searching));
}
function arenaLeaveQueueIfAny() {
    socket.emit('arenaQueueLeave');
    arenaSetQueueUi(false);
}
arenaQueueCancelBtn.addEventListener('click', arenaLeaveQueueIfAny);

socket.on('arenaQueueUpdate', ({ count, needed }) => {
    arenaSetQueueUi(true, `상대를 찾는 중... (${count}/${needed})`);
});

// ---- 전투 상태 ----
let arenaPlayers = {}; // id -> Player (team/isBot이 덧붙는다)
let arenaMyTeam = null;
let arenaHalfLen = 550;
let arenaLaneHalfWidth = 220;
let arenaCountdownEndAt = 0;
let arenaFighting = false;
let arenaLoopHandle = null;

function arenaNearestEnemyId() {
    const me = arenaPlayers[socket.id];
    if (!me) return null;
    let bestId = null, bestDist = Infinity;
    for (const [id, p] of Object.entries(arenaPlayers)) {
        if (id === socket.id || !p.alive || p.team === me.team) continue;
        const d = Math.hypot(p.x - me.x, p.y - me.y);
        if (d < bestDist) { bestDist = d; bestId = id; }
    }
    return bestId;
}

socket.on('arenaMatchFound', (data) => {
    arenaPlayers = {};
    arenaHalfLen = data.halfLen || 550;
    arenaLaneHalfWidth = data.laneHalfWidth || 220;
    Object.entries(data.players).forEach(([id, p]) => {
        const pl = new Player(id, p.charType, p.x, p.y, id === socket.id);
        pl.hp = p.hp; pl.maxHp = p.maxHp; pl.facing = p.facing; pl.alive = p.alive; pl.shieldHp = p.shieldHp || 0;
        pl.nickname = p.nickname;
        pl.team = p.team;
        pl.isBot = !!p.isBot;
        if (id === socket.id) {
            const b = equipBonusOf(p.charType);
            pl.equipSpeed = b.speed;
            pl.equipCooldown = b.cooldown;
            arenaMyTeam = p.team;
        }
        arenaPlayers[id] = pl;
    });
    arenaCountdownEndAt = data.startAt;
    arenaFighting = false;
    arenaSetQueueUi(false);
    document.getElementById('arena-result-overlay').classList.add('hidden');
    arenaRenderHud();
    resizeArenaCanvas();
    showScreen('arenaFight');
    startArenaLoop();
});

socket.on('arenaFightStart', () => { arenaFighting = true; });

socket.on('arenaPlayerMoved', ({ id, x, y, facing }) => {
    const p = arenaPlayers[id];
    if (p) { p.x = x; p.y = y; p.facing = facing; }
});

socket.on('arenaPlayerDamaged', ({ id, hp, alive, shieldHp }) => {
    const p = arenaPlayers[id];
    if (!p) return;
    p.hp = hp; p.alive = alive; p.shieldHp = shieldHp || 0;
});

// playerHealed/playerShielded/playerSkillUsed/playerUltimateUsed는 다른
// 모드들과 이름을 공유한다 -- arenaPlayers에 없는 id는 그냥 무시되니 안전하다.
socket.on('playerHealed', ({ id, hp }) => {
    const p = arenaPlayers[id];
    if (p) { p.hp = hp; p.triggerHealEffect(); }
});
socket.on('playerShielded', ({ id, shieldHp }) => {
    const p = arenaPlayers[id];
    if (p) p.shieldHp = shieldHp;
});
socket.on('playerSkillUsed', ({ id }) => {
    const p = arenaPlayers[id];
    if (p && id !== socket.id) p.triggerSkillEffect();
});
socket.on('playerUltimateUsed', ({ id }) => {
    const p = arenaPlayers[id];
    if (p && id !== socket.id) p.triggerUltimateEffect();
});

socket.on('arenaResult', ({ winningTeam }) => {
    arenaFighting = false;
    stopArenaLoop();
    const overlay = document.getElementById('arena-result-overlay');
    const text = document.getElementById('arena-result-text');
    text.textContent = !winningTeam ? '무승부' : (winningTeam === arenaMyTeam ? '승리!' : '패배...');
    overlay.classList.remove('hidden');
});

document.getElementById('arena-back-to-lobby-btn').addEventListener('click', () => {
    stopArenaLoop();
    showScreen('arenaLobby');
});

// ---- 이동 (친구 대결과 같은 다리 모양 직사각형 경계) ----
function arenaUpdateLocal(me, keysDown) {
    if (!me.alive) return false;
    const speed = moveSpeedFor(me.stats, performance.now(), me.speedBoostUntil, me.awakenUntil,
        me.butterflyOn, me.equipSpeed, me.rapidStrikeUntil, false, me.natureBoostUntil,
        me.lastAttackClientTime, me.lastHitClientTime, me.firingUntil);
    let dx = 0, dy = 0;
    if (keysDown['w'] || keysDown['W']) dy -= speed;
    if (keysDown['s'] || keysDown['S']) dy += speed;
    if (keysDown['a'] || keysDown['A']) dx -= speed;
    if (keysDown['d'] || keysDown['D']) dx += speed;
    if (dx === 0 && dy === 0) return false;
    const R = SHARED.PLAYER_RADIUS;
    me.x = Math.max(-arenaHalfLen + R, Math.min(arenaHalfLen - R, me.x + dx));
    me.y = Math.max(-arenaLaneHalfWidth + R, Math.min(arenaLaneHalfWidth - R, me.y + dy));
    return true;
}

const arenaCanvas = document.getElementById('arena-canvas');
const arenaCtx = arenaCanvas.getContext('2d');
function resizeArenaCanvas() {
    arenaCanvas.width = window.innerWidth;
    arenaCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeArenaCanvas);

// 팀별 HP바를 동적으로 만든다 -- 1:1은 한 줄, 2:2는 두 줄.
function arenaRenderHud() {
    const teamAEl = document.getElementById('arena-hud-team-a');
    const teamBEl = document.getElementById('arena-hud-team-b');
    teamAEl.innerHTML = '';
    teamBEl.innerHTML = '';
    Object.values(arenaPlayers).forEach(p => {
        const row = document.createElement('div');
        const nameEl = document.createElement('div');
        nameEl.className = 'pvp-hud-name';
        nameEl.textContent = (p.isBot ? '🤖 ' : '') + (p.nickname || (p.isBot ? '컴퓨터' : '플레이어'));
        const barBg = document.createElement('div');
        barBg.className = 'pvp-hp-bar';
        const fill = document.createElement('div');
        fill.className = 'pvp-hp-fill';
        fill.id = `arena-hp-fill-${p.id}`;
        barBg.appendChild(fill);
        row.appendChild(nameEl);
        row.appendChild(barBg);
        (p.team === 'A' ? teamAEl : teamBEl).appendChild(row);
    });
}
function arenaUpdateHud() {
    Object.values(arenaPlayers).forEach(p => {
        const fill = document.getElementById(`arena-hp-fill-${p.id}`);
        if (fill) fill.style.width = `${Math.max(0, p.hp / p.maxHp * 100)}%`;
    });
}

function arenaRender(now) {
    const w = arenaCanvas.width, h = arenaCanvas.height;
    const me = arenaPlayers[socket.id];
    const camX = me ? me.x : 0;
    arenaCtx.fillStyle = '#14301d';
    arenaCtx.fillRect(0, 0, w, h);
    arenaCtx.save();
    arenaCtx.translate(w / 2 - camX, h / 2);
    // 배경(다리): 스토리모드 10층과 같은 치수/색을 그대로 읽어 쓴다.
    const floorDef = SHARED.floorDefFor(10) || {};
    arenaCtx.fillStyle = floorDef.deckColor || '#4a3c2f';
    arenaCtx.fillRect(-arenaHalfLen, -arenaLaneHalfWidth, arenaHalfLen * 2, arenaLaneHalfWidth * 2);
    arenaCtx.strokeStyle = floorDef.deckGlow || 'rgba(255,255,255,0.15)';
    arenaCtx.lineWidth = 4;
    arenaCtx.strokeRect(-arenaHalfLen, -arenaLaneHalfWidth, arenaHalfLen * 2, arenaLaneHalfWidth * 2);
    Object.values(arenaPlayers).forEach(p => p.draw(arenaCtx, now));
    arenaCtx.restore();

    if (!arenaFighting) {
        const remain = Math.max(0, Math.ceil((arenaCountdownEndAt - Date.now()) / 1000));
        arenaCtx.fillStyle = 'rgba(0,0,0,0.4)';
        arenaCtx.fillRect(0, 0, w, h);
        arenaCtx.fillStyle = '#fff';
        arenaCtx.font = 'bold 64px sans-serif';
        arenaCtx.textAlign = 'center';
        arenaCtx.textBaseline = 'middle';
        arenaCtx.fillText(remain > 0 ? String(remain) : '싸워라!', w / 2, h / 2);
    }
    arenaUpdateHud();
}

function arenaFrame() {
    const me = arenaPlayers[socket.id];
    if (me) {
        const moved = arenaUpdateLocal(me, keys);
        const nearestId = arenaNearestEnemyId();
        const enemy = nearestId ? arenaPlayers[nearestId] : null;
        if (enemy) me.aimAt(enemy.x, enemy.y);
        if (moved) socket.emit('arenaPlayerMove', { x: me.x, y: me.y, facing: me.facing });
    }
    arenaRender(performance.now());
    arenaLoopHandle = requestAnimationFrame(arenaFrame);
}
function startArenaLoop() {
    stopArenaLoop();
    arenaLoopHandle = requestAnimationFrame(arenaFrame);
}
function stopArenaLoop() {
    if (arenaLoopHandle) cancelAnimationFrame(arenaLoopHandle);
    arenaLoopHandle = null;
}

// 화면 전체가 캔버스라 별도 버튼 없이 다른 전투 화면과 같은 조작으로 쓴다:
// 좌클릭 공격, 우클릭 스킬, F 궁극기. 상대 타깃은 항상 가장 가까운
// 적(arenaNearestEnemyId)이라 따로 조준할 필요가 없다.
function arenaTryAttack() {
    const me = arenaPlayers[socket.id];
    if (!me || !arenaFighting || !me.canAttack(performance.now())) return;
    if (!clientConsumeAmmo(me.stats, me, performance.now())) return;
    me.triggerAttackEffect();
    socket.emit('arenaPlayerAttack');
}
function arenaTrySkill() {
    const me = arenaPlayers[socket.id];
    if (!me || !arenaFighting || !me.canUseSkill(performance.now())) return;
    me.triggerSkillEffect();
    const enemy = arenaPlayers[arenaNearestEnemyId()];
    socket.emit('arenaPlayerSkill', enemy ? { targetX: enemy.x, targetY: enemy.y } : {});
}
function arenaTryUltimate() {
    const me = arenaPlayers[socket.id];
    if (!me || !arenaFighting || !me.canUseUltimate(performance.now())) return;
    me.triggerUltimateEffect();
    const enemy = arenaPlayers[arenaNearestEnemyId()];
    socket.emit('arenaPlayerUltimate', enemy ? { targetX: enemy.x, targetY: enemy.y } : {});
}

arenaCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
arenaCanvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) arenaTryAttack();
    else if (e.button === 2) arenaTrySkill();
});
window.addEventListener('keydown', (e) => {
    if (e.key !== 'f' && e.key !== 'F') return;
    if (screens.arenaFight.classList.contains('hidden')) return;
    arenaTryUltimate();
});
