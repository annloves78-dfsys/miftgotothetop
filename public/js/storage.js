const STORAGE_KEY = 'boss_raid_save';

// Currency/material holdings. Kept as one bag so a new kind is a single entry
// here plus a label in CURRENCY_LABELS (main.js) -- see also admin mode, which
// reports every one of these as unlimited.
const defaultCurrencies = {
    coins: 0,
    diamonds: 0,
    ticketNormal: 0,  // 일반 뽑기 티켓. 스토리를 깔 때마다 하나씩 들어온다
    material: 0,      // 일반 장비강화 재료
    materialRare: 0,  // 고급 장비강화 재료
    potion: 0,        // 강화포션
    potionRare: 0,    // 고급 강화포션
    // 레전더리 뽑기 티켓. One per featured cookie, earned by clearing that
    // element's 레전더리 이벤트 stages; they are NOT interchangeable.
    // 악마 뽑기 티켓. 게스트 레이드에서만 나온다.
    ticketDemon: 0,
    ticketWaterdrop: 0,
    ticketMagma: 0,
    ticketLightning: 0
};

const defaultData = {
    clearedBosses: [],
    bestClearTimeMs: {},
    selectedCharacter: 'kicker',
    // 처음에는 자두맛 하나뿐이다. 나머지는 뽑기로 얻거나 영혼석을 모아야 한다.
    unlockedCharacters: ['kicker'],
    clearedStoryFloors: [],
    soulStones: {}, // charType -> count; SOUL_STONES_PER_CHARACTER of one unlocks it
    currencies: { ...defaultCurrencies },
    // 이벤트: the stage ids already cleared, plus 'both' once the 전체 클리어
    // bonus has been taken.
    eventCleared: [],
    eventClaimed: [],
    // 장비. 가방은 계정 공용이고 장착은 쿠키별이다.
    inventory: [], // [{ uid, itemId, level }] -- 같은 장비 여러 개는 항목 여러 개
    equipped: {}, // charType -> { weapon: uid, helmet: uid, ... }
    nextEquipUid: 1, // 가방 항목을 구분하는 번호
    // 아이템창. 재화와 달리 "쓰는" 것들 (랜덤 각성 장비, 각성 장비 조각 등).
    // key -> 개수. 표는 shared.js의 ITEMS에 있다.
    items: {},
    admin: false, // 관리자 전용; see admin_gate.js
    // 관리자 전용의 힘 중 "꺼 둔" 것들. 여기 없는 것은 켜진 것으로 본다.
    adminOff: {}
};

// `{ ...defaultData }` is a shallow copy, so the nested objects/arrays would be
// shared with defaultData itself -- mutating gameData.soulStones would then
// quietly pollute the defaults for any later load in the same session.
function freshDefaults() {
    return JSON.parse(JSON.stringify(defaultData));
}

function loadGameData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            const data = { ...freshDefaults(), ...parsed };
            // 이제 잠금 해제가 진짜로 있는 시스템이다. 예전처럼 모든 쿠키를
            // 집어넣지 않고, 기본 쿠키인 자두맛만 보장한다.
            if (!Array.isArray(data.unlockedCharacters)) data.unlockedCharacters = [];
            if (!data.unlockedCharacters.includes('kicker')) data.unlockedCharacters.push('kicker');
            // Same story for currencies: a save from before a currency existed
            // would otherwise leave it undefined rather than 0.
            data.currencies = { ...defaultCurrencies, ...(data.currencies || {}) };
            // Saves from when there was one shared 시즌 뽑기 티켓: those were all
            // earned before 화염맛 existed, so they become 물방울맛 tickets.
            if (data.currencies.seasonTicket) {
                data.currencies.ticketWaterdrop += data.currencies.seasonTicket;
                delete data.currencies.seasonTicket;
            }
            // 불 갈래의 티켓은 화염맛 자리에 마그마맛이 들어오면서 이름만 바뀜다.
            if (data.currencies.ticketFlame) {
                data.currencies.ticketMagma += data.currencies.ticketFlame;
            }
            delete data.currencies.ticketFlame;
            data.eventCleared = data.eventCleared || [];
            data.eventClaimed = data.eventClaimed || [];
            // 장비가 없던 시절의 세이브: 빈 가방으로 시작한다.
            data.inventory = Array.isArray(data.inventory) ? data.inventory : [];
            // 아이템창이 없던 시절의 세이브: 빈 아이템창으로 시작한다.
            data.items = (data.items && typeof data.items === 'object') ? data.items : {};
            data.adminOff = (data.adminOff && typeof data.adminOff === 'object') ? data.adminOff : {};
            data.equipped = data.equipped || {};
            // uid는 가방에 이미 있는 번호보다 반드시 커야 한다 -- 안 그러면
            // 새 장비가 기존 장비와 같은 번호를 받아 섞인다.
            const maxUid = data.inventory.reduce((m, it) => Math.max(m, it.uid || 0), 0);
            data.nextEquipUid = Math.max(data.nextEquipUid || 1, maxUid + 1);
            return data;
        }
    } catch (e) {
        console.error("Failed to load save data", e);
    }
    return freshDefaults();
}

let cloudSyncHandler = null;
function setCloudSyncHandler(fn) {
    cloudSyncHandler = fn;
}

function saveGameData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error("Failed to save game data", e);
    }
    if (cloudSyncHandler) cloudSyncHandler(data);
}

function resetGameData() {
    localStorage.removeItem(STORAGE_KEY);
    return freshDefaults();
}

function recordClear(bossId, clearTimeMs) {
    const data = loadGameData();
    if (!data.clearedBosses.includes(bossId)) data.clearedBosses.push(bossId);
    if (!data.bestClearTimeMs[bossId] || clearTimeMs < data.bestClearTimeMs[bossId]) {
        data.bestClearTimeMs[bossId] = clearTimeMs;
    }
    saveGameData(data);
    return data;
}
