const socket = io();

// ---- Screens ----
const screens = {
    lobby: document.getElementById('lobby-screen'),
    shop: document.getElementById('shop-screen'),
    stocks: document.getElementById('stocks-screen'),
    items: document.getElementById('items-screen'),
    awakenBoss: document.getElementById('awaken-boss-screen'),
    awakenDetail: document.getElementById('awaken-detail-screen'),
    gacha: document.getElementById('gacha-screen'),
    gachaPull: document.getElementById('gacha-pull-screen'),
    legendary: document.getElementById('legendary-screen'),
    modeSelect: document.getElementById('mode-select-screen'),
    storyFork: document.getElementById('story-fork-screen'),
    legendDetail: document.getElementById('legend-detail-screen'),
    storyMode: document.getElementById('story-mode-screen'),
    storyTower: document.getElementById('story-tower-screen'),
    storyFight: document.getElementById('story-fight-screen'),
    login: document.getElementById('login-screen'),
    signup: document.getElementById('signup-screen'),
    account: document.getElementById('account-screen'),
    controls: document.getElementById('controls-screen'),
    guestDetail: document.getElementById('guest-detail-screen'),
    guestFight: document.getElementById('guest-fight-screen'),
    zombieDetail: document.getElementById('zombie-detail-screen'),
    zombieFight: document.getElementById('zombie-fight-screen'),
    event: document.getElementById('event-screen'),
    characterSelect: document.getElementById('character-select-screen'),
    bossSelect: document.getElementById('boss-select-screen'),
    bossDetail: document.getElementById('boss-detail-screen'),
    characterDetail: document.getElementById('character-detail-screen'),
    fight: document.getElementById('fight-screen'),
    result: document.getElementById('result-screen')
};
function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[name].classList.remove('hidden');
    applyMobileControlsVisibility();
    playBgm(bgmTrackForScreen(name));
    // The lobby is where the currency bar lives; redraw it on the way in so a
    // reward taken on the result screen is already reflected.
    if (name === 'lobby') { renderCurrencyBar(); renderItemsBadge(); }
}

// ---- Background music ----
// 화면군마다 다른 트랙을 돌려쓴다. 로비 계열 화면은 전부 'lobby', 보통 전투
// (보스레이드/일반 스토리 층)는 'battle', 각성모드·좀비막기(그리고 나중에 생길
// 성장 던전도)는 'awaken', 게스트레이드는 따로 'guest'.
// 온/오프는 MOBILE_CONTROLS_KEY 등과 같은 방식으로 device-local 설정으로 둔다
// (아래 조작 화면 쪽 토글 정의부 참고).
const MUSIC_ENABLED_KEY = 'boss_raid_music_enabled';
let musicEnabled = localStorage.getItem(MUSIC_ENABLED_KEY) !== '0'; // 기본 켜짐
const BGM_TRACKS = {
    lobby: 'audio/bgm-lobby.mp3',
    battle: 'audio/bgm-battle.mp3',
    awaken: 'audio/bgm-awaken.mp3',
    guest: 'audio/bgm-guest.mp3'
};
const BGM_BATTLE_SCREENS = new Set(['fight', 'storyFight']);
// 좀비막기는 항상 awaken 트랙. storyFight는 스토리 층과 각성모드가 화면을
// 같이 쓰므로, 지금 층 키가 'awaken:쿠키:레벨' 꼴인지로 구분한다
// (activeStoryFloor, storyFloorStarted 핸들러가 showScreen보다 먼저 채워 둔다).
const BGM_AWAKEN_SCREENS = new Set(['zombieFight']);
const bgmPlayer = new Audio();
bgmPlayer.loop = true;
bgmPlayer.volume = 0.4;
// 미리 받아 놔야 클릭했을 때 바로 나온다 -- 안 그러면(브라우저 기본값이
// 'metadata'일 수 있다) 클릭한 다음에야 내려받기 시작해서 몇 초씩 늦게 나온다.
bgmPlayer.preload = 'auto';
let bgmCurrentTrack = null;
// 브라우저는 사용자가 한 번도 상호작용하기 전엔 소리 있는 자동재생을 막는다.
// 페이지 아무 데나 처음 클릭하는 순간 그때 트랙을 재생한다.
let bgmUnlocked = false;
document.addEventListener('click', () => {
    if (bgmUnlocked) return;
    bgmUnlocked = true;
    if (musicEnabled && bgmCurrentTrack) bgmPlayer.play().catch(() => {});
}, { once: true });

function bgmTrackForScreen(name) {
    if (name === 'guestFight') return 'guest';
    if (BGM_AWAKEN_SCREENS.has(name)) return 'awaken';
    if (name === 'storyFight' && SHARED.parseAwakenFloorKey(activeStoryFloor)) return 'awaken';
    return BGM_BATTLE_SCREENS.has(name) ? 'battle' : 'lobby';
}
function playBgm(track) {
    if (bgmCurrentTrack === track) return;
    bgmCurrentTrack = track;
    bgmPlayer.src = BGM_TRACKS[track];
    if (musicEnabled && bgmUnlocked) bgmPlayer.play().catch(() => {});
}

const lobbyCurrencyBar = document.getElementById('lobby-currency-bar');
const equipPicker = document.getElementById('equip-picker');
const equipPickerTitle = document.getElementById('equip-picker-title');
const equipPickerList = document.getElementById('equip-picker-list');
const equipPickerClose = document.getElementById('equip-picker-close');
const equipPickerPurse = document.getElementById('equip-picker-purse');
const equipPickerMsg = document.getElementById('equip-picker-msg');
const equipPickerUnequip = document.getElementById('equip-picker-unequip');
const charDetailSlotEls = [...document.querySelectorAll('#character-detail-screen .equip-slot[data-slot]')];
// 각성 칸은 에이션트 이상만 가지므로 슬롯 목록도 등급에 따라 달라진다.
function equipSlotsFor(charType) {
    const grade = (SHARED.CHARACTERS[charType] || {}).grade;
    return SHARED.hasAwakenSlot(grade)
        ? SHARED.EQUIP_SLOTS.concat(SHARED.AWAKEN_SLOT)
        : SHARED.EQUIP_SLOTS;
}
const towerRewardsEl = document.getElementById('tower-rewards');
// 11층부터 데려갈 쿠키 두 칸 (그 아래 층에서는 숨는다).
const towerPartyEl = document.getElementById('tower-party');
const detailBossRewardsEl = document.getElementById('detail-boss-rewards');
const detailBossContact = document.getElementById('detail-boss-contact');
const resultRewardsEl = document.getElementById('result-rewards');
const playBtn = document.getElementById('play-btn');
const characterSelectBtn = document.getElementById('character-select-btn');
const selectedCharNameEl = document.getElementById('selected-char-name');
const lobbyCharBody = document.getElementById('lobby-char-body');
const lobbyCharName = document.getElementById('lobby-char-name');
const characterListEl = document.getElementById('character-list');
const characterSelectHintEl = document.getElementById('character-select-hint');
const backFromCharacterBtn = document.getElementById('back-from-character-btn');
const backFromModeBtn = document.getElementById('back-from-mode-btn');
const storyModeCard = document.getElementById('story-mode-card');
const bossRaidModeCard = document.getElementById('boss-raid-mode-card');
const backToLobbyBtn = document.getElementById('back-to-lobby-btn');
const bossListEl = document.getElementById('boss-list');
const backFromDetailBtn = document.getElementById('back-from-detail-btn');
const charDetailBackBtn = document.getElementById('char-detail-back-btn');
const charDetailIcon = document.getElementById('char-detail-icon');
const charDetailName = document.getElementById('char-detail-name');
const charDetailGrade = document.getElementById('char-detail-grade');
const charDetailElement = document.getElementById('char-detail-element');
const charDetailRole = document.getElementById('char-detail-role');
const charDetailAtk = document.getElementById('char-detail-atk');
const charDetailHp = document.getElementById('char-detail-hp');
const charDetailAwakenSlot = document.getElementById('char-detail-awaken-slot');
const charDetailPower = document.getElementById('char-detail-power');

// Cookie Run Kingdom-style rarity ladder. From 에이션트 up, cookies get an
// extra "각성" (awakening) equipment slot above their weapon slot.
// 등급 사다리와 각성 칸 판정은 서버도 써야 해서 shared.js로 옮겼다.
// 전역 이름이 같아서 여기서 따로 선언하지 않고 SHARED.로 바로 쓴다.
// Badge colour per grade; shared by the character detail screen and gacha results.
const GRADE_CLASSES = {
    '희귀': 'rare',
    '에픽': 'epic',
    '레전더리': 'legendary',
    '에이션트': 'ancient',
    '비스트': 'beast',
    '게스트': 'guest'
};
function gradeClass(grade) {
    return 'grade-badge ' + (GRADE_CLASSES[grade] || 'common');
}
const charDetailAttackIcon = document.getElementById('char-detail-attack-icon');
const charDetailSkillIcon = document.getElementById('char-detail-skill-icon');
const charDetailUltimateIcon = document.getElementById('char-detail-ultimate-icon');
const charDetailPassiveIcon = document.getElementById('char-detail-passive-icon');
const charDetailDesc = document.getElementById('char-detail-desc');
const charDetailSelectBtn = document.getElementById('char-detail-select-btn');
const charDetailInstinctIcon = document.getElementById('char-detail-instinct-icon');
const charDetailInstinctBadge = document.getElementById('char-detail-instinct-badge');
const charDetailInstinctRow = document.getElementById('char-detail-instinct-row');
const charDetailInstinctCostEl = document.getElementById('char-detail-instinct-cost');
const charDetailInstinctBtn = document.getElementById('char-detail-instinct-btn');
const charDetailInstinctNav = document.getElementById('char-detail-instinct-nav');
const charDetailInstinctPrevBtn = document.getElementById('char-detail-instinct-prev-btn');
const charDetailInstinctNextBtn = document.getElementById('char-detail-instinct-next-btn');
const charDetailInstinctNavLabel = document.getElementById('char-detail-instinct-nav-label');

// ---- Auth (login / signup / persistent session) ----
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const menuBtn = document.getElementById('menu-btn');
const sideMenu = document.getElementById('side-menu');
// The ☰ menu has 계정 / 조작 (each opens its own screen) plus 음악, which is a
// plain on/off toggle right here in the menu -- no separate screen needed for
// one boolean.
const accountResetBtn = document.getElementById('account-reset-btn');
const accountResetModal = document.getElementById('account-reset-modal');
const accountResetYes = document.getElementById('account-reset-yes');
const accountResetNo = document.getElementById('account-reset-no');
const menuAccountBtn = document.getElementById('menu-account-btn');
const menuControlsBtn = document.getElementById('menu-controls-btn');
const menuMusicBtn = document.getElementById('menu-music-btn');
const menuMusicStatus = document.getElementById('menu-music-status');
const accountBackBtn = document.getElementById('account-back-btn');
const accountGuestBlock = document.getElementById('account-guest-block');
const accountUserBlock = document.getElementById('account-user-block');
const accountNicknameEl = document.getElementById('account-nickname');
const accountEmailEl = document.getElementById('account-email');
const accountLoginBtn = document.getElementById('account-login-btn');
const accountSignupBtn = document.getElementById('account-signup-btn');
const accountLogoutBtn = document.getElementById('account-logout-btn');
const loginBackBtn = document.getElementById('login-back-btn');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const loginGotoSignupBtn = document.getElementById('login-goto-signup-btn');
const signupBackBtn = document.getElementById('signup-back-btn');
const signupEmail = document.getElementById('signup-email');
const signupPassword = document.getElementById('signup-password');
const signupPasswordConfirm = document.getElementById('signup-password-confirm');
const signupNickname = document.getElementById('signup-nickname');
const signupError = document.getElementById('signup-error');
const signupSubmitBtn = document.getElementById('signup-submit-btn');
const signupGotoLoginBtn = document.getElementById('signup-goto-login-btn');

const AUTH_SESSION_KEY = 'boss_raid_session';
let currentUser = null;

function saveAuthSession() {
    if (currentUser) localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ token: currentUser.session_token }));
    else localStorage.removeItem(AUTH_SESSION_KEY);
}
function loadAuthSession() {
    try { return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY)); } catch { return null; }
}

function updateMenuAuthUI() {
    if (currentUser) {
        accountGuestBlock.classList.add('hidden');
        accountUserBlock.classList.remove('hidden');
        accountNicknameEl.textContent = currentUser.nickname + '님';
        accountEmailEl.textContent = currentUser.email || '-';
    } else {
        accountGuestBlock.classList.remove('hidden');
        accountUserBlock.classList.add('hidden');
    }
}

menuBtn.addEventListener('click', () => sideMenu.classList.toggle('hidden'));
document.addEventListener('click', (e) => {
    if (!sideMenu.classList.contains('hidden') && !sideMenu.contains(e.target) && e.target !== menuBtn) {
        sideMenu.classList.add('hidden');
    }
});

// 계정 초기화. 되돌릴 수 없으니 한 번 더 묻고, 지운 뒤에는 화면을 다시 띄운다
// (곳곳에 흩어진 화면을 하나씩 되돌리는 것보다 새로 그리는 쪽이 확실하다).
// 로그인 상태라면 초기화된 상태를 클라우드에도 밀어 넣어서, 다시 로그인해도
// 예전 진행 상황이 되살아나지 않게 한다.
if (accountResetBtn) {
    accountResetBtn.addEventListener('click', () => accountResetModal.classList.remove('hidden'));
    accountResetNo.addEventListener('click', () => accountResetModal.classList.add('hidden'));
    accountResetYes.addEventListener('click', () => {
        const fresh = resetGameData();
        saveGameData(fresh);
        location.reload();
    });
}

menuAccountBtn.addEventListener('click', () => {
    sideMenu.classList.add('hidden');
    openAccountScreen();
});
menuControlsBtn.addEventListener('click', () => {
    sideMenu.classList.add('hidden');
    updateControlsScreen();
    showScreen('controls');
});
function updateMenuMusicUI() {
    menuMusicStatus.textContent = musicEnabled ? '켜짐' : '꺼짐';
    menuMusicStatus.classList.toggle('on', musicEnabled);
}
updateMenuMusicUI();
menuMusicBtn.addEventListener('click', () => {
    // 화면을 옮겨가는 계정/조작과 달리 그 자리에서 바로 켜고 끄는 거라
    // 메뉴를 안 닫는다.
    musicEnabled = !musicEnabled;
    localStorage.setItem(MUSIC_ENABLED_KEY, musicEnabled ? '1' : '0');
    updateMenuMusicUI();
    if (musicEnabled) {
        if (bgmUnlocked && bgmCurrentTrack) bgmPlayer.play().catch(() => {});
    } else {
        bgmPlayer.pause();
    }
});

accountBackBtn.addEventListener('click', () => showScreen('lobby'));
accountLoginBtn.addEventListener('click', () => {
    loginError.textContent = '';
    showScreen('login');
});
accountSignupBtn.addEventListener('click', () => {
    signupError.textContent = '';
    showScreen('signup');
});
accountLogoutBtn.addEventListener('click', () => {
    currentUser = null;
    saveAuthSession();
    updateMenuAuthUI();
});

// Login/signup are reached from 계정 now, so back returns there rather than to the lobby.
loginBackBtn.addEventListener('click', () => openAccountScreen());
signupBackBtn.addEventListener('click', () => openAccountScreen());
loginGotoSignupBtn.addEventListener('click', () => { signupError.textContent = ''; showScreen('signup'); });
signupGotoLoginBtn.addEventListener('click', () => { loginError.textContent = ''; showScreen('login'); });

async function syncGameDataToCloud(data) {
    if (!currentUser) return;
    try {
        await sb.rpc('br_save_data', { p_token: currentUser.session_token, p_data: data || gameData });
    } catch (e) {
        console.error('cloud sync failed', e);
    }
}
setCloudSyncHandler(syncGameDataToCloud);

async function applyCloudGameData(cloudData) {
    if (cloudData && typeof cloudData === 'object' && Object.keys(cloudData).length > 0) {
        gameData = { ...freshDefaults(), ...cloudData };
        saveGameData(gameData);
    } else {
        await syncGameDataToCloud();
    }
    updateSelectedCharLabel();
}

loginSubmitBtn.addEventListener('click', async () => {
    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    loginError.textContent = '';
    if (!email || !password) { loginError.textContent = '이메일과 비밀번호를 입력해주세요.'; return; }
    try {
        const { data, error } = await sb.rpc('br_login', { p_email: email, p_password: password });
        if (error) throw error;
        currentUser = data;
        saveAuthSession();
        updateMenuAuthUI();
        await applyCloudGameData(data.game_data);
        showScreen('lobby');
    } catch (e) {
        const msg = (e && e.message) || '';
        loginError.textContent = msg.includes('INVALID_CREDENTIALS')
            ? '이메일 또는 비밀번호가 올바르지 않습니다.'
            : '로그인에 실패했습니다.';
    }
});

signupSubmitBtn.addEventListener('click', async () => {
    const email = signupEmail.value.trim();
    const password = signupPassword.value;
    const passwordConfirm = signupPasswordConfirm.value;
    const nickname = signupNickname.value.trim();
    signupError.textContent = '';
    if (!email || !password || !passwordConfirm || !nickname) {
        signupError.textContent = '모든 항목을 입력해주세요.';
        return;
    }
    if (password !== passwordConfirm) {
        signupError.textContent = '비밀번호가 일치하지 않습니다.';
        return;
    }
    const strongPassword = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/.test(password);
    if (!strongPassword) {
        signupError.textContent = '비밀번호는 10자 이상, 영문/숫자/특수문자를 모두 포함해야 합니다.';
        return;
    }
    try {
        const { data, error } = await sb.rpc('br_signup', { p_email: email, p_password: password, p_nickname: nickname });
        if (error) throw error;
        currentUser = data;
        saveAuthSession();
        updateMenuAuthUI();
        await applyCloudGameData(data.game_data);
        showScreen('lobby');
    } catch (e) {
        const msg = (e && e.message) || '';
        if (msg.includes('EMAIL_EXISTS')) signupError.textContent = '이미 가입된 이메일입니다.';
        else if (msg.includes('INVALID_EMAIL')) signupError.textContent = '올바른 이메일 형식이 아닙니다.';
        else if (msg.includes('PASSWORD_WEAK')) signupError.textContent = '비밀번호는 10자 이상, 영문/숫자/특수문자를 모두 포함해야 합니다.';
        else signupError.textContent = '회원가입에 실패했습니다.';
    }
});

async function restoreAuthSession() {
    const session = loadAuthSession();
    if (!session || !session.token) return;
    try {
        const { data, error } = await sb.rpc('br_get_me', { p_token: session.token });
        if (error) throw error;
        currentUser = { ...data, session_token: session.token };
        updateMenuAuthUI();
        await applyCloudGameData(data.game_data);
    } catch (e) {
        localStorage.removeItem(AUTH_SESSION_KEY);
    }
}
restoreAuthSession();

// ---- 관리자 전용 (admin mode) ----
// The credential check itself lives in admin_gate.js. Turning it on unlocks
// every difficulty, reports every currency as unlimited, and grants every
// cookie. See the header comment in admin_gate.js: this is an owner convenience,
// not a security boundary.
const adminOpenBtn = document.getElementById('admin-open-btn');
const adminStatusEl = document.getElementById('admin-status');
const adminFormEl = document.getElementById('admin-form');
const adminActiveEl = document.getElementById('admin-active');
const adminEmailInput = document.getElementById('admin-email');
const adminPasswordInput = document.getElementById('admin-password');
const adminErrorEl = document.getElementById('admin-error');
const adminSubmitBtn = document.getElementById('admin-submit-btn');
const adminOffBtn = document.getElementById('admin-off-btn');
const adminCurrencyListEl = document.getElementById('admin-currency-list');
const adminPowerListEl = document.getElementById('admin-power-list');

const CURRENCY_LABELS = {
    coins: '코인',
    diamonds: '다이아',
    ticketNormal: '일반 뽑기 티켓',
    material: '일반 장비강화 재료',
    materialRare: '고급 장비강화 재료',
    potion: '강화포션',
    potionRare: '고급 강화포션',
    ticketDemon: '악마 뽑기 티켓',
    ticketWaterdrop: '물방울맛 뽑기 티켓',
    ticketMagma: '마그마맛 뽑기 티켓',
    ticketLightning: '번개전사맛 뽑기 티켓',
    ticketWindarcher: '바람궁수맛 뽑기 티켓'
};

const CURRENCY_ICONS = {
    coins: '🪙',
    diamonds: '💎',
    ticketNormal: '🏷️',
    material: '🪨',
    materialRare: '💊',
    potion: '🧪',
    potionRare: '⚗️',
    ticketDemon: '😈',
    ticketWaterdrop: '🎫',
    ticketMagma: '🎫',
    ticketLightning: '🎫',
    ticketWindarcher: '🎫'
};

// The pills in the lobby's top-right corner. Tickets are left out -- they have
// their own counters on the event and 레전더리 뽑기 screens.
const LOBBY_CURRENCIES = ['coins', 'diamonds', 'ticketNormal', 'material', 'materialRare', 'potion', 'potionRare'];

// ---- 장비 ----
// 가방은 계정 공용, 장착은 쿠키별. 한 uid는 동시에 한 쿠키에만 붙는다.
function inventoryItems() {
    return gameData.inventory || (gameData.inventory = []);
}

function bagEntry(uid) {
    return inventoryItems().find(it => it.uid === uid) || null;
}

function equippedOf(charType) {
    if (!gameData.equipped) gameData.equipped = {};
    return gameData.equipped[charType] || (gameData.equipped[charType] = {});
}

// 이 uid를 끼고 있는 쿠키가 있으면 그 쿠키 id, 없으면 null.
function wornBy(uid) {
    if (!gameData.equipped) return null;
    return Object.keys(gameData.equipped).find(ct =>
        SHARED.EQUIP_SLOT_KEYS.some(k => gameData.equipped[ct][k] === uid)) || null;
}

function grantEquipment(itemId) {
    const item = SHARED.equipmentFor(itemId);
    if (!item) return null;
    const uid = gameData.nextEquipUid || 1;
    gameData.nextEquipUid = uid + 1;
    inventoryItems().push({ uid, itemId, level: 0 });
    saveGameData(gameData);
    return { uid, itemId, item };
}

// ---- 아이템창 ----
// 재화와 달리 "쓰는" 것들. 개수만 세면 되므로 가방(inventory)과 달리 key -> 수다.
function itemBag() {
    if (!gameData.items || typeof gameData.items !== 'object') gameData.items = {};
    return gameData.items;
}
function itemCount(key) { return itemBag()[key] || 0; }

// 조각처럼 goal이 있는 아이템은 그만큼 모이면 becomes로 자동으로 바뀐다.
// 60개면 두 개 -- 남는 것은 그대로 둔다.
function convertFullItems() {
    let made = 0;
    Object.entries(SHARED.ITEMS).forEach(([key, def]) => {
        if (!def.goal || !def.becomes) return;
        const bag = itemBag();
        while ((bag[key] || 0) >= def.goal) {
            bag[key] -= def.goal;
            bag[def.becomes] = (bag[def.becomes] || 0) + 1;
            made++;
        }
    });
    return made;
}

// 아이템을 준다. { key: 개수 } 꼴. 조각이 가득 차면 바로 바뀐다.
function grantItems(bag) {
    if (!bag) return 0;
    const store = itemBag();
    Object.entries(bag).forEach(([key, n]) => {
        if (!SHARED.ITEMS[key] || !n) return;
        store[key] = (store[key] || 0) + n;
    });
    const made = convertFullItems();
    saveGameData(gameData);
    return made;
}

// 랜덤 각성 장비 한 개를 쓴다. 각성 장비 5종 중 하나가 무작위로 나온다.
function useRandomAwakenGear() {
    if (itemCount(SHARED.AWAKEN_GEAR_ITEM_KEY) <= 0) {
        return { ok: false, msg: '랜덤 각성 장비가 없습니다.' };
    }
    const pool = SHARED.awakenEquipmentIds();
    if (!pool.length) return { ok: false, msg: '나올 수 있는 각성 장비가 없습니다.' };
    itemBag()[SHARED.AWAKEN_GEAR_ITEM_KEY] -= 1;
    const got = grantEquipment(pool[Math.floor(Math.random() * pool.length)]);
    saveGameData(gameData);
    const item = got && SHARED.equipmentFor(got.itemId);
    return { ok: true, got, msg: item ? `${item.icon} ${item.name} 획득!` : '' };
}

// 랜덤 레전더리 장비 한 개를 쓴다. 레전더리 등급 장비 중 하나가 무작위로 나온다.
function useRandomLegendaryGear() {
    if (itemCount('randomLegendaryGear') <= 0) {
        return { ok: false, msg: '랜덤 레전더리 장비가 없습니다.' };
    }
    const pool = SHARED.legendaryEquipmentIds();
    if (!pool.length) return { ok: false, msg: '나올 수 있는 레전더리 장비가 없습니다.' };
    itemBag().randomLegendaryGear -= 1;
    const got = grantEquipment(pool[Math.floor(Math.random() * pool.length)]);
    saveGameData(gameData);
    const item = got && SHARED.equipmentFor(got.itemId);
    return { ok: true, got, msg: item ? `${item.icon} ${item.name} 획득!` : '' };
}

// 클리어할 때마다 그 출처의 드랍 표에서 하나를 뽑는다.
function rollClearDrop(key) {
    const table = SHARED.clearDropsFor(key);
    if (!table || !table.length) return null;
    return grantEquipment(table[Math.floor(Math.random() * table.length)]);
}

function equipItem(charType, uid) {
    const entry = bagEntry(uid);
    const item = entry && SHARED.equipmentFor(entry.itemId);
    if (!item) return false;
    // 다른 쿠키가 끼고 있었다면 거기서 먼저 벗긴다.
    const owner = wornBy(uid);
    if (owner) delete gameData.equipped[owner][item.slot];
    equippedOf(charType)[item.slot] = uid;
    saveGameData(gameData);
    return true;
}

function unequipSlot(charType, slot) {
    delete equippedOf(charType)[slot];
    saveGameData(gameData);
}

// 서버에 보낼 장비 목록: 수치가 아니라 **장비 id**만 보낸다.
// 보너스 계산은 서버가 shared.js의 표를 보고 직접 한다.
function equipPayload(charType) {
    const worn = equippedOf(charType);
    const out = {};
    equipSlotsFor(charType).map(s => s.key).forEach(slot => {
        const entry = bagEntry(worn[slot]);
        if (entry) out[slot] = { id: entry.itemId, level: entry.level || 0 };
    });
    return out;
}

// ---- 장비 강화 ----
// 재료 + 코인을 쓰고 확률만큼 성공한다. 강화포션을 쓰면 확률을 건너뛴다.
// 실패해도 레벨은 그대로고 재료와 코인만 없어진다.
function upgradeEquip(uid, usePotion) {
    const entry = bagEntry(uid);
    const item = entry && SHARED.equipmentFor(entry.itemId);
    if (!item) return { ok: false, msg: '없는 장비입니다.' };
    const cost = SHARED.equipUpgradeCost(item, entry.level || 0);
    if (!cost) return { ok: false, msg: '이미 최대 강화입니다.' };
    const missing = [];
    if (currencyAmount(cost.materialKey) < cost.material) missing.push(CURRENCY_LABELS[cost.materialKey]);
    if (currencyAmount('coins') < cost.coins) missing.push(CURRENCY_LABELS.coins);
    if (usePotion && currencyAmount(cost.potionKey) < cost.potion) missing.push(CURRENCY_LABELS[cost.potionKey]);
    if (missing.length) return { ok: false, msg: `${missing.join(', ')}이(가) 모자랍니다.` };

    if (!adminPowerOn('currencies')) {
        const spend = { coins: -cost.coins };
        spend[cost.materialKey] = (spend[cost.materialKey] || 0) - cost.material;
        if (usePotion) spend[cost.potionKey] = (spend[cost.potionKey] || 0) - cost.potion;
        grantCurrencies(spend);
    }
    const success = usePotion || Math.random() < cost.chance;
    if (success) entry.level = (entry.level || 0) + 1;
    saveGameData(gameData);
    return {
        ok: true, success, level: entry.level || 0,
        msg: success
            ? `${item.name} 강화 성공! Lv${cost.to}이 되었습니다.`
            : `${item.name} 강화 실패... 재료와 코인만 사용되었습니다. (Lv${cost.from} 유지)`
    };
}

// 강화 비용을 버튼에 적을 한 줄로.
function upgradeCostText(cost, usePotion) {
    const parts = [`${CURRENCY_ICONS[cost.materialKey]}${cost.material}`, `${CURRENCY_ICONS.coins}${cost.coins}`];
    if (usePotion) parts.unshift(`${CURRENCY_ICONS[cost.potionKey]}${cost.potion}`);
    return `${parts.join(' · ')} · ${usePotion ? '확정' : Math.round(cost.chance * 100) + '%'}`;
}

function equipBonusOf(charType) {
    return SHARED.equipBonusFor(equipPayload(charType), charType);
}

// ---- 본능해제 ----
// 그 캐릭터 자신의 영혼석(중복 뽑기로 쌓인다)을 써서 영구 강화한다.
function instinctLevelOfChar(charType) {
    return SHARED.instinctLevelOf(gameData.instinctLevels, charType);
}
// 서버에 보낼 값: 레벨 숫자 하나뿐이다. 실제 보너스 계산은 서버가 shared.js
// 표를 보고 직접 한다 (equipPayload와 같은 신뢰 모델).
function instinctPayload(charType) {
    return instinctLevelOfChar(charType);
}
const INSTINCT_LEVEL_DESCRIPTIONS = {
    1: `기본 능력치 강화 — 체력 +${SHARED.INSTINCT_L1_BONUS_HEALTH}, 공격력 +${SHARED.INSTINCT_L1_BONUS_ATTACK}`,
    2: `스킬 강화 — 스킬 피해 +${SHARED.INSTINCT_L2_SKILL_DAMAGE_BONUS}, 보호막 +${SHARED.INSTINCT_L2_SKILL_SHIELD_BONUS}, 회복 +${SHARED.INSTINCT_L2_SKILL_HEAL_BONUS}`
};
// 3강부터는 캐릭터마다 다르다 -- 없으면 아직 디자인 전이라 "준비 중"으로 보인다.
function instinctLevelDesc(charType, level) {
    if (level <= 0) return '아직 해제되지 않았습니다.';
    if (level <= 2) return INSTINCT_LEVEL_DESCRIPTIONS[level];
    return SHARED.instinctCharLevelDesc(charType, level) || `${level}강 (궁극기 강화 — 준비 중)`;
}
// 다음 레벨이 실제로 강화 가능한지 (1~2강은 항상, 3강부터는 그 캐릭터의
// 효과가 정의돼 있을 때만).
function instinctNextLevelReady(charType, nextLevel) {
    return nextLevel <= 2 || !!SHARED.instinctCharLevelEffect(charType, nextLevel);
}
// 소울스톤을 써서 한 단계 강화한다.
function upgradeInstinct(charType) {
    const level = instinctLevelOfChar(charType);
    const nextLevel = level + 1;
    if (!instinctNextLevelReady(charType, nextLevel)) return false;
    const cost = SHARED.instinctNextCost(level);
    if (cost == null) return false;
    const have = gameData.soulStones[charType] || 0;
    if (have < cost) return false;
    gameData.soulStones[charType] = have - cost;
    gameData.instinctLevels[charType] = nextLevel;
    saveGameData(gameData);
    return true;
}

// 각성 장비를 낀 상태의 수치. 각성 장비는 능력치를 더하는 게 아니라 발차기
// 피해나 궁극기 보호막을 통째로 바꾸기도 해서, 상세 화면은 이걸 읽어야
// 실제로 싸울 때의 숫자가 그대로 보인다.
function statsWithGear(charType) {
    const base = SHARED.characterWithGear(charType, equipPayload(charType)) || SHARED.CHARACTERS.kicker;
    return SHARED.characterWithInstinct(base, instinctLevelOfChar(charType), charType);
}

// 장비 하나의 능력치를 사람이 읽을 수 있는 한 줄로.
function equipStatText(src) {
    const parts = [];
    if (src.bonusAttack) parts.push(`공격력 ${src.bonusAttack > 0 ? '+' : ''}${src.bonusAttack}`);
    if (src.bonusHealth) parts.push(`체력 ${src.bonusHealth > 0 ? '+' : ''}${src.bonusHealth}`);
    if (src.bonusSpeed) parts.push(`이동 속도 ${src.bonusSpeed > 0 ? '+' : ''}${src.bonusSpeed}`);
    if (src.bonusDamageTaken) parts.push(`받는 피해 ${Math.round((1 - src.bonusDamageTaken) * 100)}% 감소`);
    if (src.bonusCooldown) parts.push(`재사용 대기시간 ${Math.round((1 - src.bonusCooldown) * 100)}% 감소`);
    if (src.bonusRevive) parts.push(`부활 횟수 +${src.bonusRevive}`);
    return parts.join(' · ');
}

// 목록에 적을 능력치. 전용 효과가 지금 이 쿠키에게 발동하면 그 몫까지 합쳐서
// 보여준다 -- 각성 장비는 능력치가 전부 전용 효과 쪽에 들어 있어서, 합치지
// 않으면 "능력치 없음"으로 보인다.
function mergedEquipStats(item, level, charType) {
    const out = SHARED.equipStatsAtLevel(item, level);
    if (!SHARED.ownerBonusActive(item, charType)) return out;
    const extra = SHARED.equipStatsAtLevel(item.ownerBonus, level);
    Object.keys(extra).forEach(k => {
        if (k === 'bonusDamageTaken' || k === 'bonusCooldown') {
            out[k] = (out[k] == null ? 1 : out[k]) * extra[k];
        } else {
            out[k] = (out[k] || 0) + extra[k];
        }
    });
    return out;
}

// 보스전에서만 나오는 레전더리 장비 안내 칸. 무엇이 나올지는 무작위라
// 하나를 콕 집어 보여주지 않고 "레전더리 장비 하나"라고만 알려준다.
function legendaryDropChipHtml() {
    return `
        <div class="reward-chip legendary-chip">
            <span class="reward-chip-icon">⚔</span>
            <span class="reward-chip-amount">1</span>
            <span class="reward-chip-label">레전더리 장비</span>
        </div>`;
}

function equipDropChipHtml(dropped) {
    if (!dropped) return '';
    const item = dropped.item;
    return `
        <div class="reward-chip">
            <span class="reward-chip-icon">${item.icon}</span>
            <span class="reward-chip-amount">${item.name}</span>
            <span class="reward-chip-label">${item.grade} 장비</span>
        </div>`;
}

function isAdmin() {
    return !!gameData.admin;
}

// 관리자 전용의 힘은 항목마다 따로 켠다. gameData.adminOn에 적힌 것만 켜진
// 것으로 보므로, 관리자 전용을 막 켰을 땐 전부 꺼진 상태로 시작하고 필요한
// 것만 하나씩 직접 켜야 한다.
const ADMIN_POWERS = [
    { key: 'currencies', label: '재화 무한', hint: '코인·다이아·재료·티켓이 ∞가 되고 쓸 때 줄지 않아요.' },
    { key: 'characters', label: '캐릭터 전부 해제', hint: '뽑지 않은 쿠키도 전부 고를 수 있어요.' },
    { key: 'stages', label: '층·보스·스테이지 전부 해제', hint: '앞을 안 깨도 아무 층이나 들어갈 수 있어요.' }
];
function adminPowerOn(key) {
    if (!isAdmin()) return false;
    return !!(gameData.adminOn && gameData.adminOn[key]);
}
function setAdminPower(key, on) {
    if (!gameData.adminOn) gameData.adminOn = {};
    if (on) gameData.adminOn[key] = true;
    else delete gameData.adminOn[key];
    saveGameData(gameData);
}

// The single place anything should read a currency from: admin mode makes every
// balance unlimited, so callers never have to special-case it.
function currencyAmount(key) {
    if (adminPowerOn('currencies')) return Infinity;
    return (gameData.currencies && gameData.currencies[key]) || 0;
}
function currencyText(key) {
    const n = currencyAmount(key);
    return n === Infinity ? '∞' : n.toLocaleString();
}

function isCharacterUnlocked(id) {
    return adminPowerOn('characters') || gameData.unlockedCharacters.includes(id);
}

function renderAdminCurrencies() {
    adminCurrencyListEl.innerHTML = Object.entries(CURRENCY_LABELS).map(([key, label]) =>
        `<div class="settings-row"><span class="settings-row-label">${label}</span>` +
        `<span class="settings-row-value">${currencyText(key)}</span></div>`
    ).join('');
}

// 항목마다 따로 켜고 끈다. 하나를 꺼도 관리자 전용 자체는 켜진 채로 남는다.
function renderAdminPowers() {
    adminPowerListEl.innerHTML = ADMIN_POWERS.map(p => {
        const on = adminPowerOn(p.key);
        return `<div class="admin-power-row">
            <span class="admin-power-text">
                <span class="admin-power-label">${p.label}</span>
                <span class="admin-power-hint">${p.hint}</span>
            </span>
            <button class="admin-power-btn${on ? ' on' : ''}" data-power="${p.key}">${on ? '켜짐' : '꺼짐'}</button>
        </div>`;
    }).join('');
}

adminPowerListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.admin-power-btn');
    if (!btn) return;
    setAdminPower(btn.dataset.power, !adminPowerOn(btn.dataset.power));
    renderAdminPowers();
    renderAdminCurrencies();
    renderCurrencyBar();
});

function updateAdminUI() {
    const on = isAdmin();
    adminStatusEl.textContent = on ? '켜짐' : '꺼짐';
    adminStatusEl.classList.toggle('on', on);
    adminActiveEl.classList.toggle('hidden', !on);
    if (on) {
        adminFormEl.classList.add('hidden');
        renderAdminPowers();
        renderAdminCurrencies();
    }
}

function openAccountScreen() {
    updateMenuAuthUI();
    adminErrorEl.textContent = '';
    adminFormEl.classList.add('hidden');
    updateAdminUI();
    showScreen('account');
}

adminOpenBtn.addEventListener('click', () => {
    if (isAdmin()) return; // already on -- the off button is what's shown instead
    adminErrorEl.textContent = '';
    adminFormEl.classList.toggle('hidden');
    if (!adminFormEl.classList.contains('hidden')) adminEmailInput.focus();
});

adminSubmitBtn.addEventListener('click', () => {
    if (!isAdminCredentialValid(adminEmailInput.value, adminPasswordInput.value)) {
        adminErrorEl.textContent = '이메일 또는 비밀번호가 올바르지 않습니다.';
        return;
    }
    adminPasswordInput.value = '';
    adminErrorEl.textContent = '';
    gameData.admin = true;
    // 캐릭터 전부 해제를 포함한 개별 힘은 전부 꺼진 채로 시작한다 -- 여기서
    // 뭔가를 미리 켜거나 영구로 지급하지 않는다. 필요하면 관리자 화면에서
    // 그 힘을 직접 켜서 쓴다 (adminPowerOn/setAdminPower 참고).
    saveGameData(gameData);
    updateAdminUI();
});

adminOffBtn.addEventListener('click', () => {
    gameData.admin = false;
    saveGameData(gameData);
    updateAdminUI();
    adminFormEl.classList.add('hidden');
});

// Passives get their own icon on the detail screen (next to the ultimate), so
// this is the text for that slot. Cookies without one show 없음.
function hasPassive(stats) {
    return !!(stats.passiveReviveCount || stats.passiveResistElement || stats.attackBurnDamage);
}

function passiveText(stats) {
    const sec = ms => (ms / 1000).toString().replace(/\.0$/, '');
    const parts = [];
    if (stats.attackBurnDamage) {
        // The burn is deliberately left out of the attack's damage number (which
        // stays at attackDamage); it lives here instead.
        const total = stats.attackBurnDamage * stats.attackBurnTicks;
        parts.push(`기본 공격이 적중하면 대상을 불태워 ${sec(stats.attackBurnIntervalMs)}초마다 ${stats.attackBurnDamage}의 화염 피해를 ${stats.attackBurnTicks}번 추가로 줍니다. (추가 피해 합계 ${total})`);
    }
    // 치즈만두맛은 부활이 곧 각성이라(awakenOnReviveNo가 1) 여기서 한 번 더
    // 말하면 체력이 그대로 돌아오는 것처럼 읽힌다. 각성 쪽 문장에 맡긴다.
    if (stats.passiveReviveCount && stats.awakenOnReviveNo !== 1) {
        const hpPct = Math.round(stats.passiveReviveHpRatio * 100);
        parts.push(hpPct >= 100
            ? `쓰러져도 전투당 ${stats.passiveReviveCount}번 체력을 모두 채워 완전 부활합니다.`
            : `쓰러져도 전투당 ${stats.passiveReviveCount}번 체력 ${hpPct}%로 부활합니다.`);
        if (stats.passiveReviveEnemySoloRatio) {
            parts.push(`부활하는 순간 충격파가 퍼져 상대가 한 명이면 그 상대의 체력을 ${Math.round(stats.passiveReviveEnemySoloRatio * 100)}%, 여러 명이면 각각 ${Math.round(stats.passiveReviveEnemyCrowdRatio * 100)}%씩 깎습니다.`);
        }
        if (stats.passiveReviveBlastDamage) {
            parts.push(`부활하는 순간 반경 ${stats.passiveReviveBlastRadius}px 내의 적에게 ${stats.passiveReviveBlastDamage}의 고정 피해를 줍니다.`);
        }
        if (stats.passiveBurnGrowthPerRevive) {
            const growth = Array.from({ length: stats.passiveReviveCount },
                (_, i) => stats.attackBurnDamage + (i + 1) * stats.passiveBurnGrowthPerRevive);
            parts.push(`부활할 때마다 기본 공격의 화염 피해가 ${stats.passiveBurnGrowthPerRevive}씩 늘어 ${stats.attackBurnDamage} → ${growth.join(' → ')}가 됩니다.`);
        }
    }
    if (stats.passiveKillAttackBuff) {
        parts.push(`기본 공격으로 적을 쓰러뜨릴 때마다 ${sec(stats.passiveKillAttackBuffDurationMs)}초 동안 공격력이 ${stats.passiveKillAttackBuff} 오릅니다. 중첩 제한은 없습니다.`);
    }
    if (stats.passiveResistElement) {
        parts.push(`${stats.passiveResistElement} 속성 표식이 걸린 상대에게 받는 피해가 ${Math.round(stats.passiveResistMultiplier * 100)}%로 줄어듭니다.`);
    }
    if (stats.passiveDamageMultiplier) {
        parts.push(`받는 피해가 항상 ${Math.round(stats.passiveDamageMultiplier * 100)}%로 줄어듭니다.`);
    }
    if (stats.attackHealEveryHits) {
        parts.push(`기본 공격을 ${stats.attackHealEveryHits}번 적중시킬 때마다 체력을 ${stats.attackHealSelf}만큼 회복합니다.`);
    }
    if (stats.passiveHitHealChance) {
        parts.push(`공격을 적중시킬 때마다 ${Math.round(stats.passiveHitHealChance * 100)}% 확률로`
            + ` 최대 체력의 ${Math.round(stats.passiveHitHealRatio * 100)}%를 회복합니다.`);
    }
    // 각성 형태는 쿠키마다 바뀌는 항목이 다르다 (번개악마맛은 궁극기 피해까지,
    // 치즈만두맛은 표식이 사라진다). awakenedForm에 적힌 것만 읽어서 늘어놓는다.
    if (stats.awakenOnReviveNo) {
        const form = stats.awakenedForm || {};
        const bits = [];
        if (form.health != null) bits.push(`체력 ${form.health}`);
        if (form.attackDamage != null) bits.push(`기본공격 ${form.attackDamage}`);
        if (form.ultimateDamage != null) bits.push(`궁극기 피해 ${form.ultimateDamage}`);
        const when = stats.awakenOnReviveNo === 1
            ? '쓰러지면 그 자리에서 각성해 다시 일어납니다. 각성 장비를 끼면 각성한 뒤에도 한 번 더 일어납니다.'
            : `쓰러져도 반드시 한 번 부활합니다. 각성 장비를 끼면 부활이 한 번 더 생기고,`
              + ` ${stats.awakenOnReviveNo}번째 부활에서 각성합니다.`;
        let text = `${when} 각성하면 ${bits.join(', ')}가 됩니다.`;
        if (form.attackMarkUses === 0 && stats.attackMarkUses) {
            text += ' 대신 표식을 쌓는 쪽에서 거둬들이는 쪽으로 바뀝니다 —'
                + ' 기본 공격이 더 이상 표식을 남기지 않고,'
                + ` 그동안 쌓아 둔 표식을 한 개씩 먹으면서 한 번에 ${form.markEatBonus}의 추가 피해를 줍니다.`;
        }
        parts.push(text);
    }
    if (stats.attackMarkUses) {
        parts.push(`기본 공격이 적중할 때마다 대상에게 ${stats.element} 속성 표식을 ${stats.attackMarkUses}번 남깁니다.`
            + ` 표식이 붙어 있는 동안 같은 속성의 쿠키가 공격하면 피해가 ${stats.attackMarkMultiplier}배가 되고,`
            + ` 표식은 한 번 쓸 때마다 하나씩 줄어듭니다.`
            + (stats.keepsOwnMarks ? ' 자기 표식은 자기가 먹지 않으므로 때리는 족족 쌓이기만 합니다.' : ''));
    }
    if (stats.attackHealOnUse && stats.attackHealChance === undefined) {
        parts.push(`기본 공격이 적중할 때마다 팀 전체를 ${stats.attackHealOnUse}만큼 회복시킵니다.`);
    }
    if (stats.attackShieldOnUse && stats.attackShieldChance === undefined) {
        parts.push(`기본 공격이 적중할 때마다 팀 전체에게 보호막을 ${stats.attackShieldOnUse}만큼 더해 줍니다(덮어쓰지 않고 쌓입니다).`);
    }
    if (stats.lowHpAt) {
        parts.push(`체력이 ${stats.lowHpAt} 이하로 떨어지면 몸을 사려,`
            + ` 기본 공격 피해가 ${stats.attackDamage} → ${stats.lowHpAttackDamage}로 줄어드는 대신`
            + ` 공격이 적중할 때마다 자신의 체력을 ${stats.lowHpAttackHealSelf}만큼 회복합니다.`
            + ` 체력이 다시 꽉 차면 풀리며, 횟수 제한은 없습니다.`);
    }
    return parts.length ? parts.join(' ') : '없음';
}

// 밀물은 단계마다 값이 전부 다르다. 문장으로 늘어놓으면 너무 기니까 단계별로
// 한 줄씩만 끊어서 보여 준다.
function tideCycleText(stats, sec) {
    const pct = v => `${Math.round(v * 100)}%`;
    const lines = (stats.skillStages || []).map((st, i) => {
        const bits = [];
        if (st.windupMs) bits.push(`예열 ${sec(st.windupMs)}초`);
        if (st.damageRatio) bits.push(`적 체력 ${pct(st.damageRatio)}`);
        bits.push(`회복 ${pct(st.healRatio)}`);
        bits.push(`보호막 ${st.shieldAmount}`);
        return `${i + 1}단계 · ${bits.join(' · ')}`;
    });
    return [
        '쓸 때마다 1→2→3→4단계, 그다음 다시 1단계.',
        ...lines,
        '피해는 적의 지금 체력, 회복은 팀 최대 체력 기준.',
        '4단계는 2·3단계를 모두 맞혀야 나오고, 빗나가면 1단계로.',
        `예열은 재사용 대기시간에 포함되지 않습니다 (터진 뒤부터 ${sec(stats.skillCooldown)}초).`
    ].join('\n');
}

function describeAbility(stats, kind) {
    const sec = ms => (ms / 1000).toString().replace(/\.0$/, '');
    if (kind === 'passive') return passiveText(stats);
    if (kind === 'attack') {
        // 전기줄맛: 몸에 따라 피해가 다르다 (attackType은 그냥 melee_kick).
        if (stats.skillType === 'body_swap') {
            return `전방 ${stats.attackRange}px 범위를 공격합니다. 피해는 지금 몸에 따라 다릅니다 —`
                + ` 상체일 때 ${stats.upperAttackDamage}, 하체일 때 ${stats.lowerAttackDamage}, 합체 중엔 ${stats.ultimateAttackDamage}.`
                + ` (재사용 대기시간 ${sec(stats.attackCooldown)}초)`;
        }
        if (stats.attackType === 'alternating_punch') {
            return `오른손과 왼손을 번갈아 가며 공격합니다. 오른손 피해 ${stats.attackDamageRight}, 왼손 피해 ${stats.attackDamageLeft}. (재사용 대기시간 ${sec(stats.attackCooldown)}초)`;
        }
        if (stats.attackType === 'dual_spear') {
            return `창 두 개를 오른손, 왼손 순으로 번갈아 찌르며 이를 계속 반복합니다. 몸의 해당 쪽에서 전방 ${stats.attackRange}px를 찔러 한 번마다 ${stats.attackDamage}의 피해를 줍니다. (재사용 대기시간 ${sec(stats.attackCooldown)}초)`;
        }
        if (stats.attackType === 'combo_two_stage') {
            const [a, b] = stats.attackStages;
            return `1타는 좌우로 넓게 휘둘러 (가로 ${a.width}px, 전방 ${a.range}px) ${a.damage}의 피해를 줍니다.`
                + ` 1타 후 ${sec(stats.comboFollowupCooldown)}초 만에 2타를 이어서 쓸 수 있고, 2타는 전방으로 길게 (${b.range}px) 찔러 ${b.damage}의 피해를 줍니다.`
                + ` (1타 재사용 대기시간 ${sec(stats.attackCooldown)}초)`;
        }
        if (stats.attackType === 'vampire_slash') {
            return `보라빛 대검으로 전방 ${stats.attackRange}px를 가로로 베어 ${stats.attackDamage}의 피해를 줍니다.`
                + ` 모든 베기가 흡혈 베기이며, 그 베기로 적을 쓰러뜨리면 최대 체력의 ${Math.round(stats.attackVampireHealRatio * 100)}%를 회복합니다.`
                + ` 보스도 마찬가지입니다. (재사용 대기시간 ${sec(stats.attackCooldown)}초)`;
        }
        if (stats.attackType === 'throw_projectile') {
            const noun = stats.attackProjectileNoun
                || (stats.element === '불' ? '불꽃' : stats.element === '빛' ? '버블티 펄' : '물방울');
            return `${noun}(${stats.attackProjectileRadius * 2}px)을 전방으로 던져 최대 ${stats.attackRange}px까지 날리고, 맞은 적에게 ${stats.attackDamage}의 피해를 줍니다.`
                + ` 실제로 날아가기 때문에 빗나갈 수도 있습니다. (재사용 대기시간 ${sec(stats.attackCooldown)}초)`;
        }
        if (stats.attackType === 'homing_burst') {
            return `빛의 구슬 ${stats.attackProjectileCount}개를 부채꼴로 ${stats.attackProjectileStaggerMs / 1000}초 간격으로 하나씩 쏩니다. 구슬은 저마다 가장 가까운 적을 스스로 쫓아가며, 맞으면 1개당 ${stats.attackDamage}의 피해를 줍니다.`
                + ` 최대 ${stats.attackRange}px까지 날아가고, 그 안에 목표를 따라잡지 못하면 빗나갑니다. (재사용 대기시간 ${sec(stats.attackCooldown)}초)`;
        }
        let text = `전방 ${stats.attackRange}px 범위를 공격해 ${stats.attackDamage}의 피해를 줍니다. (재사용 대기시간 ${sec(stats.attackCooldown)}초)`;
        if (stats.attackHealOnUse && stats.attackHealChance !== undefined) {
            text += ` 적중 시 ${Math.round(stats.attackHealChance * 100)}% 확률로 팀 전체를 ${stats.attackHealOnUse}만큼 회복시킵니다.`;
        }
        if (stats.attackKnockback) {
            text += ` 적을 ${stats.attackKnockback}px 밀쳐냅니다.`;
        }
        return text;
    }
    if (kind === 'skill') {
        const cd = ` (재사용 대기시간 ${sec(stats.skillCooldown)}초)`;
        switch (stats.skillType) {
            case 'team_heal_over_time':
                return `조준 없이 즉시 발동합니다. ${sec(stats.skillDurationMs)}초 동안 ${sec(stats.skillTickMs)}초마다 팀 전체를 ${stats.skillHealPerTick}만큼 회복시킵니다.${cd}`;
            case 'spin_kick':
                return `제자리에서 회전하며 반경 ${stats.skillRange}px 내의 적에게 ${stats.skillDamage}의 피해를 줍니다.${cd}`;
            case 'speed_boost':
                return `${sec(stats.skillSpeedDurationMs)}초 동안 이동 속도가 ${stats.skillSpeedValue}배 빨라집니다.${cd}`;
            case 'spin_heal':
                return `${sec(stats.skillDurationMs)}초 동안 회전하며 반경 ${stats.skillRadius}px 내의 적에게 ${stats.skillDamage}의 피해를 주고, 적중하면 팀 전체를 ${stats.skillHealOnHit}만큼 회복시킵니다.${cd}`;
            case 'guard_stance':
                return `방패를 들어 방어 태세에 들어갑니다. 공격하거나 ${sec(stats.skillDurationMs)}초가 지나면 풀리며, 유지되는 동안 받는 피해가 ${Math.round(stats.skillDamageMultiplier * 100)}%로 줄어듭니다.${cd}`;
            case 'lava_burst':
                return `용암을 뿜어 반경 ${stats.skillRange}px 내의 적에게 ${stats.skillDamage}의 피해를 줍니다.${cd}`;
            case 'flying_kick':
                return `전방 ${stats.skillRange}px 범위의 적을 걷어차 ${sec(stats.skillStunMs)}초 동안 기절시킵니다. 기절한 동안 상대는 아무 행동도 할 수 없습니다.${cd}`;
            case 'kick':
                return `전방 ${stats.skillRange}px 범위의 적에게 ${stats.skillDamage}의 피해를 줍니다.${cd}`;
            case 'self_heal':
                return `자신의 체력을 ${stats.skillHealAmount}만큼 회복합니다.${cd}`;
            case 'shield_block':
                return `방패를 들어 막습니다. ${sec(stats.skillDurationMs)}초 동안 받는 피해가 ${Math.round(stats.skillDamageMultiplier * 100)}%로 줄어들며, 공격해도 풀리지 않습니다.${cd}`;
            case 'earthquake':
                return `땅을 흔들어 지진을 일으킵니다. 적이 ${stats.skillThresholdCount}명 이하면 모든 적에게 ${stats.skillDamage}의 피해를 주고, 그보다 많으면 가장 가까운 적 한 명을 즉시 쓰러뜨립니다.${cd}`;
            case 'blink_heal':
                return `직접 지정한 위치로 순간이동하면서 자신의 최대 체력`
                    + ` ${Math.round(stats.skillHealRatio * 100)}%를 회복합니다. 피해도 표식도 없습니다.${cd}`;
            case 'mark_burst':
                return `떨어뜨릴 위치를 직접 지정해 물방울을 터뜨립니다. 반경 ${stats.skillRadius}px 안의 적에게 ${stats.element} 속성 표식을 ${stats.skillMarkUses}번 부여합니다. 피해는 없습니다.${cd}`;
            case 'burrow_mark':
                return `땅을 파고 직접 지정한 위치로 이동합니다. 나온 자리 반경 ${stats.skillRadius}px 안의 적에게 ${stats.element} 속성 표식을 ${stats.skillMarkUses}번 부여합니다. 피해는 없습니다.${cd}`;
            case 'pull_in':
                return `반경 ${stats.skillRange}px 안의 적을 끌어당깁니다. 움직일 수 있는 적은 자신 옆으로 끌려오고, 제자리에 고정된 적은 끌려오지 않는 대신 ${stats.skillDamage}의 피해를 입습니다.${cd}`;
            case 'wide_slash':
                return `전방을 크게 벤니다. 가로 ${stats.skillWidth}px, 전방 ${stats.skillRange}px 범위의 적에게 ${stats.skillDamage}의 피해를 주고, 한 명이라도 맞히면 팀 전체를 ${stats.skillHealOnHit}만큼 회복시킵니다.${cd}`;
            case 'charge_dash':
                return `전방으로 빠르게 돌진해 최대 ${stats.skillRange}px까지 달려가 부딪칩니다. 맞은 적에게 ${stats.skillDamage}의 피해를 주고, 그 뒤 ${sec(stats.skillSpeedDurationMs)}초 동안 이동 속도가 ${stats.skillSpeedBonus} 빨라집니다.${cd}`;
            case 'mark_punch':
                // 버블티맛처럼 표식을 터뜨리는 게 아니라 쌓기만 하는 쪽은
                // skillMarkBurstDamage가 아예 없다 -- 그 경우엔 burst 문단을 뺀다.
                if (!stats.skillMarkBurstDamage) {
                    return `앞으로 아주 큰 것을 던져 전방 ${stats.skillRange}px(가로 ${stats.skillWidth}px) 범위의 적을 관통하며 ${stats.skillDamage}의 피해를 줍니다.`
                        + ` 맞은 적 전부에게 ${stats.element} 속성 표식을 ${stats.skillMarkUses}개씩 박습니다.${cd}`;
                }
                return [
                    `앞으로 주먹을 질러 전방 ${stats.skillRange}px(가로 ${stats.skillWidth}px) 범위의 적을 ${stats.skillDamage}만큼 때립니다.`,
                    `맞은 적에게 ${stats.element} 속성 표식을 ${stats.skillMarkUses}개 박고, 그 적에게 쌓여 있던 표식을 전부 터뜨립니다.`,
                    `터진 표식 한 개당 ${stats.skillMarkBurstDamage}의 추가 피해 (한 번에 최대 ${stats.skillMarkBurstMax}개).`,
                    `표식이 하나도 없어도 방금 박은 ${stats.skillMarkUses}개는 터지므로 최소 ${stats.skillDamage + stats.skillMarkUses * stats.skillMarkBurstDamage}, 꽉 쌓이면 ${stats.skillDamage + stats.skillMarkBurstMax * stats.skillMarkBurstDamage}입니다.${cd}`
                ].join('\n');
            case 'tide_cycle':
                return tideCycleText(stats, sec);
            case 'body_swap':
                return `상체와 하체를 서로 바꿉니다. 피해도 표식도 없습니다.`
                    + ` 상체는 체력 ${stats.upperHealth} · 공격력 ${stats.upperAttackDamage}, 하체는 체력 ${stats.lowerHealth} · 공격력 ${stats.lowerAttackDamage}이고,`
                    + ` 두 몸은 체력을 각각 따로 가지고 있어 나갔다 들어와도 그대로입니다. 합체 중에는 쓸 수 없습니다.${cd}`;
            case 'life_burst':
                return `조준 없이 즉시 발동합니다. 자신의 체력을 최대 체력의 ${Math.round(stats.skillHealRatio * 100)}%만큼 채우고,`
                    + ` 반경 ${stats.skillRadius}px 내의 적 전부에게 ${stats.skillDamage}의 피해를 줍니다.${cd}`;
            case 'self_guard_surge':
                return `방패로 막습니다. 자신의 체력을 ${stats.skillHealAmount}만큼 채우고, 자신에게만 ${stats.skillShieldAmount}짜리 보호막을 씌웁니다.${cd}`;
            case 'freeze_burst':
                return `조준 없이 즉시 발동합니다. 반경 ${stats.skillRange}px 내의 적을 얼려 ${sec(stats.skillFreezeMs)}초 동안 아무 행동도 못 하게 하고, 적중 여부와 상관없이 자신의 체력을 ${stats.skillSelfHeal}만큼 채웁니다.${cd}`;
            case 'sea_hide':
                return `조준 없이 즉시 바다로 숨어듭니다. ${sec(stats.skillDurationMs)}초 동안 아무 공격도 받지 않고 자신도 공격할 수 없으며, 그동안 체력을 ${stats.skillHealAmount}만큼 채웁니다.${cd}`;
            case 'water_drag':
                return `직접 지정한 위치를 물속으로 끌고 들어갑니다. 반경 ${stats.skillRadius}px 안에 적이 있으면 ${sec(stats.skillStunMs)}초 동안 기절시킵니다. 피해는 없습니다.${cd}`;
            default:
                return '스킬 정보가 없습니다.';
        }
    }
    if (kind === 'ultimate') {
        // 바다펄맛처럼 궁극기 칸이 아예 비어 있는 쿠키가 있다.
        if (!stats.ultimateType) {
            return stats.skillType === 'tide_cycle'
                ? '궁극기가 없습니다. 특수스킬 자리의 밀물이 곧 궁극기입니다.'
                : '궁극기가 없습니다.';
        }
        const cd = ` (재사용 대기시간 ${sec(stats.ultimateCooldownMs)}초)`;
        switch (stats.ultimateType) {
            case 'team_heal_over_time':
                return `${sec(stats.ultimateDurationMs)}초 동안 ${sec(stats.ultimateTickMs)}초마다 팀 전체를 ${stats.ultimateHealPerTick}만큼 회복시킵니다.${cd}`;
            case 'targeted_aoe':
                return `원하는 지점을 지정해 반경 ${stats.ultimateRadius}px 내의 적에게 ${stats.ultimateDamage}의 피해를 줍니다.${cd}`;
            case 'attack_heal_boost':
                return `${sec(stats.ultimateDurationMs)}초 동안 기본 공격이 적중할 때마다 팀 전체를 ${stats.ultimateHealPerAttack}만큼 회복시킵니다.${cd}`;
            case 'awakening':
                return `각성 상태가 되어 ${sec(stats.ultimateDurationMs)}초 동안 이동 속도가 ${stats.ultimateSpeedMultiplier}배가 되고, 받는 피해가 ${Math.round(stats.ultimateDamageMultiplier * 100)}%로 줄어들며, 공격력이 ${stats.ultimateAttackDamage}로 증가합니다. 체력을 ${stats.ultimateSelfHeal}만큼 즉시 회복합니다.${cd}`;
            case 'magma_zone':
                return `지정한 위치에 마그마를 떨어뜨려 반경 ${stats.ultimateRadius}px에 화염 표식을 남깁니다. ${sec(stats.ultimateZoneDurationMs)}초 동안 ${sec(stats.ultimateZoneTickMs)}초마다 ${stats.ultimateZoneDamagePerTick}의 피해를 줍니다.${cd}`;
            case 'dumpling_zone':
                return `지정한 위치에 치즈만두 덩어리를 떨어뜨립니다. 반경 ${stats.ultimateRadius}px 안의 적은`
                    + ` ${sec(stats.ultimateZoneDurationMs)}초 동안 ${sec(stats.ultimateZoneTickMs)}초마다 ${stats.ultimateZoneDamagePerTick}의 피해를 입고,`
                    + ` 그때마다 ${stats.element} 속성 표식을 ${stats.ultimateZoneMarkUses}개씩 받습니다.${cd}`;
            case 'element_mark':
                return `${sec(stats.ultimateDurationMs)}초 동안 기본 공격이 적중할 때마다 대상에게 속성 표식을 남깁니다. 표식이 있는 동안 같은 속성의 캐릭터가 공격하면 피해가 ${stats.ultimateMarkMultiplier}배가 되고, 표식은 ${stats.ultimateMarkUses}회 사용되면 사라집니다. 표식은 중첩됩니다.${cd}`;
            case 'body_fuse':
                return `상체와 하체를 하나로 합칩니다. ${sec(stats.ultimateDurationMs)}초 동안 체력이 두 몸을 합친 것이 되고`
                    + ` (지금 나온 몸의 체력 + 쉬고 있던 몸의 체력), 공격력이 ${stats.ultimateAttackDamage}가 됩니다.`
                    + ` 시간이 다 되면 저절로 풀리며, 풀리는 순간 상체·풀피로 돌아옵니다.${cd}`;
            case 'awakening_rapid': {
                // 오렌지 레몬맛은 자동 발차기가 붙지만, 버블티맛처럼 재사용
                // 대기시간만 줄이는 쪽은 ultimateAutoKickEvery 자체가 없다.
                const kickText = stats.ultimateAutoKickEvery
                    ? ` ${stats.ultimateAutoKickEvery}번째 공격마다 자동으로 발차기(피해 ${stats.skillDamage})가 나갑니다.`
                    : '';
                const bonusText = stats.instinctUltimateRapidAttackBonus
                    ? ` 그동안 기본 공격 피해가 ${stats.instinctUltimateRapidAttackBonus}만큼 늘어납니다.`
                    : '';
                return `${sec(stats.ultimateDurationMs)}초 동안 기본 공격의 재사용 대기시간이 ${stats.ultimateRapidCooldown / 1000}초로 줄어듭니다.${kickText}${bonusText}${cd}`;
            }
            case 'team_shield':
                return `팀원 모두에게 ${stats.ultimateShieldAmount}만큼의 피해를 막아주는 보호막을 씌웁니다. 보호막이 받는 피해를 모두 흡수하면 사라집니다.${cd}`;
            case 'team_hot_shield':
                return `팀원 모두에게 ${stats.ultimateShieldAmount}짜리 보호막을 즉시 씌우고, ${sec(stats.ultimateDurationMs)}초 동안 ${sec(stats.ultimateTickMs)}초마다 ${stats.ultimateHealPerTick}만큼 팀 전체를 회복시킵니다.${cd}`;
            case 'dash_guard': {
                const zoneText = stats.ultimateZoneDamagePerTick
                    ? ` 도착한 자리에는 ${sec(stats.ultimateZoneDurationMs)}초 동안 불 지대가 생겨, 그 안의 적에게 ${sec(stats.ultimateZoneTickMs)}초마다 ${stats.ultimateZoneDamagePerTick}의 피해를 줍니다.`
                    : '';
                return `조준 없이 지금 보는 방향으로 최대 ${stats.ultimateRange}px까지 빠르게 돌진합니다(피해 없음).`
                    + ` 팀 전체에게 ${stats.ultimateShieldAmount}짜리 보호막을 씌우고 체력을 ${stats.ultimateHealAmount}만큼 회복시킵니다.${zoneText}${cd}`;
            }
            case 'undying_soul': {
                const summon = stats.ultimateSummon;
                const minions = summon
                    ? ` 또한 ${stats.ultimateSummonCount}마리의 부하를 불러냅니다. 부하는 체력 ${summon.health},`
                      + ` 이동 속도 ${summon.speed}로 스스로 가장 가까운 적에게 다가가 ${sec(summon.attackCooldown)}초마다 ${summon.attackDamage}의 피해를 주며,`
                      + ` 적에게 맞으면 쓰러지고 궁극기가 끝나면 사라집니다.`
                    : '';
                return `죽지 않는 영혼을 불러내 체력을 최대 체력의 ${Math.round(stats.ultimateHealRatio * 100)}%만큼 회복합니다. ${sec(stats.ultimateDurationMs)}초 동안 이동 속도가 ${stats.ultimateSpeedBonus} 빨라지고 기본 공격 피해가 ${stats.ultimateAttackDamage}가 됩니다.${minions}${cd}`;
            }
            case 'lightning_strike':
                return `원하는 지점에 번개를 내려 반경 ${stats.ultimateRadius}px 내의 적에게 ${stats.ultimateDamage}의 피해를 줍니다. 맞은 적은 ${sec(stats.ultimateStunMs)}초 동안 기절하고, ${sec(stats.ultimateDebuffDurationMs)}초 동안 주는 피해가 ${stats.ultimateDamageDebuffMultiplier}배로 줄어듭니다.${cd}`;
            case 'mark_flood':
                return `직접 지정한 위치에 폭포를 떨어뜨립니다. 반경 ${stats.ultimateRadius}px 안의 적은 ${sec(stats.ultimateMarkDurationMs)}초 동안 횟수 제한 없이 ${stats.element} 속성 표식을 받고, 그 동안 같은 속성의 공격은 피해가 ${stats.ultimateMarkMultiplier}배가 됩니다.${cd}`;
            case 'magma_pour':
                return `직접 지정한 위치에 마그마를 쏟습니다. 반경 ${stats.ultimateRadius}px 안의 적에게 ${stats.ultimateDamage}의 피해를 주고, ${sec(stats.ultimateMarkDurationMs)}초 동안 횟수 제한 없이 ${stats.element} 속성 표식을 남깁니다.${cd}`;
            case 'guard_surge':
                return `팀 전체에게 ${stats.ultimateShieldAmount}짜리 보호막을 씌우고 체력을 ${stats.ultimateHealAmount}만큼 회복시킵니다.${cd}`;
            case 'team_guard':
                return `팀원 모두의 체력을 최대 체력의 ${Math.round(stats.ultimateHealRatio * 100)}%만큼 회복시키고, ${stats.ultimateShieldAmount}짜리 보호막을 씨워줍니다.${cd}`;
            case 'great_slash':
                return `${sec(stats.ultimateWindupMs)}초 예열 뒤 전방 ${stats.ultimateRange}px를 엄청 크게(가로 ${stats.ultimateWidth}px)`
                    + ` 베어 ${stats.ultimateDamage}의 피해를 줍니다. 적중하면 최대 체력의`
                    + ` ${Math.round(stats.ultimateHealRatio * 100)}%를 회복하고, ${sec(stats.ultimateSpeedDurationMs)}초 동안`
                    + ` 이동 속도가 ${stats.ultimateSpeedBonus} 빨라집니다.${cd}`;
            case 'butterfly_mode':
                return `나비모드가 됩니다. 이동 속도가 ${stats.ultimateSpeedBonus} 빨라지고 기본 공격 피해가 ${stats.ultimateAttackDamage}가 됩니다. 지속 시간은 없지만 ${sec(stats.ultimateSelfDamageIntervalMs)}초마다 자신의 체력을 ${stats.ultimateSelfDamage}씩 깎습니다. 궁극기 버튼을 한 번 더 누르면 해제되며, 해제한 순간부터 ${sec(stats.ultimateCooldownMs)}초가 카운트됩니다.`;
            case 'sky_slam':
                return `원하는 지점을 지정하면 그 자리로 날아올랐다가 ${sec(stats.ultimateWindupMs)}초 뒤 떨어집니다.`
                    + ` 착지 반경 ${stats.ultimateRadius}px 내의 적에게 ${stats.ultimateDamage}의 피해를 주고,`
                    + ` 적중하면 ${sec(stats.ultimateAttackBuffDurationMs)}초 동안 공격력이 ${stats.ultimateAttackBuff} 오르며 최대 체력의 ${Math.round(stats.ultimateHealRatioOnHit * 100)}%를 회복합니다.${cd}`;
            case 'targeted_line_aoe':
                return `원하는 위치를 지정합니다. 원이 아니라 가로 ${stats.ultimateWidth}px, 세로 ${stats.ultimateHeight}px의 긴 띠 범위에 ${stats.ultimateDamage}의 피해를 주고, 그 한 방으로 맞힌 적의 수만큼 팀 전체를 각각 ${stats.ultimateHealPerEnemy}씩 회복시킵니다.${cd}`;
            case 'fire_line_zone':
                return `조준 없이 지금 보고 있는 방향으로 전방 ${stats.ultimateRange}px(가로 ${stats.ultimateWidth}px)`
                    + ` 화염지대를 깝니다. ${sec(stats.ultimateZoneDurationMs)}초 동안 유지되며,`
                    + ` 그 안의 적은 ${sec(stats.ultimateZoneTickMs)}초마다 ${stats.ultimateZoneDamagePerTick}의 화염 피해를 입고,`
                    + ` 자신이 그 안에 있으면 ${sec(stats.ultimateZoneTickMs)}초마다 체력을 ${stats.ultimateZoneSelfHealPerTick}만큼 회복합니다.`
                    + ` 그 안에 있는 적을 기본 공격으로 맞히면 화염 피해가 ${stats.ultimateZoneAttackBonusBurn} 더 붙습니다.${cd}`;
            case 'nature_awaken':
                return [
                    `쓸 때마다 1→2→3단계, 그다음 다시 1단계로 돌아갑니다.`,
                    `1단계 · ${sec(stats.ultimateDurationMs)}초 동안 기본 공격의 재사용 대기시간이 ${stats.ultimateRapidCooldown / 1000}초로 줄어듭니다.`,
                    `2단계 · 1단계 효과에 더해 ${sec(stats.ultimateDurationMs)}초 동안 이동 속도가 ${stats.ultimateLevel2SpeedBonus} 빨라지고, 기본 공격이 적중할 때마다 팀 전체를 ${stats.ultimateHealPerAttack}만큼 회복시킵니다.`,
                    `3단계 · 조준 없이 즉시 발동합니다. 팀 중 죽은 캐릭터가 있으면 하나를 부활시키고, 없으면 마법진을 열어 팀 전체 체력을 100%로 채우고 적 체력의 ${Math.round((stats.ultimateSanctuaryEnemyDamageRatio || 0) * 100)}%를 깎습니다.${cd}`
                ].join('\n');
            default:
                return '궁극기 정보가 없습니다.';
        }
    }
    return '';
}

// 속성표식 라벨. 청사과맛처럼 횟수가 있는 표식은 "x3"으로, 폭포나
// 마그마 쏟기처럼 시간짜리 표식은 남은 초로 보여준다.
function elementMarkLabel(mark) {
    if (!mark || !mark.element) return '';
    const icon = ELEMENT_ICONS[mark.element] || '✨';
    if (mark.until) {
        const left = (mark.until - Date.now()) / 1000;
        return left > 0 ? `${icon} ${left.toFixed(1)}초` : ''; // lapsed: stop drawing it
    }
    if (!mark.charges) return '';
    return `${icon} x${mark.charges}`;
}

const ELEMENT_ICONS = { '바람': '🌪️', '불': '🔥', '어둠': '🌑', '물': '💧', '빛': '✨' };

// 바닥에 깔리는 지대는 지금 두 가지다 -- 화산맛의 마그마(주황)와 치즈만두맛의
// 만두 덩어리(노랑/초록). 서버가 look으로 어느 쪽인지 알려 준다.
function zoneColors(look) {
    return look === 'dumpling'
        ? { fill: 'rgba(39, 174, 96, 0.28)', stroke: 'rgba(244, 208, 63, 0.9)' }
        : { fill: 'rgba(230, 81, 0, 0.25)', stroke: 'rgba(255, 152, 0, 0.85)' };
}

// 불꽃요정맛 궁극기: 원형이 아니라 사각형(길고 넓은) 지대라서 magmaZones와는
// 따로 그린다. guest_raid.js도 같은 페이지에 얹혀 전역으로 공유되므로 여기
// 한 곳에만 정의한다.
function drawFireLineZones(c, zones, now) {
    zones.forEach(z => {
        const pulse = Math.sin(now / 150) * 0.05;
        c.save();
        c.translate(z.x, z.y);
        c.rotate(z.facing);
        c.fillStyle = `rgba(230, 81, 0, ${0.25 + pulse})`;
        c.fillRect(0, -z.width / 2, z.range, z.width);
        c.strokeStyle = 'rgba(255, 152, 0, 0.85)';
        c.lineWidth = 3;
        c.strokeRect(0, -z.width / 2, z.range, z.width);
        c.restore();
    });
}

// Split-color icon background so similarly-colored cookies stay tellable
// apart at a glance -- a hard 50/50 split, not a blend.
function charIconBackground(stats) {
    if (stats.colorLeft && stats.colorRight) {
        return `linear-gradient(90deg, ${stats.colorLeft} 50%, ${stats.colorRight} 50%)`;
    }
    return stats.color;
}

// Same body/weapon drawing the game canvas uses (drawCookieBody/
// drawCharacterWeapon from player.js), rendered onto a portrait <canvas> so
// the big "look at your cookie" spots (lobby centrepiece, character detail)
// show the held weapon too -- CSS-only .char-icon-circle spots elsewhere
// still use charIconBackground and don't show it.
// The body is drawn well under half the canvas (not edge-to-edge like the
// old CSS circle) because weapons draw OUTSIDE the body radius -- a hook or
// spear needs real room to the side or it just gets clipped by the canvas
// edge again, which was the original bug report.
function drawCharIconCanvas(canvas, stats) {
    const size = canvas.width;
    const R = size * 0.2;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    drawCookieBody(ctx, R, stats, true);
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(2, R * 0.08);
    ctx.strokeStyle = '#f1c40f';
    ctx.stroke();
    drawCharacterWeapon(ctx, R, stats, true);
    ctx.restore();
}

// 본능해제 탭에서 좌우 화살표로 훑어보는 중인 강화 단계. 실제 보유 레벨과는
// 별개다 -- 탭에 처음 들어올 때만 보유 레벨(없으면 1강)로 되돌아간다.
let instinctViewLevel = 1;

function selectCharDetailAbility(kind) {
    const stats = statsWithGear(viewingCharacterId);
    if (kind === 'instinct') {
        instinctViewLevel = Math.max(1, instinctLevelOfChar(viewingCharacterId));
        renderInstinctBrowse();
    } else {
        charDetailDesc.textContent = describeAbility(stats, kind);
    }
    charDetailInstinctRow.classList.toggle('hidden', kind !== 'instinct');
    charDetailInstinctNav.classList.toggle('hidden', kind !== 'instinct');
    [
        [charDetailAttackIcon, 'attack'],
        [charDetailSkillIcon, 'skill'],
        [charDetailUltimateIcon, 'ultimate'],
        [charDetailPassiveIcon, 'passive'],
        [charDetailInstinctIcon, 'instinct']
    ].forEach(([el, k]) => el.classList.toggle('selected', k === kind));
}

// instinctViewLevel이 가리키는 단계의 설명을 보여준다. 보유한 레벨보다 높은
// 단계를 보는 중이면 라벨을 회색으로(아직 안 배운 강화라는 뜻) 표시한다.
function renderInstinctBrowse() {
    const charType = viewingCharacterId;
    const actualLevel = instinctLevelOfChar(charType);
    charDetailDesc.textContent = instinctLevelDesc(charType, instinctViewLevel);
    charDetailInstinctNavLabel.textContent = `${instinctViewLevel}강`;
    charDetailInstinctNavLabel.classList.toggle('locked', instinctViewLevel > actualLevel);
    charDetailInstinctPrevBtn.disabled = instinctViewLevel <= 1;
    charDetailInstinctNextBtn.disabled = instinctViewLevel >= SHARED.INSTINCT_MAX_LEVEL;
}

charDetailInstinctPrevBtn.addEventListener('click', () => {
    if (instinctViewLevel <= 1) return;
    instinctViewLevel--;
    renderInstinctBrowse();
});
charDetailInstinctNextBtn.addEventListener('click', () => {
    if (instinctViewLevel >= SHARED.INSTINCT_MAX_LEVEL) return;
    instinctViewLevel++;
    renderInstinctBrowse();
});

charDetailAttackIcon.addEventListener('click', () => selectCharDetailAbility('attack'));
charDetailSkillIcon.addEventListener('click', () => selectCharDetailAbility('skill'));
charDetailUltimateIcon.addEventListener('click', () => selectCharDetailAbility('ultimate'));
charDetailPassiveIcon.addEventListener('click', () => selectCharDetailAbility('passive'));
charDetailInstinctIcon.addEventListener('click', () => selectCharDetailAbility('instinct'));

const SKILL_ICONS = {
    melee_kick: '🗡',
    spin_kick: '🌀',
    speed_boost: '💨',
    spin_heal: '🌿',
    team_heal_over_time: '💚',
    targeted_aoe: '💥',
    attack_heal_boost: '✨',
    guard_stance: '🛡',
    awakening: '🔥',
    lava_burst: '🌋',
    magma_zone: '♨️',
    flying_kick: '🦵',
    element_mark: '🌪️',
    alternating_punch: '👊',
    kick: '🦶',
    awakening_rapid: '⚡',
    self_heal: '💗',
    team_shield: '🔰',
    combo_two_stage: '⚔',
    shield_block: '🛡',
    lightning_strike: '⚡',
    dual_spear: '🔱',
    undying_soul: '👻',
    earthquake: '🌎',
    throw_projectile: '💧',
    mark_burst: '💦',
    mark_flood: '🌊',
    burrow_mark: '⛏️',
    magma_pour: '🌋',
    pull_in: '🧲',
    guard_surge: '💠',
    wide_slash: '🪓',
    team_guard: '🫂',
    charge_dash: '🏃',
    butterfly_mode: '🦋',
    vampire_slash: '🗡',
    blink_heal: '💫',
    great_slash: '⚔️',
    tide_cycle: '🌊',
    mark_punch: '🥊',
    dumpling_zone: '🥟',
    body_swap: '🔄',
    body_fuse: '🔗',
    life_burst: '🩸',
    sky_slam: '🌠',
    self_guard_surge: '🛡️',
    fire_line_zone: '🔥',
    homing_burst: '🔮',
    freeze_burst: '❄️',
    targeted_line_aoe: '✨',
    sea_hide: '🌊',
    team_hot_shield: '🛡️',
    nature_awaken: '🍃'
};

// A few skills need a second small glyph pinned to a corner of the icon
// (e.g. a fire badge on a shield) rather than two characters crammed into
// one string. Keyed the same as SKILL_ICONS; only entries that need a badge
// appear here.
const SKILL_ICON_BADGES = {
    self_guard_surge: '🔥'
};
function skillIconHtml(key, fallback) {
    const base = SKILL_ICONS[key] || fallback;
    const badge = SKILL_ICON_BADGES[key];
    return badge ? `${base}<span class="skill-icon-badge">${badge}</span>` : base;
}
const detailCharIcon = document.getElementById('detail-char-icon');
const detailCharName = document.getElementById('detail-char-name');
const detailChangeCharBtn = document.getElementById('detail-change-char-btn');
const detailBossName = document.getElementById('detail-boss-name');
const detailBossIcon = document.getElementById('detail-boss-icon');
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
const myShieldBadge = document.getElementById('my-shield-badge');
const mySkillCdEl = document.getElementById('my-skill-cd');
const myUltimateCdEl = document.getElementById('my-ultimate-cd');
const partnerHpContainer = document.getElementById('partner-hp-container');
const partnerHpBar = document.getElementById('partner-hp-bar');
const partnerShieldBadge = document.getElementById('partner-shield-badge');
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

// ---- Mobile touch controls (joystick + action buttons) ----
// A device-local UI preference, not part of gameData -- deliberately kept
// out of the cloud-synced save so it doesn't jump between a phone and a
// desktop session under the same account.
// 조이스틱(터치 조작)과 화면 크기 조정(휴대폰용 축소 레이아웃)은 서로 독립된
// 설정이다 -- 예전엔 하나의 토글("모바일 조작")이 둘 다 겸했지만, 큰 태블릿에서
// 조이스틱만 쓰거나 데스크톱 창을 좁게 열어 축소 레이아웃만 보고 싶은 경우처럼
// 따로 켜고 싶을 수 있어 분리했다.
const MOBILE_CONTROLS_KEY = 'boss_raid_mobile_controls';
const COMPACT_MODE_KEY = 'boss_raid_compact_mode';
const AUTO_AIM_KEY = 'boss_raid_auto_aim'; // same reasoning: device-local, not cloud-synced
let mobileControlsEnabled = localStorage.getItem(MOBILE_CONTROLS_KEY) === '1';
let compactModeEnabled = localStorage.getItem(COMPACT_MODE_KEY) === '1';
let autoAimEnabled = localStorage.getItem(AUTO_AIM_KEY) === '1';
const controlsJoystickBtn = document.getElementById('controls-joystick-btn');
const controlsJoystickStatus = document.getElementById('controls-joystick-status');
const controlsCompactBtn = document.getElementById('controls-compact-btn');
const controlsCompactStatus = document.getElementById('controls-compact-status');
const controlsAutoAimBtn = document.getElementById('controls-autoaim-btn');
const controlsAutoAimStatus = document.getElementById('controls-autoaim-status');
const controlsAutoAimHint = document.getElementById('controls-autoaim-hint');
const controlsBackBtn = document.getElementById('controls-back-btn');
const mobileControlsFight = document.getElementById('mobile-controls-fight');
const mobileControlsStory = document.getElementById('mobile-controls-story');
const mcSkillFightEl = document.getElementById('mc-skill-fight');
const mcUltimateFightEl = document.getElementById('mc-ultimate-fight');
const mcAttackFightEl = document.getElementById('mc-attack-fight');
const mcSkillStoryEl = document.getElementById('mc-skill-story');
const mcUltimateStoryEl = document.getElementById('mc-ultimate-story');
const mcAttackStoryEl = document.getElementById('mc-attack-story');
const mcSkillCdFightEl = mcSkillFightEl.querySelector('.mc-cd');
const mcUltimateCdFightEl = mcUltimateFightEl.querySelector('.mc-cd');
const mcSkillCdStoryEl = mcSkillStoryEl.querySelector('.mc-cd');
const mcUltimateCdStoryEl = mcUltimateStoryEl.querySelector('.mc-cd');

// The mobile attack button auto-aims by design, so mobile controls force
// auto-aim on. This is what everything else asks instead of reading
// autoAimEnabled directly.
function autoAimActive() {
    return mobileControlsEnabled || autoAimEnabled;
}

function updateControlsScreen() {
    controlsJoystickStatus.textContent = mobileControlsEnabled ? '켜짐' : '꺼짐';
    controlsJoystickStatus.classList.toggle('on', mobileControlsEnabled);
    controlsCompactStatus.textContent = compactModeEnabled ? '켜짐' : '꺼짐';
    controlsCompactStatus.classList.toggle('on', compactModeEnabled);

    const aimOn = autoAimActive();
    controlsAutoAimStatus.textContent = aimOn ? '켜짐' : '꺼짐';
    controlsAutoAimStatus.classList.toggle('on', aimOn);
    // While the joystick is on, auto-aim can't be switched off -- the mobile
    // attack button has no other way to aim -- so the row goes unclickable.
    controlsAutoAimBtn.disabled = mobileControlsEnabled;
    controlsAutoAimBtn.classList.toggle('locked', mobileControlsEnabled);
    controlsAutoAimHint.textContent = mobileControlsEnabled
        ? '조이스틱을 켜면 자동조준은 항상 켜져 있어요. 끄려면 먼저 조이스틱을 꺼주세요.'
        : '켜면 조준할 필요 없이 클릭만 해도 가장 가까운 적을 자동으로 조준해서 공격해요.';
}
function applyMobileControlsVisibility() {
    if (!mobileControlsFight) return;
    mobileControlsFight.classList.toggle('hidden', !mobileControlsEnabled);
    mobileControlsStory.classList.toggle('hidden', !mobileControlsEnabled);
    const guestControls = document.getElementById('mobile-controls-guest');
    if (guestControls) guestControls.classList.toggle('hidden', !mobileControlsEnabled);
    const zombieControls = document.getElementById('mobile-controls-zombie');
    if (zombieControls) zombieControls.classList.toggle('hidden', !mobileControlsEnabled);
    document.body.classList.toggle('mc-touch', mobileControlsEnabled);
}
function applyCompactModeVisibility() {
    document.body.classList.toggle('mc-compact', compactModeEnabled);
}
updateControlsScreen();
applyMobileControlsVisibility(); // restore the saved preference on load
applyCompactModeVisibility();
controlsJoystickBtn.addEventListener('click', () => {
    mobileControlsEnabled = !mobileControlsEnabled;
    localStorage.setItem(MOBILE_CONTROLS_KEY, mobileControlsEnabled ? '1' : '0');
    updateControlsScreen();
    applyMobileControlsVisibility();
});
controlsCompactBtn.addEventListener('click', () => {
    compactModeEnabled = !compactModeEnabled;
    localStorage.setItem(COMPACT_MODE_KEY, compactModeEnabled ? '1' : '0');
    updateControlsScreen();
    applyCompactModeVisibility();
    // window.resize는 토글 자체로는 안 일어나므로, 켜고 끄는 순간 바로
    // 반영되게 직접 다시 불러 준다. (초기 로드 시점엔 이 두 캔버스가 아직
    // 선언 전이라 여기서만 부른다 -- resizeStoryCanvas 자체 정의부 끝에 있는
    // 최초 호출이 로드시 값은 이미 챙긴다.)
    resizeStoryCanvas();
    if (typeof resizeZombieCanvas === 'function') resizeZombieCanvas();
});
controlsAutoAimBtn.addEventListener('click', () => {
    if (mobileControlsEnabled) return; // locked on; see updateControlsScreen
    autoAimEnabled = !autoAimEnabled;
    localStorage.setItem(AUTO_AIM_KEY, autoAimEnabled ? '1' : '0');
    updateControlsScreen();
});
controlsBackBtn.addEventListener('click', () => showScreen('lobby'));

// Movement used to be routed through the same keys{} object WASD feeds,
// snapped to 8 directions -- but that meant any push angle off the 8 exact
// headings got redirected away from where the thumb was actually pointing,
// so the character rarely walked exactly where the stick aimed and effective
// progress toward a target felt slower than keyboard. Now the joystick drives
// movement directly from the raw push angle (any of 360 degrees, not just 8),
// while still remembering the angle for aiming since there's no mouse on touch.
let joystickFacing = null;
let storyJoystickFacing = null;
let joystickMoveVec = null; // {x, y} unit vector, or null when centered
let storyJoystickMoveVec = null;
function applyJoystickAngle(angle, isStory) {
    const vec = angle === null ? null : { x: Math.cos(angle), y: Math.sin(angle) };
    if (isStory) { storyJoystickFacing = angle; storyJoystickMoveVec = vec; }
    else { joystickFacing = angle; joystickMoveVec = vec; }
}

function setupJoystick(zoneEl, isStory) {
    const thumbEl = zoneEl.querySelector('.mc-joystick-thumb');
    const maxR = 45;
    let activePointerId = null;
    let originX = 0, originY = 0;
    function handleMove(clientX, clientY) {
        let dx = clientX - originX;
        let dy = clientY - originY;
        const dist = Math.hypot(dx, dy);
        if (dist > maxR) { dx = dx / dist * maxR; dy = dy / dist * maxR; }
        thumbEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        const mag = Math.min(1, dist / maxR);
        applyJoystickAngle(mag > 0.25 ? Math.atan2(dy, dx) : null, isStory);
    }
    zoneEl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        activePointerId = e.pointerId;
        zoneEl.setPointerCapture(e.pointerId);
        const rect = zoneEl.getBoundingClientRect();
        originX = rect.left + rect.width / 2;
        originY = rect.top + rect.height / 2;
        handleMove(e.clientX, e.clientY);
    });
    zoneEl.addEventListener('pointermove', (e) => {
        if (e.pointerId !== activePointerId) return;
        handleMove(e.clientX, e.clientY);
    });
    function release(e) {
        if (e.pointerId !== activePointerId) return;
        activePointerId = null;
        thumbEl.style.transform = 'translate(-50%, -50%)';
        applyJoystickAngle(null, isStory);
    }
    zoneEl.addEventListener('pointerup', release);
    zoneEl.addEventListener('pointercancel', release);
}
setupJoystick(document.getElementById('mc-joystick-fight'), false);
setupJoystick(document.getElementById('mc-joystick-story'), true);

function mcTap(el, handler) {
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); handler(); });
}
mcTap(mcSkillFightEl, () => tryUseSkill());
mcTap(mcSkillStoryEl, () => tryStoryUseSkill());

// Aiming by hand on a touchscreen is fiddly, so the attack button auto-aims:
// it snaps the character to face the nearest live target before swinging.
// Returns the chosen angle, or null when there's nothing to aim at (then the
// current facing is kept).
function nearestTargetAngle(x, y, isStory) {
    if (!isStory) return Math.atan2(-y, -x); // boss raid: the boss is always at the origin
    let best = null, bestDist = Infinity;
    for (const m of Object.values(storyMonsters)) {
        if (!m.alive) continue;
        const d = Math.hypot(m.x - x, m.y - y);
        if (d < bestDist) { bestDist = d; best = m; }
    }
    return best ? Math.atan2(best.y - y, best.x - x) : null;
}

// The server judges hits against the facing it last received, so the auto-aimed
// facing has to reach it BEFORE the attack does.
function fireAutoAimedAttack(isStory) {
    if (isStory) {
        if (!storyPlayer || !storyPlayer.alive) return;
        const angle = nearestTargetAngle(storyPlayer.x, storyPlayer.y, true);
        if (angle !== null) storyPlayer.facing = angle;
        socket.emit('storyPlayerMove', { x: storyPlayer.x, y: storyPlayer.y, facing: storyPlayer.facing });
        tryStoryAttack();
    } else {
        const me = players[socket.id];
        if (!me || !me.alive) return;
        const angle = nearestTargetAngle(me.x, me.y, false);
        if (angle !== null) me.facing = angle;
        socket.emit('playerMove', { x: me.x, y: me.y, facing: me.facing });
        tryAttack();
    }
}
mcTap(mcAttackFightEl, () => fireAutoAimedAttack(false));
mcTap(mcAttackStoryEl, () => fireAutoAimedAttack(true));

// The ultimate control is a joystick for the cookies whose ultimate needs a
// position (targeted_aoe / magma_zone): drag to pick where it lands, release to
// cast. For every other cookie it behaves as a plain button. `ultimateAim` is
// the current push as a fraction of the stick's travel, which maps to distance.
let ultimateAim = null;        // {angle, mag} | null -- boss raid
let storyUltimateAim = null;   // {angle, mag} | null -- story
const ULTIMATE_AIM_MAX_RANGE = 260; // px at full stick deflection

function ultimateNeedsAim(isStory) {
    if (isStory) {
        if (!storyPlayer) return false;
        const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
        return isTargetedUltimate(stats.ultimateType);
    }
    const me = players[socket.id];
    return !!me && isTargetedUltimate(me.stats.ultimateType);
}

function setupUltimateJoystick(zoneEl, isStory) {
    const thumbEl = zoneEl.querySelector('.mc-aim-thumb');
    const maxR = 30;
    let activePointerId = null;
    let originX = 0, originY = 0;
    let aim = null;

    function update(clientX, clientY) {
        let dx = clientX - originX;
        let dy = clientY - originY;
        const dist = Math.hypot(dx, dy);
        const clamped = Math.min(dist, maxR);
        if (dist > maxR) { dx = dx / dist * maxR; dy = dy / dist * maxR; }
        thumbEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        aim = dist > 6 ? { angle: Math.atan2(dy, dx), mag: clamped / maxR } : null;
        if (isStory) storyUltimateAim = aim; else ultimateAim = aim;
    }

    zoneEl.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        activePointerId = e.pointerId;
        zoneEl.setPointerCapture(e.pointerId);
        const rect = zoneEl.getBoundingClientRect();
        originX = rect.left + rect.width / 2;
        originY = rect.top + rect.height / 2;
        // Only show the aiming preview for ultimates that actually take a spot,
        // and only while it's off cooldown.
        if (ultimateNeedsAim(isStory) && (isStory ? storyCanUseUltimate(performance.now())
                                                 : !!players[socket.id] && players[socket.id].canUseUltimate(performance.now()))) {
            zoneEl.classList.add('aiming');
            update(e.clientX, e.clientY);
        }
    });
    zoneEl.addEventListener('pointermove', (e) => {
        if (e.pointerId !== activePointerId) return;
        if (!zoneEl.classList.contains('aiming')) return;
        update(e.clientX, e.clientY);
    });
    function release(e) {
        if (e.pointerId !== activePointerId) return;
        activePointerId = null;
        thumbEl.style.transform = 'translate(-50%, -50%)';
        zoneEl.classList.remove('aiming');
        castUltimateFromStick(aim, isStory);
        aim = null;
        if (isStory) storyUltimateAim = null; else ultimateAim = null;
    }
    zoneEl.addEventListener('pointerup', release);
    zoneEl.addEventListener('pointercancel', release);
}

// Where a stick push lands the zone. A tap (no push) drops it just ahead of the
// player, matching mobileUltimateTarget.
// Dashed landing circle for a targeted ultimate. Passing the caster's position
// also draws a guide line from them to the spot, which is what makes the
// stick-aimed cast readable.
// 크게베기. 예열 동안은 벤 자리가 흐리게 차오르고, 베는 순간 확 밝아졌다가
// 짧게 사라진다. 예고가 보여야 피할 틈이 생긴다.

// 부하(번개지옥맛 궁극기). 작은 노란 몸에 얼굴 방향 표시와 체력 고리.
// 내 부하는 테두리를 밝게 해서 남의 것과 구분한다.
function drawSummons(c, summons, mySocketId) {
    Object.values(summons || {}).forEach(s => {
        const R = SHARED.SUMMON_RADIUS;
        c.save();
        c.translate(s.x, s.y);
        c.rotate(s.facing || 0);
        // 뾰족한 앞코: 어디를 보고 있는지 알 수 있게.
        c.beginPath();
        c.moveTo(R + 6, 0);
        c.lineTo(R - 3, -6);
        c.lineTo(R - 3, 6);
        c.closePath();
        c.fillStyle = '#f39c12';
        c.fill();
        c.restore();

        c.save();
        c.translate(s.x, s.y);
        c.beginPath();
        c.arc(0, 0, R, 0, Math.PI * 2);
        c.fillStyle = '#f1c40f';
        c.fill();
        c.strokeStyle = s.ownerId === mySocketId ? '#fff' : '#7f8c8d';
        c.lineWidth = 2;
        c.stroke();
        // 체력 고리: 남은 만큼만 노랗게 돈다.
        const pct = Math.max(0, Math.min(1, s.hp / (s.maxHp || 1)));
        c.beginPath();
        c.arc(0, 0, R + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
        c.strokeStyle = 'rgba(46, 204, 113, 0.9)';
        c.lineWidth = 3;
        c.stroke();
        c.restore();
    });
}

function drawGreatSlashes(c, slashes, now) {
    slashes.forEach(g => {
        const age = now - (g.until - g.windupMs - 250);
        const charging = age < g.windupMs;
        const t = charging ? age / g.windupMs : 1 - (age - g.windupMs) / 250;
        c.save();
        c.translate(g.x, g.y);
        c.rotate(g.facing);
        c.fillStyle = charging
            ? `rgba(155, 89, 182, ${0.10 + 0.25 * t})`
            : `rgba(230, 126, 34, ${0.55 * Math.max(0, t)})`;
        c.fillRect(0, -g.width / 2, g.range, g.width);
        c.strokeStyle = charging
            ? `rgba(186, 104, 200, ${0.5 + 0.4 * t})`
            : `rgba(255, 214, 165, ${Math.max(0, t)})`;
        c.lineWidth = 3;
        c.strokeRect(0, -g.width / 2, g.range, g.width);
        c.restore();
    });
}

// 던져진 물방울(또는 불꽃). Drawn straight from the throw: its velocity never
// changes, so the client can place it exactly without a per-tick sync from
// the server. charType가 불 속성이면(불꽃요정맛) 물방울 대신 불꽃으로 그린다.
function isFireProjectile(charType) {
    const stats = charType && SHARED.CHARACTERS[charType];
    return !!(stats && stats.element === '불');
}
// 쿠키맛쿠키의 빛의 구슬, 버블티맛의 펄처럼 물/불 어느 쪽도 아닌 빛 속성
// 투사체는 금빛으로 그린다.
function isLightProjectile(charType) {
    const stats = charType && SHARED.CHARACTERS[charType];
    return !!(stats && stats.element === '빛');
}
// 바람궁수맛의 초록 화살처럼 attackProjectileTheme을 따로 적어 둔 투사체는
// 속성과 상관없이 그 테마 색으로 그린다 (빛 속성인데 금빛이 아니어야 하는 경우).
function isWindProjectile(charType) {
    const stats = charType && SHARED.CHARACTERS[charType];
    return !!(stats && stats.attackProjectileTheme === 'wind');
}
function drawThrownDrops(c, drops, now) {
    Object.values(drops).forEach(d => {
        const t = (now - d.at) / 1000;
        const x = d.x + d.vx * t;
        const y = d.y + d.vy * t;
        const r = d.radius || 10;
        const wind = isWindProjectile(d.charType);
        const fire = !wind && isFireProjectile(d.charType);
        const light = !wind && !fire && isLightProjectile(d.charType);
        c.save();
        c.translate(x, y);
        const grad = c.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.2, 0, 0, r);
        if (wind) {
            grad.addColorStop(0, '#eafff0');
            grad.addColorStop(0.5, '#58d68d');
            grad.addColorStop(1, '#1e8449');
        } else if (fire) {
            grad.addColorStop(0, '#fff3c4');
            grad.addColorStop(0.5, '#ff8a3d');
            grad.addColorStop(1, '#c0392b');
        } else if (light) {
            grad.addColorStop(0, '#fffdf0');
            grad.addColorStop(0.5, '#ffe58a');
            grad.addColorStop(1, '#e8a33d');
        } else {
            grad.addColorStop(0, '#eaf8ff');
            grad.addColorStop(1, '#1f6fb2');
        }
        c.beginPath();
        c.arc(0, 0, r, 0, Math.PI * 2);
        c.fillStyle = grad;
        c.fill();
        c.strokeStyle = (fire || light || wind) ? 'rgba(255, 214, 165, 0.9)' : 'rgba(255,255,255,0.85)';
        c.lineWidth = 2;
        c.stroke();
        c.restore();
    });
}

// The splash where one landed (or fizzled out).
function drawDropSplashes(c, splashes, now) {
    splashes.forEach(s => {
        const life = (s.until - now) / 260;
        const wind = isWindProjectile(s.charType);
        const fire = !wind && isFireProjectile(s.charType);
        const light = !wind && !fire && isLightProjectile(s.charType);
        c.beginPath();
        c.arc(s.x, s.y, 8 + (1 - life) * 16, 0, Math.PI * 2);
        c.strokeStyle = wind
            ? `rgba(88, 214, 141, ${Math.max(0, life)})`
            : fire
                ? `rgba(255, 138, 61, ${Math.max(0, life)})`
                : (light ? `rgba(255, 229, 138, ${Math.max(0, life)})` : `rgba(127, 212, 245, ${Math.max(0, life)})`);
        c.lineWidth = 3;
        c.stroke();
    });
}

// 쿠키맛쿠키 궁극기 조준: 원이 아니라 가로로 긴 직사각형이라 미리보기도 따로.
function drawUltimateLinePreview(c, x, y, width, height) {
    c.save();
    c.setLineDash([8, 6]);
    c.strokeStyle = 'rgba(142, 68, 173, 0.9)';
    c.lineWidth = 2;
    c.strokeRect(x - width / 2, y - height / 2, width, height);
    c.setLineDash([]);
    c.fillStyle = 'rgba(142, 68, 173, 0.15)';
    c.fillRect(x - width / 2, y - height / 2, width, height);
    c.restore();
}

function drawUltimatePreview(c, x, y, radius, fromX, fromY) {
    c.save();
    c.setLineDash([8, 6]);
    if (fromX !== undefined) {
        c.beginPath();
        c.moveTo(fromX, fromY);
        c.lineTo(x, y);
        c.strokeStyle = 'rgba(142, 68, 173, 0.55)';
        c.lineWidth = 2;
        c.stroke();
    }
    c.beginPath();
    c.arc(x, y, radius, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(142, 68, 173, 0.9)';
    c.lineWidth = 2;
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = 'rgba(142, 68, 173, 0.15)';
    c.fill();
    c.restore();
}

function ultimateAimPoint(x, y, facing, stats, aim) {
    if (!aim) return mobileUltimateTarget(x, y, facing, stats);
    const dist = Math.max(stats.ultimateRadius || 90, aim.mag * ULTIMATE_AIM_MAX_RANGE);
    return { targetX: x + Math.cos(aim.angle) * dist, targetY: y + Math.sin(aim.angle) * dist };
}

function castUltimateFromStick(aim, isStory) {
    if (isStory) {
        if (!storyPlayer) return;
        const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
        if (!isTargetedUltimate(stats.ultimateType)) { storyHandleUltimateKey(); return; }
        if (!storyCanUseUltimate(performance.now())) return;
        storyPlayer.lastUltimateClientTime = performance.now();
        socket.emit('storyPlayerUltimate',
            ultimateAimPoint(storyPlayer.x, storyPlayer.y, storyPlayer.facing, stats, aim));
    } else {
        const me = players[socket.id];
        if (!me) return;
        if (!isTargetedUltimate(me.stats.ultimateType)) { handleUltimateKey(); return; }
        if (!me.canUseUltimate(performance.now())) return;
        me.markUltimateUsed();
        socket.emit('playerUltimate', ultimateAimPoint(me.x, me.y, me.facing, me.stats, aim));
    }
}

setupUltimateJoystick(mcUltimateFightEl, false);
setupUltimateJoystick(mcUltimateStoryEl, true);

// Buttons show the selected cookie's own ability icons, matching the icon row
// on the character detail screen.
function syncMobileButtonIcons(charType, isStory) {
    const stats = SHARED.CHARACTERS[charType] || SHARED.CHARACTERS.kicker;
    const attackEl = isStory ? mcAttackStoryEl : mcAttackFightEl;
    const skillEl = isStory ? mcSkillStoryEl : mcSkillFightEl;
    const ultEl = isStory ? mcUltimateStoryEl : mcUltimateFightEl;
    const cdSkill = isStory ? mcSkillCdStoryEl : mcSkillCdFightEl;
    const cdUlt = isStory ? mcUltimateCdStoryEl : mcUltimateCdFightEl;
    attackEl.innerHTML = skillIconHtml(stats.attackType, '⚔');
    skillEl.innerHTML = skillIconHtml(stats.skillType, '🌀');
    skillEl.appendChild(cdSkill);
    // The ultimate control is an aim joystick, so its icon lives on the thumb --
    // writing to the zone itself would wipe the base/thumb elements.
    const ultThumb = ultEl.querySelector('.mc-aim-thumb');
    ultThumb.innerHTML = skillIconHtml(stats.ultimateType, '🔥');
    ultThumb.appendChild(cdUlt);
}

// Mirrors the text cooldown readouts into the buttons themselves, and dims a
// button while its ability is still recharging.
// noUltimate면 궁극기 버튼 자체를 숨긴다 (바다펄맛).
function syncMobileCooldowns(skillRemain, ultRemain, isStory, noUltimate) {
    if (!mobileControlsEnabled) return;
    const cdSkill = isStory ? mcSkillCdStoryEl : mcSkillCdFightEl;
    const cdUlt = isStory ? mcUltimateCdStoryEl : mcUltimateCdFightEl;
    const skillEl = isStory ? mcSkillStoryEl : mcSkillFightEl;
    const ultEl = isStory ? mcUltimateStoryEl : mcUltimateFightEl;
    cdSkill.textContent = skillRemain > 0.05 ? skillRemain.toFixed(1) : '';
    cdUlt.textContent = ultRemain > 0.05 ? ultRemain.toFixed(1) : '';
    skillEl.classList.toggle('recharging', skillRemain > 0.05);
    ultEl.classList.toggle('recharging', ultRemain > 0.05);
    ultEl.classList.toggle('hidden', !!noUltimate);
}

// ---- Character select ----
// Keeps both places the selection is shown in sync: the lobby's bottom-left
// button and the lobby centrepiece.
function updateSelectedCharLabel() {
    const stats = SHARED.CHARACTERS[gameData.selectedCharacter] || SHARED.CHARACTERS.kicker;
    selectedCharNameEl.textContent = stats.shortName || stats.name;
    drawCharIconCanvas(lobbyCharBody, stats);
    lobbyCharName.textContent = stats.name;
}
updateSelectedCharLabel();

let characterReturnScreen = 'lobby'; // where "뒤로"/selecting a character sends you back to

// Normally picking a cookie changes the lobby selection. A screen that needs a
// cookie for something else -- the guest raid's four party slots -- sets this
// instead, so the same 캐릭터 선택 → 상세 → 선택 flow can fill any slot.
// { selectedId, onPick(id) }
let characterPickTarget = null;

function openCharacterSelect(returnScreen, pickTarget) {
    characterReturnScreen = returnScreen;
    characterPickTarget = pickTarget || null;
    renderCharacterList();
    showScreen('characterSelect');
}

// 이 자리가 등급 제한이 있으면(레전드 스토리 파티 2·3번째 자리 등) 그 등급
// 초과인 쿠키는 소유 여부와 상관없이 이 자리에는 고를 수 없다.
function characterAllowedForPickTarget(stats) {
    const cap = characterPickTarget && characterPickTarget.maxGrade;
    if (!cap) return true;
    return SHARED.GRADE_ORDER.indexOf(stats.grade) <= SHARED.GRADE_ORDER.indexOf(cap);
}

// Highest grade first; within a grade the most recently added cookie comes
// first, which is its position in the CHARACTERS roster (appended in order).
function charactersByGradeDesc() {
    const order = Object.keys(SHARED.CHARACTERS);
    return Object.entries(SHARED.CHARACTERS).sort(([idA, a], [idB, b]) => {
        const ga = SHARED.GRADE_ORDER.indexOf(a.grade);
        const gb = SHARED.GRADE_ORDER.indexOf(b.grade);
        if (ga !== gb) return gb - ga;
        return order.indexOf(idB) - order.indexOf(idA);
    });
}

function renderCharacterList() {
    characterListEl.innerHTML = '';
    const currentId = characterPickTarget ? characterPickTarget.selectedId : gameData.selectedCharacter;
    const cap = characterPickTarget && characterPickTarget.maxGrade;
    characterSelectHintEl.classList.toggle('hidden', !cap);
    if (cap) characterSelectHintEl.textContent = `이 자리는 ${cap} 등급까지만 데려갈 수 있습니다.`;
    charactersByGradeDesc().forEach(([id, stats]) => {
        const unlocked = isCharacterUnlocked(id) && characterAllowedForPickTarget(stats);
        const card = document.createElement('div');
        card.className = 'boss-card' + (unlocked ? '' : ' locked') + (id === currentId ? ' selected' : '');
        const iconHtml = unlocked
            ? `<div class="icon char-swatch" style="background: ${charIconBackground(stats)}"></div>`
            : `<div class="icon">🔒</div>`;
        card.innerHTML = `${iconHtml}<div class="name">${stats.name}</div>`;
        if (unlocked) card.addEventListener('click', () => openCharacterDetail(id));
        characterListEl.appendChild(card);
    });
}

characterSelectBtn.addEventListener('click', () => openCharacterSelect('lobby'));
backFromCharacterBtn.addEventListener('click', () => {
    characterPickTarget = null;
    showScreen(characterReturnScreen);
});

// ---- Character detail (appearance/equipment preview before confirming a pick) ----
let viewingCharacterId = null;

// Not every cookie has a single flat attackDamage: multi-hit attacks list each
// hit instead, which is why 에이션트/레전더리 cookies showed nothing before.
function attackDamageText(stats) {
    if (Array.isArray(stats.attackStages)) {
        return stats.attackStages.map(s => s.damage).join(' / ');
    }
    if (stats.attackDamageRight != null && stats.attackDamageLeft != null) {
        return `${stats.attackDamageRight} / ${stats.attackDamageLeft}`;
    }
    return stats.attackDamage != null ? String(stats.attackDamage) : '-';
}

// ---- 장비 고르기 ----
let equipPickerSlot = null;

function openEquipPicker(slot) {
    const slotDef = equipSlotsFor(viewingCharacterId).find(s => s.key === slot);
    if (!slotDef || !viewingCharacterId) return;
    showEquipPickerMsg('', false);
    equipPickerSlot = slot;
    equipPickerTitle.textContent = `${slotDef.icon} ${slotDef.name}`;
    renderEquipPicker();
    equipPicker.classList.remove('hidden');
}

function closeEquipPicker() {
    equipPickerSlot = null;
    equipPicker.classList.add('hidden');
}

// 강화 결과 한 줄. 성공이면 초록, 실패/부족이면 빨강.
function showEquipPickerMsg(text, good) {
    if (!equipPickerMsg) return;
    equipPickerMsg.textContent = text || '';
    equipPickerMsg.classList.toggle('hidden', !text);
    equipPickerMsg.classList.toggle('good', !!good);
}

// 강화에 쓰는 것만 추려서 창 위에 보여준다.
function renderEquipPickerPurse() {
    if (!equipPickerPurse) return;
    equipPickerPurse.innerHTML = ['coins', 'material', 'materialRare', 'potion', 'potionRare']
        .map(k => `<span class="equip-purse-pill" title="${CURRENCY_LABELS[k]}">${CURRENCY_ICONS[k]} ${currencyText(k)}</span>`)
        .join('');
}

function renderEquipPicker() {
    renderEquipPickerPurse();
    const charType = viewingCharacterId;
    const worn = equippedOf(charType);
    const rows = inventoryItems()
        .map(entry => ({ entry, item: SHARED.equipmentFor(entry.itemId) }))
        .filter(r => r.item && r.item.slot === equipPickerSlot);

    equipPickerUnequip.classList.toggle('hidden', !worn[equipPickerSlot]);

    if (!rows.length) {
        equipPickerList.innerHTML = `<p class="equip-picker-empty">가지고 있는 ${
            (equipSlotsFor(viewingCharacterId).find(s => s.key === equipPickerSlot) || {}).name || ''
        } 장비가 없습니다. 스토리나 보스를 깨면 떨어집니다.</p>`;
        return;
    }

    equipPickerList.innerHTML = rows.map(({ entry, item }) => {
        const lv = entry.level || 0;
        const cost = SHARED.equipUpgradeCost(item, lv);
        const isOn = worn[equipPickerSlot] === entry.uid;
        const otherOwner = !isOn && wornBy(entry.uid);
        let ownerLine = '';
        if (item.ownerChar) {
            // 각성 장비처럼 능력치가 아니라 수치를 바꾸는 전용 효과도 있으므로
            // ownerBonus가 있는지가 아니라 "주인이 맞는지"로 판단한다.
            const active = item.ownerChar === charType;
            const ownerName = (SHARED.CHARACTERS[item.ownerChar] || {}).name || item.ownerChar;
            ownerLine = `<div class="equip-item-owner${active ? '' : ' inactive'}">${
                active ? item.ownerText : `${ownerName} 전용 — 이 쿠키에게는 발동하지 않습니다`
            }</div>`;
        }
        const wornLine = otherOwner
            ? `<div class="equip-item-worn">${(SHARED.CHARACTERS[otherOwner] || {}).name || otherOwner}가 착용 중 — 가져오면 벗겨집니다</div>`
            : '';
        const upgradeLine = cost
            ? `<div class="equip-upgrade">
                    <button class="equip-up-btn" data-uid="${entry.uid}" data-potion="0">🔨 강화 <span class="equip-up-cost">${upgradeCostText(cost, false)}</span></button>
                    <button class="equip-up-btn potion" data-uid="${entry.uid}" data-potion="1">✨ 포션 강화 <span class="equip-up-cost">${upgradeCostText(cost, true)}</span></button>
               </div>`
            : '<div class="equip-upgrade"><span class="equip-up-max">최대 강화</span></div>';
        return `
            <div class="equip-item${isOn ? ' equipped' : ''}" data-uid="${entry.uid}">
                <span class="equip-item-icon">${item.icon}</span>
                <span class="equip-item-main">
                    <div class="equip-item-name">${item.name} <span class="equip-item-lv">Lv${lv}</span> <span class="${gradeClass(item.grade)}">${item.grade}</span></div>
                    <div class="equip-item-stats">${equipStatText(mergedEquipStats(item, lv, charType)) || '능력치 없음'}</div>
                    ${ownerLine}${wornLine}
                    ${upgradeLine}
                </span>
                ${isOn ? '<span class="equip-item-worn">착용 중</span>' : ''}
            </div>`;
    }).join('');
}

equipPickerList.addEventListener('click', (e) => {
    const upBtn = e.target.closest('.equip-up-btn');
    if (upBtn) {
        // 강화 버튼을 눌렀을 때는 장착까지 되지 않게 여기서 끝낸다.
        e.stopPropagation();
        const res = upgradeEquip(Number(upBtn.dataset.uid), upBtn.dataset.potion === '1');
        showEquipPickerMsg(res.msg, res.ok && res.success);
        renderEquipPicker();
        if (viewingCharacterId) openCharacterDetail(viewingCharacterId);
        return;
    }
    const row = e.target.closest('.equip-item');
    if (!row || !equipPickerSlot) return;
    equipItem(viewingCharacterId, Number(row.dataset.uid));
    closeEquipPicker();
    openCharacterDetail(viewingCharacterId);
});

equipPickerUnequip.addEventListener('click', () => {
    if (!equipPickerSlot) return;
    unequipSlot(viewingCharacterId, equipPickerSlot);
    closeEquipPicker();
    openCharacterDetail(viewingCharacterId);
});

equipPickerClose.addEventListener('click', closeEquipPicker);
equipPicker.addEventListener('click', (e) => { if (e.target === equipPicker) closeEquipPicker(); });

charDetailSlotEls.forEach(el => {
    el.addEventListener('click', () => openEquipPicker(el.dataset.slot));
});

// 장착한 장비를 슬롯에 썬다.
function renderCharDetailEquipment(charType) {
    const worn = equippedOf(charType);
    const allowed = equipSlotsFor(charType).map(s => s.key);
    charDetailSlotEls.forEach(el => {
        if (!allowed.includes(el.dataset.slot)) { el.classList.add('hidden'); return; }
        if (el.dataset.slot !== 'awaken') el.classList.remove('hidden');
        const entry = bagEntry(worn[el.dataset.slot]);
        const item = entry && SHARED.equipmentFor(entry.itemId);
        const valueEl = el.querySelector('.equip-value');
        valueEl.textContent = item ? item.name : '-';
        valueEl.classList.toggle('empty', !item);
        el.classList.toggle('filled', !!item);
    });
}

function openCharacterDetail(id) {
    viewingCharacterId = id;
    const stats = statsWithGear(id);
    drawCharIconCanvas(charDetailIcon, stats);
    charDetailName.textContent = stats.name;
    charDetailGrade.textContent = stats.grade || '-';
    charDetailGrade.className = gradeClass(stats.grade);
    charDetailElement.textContent = stats.element || '-';
    charDetailRole.textContent = stats.role || '-';
    const bonus = equipBonusOf(id);
    const instinctBonus = SHARED.instinctStatBonus(instinctLevelOfChar(id));
    const atkBonus = bonus.attack + instinctBonus.attack;
    const hpBonus = bonus.health + instinctBonus.health;
    charDetailAtk.innerHTML = attackDamageText(stats)
        + (atkBonus ? `<span class="cd-stat-bonus">+${atkBonus}</span>` : '');
    charDetailHp.innerHTML = (stats.health != null ? stats.health : '-')
        + (hpBonus ? `<span class="cd-stat-bonus">+${hpBonus}</span>` : '');
    // 지금까지 비어 있던 헤더의 숫자: 장비+본능해제를 포함한 공격력+체력 합산.
    charDetailPower.textContent = String(
        (Number(String(attackDamageText(stats)).split(' / ')[0]) || 0) + atkBonus
        + (stats.health || 0) + hpBonus);
    charDetailAwakenSlot.classList.toggle('hidden', !SHARED.hasAwakenSlot(stats.grade));
    renderCharDetailEquipment(id);
    charDetailAttackIcon.innerHTML = skillIconHtml(stats.attackType, '🗡');
    charDetailSkillIcon.innerHTML = skillIconHtml(stats.skillType, '❔');
    charDetailUltimateIcon.innerHTML = skillIconHtml(stats.ultimateType, '❔');
    charDetailPassiveIcon.classList.toggle('empty', !hasPassive(stats));
    renderCharDetailInstinct(id);
    selectCharDetailAbility('attack');
    showScreen('characterDetail');
}

// 본능해제 패널: 아이콘의 레벨 배지와 다음 강화 비용·버튼을 그린다.
// 설명 텍스트 자체는 selectCharDetailAbility('instinct')가 공용 desc 박스에 그린다.
function renderCharDetailInstinct(charType) {
    const level = instinctLevelOfChar(charType);
    charDetailInstinctBadge.textContent = `${level}강`;
    const cost = SHARED.instinctNextCost(level);
    const have = gameData.soulStones[charType] || 0;
    const nextLevel = level + 1;
    if (cost == null || !instinctNextLevelReady(charType, nextLevel)) {
        // 최대 강화이거나, 3강 이상인데 그 캐릭터의 효과가 아직 없다.
        charDetailInstinctCostEl.textContent = cost == null ? '' : `${nextLevel}강 — 준비 중`;
        charDetailInstinctBtn.disabled = true;
        charDetailInstinctBtn.textContent = cost == null ? '최대 강화' : '준비 중';
    } else {
        charDetailInstinctCostEl.textContent = `💎 ${have} / ${cost}`;
        charDetailInstinctBtn.disabled = have < cost;
        charDetailInstinctBtn.textContent = `${nextLevel}강 (영혼석 ${cost})`;
    }
}

charDetailInstinctBtn.addEventListener('click', () => {
    if (!viewingCharacterId) return;
    if (upgradeInstinct(viewingCharacterId)) {
        openCharacterDetail(viewingCharacterId);
        selectCharDetailAbility('instinct');
    }
});

charDetailBackBtn.addEventListener('click', () => showScreen('characterSelect'));

charDetailSelectBtn.addEventListener('click', () => {
    if (characterPickTarget) {
        const target = characterPickTarget;
        characterPickTarget = null;
        target.onPick(viewingCharacterId);
        showScreen(characterReturnScreen);
        return;
    }
    gameData.selectedCharacter = viewingCharacterId;
    saveGameData(gameData);
    updateSelectedCharLabel();
    if (characterReturnScreen === 'bossDetail') updateDetailCharPreview();
    else if (characterReturnScreen === 'storyTower') renderTower();
    else if (characterReturnScreen === 'zombieDetail' && typeof updateZombieDetailCharPreview === 'function') updateZombieDetailCharPreview();
    showScreen(characterReturnScreen);
});

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
    item: '아직 판매 중인 아이템이 없습니다.'
};

// ---- 현질 (계좌이체 -> 구매 신청 -> 관리자 확인 후 지급) ----
const IAP_BANK_INFO = { bank: '카카오뱅크', account: '7777-03-9029488' };
const IAP_PACKAGES = [
    { key: 'iapDiamonds5000', name: '다이아 5000개', icon: '💎', priceKrw: 1000, desc: '다이아 5000개를 지급합니다.' },
    { key: 'iapTicketNormal260', name: '일반 뽑기 티켓 260장', icon: '🏷️', priceKrw: 1000, desc: '일반 뽑기 티켓 260장을 지급합니다.' },
    {
        key: 'iapRandomCharBox', name: '랜덤 캐릭터 상자', icon: '🎁', priceKrw: 2000,
        desc: '에픽 40% · 레전더리 30% · 비스트 20% · 게스트 10% 확률로 캐릭터 하나를 지급합니다. 이미 보유 중인 캐릭터가 나오면 그 캐릭터의 영혼석 30개로 대신 지급됩니다.'
    }
];
const IAP_STATUS_LABELS = { pending: '심사중', approved: '지급완료', rejected: '거절됨' };

function iapResultText(r) {
    if (!r.result) return '';
    const name = SHARED.CHARACTERS[r.result.character]?.name || r.result.character;
    return r.result.duplicate ? `→ ${name} 보유 중, 영혼석 30개 지급` : `→ ${name} 지급`;
}

async function loadMyPurchaseRequests() {
    const listEl = document.getElementById('iap-history-list');
    if (!listEl) return;
    if (!currentUser) { listEl.innerHTML = ''; return; }
    try {
        const { data, error } = await sb.rpc('br_my_purchase_requests', { p_token: currentUser.session_token });
        if (error) throw error;
        if (!data || !data.length) {
            listEl.innerHTML = '<p class="shop-empty">신청 내역이 없습니다.</p>';
            return;
        }
        listEl.innerHTML = data.map(r => {
            const pkg = IAP_PACKAGES.find(p => p.key === r.package_key);
            return `<div class="iap-history-row iap-status-${r.status}">
                <span class="iap-history-name">${pkg ? pkg.name : r.package_key}</span>
                <span class="iap-history-price">₩${r.price_krw.toLocaleString()}</span>
                <span class="iap-history-status">${IAP_STATUS_LABELS[r.status] || r.status}</span>
                ${r.status === 'approved' && r.result ? `<span class="iap-history-result">${iapResultText(r)}</span>` : ''}
            </div>`;
        }).join('');
    } catch (e) {
        listEl.innerHTML = '<p class="shop-empty">내역을 불러오지 못했습니다.</p>';
    }
}

async function submitIapPurchase(key) {
    const pkg = IAP_PACKAGES.find(p => p.key === key);
    const msgEl = document.getElementById('shop-item-msg');
    const depositorInput = document.getElementById('iap-depositor-input');
    if (!pkg || !currentUser) return;
    const depositor = (depositorInput?.value || '').trim();
    if (!depositor) {
        if (msgEl) { msgEl.textContent = '입금자명을 입력해주세요.'; msgEl.classList.remove('hidden', 'good'); }
        return;
    }
    try {
        const { error } = await sb.rpc('br_submit_purchase_request', {
            p_token: currentUser.session_token, p_package_key: key, p_depositor_name: depositor
        });
        if (error) throw error;
        if (msgEl) {
            msgEl.textContent = `${pkg.name} 구매 신청이 접수되었습니다. 입금 확인 후 지급됩니다.`;
            msgEl.classList.remove('hidden');
            msgEl.classList.add('good');
        }
        loadMyPurchaseRequests();
    } catch (e) {
        if (msgEl) { msgEl.textContent = '신청에 실패했습니다.'; msgEl.classList.remove('hidden', 'good'); }
    }
}

function renderIapTab() {
    shopContent.classList.add('shop-content-list');
    if (!currentUser) {
        shopContent.classList.remove('shop-content-list');
        shopContent.innerHTML = `<p class="shop-empty">현질은 계정 로그인 후 이용할 수 있습니다.<br>☰ 메뉴 → 계정에서 로그인해주세요.</p>`;
        return;
    }
    shopContent.innerHTML = `
        <div class="iap-bank-info">
            <div class="iap-bank-title">입금 계좌</div>
            <div class="iap-bank-line">${IAP_BANK_INFO.bank} ${IAP_BANK_INFO.account}</div>
            <div class="iap-bank-hint">먼저 상품 가격만큼 입금한 뒤, 입금하신 분 성함을 아래에 입력하고 구매 신청을 눌러주세요. 입금 확인 후 지급됩니다.</div>
            <input id="iap-depositor-input" class="iap-depositor-input" type="text" placeholder="입금자명">
        </div>
        ${IAP_PACKAGES.map(p => `
            <div class="shop-item-card" data-key="${p.key}">
                <span class="shop-item-icon">${p.icon}</span>
                <span class="shop-item-name">${p.name}<div class="iap-item-desc">${p.desc}</div></span>
                <button class="shop-item-buy-btn iap-buy-btn">₩${p.priceKrw.toLocaleString()}</button>
            </div>`).join('')}
        <p id="shop-item-msg" class="shop-item-msg hidden"></p>
        <div class="iap-history">
            <div class="iap-history-title">내 신청 내역</div>
            <div id="iap-history-list" class="iap-history-list">불러오는 중...</div>
        </div>
    `;
    loadMyPurchaseRequests();
}
// 다이아로 사는 것들. category: 상점의 어느 탭('item'|'currency')에 카드로 뜨는지.
// grantsTo: 사면 어디로 들어가는지 -- 'currencies'(기본)면 바로 재화로, 'items'면
// 아이템창(gameData.items)에 들어가서 나중에 "사용" 버튼으로 쓴다.
const SHOP_ITEMS = [
    { key: 'ticketNormal', cost: 200, costCurrency: 'diamonds', category: 'item', grantsTo: 'currencies' },
    { key: 'ticketDemon', cost: 300, costCurrency: 'diamonds', category: 'item', grantsTo: 'currencies' },
    { key: 'soulStoneChoice', cost: 500, costCurrency: 'diamonds', category: 'currency', grantsTo: 'items' },
    { key: 'randomLegendaryGear', cost: 1000, costCurrency: 'diamonds', category: 'currency', grantsTo: 'items' }
];

function shopGoodName(item) {
    return item.grantsTo === 'items' ? SHARED.ITEMS[item.key].name : (CURRENCY_LABELS[item.key] || item.key);
}
function shopGoodIcon(item) {
    return item.grantsTo === 'items' ? SHARED.ITEMS[item.key].icon : (CURRENCY_ICONS[item.key] || '🎁');
}
function shopGoodOwnedText(item) {
    return item.grantsTo === 'items' ? String(itemCount(item.key)) : currencyText(item.key);
}

function buyShopItem(key) {
    const item = SHOP_ITEMS.find(it => it.key === key);
    if (!item) return { ok: false, msg: '판매 중이 아닙니다.' };
    if (currencyAmount(item.costCurrency) < item.cost) {
        return { ok: false, msg: `${CURRENCY_LABELS[item.costCurrency] || item.costCurrency}가 부족합니다.` };
    }
    if (!adminPowerOn('currencies')) grantCurrencies({ [item.costCurrency]: -item.cost });
    if (item.grantsTo === 'items') grantItems({ [item.key]: 1 });
    else grantCurrencies({ [item.key]: 1 });
    return { ok: true, msg: `${shopGoodName(item)}을(를) 구매했습니다.` };
}

function renderShopCategory(key) {
    Object.entries(shopCatButtons).forEach(([k, btn]) => btn.classList.toggle('selected', k === key));
    if (key === 'iap') { renderIapTab(); return; }
    const goods = SHOP_ITEMS.filter(it => it.category === key);
    shopContent.classList.toggle('shop-content-list', goods.length > 0);
    if (goods.length) {
        shopContent.innerHTML = goods.map(item => `
            <div class="shop-item-card" data-key="${item.key}">
                <span class="shop-item-icon">${shopGoodIcon(item)}</span>
                <span class="shop-item-name">${shopGoodName(item)}</span>
                <span class="shop-item-owned">보유 ${shopGoodOwnedText(item)}</span>
                <button class="shop-item-buy-btn">${CURRENCY_ICONS[item.costCurrency] || ''} ${item.cost}</button>
            </div>`).join('') + '<p id="shop-item-msg" class="shop-item-msg hidden"></p>';
        return;
    }
    shopContent.innerHTML = `<p class="shop-empty">${SHOP_CATEGORIES[key]}</p>`;
}

Object.entries(shopCatButtons).forEach(([key, btn]) => {
    btn.addEventListener('click', () => renderShopCategory(key));
});

shopContent.addEventListener('click', (e) => {
    const iapBtn = e.target.closest('.iap-buy-btn');
    if (iapBtn) {
        submitIapPurchase(iapBtn.closest('.shop-item-card').dataset.key);
        return;
    }
    const btn = e.target.closest('.shop-item-buy-btn');
    if (!btn) return;
    const card = btn.closest('.shop-item-card');
    const key = card.dataset.key;
    const res = buyShopItem(key);
    if (res.ok) renderShopCategory(SHOP_ITEMS.find(it => it.key === key).category);
    const msgEl = document.getElementById('shop-item-msg');
    if (msgEl) {
        msgEl.textContent = res.msg;
        msgEl.classList.remove('hidden');
        msgEl.classList.toggle('good', res.ok);
    }
});

shopBtn.addEventListener('click', () => {
    renderShopCategory('currency');
    showScreen('shop');
});
backFromShopBtn.addEventListener('click', () => showScreen('lobby'));

// ---- 속성 주식 ----
// 물/불/바람/어둠/빛 5개 속성 주식. 시세는 SHARED.computeStockPrice(es)가
// shared.js의 STOCK_EVENTS 로그만 보고 계산한다 -- 패치(신규 캐릭터/버프/너프)를
// 낼 때마다 그 배열에 이벤트 하나를 추가하면 서버 없이도 모든 플레이어가
// 같은 시세를 보게 된다. 보유 주식/투자원금은 계정 세이브(gameData.stocks)에
// 저장되고, 다른 재화들과 같은 경로로 클라우드에 동기화된다.
const stocksBtn = document.getElementById('stocks-btn');
const backFromStocksBtn = document.getElementById('back-from-stocks-btn');
const stocksListEl = document.getElementById('stocks-list');
const stocksEventsEl = document.getElementById('stocks-events');
const stocksPurseEl = document.getElementById('stocks-purse');
const stocksMsgEl = document.getElementById('stocks-msg');

function stockHoldings() {
    if (!gameData.stocks || typeof gameData.stocks !== 'object') gameData.stocks = {};
    return gameData.stocks;
}
function stockHolding(element) {
    const bag = stockHoldings();
    return bag[element] || (bag[element] = { shares: 0, invested: 0 });
}

function showStocksMsg(text, good) {
    if (!stocksMsgEl) return;
    stocksMsgEl.textContent = text || '';
    stocksMsgEl.classList.toggle('hidden', !text);
    stocksMsgEl.classList.toggle('good', !!good);
}

// 정수 주식수만 거래한다. admin 모드에서는 다이아가 무제한이라 매수 시 실제
// 차감은 건너뛰지만(다른 재화 소비 흐름과 동일), 보유 주식수는 그대로 늘어난다.
function buyStock(element, qty) {
    qty = Math.floor(qty);
    if (!(qty > 0)) return { ok: false, msg: '수량을 입력해주세요.' };
    const price = SHARED.computeStockPrice(element);
    const cost = price * qty;
    if (currencyAmount('diamonds') < cost) return { ok: false, msg: '다이아가 부족합니다.' };
    const h = stockHolding(element);
    h.shares += qty;
    h.invested += cost;
    if (adminPowerOn('currencies')) saveGameData(gameData);
    else grantCurrencies({ diamonds: -cost });
    return { ok: true, msg: `${element} 속성 주식 ${qty}주를 샀습니다.` };
}

function sellStock(element, qty) {
    qty = Math.floor(qty);
    const h = stockHolding(element);
    if (!(qty > 0)) return { ok: false, msg: '수량을 입력해주세요.' };
    if (h.shares < qty) return { ok: false, msg: '보유 주식이 부족합니다.' };
    const price = SHARED.computeStockPrice(element);
    const proceeds = price * qty;
    // 평단 기준으로 투자원금도 같이 덜어내야 남은 주식의 평가손익이 안 왜곡된다.
    const avgCost = h.invested / h.shares;
    h.shares -= qty;
    h.invested = Math.max(0, h.invested - avgCost * qty);
    grantCurrencies({ diamonds: proceeds });
    return { ok: true, msg: `${element} 속성 주식 ${qty}주를 팔았습니다.` };
}

function renderStockEventsFeed() {
    if (!stocksEventsEl) return;
    const recent = SHARED.STOCK_EVENTS.slice(-8).reverse();
    if (!recent.length) {
        stocksEventsEl.innerHTML = '<p class="shop-empty">아직 시세를 움직인 소식이 없습니다.</p>';
        return;
    }
    const typeIcon = { new_character: '🆕', buff: '⬆️', nerf: '⬇️' };
    stocksEventsEl.innerHTML = recent.map(e => `
        <div class="stock-event-row">
            <span class="stock-event-icon">${typeIcon[e.type] || '📌'}</span>
            <span class="stock-event-text">
                <span class="stock-event-el">${ELEMENT_ICONS[e.element] || ''} ${e.element}</span>
                ${e.note || ''}
            </span>
            <span class="stock-event-pct ${e.pct >= 0 ? 'up' : 'down'}">${e.pct >= 0 ? '+' : ''}${Math.round(e.pct * 100)}%</span>
        </div>`).join('');
}

function renderStocksScreen() {
    if (stocksPurseEl) stocksPurseEl.textContent = `💎 ${currencyText('diamonds')}`;
    showStocksMsg('');
    const prices = SHARED.computeStockPrices();
    stocksListEl.innerHTML = SHARED.STOCK_ELEMENTS.map(el => {
        const price = prices[el];
        const changePct = Math.round((price / SHARED.STOCK_BASE_PRICE - 1) * 100);
        const h = stockHolding(el);
        const value = h.shares * price;
        const profit = value - h.invested;
        const changeClass = changePct > 0 ? 'up' : changePct < 0 ? 'down' : '';
        const profitClass = profit > 0 ? 'up' : profit < 0 ? 'down' : '';
        return `
            <div class="stock-card" data-element="${el}">
                <div class="stock-card-head">
                    <span class="stock-card-icon">${ELEMENT_ICONS[el] || ''}</span>
                    <span class="stock-card-name">${el} 속성</span>
                    <span class="stock-card-price">💎 ${price}
                        <span class="stock-card-change ${changeClass}">(${changePct >= 0 ? '+' : ''}${changePct}%)</span>
                    </span>
                </div>
                <div class="stock-card-holding">
                    보유 ${h.shares}주 · 평가액 💎 ${value}
                    ${h.shares > 0 ? `<span class="stock-card-profit ${profitClass}">${profit >= 0 ? '+' : ''}${profit}</span>` : ''}
                </div>
                <div class="stock-card-actions">
                    <input type="number" class="stock-qty-input" min="1" step="1" value="1">
                    <button class="stock-buy-btn">매수</button>
                    <button class="stock-sell-btn" ${h.shares > 0 ? '' : 'disabled'}>매도</button>
                </div>
            </div>`;
    }).join('');
    renderStockEventsFeed();
}

if (stocksListEl) {
    stocksListEl.addEventListener('click', (e) => {
        const card = e.target.closest('.stock-card');
        if (!card) return;
        const element = card.dataset.element;
        const qtyInput = card.querySelector('.stock-qty-input');
        const qty = parseInt(qtyInput.value, 10) || 0;
        let res = null;
        if (e.target.classList.contains('stock-buy-btn')) res = buyStock(element, qty);
        else if (e.target.classList.contains('stock-sell-btn')) res = sellStock(element, qty);
        if (!res) return;
        renderStocksScreen();
        showStocksMsg(res.msg, res.ok);
    });
}

if (stocksBtn) {
    stocksBtn.addEventListener('click', () => {
        renderStocksScreen();
        showScreen('stocks');
    });
}
if (backFromStocksBtn) backFromStocksBtn.addEventListener('click', () => showScreen('lobby'));

// ---- 아이템창 ----
// 재화 바에는 안 들어가는, "쓰는" 것들이 사는 곳. 표(SHARED.ITEMS)에 한 줄
// 넣으면 여기에 저절로 나온다.
const itemsBtn = document.getElementById('items-btn');
const itemsBadge = document.getElementById('items-badge');
const itemsListEl = document.getElementById('items-list');
const itemsMsgEl = document.getElementById('items-msg');
const backFromItemsBtn = document.getElementById('back-from-items-btn');

function showItemsMsg(text, good) {
    if (!itemsMsgEl) return;
    itemsMsgEl.textContent = text || '';
    itemsMsgEl.classList.toggle('hidden', !text);
    itemsMsgEl.classList.toggle('good', !!good);
}

// 로비 버튼의 빨간 점: 지금 바로 쓸 수 있는 아이템이 몇 개인지.
function usableItemCount() {
    return SHARED.ITEM_KEYS.reduce((n, key) =>
        n + (SHARED.ITEMS[key].usable ? itemCount(key) : 0), 0);
}

function renderItemsBadge() {
    if (!itemsBadge) return;
    const n = usableItemCount();
    itemsBadge.textContent = String(n);
    itemsBadge.classList.toggle('hidden', n <= 0);
}

function renderItems() {
    renderItemsBadge();
    if (!itemsListEl) return;
    const rows = SHARED.ITEM_KEYS
        .map(key => ({ key, def: SHARED.ITEMS[key], n: itemCount(key) }))
        .filter(r => r.n > 0);
    if (!rows.length) {
        itemsListEl.innerHTML = '<p class="shop-empty">가지고 있는 아이템이 없습니다. 각성모드를 깨면 들어옵니다.</p>';
        return;
    }
    itemsListEl.innerHTML = rows.map(({ key, def, n }) => {
        // 조각처럼 모으는 것은 개수 대신 진행도로 보여준다.
        const amount = def.goal
            ? `<span class="item-progress">${n} / ${def.goal}</span>`
            : `<span class="item-amount">x${n}</span>`;
        const bar = def.goal
            ? `<div class="item-bar"><div class="item-bar-fill" style="width:${Math.min(100, Math.round(n / def.goal * 100))}%"></div></div>`
            : '';
        const btn = def.usable
            ? `<button class="item-use-btn" data-key="${key}">사용</button>`
            : '';
        return `
            <div class="item-row">
                <span class="item-icon">${def.icon}</span>
                <span class="item-main">
                    <div class="item-name">${def.name} ${amount}</div>
                    <div class="item-desc">${def.desc}</div>
                    ${bar}
                </span>
                ${btn}
            </div>`;
    }).join('');
}

itemsListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.item-use-btn');
    if (!btn) return;
    const key = btn.dataset.key;
    if (key === SHARED.AWAKEN_GEAR_ITEM_KEY) {
        const res = useRandomAwakenGear();
        showItemsMsg(res.msg, res.ok);
        renderItems();
        return;
    }
    if (key === 'randomLegendaryGear') {
        const res = useRandomLegendaryGear();
        showItemsMsg(res.msg, res.ok);
        renderItems();
        return;
    }
    if (key === 'soulStoneChoice') {
        if (itemCount(key) <= 0) { showItemsMsg('선택 영혼석이 없습니다.', false); return; }
        // 케릭터 선택 화면에서 고르면 그 케릭터에게 영혼석 100개를 주고 아이템창으로 돌아온다.
        openCharacterSelect('items', {
            selectedId: null,
            onPick: (charType) => {
                itemBag()[key] -= 1;
                gameData.soulStones[charType] = (gameData.soulStones[charType] || 0) + 100;
                saveGameData(gameData);
                showItemsMsg(`${SHARED.CHARACTERS[charType].name}에게 영혼석 100개를 줬어요.`, true);
                renderItems();
            }
        });
    }
});

itemsBtn.addEventListener('click', () => {
    showItemsMsg('');
    renderItems();
    showScreen('items');
});
backFromItemsBtn.addEventListener('click', () => showScreen('lobby'));

// ---- 대기 화면 ----
// 짝이 맞으면 둘이 모닥불을 사이에 두고 마주 서고, 준비를 누른 쪽 머리 위에
// READY가 뜬다. 보스 레이드와 스토리 타워가 같은 것을 쓴다.
// els = { campfire, myReady, partnerReady }
function renderWaitingScene(els, players, matched) {
    els.campfire.classList.toggle('hidden', !matched);
    if (!matched) {
        els.myReady.classList.add('hidden');
        els.partnerReady.classList.add('hidden');
        return;
    }
    const mine = players && players[socket.id];
    const partner = players && Object.entries(players).find(([id]) => id !== socket.id);
    els.myReady.classList.toggle('hidden', !(mine && mine.ready));
    els.partnerReady.classList.toggle('hidden', !(partner && partner[1].ready));
}

const detailCampfire = document.getElementById('detail-campfire');
const detailMyReadyBadge = document.getElementById('detail-my-ready');
const detailPartnerReadyBadge = document.getElementById('detail-partner-ready');
const towerCampfire = document.getElementById('tower-campfire');
const towerMyReadyBadge = document.getElementById('tower-my-ready');
const towerPartnerReadyBadge = document.getElementById('tower-partner-ready');
const RAID_WAIT_ELS = {
    campfire: detailCampfire, myReady: detailMyReadyBadge, partnerReady: detailPartnerReadyBadge
};
const TOWER_WAIT_ELS = {
    campfire: towerCampfire, myReady: towerMyReadyBadge, partnerReady: towerPartnerReadyBadge
};

// ---- 각성모드 ----
// 각성 장비를 얻는 모드. 어떤 쿠키의 각성 장비를 노릴지 고르면 그 쿠키의
// 보스 버전과 싸운다. 파티는 3명이고 혼자 한다. 레벨은 순서 잠금이 없다.
const awakenModeCard = document.getElementById('awaken-mode-card');
const awakenBossListEl = document.getElementById('awaken-boss-list');
const backFromAwakenBossBtn = document.getElementById('back-from-awaken-boss-btn');
const awakenBossNameEl = document.getElementById('awaken-boss-name');
const awakenBossIconEl = document.getElementById('awaken-boss-icon');
const awakenBossGearEl = document.getElementById('awaken-boss-gear');
const awakenLevelChipsEl = document.getElementById('awaken-level-chips');
const awakenLevelInfoEl = document.getElementById('awaken-level-info');
const awakenPartyEl = document.getElementById('awaken-party');
const awakenPlayBtn = document.getElementById('awaken-play-btn');
const awakenMsgEl = document.getElementById('awaken-msg');
const backFromAwakenDetailBtn = document.getElementById('back-from-awaken-detail-btn');
const awakenSoloBtn = document.getElementById('awaken-solo-btn');
const awakenMultiBtn = document.getElementById('awaken-multi-btn');
const awakenPartyTitleEl = document.getElementById('awaken-party-title');
const awakenWaitingRowEl = document.getElementById('awaken-waiting-row');
const awakenMyIconEl = document.getElementById('awaken-my-icon');
const awakenMyNameEl = document.getElementById('awaken-my-name');
const awakenMyReadyBadge = document.getElementById('awaken-my-ready');
const awakenPartnerPreviewEl = document.getElementById('awaken-partner-preview');
const awakenPartnerIconEl = document.getElementById('awaken-partner-icon');
const awakenPartnerNameEl = document.getElementById('awaken-partner-name');
const awakenPartnerReadyBadge = document.getElementById('awaken-partner-ready');
const awakenCampfireEl = document.getElementById('awaken-campfire');
const AWAKEN_WAIT_ELS = {
    campfire: awakenCampfireEl, myReady: awakenMyReadyBadge, partnerReady: awakenPartnerReadyBadge
};

let awakenBossId = null;
let awakenLevel = 1;
// 3칸. 빈 칸은 null이고, 같은 쿠키를 두 칸에 넣지 못한다. 멀티에서는 0번
// 칸 하나만 쓴다 (같이할 때는 캐릭터 하나씩만 골라서 한다).
let awakenParty = new Array(SHARED.AWAKEN_PARTY_SIZE).fill(null);
// 혼자(파티 3명) / 같이(캐릭터 1명씩, 스토리 타워처럼 짝을 찾는다).
let awakenIsMulti = false;
let awakenPhase = 'idle'; // 'idle' | 'searching' | 'matched'
let awakenMyReady = false;
let awakenSearchStartAt = 0;
let awakenSearchHandle = null;

// 이 쿠키의 각성 장비 (보스 카드에 무엇이 걸려 있는지 보여주려고).
function awakenGearOwnedBy(charType) {
    const ids = SHARED.awakenEquipmentIds();
    const own = ids.find(id => SHARED.EQUIPMENT[id].ownerChar === charType);
    return own ? SHARED.EQUIPMENT[own] : null;
}

function renderAwakenBossList() {
    awakenBossListEl.innerHTML = '';
    SHARED.awakenBossCharTypes().forEach(id => {
        const stats = SHARED.CHARACTERS[id];
        const gear = awakenGearOwnedBy(id);
        const card = document.createElement('div');
        card.className = 'boss-card';
        card.innerHTML = `
            <div class="icon char-swatch" style="background: ${charIconBackground(stats)}"></div>
            <div class="name">${stats.name}</div>
            <div class="awaken-card-gear">${gear ? `${gear.icon} ${gear.name}` : '각성 장비 없음'}</div>`;
        card.addEventListener('click', () => openAwakenDetail(id));
        awakenBossListEl.appendChild(card);
    });
}

// 레벨에 따라 달라지는 보스 수치를 한 줄씩. 값이 없는 항목은 아예 안 적는다.
function awakenBossStatLines(charType, level) {
    const base = SHARED.CHARACTERS[charType];
    const stats = SHARED.awakenLevelStats(level) || {};
    const lines = [];
    lines.push(`체력 ${SHARED.awakenBossMaxHp(charType, level)} (+${SHARED.awakenLevelHealthBonus(charType, level)})`);
    const atk = SHARED.awakenBossAttackDamage(charType, level);
    if (atk != null) lines.push(`공격력 ${atk} (+${stats.attack || 0})`);
    if (stats.speed) lines.push(`이동 속도 +${stats.speed}`);
    if (stats.damageTaken) lines.push(`받는 피해 ${Math.round(stats.damageTaken * 100)}%`);
    if (stats.regenAmount) lines.push(`${Math.round(stats.regenIntervalMs / 1000)}초마다 ${stats.regenAmount} 회복`);

    const skill = SHARED.awakenBossSkillDamage(charType, level);
    if (skill != null) lines.push(`특수스킬 피해 ${skill}`);
    const skillHeal = SHARED.awakenBossSkillHealOnHit(charType, level);
    if (skillHeal != null) lines.push(`특수스킬 회복 ${skillHeal}`);
    const ult = SHARED.awakenBossUltimateDamage(charType, level);
    if (ult != null) lines.push(`궁극기 피해 ${ult}`);
    const ultAtk = SHARED.awakenBossUltimateAttackDamage(charType, level);
    if (ultAtk != null) lines.push(`궁극기 중 공격력 ${ultAtk}`);
    const ultHeal = SHARED.awakenBossUltimateHealAmount(charType, level);
    if (ultHeal) lines.push(`궁극기 회복 ${ultHeal}`);
    const shield = SHARED.awakenBossUltimateShield(charType, level);
    if (shield != null) lines.push(`궁극기 보호막 ${shield}`);
    const summons = SHARED.awakenBossSummonCount(charType, level);
    if (summons != null) {
        lines.push(`부하 ${summons}마리 (체력 ${SHARED.awakenBossSummonHealth(charType, level)})`);
    }
    const burn = SHARED.awakenBossBurnTotal(charType, level);
    if (burn != null) lines.push(`화염 피해 ${burn}`);
    const hitHeal = SHARED.awakenBossAttackHeal(charType, level);
    if (hitHeal != null) lines.push(`적중할 때마다 ${hitHeal} 회복`);
    return lines;
}

// 이 레벨을 깨면 받는 것.
function awakenDropText(level) {
    const drop = SHARED.awakenLevelDrop(level);
    if (!drop) return '';
    if (drop.gearChance != null) {
        return `🎁 각성 장비 ${Math.round(drop.gearChance * 100)}% · 꽝이면 🧩 조각 ${drop.missFragments}개`;
    }
    return `🧩 각성 장비 조각 ${drop.fragmentMin}~${drop.fragmentMax}개`;
}

function renderAwakenLevelChips() {
    awakenLevelChipsEl.innerHTML = '';
    for (let lv = 1; lv <= SHARED.AWAKEN_MAX_LEVEL; lv++) {
        const chip = document.createElement('button');
        chip.className = 'awaken-level-chip' + (lv === awakenLevel ? ' selected' : '');
        chip.textContent = `${lv}레벨`;
        chip.addEventListener('click', () => { leaveAwakenRoomIfWaiting(); awakenLevel = lv; renderAwakenDetail(); });
        awakenLevelChipsEl.appendChild(chip);
    }
}

function renderAwakenParty() {
    awakenPartyEl.innerHTML = '';
    const slots = awakenIsMulti ? awakenParty.slice(0, 1) : awakenParty;
    slots.forEach((id, i) => {
        const slot = document.createElement('div');
        slot.className = 'awaken-party-slot' + (id ? ' filled' : '');
        if (id) {
            const stats = SHARED.CHARACTERS[id];
            slot.innerHTML = `
                <div class="icon char-swatch" style="background: ${charIconBackground(stats)}"></div>
                <div class="name">${stats.shortName || stats.name}</div>`;
        } else {
            slot.innerHTML = '<div class="icon">＋</div><div class="name">비어 있음</div>';
        }
        slot.addEventListener('click', () => {
            leaveAwakenRoomIfWaiting();
            openCharacterSelect('awakenDetail', {
                selectedId: id,
                onPick: (picked) => {
                    // 같은 쿠키가 두 칸에 들어가지 않게, 있던 칸은 비운다.
                    const already = awakenParty.indexOf(picked);
                    if (already >= 0) awakenParty[already] = null;
                    awakenParty[i] = picked;
                    renderAwakenDetail();
                }
            });
        });
        awakenPartyEl.appendChild(slot);
    });
}

// ---- 각성모드: 혼자 / 같이 ----
function stopAwakenSearchTimer() {
    if (awakenSearchHandle) clearInterval(awakenSearchHandle);
    awakenSearchHandle = null;
}

function updateAwakenSearchLabel() {
    const secs = Math.floor((Date.now() - awakenSearchStartAt) / 1000);
    awakenPlayBtn.textContent = `대기중 (${secs}초)`;
}

function updateAwakenPlayBtnLabel() {
    if (awakenPhase === 'searching') return; // 타이머가 초 단위로 계속 고쳐 쓴다.
    if (awakenPhase === 'matched') {
        awakenPlayBtn.textContent = awakenMyReady ? '준비 완료 (대기중)' : '▶ 준비';
        return;
    }
    awakenPlayBtn.textContent = awakenIsMulti ? '▶ 같이하기' : '▶ 시작';
}

function updateAwakenPlayBtnState() {
    if (awakenPhase === 'searching' || awakenMyReady) { awakenPlayBtn.disabled = true; return; }
    awakenPlayBtn.disabled = awakenIsMulti ? !awakenParty[0] : awakenParty.some(id => !id);
}

// 화면을 뜨거나 레벨/보스/캐릭터를 바꾸면 짝 찾던 방에서 나온다.
function resetAwakenActions() {
    awakenPhase = 'idle';
    awakenMyReady = false;
    stopAwakenSearchTimer();
    awakenWaitingRowEl.classList.add('hidden');
    awakenPartnerPreviewEl.classList.add('hidden');
    updateAwakenPlayBtnLabel();
    updateAwakenPlayBtnState();
}

function leaveAwakenRoomIfWaiting() {
    if (awakenPhase !== 'idle') socket.emit('leaveStoryRoom');
    resetAwakenActions();
}

function syncAwakenModeButtons() {
    awakenSoloBtn.classList.toggle('selected', !awakenIsMulti);
    awakenMultiBtn.classList.toggle('selected', awakenIsMulti);
    awakenPartyTitleEl.textContent = awakenIsMulti ? '내 캐릭터' : '파티 3명';
}

awakenSoloBtn.addEventListener('click', () => {
    if (!awakenIsMulti) return;
    leaveAwakenRoomIfWaiting();
    awakenIsMulti = false;
    syncAwakenModeButtons();
    renderAwakenDetail();
});
awakenMultiBtn.addEventListener('click', () => {
    if (awakenIsMulti) return;
    leaveAwakenRoomIfWaiting();
    awakenIsMulti = true;
    syncAwakenModeButtons();
    renderAwakenDetail();
});

function renderAwakenDetail() {
    if (!awakenBossId) return;
    const stats = SHARED.CHARACTERS[awakenBossId];
    const gear = awakenGearOwnedBy(awakenBossId);
    awakenBossNameEl.textContent = `${stats.name} 보스`;
    awakenBossIconEl.style.background = charIconBackground(stats);
    awakenBossGearEl.innerHTML = gear
        ? `노리는 각성 장비: <b>${gear.icon} ${gear.name}</b>`
        : '';
    renderAwakenLevelChips();

    const reward = SHARED.awakenLevelReward(awakenLevel) || {};
    awakenLevelInfoEl.innerHTML = `
        <div class="awaken-level-title">${awakenLevel}레벨 보스</div>
        <ul class="awaken-stat-list">${
            awakenBossStatLines(awakenBossId, awakenLevel).map(t => `<li>${t}</li>`).join('')
        }</ul>
        <div class="awaken-drop">${awakenDropText(awakenLevel)}</div>
        <div class="reward-chips">${rewardChipsHtml(reward)}</div>`;
    renderAwakenParty();
    updateAwakenPlayBtnLabel();
    updateAwakenPlayBtnState();
}

function openAwakenDetail(charType) {
    leaveAwakenRoomIfWaiting();
    awakenBossId = charType;
    if (!SHARED.awakenLevelStats(awakenLevel)) awakenLevel = 1;
    showAwakenMsg('');
    syncAwakenModeButtons();
    renderAwakenDetail();
    showScreen('awakenDetail');
}

function showAwakenMsg(text, good) {
    if (!awakenMsgEl) return;
    awakenMsgEl.textContent = text || '';
    awakenMsgEl.classList.toggle('hidden', !text);
    awakenMsgEl.classList.toggle('good', !!good);
}

awakenModeCard.addEventListener('click', () => {
    renderAwakenBossList();
    showScreen('awakenBoss');
});
backFromAwakenBossBtn.addEventListener('click', () => showScreen('modeSelect'));
backFromAwakenDetailBtn.addEventListener('click', () => {
    leaveAwakenRoomIfWaiting();
    showScreen('awakenBoss');
});

awakenPlayBtn.addEventListener('click', () => {
    if (awakenPlayBtn.disabled) return;

    if (awakenIsMulti) {
        const myChar = awakenParty[0];
        if (!myChar) {
            showAwakenMsg('캐릭터를 선택해 주세요.');
            return;
        }
        showAwakenMsg('');
        if (awakenPhase === 'idle') {
            awakenPhase = 'searching';
            awakenSearchStartAt = Date.now();
            updateAwakenSearchLabel();
            awakenPlayBtn.disabled = true;
            stopAwakenSearchTimer();
            awakenSearchHandle = setInterval(updateAwakenSearchLabel, 1000);
            awakenWaitingRowEl.classList.remove('hidden');
            awakenMyIconEl.style.background = charIconBackground(SHARED.CHARACTERS[myChar]);
            awakenMyNameEl.textContent = (SHARED.CHARACTERS[myChar] || {}).name || '';
            socket.emit('joinAwakenBoss', {
                charType: awakenBossId,
                level: awakenLevel,
                solo: false,
                myChar,
                equip: equipPayload(myChar),
                instinct: instinctPayload(myChar)
            });
        } else if (awakenPhase === 'matched' && !awakenMyReady) {
            awakenMyReady = true;
            awakenPlayBtn.disabled = true;
            updateAwakenPlayBtnLabel();
            socket.emit('storyPlayerReady');
        }
        return;
    }

    if (awakenParty.some(id => !id)) {
        showAwakenMsg('파티 3명을 모두 채워 주세요.');
        return;
    }
    showAwakenMsg('');
    socket.emit('joinAwakenBoss', {
        charType: awakenBossId,
        level: awakenLevel,
        solo: true,
        party: awakenParty,
        equipParty: awakenParty.map(id => equipPayload(id)),
        instinctParty: awakenParty.map(id => instinctPayload(id))
    });
});

// 한 판이 끝났을 때. 이겼으면 그 레벨의 드랍을 굴려 조각이나 각성 장비를 준다.
function showAwakenResult(awaken, result) {
    const stats = SHARED.CHARACTERS[awaken.charType] || SHARED.CHARACTERS.kicker;
    resetAwakenActions();
    resultReturnScreen = 'awakenDetail';
    resultBackBtn.textContent = '각성모드로';
    awakenBossId = awaken.charType;
    awakenLevel = awaken.level;
    if (result !== 'win') {
        resultTitle.textContent = '패배...';
        resultTitle.style.color = '#e74c3c';
        resultDesc.textContent = `${stats.name} 보스 ${awaken.level}레벨에게 졌습니다.`;
        showScreen('result');
        return;
    }
    resultTitle.textContent = '보스 격파!';
    resultTitle.style.color = '#2ecc71';

    const bag = SHARED.awakenLevelReward(awaken.level);
    grantCurrencies(bag);
    const drop = SHARED.rollAwakenDrop(awaken.level, awaken.charType);
    const lines = [`${stats.name} 보스 ${awaken.level}레벨을 잡았습니다.`];
    let chips = rewardChipsHtml(bag);
    if (drop.gearId) {
        const item = SHARED.equipmentFor(drop.gearId);
        grantEquipment(drop.gearId);
        lines.push(`${item.icon} ${item.name}을(를) 얻었습니다!`);
    }
    if (drop.fragments > 0) {
        const made = grantItems({ [SHARED.AWAKEN_FRAGMENT_KEY]: drop.fragments });
        lines.push(`🧩 각성 장비 조각 ${drop.fragments}개를 받았습니다.`);
        if (made > 0) lines.push(`조각이 다 모여 🎁 랜덤 각성 장비 ${made}개가 됐습니다!`);
    }
    resultDesc.textContent = lines.join(' ');
    resultRewardsEl.innerHTML = chips;
    renderItemsBadge();
    showScreen('result');
}

// ---- 레전드 스토리: 지하 1층부터 (탑 아래로 내려가는 별도 스토리,
// story-fork 화면에서 들어온다). 각성모드와 같은 혼자(3명 파티, 교체
// 있음)/같이(1명씩, 교체 없음) 구조에, 각성모드의 레벨 칩과 같은 모양으로
// 지하층을 고른다 -- 다만 탑처럼 위로 올라가는 게 아니라 아래로 내려가는
// 곳이라, 칩은 1층이 맨 위, 더 깊은 층일수록 아래로 뒤집지 않고 그대로
// 늘어놓는다(아래로 누르면서 내려가는 느낌).
const legendFloorChipsEl = document.getElementById('legend-floor-chips');
const legendFloorNameEl = document.getElementById('legend-floor-name');
const legendPartyEl = document.getElementById('legend-party');
const legendPlayBtn = document.getElementById('legend-play-btn');
const legendMsgEl = document.getElementById('legend-msg');
const legendSoloBtn = document.getElementById('legend-solo-btn');
const legendMultiBtn = document.getElementById('legend-multi-btn');
const legendPartyTitleEl = document.getElementById('legend-party-title');
const legendFloorInfoEl = document.getElementById('legend-floor-info');
const legendWaitingRowEl = document.getElementById('legend-waiting-row');
const legendMyIconEl = document.getElementById('legend-my-icon');
const legendMyNameEl = document.getElementById('legend-my-name');
const legendMyReadyBadge = document.getElementById('legend-my-ready');
const legendPartnerPreviewEl = document.getElementById('legend-partner-preview');
const legendPartnerIconEl = document.getElementById('legend-partner-icon');
const legendPartnerNameEl = document.getElementById('legend-partner-name');
const legendPartnerReadyBadge = document.getElementById('legend-partner-ready');
const legendCampfireEl = document.getElementById('legend-campfire');
const LEGEND_WAIT_ELS = {
    campfire: legendCampfireEl, myReady: legendMyReadyBadge, partnerReady: legendPartnerReadyBadge
};

let selectedLegendFloor = 1;

// 이어서 할 층에서 시작한다: 마지막으로 깬 지하층의 다음 층, 없으면 1층,
// 다 깼으면 마지막 층에 머문다 (resumeStoryFloor와 같은 규칙).
function resumeLegendFloor() {
    const cleared = (gameData.clearedLegendFloors || [])
        .map(k => parseInt(String(k).replace('legend', ''), 10))
        .filter(n => Number.isInteger(n) && n >= 1);
    if (!cleared.length) return 1;
    const last = Math.max(...cleared);
    return Math.min(SHARED.LEGEND_TOTAL_FLOORS, last + 1);
}
function isLegendFloorUnlocked(n) {
    if (adminPowerOn('stages')) return true;
    if (n === 1) return true;
    return gameData.clearedLegendFloors.includes(SHARED.legendFloorKey(n - 1));
}
function renderLegendFloorChips() {
    legendFloorChipsEl.innerHTML = '';
    for (let n = 1; n <= SHARED.LEGEND_TOTAL_FLOORS; n++) {
        const unlocked = isLegendFloorUnlocked(n);
        const chip = document.createElement('button');
        chip.className = 'awaken-level-chip'
            + (n === selectedLegendFloor ? ' selected' : '')
            + (unlocked ? '' : ' locked');
        chip.textContent = unlocked ? `지하 ${n}층` : `🔒 지하 ${n}층`;
        chip.disabled = !unlocked;
        if (unlocked) {
            chip.addEventListener('click', () => {
                leaveLegendRoomIfWaiting();
                selectedLegendFloor = n;
                renderLegendDetail();
            });
        }
        legendFloorChipsEl.appendChild(chip);
    }
}

// 3칸. 빈 칸은 null. 멀티에서는 0번 칸 하나만 쓴다(같이할 때는 캐릭터
// 하나씩만 골라서 한다 -- storyPartySizeFor(floor, false)가 1을 준다).
let legendParty = new Array(SHARED.LEGEND_PARTY_SIZE).fill(null);
let legendIsMulti = false;
let legendPhase = 'idle'; // 'idle' | 'searching' | 'matched'
let legendMyReady = false;
let legendSearchStartAt = 0;
let legendSearchHandle = null;

function renderLegendParty() {
    legendPartyEl.innerHTML = '';
    const slots = legendIsMulti ? legendParty.slice(0, 1) : legendParty;
    slots.forEach((id, i) => {
        // 파티 자리마다 최대 등급이 다르다(1번째는 제한 없음, 2번째는
        // 레전더리까지, 3번째는 에픽까지 -- LEGEND_PARTY_SLOT_MAX_GRADE).
        // 멀티(1명 자리)는 제한 없이 아무 등급이나 데려간다.
        const cap = !legendIsMulti && SHARED.LEGEND_PARTY_SLOT_MAX_GRADE[i];
        const slot = document.createElement('div');
        slot.className = 'awaken-party-slot' + (id ? ' filled' : '');
        const capHtml = cap ? `<div class="cap">최대 ${cap}</div>` : '';
        if (id) {
            const stats = SHARED.CHARACTERS[id];
            slot.innerHTML = `
                <div class="icon char-swatch" style="background: ${charIconBackground(stats)}"></div>
                <div class="name">${stats.shortName || stats.name}</div>${capHtml}`;
        } else {
            slot.innerHTML = `<div class="icon">＋</div><div class="name">비어 있음</div>${capHtml}`;
        }
        slot.addEventListener('click', () => {
            leaveLegendRoomIfWaiting();
            openCharacterSelect('legendDetail', {
                selectedId: id,
                maxGrade: cap || null,
                onPick: (picked) => {
                    // 같은 쿠키가 두 칸에 들어가지 않게, 있던 칸은 비운다.
                    const already = legendParty.indexOf(picked);
                    if (already >= 0) legendParty[already] = null;
                    legendParty[i] = picked;
                    renderLegendDetail();
                }
            });
        });
        legendPartyEl.appendChild(slot);
    });
}

function stopLegendSearchTimer() {
    if (legendSearchHandle) clearInterval(legendSearchHandle);
    legendSearchHandle = null;
}
function updateLegendSearchLabel() {
    const secs = Math.floor((Date.now() - legendSearchStartAt) / 1000);
    legendPlayBtn.textContent = `대기중 (${secs}초)`;
}
function updateLegendPlayBtnLabel() {
    if (legendPhase === 'searching') return; // 타이머가 초 단위로 계속 고쳐 쓴다.
    if (legendPhase === 'matched') {
        legendPlayBtn.textContent = legendMyReady ? '준비 완료 (대기중)' : '▶ 준비';
        return;
    }
    legendPlayBtn.textContent = legendIsMulti ? '▶ 같이하기' : '▶ 시작';
}
function updateLegendPlayBtnState() {
    if (legendPhase === 'searching' || legendMyReady) { legendPlayBtn.disabled = true; return; }
    if (!SHARED.floorDefFor(SHARED.legendFloorKey(selectedLegendFloor))) { legendPlayBtn.disabled = true; return; }
    legendPlayBtn.disabled = legendIsMulti ? !legendParty[0] : legendParty.some(id => !id);
}
function resetLegendActions() {
    legendPhase = 'idle';
    legendMyReady = false;
    stopLegendSearchTimer();
    legendWaitingRowEl.classList.add('hidden');
    legendPartnerPreviewEl.classList.add('hidden');
    updateLegendPlayBtnLabel();
    updateLegendPlayBtnState();
}
function leaveLegendRoomIfWaiting() {
    if (legendPhase !== 'idle') socket.emit('leaveStoryRoom');
    resetLegendActions();
}
function syncLegendModeButtons() {
    legendSoloBtn.classList.toggle('selected', !legendIsMulti);
    legendMultiBtn.classList.toggle('selected', legendIsMulti);
    legendPartyTitleEl.textContent = legendIsMulti ? '내 캐릭터' : '파티 3명';
}
legendSoloBtn.addEventListener('click', () => {
    if (!legendIsMulti) return;
    leaveLegendRoomIfWaiting();
    legendIsMulti = false;
    syncLegendModeButtons();
    renderLegendDetail();
});
legendMultiBtn.addEventListener('click', () => {
    if (legendIsMulti) return;
    leaveLegendRoomIfWaiting();
    legendIsMulti = true;
    syncLegendModeButtons();
    renderLegendDetail();
});

function showLegendMsg(text, good) {
    if (!legendMsgEl) return;
    legendMsgEl.textContent = text || '';
    legendMsgEl.classList.toggle('hidden', !text);
    legendMsgEl.classList.toggle('good', !!good);
}

function renderLegendDetail() {
    const floorKey = SHARED.legendFloorKey(selectedLegendFloor);
    const reward = SHARED.legendClearReward(floorKey) || {};
    legendFloorNameEl.textContent = `레전드 스토리 · 지하 ${selectedLegendFloor}층`;
    legendFloorInfoEl.innerHTML = SHARED.floorDefFor(floorKey)
        ? `<ul class="awaken-stat-list">
            <li>입구 스위치를 밟아야 문이 열립니다</li>
            <li>잡몹 방 2개를 지나면 갈림길 -- 한쪽은 별로, 한쪽은 막다른 보물상자</li>
        </ul>
        <div class="reward-chips">${rewardChipsHtml(reward)}</div>`
        : `<div>아직 만들어지지 않은 층입니다.</div>`;
    renderLegendFloorChips();
    renderLegendParty();
    updateLegendPlayBtnLabel();
    updateLegendPlayBtnState();
}

document.getElementById('legend-story-card').addEventListener('click', () => {
    leaveLegendRoomIfWaiting();
    showLegendMsg('');
    syncLegendModeButtons();
    selectedLegendFloor = resumeLegendFloor();
    renderLegendDetail();
    showScreen('legendDetail');
});
document.getElementById('back-from-legend-detail-btn').addEventListener('click', () => {
    leaveLegendRoomIfWaiting();
    showScreen('storyFork');
});

legendPlayBtn.addEventListener('click', () => {
    if (legendPlayBtn.disabled) return;
    const floorKey = SHARED.legendFloorKey(selectedLegendFloor);

    if (legendIsMulti) {
        const myChar = legendParty[0];
        if (!myChar) {
            showLegendMsg('캐릭터를 선택해 주세요.');
            return;
        }
        showLegendMsg('');
        if (legendPhase === 'idle') {
            legendPhase = 'searching';
            legendSearchStartAt = Date.now();
            updateLegendSearchLabel();
            legendPlayBtn.disabled = true;
            stopLegendSearchTimer();
            legendSearchHandle = setInterval(updateLegendSearchLabel, 1000);
            legendWaitingRowEl.classList.remove('hidden');
            legendMyIconEl.style.background = charIconBackground(SHARED.CHARACTERS[myChar]);
            legendMyNameEl.textContent = (SHARED.CHARACTERS[myChar] || {}).name || '';
            socket.emit('joinStoryFloor', {
                floor: floorKey, charType: myChar, equip: equipPayload(myChar),
                instinct: instinctPayload(myChar), solo: false
            });
        } else if (legendPhase === 'matched' && !legendMyReady) {
            legendMyReady = true;
            legendPlayBtn.disabled = true;
            updateLegendPlayBtnLabel();
            socket.emit('storyPlayerReady');
        }
        return;
    }

    if (legendParty.some(id => !id)) {
        showLegendMsg('파티 3명을 모두 채워 주세요.');
        return;
    }
    showLegendMsg('');
    socket.emit('joinStoryFloor', {
        floor: floorKey, charType: legendParty[0], equip: equipPayload(legendParty[0]),
        instinct: instinctPayload(legendParty[0]), solo: true,
        party: legendParty,
        equipParty: legendParty.map(id => equipPayload(id)),
        instinctParty: legendParty.map(id => instinctPayload(id))
    });
});

// 한 판이 끝났을 때. 이겼으면 첫 클리어 여부와 상관없이 재화를 준다(장비
// 드랍 같은 첫 클리어 전용 보상은 아직 없다). floor는 서버가 보낸 그대로의
// 키('legend1' 등)라 selectedLegendFloor도 여기서 맞춰 둬야 결과 화면에서
// "뒤로"를 누르면 방금 그 층이 그대로 선택돼 있다.
function showLegendResult(floor, result) {
    const n = parseInt(String(floor).replace('legend', ''), 10);
    if (Number.isInteger(n)) selectedLegendFloor = n;
    resetLegendActions();
    resultReturnScreen = 'legendDetail';
    resultBackBtn.textContent = '레전드 스토리로';
    if (result !== 'win') {
        resultTitle.textContent = '패배...';
        resultTitle.style.color = '#e74c3c';
        resultDesc.textContent = `지하 ${n}층에서 쓰러졌습니다.`;
        showScreen('result');
        return;
    }
    resultTitle.textContent = '층 클리어!';
    resultTitle.style.color = '#2ecc71';
    if (!gameData.clearedLegendFloors.includes(floor)) {
        gameData.clearedLegendFloors.push(floor);
        saveGameData(gameData);
    }
    const bag = SHARED.legendClearReward(floor);
    grantCurrencies(bag);
    resultDesc.textContent = `지하 ${n}층을 클리어했습니다.`;
    resultRewardsEl.innerHTML = rewardChipsHtml(bag);
    showScreen('result');
}

// ---- Event: 레전더리 이벤트 ----
// Laid out like the shop -- categories down the left, the selected one on the
// right. 안내 / 물 미션 / 불 미션.
const eventBtn = document.getElementById('event-btn');
const eventBadge = document.getElementById('event-badge');
const backFromEventBtn = document.getElementById('back-from-event-btn');
const eventTitleEl = document.getElementById('event-title');
const eventTicketAmountEl = document.getElementById('event-ticket-amount');
const eventTicketNameEl = document.getElementById('event-ticket-name');
const eventCategoriesEl = document.getElementById('event-categories');
const eventContentEl = document.getElementById('event-content');

const EV = SHARED.EVENT;
let eventCategory = 'water';

function eventStages(side) {
    return (EV.stages[side] && EV.stages[side].stages) || [];
}
function allEventStages() {
    return Object.keys(EV.stages).flatMap(eventStages);
}
function eventBoss(side) {
    return (EV.stages[side] && EV.stages[side].boss) || null;
}
function allEventBosses() {
    return Object.keys(EV.stages).map(eventBoss).filter(Boolean);
}
// Bosses are entered exactly like a stage, so lookups have to see both.
function eventStageById(id) {
    return allEventStages().concat(allEventBosses()).find(s => s.id === id) || null;
}
function eventStageCleared(id) {
    return gameData.eventCleared.includes(id);
}
// The boss only opens once its whole side is done.
function eventBossUnlocked(side) {
    if (adminPowerOn('stages')) return true;
    return eventStages(side).every(s => eventStageCleared(s.id));
}
// Stages open one at a time, like tower floors: you have to clear the one
// before it on the same side.
function eventStageUnlocked(side, index) {
    if (adminPowerOn('stages')) return true; // 관리자 전용: every stage is open
    if (index === 0) return true;
    const prev = eventStages(side)[index - 1];
    return !!prev && eventStageCleared(prev.id);
}
function bothSidesCleared() {
    return allEventStages().every(s => eventStageCleared(s.id));
}
function eventBonusClaimed() {
    return gameData.eventClaimed.includes('both');
}
// What the lobby badge counts: stages you could go clear right now, plus the
// 전체 클리어 bonus once it is sitting there waiting to be taken. Bosses are
// left out -- they never stop being available, so they'd pin the badge on.
function claimableCount() {
    let n = 0;
    Object.keys(EV.stages).forEach(side => {
        eventStages(side).forEach((s, i) => {
            if (!eventStageCleared(s.id) && eventStageUnlocked(side, i)) n += 1;
        });
    });
    if (bothSidesCleared() && !eventBonusClaimed()) n += 1;
    return n;
}

// Each side pays its own cookie's ticket -- they are separate currencies.
function ticketKeyOf(sideKey) {
    return (EV.stages[sideKey] && EV.stages[sideKey].ticketKey) || 'ticketWaterdrop';
}
function ticketAmount(key) {
    return isAdmin() ? Infinity : (gameData.currencies[key] || 0);
}

// ---- 클리어 보상 ----
// 하나의 지급 경로. 티켓이든 코인이든 재료이든 전부 여기를 거친다.
function grantCurrencies(bag) {
    if (!bag) return;
    Object.entries(bag).forEach(([key, n]) => {
        gameData.currencies[key] = (gameData.currencies[key] || 0) + n;
    });
    saveGameData(gameData);
    renderCurrencyBar();
}

function grantTickets(key, n) {
    grantCurrencies({ [key]: n });
}

function rewardChipsHtml(bag) {
    if (!bag) return '';
    return Object.entries(bag).map(([key, n]) => `
        <div class="reward-chip">
            <span class="reward-chip-icon">${CURRENCY_ICONS[key] || '🎁'}</span>
            <span class="reward-chip-amount">${n.toLocaleString()}</span>
            <span class="reward-chip-label">${CURRENCY_LABELS[key] || key}</span>
        </div>`).join('');
}

// 깔 때마다 전액: 첫 클리어인지 안 따진다.
function payClearReward(key) {
    const bag = SHARED.clearRewardFor(key);
    if (!bag) return null;
    grantCurrencies(bag);
    return bag;
}

function renderCurrencyBar() {
    if (!lobbyCurrencyBar) return;
    lobbyCurrencyBar.innerHTML = LOBBY_CURRENCIES.map(key => `
        <span class="currency-pill" title="${CURRENCY_LABELS[key]}">
            <span class="currency-pill-icon">${CURRENCY_ICONS[key]}</span>${currencyText(key)}
        </span>`).join('');
}

function updateEventBadge() {
    const n = claimableCount();
    eventBadge.textContent = String(n);
    eventBadge.classList.toggle('hidden', n === 0);
}

// 로비 새로고침: 로그인 상태면 클라우드 세이브를 다시 받아와 다른 기기/관리자
// 지급 등으로 바뀐 데이터를 반영한다. 게스트는 localStorage를 다시 읽기만 한다.
// 그 다음 페이지 자체를 새로고침해서 배포된 최신 코드(index.html/js/css)까지
// 같이 반영한다 -- 데이터만 다시 받아오는 걸로는 새 캐릭터·기능처럼 코드 자체가
// 바뀐 부분은 반영이 안 됐었다.
const lobbyRefreshBtn = document.getElementById('lobby-refresh-btn');
async function refreshLobbyData() {
    if (currentUser && currentUser.session_token) {
        try {
            const { data, error } = await sb.rpc('br_get_me', { p_token: currentUser.session_token });
            if (error) throw error;
            currentUser = { ...data, session_token: currentUser.session_token };
            updateMenuAuthUI();
            await applyCloudGameData(data.game_data);
        } catch (e) {
            // 네트워크 오류 등이면 로컬 데이터를 그대로 둔다.
        }
    } else {
        gameData = loadGameData();
    }
    renderCurrencyBar();
    renderItemsBadge();
    updateEventBadge();
    updateSelectedCharLabel();
}
if (lobbyRefreshBtn) {
    lobbyRefreshBtn.addEventListener('click', async () => {
        if (lobbyRefreshBtn.disabled) return;
        lobbyRefreshBtn.disabled = true;
        lobbyRefreshBtn.classList.add('spinning');
        await Promise.all([refreshLobbyData(), new Promise(r => setTimeout(r, 400))]);
        window.location.reload();
    });
}


// The 전체 클리어 bonus is the only thing here you press a button to take --
// stage tickets are paid the moment the stage is first cleared.
function claimEventBonus() {
    if (eventBonusClaimed() || !bothSidesCleared()) return;
    gameData.eventClaimed.push('both');
    // Paid in BOTH tickets: one side's ticket is no use on the other's banner.
    Object.keys(EV.stages).forEach(k => grantTickets(ticketKeyOf(k), EV.bothClearedReward));
    saveGameData(gameData);
    renderEventScreen();
    updateEventBadge();
}

// Which side a stage (or that side's boss) belongs to, so it pays the right ticket.
function eventSideOf(id) {
    return Object.keys(EV.stages).find(k =>
        eventStages(k).some(s => s.id === id) || (eventBoss(k) && eventBoss(k).id === id)) || 'water';
}

// The normal stages pay ONCE -- they can't be replayed at all. The boss is the
// opposite: it can be run forever and pays its ticket every single clear, which
// is where the endless ticket supply comes from.
function rewardEventStage(id) {
    const stage = eventStageById(id);
    if (!stage) return null;
    const repeat = !!stage.repeatable;
    if (!repeat && eventStageCleared(id)) return null;
    if (!eventStageCleared(id)) gameData.eventCleared.push(id);
    const key = ticketKeyOf(eventSideOf(id));
    grantTickets(key, stage.reward);
    saveGameData(gameData);
    updateEventBadge();
    return { amount: stage.reward, label: CURRENCY_LABELS[key], repeat };
}

// One stage card, read top to bottom: badge, name, status, reward, 입장.
// A cleared stage is DONE -- there is no replaying it, so its button is spent.
function stageCardHtml(stage, index, side, sideKey) {
    const cleared = eventStageCleared(stage.id);
    const unlocked = eventStageUnlocked(sideKey, index);
    let btn;
    if (cleared) btn = `<button class="ev-claim-btn" disabled>클리어 완료</button>`;
    else if (!unlocked) btn = `<button class="ev-claim-btn" disabled>🔒 잠김</button>`;
    else btn = `<button class="ev-claim-btn" data-stage="${stage.id}">입장</button>`;
    return `<div class="ev-mission ev-stage${cleared ? ' claimed' : ''}${unlocked ? '' : ' locked'}">`
        + `<div class="ev-mission-badge"><span class="ev-badge-icon">${side.icon}</span>`
        + `<span class="ev-badge-step">${index + 1}</span></div>`
        + `<div class="ev-mission-name">${stage.name}</div>`
        + `<div class="ev-mission-text">`
        + `${cleared ? '<span class="ev-stage-done">✔ 클리어</span>' : (unlocked ? '한 번만 도전 가능' : '앞 스테이지를 먼저 클리어')}</div>`
        + `<div class="ev-reward-chip"><span class="ev-reward-icon">🎫</span>`
        + `<span class="ev-reward-amount">${stage.reward}</span></div>`
        + btn
        + `</div>`;
}

// The boss sits at the end of the row: it needs all four, then never locks
// again. Every clear pays its ticket, so this is the endless ticket source.
function bossCardHtml(boss, side, sideKey) {
    const open = eventBossUnlocked(sideKey);
    const beaten = eventStageCleared(boss.id);
    const btn = open
        ? `<button class="ev-claim-btn" data-stage="${boss.id}">${beaten ? '다시 도전' : '도전'}</button>`
        : `<button class="ev-claim-btn" disabled>🔒 잠김</button>`;
    return `<div class="ev-mission ev-stage ev-boss${open ? '' : ' locked'}">`
        + `<div class="ev-mission-badge ev-boss-badge"><span class="ev-badge-icon">👑</span>`
        + `<span class="ev-badge-step">BOSS</span></div>`
        + `<div class="ev-mission-name">${boss.name}</div>`
        + `<div class="ev-mission-text">`
        + `${open ? '<span class="ev-boss-note">♾ 무한 반복 · 깔 때마다 티켓</span>'
            : '스테이지 4개를 모두 클리어'}</div>`
        + `<div class="ev-reward-chip"><span class="ev-reward-icon">🎫</span>`
        + `<span class="ev-reward-amount">${boss.reward}</span></div>`
        + btn
        + `</div>`;
}

// The bar across the top: how many stages are done and the 전체 클리어 reward.
function eventHeaderHtml() {
    const all = allEventStages();
    const done = all.filter(s => eventStageCleared(s.id)).length;
    const claimed = eventBonusClaimed();
    const claimCell = claimed
        ? '<span class="ev-claimed">획득 완료</span>'
        : `<button class="ev-claim-btn" data-bonus="1"${bothSidesCleared() ? '' : ' disabled'}>획득</button>`;
    return `<div class="ev-total">`
        + `<div class="ev-total-badge">🏆</div>`
        + `<div class="ev-total-main">`
        + `<div class="ev-total-title">${EV.name} 전체 클리어</div>`
        + `<div class="ev-mission-bar big"><div class="ev-mission-fill" style="width:${(done / all.length) * 100}%"></div>`
        + `<span class="ev-mission-count">${done}/${all.length}</span></div>`
        + `</div>`
        + `<div class="ev-reward-chip"><span class="ev-reward-icon">🎫</span>`
        + `<span class="ev-reward-amount">${EV.bothClearedReward}</span></div>`
        + claimCell
        + `</div>`;
}

function renderEventScreen() {
    eventTitleEl.textContent = `${EV.icon} ${EV.name}`;
    const sideKeyForTickets = EV.stages[eventCategory] ? eventCategory : 'water';
    const tkey = ticketKeyOf(sideKeyForTickets);
    eventTicketNameEl.textContent = CURRENCY_LABELS[tkey].replace(' 뽑기 티켓', '');
    eventTicketAmountEl.textContent = adminPowerOn('currencies') ? '∞' : String(ticketAmount(tkey));

    eventCategoriesEl.innerHTML = '';
    Object.entries(EV.stages).forEach(([key, side]) => {
        const cleared = side.stages.filter(s => eventStageCleared(s.id)).length;
        const btn = document.createElement('button');
        btn.className = 'shop-cat-btn ev-cat' + (key === eventCategory ? ' selected' : '');
        btn.dataset.eventCat = key;
        btn.innerHTML = `<span class="ev-cat-icon">${side.icon}</span>`
            + `<span class="ev-cat-body"><span class="ev-cat-label">${side.label}</span>`
            + `<span class="ev-cat-count">${cleared} / ${side.stages.length}</span></span>`;
        btn.addEventListener('click', () => { eventCategory = key; renderEventScreen(); });
        eventCategoriesEl.appendChild(btn);
    });

    const sideKey = EV.stages[eventCategory] ? eventCategory : 'water';
    const side = EV.stages[sideKey];
    eventContentEl.innerHTML = eventHeaderHtml()
        + `<div class="ev-mission-grid">`
        + side.stages.map((s, i) => stageCardHtml(s, i, side, sideKey)).join('')
        + (side.boss ? bossCardHtml(side.boss, side, sideKey) : '')
        + `</div>`;
}

eventContentEl.addEventListener('click', (e) => {
    const btn = e.target.closest ? e.target.closest('.ev-claim-btn') : null;
    if (!btn || btn.disabled) return;
    if (btn.dataset.bonus) claimEventBonus();
    else if (btn.dataset.stage) enterEventStage(btn.dataset.stage);
});

// Event stages run on the story engine -- the stage id IS the "floor" the room
// is opened with (see floorDefFor in shared.js).
function enterEventStage(id) {
    if (!SHARED.EVENT_STAGE_DEFS[id]) return;
    socket.emit('joinStoryFloor', { floor: id, charType: gameData.selectedCharacter || 'kicker', equip: equipPayload(gameData.selectedCharacter || 'kicker'), instinct: instinctPayload(gameData.selectedCharacter || 'kicker') });
}

eventBtn.addEventListener('click', () => {
    eventCategory = 'water';
    renderEventScreen();
    showScreen('event');
});
backFromEventBtn.addEventListener('click', () => showScreen('lobby'));
updateEventBadge();

// ---- Gacha ----
const gachaBtn = document.getElementById('gacha-btn');
const backFromGachaBtn = document.getElementById('back-from-gacha-btn');
const gachaNormalBtn = document.getElementById('gacha-normal-btn');
const gachaPullBackBtn = document.getElementById('gacha-pull-back-btn');
const gachaResultEl = document.getElementById('gacha-result');
const gachaTicketEl = document.getElementById('gacha-ticket-count');
const gachaNormalDescEl = document.getElementById('gacha-normal-desc');
const gachaDemonBtn = document.getElementById('gacha-demon-btn');
const gachaDemonDescEl = document.getElementById('gacha-demon-desc');
const gachaPullTitleEl = document.getElementById('gacha-pull-title');
const gachaPull1Btn = document.getElementById('gacha-pull-1-btn');
const gachaPull10Btn = document.getElementById('gacha-pull-10-btn');
const gachaSoulListEl = document.getElementById('gacha-soul-list');
const gachaOddsListEl = document.getElementById('gacha-odds-list');

// Rendered straight from GACHA_TABLE so the displayed odds can never drift from
// the odds actually rolled.
function renderGachaOdds() {
    const soulKey = SHARED.GACHA_SOUL_STONE_KEY;
    gachaOddsListEl.innerHTML = Object.entries(gachaBannerDef().table()).map(([key, pct]) => {
        const isSoul = key === soulKey;
        const noCookieYet = !isSoul && charactersOfGrade(key).length === 0;
        const label = isSoul
            ? `💎 ${key}`
            : `<span class="${gradeClass(key)}">${key}</span>`;
        return `<div class="gacha-odds-row${noCookieYet ? ' dim' : ''}">
            <span class="gacha-odds-label">${label}</span>
            <span class="gacha-odds-pct">${pct}%</span>
        </div>`;
    }).join('');
}

// Draws one outcome key from GACHA_TABLE by walking its cumulative weight, so
// the table can be edited freely without the code assuming any particular sum.
function pickGachaOutcome() {
    const entries = Object.entries(gachaBannerDef().table());
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = Math.random() * total;
    for (const [key, w] of entries) {
        if (r < w) return key;
        r -= w;
    }
    return entries[entries.length - 1][0]; // float rounding safety net
}

function charactersOfGrade(grade) {
    return Object.keys(SHARED.CHARACTERS).filter(id => SHARED.CHARACTERS[id].grade === grade);
}

// One pull: soul stone, a cookie, or -- for a grade that has no cookies yet
// (레전더리/비스트/게스트) -- an "empty grade" result reported honestly rather
// than silently redrawn, so the real rates stay observable while testing.
function rollGachaOnce() {
    const outcome = pickGachaOutcome();
    if (outcome === SHARED.GACHA_SOUL_STONE_KEY) {
        const ids = Object.keys(SHARED.CHARACTERS);
        return { kind: 'soul', charType: ids[Math.floor(Math.random() * ids.length)] };
    }
    const pool = charactersOfGrade(outcome);
    if (pool.length === 0) return { kind: 'emptyGrade', grade: outcome };
    return { kind: 'char', grade: outcome, charType: pool[Math.floor(Math.random() * pool.length)] };
}

function applyGachaResults(results) {
    let changed = false;
    for (const r of results) {
        if (r.kind === 'soul') {
            gameData.soulStones[r.charType] = (gameData.soulStones[r.charType] || 0) + (r.amount || 1);
            changed = true;
        } else if (r.kind === 'char') {
            if (gameData.unlockedCharacters.includes(r.charType)) {
                // 이미 보유한 케릭터가 또 나오면 그 케릭터 영혼석으로 대신 지급한다.
                r.duplicate = true;
                r.soulAmount = SHARED.DUPLICATE_CHAR_SOUL_STONES;
                gameData.soulStones[r.charType] = (gameData.soulStones[r.charType] || 0) + r.soulAmount;
            } else {
                gameData.unlockedCharacters.push(r.charType);
            }
            changed = true;
        }
    }
    if (changed) saveGameData(gameData);
}

function renderGachaResults(results) {
    gachaResultEl.innerHTML = gachaResultsHtml(results);
}

// Shared by both banners so a pull looks the same wherever it came from.
function gachaResultsHtml(results) {
    return results.map(r => {
        if (r.kind === 'emptyGrade') {
            return `<div class="gacha-card empty-grade">
                <span class="${gradeClass(r.grade)}">${r.grade}</span>
                <div class="gacha-card-name">아직 이 등급의 쿠키가 없습니다</div>
            </div>`;
        }
        const stats = SHARED.CHARACTERS[r.charType];
        if (r.kind === 'soul') {
            const have = gameData.soulStones[r.charType] || 0;
            return `<div class="gacha-card soul">
                <div class="gacha-card-icon soul-icon" style="background: ${charIconBackground(stats)}">💎</div>
                <div class="gacha-card-name">${stats.name}의 영혼석${r.amount > 1 ? ` x${r.amount}` : ''}</div>
                <div class="gacha-card-sub">${have} / ${SHARED.SOUL_STONES_PER_CHARACTER}</div>
            </div>`;
        }
        if (r.duplicate) {
            const have = gameData.soulStones[r.charType] || 0;
            return `<div class="gacha-card soul">
                <div class="gacha-card-icon soul-icon" style="background: ${charIconBackground(stats)}">💎</div>
                <span class="${gradeClass(stats.grade)}">${stats.grade}</span>
                <div class="gacha-card-name">${stats.name} (보유 중) → 영혼석 x${r.soulAmount}</div>
                <div class="gacha-card-sub">${have} / ${SHARED.SOUL_STONES_PER_CHARACTER}</div>
            </div>`;
        }
        return `<div class="gacha-card">
            <div class="gacha-card-icon" style="background: ${charIconBackground(stats)}"></div>
            <span class="${gradeClass(stats.grade)}">${stats.grade}</span>
            <div class="gacha-card-name">${stats.name}</div>
        </div>`;
    }).join('');
}

function renderSoulStones() {
    // 이미 보유한 캐릭터는 영혼석으로 "또" 얻을 수 없다 -- 그 캐릭터의 영혼석은
    // 대신 본능해제(캐릭터 상세화면)에 쓴다.
    const owned = Object.keys(SHARED.CHARACTERS)
        .filter(id => !isCharacterUnlocked(id))
        .map(id => ({ id, count: gameData.soulStones[id] || 0 }))
        .filter(e => e.count > 0)
        .sort((a, b) => b.count - a.count);
    if (owned.length === 0) {
        gachaSoulListEl.innerHTML = '<p class="gacha-result-empty">아직 모은 영혼석이 없습니다.</p>';
        return;
    }
    const need = SHARED.SOUL_STONES_PER_CHARACTER;
    gachaSoulListEl.innerHTML = owned.map(({ id, count }) => {
        const stats = SHARED.CHARACTERS[id];
        const ready = count >= need;
        const pct = Math.min(100, (count / need) * 100);
        return `<div class="gacha-soul-row">
            <div class="gacha-soul-icon" style="background: ${charIconBackground(stats)}"></div>
            <div class="gacha-soul-info">
                <div class="gacha-soul-name">${stats.name}</div>
                <div class="gacha-soul-bar-bg"><div class="gacha-soul-bar" style="width:${pct}%"></div></div>
            </div>
            <div class="gacha-soul-count">${count} / ${need}</div>
            <button class="gacha-claim-btn" data-char="${id}" ${ready ? '' : 'disabled'}>${ready ? '획득' : '부족'}</button>
        </div>`;
    }).join('');
}

// Spends a full set of one cookie's soul stones to unlock it. Only for cookies
// not owned yet -- an already-unlocked cookie's soul stones go to 본능해제 instead.
function claimCharacterFromSoulStones(charType) {
    if (isCharacterUnlocked(charType)) return;
    const need = SHARED.SOUL_STONES_PER_CHARACTER;
    const have = gameData.soulStones[charType] || 0;
    if (have < need) return;
    gameData.soulStones[charType] = have - need;
    gameData.unlockedCharacters.push(charType);
    saveGameData(gameData);
    renderSoulStones();
    const stats = SHARED.CHARACTERS[charType];
    gachaResultEl.innerHTML = `<div class="gacha-card">
        <div class="gacha-card-icon" style="background: ${charIconBackground(stats)}"></div>
        <span class="${gradeClass(stats.grade)}">${stats.grade}</span>
        <div class="gacha-card-name">${stats.name} 획득!</div>
    </div>`;
}

gachaSoulListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.gacha-claim-btn');
    if (btn && !btn.disabled) claimCharacterFromSoulStones(btn.dataset.char);
});

// 뽑기 화면은 일반 배너와 악마 배너가 같이 쓴다. 표와 티켓만 갈아 끼운다.
let gachaBanner = 'normal';
const GACHA_BANNERS = {
    normal: {
        title: '일반 뽑기', icon: '🏷️', ticket: 'ticketNormal',
        table: () => SHARED.GACHA_TABLE,
        hint: '스토리를 깔 때마다 한 장씩 들어옵니다.'
    },
    demon: {
        title: '악마 뽑기', icon: '😈', ticket: SHARED.DEMON_GACHA_KEY,
        table: () => SHARED.demonGachaTable(),
        hint: '게스트 레이드를 깰 때마다 들어옵니다.'
    }
};
function gachaBannerDef() { return GACHA_BANNERS[gachaBanner] || GACHA_BANNERS.normal; }

// 한 번에 티켓 한 장. 모자라면 아예 뽑히지 않는다.
function doGachaPull(count) {
    const b = gachaBannerDef();
    const have = currencyAmount(b.ticket);
    if (have < count) {
        gachaResultEl.innerHTML = `<p class="gacha-result-empty">${b.title} 티켓이 모자랍니다.`
            + ` (${currencyText(b.ticket)} / ${count}장 필요) ${b.hint}</p>`;
        return;
    }
    if (!adminPowerOn('currencies')) grantCurrencies({ [b.ticket]: -count });
    const results = [];
    for (let i = 0; i < count; i++) results.push(rollGachaOnce());
    applyGachaResults(results);
    renderGachaResults(results);
    renderSoulStones();
    updateGachaTicketLabel();
}

// 티켓이 몇 장 남았는지를 뽑기 화면과 배너에 같이 보여준다.
function updateGachaTicketLabel() {
    const b = gachaBannerDef();
    if (gachaTicketEl) gachaTicketEl.textContent = `${b.icon} ${currencyText(b.ticket)}장`;
    if (gachaPullTitleEl) gachaPullTitleEl.firstChild.textContent = b.title + ' ';
    if (gachaNormalDescEl) gachaNormalDescEl.textContent = `일반 뽑기 티켓 ${currencyText('ticketNormal')}장 보유 (1회당 1장)`;
    if (gachaDemonDescEl) gachaDemonDescEl.textContent = `악마 뽑기 티켓 ${currencyText(SHARED.DEMON_GACHA_KEY)}장 보유 (1회당 1장)`;
}

gachaPull1Btn.addEventListener('click', () => doGachaPull(1));
gachaPull10Btn.addEventListener('click', () => doGachaPull(10));

gachaBtn.addEventListener('click', () => {
    gachaBanner = 'normal';
    updateGachaTicketLabel();
    showScreen('gacha');
});
backFromGachaBtn.addEventListener('click', () => showScreen('lobby'));
function openGachaBanner(which) {
    gachaBanner = which;
    gachaResultEl.innerHTML = '<p class="gacha-result-empty">뽑기 버튼을 눌러보세요.</p>';
    updateGachaTicketLabel();
    renderGachaOdds();
    renderSoulStones();
    showScreen('gachaPull');
}
gachaNormalBtn.addEventListener('click', () => openGachaBanner('normal'));
gachaDemonBtn.addEventListener('click', () => openGachaBanner('demon'));
gachaPullBackBtn.addEventListener('click', () => showScreen('gacha'));

// ---- 레전더리 뽑기 ----
// Same table as the normal banner with two swaps: the featured cookie is pulled
// at LEGENDARY_BANNER_RATE, and the 영혼석 slot always pays THAT cookie's
// stones. Each pull costs one of that cookie's own event tickets.
const gachaLegendaryBtn = document.getElementById('gacha-legendary-btn');
const legendaryBackBtn = document.getElementById('legendary-back-btn');
const legendaryListEl = document.getElementById('legendary-list');
const legendaryContentEl = document.getElementById('legendary-content');
let selectedBanner = SHARED.LEGENDARY_BANNERS[0].id;

function bannerCookie(banner) {
    return SHARED.CHARACTERS[banner.charType] || null;
}
function bannerName(banner) {
    const c = bannerCookie(banner);
    return c ? c.name : (banner.name || banner.id);
}
function bannerTickets(banner) {
    return ticketAmount(banner.ticketKey);
}

// One pull on a banner: featured cookie, that cookie's stones, or the normal
// table's other outcomes.
function rollLegendaryOnce(banner) {
    const table = SHARED.legendaryGachaTable(banner.charType);
    const entries = Object.entries(table);
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = Math.random() * total;
    let outcome = entries[entries.length - 1][0];
    for (const [key, w] of entries) {
        if (r < w) { outcome = key; break; }
        r -= w;
    }
    if (outcome === 'featured') return { kind: 'char', grade: '레전더리', charType: banner.charType, featured: true };
    // 영혼석 is the ordinary one: any cookie, one stone -- same as 일반 뽑기.
    if (outcome === SHARED.GACHA_SOUL_STONE_KEY) {
        const ids = Object.keys(SHARED.CHARACTERS);
        return { kind: 'soul', charType: ids[Math.floor(Math.random() * ids.length)] };
    }
    const pool = charactersOfGrade(outcome).filter(id => id !== banner.charType);
    if (pool.length === 0) return { kind: 'emptyGrade', grade: outcome };
    return { kind: 'char', grade: outcome, charType: pool[Math.floor(Math.random() * pool.length)] };
}

function doLegendaryPull(count) {
    const banner = SHARED.legendaryBannerFor(selectedBanner);
    if (!banner || !bannerCookie(banner)) return;
    const have = bannerTickets(banner);
    if (have < count) return;
    if (!adminPowerOn('currencies')) {
        gameData.currencies[banner.ticketKey] = have - count;
        saveGameData(gameData);
    }
    const results = [];
    for (let i = 0; i < count; i++) results.push(rollLegendaryOnce(banner));
    applyGachaResults(results);
    renderLegendaryScreen(gachaResultsHtml(results));
}

// Only the one number anybody is actually pulling for. The rest of the table is
// the normal banner's and would just crowd the screen out.
function legendaryOddsHtml(banner) {
    const pct = SHARED.legendaryGachaTable(banner.charType).featured;
    return `<div class="gacha-odds-row lg-featured-odds">`
        + `<span class="gacha-odds-label"><span class="grade-legendary">★ ${bannerCookie(banner).name}</span></span>`
        + `<span class="gacha-odds-pct">${pct}%</span></div>`;
}

function renderLegendaryScreen(resultHtml) {
    legendaryListEl.innerHTML = '';
    SHARED.LEGENDARY_BANNERS.forEach(b => {
        const ready = !!bannerCookie(b);
        const btn = document.createElement('button');
        btn.className = 'shop-cat-btn ev-cat' + (b.id === selectedBanner ? ' selected' : '')
            + (ready ? '' : ' lg-soon');
        btn.dataset.banner = b.id;
        btn.innerHTML = `<span class="ev-cat-icon">${b.icon}</span>`
            + `<span class="ev-cat-body"><span class="ev-cat-label">${bannerName(b)}</span>`
            + `<span class="ev-cat-count">🎫 ${adminPowerOn('currencies') ? '∞' : bannerTickets(b)}장${ready ? '' : ' · 준비중'}</span></span>`;
        btn.addEventListener('click', () => { selectedBanner = b.id; renderLegendaryScreen(); });
        legendaryListEl.appendChild(btn);
    });

    const banner = SHARED.legendaryBannerFor(selectedBanner);
    const cookie = bannerCookie(banner);
    if (!cookie) {
        legendaryContentEl.innerHTML = `<div class="lg-soon-note">${bannerName(banner)}는 아직 준비중입니다.<br>`
            + `모아둔 🎫 ${adminPowerOn('currencies') ? '∞' : bannerTickets(banner)}장은 그대로 남아 있어요.</div>`;
        return;
    }
    const tickets = bannerTickets(banner);
    const stones = gameData.soulStones[banner.charType] || 0;
    const need = SHARED.SOUL_STONES_PER_CHARACTER;
    const owned = isCharacterUnlocked(banner.charType);
    legendaryContentEl.innerHTML = `<div class="lg-head">`
        + `<div class="lg-icon" style="background:${charIconBackground(cookie)}"></div>`
        + `<div class="lg-head-main"><div class="lg-name">${cookie.name}`
        + `${owned ? ' <span class="lg-owned">보유중</span>' : ''}</div>`
        + `<div class="lg-tickets">🎫 ${CURRENCY_LABELS[banner.ticketKey]} `
        + `<b>${adminPowerOn('currencies') ? '∞' : tickets}</b>장 · 1회당 1장</div>`
        + `<div class="ev-mission-bar big"><div class="ev-mission-fill" style="width:${Math.min(100, (stones / need) * 100)}%"></div>`
        + `<span class="ev-mission-count">영혼석 ${stones}/${need}</span></div></div></div>`
        // Results scroll inside their own box and the buttons live in a column
        // beside them, so a 10-pull can't shove the buttons off the screen.
        + `<div class="lg-body">`
        + `<div class="lg-main">`
        + `<div class="gacha-odds-list lg-odds">${legendaryOddsHtml(banner)}</div>`
        + `<div id="legendary-result" class="gacha-result lg-result">${resultHtml
            || '<p class="gacha-result-empty">티켓을 써서 뽑아보세요.</p>'}</div>`
        + `</div>`
        + `<div class="lg-side">`
        + `<button class="play-btn lg-pull" data-count="1"${tickets < 1 ? ' disabled' : ''}>1회 뽑기<br><small>🎫1</small></button>`
        + `<button class="play-btn lg-pull" data-count="10"${tickets < 10 ? ' disabled' : ''}>10회 뽑기<br><small>🎫10</small></button>`
        + `<button class="secondary-btn lg-claim"${stones < need ? ' disabled' : ''}>영혼석으로 획득<br><small>${stones}/${need}</small></button>`
        + `</div>`
        + `</div>`;
}

legendaryContentEl.addEventListener('click', (e) => {
    const pull = e.target.closest ? e.target.closest('.lg-pull') : null;
    if (pull && !pull.disabled) { doLegendaryPull(Number(pull.dataset.count)); return; }
    const claim = e.target.closest ? e.target.closest('.lg-claim') : null;
    if (claim && !claim.disabled) {
        claimCharacterFromSoulStones(SHARED.legendaryBannerFor(selectedBanner).charType);
        renderLegendaryScreen();
    }
});

gachaLegendaryBtn.addEventListener('click', () => {
    renderLegendaryScreen();
    showScreen('legendary');
});
legendaryBackBtn.addEventListener('click', () => showScreen('gacha'));

detailChangeCharBtn.addEventListener('click', () => openCharacterSelect('bossDetail'));

// ---- Mode select ----
playBtn.addEventListener('click', () => showScreen('modeSelect'));
backFromModeBtn.addEventListener('click', () => showScreen('lobby'));
bossRaidModeCard.addEventListener('click', () => {
    renderBossList();
    showScreen('bossSelect');
});
// 50층(얼음/서리 챕터 보스)을 깨기 전에는 지금까지와 똑같이 바로
// 멀티/솔로 화면으로 간다. 깬 뒤에는 레전드 스토리 갈림길을 먼저 보여준다.
storyModeCard.addEventListener('click', () => {
    if (gameData.clearedStoryFloors.includes(50)) showScreen('storyFork');
    else showScreen('storyMode');
});

// ---- Story fork: legend story (locked, 준비중) / story mode ----
document.getElementById('story-fork-story-card').addEventListener('click', () => showScreen('storyMode'));
document.getElementById('back-from-story-fork-btn').addEventListener('click', () => showScreen('modeSelect'));

// ---- Story mode: multi (locked) / solo entry ----
const backFromStoryModeBtn = document.getElementById('back-from-story-mode-btn');
const storySoloBtn = document.getElementById('story-solo-btn');
const storyMultiBtn = document.getElementById('story-multi-btn');
const towerPartnerPreview = document.getElementById('tower-partner-preview');
const towerPartnerIcon = document.getElementById('tower-partner-icon');
const towerPartnerName = document.getElementById('tower-partner-name');
const towerFloorListEl = document.getElementById('tower-floor-list');
const towerCharPreview = document.getElementById('tower-char-preview');
const towerCharIcon = document.getElementById('tower-char-icon');
const towerCharName = document.getElementById('tower-char-name');
const towerPlayBtn = document.getElementById('tower-play-btn');
const backFromTowerBtn = document.getElementById('back-from-tower-btn');

towerCharPreview.addEventListener('click', () => openCharacterSelect('storyTower'));

backFromStoryModeBtn.addEventListener('click', () => showScreen('modeSelect'));
// 타워를 솔로로 들어왔는지 멀티로 들어왔는지. 멀티면 플레이 버튼이 레이드처럼
// "짝 찾기 -> 둘 다 준비 -> 시작" 순서로 움직인다.
let storyIsMulti = false;
let storyPhase = 'idle'; // 'idle' | 'searching' | 'matched'
let storyMyReady = false;
let storySearchStartAt = 0;
let storySearchHandle = null;

storySoloBtn.addEventListener('click', () => {
    storyIsMulti = false;
    selectedStoryFloor = resumeStoryFloor();
    resetTowerActions();
    renderTower();
    showScreen('storyTower');
});
storyMultiBtn.addEventListener('click', () => {
    storyIsMulti = true;
    selectedStoryFloor = resumeStoryFloor();
    resetTowerActions();
    renderTower();
    showScreen('storyTower');
});

// ---- Story tower: floor select ----
// 59층(용암 챕터)까지 만들어져 있다. 더 늘어나면 이 숫자만 올리면 된다.
const STORY_TOTAL_FLOORS = 59;
let selectedStoryFloor = 1;
// What the story engine was actually entered with -- a floor number from the
// tower, or an event stage id. Decides where 나가기 sends you back to.
let activeStoryFloor = null;

// 타워를 열면 1층이 아니라 이어서 할 층에서 시작한다. 마지막으로 깬 층의
// 다음 층 -- 없으면 1층이고, 다 깼으면 마지막 층에 머문다.
function resumeStoryFloor() {
    const cleared = (gameData.clearedStoryFloors || [])
        .filter(f => typeof f === 'number' && f >= 1);
    if (!cleared.length) return 1;
    const last = Math.max(...cleared);
    return Math.min(STORY_TOTAL_FLOORS, last + 1);
}

// 11층부터 데려가는 두 번째 쿠키. 첫 칸은 늘 로비에서 고른 쿠키다.
let storyPartySecond = null;
function storyPartyIds() {
    const first = gameData.selectedCharacter || 'kicker';
    let second = storyPartySecond;
    if (!second || !SHARED.CHARACTERS[second] || !isCharacterUnlocked(second) || second === first) {
        second = Object.keys(SHARED.CHARACTERS)
            .find(id => id !== first && isCharacterUnlocked(id)) || first;
    }
    return [first, second];
}

function renderTowerParty() {
    const size = SHARED.storyPartySizeFor(selectedStoryFloor);
    towerPartyEl.classList.toggle('hidden', size < 2);
    if (size < 2) return;
    towerPartyEl.innerHTML = storyPartyIds().map((id, i) => {
        const st = SHARED.CHARACTERS[id] || SHARED.CHARACTERS.kicker;
        return `<button class="tower-party-slot" data-slot="${i}">
            <span class="tps-circle" style="background:${charIconBackground(st)}"></span>
            <span class="tps-name">${st.shortName || st.name}</span>
        </button>`;
    }).join('');
}

towerPartyEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.tower-party-slot');
    if (!btn) return;
    const slot = Number(btn.dataset.slot);
    leaveStoryRoomIfWaiting();
    openCharacterSelect('storyTower', {
        selectedId: storyPartyIds()[slot],
        onPick: (id) => {
            if (slot === 0) { gameData.selectedCharacter = id; saveGameData(gameData); updateSelectedCharLabel(); }
            else storyPartySecond = id;
            renderTower();
        }
    });
});

function isFloorUnlocked(floor) {
    if (adminPowerOn('stages')) return true; // 관리자 전용: every difficulty is open
    if (floor === 1) return true;
    return gameData.clearedStoryFloors.includes(floor - 1);
}

function renderTower() {
    towerFloorListEl.innerHTML = '';
    let start = selectedStoryFloor - 1;
    let end = selectedStoryFloor + 1;
    if (start < 1) { end += (1 - start); start = 1; }
    if (end > STORY_TOTAL_FLOORS) { start -= (end - STORY_TOTAL_FLOORS); end = STORY_TOTAL_FLOORS; }
    start = Math.max(1, start);
    const floors = [];
    for (let f = start; f <= end; f++) floors.push(f);
    floors.reverse(); // higher floor number renders toward the top, like a real tower

    floors.forEach(f => {
        const unlocked = isFloorUnlocked(f);
        const card = document.createElement('div');
        const isBoss = SHARED.isTowerBossFloor(f);
        card.className = 'floor-card' + (unlocked ? '' : ' locked')
            + (f === selectedStoryFloor ? ' selected' : '') + (isBoss ? ' boss-floor' : '');
        // 10층마다 오는 보스전은 한눈에 구분되어야 한다 -- 레전더리가 여기서만 나온다.
        const label = isBoss ? `${f}층 보스` : `${f}층`;
        card.textContent = unlocked ? label : `🔒 ${label}`;
        if (unlocked) {
            card.addEventListener('click', () => {
                if (f !== selectedStoryFloor) leaveStoryRoomIfWaiting();
                selectedStoryFloor = f;
                renderTower();
            });
        }
        towerFloorListEl.appendChild(card);
    });

    const floorDef = SHARED.STORY_FLOOR_DEFS[selectedStoryFloor];
    const stats = SHARED.CHARACTERS[gameData.selectedCharacter] || SHARED.CHARACTERS.kicker;
    towerCharIcon.style.background = charIconBackground(stats);
    towerCharName.textContent = stats.name;
    towerRewardsEl.innerHTML = rewardChipsHtml(SHARED.clearRewardFor(SHARED.storyRewardKey(selectedStoryFloor)))
        + (SHARED.isTowerBossFloor(selectedStoryFloor) ? legendaryDropChipHtml() : '');
    renderTowerParty();
    towerPlayBtn.disabled = !isFloorUnlocked(selectedStoryFloor) || !floorDef;
    // 짝을 기다리는 중에는 위 판정과 상관없이 버튼 상태를 건드리지 않는다.
    if (storyPhase === 'searching' || storyMyReady) towerPlayBtn.disabled = true;
    else if (storyPhase === 'idle') towerPlayBtn.textContent = storyIsMulti ? '멀티플레이' : '플레이';
}

backFromTowerBtn.addEventListener('click', () => {
    leaveStoryRoomIfWaiting();
    showScreen('storyMode');
});

function stopStorySearchTimer() {
    if (storySearchHandle) clearInterval(storySearchHandle);
    storySearchHandle = null;
}

function updateStorySearchLabel() {
    const secs = Math.floor((Date.now() - storySearchStartAt) / 1000);
    towerPlayBtn.textContent = `대기중 (${secs}초)`;
}

// 타워 화면을 처음 상태로. 층을 고르는 중에는 늘 이 상태다.
function resetTowerActions() {
    storyPhase = 'idle';
    storyMyReady = false;
    stopStorySearchTimer();
    towerPlayBtn.textContent = storyIsMulti ? '멀티플레이' : '플레이';
    towerPartnerPreview.classList.add('hidden');
}

// 짝을 기다리는 중에 층을 바꾸거나 화면을 뜨면 방에서 빠져나온다.
function leaveStoryRoomIfWaiting() {
    if (storyPhase !== 'idle') socket.emit('leaveStoryRoom');
    resetTowerActions();
}

towerPlayBtn.addEventListener('click', () => {
    if (towerPlayBtn.disabled) return;
    if (!SHARED.STORY_FLOOR_DEFS[selectedStoryFloor]) return; // no content for this floor yet
    const charType = gameData.selectedCharacter || 'kicker';
    // 11층부터는 쿠키 두 명을 같이 보낸다. 그 아래 층은 지금까지와 똑같다.
    const partyPayload = SHARED.storyPartySizeFor(selectedStoryFloor) > 1
        ? { party: storyPartyIds(), equipParty: storyPartyIds().map(equipPayload), instinctParty: storyPartyIds().map(instinctPayload) }
        : {};
    if (!storyIsMulti) {
        socket.emit('joinStoryFloor', { floor: selectedStoryFloor, charType, equip: equipPayload(charType), instinct: instinctPayload(charType), solo: true, ...partyPayload });
        return;
    }
    if (storyPhase === 'idle') {
        storyPhase = 'searching';
        towerPlayBtn.disabled = true;
        storySearchStartAt = Date.now();
        updateStorySearchLabel();
        storySearchHandle = setInterval(updateStorySearchLabel, 1000);
        socket.emit('joinStoryFloor', { floor: selectedStoryFloor, charType, equip: equipPayload(charType), instinct: instinctPayload(charType), solo: false, ...partyPayload });
    } else if (storyPhase === 'matched' && !storyMyReady) {
        storyMyReady = true;
        towerPlayBtn.disabled = true;
        towerPlayBtn.textContent = '플레이 (대기중)';
        socket.emit('storyPlayerReady');
    }
});

// 짝이 붙거나 떨어질 때마다 버튼과 파트너 칸을 고쳐 그린다.
socket.on('storyRoomUpdate', (data) => {
    // 레전드 스토리 같이하기도, 각성모드 같이하기도 이 이벤트를 그대로 쓴다
    // (findOpenStoryRoom/스토리 방을 그대로 재사용하기 때문). 짝 찾는 중이면
    // 여기서 갈라진다.
    if (legendPhase !== 'idle') {
        if (data.count >= 2) {
            legendPhase = 'matched';
            stopLegendSearchTimer();
            const partner = Object.entries(data.players).find(([id]) => id !== socket.id);
            if (partner) {
                const pStats = SHARED.CHARACTERS[partner[1].charType] || SHARED.CHARACTERS.kicker;
                legendPartnerIconEl.style.background = charIconBackground(pStats);
                legendPartnerNameEl.textContent = pStats.name;
                legendPartnerPreviewEl.classList.remove('hidden');
            }
            renderWaitingScene(LEGEND_WAIT_ELS, data.players, true);
            if (!legendMyReady) {
                legendPlayBtn.textContent = '▶ 준비';
                legendPlayBtn.disabled = false;
            }
        } else {
            // 같이 기다리던 사람이 나갔다 -- 다시 혼자 기다린다.
            legendPhase = 'searching';
            legendMyReady = false;
            legendPartnerPreviewEl.classList.add('hidden');
            renderWaitingScene(LEGEND_WAIT_ELS, data.players, false);
            legendPlayBtn.disabled = true;
            legendSearchStartAt = Date.now();
            updateLegendSearchLabel();
            stopLegendSearchTimer();
            legendSearchHandle = setInterval(updateLegendSearchLabel, 1000);
        }
        return;
    }
    if (awakenPhase !== 'idle') {
        if (data.count >= 2) {
            awakenPhase = 'matched';
            stopAwakenSearchTimer();
            const partner = Object.entries(data.players).find(([id]) => id !== socket.id);
            if (partner) {
                const pStats = SHARED.CHARACTERS[partner[1].charType] || SHARED.CHARACTERS.kicker;
                awakenPartnerIconEl.style.background = charIconBackground(pStats);
                awakenPartnerNameEl.textContent = pStats.name;
                awakenPartnerPreviewEl.classList.remove('hidden');
            }
            renderWaitingScene(AWAKEN_WAIT_ELS, data.players, true);
            if (!awakenMyReady) {
                awakenPlayBtn.textContent = '▶ 준비';
                awakenPlayBtn.disabled = false;
            }
        } else {
            // 같이 기다리던 사람이 나갔다 -- 다시 혼자 기다린다.
            awakenPhase = 'searching';
            awakenMyReady = false;
            awakenPartnerPreviewEl.classList.add('hidden');
            renderWaitingScene(AWAKEN_WAIT_ELS, data.players, false);
            awakenPlayBtn.disabled = true;
            awakenSearchStartAt = Date.now();
            updateAwakenSearchLabel();
            stopAwakenSearchTimer();
            awakenSearchHandle = setInterval(updateAwakenSearchLabel, 1000);
        }
        return;
    }
    if (screens.storyTower.classList.contains('hidden')) return;
    if (data.count >= 2) {
        storyPhase = 'matched';
        stopStorySearchTimer();
        const partner = Object.entries(data.players).find(([id]) => id !== socket.id);
        if (partner) {
            const pStats = SHARED.CHARACTERS[partner[1].charType] || SHARED.CHARACTERS.kicker;
            towerPartnerIcon.style.background = charIconBackground(pStats);
            towerPartnerName.textContent = pStats.name;
            towerPartnerPreview.classList.remove('hidden');
        }
        renderWaitingScene(TOWER_WAIT_ELS, data.players, true);
        if (!storyMyReady) {
            towerPlayBtn.textContent = '플레이';
            towerPlayBtn.disabled = false;
        }
    } else if (storyPhase !== 'idle') {
        // 같이 기다리던 사람이 나갔다 -- 다시 혼자 기다린다.
        storyPhase = 'searching';
        storyMyReady = false;
        towerPartnerPreview.classList.add('hidden');
        renderWaitingScene(TOWER_WAIT_ELS, data.players, false);
        towerPlayBtn.disabled = true;
        storySearchStartAt = Date.now();
        updateStorySearchLabel();
        stopStorySearchTimer();
        storySearchHandle = setInterval(updateStorySearchLabel, 1000);
    }
});

// ---- Story fight: floor bridge combat ----
const storyCanvas = document.getElementById('storyCanvas');
const storyCtx = storyCanvas.getContext('2d');
const storyMyHpBar = document.getElementById('story-my-hp-bar');
const storyMyShieldBadge = document.getElementById('story-my-shield-badge');
const storyMySkillCdEl = document.getElementById('story-my-skill-cd');
const storyMyUltimateCdEl = document.getElementById('story-my-ultimate-cd');
const storyMonstersLeftEl = document.getElementById('story-monsters-left');
// 체력 바 한가운데의 숫자 (남은 체력 / 최대 체력).
const storyMyHpText = document.getElementById('story-my-hp-text');
const storyPartnerHpText = document.getElementById('story-partner-hp-text');
const myHpText = document.getElementById('my-hp-text');
const partnerHpText = document.getElementById('partner-hp-text');
// 체력은 회복이 소수로 붙는 곳이 있어서 올림해서 보여 준다.
function hpBarLabel(hp, maxHp) {
    return `${Math.max(0, Math.ceil(hp || 0))} / ${Math.round(maxHp || 0)}`;
}
const storyPartnerHpContainer = document.getElementById('story-partner-hp-container');
const storyPartnerHpBar = document.getElementById('story-partner-hp-bar');
const storyPartnerShieldBadge = document.getElementById('story-partner-shield-badge');
const storyLeaveBtn = document.getElementById('story-leave-btn');

// 파트너가 있을 때만 오른쪽 아래에 체력 바를 띄운다.
function renderStoryPartnerHp() {
    const partner = Object.values(storyPartners)[0];
    if (!partner) {
        storyPartnerHpContainer.classList.add('hidden');
        return;
    }
    storyPartnerHpContainer.classList.remove('hidden');
    const pct = Math.max(0, Math.min(1, partner.hp / (partner.maxHp || 1)));
    storyPartnerHpBar.style.width = (pct * 100) + '%';
    storyPartnerHpText.textContent = hpBarLabel(partner.hp, partner.maxHp);
    storyPartnerShieldBadge.classList.toggle('hidden', !(partner.shieldHp > 0));
}

// 화면 크기 조정(휴대폰용)이 켜지면 카메라를 살짝 zoom-out해서 다리 위/아래로
// 더 넓게 보이게 한다 -- 스토리 캔버스는 항상 창 크기 그대로라, 작은 화면일수록
// 보이는 세계가 좁아지는 걸 이걸로 벌충한다. 꺼져 있으면 1배(기존 그대로).
const STORY_COMPACT_SCALE = 0.72;
let storyScale = 1;
function resizeStoryCanvas() {
    storyCanvas.width = window.innerWidth;
    storyCanvas.height = window.innerHeight;
    storyScale = compactModeEnabled ? STORY_COMPACT_SCALE : 1;
}
window.addEventListener('resize', resizeStoryCanvas);
resizeStoryCanvas();

let storyFloorDef = null;
let storyPlayer = null; // {x,y,hp,maxHp,facing,charType,alive,lastAttackClientTime,...}
let storyMonsters = {}; // id -> {type,x,y,hp,maxHp,alive,state}
// 서버가 보내는 몬스터 스냅샷은 매번 통째로 갈아 끼워지는데, 20층 보스의
// trick/trickFlickerReal/trickReflectFlashAt 같은 클라이언트 전용 표시 필드는
// 그 스냅샷에 없다. 그냥 storyMonsters = monsters로 덮어쓰면 clownTelegraph 등이
// 세팅한 값이 다음 틱(50ms)마다 사라져서 화면에 거의 안 보이게 된다 -- 그래서
// 스냅샷을 받을 때마다 기존 항목 위에 얹어 쓴다(merge), 통째로 갈아 끼우지 않는다.
function mergeStoryMonsters(next) {
    const merged = {};
    for (const [id, nm] of Object.entries(next || {})) {
        const prev = storyMonsters[id];
        merged[id] = prev ? { ...prev, ...nm } : nm;
    }
    storyMonsters = merged;
}
// 같이 들어온 사람. 내 것은 여기 안 들어온다 (내 쿠키는 storyPlayer가 주인).
// 서버 틱(50ms)마다 통째로 갈아 끼우고, 그 사이는 그냥 마지막 자리에 그린다.
let storyPartners = {};
// 번개지옥맛 궁극기가 부른 부하들. 서버 틱마다 통째로 갈아 끼운다.
let storySummons = {};
let storyMouseX = null;
let storyMouseY = null;
let storyLoopHandle = null;
let storyLastMoveEmit = 0;
let isStoryTargetingUltimate = false;
let isStoryTargetingSkill = false;
let storyImpactEffects = []; // [{x, y, radius, until}]
// Arrows in flight (ranged monsters). Held as id -> {x,y,vx,vy,angle,at} where
// `at` is when that position was received, so the render can dead-reckon
// between the server's 50ms ticks instead of visibly stepping.
let storyProjectiles = {};
let storyProjectileSparks = []; // [{x, y, until}] brief flash where an arrow landed
let storyGreatSlashes = []; // [{x, y, facing, range, width, windupMs, until}] 크게베기
let storyDrops = {}; // id -> thrown 물방울 in flight
let storyDropSplashes = []; // [{x, y, until}]
let storyMagmaZones = []; // [{x, y, radius, until}] long-lived damage zones (volcano cookie ultimate)
let storyFireLineZones = []; // [{x, y, facing, range, width, until}] 불꽃요정맛 궁극기 지대
let storyQuakeUntil = 0; // camera shakes until this timestamp (earthquake ultimate)

socket.on('storyFloorStarted', (data) => {
    activeStoryFloor = data.floor; // a floor number, or an event stage id
    storyPartners = {};
    if (data.players) {
        Object.entries(data.players).forEach(([id, pl]) => {
            if (id !== socket.id) storyPartners[id] = pl;
        });
    }
    renderStoryPartnerHp();
    storyFloorDef = data.floorDef;
    storyMonsters = data.monsters;
    storyLegendSwitchesHit = {};
    storyLegendChestsHit = {};
    const p = data.player;
    storyPlayer = {
        x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, facing: p.facing, charType: p.charType, alive: true, shieldHp: p.shieldHp || 0,
        equipSpeed: 0, equipCooldown: 1, // filled in below from what this cookie has on
        lastAttackClientTime: -Infinity, lastSkillClientTime: -Infinity, lastUltimateClientTime: -Infinity,
        attackEffectUntil: 0, skillEffectUntil: 0, ultimateEffectUntil: 0, healEffectUntil: 0, speedBoostUntil: 0, awakenUntil: 0, rapidStrikeUntil: 0,
        natureBoostUntil: 0, natureAwakenLevel: 0,
        comboStage: 0, attackEffectStage: null, spearSide: 0, attackEffectSide: 0,
        tideStage: 1 // 바다펄맛 밀물은 언제나 1단계부터 시작한다
    };
    isStoryTargetingUltimate = false;
    isStoryTargetingSkill = false;
    storyImpactEffects = [];
    storyMagmaZones = [];
    storyFireLineZones = [];
    storyProjectiles = {};
    storyProjectileSparks = [];
    storyDrops = {};
    storyDropSplashes = [];
    storyGreatSlashes = [];
    storyQuakeUntil = 0;
    updateStoryHpBar();
    // 서버가 공격력·체력·받는 피해를 맡고, 이동 속도와 쿠다운 표시는 클라이언트 몴이다.
    const myBonus = equipBonusOf(p.charType);
    storyPlayer.equipSpeed = myBonus.speed;
    storyPlayer.equipCooldown = myBonus.cooldown;
    updateStoryMonstersLeft();
    // 각성모드면 파티 3명이 같이 들어온다.
    awakenFightParty = p.party
        ? {
            party: p.party.slice(), active: p.active || 0,
            partyAlive: p.partyAlive.slice(),
            partyHp: p.partyHp.slice(), partyMaxHp: p.partyMaxHp.slice()
        }
        : null;
    renderAwakenSwapBar();
    syncMobileButtonIcons(p.charType, true);
    showScreen('storyFight');
    startStoryLoop();
});

// ---- 각성모드: 싸우는 중의 파티 교체 ----
// 살아 있는 쿠키끼리 아무 때나 바꿀 수 있다. 쓰러진 쿠키는 회색으로 남는다.
const awakenSwapBar = document.getElementById('awaken-swap-bar');
let awakenFightParty = null; // { party, active, partyAlive, partyHp, partyMaxHp } | null

function renderAwakenSwapBar() {
    if (!awakenSwapBar) return;
    const s = awakenFightParty;
    awakenSwapBar.classList.toggle('hidden', !s);
    if (!s) { awakenSwapBar.innerHTML = ''; return; }
    awakenSwapBar.innerHTML = s.party.map((id, i) => {
        const stats = SHARED.CHARACTERS[id] || SHARED.CHARACTERS.kicker;
        const alive = s.partyAlive[i];
        const pct = Math.max(0, Math.min(1, (s.partyHp[i] || 0) / (s.partyMaxHp[i] || 1)));
        return `
            <button class="awaken-swap-btn${i === s.active ? ' active' : ''}${alive ? '' : ' down'}"
                    data-index="${i}" ${alive && i !== s.active ? '' : 'disabled'}>
                <span class="swap-swatch" style="background:${charIconBackground(stats)}"></span>
                <span class="swap-name">${stats.shortName || stats.name}</span>
                <span class="swap-hp"><span class="swap-hp-fill" style="width:${Math.round(pct * 100)}%"></span></span>
            </button>`;
    }).join('');
}

awakenSwapBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.awaken-swap-btn');
    if (!btn || btn.disabled) return;
    socket.emit('awakenSwap', { index: Number(btn.dataset.index) });
});

// 각성모드: 쿠키 하나가 쓰러지면 다음 쿠키가 들어온다. 셋이 다 쓰러져야 진다.
socket.on('storyPlayerSwapped', ({ id, charType, hp, maxHp, active, partyAlive, partyHp }) => {
    if (id !== socket.id || !storyPlayer) return;
    if (awakenFightParty) {
        if (active != null) awakenFightParty.active = active;
        if (partyAlive) awakenFightParty.partyAlive = partyAlive;
        if (partyHp) awakenFightParty.partyHp = partyHp;
        awakenFightParty.partyHp[awakenFightParty.active] = hp;
        renderAwakenSwapBar();
    }
    storyPlayer.charType = charType;
    storyPlayer.hp = hp;
    storyPlayer.maxHp = maxHp;
    storyPlayer.alive = true;
    storyPlayer.shieldHp = 0;
    // 새 쿠키는 자기 쿨다운을 처음부터 쓴다.
    storyPlayer.lastAttackClientTime = -Infinity;
    storyPlayer.lastSkillClientTime = -Infinity;
    storyPlayer.lastUltimateClientTime = -Infinity;
    storyPlayer.attackEffectUntil = 0;
    storyPlayer.skillEffectUntil = 0;
    storyPlayer.ultimateEffectUntil = 0;
    storyPlayer.speedBoostUntil = 0;
    storyPlayer.awakenUntil = 0;
    storyPlayer.rapidStrikeUntil = 0;
    storyPlayer.comboStage = 0;
    storyPlayer.spearSide = 0;
    const bonus = equipBonusOf(charType);
    storyPlayer.equipSpeed = bonus.speed;
    storyPlayer.equipCooldown = bonus.cooldown;
    updateStoryHpBar();
    syncMobileButtonIcons(charType, true);
});

// 바람궁수맛 궁극기 3단계가 벤치의 쓰러진 파티 쿠키만 되살릴 때. 지금 나와
// 있는 쿠키는 안 바뀌므로 storyPlayerSwapped처럼 쿨다운을 초기화하면 안 되고,
// 교체 줄(파티 바)의 죽음 표시만 지워주면 된다.
socket.on('storyPartyRevived', ({ partyAlive, partyHp }) => {
    if (!awakenFightParty) return;
    awakenFightParty.partyAlive = partyAlive;
    awakenFightParty.partyHp = partyHp;
    renderAwakenSwapBar();
});

// ---- 각성모드 보스가 스킬/궁극기를 쓸 때 ----
socket.on('bossAbility', ({ x, y, radius, kind }) => {
    storyImpactEffects.push({ x, y, radius, until: performance.now() + (kind === 'ultimate' ? 700 : 450) });
    if (kind === 'ultimate') storyQuakeUntil = performance.now() + 400;
});
socket.on('bossBlink', ({ x, y }) => {
    storyImpactEffects.push({ x, y, radius: 60, until: performance.now() + 350 });
});
// 끌어오기: 보스가 나를 자기 앞으로 당긴다.
socket.on('storyPlayerPulled', ({ id, x, y }) => {
    if (id !== socket.id || !storyPlayer) return;
    storyPlayer.x = x;
    storyPlayer.y = y;
    storyImpactEffects.push({ x, y, radius: 50, until: performance.now() + 300 });
});
// 보스가 부하를 부르면 몬스터 목록이 통째로 갈아 끼워진다.
socket.on('bossMinions', ({ monsters }) => {
    mergeStoryMonsters(monsters);
    updateStoryMonstersLeft();
});
socket.on('monsterShield', ({ id, shieldHp }) => {
    if (storyMonsters && storyMonsters[id]) storyMonsters[id].shieldHp = shieldHp;
    updateStoryBossBar();
});
// 10층 케이크: 때릴 때마다 조금씩 자란다. 회복분만 반영하면 된다.
socket.on('monsterGrew', ({ id, hp }) => {
    if (storyMonsters && storyMonsters[id]) storyMonsters[id].hp = hp;
    updateStoryBossBar();
});
// 체력이 바닥나기 직전에 딱 한 번 버틴다. 글씨는 띄우지 않는다 -- 보호막이
// 그대로 보이고 고리가 터지는 것으로 충분하다.
socket.on('monsterGuard', ({ id, hp, shieldHp, x, y }) => {
    if (storyMonsters && storyMonsters[id]) {
        storyMonsters[id].hp = hp;
        storyMonsters[id].shieldHp = shieldHp;
    }
    const now = performance.now();
    [60, 120].forEach((r, i) => storyImpactEffects.push({ x, y, radius: r, until: now + 450 + i * 200 }));
    updateStoryBossBar();
});
// 보스가 다시 일어난다. 쓰러졌다고 지운 자리를 통째로 되돌리고, 그 자리에서
// 크게 터뜨린다.
socket.on('bossRevived', ({ id, x, y, monsters, left }) => {
    if (monsters) mergeStoryMonsters(monsters);
    // 겹겹의 고리로 크게 터뜨린다.
    const now = performance.now();
    [70, 130, 200].forEach((r, i) => {
        storyImpactEffects.push({ x, y, radius: r, until: now + 500 + i * 220 });
    });
    storyQuakeUntil = now + 600;
    updateStoryMonstersLeft();
});
// 11층부터 나오는 장치들.
// 분열: 쓰러진 자리에서 작은 것들이 튀어나온다.
socket.on('monsterSplit', ({ x, y }) => {
    storyImpactEffects.push({ x, y, radius: 70, until: performance.now() + 380 });
});
// 회복 오라: 치유사가 주변을 채울 때 초록 고리가 한 번 돈다.
socket.on('monsterAura', ({ x, y, radius }) => {
    storyImpactEffects.push({ x, y, radius, until: performance.now() + 450, heal: true });
});
// 소환: 여왕이 부하를 부른 자리.
socket.on('monsterSummoned', ({ x, y }) => {
    storyImpactEffects.push({ x, y, radius: 90, until: performance.now() + 400 });
});
// 갈라져 나온 것들을 다음 틱까지 기다리지 않고 바로 보여 준다.
socket.on('storyMonstersChanged', ({ monsters }) => {
    mergeStoryMonsters(monsters);
    updateStoryMonstersLeft();
});

// 바다펄맛 밀물. 예열이 있는 단계는 터질 자리에 미리 파란 고리가 뜬다.
socket.on('storyTideCast', ({ windupMs, x, y, radius }) => {
    if (!windupMs) return;
    storyImpactEffects.push({ x, y, radius, until: performance.now() + windupMs, tide: true });
});
socket.on('storyTideStage', ({ id, stage }) => {
    if (storyPlayer && id === socket.id) storyPlayer.tideStage = stage;
});
// 바람궁수맛 각성. level은 방금 쓴 단계(1 또는 2)이므로, 다음에 쓸 단계는
// 그다음(2 또는 3) -- 0-indexed로 저장하는 natureAwakenLevel은 level % 3.
socket.on('natureAwaken', ({ id, level }) => {
    if (storyPlayer && id === socket.id) storyPlayer.natureAwakenLevel = level % 3;
});

// 일어나면서 터지는 충격파 (번개지옥맛).
socket.on('bossReviveBlast', ({ x, y }) => {
    storyImpactEffects.push({ x, y, radius: 260, until: performance.now() + 700 });
});

// 사탕 폭탄병이 터진 자리. 기존 충격 효과(storyImpactEffects)를 그대로 쓴다.
socket.on('monsterExploded', ({ x, y, radius }) => {
    storyImpactEffects.push({ x, y, radius, until: performance.now() + 320 });
});

socket.on('storyTick', ({ monsters, projectiles, players, summons }) => {
    storySummons = summons || {};
    if (players) {
        const next = {};
        Object.entries(players).forEach(([id, pl]) => { if (id !== socket.id) next[id] = pl; });
        storyPartners = next;
        renderStoryPartnerHp();
    }
    mergeStoryMonsters(monsters);
    const at = performance.now();
    const next = {};
    for (const [id, pr] of Object.entries(projectiles || {})) next[id] = { ...pr, at };
    storyProjectiles = next;
    updateStoryMonstersLeft();
});

socket.on('storyDropThrown', ({ id, x, y, vx, vy, radius, charType }) => {
    storyDrops[id] = { x, y, vx, vy, radius, charType, at: performance.now() };
});

socket.on('storyDropUpdate', ({ id, x, y, vx, vy }) => {
    const d = storyDrops[id];
    if (!d) return;
    d.x = x; d.y = y; d.vx = vx; d.vy = vy; d.at = performance.now();
});

socket.on('storyDropGone', ({ id, hit, x, y }) => {
    const charType = storyDrops[id] && storyDrops[id].charType;
    delete storyDrops[id];
    if (hit) storyDropSplashes.push({ x, y, charType, until: performance.now() + 260 });
});

socket.on('storyProjectileFired', ({ id, x, y, vx, vy, angle }) => {
    storyProjectiles[id] = { x, y, vx, vy, angle, at: performance.now() };
});

socket.on('storyProjectileGone', ({ id, hit, x, y }) => {
    delete storyProjectiles[id];
    if (hit) storyProjectileSparks.push({ x, y, until: performance.now() + 220 });
});

socket.on('monsterTelegraph', ({ id }) => {
    if (storyMonsters[id]) storyMonsters[id].state = 'telegraph';
});

// ---- 20층 보스(가면광대) 전용 이벤트 ----
// 화면 표시는 storyMonsters[id].trick에 다 몰아넣고, until(performance.now()
// 기준)이 지나면 storyRender가 알아서 안 그린다 -- 서버가 따로 "패턴 끝"
// 이벤트를 보내지 않아도 되게.
let storyReverseUntil = 0; // Date.now() 기준 -- 서버 타임스탬프와 비교해야 해서 performance.now()가 아니다.
socket.on('clownTelegraph', (data) => {
    const m = storyMonsters[data.id];
    if (!m) return;
    const startAt = performance.now();
    let durationMs = (data.telegraphMs || 0) + 350;
    if (data.pattern === 'decoy_flicker') durationMs = data.maxDurationMs || 10000;
    else if (data.pattern === 'reverse_steps') durationMs = Math.max(0, data.until - Date.now());
    else if (data.pattern === 'vanish_strike') durationMs = (data.hitCount || 5) * (data.intervalMs || 1000) + 400;
    m.trick = { ...data, startAt, until: startAt + durationMs, realSide: null };
});
socket.on('clownAttack', (data) => {
    const m = storyMonsters[data.id];
    if (m && m.trick && m.trick.pattern === data.pattern) {
        m.trick.flashAt = performance.now();
        m.trick.realSide = null; // vanish_strike: 다음 힌트 전까지는 다시 "모름" 상태로
    }
});
socket.on('clownFlicker', ({ id, real }) => {
    if (storyMonsters[id]) storyMonsters[id].trickFlickerReal = real;
});
socket.on('clownHint', ({ id, realSide }) => {
    const m = storyMonsters[id];
    if (m && m.trick) m.trick.realSide = realSide;
});
socket.on('clownReflect', ({ id }) => {
    const m = storyMonsters[id];
    if (m) m.trickReflectFlashAt = performance.now();
});
socket.on('storyReverseControls', ({ until }) => {
    storyReverseUntil = until;
});

socket.on('monsterDamaged', ({ id, hp }) => {
    if (storyMonsters[id]) storyMonsters[id].hp = hp;
    updateStoryBossBar();
});

socket.on('monsterDefeated', ({ id }) => {
    if (storyMonsters[id]) { storyMonsters[id].alive = false; storyMonsters[id].hp = 0; }
    updateStoryMonstersLeft();
});

// 이 방(room) 전체에 뿌려지는 이벤트라 파트너가 맞은 것도 내 클라이언트로
// 들어온다 -- id를 안 보고 무조건 storyPlayer(나)한테 씌우면 파트너가 맞을
// 때마다 내 체력도 같이 깎여 보인다. id로 나/파트너를 갈라야 한다.
socket.on('storyPlayerDamaged', ({ id, hp, alive, shieldHp }) => {
    if (id === socket.id) {
        if (!storyPlayer) return;
        storyPlayer.hp = hp;
        storyPlayer.alive = alive;
        storyPlayer.shieldHp = shieldHp || 0;
        updateStoryHpBar();
        if (awakenFightParty) {
            awakenFightParty.partyHp[awakenFightParty.active] = hp;
            renderAwakenSwapBar();
        }
    } else {
        const partner = storyPartners[id];
        if (!partner) return;
        partner.hp = hp;
        partner.alive = alive;
        partner.shieldHp = shieldHp || 0;
        renderStoryPartnerHp();
    }
});

socket.on('storyPlayerShielded', ({ id, shieldHp }) => {
    if (id === socket.id) {
        if (!storyPlayer) return;
        storyPlayer.shieldHp = shieldHp;
        updateStoryHpBar();
    } else {
        const partner = storyPartners[id];
        if (!partner) return;
        partner.shieldHp = shieldHp;
        renderStoryPartnerHp();
    }
});

socket.on('storyPlayerRevived', ({ hp }) => {
    if (!storyPlayer) return;
    storyPlayer.hp = hp;
    storyPlayer.alive = true;
    const at = performance.now();
    storyPlayer.healEffectUntil = at + 900; // brighter, longer flash
    // 내 쿠키가 다시 일어난 것은 쿠키 자체에서 보여야 한다 -- 자기 색 고리가
    // 겹겹이 퍼지고 화면이 짧게 흔들린다.
    storyPlayer.reviveEffectUntil = at + REVIVE_EFFECT_MS;
    storyQuakeUntil = Math.max(storyQuakeUntil, at + 450);
    updateStoryHpBar();
});

socket.on('storyPlayerHealed', ({ id, hp, partyHp }) => {
    if (id === socket.id) {
        if (!storyPlayer) return;
        storyPlayer.hp = hp;
        storyPlayer.healEffectUntil = performance.now() + 250;
        updateStoryHpBar();
        // 팀 회복은 쉬고 있는 쿠키에게도 들어가므로 교체 줄의 체력 바도 같이 찬다.
        if (partyHp && awakenFightParty) {
            awakenFightParty.partyHp = partyHp;
            renderAwakenSwapBar();
        }
    } else {
        const partner = storyPartners[id];
        if (!partner) return;
        partner.hp = hp;
        renderStoryPartnerHp();
    }
});

// 레전드 스토리 스위치: 공격이 아니라 밟으면 열린다. 판정은 서버가 하고,
// 여기선 문 그림/이동 클램프가 참고하는 로컬 상태만 갱신한다.
socket.on('legendSwitchHit', ({ id }) => {
    storyLegendSwitchesHit[id] = true;
});

// 레전드 스토리 보물상자: 밟으면 한 번만 재화를 준다.
socket.on('legendChestHit', ({ id }) => {
    if (storyLegendChestsHit[id]) return;
    storyLegendChestsHit[id] = true;
    const reward = SHARED.legendChestReward(id);
    if (reward) grantCurrencies(reward);
    const chest = storyFloorDef && storyFloorDef.chests && storyFloorDef.chests.find(c => c.id === id);
    if (chest) {
        storyImpactEffects.push({ x: chest.x, y: chest.y, radius: 40, until: performance.now() + 500, heal: true });
    }
});

// 전기줄맛: 상체 <-> 하체 <-> 합체. 체력 상한 자체가 바뀌므로 다른 회복
// 이벤트와 달리 maxHp도 같이 받아야 한다.
socket.on('storyBodyFormChanged', ({ id, form, hp, maxHp, partyHp, partyMaxHp }) => {
    if (id !== socket.id || !storyPlayer) return;
    storyPlayer.hp = hp;
    storyPlayer.maxHp = maxHp;
    storyPlayer.healEffectUntil = performance.now() + 250;
    updateStoryHpBar();
    if (awakenFightParty && partyHp && partyMaxHp) {
        awakenFightParty.partyHp = partyHp;
        awakenFightParty.partyMaxHp = partyMaxHp;
        renderAwakenSwapBar();
    }
});

socket.on('storyUltimateImpact', ({ x, y, radius }) => {
    storyImpactEffects.push({ x, y, radius, until: performance.now() + 400 });
});

// 쿠키맛쿠키 궁극기: 원이 아니라 직사각형 범위.
socket.on('storyUltimateLineImpact', ({ x, y, width, height }) => {
    storyImpactEffects.push({ x, y, width, height, until: performance.now() + 400 });
});

// 때파기 / 물방울 터트리기 / 마그마 쏟기 / 폭포 all land as a circle at a
// chosen spot; the only visible difference is how long the ring lingers.
socket.on('storySkillMark', ({ x, y, radius }) => {
    storyImpactEffects.push({ x, y, radius, until: performance.now() + 500 });
});
socket.on('storyUltimateMark', ({ x, y, radius }) => {
    storyImpactEffects.push({ x, y, radius, until: performance.now() + 700 });
});
// 나비모드 is a toggle, so the server tells us which way it went.
socket.on('storyGreatSlash', (d) => {
    storyGreatSlashes.push({ ...d, until: performance.now() + d.windupMs + 250 });
    if (storyPlayer && d.id === socket.id) {
        const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
        storyPlayer.speedBoostUntil = performance.now() + stats.ultimateSpeedDurationMs;
    }
});

socket.on('storyButterflyMode', ({ id, on }) => {
    if (!storyPlayer || id !== socket.id) return;
    storyPlayer.butterflyOn = on;
    // Releasing it is what starts the cooldown -- switching it on does not.
    storyPlayer.lastUltimateClientTime = on ? Infinity : performance.now();
});

socket.on('storyPlayerTeleported', ({ id, x, y }) => {
    if (!storyPlayer || id !== socket.id) return;
    storyPlayer.x = x;
    storyPlayer.y = y;
});

socket.on('storyLightningStrike', ({ x, y, radius }) => {
    storyImpactEffects.push({ x, y, radius, until: performance.now() + 400, bolt: true });
});

socket.on('storyMagmaZonePlaced', ({ x, y, radius, durationMs, look }) => {
    storyMagmaZones.push({ x, y, radius, look, until: performance.now() + durationMs });
});

socket.on('storyFireLineZonePlaced', ({ x, y, facing, range, width, durationMs }) => {
    storyFireLineZones.push({ x, y, facing, range, width, until: performance.now() + durationMs });
});

socket.on('storyEarthquake', () => {
    storyQuakeUntil = performance.now() + QUAKE_DURATION_MS;
});

// The revive shockwave (lightninghell's passive) -- a big ring off the player.
socket.on('storyReviveBlast', () => {
    if (!storyPlayer) return;
    storyImpactEffects.push({
        x: storyPlayer.x, y: storyPlayer.y, radius: 220,
        until: performance.now() + 500, bolt: true
    });
});

socket.on('storyFloorResult', ({ result, floor }) => {
    stopStoryLoop();
    // 한 판이 끝났으면 타워 버튼도 처음 상태로 (다시 짝을 찾을 수 있게).
    storyPartners = {};
    storySummons = {};
    awakenFightParty = null;
    renderAwakenSwapBar();
    storyBossBarEl.classList.add('hidden');
    resetTowerActions();
    resultRewardsEl.innerHTML = '';
    // 각성모드는 판 이름이 'awaken:쿠키:레벨'이라 여기서 갈라진다.
    const awaken = SHARED.parseAwakenFloorKey(floor);
    if (awaken) { showAwakenResult(awaken, result); return; }
    // 레전드 스토리는 판 이름이 'legend1' 같은 고정 문자열 키다.
    if (SHARED.isLegendFloor(floor)) { showLegendResult(floor, result); return; }
    const stage = eventStageById(floor);
    if (!stage) selectedStoryFloor = floor;
    if (result === 'win') {
        resultTitle.textContent = stage ? '스테이지 클리어!' : '층 클리어!';
        resultTitle.style.color = '#2ecc71';
        if (stage) {
            const earned = rewardEventStage(stage.id); // null only if it can't pay again
            if (earned) {
                resultDesc.textContent = `${stage.name} 클리어! ${earned.label} ${earned.amount}장을 받았습니다.`
                    + (earned.repeat ? ' 보스는 몇 번이든 다시 도전할 수 있어요.' : '');
            } else {
                resultDesc.textContent = `${stage.name}을(를) 클리어했습니다.`;
            }
        } else {
            resultDesc.textContent = `${floor}층을 클리어했습니다.`;
            const firstClear = !gameData.clearedStoryFloors.includes(floor);
            if (firstClear) {
                gameData.clearedStoryFloors.push(floor);
                saveGameData(gameData);
            }
            // 코인 등 기본 보상은 깰 때마다 전액. 장비 드랍만 첫 클리어 한정.
            const key = SHARED.storyRewardKey(floor);
            resultRewardsEl.innerHTML = rewardChipsHtml(payClearReward(key))
                + (firstClear ? equipDropChipHtml(rollClearDrop(key)) : '');
        }
    } else {
        resultTitle.textContent = '패배...';
        resultTitle.style.color = '#e74c3c';
        resultDesc.textContent = '몬스터에게 쓰러졌습니다.';
    }
    if (stage) {
        renderEventScreen();
        resultReturnScreen = 'event';
        resultBackBtn.textContent = '이벤트로';
    } else {
        resultReturnScreen = 'storyTower';
        resultBackBtn.textContent = '올라가기';
    }
    showScreen('result');
});

storyLeaveBtn.addEventListener('click', () => {
    stopStoryLoop();
    socket.emit('leaveRaid');
    storyPartners = {};
    resetTowerActions();
    if (eventStageById(activeStoryFloor)) {
        renderEventScreen();
        showScreen('event');
    } else {
        renderTower();
        showScreen('storyTower');
    }
});

function updateStoryHpBar() {
    if (!storyPlayer) return;
    storyMyHpBar.style.width = `${Math.max(0, (storyPlayer.hp / storyPlayer.maxHp) * 100)}%`;
    storyMyHpText.textContent = hpBarLabel(storyPlayer.hp, storyPlayer.maxHp);
    storyMyShieldBadge.textContent = `🛡${storyPlayer.shieldHp}`;
    storyMyShieldBadge.classList.toggle('hidden', !storyPlayer.shieldHp);
}

function updateStoryMonstersLeft() {
    const remaining = Object.values(storyMonsters).filter(m => m.alive).length;
    storyMonstersLeftEl.textContent = `남은 적: ${remaining}`;
    updateStoryBossBar();
}

// ---- 보스전 위쪽 체력 바 ----
// 몬스터 표에 bossBar가 붙은 적이 살아 있으면 화면 위에 길게 띄운다. 머리
// 위의 작은 바로는 체력 1000짜리 보스가 얼마나 남았는지 알 수가 없다.
const storyBossBarEl = document.getElementById('story-boss-bar');
const storyBossBarName = storyBossBarEl.querySelector('.sbb-name');
const storyBossBarFill = storyBossBarEl.querySelector('.sbb-fill');
const storyBossBarShield = storyBossBarEl.querySelector('.sbb-shield');
const storyBossBarText = storyBossBarEl.querySelector('.sbb-text');

function updateStoryBossBar() {
    let boss = null;
    for (const m of Object.values(storyMonsters || {})) {
        if (!m.alive) continue;
        const def = SHARED.MONSTERS[m.type];
        if (def && def.bossBar) { boss = { m, def }; break; }
    }
    if (!boss) { storyBossBarEl.classList.add('hidden'); return; }
    const { m, def } = boss;
    const shield = Math.round(m.shieldHp || 0);
    storyBossBarEl.classList.remove('hidden');
    storyBossBarName.textContent = def.name;
    storyBossBarFill.style.width = `${Math.max(0, Math.min(1, m.hp / m.maxHp)) * 100}%`;
    storyBossBarShield.style.width = shield
        ? `${Math.min(100, (shield / m.maxHp) * 100)}%` : '0';
    // 케이크는 체력이 0.5씩 차올라서 소수가 된다. 올림해서 보여 준다.
    storyBossBarText.textContent = shield
        ? `${Math.ceil(m.hp)} / ${m.maxHp}  🛡${shield}`
        : `${Math.ceil(m.hp)} / ${m.maxHp}`;
}

storyCanvas.addEventListener('contextmenu', (e) => e.preventDefault());
storyCanvas.addEventListener('mousemove', (e) => {
    const rect = storyCanvas.getBoundingClientRect();
    const scaleX = storyCanvas.width / rect.width;
    const scaleY = storyCanvas.height / rect.height;
    storyMouseX = (e.clientX - rect.left) * scaleX;
    storyMouseY = (e.clientY - rect.top) * scaleY;
});
storyCanvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        if (isStoryTargetingUltimate) confirmStoryUltimateTarget();
        else if (isStoryTargetingSkill) confirmStorySkillTarget();
        // With 자동조준 on, a click doesn't aim -- it snaps onto the nearest
        // enemy and swings there (the same path the mobile button uses).
        else if (autoAimActive()) fireAutoAimedAttack(true);
        else tryStoryAttack();
    } else if (e.button === 2) {
        storyHandleSkillTrigger();
    }
});

// The camera scrolls along the bridge's own axis: sideways on a leftward floor,
// vertically on an upward one. Both storyRender and the mouse->world mapping
// read it from here so they can't disagree.
function storyCamera() {
    if (!storyPlayer) return { x: 0, y: 0 };
    // 꺾은선 다리는 길이 좌우로도 위아래로도 가므로 둘 다 따라간다.
    if (storyFloorDef && storyFloorDef.path) return { x: storyPlayer.x, y: storyPlayer.y };
    return SHARED.floorAxis(storyFloorDef) === 'y'
        ? { x: 0, y: storyPlayer.y }
        : { x: storyPlayer.x, y: 0 };
}

function storyWorldFromMouse() {
    const cam = storyCamera();
    return {
        x: (storyMouseX - storyCanvas.width / 2) / storyScale + cam.x,
        y: (storyMouseY - storyCanvas.height / 2) / storyScale + cam.y
    };
}

function storyCanUseSkill(now) {
    if (!storyPlayer || !storyPlayer.alive) return false;
    const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
    return !!stats.skillType
        && now - storyPlayer.lastSkillClientTime >= stats.skillCooldown * (storyPlayer.equipCooldown || 1);
}

// 나비모드 has no duration: while it is running the ultimate button is the
// OFF switch, so it is never on cooldown, and the 30s only starts on release.
function ultimateIsHeldOn(stats, p) {
    return !!p && stats.ultimateType === 'butterfly_mode' && !!p.butterflyOn;
}

function storyCanUseUltimate(now) {
    if (!storyPlayer || !storyPlayer.alive) return false;
    const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
    if (ultimateIsHeldOn(stats, storyPlayer)) return true;
    return !!stats.ultimateType
        && now - storyPlayer.lastUltimateClientTime >= stats.ultimateCooldownMs * (storyPlayer.equipCooldown || 1);
}

function tryStoryUseSkill() {
    const now = performance.now();
    if (!storyCanUseSkill(now)) return;
    const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
    storyPlayer.lastSkillClientTime = skillCastStamp(stats, storyPlayer, now);
    storyPlayer.skillEffectUntil = now
        + (SKILL_FULL_DURATION_EFFECTS.includes(stats.skillType) ? stats.skillDurationMs : 350);
    if (stats.skillType === 'speed_boost' || stats.skillType === 'charge_dash') storyPlayer.speedBoostUntil = now + stats.skillSpeedDurationMs;
    else if (stats.skillType === 'sea_hide') storyPlayer.untouchableUntil = now + stats.skillDurationMs;
    socket.emit('storyPlayerSkill');
}

function tryStoryUseUltimate() {
    const now = performance.now();
    if (!storyCanUseUltimate(now)) return;
    const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
    storyPlayer.lastUltimateClientTime = now;
    storyPlayer.ultimateEffectUntil = now + (stats.ultimateDurationMs || 0);
    if (stats.ultimateType === 'awakening') storyPlayer.awakenUntil = now + stats.ultimateDurationMs;
    if (stats.ultimateType === 'awakening_rapid') storyPlayer.rapidStrikeUntil = now + stats.ultimateDurationMs;
    if (stats.ultimateType === 'undying_soul') storyPlayer.speedBoostUntil = now + stats.ultimateDurationMs;
    if (stats.ultimateType === 'great_slash') storyPlayer.speedBoostUntil = now + stats.ultimateSpeedDurationMs;
    if (stats.ultimateType === 'nature_awaken') {
        const level = (storyPlayer.natureAwakenLevel || 0) % 3;
        if (level < 2) {
            storyPlayer.rapidStrikeUntil = now + stats.ultimateDurationMs;
            if (level === 1) storyPlayer.natureBoostUntil = now + stats.ultimateDurationMs;
        }
        storyPlayer.natureAwakenLevel = (level + 1) % 3;
    }
    socket.emit('storyPlayerUltimate');
}

// F does different things depending on the character, mirroring the boss-raid version.
function storyHandleUltimateKey() {
    if (!storyPlayer) return;
    const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
    if (isTargetedUltimate(stats.ultimateType)) {
        if (mobileControlsEnabled) {
            // See mobileUltimateTarget: cast straight ahead, no mouse needed.
            if (!storyCanUseUltimate(performance.now())) return;
            storyPlayer.lastUltimateClientTime = performance.now();
            socket.emit('storyPlayerUltimate',
                mobileUltimateTarget(storyPlayer.x, storyPlayer.y, storyPlayer.facing, stats));
            return;
        }
        if (isStoryTargetingUltimate) { isStoryTargetingUltimate = false; return; }
        if (!storyCanUseUltimate(performance.now())) return;
        isStoryTargetingUltimate = true;
    } else {
        tryStoryUseUltimate();
    }
}

function storyHandleSkillTrigger() {
    if (!storyPlayer) return;
    const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
    if (!isTargetedSkill(stats.skillType, storyPlayer)) { tryStoryUseSkill(); return; }
    if (mobileControlsEnabled) {
        if (!storyCanUseSkill(performance.now())) return;
        storyPlayer.lastSkillClientTime = skillCastStamp(stats, storyPlayer, performance.now());
        socket.emit('storyPlayerSkill',
            mobileSkillTarget(storyPlayer.x, storyPlayer.y, storyPlayer.facing, stats));
        return;
    }
    if (isStoryTargetingSkill) { isStoryTargetingSkill = false; return; }
    if (!storyCanUseSkill(performance.now())) return;
    isStoryTargetingSkill = true;
}

function confirmStorySkillTarget() {
    isStoryTargetingSkill = false;
    if (!storyPlayer || storyMouseX === null) return;
    if (!storyCanUseSkill(performance.now())) return;
    const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
    storyPlayer.lastSkillClientTime = skillCastStamp(stats, storyPlayer, performance.now());
    storyPlayer.skillEffectUntil = performance.now() + 300;
    const world = storyWorldFromMouse();
    socket.emit('storyPlayerSkill', { targetX: world.x, targetY: world.y });
}

function confirmStoryUltimateTarget() {
    isStoryTargetingUltimate = false;
    if (!storyPlayer || storyMouseX === null) return;
    if (!storyCanUseUltimate(performance.now())) return;
    storyPlayer.lastUltimateClientTime = performance.now();
    const world = storyWorldFromMouse();
    socket.emit('storyPlayerUltimate', { targetX: world.x, targetY: world.y });
}

function tryStoryAttack() {
    if (!storyPlayer || !storyPlayer.alive) return;
    const now = performance.now();
    if (now < (storyPlayer.untouchableUntil || 0)) return; // 바다 수호자맛 sea_hide
    const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
    const rapid = now < storyPlayer.rapidStrikeUntil; // awakening_rapid, nature_awaken 1·2단계가 공유하는 타이머
    let cooldown = stats.attackCooldown;
    if (rapid) cooldown = stats.ultimateRapidCooldown;
    else if (stats.attackType === 'combo_two_stage' && storyPlayer.comboStage === 1) {
        cooldown = stats.comboFollowupCooldown; // follow-up thrust opens sooner
    }
    if (now - storyPlayer.lastAttackClientTime < cooldown) return;
    storyPlayer.lastAttackClientTime = now;
    storyPlayer.attackEffectUntil = now + 180;
    advanceSweepCount(storyPlayer, stats);
    if (stats.attackType === 'combo_two_stage') {
        // Mirror the server's stage bookkeeping so the effect draws the right shape.
        storyPlayer.attackEffectStage = stats.attackStages[storyPlayer.comboStage || 0];
        storyPlayer.comboStage = ((storyPlayer.comboStage || 0) + 1) % stats.attackStages.length;
    } else if (stats.attackType === 'dual_spear') {
        // Same mirroring for which hand fires (see advanceAttackSequence).
        storyPlayer.attackEffectSide = storyPlayer.spearSide || 0;
        storyPlayer.spearSide = (storyPlayer.spearSide || 0) === 0 ? 1 : 0;
    }
    if (stats.skillType === 'guard_stance') storyPlayer.skillEffectUntil = 0; // attacking breaks the guard stance
    socket.emit('storyPlayerAttack');
}

function startStoryLoop() {
    stopStoryLoop();
    storyLoopHandle = requestAnimationFrame(storyFrame);
}
function stopStoryLoop() {
    if (storyLoopHandle) cancelAnimationFrame(storyLoopHandle);
    storyLoopHandle = null;
    storyBossBarEl.classList.add('hidden');
}

function updateStoryCooldownDisplay(now) {
    if (!storyPlayer) return;
    const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
    let skillRemain = 0, ultRemain = 0;
    if (stats.skillType) {
        const remain = Math.max(0, stats.skillCooldown * (storyPlayer.equipCooldown || 1)
            - (now - storyPlayer.lastSkillClientTime)) / 1000;
        storyMySkillCdEl.textContent = remain > 0.05 ? `${remain.toFixed(1)}s` : '사용가능';
        skillRemain = remain;
    }
    if (ultimateIsHeldOn(stats, storyPlayer)) {
        storyMyUltimateCdEl.textContent = '사용중';
    } else if (stats.ultimateType) {
        const remain = Math.max(0, stats.ultimateCooldownMs * (storyPlayer.equipCooldown || 1)
            - (now - storyPlayer.lastUltimateClientTime)) / 1000;
        storyMyUltimateCdEl.textContent = remain > 0.05 ? `${remain.toFixed(1)}s` : '사용가능';
        ultRemain = remain;
    } else {
        // 바다펄맛은 궁극기 칸이 비어 있다.
        storyMyUltimateCdEl.textContent = '없음';
    }
    // 밀물은 다음에 몇 단계가 나가는지가 쿨타임만큼 중요하다.
    if (stats.skillType === 'tide_cycle' && skillRemain <= 0.05) {
        storyMySkillCdEl.textContent = `${tideStageNoOf(storyPlayer)}단계`;
    }
    if (stats.ultimateType === 'nature_awaken' && ultRemain <= 0.05) {
        storyMyUltimateCdEl.textContent = `${natureAwakenStageNoOf(storyPlayer)}단계`;
    }
    syncMobileCooldowns(skillRemain, ultRemain, true, !stats.ultimateType);
}

function storyFrame() {
    const now = performance.now();
    if (storyPlayer && storyPlayer.alive) {
        const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
        const speed = moveSpeedFor(stats, now, storyPlayer.speedBoostUntil, storyPlayer.awakenUntil, storyPlayer.butterflyOn, storyPlayer.equipSpeed, storyPlayer.rapidStrikeUntil, !!storyJoystickMoveVec, storyPlayer.natureBoostUntil);
        let dx = 0, dy = 0;
        if (storyJoystickMoveVec) {
            dx = storyJoystickMoveVec.x * speed;
            dy = storyJoystickMoveVec.y * speed;
        } else {
            if (keys['w'] || keys['W']) dy -= speed;
            if (keys['s'] || keys['S']) dy += speed;
            if (keys['a'] || keys['A']) dx -= speed;
            if (keys['d'] || keys['D']) dx += speed;
        }
        // 20층 보스 "뒤바뀐 발걸음": 서버가 준 until은 Date.now() 기준이라
        // performance.now()가 아니라 여기서만 따로 비교한다.
        if (storyReverseUntil && Date.now() < storyReverseUntil) { dx = -dx; dy = -dy; }
        if (dx !== 0 || dy !== 0) {
            // Mirrors the server's storyPlayerMove clamping, along the bridge's
            // own axis so an upward floor (axis: 'y') behaves like a leftward one.
            const kept = SHARED.clampToLane(storyFloorDef, storyPlayer.x + dx, storyPlayer.y + dy);
            let along = SHARED.alongOf(storyFloorDef, kept.x, kept.y);
            const across = SHARED.acrossOf(storyFloorDef, kept.x, kept.y);
            if (storyFloorDef.gates) {
                const wasAlong = SHARED.alongOf(storyFloorDef, storyPlayer.x, storyPlayer.y);
                for (const gate of storyFloorDef.gates) {
                    if (!storyGateSealed(gate)) continue;
                    if (wasAlong <= gate.entrance || along <= gate.entrance) {
                        if (along > gate.entrance) along = gate.entrance;
                        if (along < gate.exit) along = gate.exit;
                    }
                }
            }
            const pos = SHARED.fromAlongAcross(storyFloorDef, along, across);
            storyPlayer.x = pos.x; storyPlayer.y = pos.y;
        }
        if (mobileControlsEnabled) {
            // See the matching guard in frame(): without it, a swing thrown
            // while walking snapped back to face the movement direction on
            // the very next frame instead of staying locked on the auto-aimed
            // target for the attack's duration.
            if (storyJoystickFacing !== null && now >= storyPlayer.attackEffectUntil) storyPlayer.facing = storyJoystickFacing;
        } else if (autoAimEnabled) {
            // See the matching branch in frame(): the aim has to be held every
            // frame, not just set on the click, or this loop overwrites it.
            const angle = nearestTargetAngle(storyPlayer.x, storyPlayer.y, true);
            if (angle !== null) storyPlayer.facing = angle;
        } else if (storyMouseX !== null) {
            const world = storyWorldFromMouse();
            storyPlayer.facing = Math.atan2(world.y - storyPlayer.y, world.x - storyPlayer.x);
        }
        if (now - storyLastMoveEmit > 33) {
            socket.emit('storyPlayerMove', { x: storyPlayer.x, y: storyPlayer.y, facing: storyPlayer.facing });
            storyLastMoveEmit = now;
        }
        updateStoryCooldownDisplay(now);
    }
    // 한 판을 그리다 터져도 판 자체는 계속 돌게 한다. 예전에는 여기서 오류가
    // 나면 requestAnimationFrame이 다시 안 걸려서 화면이 그 자리에 얼어붙고,
    // 다른 모드로 나가도 그 그림이 남아 겹쳐 보였다.
    try {
        storyRender(now);
    } catch (err) {
        console.error('storyRender', err);
    }
    storyLoopHandle = requestAnimationFrame(storyFrame);
}

function storyAnyMonsterAliveInRoom(roomIndex) {
    return Object.values(storyMonsters).some(m => m.alive && m.room === roomIndex);
}

// 레전드 스토리 입구 문처럼 몬스터가 아니라 스위치로 여는 문(gate.manual)도
// 있다 -- server.js의 gateSealed와 같은 규칙(움직임 예측·문 그리기 둘 다
// 여기 하나로 정리).
let storyLegendSwitchesHit = {};
let storyLegendChestsHit = {};
function storyGateSealed(gate) {
    if (gate.manual) return !storyLegendSwitchesHit[gate.room];
    return storyAnyMonsterAliveInRoom(gate.room);
}

function drawStarPath(ctx, radius) {
    const inner = radius * 0.45;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? radius : inner;
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const x = Math.cos(angle) * r, y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
}

// 20층 보스(가면광대) 패턴 오버레이. ctx는 이미 보스 위치로 translate된
// 상태(로컬 원점 = 보스)로 들어온다. 이 층은 axis가 'x'라 along=x, across=y라서
// 서버가 along/across로 계산한 것들을 그대로 로컬 x/y로 옮겨 그릴 수 있다.
function drawClownTrickOverlay(ctx, m, now) {
    const trick = m.trick;
    if (!trick || now >= trick.until) return;
    if (trick.pattern === 'fake_slash') {
        const { baseAngle, halfSpan, reversed } = trick;
        const R = 520;
        if (reversed) {
            // 위험은 부채꼴 "밖" 전체 -- 화면을 옅은 빨강으로 덮고 부채꼴 자리만
            // 도려내 보랏빛 테두리로만 남긴다 (여기가 오히려 안전지대).
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, 0, R, 0, Math.PI * 2);
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, R, baseAngle - halfSpan, baseAngle + halfSpan, false);
            ctx.fillStyle = 'rgba(231, 76, 60, 0.28)';
            ctx.fill('evenodd');
            ctx.restore();
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, R, baseAngle - halfSpan, baseAngle + halfSpan);
            ctx.closePath();
            ctx.strokeStyle = 'rgba(155, 89, 182, 0.9)';
            ctx.lineWidth = 3;
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, R, baseAngle - halfSpan, baseAngle + halfSpan);
            ctx.closePath();
            ctx.fillStyle = 'rgba(231, 76, 60, 0.32)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.9)';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    } else if (trick.pattern === 'nine_cells') {
        const CELL = 180, HALF = 270;
        (trick.cells || []).forEach(c => {
            const row = Math.floor(c.id / 3), col = c.id % 3;
            const lx = -HALF + col * CELL, ly = -HALF + row * CELL;
            ctx.fillStyle = c.fake ? 'rgba(46, 204, 113, 0.55)' : 'rgba(46, 204, 113, 0.2)';
            ctx.fillRect(lx, ly, CELL, CELL);
            ctx.strokeStyle = 'rgba(46, 204, 113, 0.9)';
            ctx.lineWidth = 2;
            ctx.strokeRect(lx, ly, CELL, CELL);
        });
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-HALF, -HALF, CELL * 3, CELL * 3);
    } else if (trick.pattern === 'vanish_strike') {
        const known = trick.realSide !== null && trick.realSide !== undefined;
        const sideColor = (side) => {
            if (!known) return 'rgba(155, 89, 182, 0.22)';
            return trick.realSide === side ? 'rgba(231, 76, 60, 0.32)' : 'rgba(120, 120, 120, 0.1)';
        };
        ctx.fillStyle = sideColor(-1);
        ctx.fillRect(-520, -420, 1040, 420);
        ctx.fillStyle = sideColor(1);
        ctx.fillRect(-520, 0, 1040, 420);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-520, 0);
        ctx.lineTo(520, 0);
        ctx.stroke();
    }
}

// Screen shake for the earthquake ultimate. Returns the pixel offset to add to
// the camera translate; {0,0} once the shake has run out. Decays so it settles
// instead of cutting off mid-jolt.
const QUAKE_DURATION_MS = 600;
function quakeOffset(now, until) {
    const left = (until || 0) - now;
    if (left <= 0) return { x: 0, y: 0 };
    const strength = 9 * (left / QUAKE_DURATION_MS);
    return {
        x: Math.sin(now / 18) * strength,
        y: Math.cos(now / 13) * strength
    };
}

function storyRender(now) {
    // 매 판을 늘 깨끗한 좌표계에서 시작한다. 그림 중간에 오류가 나면 save()와
    // translate()가 짝을 잃은 채로 남는데, 그러면 다음 판의 clearRect가 엉뚱한
    // 자리를 지워서 지난 화면이 그대로 남아 다른 모드에 겹쳐 보인다.
    storyCtx.setTransform(1, 0, 0, 1, 0, 0);
    storyCtx.clearRect(0, 0, storyCanvas.width, storyCanvas.height);
    storyCtx.save();
    const cam = storyCamera();
    const q = quakeOffset(now, storyQuakeUntil);
    storyCtx.translate(storyCanvas.width / 2 + q.x, storyCanvas.height / 2 + q.y);
    storyCtx.scale(storyScale, storyScale);
    storyCtx.translate(-cam.x, -cam.y);

    if (storyFloorDef) {
        const halfW = storyFloorDef.laneHalfWidth;
        const winding = !!storyFloorDef.path;
        const vertical = SHARED.floorAxis(storyFloorDef) === 'y';
        // 챕터별 배경 색(용암 챕터의 붉은 다리 등). 안 적힌 층은 지금까지와
        // 똑같은 갈색 다리 그대로 나온다.
        const deckColor = storyFloorDef.deckColor || '#4a3c2f';
        const deckGlow = storyFloorDef.deckGlow || 'rgba(255,255,255,0.15)';
        if (winding) {
            // 꺾은선 다리: 구간(방/다리/갈림길)마다 자기 폭(halfWidth)으로 따로
            // 긋는다 -- 폭이 전부 같던 예전과 달리 레전드 스토리는 방(넓게)과
            // 다리(좁게)가 한 길 안에 섞여 있어서, 길 전체를 한 굵기로 그으면
            // 방이 다리만큼 좁게 나온다. 둥근 캡/조인이 구간 경계를 자연스럽게
            // 이어 준다.
            const segs = SHARED.pathSegs(storyFloorDef);
            storyCtx.save();
            storyCtx.lineJoin = 'round';
            storyCtx.lineCap = 'round';
            segs.forEach(s => {
                storyCtx.beginPath();
                storyCtx.moveTo(s.x0, s.y0);
                storyCtx.lineTo(s.x0 + s.ux * s.len, s.y0 + s.uy * s.len);
                storyCtx.strokeStyle = deckGlow;
                storyCtx.lineWidth = s.halfWidth * 2 + 4;
                storyCtx.stroke();
                storyCtx.strokeStyle = deckColor;
                storyCtx.lineWidth = s.halfWidth * 2;
                storyCtx.stroke();
            });
            // 가운데 점선: 어느 쪽이 길인지 한눈에 보이게.
            storyCtx.setLineDash([26, 26]);
            storyCtx.strokeStyle = 'rgba(255,255,255,0.10)';
            storyCtx.lineWidth = 3;
            storyCtx.beginPath();
            storyFloorDef.path.forEach(([px, py], i) => {
                if (i === 0) storyCtx.moveTo(px, py); else storyCtx.lineTo(px, py);
            });
            storyCtx.stroke();
            if (storyFloorDef.forks) {
                storyFloorDef.forks.forEach(fork => {
                    storyCtx.beginPath();
                    fork.forEach(([px, py], i) => {
                        if (i === 0) storyCtx.moveTo(px, py); else storyCtx.lineTo(px, py);
                    });
                    storyCtx.stroke();
                });
            }
            storyCtx.restore();
        } else {
            // The bridge runs along the level axis; on a vertical floor the same
            // rectangle is simply turned on its side.
            const deckAlong = -storyFloorDef.levelLength - 200;
            const deckLen = storyFloorDef.levelLength + 400;
            const deck = vertical
                ? [-halfW, deckAlong, halfW * 2, deckLen]
                : [deckAlong, -halfW, deckLen, halfW * 2];
            storyCtx.fillStyle = deckColor;
            storyCtx.fillRect(...deck);
            storyCtx.strokeStyle = deckGlow;
            storyCtx.lineWidth = 2;
            storyCtx.strokeRect(...deck);
        }

        if (storyFloorDef.star) {
            const sx = storyFloorDef.star.x, sy = storyFloorDef.star.y;
            const pulse = 4 + Math.sin(now / 200) * 3;
            storyCtx.save();
            storyCtx.translate(sx, sy);
            storyCtx.rotate(now / 1000);
            drawStarPath(storyCtx, SHARED.STAR_RADIUS + pulse);
            storyCtx.fillStyle = '#f1c40f';
            storyCtx.shadowColor = 'rgba(241, 196, 15, 0.9)';
            storyCtx.shadowBlur = 20;
            storyCtx.fill();
            storyCtx.restore();
        }

        if (storyFloorDef.gates) {
            const shieldAlpha = 0.35 + Math.sin(now / 150) * 0.1;
            storyFloorDef.gates.forEach(gate => {
                if (!storyGateSealed(gate)) return;
                [gate.entrance, gate.exit].forEach(at => {
                    if (winding) {
                        // 길이 휘어 있으니 그 자리의 길 방향을 구해서 가로로 세운다.
                        // 방/다리마다 폭이 다르므로 그 자리의 실제 폭을 쓴다.
                        const a = SHARED.pointOnPath(storyFloorDef, at, 0);
                        const b = SHARED.pointOnPath(storyFloorDef, at - 1, 0);
                        const gateHalfW = SHARED.laneHalfWidthAt(storyFloorDef, a.x, a.y);
                        storyCtx.save();
                        storyCtx.translate(a.x, a.y);
                        storyCtx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
                        storyCtx.fillStyle = `rgba(52, 152, 219, ${shieldAlpha})`;
                        storyCtx.fillRect(-6, -gateHalfW, 12, gateHalfW * 2);
                        storyCtx.strokeStyle = 'rgba(133, 202, 240, 0.9)';
                        storyCtx.lineWidth = 2;
                        storyCtx.strokeRect(-6, -gateHalfW, 12, gateHalfW * 2);
                        storyCtx.restore();
                        return;
                    }
                    // The shield spans the lane, so it lies across the axis the
                    // bridge runs along.
                    const bar = vertical ? [-halfW, at - 6, halfW * 2, 12] : [at - 6, -halfW, 12, halfW * 2];
                    storyCtx.fillStyle = `rgba(52, 152, 219, ${shieldAlpha})`;
                    storyCtx.fillRect(...bar);
                    storyCtx.strokeStyle = 'rgba(133, 202, 240, 0.9)';
                    storyCtx.lineWidth = 2;
                    storyCtx.strokeRect(...bar);
                });
            });
        }

        // 레전드 스토리 전용: 스위치(레버)와 보물상자. 별과 같은 방식으로
        // "그 위를 밟으면" 발동한다 -- 공격 판정이 없다.
        if (storyFloorDef.switches) {
            storyFloorDef.switches.forEach(sw => {
                const hit = !!storyLegendSwitchesHit[sw.id];
                storyCtx.save();
                storyCtx.translate(sw.x, sw.y);
                storyCtx.fillStyle = hit ? 'rgba(46, 204, 113, 0.9)' : 'rgba(231, 76, 60, 0.9)';
                storyCtx.strokeStyle = 'rgba(255,255,255,0.8)';
                storyCtx.lineWidth = 3;
                storyCtx.beginPath();
                storyCtx.arc(0, 0, 20, 0, Math.PI * 2);
                storyCtx.fill();
                storyCtx.stroke();
                storyCtx.restore();
            });
        }
        if (storyFloorDef.chests) {
            storyFloorDef.chests.forEach(ch => {
                const opened = !!storyLegendChestsHit[ch.id];
                storyCtx.save();
                storyCtx.translate(ch.x, ch.y);
                storyCtx.globalAlpha = opened ? 0.35 : 1;
                storyCtx.fillStyle = '#c8791b';
                storyCtx.strokeStyle = 'rgba(255,255,255,0.8)';
                storyCtx.lineWidth = 3;
                storyCtx.fillRect(-22, -16, 44, 32);
                storyCtx.strokeRect(-22, -16, 44, 32);
                storyCtx.fillStyle = '#8b5a2b';
                storyCtx.fillRect(-22, -4, 44, 6);
                storyCtx.restore();
            });
        }
    }

    storyImpactEffects = storyImpactEffects.filter(fx => now < fx.until);
    storyImpactEffects.forEach(fx => {
        const t = 1 - Math.max(0, (fx.until - now) / 400);
        // Lightning uses a yellow flash plus a bolt dropping in from above.
        const rgb = fx.heal ? '46, 204, 113'
            : (fx.tide ? '46, 134, 222' : (fx.bolt ? '241, 196, 15' : '142, 68, 173'));
        storyCtx.beginPath();
        if (fx.width) {
            storyCtx.rect(fx.x - fx.width / 2, fx.y - fx.height / 2, fx.width, fx.height);
        } else {
            storyCtx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
        }
        storyCtx.fillStyle = `rgba(${rgb}, ${0.5 * (1 - t)})`;
        storyCtx.fill();
        storyCtx.strokeStyle = `rgba(${rgb}, 0.9)`;
        storyCtx.lineWidth = 3;
        storyCtx.stroke();
        if (fx.bolt) {
            storyCtx.save();
            storyCtx.strokeStyle = `rgba(255, 255, 200, ${1 - t})`;
            storyCtx.lineWidth = 4;
            storyCtx.beginPath();
            storyCtx.moveTo(fx.x, fx.y - 260);
            storyCtx.lineTo(fx.x + 14, fx.y - 160);
            storyCtx.lineTo(fx.x - 12, fx.y - 90);
            storyCtx.lineTo(fx.x + 8, fx.y - 30);
            storyCtx.lineTo(fx.x, fx.y);
            storyCtx.stroke();
            storyCtx.restore();
        }
    });

    storyMagmaZones = storyMagmaZones.filter(z => now < z.until);
    storyMagmaZones.forEach(z => {
        const pulse = 3 + Math.sin(now / 120) * 3;
        const skin = zoneColors(z.look);
        storyCtx.beginPath();
        storyCtx.arc(z.x, z.y, z.radius + pulse, 0, Math.PI * 2);
        storyCtx.fillStyle = skin.fill;
        storyCtx.fill();
        storyCtx.strokeStyle = skin.stroke;
        storyCtx.lineWidth = 3;
        storyCtx.stroke();
    });

    storyFireLineZones = storyFireLineZones.filter(z => now < z.until);
    drawFireLineZones(storyCtx, storyFireLineZones, now);

    Object.values(storyMonsters).forEach(m => {
        if (!m.alive) return;
        const def = SHARED.MONSTERS[m.type];
        // 표에 없는 적은 그리지 않고 넘어간다. 예전에 여기서 def를 그냥 읽다가
        // 표에 없는 부하가 나오는 순간 그림이 통째로 멈춘 적이 있다.
        if (!def) return;
        // 케이크 같은 보스는 잡몹보다 덩치가 크다. 판정도 같은 값을 쓴다.
        const mRad = SHARED.monsterRadiusOf(m.type);
        storyCtx.save();
        storyCtx.translate(m.x, m.y);
        if (def.trickBoss) drawClownTrickOverlay(storyCtx, m, now);
        if (m.state === 'telegraph' && !def.trickBoss) {
            storyCtx.beginPath();
            storyCtx.arc(0, 0, mRad + 10, 0, Math.PI * 2);
            storyCtx.strokeStyle = 'rgba(231, 76, 60, 0.9)';
            storyCtx.lineWidth = 3;
            storyCtx.stroke();
        }
        // The held beam, drawn at exactly the angle/length/width the server is
        // judging against (see tickLaser), so what you dodge is what's real.
        if (m.laserAngle !== null && m.laserAngle !== undefined && def.laser) {
            storyCtx.save();
            storyCtx.rotate(m.laserAngle);
            const grad = storyCtx.createLinearGradient(0, 0, def.laserRange, 0);
            grad.addColorStop(0, 'rgba(255, 80, 80, 0.85)');
            grad.addColorStop(1, 'rgba(255, 80, 80, 0.15)');
            storyCtx.fillStyle = grad;
            storyCtx.fillRect(0, -def.laserWidth / 2, def.laserRange, def.laserWidth);
            // Bright core down the middle.
            storyCtx.fillStyle = 'rgba(255, 240, 240, 0.9)';
            storyCtx.fillRect(0, -2.5, def.laserRange, 5);
            storyCtx.restore();
        }
        if (def.laser) {
            // A boxy turret instead of the usual blob, with a barrel pointing
            // wherever the beam is (or will be) aimed.
            const r = mRad;
            storyCtx.save();
            storyCtx.rotate(m.laserAngle || 0);
            storyCtx.fillStyle = '#7f8c8d';
            storyCtx.fillRect(r - 4, -5, r + 8, 10);
            storyCtx.restore();
            storyCtx.fillStyle = def.color;
            storyCtx.fillRect(-r, -r, r * 2, r * 2);
            storyCtx.strokeStyle = '#2c3e50';
            storyCtx.lineWidth = 2;
            storyCtx.strokeRect(-r, -r, r * 2, r * 2);
            // Single red eye.
            storyCtx.beginPath();
            storyCtx.arc(0, 0, 5, 0, Math.PI * 2);
            storyCtx.fillStyle = m.state === 'firing' ? '#ff5252' : '#c0392b';
            storyCtx.fill();
        } else {
            // 가면광대가 "가짜"로 보이는 순간엔 보랏빛으로 물든다 (헛것 베기) --
            // 이때 때리면 클라이언트 판정과 무관하게 서버가 무조건 역관광시킨다.
            const clownFake = def.trickBoss && m.trickFlickerReal === false;
            storyCtx.beginPath();
            storyCtx.arc(0, 0, mRad, 0, Math.PI * 2);
            storyCtx.fillStyle = clownFake ? '#9b59b6' : def.color;
            storyCtx.fill();
            storyCtx.strokeStyle = clownFake ? '#6c3483' : '#2c3e50';
            storyCtx.lineWidth = clownFake ? 5 : 2;
            storyCtx.stroke();
            if (clownFake) {
                storyCtx.beginPath();
                storyCtx.arc(0, 0, mRad + 8, 0, Math.PI * 2);
                storyCtx.strokeStyle = 'rgba(155, 89, 182, 0.7)';
                storyCtx.lineWidth = 3;
                storyCtx.stroke();
            }
            if (def.trickBoss && m.trickReflectFlashAt && now - m.trickReflectFlashAt < 300) {
                storyCtx.beginPath();
                storyCtx.arc(0, 0, mRad + 14, 0, Math.PI * 2);
                storyCtx.strokeStyle = `rgba(255, 255, 255, ${1 - (now - m.trickReflectFlashAt) / 300})`;
                storyCtx.lineWidth = 4;
                storyCtx.stroke();
            }
            // 스스로 두른 보호막은 몸 바깥에 파란 테로 보인다 (케이크의 버티기).
            if (m.shieldHp > 0) {
                storyCtx.beginPath();
                storyCtx.arc(0, 0, mRad + 7, 0, Math.PI * 2);
                storyCtx.strokeStyle = 'rgba(120, 200, 255, 0.9)';
                storyCtx.lineWidth = 3;
                storyCtx.stroke();
            }
        }
        storyCtx.restore();

        // 덩치가 크면 머리 위 체력 바도 같이 길어진다.
        const barW = Math.max(32, mRad * 2);
        const barH = mRad > SHARED.MONSTER_RADIUS ? 6 : 4;
        const barTop = m.y - mRad - 8 - barH;
        storyCtx.fillStyle = '#c0392b';
        storyCtx.fillRect(m.x - barW / 2, barTop, barW, barH);
        storyCtx.fillStyle = '#2ecc71';
        storyCtx.fillRect(m.x - barW / 2, barTop, barW * (m.hp / m.maxHp), barH);

        // 이름은 체력 바 바로 위에. 무엇이 다가오는지 보고 대비할 수 있어야 한다.
        storyCtx.save();
        storyCtx.font = 'bold 12px sans-serif';
        storyCtx.textAlign = 'center';
        storyCtx.fillStyle = '#ecf0f1';
        storyCtx.shadowColor = 'rgba(0,0,0,0.85)';
        storyCtx.shadowBlur = 4;
        storyCtx.fillText(def.name, m.x, barTop - 5);
        storyCtx.restore();

        if (m.elementMark) {
            storyCtx.save();
            storyCtx.font = 'bold 14px sans-serif';
            storyCtx.textAlign = 'center';
            storyCtx.fillStyle = '#fff';
            storyCtx.shadowColor = 'rgba(0,0,0,0.8)';
            storyCtx.shadowBlur = 3;
            // 이름 한 줄 위로 올려서 겹치지 않게.
            storyCtx.fillText(elementMarkLabel(m.elementMark), m.x, barTop - 20);
            storyCtx.restore();
        }
    });

    // Arrows, extrapolated from the last server position so they glide.
    Object.values(storyProjectiles).forEach(pr => {
        const t = (now - pr.at) / 1000;
        const x = pr.x + pr.vx * t;
        const y = pr.y + pr.vy * t;
        storyCtx.save();
        storyCtx.translate(x, y);
        storyCtx.rotate(pr.angle);
        // Shaft
        storyCtx.strokeStyle = '#f5deb3';
        storyCtx.lineWidth = 3;
        storyCtx.beginPath();
        storyCtx.moveTo(-11, 0);
        storyCtx.lineTo(7, 0);
        storyCtx.stroke();
        // Head
        storyCtx.fillStyle = '#5d4037';
        storyCtx.beginPath();
        storyCtx.moveTo(12, 0);
        storyCtx.lineTo(5, -4.5);
        storyCtx.lineTo(5, 4.5);
        storyCtx.closePath();
        storyCtx.fill();
        // Fletching
        storyCtx.strokeStyle = '#e74c3c';
        storyCtx.lineWidth = 2;
        storyCtx.beginPath();
        storyCtx.moveTo(-11, 0); storyCtx.lineTo(-7, -4);
        storyCtx.moveTo(-11, 0); storyCtx.lineTo(-7, 4);
        storyCtx.stroke();
        storyCtx.restore();
    });

    storyGreatSlashes = storyGreatSlashes.filter(g => now < g.until);
    drawGreatSlashes(storyCtx, storyGreatSlashes, now);
    drawThrownDrops(storyCtx, storyDrops, now);
    storyDropSplashes = storyDropSplashes.filter(s => now < s.until);
    drawDropSplashes(storyCtx, storyDropSplashes, now);

    storyProjectileSparks = storyProjectileSparks.filter(s => now < s.until);
    storyProjectileSparks.forEach(s => {
        const life = (s.until - now) / 220;
        storyCtx.beginPath();
        storyCtx.arc(s.x, s.y, 6 + (1 - life) * 10, 0, Math.PI * 2);
        storyCtx.strokeStyle = `rgba(231, 76, 60, ${life})`;
        storyCtx.lineWidth = 3;
        storyCtx.stroke();
    });

    drawSummons(storyCtx, storySummons, socket.id);

    // 파트너는 내 쿠키보다 먼저 그린다 -- 겹쳤을 때 내가 위에 오는 편이
    // 자기 쿠키를 놓치지 않는다.
    Object.values(storyPartners).forEach(pl => {
        const pStats = SHARED.CHARACTERS[pl.charType] || SHARED.CHARACTERS.kicker;
        const R = SHARED.PLAYER_RADIUS;
        storyCtx.save();
        storyCtx.translate(pl.x, pl.y);
        // 바다 수호자맛 sea_hide: 파트너 쪽은 storyTick이 매번 새로 보내주는
        // untouchableUntil(서버 Date.now() 기준)로 판단한다.
        const plHidden = pl.alive && !!pl.untouchableUntil && Date.now() < pl.untouchableUntil;
        storyCtx.globalAlpha = pl.alive ? (plHidden ? 0.35 : 1) : 0.4;
        if (refreshLowHpAura(pStats, pl)) drawLowHpAura(storyCtx, R, now);
        if (plHidden) {
            const ripple = 6 + Math.sin(now / 120) * 4;
            storyCtx.beginPath();
            storyCtx.arc(0, 0, R + 14 + ripple, 0, Math.PI * 2);
            storyCtx.strokeStyle = 'rgba(52, 152, 219, 0.85)';
            storyCtx.lineWidth = 5;
            storyCtx.stroke();
        }
        drawCookieBody(storyCtx, R, pStats, pl.alive);
        storyCtx.beginPath();
        storyCtx.arc(0, 0, R, 0, Math.PI * 2);
        storyCtx.lineWidth = 2;
        storyCtx.strokeStyle = '#3498db'; // 파란 테두리 = 파트너
        storyCtx.stroke();
        storyCtx.save();
        storyCtx.rotate(pl.facing || 0);
        drawCharacterWeapon(storyCtx, R, pStats, pl.alive);
        storyCtx.restore();
        if (pl.shieldHp > 0) {
            storyCtx.beginPath();
            storyCtx.arc(0, 0, R + 6, 0, Math.PI * 2);
            storyCtx.strokeStyle = 'rgba(52, 152, 219, 0.9)';
            storyCtx.lineWidth = 3;
            storyCtx.stroke();
        }
        storyCtx.globalAlpha = 1;
        storyCtx.fillStyle = '#ecf0f1';
        storyCtx.font = 'bold 12px sans-serif';
        storyCtx.textAlign = 'center';
        storyCtx.fillText(pStats.shortName || pStats.name, 0, -R - 8);
        storyCtx.restore();
    });

    if (storyPlayer) {
        const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
        const R = SHARED.PLAYER_RADIUS;
        storyCtx.save();
        storyCtx.translate(storyPlayer.x, storyPlayer.y);

        if (now < (storyPlayer.attackEffectUntil || 0) && stats.attackType === 'vampire_slash') {
            const sh = sweepShape(stats, storyPlayer.attackVampire);
            storyCtx.save();
            storyCtx.rotate(storyPlayer.facing);
            drawSweepSlash(storyCtx, R, sh.range, sh.width,
                1 - ((storyPlayer.attackEffectUntil || 0) - now) / SWEEP_MS, storyPlayer.attackVampire);
            storyCtx.restore();
        } else if (now < (storyPlayer.attackEffectUntil || 0)) {
            const stage = storyPlayer.attackEffectStage;
            const aRange = stage ? stage.range : stats.attackRange;
            const aWidth = (stage ? stage.width : stats.attackWidth) || 40;
            storyCtx.save();
            storyCtx.rotate(storyPlayer.facing);
            storyCtx.translate(0, attackSideShift(stats, storyPlayer.attackEffectSide));
            storyCtx.fillStyle = 'rgba(241, 196, 15, 0.35)';
            storyCtx.fillRect(R, -aWidth / 2, aRange, aWidth);
            storyCtx.strokeStyle = 'rgba(241, 196, 15, 0.9)';
            storyCtx.lineWidth = 2;
            storyCtx.strokeRect(R, -aWidth / 2, aRange, aWidth);
            storyCtx.restore();
        }

        if (now < (storyPlayer.skillEffectUntil || 0)) {
            if (stats.skillType === 'spin_heal') {
                storyCtx.beginPath();
                storyCtx.arc(0, 0, stats.skillRadius, 0, Math.PI * 2);
                storyCtx.fillStyle = 'rgba(39, 174, 96, 0.2)';
                storyCtx.fill();
                storyCtx.strokeStyle = 'rgba(39, 174, 96, 0.85)';
                storyCtx.lineWidth = 3;
                storyCtx.stroke();
            } else if (stats.skillType === 'sea_hide') {
                const ripple = 6 + Math.sin(now / 120) * 4;
                storyCtx.beginPath();
                storyCtx.arc(0, 0, R + 14 + ripple, 0, Math.PI * 2);
                storyCtx.strokeStyle = 'rgba(52, 152, 219, 0.85)';
                storyCtx.lineWidth = 5;
                storyCtx.stroke();
            } else {
                storyCtx.beginPath();
                storyCtx.arc(0, 0, R + 26, 0, Math.PI * 2);
                storyCtx.strokeStyle = 'rgba(231, 76, 60, 0.85)';
                storyCtx.lineWidth = 6;
                storyCtx.stroke();
            }
        }

        if (now < (storyPlayer.ultimateEffectUntil || 0)) {
            const pulse = 4 + Math.sin(now / 150) * 3;
            storyCtx.beginPath();
            storyCtx.arc(0, 0, R + 20 + pulse, 0, Math.PI * 2);
            storyCtx.strokeStyle = 'rgba(46, 204, 113, 0.7)';
            storyCtx.lineWidth = 5;
            storyCtx.stroke();
        }

        if (now < (storyPlayer.healEffectUntil || 0)) {
            storyCtx.beginPath();
            storyCtx.arc(0, 0, R + 10, 0, Math.PI * 2);
            storyCtx.strokeStyle = 'rgba(46, 204, 113, 0.9)';
            storyCtx.lineWidth = 3;
            storyCtx.stroke();
        }

        if (now < (storyPlayer.reviveEffectUntil || 0)) {
            drawReviveAura(storyCtx, R, stats,
                1 - (storyPlayer.reviveEffectUntil - now) / REVIVE_EFFECT_MS);
        }

        // 바다펄맛 패시브가 켜져 있으면 파란 물결이 돈다.
        if (refreshLowHpAura(stats, storyPlayer)) drawLowHpAura(storyCtx, R, now);

        storyCtx.globalAlpha = now < (storyPlayer.untouchableUntil || 0) ? 0.35 : 1;
        drawCookieBody(storyCtx, R, stats, storyPlayer.alive);
        storyCtx.globalAlpha = 1;
        storyCtx.beginPath();
        storyCtx.arc(0, 0, R, 0, Math.PI * 2);
        storyCtx.strokeStyle = '#f1c40f';
        storyCtx.lineWidth = 3;
        storyCtx.stroke();
        storyCtx.save();
        storyCtx.rotate(storyPlayer.facing || 0);
        drawCharacterWeapon(storyCtx, R, stats, storyPlayer.alive);
        storyCtx.restore();
        storyCtx.restore();

        const barW = 40, barH = 5;
        storyCtx.fillStyle = '#c0392b';
        storyCtx.fillRect(storyPlayer.x - barW / 2, storyPlayer.y - R - 8 - barH, barW, barH);
        storyCtx.fillStyle = '#2ecc71';
        storyCtx.fillRect(storyPlayer.x - barW / 2, storyPlayer.y - R - 8 - barH, barW * (storyPlayer.hp / storyPlayer.maxHp), barH);
    }

    if (isStoryTargetingSkill && storyMouseX !== null && storyPlayer) {
        const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
        const world = storyWorldFromMouse();
        drawUltimatePreview(storyCtx, world.x, world.y, stats.skillRadius || 90);
    }
    if (isStoryTargetingUltimate && storyMouseX !== null && storyPlayer) {
        const world = storyWorldFromMouse();
        const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
        if (stats.ultimateType === 'targeted_line_aoe') {
            drawUltimateLinePreview(storyCtx, world.x, world.y, stats.ultimateWidth, stats.ultimateHeight);
        } else {
            drawUltimatePreview(storyCtx, world.x, world.y, stats.ultimateRadius || 90);
        }
    }

    // Live preview while the ultimate stick is being pushed on touch.
    if (storyUltimateAim && storyPlayer) {
        const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
        const pt = ultimateAimPoint(storyPlayer.x, storyPlayer.y, storyPlayer.facing, stats, storyUltimateAim);
        if (stats.ultimateType === 'targeted_line_aoe') {
            drawUltimateLinePreview(storyCtx, pt.targetX, pt.targetY, stats.ultimateWidth, stats.ultimateHeight);
        } else {
            drawUltimatePreview(storyCtx, pt.targetX, pt.targetY, stats.ultimateRadius || 90, storyPlayer.x, storyPlayer.y);
        }
    }

    storyCtx.restore();

    // 20층 보스 "뒤바뀐 발걸음": 화면 전체가 보라색으로 물든다. 카메라 이동과
    // 무관하게 항상 화면 전체를 덮어야 해서 위쪽 restore() 이후, 화면 좌표계에서 그린다.
    if (storyReverseUntil && Date.now() < storyReverseUntil) {
        storyCtx.save();
        storyCtx.fillStyle = 'rgba(142, 68, 173, 0.22)';
        storyCtx.fillRect(0, 0, storyCanvas.width, storyCanvas.height);
        storyCtx.restore();
    }
}

// ---- Boss select ----
// 관리자 전용 opens progress-locked bosses, but NOT ones with no content yet:
// the server rejects a bossId it has no BOSS_DEFS entry for, so unlocking those
// would just be a dead end at the waiting screen.
function isBossUnlocked(b) {
    if (!SHARED.BOSS_DEFS[b.id]) return false;
    return !b.locked || adminPowerOn('stages');
}

function renderBossList() {
    bossListEl.innerHTML = '';
    SHARED.BOSS_LIST.forEach(b => {
        const unlocked = isBossUnlocked(b);
        const card = document.createElement('div');
        card.className = 'boss-card' + (unlocked ? '' : ' locked');
        card.innerHTML = `<div class="icon">${unlocked ? (b.icon || '🗿') : '🔒'}</div><div class="name">${b.name}</div>`;
        if (unlocked) card.addEventListener('click', () => openBossDetail(b.id));
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
    detailCharIcon.style.background = charIconBackground(stats);
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
    detailMultiBtn.classList.remove('hidden');
    detailSoloBtn.textContent = '솔로플레이';
    detailSoloBtn.disabled = false;
    detailSoloBtn.classList.remove('hidden');
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
    detailBossHp.textContent = `${bossDef.maxHpPerPlayer} (1인 기준)`;
    // 닿기만 해도 아픈 보스는 미리 알려준다 -- 붙어서 싸우는 쿠키에게는
    // 그 자체가 하나의 패턴이다.
    detailBossContact.classList.toggle('hidden', !bossDef.contact);
    if (bossDef.contact) {
        detailBossContact.querySelector('span:last-child').textContent =
            `몸에 닿아 있으면 ${(bossDef.contact.tickMs / 1000).toString().replace(/\.0$/, '')}초마다 ${bossDef.contact.damage}`;
    }
    detailBossRewardsEl.innerHTML = rewardChipsHtml(SHARED.clearRewardFor(bossId));
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
            socket.emit('joinRaid', { bossId: selectedBossId, charType, equip: equipPayload(charType), instinct: instinctPayload(charType) });
        } else {
            detailMultiBtn.disabled = true;
            detailSoloBtn.disabled = true;
            socket.emit('joinRaid', { bossId: selectedBossId, charType, solo: true, equip: equipPayload(charType), instinct: instinctPayload(charType) });
            socket.emit('startRaid');
        }
    } else if (raidPhase === 'matched' && !myReady) {
        myReady = true;
        detailMultiBtn.disabled = true;
        detailMultiBtn.textContent = '플레이 (대기중)';
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
        detailSoloBtn.classList.add('hidden'); // matched: one shared "플레이" button, not two
        const partnerEntry = Object.entries(data.players).find(([id]) => id !== socket.id);
        if (partnerEntry) {
            const pStats = SHARED.CHARACTERS[partnerEntry[1].charType] || SHARED.CHARACTERS.kicker;
            detailPartnerIcon.style.background = charIconBackground(pStats);
            detailPartnerName.textContent = pStats.name;
            detailPartnerPreview.classList.remove('hidden');
        }
        renderWaitingScene(RAID_WAIT_ELS, data.players, true);
        if (!myReady) {
            detailMultiBtn.textContent = '플레이';
            detailMultiBtn.disabled = false;
        }
    } else if (raidPhase !== 'idle') {
        // partner left before the fight started -- go back to searching alone
        raidPhase = 'searching';
        myReady = false;
        detailPartnerPreview.classList.add('hidden');
        renderWaitingScene(RAID_WAIT_ELS, data.players, false);
        detailSoloBtn.classList.remove('hidden');
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
let isTargetingSkill = false; // same idea for a placed skill (see isTargetedSkill)
let impactEffects = []; // [{x, y, radius, until}] fading impact markers, in arena space
let magmaZones = []; // [{x, y, radius, until}] long-lived damage zones (volcano cookie ultimate)
let fireLineZones = []; // [{x, y, facing, range, width, until}] 불꽃요정맛 궁극기 지대
let bossMark = null; // { element, charges } | null -- element_mark ultimate (greenapple cookie)
let raidQuakeUntil = 0; // camera shakes until this timestamp (earthquake ultimate)
let raidSummons = {}; // 번개지옥맛 궁극기가 부른 부하들
let raidGreatSlashes = []; // 크게베기의 벤 자리
let raidDrops = {}; // id -> thrown 물방울 in flight
let raidDropSplashes = []; // [{x, y, until}]

socket.on('dropThrown', ({ id, x, y, vx, vy, radius, charType }) => {
    raidDrops[id] = { x, y, vx, vy, radius, charType, at: performance.now() };
});

// 쿠키맛쿠키의 유도탄 구슬처럼 서버가 매 틱 방향을 트는 투사체는 위치를
// 다시 맞춰줘야 클라이언트의 직선 외삽(dead-reckoning)이 커브를 따라간다.
socket.on('dropUpdate', ({ id, x, y, vx, vy }) => {
    const d = raidDrops[id];
    if (!d) return;
    d.x = x; d.y = y; d.vx = vx; d.vy = vy; d.at = performance.now();
});

socket.on('dropGone', ({ id, hit, x, y }) => {
    const charType = raidDrops[id] && raidDrops[id].charType;
    delete raidDrops[id];
    if (hit) raidDropSplashes.push({ x, y, charType, until: performance.now() + 260 });
});

socket.on('raidStarted', (data) => {
    boss = new Boss(currentRoomState.bossId);
    boss.setHp(data.bossHp, data.bossMaxHp);
    players = {};
    Object.entries(data.players).forEach(([id, p]) => {
        const pl = new Player(id, p.charType, p.x, p.y, id === socket.id);
        pl.hp = p.hp; pl.maxHp = p.maxHp; pl.facing = p.facing; pl.alive = p.alive; pl.shieldHp = p.shieldHp || 0;
        // Only my own cookie's equipment is known here -- a partner's numbers
        // live on the server, which is the side that matters for damage.
        if (id === socket.id) {
            const b = equipBonusOf(p.charType);
            pl.equipSpeed = b.speed;
            pl.equipCooldown = b.cooldown;
        }
        players[id] = pl;
    });
    partnerHpContainer.classList.toggle('hidden', Object.keys(players).length < 2);
    raidStartAt = performance.now();
    isTargetingUltimate = false;
    impactEffects = [];
    magmaZones = [];
    fireLineZones = [];
    raidDrops = {};
    raidDropSplashes = [];
    raidGreatSlashes = [];
    raidSummons = {};
    bossMark = null;
    raidQuakeUntil = 0;
    resetDetailActions();
    settingsMenu.classList.add('hidden');
    leavePendingBanner.classList.add('hidden');
    leaveRequestModal.classList.add('hidden');
    updateHpBars();
    const mine = players[socket.id];
    if (mine) syncMobileButtonIcons(mine.charType, false);
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

// 쿠키맛쿠키 궁극기: 원이 아니라 직사각형 범위.
socket.on('ultimateLineImpact', ({ x, y, width, height }) => {
    impactEffects.push({ x, y, width, height, until: performance.now() + 400 });
});

socket.on('skillMark', ({ x, y, radius }) => {
    impactEffects.push({ x, y, radius, until: performance.now() + 500 });
});
socket.on('ultimateMark', ({ x, y, radius }) => {
    impactEffects.push({ x, y, radius, until: performance.now() + 700 });
});
socket.on('summonTick', ({ summons }) => { raidSummons = summons || {}; });

socket.on('greatSlash', (d) => {
    raidGreatSlashes.push({ ...d, until: performance.now() + d.windupMs + 250 });
    const me = players[socket.id];
    if (me && d.id === socket.id) me.speedBoostUntil = performance.now() + me.stats.ultimateSpeedDurationMs;
});

socket.on('butterflyMode', ({ id, on }) => {
    const p = players[id];
    if (!p) return;
    p.butterflyOn = on;
    if (id === socket.id) p.lastUltimateClientTime = on ? Infinity : performance.now();
});

socket.on('playerTeleported', ({ id, x, y }) => {
    const p = players[id];
    if (!p) return;
    p.x = x;
    p.y = y;
});

socket.on('lightningStrike', ({ x, y, radius }) => {
    impactEffects.push({ x, y, radius, until: performance.now() + 400, bolt: true });
});

socket.on('magmaZonePlaced', ({ x, y, radius, durationMs, look }) => {
    magmaZones.push({ x, y, radius, look, until: performance.now() + durationMs });
});

socket.on('fireLineZonePlaced', ({ x, y, facing, range, width, durationMs }) => {
    fireLineZones.push({ x, y, facing, range, width, until: performance.now() + durationMs });
});

socket.on('earthquake', () => {
    raidQuakeUntil = performance.now() + QUAKE_DURATION_MS;
});

socket.on('reviveBlast', ({ id }) => {
    const p = players[id];
    if (!p) return;
    impactEffects.push({ x: p.x, y: p.y, radius: 220, until: performance.now() + 500, bolt: true });
});

// 바다펄맛 밀물 (보스 레이드).
socket.on('tideCast', ({ windupMs, x, y, radius }) => {
    if (!windupMs) return;
    impactEffects.push({ x, y, radius, until: performance.now() + windupMs, tide: true });
});
socket.on('tideStage', ({ id, stage }) => {
    const p = players[id];
    if (p) p.tideStage = stage;
});

socket.on('bossMarked', ({ element, charges, until }) => {
    bossMark = element ? { element, charges, until } : null;
});

socket.on('playerHealed', ({ id, hp }) => {
    const p = players[id];
    if (!p) return;
    p.hp = hp;
    p.triggerHealEffect();
    updateHpBars();
});

// 전기줄맛: 상체 <-> 하체 <-> 합체. 체력 상한 자체가 바뀐다.
socket.on('bodyFormChanged', ({ id, hp, maxHp }) => {
    const p = players[id];
    if (!p) return;
    p.hp = hp;
    p.maxHp = maxHp;
    p.triggerHealEffect();
    updateHpBars();
});

socket.on('playerRevived', ({ id, hp }) => {
    const p = players[id];
    if (!p) return;
    p.hp = hp;
    p.alive = true;
    const at = performance.now();
    p.healEffectUntil = at + 900; // brighter, longer flash
    p.reviveEffectUntil = at + REVIVE_EFFECT_MS; // 쿠키에서 바로 티가 나게
    if (p.isLocal) raidQuakeUntil = Math.max(raidQuakeUntil, at + 450);
    updateHpBars();
});

socket.on('bossDamaged', ({ bossHp }) => {
    if (boss) boss.setHp(bossHp);
    updateHpBars();
});

socket.on('playerDamaged', ({ id, hp, alive, x, y, shieldHp }) => {
    const p = players[id];
    if (!p) return;
    p.hp = hp; p.alive = alive;
    p.shieldHp = shieldHp || 0;
    if (x !== undefined) { p.x = x; p.y = y; }
    updateHpBars();
});

socket.on('playerShielded', ({ id, shieldHp }) => {
    const p = players[id];
    if (!p) return;
    p.shieldHp = shieldHp;
    updateHpBars();
});

// 바다 수호자맛 sea_hide: 파트너 쪽은 서버 이벤트로만 알 수 있다 (본인은
// triggerSkillEffect가 누르는 순간 바로 예측해서 세운다). until은 서버의
// Date.now() 기준이라 performance.now() 기준으로 바꿔서 저장한다.
socket.on('playerHidden', ({ id, until }) => {
    const p = players[id];
    if (!p) return;
    p.untouchableUntil = performance.now() + Math.max(0, until - Date.now());
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

let resultReturnScreen = 'bossSelect'; // where the result screen's back button sends you

socket.on('raidResult', ({ result }) => {
    stopLoop();
    resultRewardsEl.innerHTML = '';
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
        if (currentRoomState) {
            recordClear(currentRoomState.bossId, performance.now() - raidStartAt);
            resultRewardsEl.innerHTML = rewardChipsHtml(payClearReward(currentRoomState.bossId))
                + equipDropChipHtml(rollClearDrop(currentRoomState.bossId));
        }
    } else {
        resultTitle.textContent = '전멸...';
        resultTitle.style.color = '#e74c3c';
        resultDesc.textContent = '파티가 전멸했습니다.';
    }
    resultReturnScreen = 'bossSelect';
    showScreen('result');
});

resultBackBtn.addEventListener('click', () => {
    if (resultReturnScreen === 'event') {
        renderEventScreen();
        showScreen('event');
    } else if (resultReturnScreen === 'storyTower') {
        renderTower();
        showScreen('storyTower');
    } else if (resultReturnScreen === 'awakenDetail') {
        // 각성모드에서 왔으면 보스 선택이 아니라 각성모드로 돌아간다.
        renderAwakenDetail();
        showScreen('awakenDetail');
    } else if (resultReturnScreen === 'legendDetail') {
        renderLegendDetail();
        showScreen('legendDetail');
    } else if (resultReturnScreen === 'modeSelect') {
        showScreen('modeSelect');
    } else {
        renderBossList();
        showScreen('bossSelect');
    }
});

function updateHpBars() {
    if (!boss) return;
    bossHpBar.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
    bossHpLabel.textContent = `${boss.def.name} (${Math.max(0, Math.ceil(boss.hp))}/${boss.maxHp})`;
    const me = players[socket.id];
    if (me) {
        myHpBar.style.width = `${Math.max(0, (me.hp / me.maxHp) * 100)}%`;
        myHpText.textContent = hpBarLabel(me.hp, me.maxHp);
        myShieldBadge.textContent = `🛡${me.shieldHp || 0}`;
        myShieldBadge.classList.toggle('hidden', !me.shieldHp);
    }
    const partner = Object.values(players).find(p => p.id !== socket.id);
    if (partner) {
        partnerHpBar.style.width = `${Math.max(0, (partner.hp / partner.maxHp) * 100)}%`;
        partnerHpText.textContent = hpBarLabel(partner.hp, partner.maxHp);
        partnerShieldBadge.textContent = `🛡${partner.shieldHp || 0}`;
        partnerShieldBadge.classList.toggle('hidden', !partner.shieldHp);
    }
}

function updateCooldownDisplay(now) {
    const me = players[socket.id];
    if (!me) return;
    let skillRemain = 0, ultRemain = 0;
    if (me.stats.skillType) {
        const remain = Math.max(0, me.stats.skillCooldown * (me.equipCooldown || 1)
            - (now - me.lastSkillClientTime)) / 1000;
        mySkillCdEl.textContent = remain > 0.05 ? `${remain.toFixed(1)}s` : '사용가능';
        skillRemain = remain;
    }
    if (ultimateIsHeldOn(me.stats, me)) {
        myUltimateCdEl.textContent = '사용중';
    } else if (me.stats.ultimateType) {
        const remain = Math.max(0, me.stats.ultimateCooldownMs * (me.equipCooldown || 1)
            - (now - me.lastUltimateClientTime)) / 1000;
        myUltimateCdEl.textContent = remain > 0.05 ? `${remain.toFixed(1)}s` : '사용가능';
        ultRemain = remain;
    } else {
        myUltimateCdEl.textContent = '없음'; // 바다펄맛은 궁극기 칸이 비어 있다
    }
    if (me.stats.skillType === 'tide_cycle' && skillRemain <= 0.05) {
        mySkillCdEl.textContent = `${tideStageNoOf(me)}단계`;
    }
    if (me.stats.ultimateType === 'nature_awaken' && ultRemain <= 0.05) {
        myUltimateCdEl.textContent = `${natureAwakenStageNoOf(me)}단계`;
    }
    syncMobileCooldowns(skillRemain, ultRemain, false, !me.stats.ultimateType);
}

// ---- Input ----
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    const inStoryFight = !screens.storyFight.classList.contains('hidden');
    if (e.key === 'f' || e.key === 'F') {
        if (inStoryFight) storyHandleUltimateKey();
        else handleUltimateKey();
    }
    if (e.key === 'Escape') {
        isTargetingUltimate = false;
        isStoryTargetingUltimate = false;
        isTargetingSkill = false;
        isStoryTargetingSkill = false;
    }
});
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        if (isTargetingUltimate) confirmUltimateTarget();
        else if (isTargetingSkill) confirmSkillTarget();
        else if (autoAimActive()) fireAutoAimedAttack(false);
        else tryAttack();
    } else if (e.button === 2) {
        handleSkillTrigger();
    }
});
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouseX = (e.clientX - rect.left) * scaleX;
    mouseY = (e.clientY - rect.top) * scaleY;
});

// The canvas buffer is resized to fill the viewport (see resizeGameCanvas),
// so screen/world conversion needs to account for the resulting scale factor
// -- world space still uses the original fixed-size arena coordinates.
const BASE_CANVAS_SIZE = 700;
let gameScale = 1;
function screenToWorld(sx, sy) {
    return { x: (sx - canvas.width / 2) / gameScale, y: (sy - canvas.height / 2) / gameScale };
}
function resizeGameCanvas() {
    const size = Math.min(window.innerWidth, window.innerHeight) - 40;
    canvas.width = size;
    canvas.height = size;
    gameScale = size / BASE_CANVAS_SIZE;
}
window.addEventListener('resize', resizeGameCanvas);
resizeGameCanvas();

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

// Right-click: cast on the spot for most cookies, arm targeting for a placed one.
function handleSkillTrigger() {
    const me = players[socket.id];
    if (!me) return;
    if (!isTargetedSkill(me.stats.skillType, me)) { tryUseSkill(); return; }
    if (mobileControlsEnabled) {
        if (!me.canUseSkill(performance.now())) return;
        me.triggerSkillEffect();
        socket.emit('playerSkill', mobileSkillTarget(me.x, me.y, me.facing, me.stats));
        return;
    }
    if (isTargetingSkill) { isTargetingSkill = false; return; }
    if (!me.canUseSkill(performance.now())) return;
    isTargetingSkill = true;
}

function confirmSkillTarget() {
    isTargetingSkill = false;
    const me = players[socket.id];
    if (!me || mouseX === null) return;
    if (!me.canUseSkill(performance.now())) return;
    me.triggerSkillEffect();
    const world = screenToWorld(mouseX, mouseY);
    socket.emit('playerSkill', { targetX: world.x, targetY: world.y });
}

function isTargetedUltimate(type) {
    return type === 'targeted_aoe' || type === 'magma_zone' || type === 'lightning_strike'
        || type === 'magma_pour' || type === 'mark_flood' || type === 'dumpling_zone'
        || type === 'sky_slam' || type === 'targeted_line_aoe';
}

// 때파기 / 물방울 터트리기 are the first SKILLS that are placed on a spot
// rather than fired from the body, so they arm the same way an ultimate does:
// trigger once to aim, left-click to commit, trigger again to cancel.
// 바다펄맛 밀물은 1단계만 자리를 안 찍는다. 2단계부터는 찍어서 쓴다.
function isTargetedSkill(type, o) {
    if (type === 'tide_cycle') return tideStageNoOf(o) > 1;
    return type === 'burrow_mark' || type === 'mark_burst' || type === 'blink_heal' || type === 'water_drag';
}
// Where a placed skill lands with no mouse (mobile): just ahead of the player.
function mobileSkillTarget(x, y, facing, stats) {
    const dist = stats.skillRadius || 90;
    return { targetX: x + Math.cos(facing) * dist, targetY: y + Math.sin(facing) * dist };
}

// Touch has no mouse to place a zone with, so instead of arming a targeting
// mode the zone is dropped straight ahead of the player -- aim by facing first
// (either stick sets facing), then tap the ultimate. Offset by the zone's own
// radius so its near edge sits about on the player.
function mobileUltimateTarget(x, y, facing, stats) {
    const dist = stats.ultimateRadius || 90;
    return { targetX: x + Math.cos(facing) * dist, targetY: y + Math.sin(facing) * dist };
}

// F does different things depending on the character: instant cast for
// heal-over-time, or arm targeting mode for a click-to-place AOE.
function handleUltimateKey() {
    const me = players[socket.id];
    if (!me) return;
    if (isTargetedUltimate(me.stats.ultimateType)) {
        if (mobileControlsEnabled) {
            if (!me.canUseUltimate(performance.now())) return;
            me.markUltimateUsed();
            socket.emit('playerUltimate', mobileUltimateTarget(me.x, me.y, me.facing, me.stats));
            return;
        }
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
    const world = screenToWorld(mouseX, mouseY);
    socket.emit('playerUltimate', { targetX: world.x, targetY: world.y });
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
        if (mobileControlsEnabled) {
            // No mouse on touch -- face the way the movement stick is pushed.
            // The attack button auto-aims separately (see fireAutoAimedAttack),
            // but this loop runs every frame too -- without the attackEffectUntil
            // guard it would immediately snap facing back to the movement
            // direction on the very next frame, so a swing thrown while walking
            // visibly landed toward the joystick instead of the auto-aimed target.
            if (joystickFacing !== null && now >= me.attackEffectUntil) me.facing = joystickFacing;
        } else if (autoAimEnabled) {
            // 자동조준: hold the aim on the target every frame. Doing it only at
            // the moment of the click wasn't enough -- this loop would re-aim at
            // the mouse on the very next frame, so the swing was drawn (and the
            // next move emitted) pointing at the cursor again.
            const angle = nearestTargetAngle(me.x, me.y, false);
            if (angle !== null) me.facing = angle;
        } else if (mouseX !== null) {
            const world = screenToWorld(mouseX, mouseY);
            me.aimAt(world.x, world.y);
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
    const q = quakeOffset(now, raidQuakeUntil);
    ctx.translate(canvas.width / 2 + q.x, canvas.height / 2 + q.y);
    ctx.scale(gameScale, gameScale);

    ctx.beginPath();
    ctx.arc(0, 0, SHARED.ARENA_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (boss) boss.draw(ctx, now);
    if (boss && bossMark) {
        ctx.save();
        ctx.translate(0, -SHARED.BOSS_RADIUS - 30);
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(elementMarkLabel(bossMark), 0, 0);
        ctx.restore();
    }
    drawSummons(ctx, raidSummons, socket.id);
    Object.values(players).forEach(p => p.draw(ctx, now));

    raidGreatSlashes = raidGreatSlashes.filter(g => now < g.until);
    drawGreatSlashes(ctx, raidGreatSlashes, now);
    drawThrownDrops(ctx, raidDrops, now);
    raidDropSplashes = raidDropSplashes.filter(s => now < s.until);
    drawDropSplashes(ctx, raidDropSplashes, now);

    impactEffects = impactEffects.filter(fx => now < fx.until);
    impactEffects.forEach(fx => {
        const t = 1 - Math.max(0, (fx.until - now) / 400); // 0 -> 1 as it fades
        const rgb = fx.tide ? '46, 134, 222' : (fx.bolt ? '241, 196, 15' : '142, 68, 173');
        ctx.beginPath();
        if (fx.width) {
            ctx.rect(fx.x - fx.width / 2, fx.y - fx.height / 2, fx.width, fx.height);
        } else {
            ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
        }
        ctx.fillStyle = `rgba(${rgb}, ${0.5 * (1 - t)})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(${rgb}, 0.9)`;
        ctx.lineWidth = 3;
        ctx.stroke();
        if (fx.bolt) {
            ctx.save();
            ctx.strokeStyle = `rgba(255, 255, 200, ${1 - t})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(fx.x, fx.y - 260);
            ctx.lineTo(fx.x + 14, fx.y - 160);
            ctx.lineTo(fx.x - 12, fx.y - 90);
            ctx.lineTo(fx.x + 8, fx.y - 30);
            ctx.lineTo(fx.x, fx.y);
            ctx.stroke();
            ctx.restore();
        }
    });

    magmaZones = magmaZones.filter(z => now < z.until);
    magmaZones.forEach(z => {
        const pulse = 3 + Math.sin(now / 120) * 3;
        const skin = zoneColors(z.look);
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius + pulse, 0, Math.PI * 2);
        ctx.fillStyle = skin.fill;
        ctx.fill();
        ctx.strokeStyle = skin.stroke;
        ctx.lineWidth = 3;
        ctx.stroke();
    });

    fireLineZones = fireLineZones.filter(z => now < z.until);
    drawFireLineZones(ctx, fireLineZones, now);

    if (isTargetingUltimate && mouseX !== null) {
        const me = players[socket.id];
        const world = screenToWorld(mouseX, mouseY);
        if (me && me.stats.ultimateType === 'targeted_line_aoe') {
            drawUltimateLinePreview(ctx, world.x, world.y, me.stats.ultimateWidth, me.stats.ultimateHeight);
        } else {
            drawUltimatePreview(ctx, world.x, world.y, me ? me.stats.ultimateRadius : 90);
        }
    }
    if (isTargetingSkill && mouseX !== null) {
        const me = players[socket.id];
        const world = screenToWorld(mouseX, mouseY);
        drawUltimatePreview(ctx, world.x, world.y, (me && me.stats.skillRadius) || 90);
    }

    // Live preview while the ultimate stick is being pushed on touch.
    if (ultimateAim) {
        const me = players[socket.id];
        if (me) {
            const pt = ultimateAimPoint(me.x, me.y, me.facing, me.stats, ultimateAim);
            if (me.stats.ultimateType === 'targeted_line_aoe') {
                drawUltimateLinePreview(ctx, pt.targetX, pt.targetY, me.stats.ultimateWidth, me.stats.ultimateHeight);
            } else {
                drawUltimatePreview(ctx, pt.targetX, pt.targetY, me.stats.ultimateRadius || 90, me.x, me.y);
            }
        }
    }

    ctx.restore();
}
