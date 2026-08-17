// ==================== 대전모드(Arena): 기지전 ====================
// 친구 대결(main.js의 pvp* 블록)과는 완전히 무관한 1:1 실시간 매치메이킹
// 모드다. 캐릭터 5명을 광산(1~2)/전방(1~3)/원거리(1~2)로 나눠 배치하고,
// 상대 기지 체력을 0으로 만들면 이긴다. "팀당 1기체" 였던 지난 버전은
// 전부 갈아엎고 이 파일을 새로 썼다.
//
// Loaded after main.js/player.js, so it shares those files' globals (socket,
// showScreen, screens, gameData, currentUser, equipPayload, instinctPayload,
// charLevelPayload, clientConsumeAmmo, equipBonusOf, moveSpeedFor,
// charIconBackground, openCharacterSelect, openFriendsScreen, keys, Player,
// SHARED, ...) through the page's single global scope.

// ---- 카테고리 화면(대전모드 / 싸우기) ----
const arenaModeCard = document.getElementById('arena-mode-card');
const arenaModeSubmenuCard = document.getElementById('arena-mode-submenu-card');
const arenaFriendFightCard = document.getElementById('arena-friend-fight-card');
const backFromArenaCategoryBtn = document.getElementById('back-from-arena-category-btn');
const arenaBackFromLobbyBtn = document.getElementById('back-from-arena-lobby-btn');
const arenaQueueStatusEl = document.getElementById('arena-queue-status');
const arenaQueueCancelBtn = document.getElementById('arena-queue-cancel-btn');

// "대전" 카드는 카테고리 화면(대전모드 / 싸우기)으로 들어가는 입구다.
// "싸우기"는 새로 만드는 게 아니라 기존 친구 목록의 "싸우기"(친구 대결
// 도전장) 기능 그대로 -- 친구 화면의 목록 탭으로 바로 보내준다.
arenaModeCard.addEventListener('click', () => showScreen('arenaCategory'));
backFromArenaCategoryBtn.addEventListener('click', () => showScreen('modeSelect'));
arenaModeSubmenuCard.addEventListener('click', () => {
    arenaSetQueueUi(false);
    renderArenaLineup();
    showScreen('arenaLineup');
});
arenaFriendFightCard.addEventListener('click', () => {
    openFriendsScreen();
    showScreen('friends');
});
arenaBackFromLobbyBtn.addEventListener('click', () => {
    arenaLeaveQueueIfAny();
    showScreen('arenaCategory');
});

function arenaSetQueueUi(searching, text) {
    arenaQueueStatusEl.textContent = text || '';
    arenaQueueStatusEl.classList.toggle('hidden', !searching);
    arenaQueueCancelBtn.classList.toggle('hidden', !searching);
    arenaLineupModeButtons.forEach(btn => btn.classList.toggle('hidden', searching));
}
function arenaLeaveQueueIfAny() {
    socket.emit('arenaQueueLeave');
    arenaSetQueueUi(false);
}
arenaQueueCancelBtn.addEventListener('click', arenaLeaveQueueIfAny);

socket.on('arenaQueueUpdate', ({ count, needed }) => {
    arenaSetQueueUi(true, `상대를 찾는 중... (${count}/${needed})`);
});

// ==================== 배치 화면 (5명 → 광산/전방/원거리) ====================
let arenaLineup = new Array(SHARED.ARENA_LINEUP_SIZE).fill(null); // {charType, role} | null

const arenaLineupSlotsEl = document.getElementById('arena-lineup-slots');
const arenaLineupCountsEl = document.getElementById('arena-lineup-counts');
const arenaLineup1v1Btn = document.getElementById('arena-lineup-1v1-btn');
const arenaLineup1v1BotBtn = document.getElementById('arena-lineup-1v1bot-btn');
const arenaLineup2v2BotBtn = document.getElementById('arena-lineup-2v2bot-btn');
const arenaLineupModeButtons = [arenaLineup1v1Btn, arenaLineup1v1BotBtn, arenaLineup2v2BotBtn];

function arenaLineupUnits() { return arenaLineup.filter(Boolean); }
function arenaLineupCounts() {
    const c = { mine: 0, front: 0, ranged: 0 };
    arenaLineupUnits().forEach(u => c[u.role]++);
    return c;
}
function arenaLineupReady() {
    return arenaLineup.every(Boolean) && SHARED.arenaLineupValid(arenaLineupUnits());
}

// 이미 다른 슬롯에 있는 캐릭터를 고르면(guest 파티와 같은 방식) 두 슬롯을
// 맞바꾼다 -- 같은 캐릭터를 두 번 데려갈 수 없다.
function setArenaLineupSlot(index, charType) {
    const at = arenaLineup.findIndex(u => u && u.charType === charType);
    if (at >= 0 && at !== index) {
        const tmp = arenaLineup[index];
        arenaLineup[index] = arenaLineup[at];
        arenaLineup[at] = tmp;
    }
    const prevRole = (arenaLineup[index] && arenaLineup[index].role) || 'front';
    arenaLineup[index] = { charType, role: prevRole };
    renderArenaLineup();
}
function openArenaLineupSlotPicker(index) {
    openCharacterSelect('arenaLineup', {
        selectedId: arenaLineup[index] ? arenaLineup[index].charType : null,
        onPick: (id) => setArenaLineupSlot(index, id)
    });
}
function setArenaLineupRole(index, role) {
    if (!arenaLineup[index]) return;
    arenaLineup[index].role = role;
    renderArenaLineup();
}

const ARENA_ROLE_LABEL = { mine: '광산', front: '전방', ranged: '원거리' };

function renderArenaLineup() {
    arenaLineupSlotsEl.innerHTML = '';
    for (let i = 0; i < SHARED.ARENA_LINEUP_SIZE; i++) {
        const entry = arenaLineup[i];
        const stats = entry ? SHARED.CHARACTERS[entry.charType] : null;
        const slot = document.createElement('div');
        slot.className = 'guest-party-slot' + (stats ? ' filled' : '');
        const circle = stats
            ? `<div class="slot-circle" style="background:${charIconBackground(stats)}"></div>`
            : '<div class="slot-circle">+</div>';
        slot.innerHTML = circle + `<div class="slot-name">${stats ? (stats.shortName || stats.name) : '비어있음'}</div>`;
        slot.addEventListener('click', () => openArenaLineupSlotPicker(i));
        if (stats) {
            const clear = document.createElement('button');
            clear.className = 'slot-clear';
            clear.textContent = '×';
            clear.addEventListener('click', (e) => { e.stopPropagation(); arenaLineup[i] = null; renderArenaLineup(); });
            slot.appendChild(clear);

            const roleRow = document.createElement('div');
            roleRow.className = 'arena-role-row';
            SHARED.ARENA_UNIT_ROLES.forEach(role => {
                const btn = document.createElement('button');
                btn.className = 'arena-role-btn' + (entry.role === role ? ' selected' : '');
                btn.textContent = ARENA_ROLE_LABEL[role];
                btn.addEventListener('click', (e) => { e.stopPropagation(); setArenaLineupRole(i, role); });
                roleRow.appendChild(btn);
            });
            slot.appendChild(roleRow);
        }
        arenaLineupSlotsEl.appendChild(slot);
    }
    const counts = arenaLineupCounts();
    arenaLineupCountsEl.textContent =
        `광산 ${counts.mine}/${SHARED.ARENA_ROLE_MIN.mine}~${SHARED.ARENA_ROLE_MAX.mine} · `
        + `전방 ${counts.front}/${SHARED.ARENA_ROLE_MIN.front}~${SHARED.ARENA_ROLE_MAX.front} · `
        + `원거리 ${counts.ranged}/${SHARED.ARENA_ROLE_MIN.ranged}~${SHARED.ARENA_ROLE_MAX.ranged}`;
    arenaLineupModeButtons.forEach(btn => { btn.disabled = !arenaLineupReady(); });
}

function arenaJoinQueue(mode) {
    if (!currentUser) { alert('로그인 후 이용할 수 있습니다.'); return; }
    if (!arenaLineupReady()) return;
    arenaSetQueueUi(true, mode === '1v1bot' ? '매칭 중...' : '상대를 찾는 중...');
    socket.emit('arenaQueueJoin', {
        mode,
        nickname: currentUser.nickname,
        units: arenaLineup.map(u => ({
            charType: u.charType, role: u.role,
            equip: equipPayload(u.charType), instinct: instinctPayload(u.charType), charLevel: charLevelPayload(u.charType)
        }))
    });
}
arenaLineup1v1Btn.addEventListener('click', () => arenaJoinQueue('1v1'));
arenaLineup1v1BotBtn.addEventListener('click', () => arenaJoinQueue('1v1bot'));
arenaLineup2v2BotBtn.addEventListener('click', () => arenaJoinQueue('2v2bot'));

// ==================== 전투 화면 ====================
// side(A/B)가 실제 전투 단위다 -- 2:2에서는 사람 둘이 같은 side에 유닛을
// 5개씩(총 10개) 넣고 기지·광석을 같이 쓴다. arenaMySide()로 "내가 어느
// side인지"를 알아내고(members로 확정), 유닛 조작은 내가 직접 낸(내
// socket.id로 시작하는 id) 유닛만 가능하다 -- 팀원 유닛은 로스터에 안 보임.
let arenaPlayerObjs = {}; // unitId -> Player (렌더/이펙트 전용; 광산인 유닛은 없음)
let arenaState = null;    // { sides: {A:{ore,base,units,isBot}, B:{...}}, halfLen, laneHalfWidth }
let arenaMyId = null;
let arenaMembers = { A: [], B: [] }; // 이 매치의 side별 소켓id 목록(고정, 매치 시작 때 한 번 옴)
let arenaControlledUnitId = null; // 지금 내가 직접조종 중인 유닛 id (서버 sync로 매번 다시 확정)
let arenaSelectedUnitId = null;   // 유닛 메뉴가 열려 있는 대상
let arenaGroupMode = false;       // 공격가기용 그룹을 고르는 중인지
let arenaGroupIds = new Set();
let arenaMouseWorld = null;
let arenaCountdownEndAt = 0;
let arenaFighting = false;
let arenaLoopHandle = null;

function arenaMySide() { return arenaMembers.A.includes(arenaMyId) ? 'A' : 'B'; }
function arenaMySideData() { return arenaState && arenaState.sides[arenaMySide()]; }
function arenaEnemySideData() { return arenaState && arenaState.sides[arenaMySide() === 'A' ? 'B' : 'A']; }
function arenaOwnsUnit(unitId) { return unitId.startsWith(arenaMyId + '_'); }
// 로스터/조작은 내가 직접 낸 유닛만 -- 2:2 팀원이 낸 유닛은 여기 안 잡힌다.
function arenaMyUnits() { const s = arenaMySideData(); return s ? s.units.filter(u => arenaOwnsUnit(u.id)) : []; }
function arenaControlledPlayerObj() { return arenaControlledUnitId ? arenaPlayerObjs[arenaControlledUnitId] : null; }

function arenaApplyUnitToPlayerObj(pl, u) {
    pl.x = u.x; pl.y = u.y; pl.facing = u.facing;
    pl.hp = u.hp; pl.maxHp = u.maxHp; pl.alive = u.alive; pl.shieldHp = u.shieldHp || 0;
}

// 유닛 역할이 게임 중 바뀔 수 있어(광산<->전투) Player 렌더 객체를 그때
// 그때 만들거나 지운다 -- 광산으로 바뀌면 좌표가 없어 그릴 게 없으므로
// 지우고, 전투 역할로 막 바뀐 유닛은 처음 보는 것이니 새로 만든다.
function arenaSyncPlayerObjs(sides) {
    ['A', 'B'].forEach(side => {
        sides[side].units.forEach(u => {
            if (u.role === 'mine') { delete arenaPlayerObjs[u.id]; return; }
            let pl = arenaPlayerObjs[u.id];
            if (!pl) {
                pl = new Player(u.id, u.charType, u.x, u.y, side === arenaMySide());
                if (arenaOwnsUnit(u.id)) {
                    const b = equipBonusOf(u.charType);
                    pl.equipSpeed = b.speed;
                    pl.equipCooldown = b.cooldown;
                }
                arenaPlayerObjs[u.id] = pl;
            }
            arenaApplyUnitToPlayerObj(pl, u);
        });
    });
}

socket.on('arenaMatchFound', (data) => {
    arenaMyId = socket.id;
    arenaMembers = data.members;
    arenaState = { sides: data.sides, halfLen: data.halfLen, laneHalfWidth: data.laneHalfWidth };
    arenaPlayerObjs = {};
    arenaSyncPlayerObjs(data.sides);
    arenaControlledUnitId = null;
    arenaSelectedUnitId = null;
    arenaGroupMode = false;
    arenaGroupIds = new Set();
    arenaCountdownEndAt = data.startAt;
    arenaFighting = false;
    arenaSetQueueUi(false);
    document.getElementById('arena-result-overlay').classList.add('hidden');
    document.getElementById('arena-unit-menu').classList.add('hidden');
    document.getElementById('arena-attackmove-bar').classList.add('hidden');
    resizeArenaCanvas();
    arenaUpdateRoster();
    showScreen('arenaFight');
    startArenaLoop();
});

socket.on('arenaFightStart', () => { arenaFighting = true; });

// 대부분의 유닛이 서버 AI로 움직이므로, 매 틱 서버가 보내주는 전체 상태를
// 그대로 반영한다(개별 이동 이벤트를 따로 두지 않음).
socket.on('arenaStateSync', ({ sides }) => {
    if (!arenaState) return;
    arenaState.sides = sides;
    arenaSyncPlayerObjs(sides);
    const myUnits = arenaMyUnits();
    const ctrl = myUnits.find(u => u.order === 'controlled');
    arenaControlledUnitId = ctrl ? ctrl.id : null;
    Array.from(arenaGroupIds).forEach(id => {
        if (!myUnits.some(u => u.id === id && u.alive)) arenaGroupIds.delete(id);
    });
    arenaUpdateRoster();
});

socket.on('arenaUnitDamaged', ({ id, hp, alive, shieldHp }) => {
    const pl = arenaPlayerObjs[id];
    if (pl) { pl.hp = hp; pl.alive = alive; pl.shieldHp = shieldHp || 0; }
});
socket.on('arenaBaseDamaged', ({ team, hp }) => {
    if (!arenaState || !arenaState.sides[team]) return;
    arenaState.sides[team].base.hp = hp;
});
socket.on('arenaUnitRevived', ({ id, hp, ore, side }) => {
    const pl = arenaPlayerObjs[id];
    if (pl) { pl.hp = hp; pl.alive = true; }
    if (arenaState && arenaState.sides[side]) arenaState.sides[side].ore = ore;
});
// playerHealed/playerShielded/playerSkillUsed/playerUltimateUsed는 다른
// 모드들과 이름을 공유한다 -- arenaPlayerObjs에 없는 id는 그냥 무시되니
// 안전하다. 직접조종 중인 내 유닛은 입력 시점에 이미 로컬로 이펙트를
// 틀어놨으니 서버 echo로 다시 트는 건 건너뛴다.
socket.on('playerHealed', ({ id, hp }) => {
    const pl = arenaPlayerObjs[id];
    if (pl) { pl.hp = hp; pl.triggerHealEffect(); }
});
socket.on('playerShielded', ({ id, shieldHp }) => {
    const pl = arenaPlayerObjs[id];
    if (pl) pl.shieldHp = shieldHp;
});
socket.on('playerSkillUsed', ({ id }) => {
    const pl = arenaPlayerObjs[id];
    if (pl && id !== arenaControlledUnitId) pl.triggerSkillEffect();
});
socket.on('playerUltimateUsed', ({ id }) => {
    const pl = arenaPlayerObjs[id];
    if (pl && id !== arenaControlledUnitId) pl.triggerUltimateEffect();
});

socket.on('arenaResult', ({ winningTeam }) => {
    arenaFighting = false;
    stopArenaLoop();
    const overlay = document.getElementById('arena-result-overlay');
    const text = document.getElementById('arena-result-text');
    text.textContent = !winningTeam ? '무승부' : (winningTeam === arenaMySide() ? '승리!' : '패배...');
    overlay.classList.remove('hidden');
});

document.getElementById('arena-back-to-lobby-btn').addEventListener('click', () => {
    stopArenaLoop();
    showScreen('arenaLineup');
});

// ---- 카메라: 다리 전체(양쪽 기지 포함)가 한 화면에 들어오는 고정 시점.
// 직접조종+공격가기+자동방어가 동시에 벌어져서 캐릭터를 따라다니는
// 카메라 대신, 세계 좌표를 화면에 맞는 배율로 그대로 그린다. ----
const arenaCanvas = document.getElementById('arena-canvas');
const arenaCtx = arenaCanvas.getContext('2d');
let arenaScale = 1, arenaOffsetX = 0, arenaOffsetY = 0;

function arenaComputeCamera() {
    if (!arenaState) return;
    const worldW = arenaState.halfLen * 2 + 160;
    const worldH = arenaState.laneHalfWidth * 2 + 160;
    arenaScale = Math.min(arenaCanvas.width / worldW, arenaCanvas.height / worldH);
    arenaOffsetX = arenaCanvas.width / 2;
    arenaOffsetY = arenaCanvas.height / 2;
}
function resizeArenaCanvas() {
    arenaCanvas.width = window.innerWidth;
    arenaCanvas.height = window.innerHeight;
    arenaComputeCamera();
}
window.addEventListener('resize', resizeArenaCanvas);

function arenaScreenToWorld(sx, sy) {
    return { x: (sx - arenaOffsetX) / arenaScale, y: (sy - arenaOffsetY) / arenaScale };
}
function arenaBasePosOf(team) {
    return { x: team === 'A' ? -arenaState.halfLen + 40 : arenaState.halfLen - 40, y: 0 };
}

arenaCanvas.addEventListener('mousemove', (e) => {
    const rect = arenaCanvas.getBoundingClientRect();
    const scaleX = arenaCanvas.width / rect.width;
    const scaleY = arenaCanvas.height / rect.height;
    arenaMouseWorld = arenaScreenToWorld((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
});

function arenaUpdateHud() {
    const me = arenaMySideData();
    const enemy = arenaEnemySideData();
    if (!me || !enemy) return;
    document.getElementById('arena-my-base-fill').style.width = `${Math.max(0, me.base.hp / me.base.maxHp * 100)}%`;
    document.getElementById('arena-my-ore').textContent = me.ore;
    document.getElementById('arena-enemy-base-fill').style.width = `${Math.max(0, enemy.base.hp / enemy.base.maxHp * 100)}%`;
}

function arenaRender(now) {
    const w = arenaCanvas.width, h = arenaCanvas.height;
    arenaCtx.fillStyle = '#14301d';
    arenaCtx.fillRect(0, 0, w, h);
    if (!arenaState) return;
    const mySide = arenaMySide();
    arenaCtx.save();
    arenaCtx.translate(arenaOffsetX, arenaOffsetY);
    arenaCtx.scale(arenaScale, arenaScale);

    const floorDef = SHARED.floorDefFor(10) || {};
    arenaCtx.fillStyle = floorDef.deckColor || '#4a3c2f';
    arenaCtx.fillRect(-arenaState.halfLen, -arenaState.laneHalfWidth, arenaState.halfLen * 2, arenaState.laneHalfWidth * 2);
    arenaCtx.strokeStyle = floorDef.deckGlow || 'rgba(255,255,255,0.15)';
    arenaCtx.lineWidth = 4;
    arenaCtx.strokeRect(-arenaState.halfLen, -arenaState.laneHalfWidth, arenaState.halfLen * 2, arenaState.laneHalfWidth * 2);

    ['A', 'B'].forEach(side => {
        const pos = arenaBasePosOf(side);
        const mine = side === mySide;
        arenaCtx.beginPath();
        arenaCtx.arc(pos.x, pos.y, SHARED.ARENA_BASE_RADIUS, 0, Math.PI * 2);
        arenaCtx.fillStyle = mine ? 'rgba(241,196,15,0.3)' : 'rgba(231,76,60,0.3)';
        arenaCtx.fill();
        arenaCtx.lineWidth = 3;
        arenaCtx.strokeStyle = mine ? '#f1c40f' : '#e74c3c';
        arenaCtx.stroke();
    });

    Object.values(arenaPlayerObjs).forEach(pl => pl.draw(arenaCtx, now));
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

// ---- 직접조종 유닛 이동/조준 (다른 전투 화면과 같은 다리 모양 경계) ----
function arenaUpdateControlledLocal(pl, keysDown) {
    if (!pl.alive) return false;
    const speed = moveSpeedFor(pl.stats, performance.now(), pl.speedBoostUntil, pl.awakenUntil,
        pl.butterflyOn, pl.equipSpeed, pl.rapidStrikeUntil, false, pl.natureBoostUntil,
        pl.lastAttackClientTime, pl.lastHitClientTime, pl.firingUntil);
    let dx = 0, dy = 0;
    if (keysDown['w'] || keysDown['W']) dy -= speed;
    if (keysDown['s'] || keysDown['S']) dy += speed;
    if (keysDown['a'] || keysDown['A']) dx -= speed;
    if (keysDown['d'] || keysDown['D']) dx += speed;
    if (dx === 0 && dy === 0) return false;
    const R = SHARED.PLAYER_RADIUS;
    pl.x = Math.max(-arenaState.halfLen + R, Math.min(arenaState.halfLen - R, pl.x + dx));
    pl.y = Math.max(-arenaState.laneHalfWidth + R, Math.min(arenaState.laneHalfWidth - R, pl.y + dy));
    return true;
}

function arenaFrame() {
    const controlled = arenaControlledPlayerObj();
    if (controlled && arenaFighting) {
        const moved = arenaUpdateControlledLocal(controlled, keys);
        if (arenaMouseWorld) controlled.aimAt(arenaMouseWorld.x, arenaMouseWorld.y);
        if (moved) socket.emit('arenaUnitMove', { unitId: arenaControlledUnitId, x: controlled.x, y: controlled.y, facing: controlled.facing });
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

function arenaTryControlledAttack() {
    const pl = arenaControlledPlayerObj();
    if (!pl || !arenaFighting || !pl.canAttack(performance.now())) return;
    if (!clientConsumeAmmo(pl.stats, pl, performance.now())) return;
    pl.triggerAttackEffect();
    socket.emit('arenaUnitAttack', { unitId: arenaControlledUnitId });
}
function arenaTryControlledSkill() {
    const pl = arenaControlledPlayerObj();
    if (!pl || !arenaFighting || !pl.canUseSkill(performance.now())) return;
    pl.triggerSkillEffect();
    const t = arenaMouseWorld || { x: pl.x, y: pl.y };
    socket.emit('arenaUnitSkill', { unitId: arenaControlledUnitId, targetX: t.x, targetY: t.y });
}
function arenaTryControlledUltimate() {
    const pl = arenaControlledPlayerObj();
    if (!pl || !arenaFighting || !pl.canUseUltimate(performance.now())) return;
    pl.triggerUltimateEffect();
    const t = arenaMouseWorld || { x: pl.x, y: pl.y };
    socket.emit('arenaUnitUltimate', { unitId: arenaControlledUnitId, targetX: t.x, targetY: t.y });
}

// 직접조종 중인 유닛이 없을 때 좌클릭으로 내 유닛을 화면(캔버스)에서
// 직접 찍어도 로스터에서 누른 것과 같은 메뉴가 뜬다 -- "캐릭터를 눌러서
// 공격 같은 걸 하게" 해달라는 요청. 직접조종 중일 땐 좌클릭은 그대로
// 공격이라 겹치지 않게, 조종 중이 아닐 때만 선택용으로 쓴다.
function arenaFindMyUnitAt(wx, wy) {
    return arenaMyUnits().find(u => u.alive && u.role !== 'mine' && Math.hypot(u.x - wx, u.y - wy) <= SHARED.PLAYER_RADIUS + 6);
}

arenaCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
arenaCanvas.addEventListener('mousedown', (e) => {
    if (arenaControlledUnitId) {
        if (e.button === 0) arenaTryControlledAttack();
        else if (e.button === 2) arenaTryControlledSkill();
        return;
    }
    if (e.button !== 0 || !arenaMouseWorld || !arenaFighting) return;
    const hit = arenaFindMyUnitAt(arenaMouseWorld.x, arenaMouseWorld.y);
    if (hit) arenaOnRosterTileClick(hit);
});
window.addEventListener('keydown', (e) => {
    if (e.key !== 'f' && e.key !== 'F') return;
    if (screens.arenaFight.classList.contains('hidden')) return;
    arenaTryControlledUltimate();
});

// ==================== 로스터 패널 (내 유닛 5명) ====================
function arenaUnitStatusLabel(u) {
    if (!u.alive) return '사망';
    if (u.role === 'mine') return '채굴중';
    if (u.order === 'controlled') return '조종중';
    if (u.order === 'attackMove') return '진군중';
    return '지키는중';
}

function arenaUpdateRoster() {
    const panel = document.getElementById('arena-roster-panel');
    if (!arenaState) { panel.innerHTML = ''; return; }
    panel.innerHTML = '';
    arenaMyUnits().forEach(u => {
        const stats = SHARED.CHARACTERS[u.charType];
        const tile = document.createElement('div');
        tile.className = 'arena-roster-tile'
            + (!u.alive ? ' dead' : '')
            + (u.order === 'controlled' ? ' controlled' : '')
            + (u.order === 'attackMove' ? ' attack-move' : '')
            + (arenaGroupIds.has(u.id) ? ' selected-for-group' : '');
        const hpPct = u.role === 'mine' ? 100 : Math.max(0, u.hp / u.maxHp * 100);
        tile.innerHTML = `
            <div class="slot-circle" style="background:${u.alive ? charIconBackground(stats) : '#333'}"></div>
            <div class="slot-name">${stats.shortName || stats.name}</div>
            <div class="arena-tile-hp"><div class="arena-tile-hp-fill" style="width:${hpPct}%"></div></div>
            <div class="slot-name">${arenaUnitStatusLabel(u)}</div>`;
        tile.addEventListener('click', () => arenaOnRosterTileClick(u));
        panel.appendChild(tile);
    });
}

function arenaTryRevive(unitId) {
    const side = arenaMySideData();
    const u = side && side.units.find(x => x.id === unitId);
    if (!u) return;
    const cost = SHARED.ARENA_REVIVE_COST[SHARED.CHARACTERS[u.charType].grade] || SHARED.ARENA_REVIVE_COST['일반'];
    if (side.ore < cost) return; // 서버가 다시 검사하니 조용히 무시해도 안전
    socket.emit('arenaReviveUnit', { unitId });
}

// 살아있는 내 유닛이면(광산/전방/원거리 무엇이든) 클릭 시 메뉴를 연다 --
// 역할을 게임 중에 바꿀 수 있어서 더는 "전방만 상호작용"으로 막지 않는다.
function arenaOnRosterTileClick(u) {
    if (!u.alive) { arenaTryRevive(u.id); return; }
    if (arenaGroupMode) {
        if (u.role !== 'front') return; // 공격가기 그룹은 전방 유닛만
        if (arenaGroupIds.has(u.id)) arenaGroupIds.delete(u.id);
        else arenaGroupIds.add(u.id);
        arenaUpdateRoster();
        return;
    }
    arenaOpenUnitMenu(u);
}

function arenaOpenUnitMenu(u) {
    arenaSelectedUnitId = u.id;
    const rolesEl = document.getElementById('arena-unit-menu-roles');
    rolesEl.innerHTML = '';
    SHARED.ARENA_UNIT_ROLES.forEach(role => {
        const btn = document.createElement('button');
        btn.className = 'arena-role-btn' + (u.role === role ? ' selected' : '');
        btn.textContent = ARENA_ROLE_LABEL[role];
        btn.addEventListener('click', () => {
            socket.emit('arenaSetUnitRole', { unitId: u.id, role });
            document.getElementById('arena-unit-menu').classList.add('hidden');
            arenaSelectedUnitId = null;
        });
        rolesEl.appendChild(btn);
    });
    document.getElementById('arena-unit-attackmove-btn').classList.toggle('hidden', u.role !== 'front');
    document.getElementById('arena-unit-menu').classList.remove('hidden');
}

document.getElementById('arena-unit-control-btn').addEventListener('click', () => {
    if (!arenaSelectedUnitId) return;
    socket.emit('arenaSetUnitOrder', { unitId: arenaSelectedUnitId, order: 'controlled' });
    arenaControlledUnitId = arenaSelectedUnitId; // 낙관적 반영, 다음 sync로 다시 확정됨
    document.getElementById('arena-unit-menu').classList.add('hidden');
    arenaSelectedUnitId = null;
});
document.getElementById('arena-unit-attackmove-btn').addEventListener('click', () => {
    if (!arenaSelectedUnitId) return;
    arenaGroupMode = true;
    arenaGroupIds = new Set([arenaSelectedUnitId]);
    document.getElementById('arena-unit-menu').classList.add('hidden');
    document.getElementById('arena-attackmove-bar').classList.remove('hidden');
    arenaSelectedUnitId = null;
    arenaUpdateRoster();
});
document.getElementById('arena-unit-menu-close-btn').addEventListener('click', () => {
    document.getElementById('arena-unit-menu').classList.add('hidden');
    arenaSelectedUnitId = null;
});
document.getElementById('arena-attackmove-confirm-btn').addEventListener('click', () => {
    socket.emit('arenaAttackMove', { unitIds: Array.from(arenaGroupIds) });
    arenaGroupMode = false;
    arenaGroupIds.clear();
    document.getElementById('arena-attackmove-bar').classList.add('hidden');
    arenaUpdateRoster();
});
document.getElementById('arena-attackmove-cancel-btn').addEventListener('click', () => {
    arenaGroupMode = false;
    arenaGroupIds.clear();
    document.getElementById('arena-attackmove-bar').classList.add('hidden');
    arenaUpdateRoster();
});
