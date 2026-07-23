const STORAGE_KEY = 'boss_raid_save';

const defaultData = {
    clearedBosses: [],
    bestClearTimeMs: {},
    selectedCharacter: 'kicker',
    unlockedCharacters: Object.keys(SHARED.CHARACTERS)
};

function loadGameData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            const data = { ...defaultData, ...parsed };
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
    return { ...defaultData };
}

function saveGameData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error("Failed to save game data", e);
    }
}

function resetGameData() {
    localStorage.removeItem(STORAGE_KEY);
    return { ...defaultData };
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
