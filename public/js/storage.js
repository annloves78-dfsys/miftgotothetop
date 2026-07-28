const STORAGE_KEY = 'boss_raid_save';

// Currency/material holdings. Kept as one bag so a new kind is a single entry
// here plus a label in CURRENCY_LABELS (main.js) -- see also admin mode, which
// reports every one of these as unlimited.
const defaultCurrencies = {
    coins: 0,
    diamonds: 0,
    material: 0,      // 일반 장비강화 재료
    materialRare: 0,  // 고급 장비강화 재료
    potion: 0,        // 강화포션
    potionRare: 0,    // 고급 강화포션
    // 레전더리 뽑기 티켓. One per featured cookie, earned by clearing that
    // element's 레전더리 이벤트 stages; they are NOT interchangeable.
    ticketWaterdrop: 0,
    ticketMagma: 0,
    ticketLightning: 0
};

const defaultData = {
    clearedBosses: [],
    bestClearTimeMs: {},
    selectedCharacter: 'kicker',
    // Every cookie starts unlocked EXCEPT the season-limited ones -- those are
    // what 레전더리 뽑기 is for.
    unlockedCharacters: Object.keys(SHARED.CHARACTERS)
        .filter(id => !SHARED.CHARACTERS[id].seasonLimited),
    clearedStoryFloors: [],
    soulStones: {}, // charType -> count; SOUL_STONES_PER_CHARACTER of one unlocks it
    currencies: { ...defaultCurrencies },
    // 이벤트: the stage ids already cleared, plus 'both' once the 전체 클리어
    // bonus has been taken.
    eventCleared: [],
    eventClaimed: [],
    admin: false // 관리자 전용; see admin_gate.js
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
            // Saves made before a cookie existed won't have it in their stored
            // unlockedCharacters array (the merge above just keeps the old
            // array) — there's no unlock system yet, so patch every cookie in.
            // ...but never patch in a season-limited cookie: those have to be
            // pulled from 레전더리 뽑기, so an old save must not be handed one.
            Object.keys(SHARED.CHARACTERS).forEach(id => {
                if (SHARED.CHARACTERS[id].seasonLimited) return;
                if (!data.unlockedCharacters.includes(id)) data.unlockedCharacters.push(id);
            });
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
