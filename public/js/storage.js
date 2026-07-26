const STORAGE_KEY = 'boss_raid_save';

const defaultData = {
    clearedBosses: [],
    bestClearTimeMs: {},
    selectedCharacter: 'kicker',
    unlockedCharacters: Object.keys(SHARED.CHARACTERS),
    clearedStoryFloors: [],
    soulStones: {} // charType -> count; SOUL_STONES_PER_CHARACTER of one unlocks it
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
            Object.keys(SHARED.CHARACTERS).forEach(id => {
                if (!data.unlockedCharacters.includes(id)) data.unlockedCharacters.push(id);
            });
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
