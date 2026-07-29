const socket = io();

// ---- Screens ----
const screens = {
    lobby: document.getElementById('lobby-screen'),
    shop: document.getElementById('shop-screen'),
    items: document.getElementById('items-screen'),
    awakenBoss: document.getElementById('awaken-boss-screen'),
    awakenDetail: document.getElementById('awaken-detail-screen'),
    gacha: document.getElementById('gacha-screen'),
    gachaPull: document.getElementById('gacha-pull-screen'),
    legendary: document.getElementById('legendary-screen'),
    modeSelect: document.getElementById('mode-select-screen'),
    storyMode: document.getElementById('story-mode-screen'),
    storyTower: document.getElementById('story-tower-screen'),
    storyFight: document.getElementById('story-fight-screen'),
    login: document.getElementById('login-screen'),
    signup: document.getElementById('signup-screen'),
    account: document.getElementById('account-screen'),
    controls: document.getElementById('controls-screen'),
    guestDetail: document.getElementById('guest-detail-screen'),
    guestFight: document.getElementById('guest-fight-screen'),
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
    // The lobby is where the currency bar lives; redraw it on the way in so a
    // reward taken on the result screen is already reflected.
    if (name === 'lobby') { renderCurrencyBar(); renderItemsBadge(); }
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
const detailBossRewardsEl = document.getElementById('detail-boss-rewards');
const detailBossContact = document.getElementById('detail-boss-contact');
const resultRewardsEl = document.getElementById('result-rewards');
const playBtn = document.getElementById('play-btn');
const characterSelectBtn = document.getElementById('character-select-btn');
const selectedCharNameEl = document.getElementById('selected-char-name');
const lobbyCharBody = document.getElementById('lobby-char-body');
const lobbyCharName = document.getElementById('lobby-char-name');
const characterListEl = document.getElementById('character-list');
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

// ---- Auth (login / signup / persistent session) ----
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const menuBtn = document.getElementById('menu-btn');
const sideMenu = document.getElementById('side-menu');
// The ☰ menu is now just two entries (계정 / 조작); everything else moved onto
// those two screens.
const accountResetBtn = document.getElementById('account-reset-btn');
const accountResetModal = document.getElementById('account-reset-modal');
const accountResetYes = document.getElementById('account-reset-yes');
const accountResetNo = document.getElementById('account-reset-no');
const menuAccountBtn = document.getElementById('menu-account-btn');
const menuControlsBtn = document.getElementById('menu-controls-btn');
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
        Object.keys(SHARED.CHARACTERS).forEach(id => {
            if (!gameData.unlockedCharacters.includes(id)) gameData.unlockedCharacters.push(id);
        });
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

const CURRENCY_LABELS = {
    coins: '코인',
    diamonds: '다이아',
    ticketNormal: '일반 뽑기 티켓',
    material: '일반 장비강화 재료',
    materialRare: '고급 장비강화 재료',
    potion: '강화포션',
    potionRare: '고급 강화포션',
    ticketWaterdrop: '물방울맛 뽑기 티켓',
    ticketMagma: '마그마맛 뽑기 티켓',
    ticketLightning: '번개전사맛 뽑기 티켓'
};

const CURRENCY_ICONS = {
    coins: '🪙',
    diamonds: '💎',
    ticketNormal: '🏷️',
    material: '🪨',
    materialRare: '💊',
    potion: '🧪',
    potionRare: '⚗️',
    ticketWaterdrop: '🎫',
    ticketMagma: '🎫',
    ticketLightning: '🎫'
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

    if (!isAdmin()) {
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

// 각성 장비를 낀 상태의 수치. 각성 장비는 능력치를 더하는 게 아니라 발차기
// 피해나 궁극기 보호막을 통째로 바꾸기도 해서, 상세 화면은 이걸 읽어야
// 실제로 싸울 때의 숫자가 그대로 보인다.
function statsWithGear(charType) {
    return SHARED.characterWithGear(charType, equipPayload(charType))
        || SHARED.CHARACTERS.kicker;
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

// The single place anything should read a currency from: admin mode makes every
// balance unlimited, so callers never have to special-case it.
function currencyAmount(key) {
    if (isAdmin()) return Infinity;
    return (gameData.currencies && gameData.currencies[key]) || 0;
}
function currencyText(key) {
    const n = currencyAmount(key);
    return n === Infinity ? '∞' : n.toLocaleString();
}

function isCharacterUnlocked(id) {
    return isAdmin() || gameData.unlockedCharacters.includes(id);
}

function renderAdminCurrencies() {
    adminCurrencyListEl.innerHTML = Object.entries(CURRENCY_LABELS).map(([key, label]) =>
        `<div class="settings-row"><span class="settings-row-label">${label}</span>` +
        `<span class="settings-row-value">${currencyText(key)}</span></div>`
    ).join('');
}

function updateAdminUI() {
    const on = isAdmin();
    adminStatusEl.textContent = on ? '켜짐' : '꺼짐';
    adminStatusEl.classList.toggle('on', on);
    adminActiveEl.classList.toggle('hidden', !on);
    if (on) {
        adminFormEl.classList.add('hidden');
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
    // Grant every cookie for real (not just visually) so the unlock survives
    // admin mode being switched back off.
    Object.keys(SHARED.CHARACTERS).forEach(id => {
        if (!gameData.unlockedCharacters.includes(id)) gameData.unlockedCharacters.push(id);
    });
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
    if (stats.passiveReviveCount) {
        const hpPct = Math.round(stats.passiveReviveHpRatio * 100);
        parts.push(hpPct >= 100
            ? `쓰러져도 전투당 ${stats.passiveReviveCount}번 체력을 모두 채워 완전 부활합니다.`
            : `쓰러져도 전투당 ${stats.passiveReviveCount}번 체력 ${hpPct}%로 부활합니다.`);
        if (stats.passiveReviveEnemySoloRatio) {
            parts.push(`부활하는 순간 충격파가 퍼져 상대가 한 명이면 그 상대의 체력을 ${Math.round(stats.passiveReviveEnemySoloRatio * 100)}%, 여러 명이면 각각 ${Math.round(stats.passiveReviveEnemyCrowdRatio * 100)}%씩 깎습니다.`);
        }
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
    if (stats.awakenOnReviveNo) {
        parts.push(`쓰러져도 반드시 한 번 부활합니다. 각성 장비를 끼면 부활이 한 번 더 생기고,`
            + ` ${stats.awakenOnReviveNo}번째 부활에서 각성해 체력 ${stats.awakenedForm.health},`
            + ` 기본공격 ${stats.awakenedForm.attackDamage}, 궁극기 피해 ${stats.awakenedForm.ultimateDamage}가 됩니다.`);
    }
    if (stats.attackHealOnUse && stats.attackHealChance === undefined) {
        parts.push(`기본 공격이 적중할 때마다 팀 전체를 ${stats.attackHealOnUse}만큼 회복시킵니다.`);
    }
    return parts.length ? parts.join(' ') : '없음';
}

function describeAbility(stats, kind) {
    const sec = ms => (ms / 1000).toString().replace(/\.0$/, '');
    if (kind === 'passive') return passiveText(stats);
    if (kind === 'attack') {
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
                + ` 모든 베기가 흡혈 베기라, 맞히기만 해도 최대 체력의 ${Math.round(stats.attackVampireHealRatio * 100)}%를 빨아옵니다.`
                + ` 그 베기로 쓰러뜨렸을 때도 마찬가지이고, 보스에게도 똑같이 적용됩니다.`
                + ` (재사용 대기시간 ${sec(stats.attackCooldown)}초)`;
        }
        if (stats.attackType === 'throw_projectile') {
            return `물방울(${stats.attackProjectileRadius * 2}px)을 전방으로 던져 최대 ${stats.attackRange}px까지 날리고, 맞은 적에게 ${stats.attackDamage}의 피해를 줍니다.`
                + ` 실제로 날아가기 때문에 빗나갈 수도 있습니다. (재사용 대기시간 ${sec(stats.attackCooldown)}초)`;
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
            default:
                return '스킬 정보가 없습니다.';
        }
    }
    if (kind === 'ultimate') {
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
            case 'element_mark':
                return `${sec(stats.ultimateDurationMs)}초 동안 기본 공격이 적중할 때마다 대상에게 속성 표식을 남깁니다. 표식이 있는 동안 같은 속성의 캐릭터가 공격하면 피해가 ${stats.ultimateMarkMultiplier}배가 되고, 표식은 ${stats.ultimateMarkUses}회 사용되면 사라집니다. 표식은 중첩됩니다.${cd}`;
            case 'awakening_rapid':
                return `${sec(stats.ultimateDurationMs)}초 동안 기본 공격의 재사용 대기시간이 ${stats.ultimateRapidCooldown / 1000}초로 줄어들고, ${stats.ultimateAutoKickEvery}번째 공격마다 자동으로 발차기(피해 ${stats.skillDamage})가 나갑니다.${cd}`;
            case 'team_shield':
                return `팀원 모두에게 ${stats.ultimateShieldAmount}만큼의 피해를 막아주는 보호막을 씌웁니다. 보호막이 받는 피해를 모두 흡수하면 사라집니다.${cd}`;
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

// Split-color icon background so similarly-colored cookies stay tellable
// apart at a glance -- a hard 50/50 split, not a blend.
function charIconBackground(stats) {
    if (stats.colorLeft && stats.colorRight) {
        return `linear-gradient(90deg, ${stats.colorLeft} 50%, ${stats.colorRight} 50%)`;
    }
    return stats.color;
}

function selectCharDetailAbility(kind) {
    const stats = statsWithGear(viewingCharacterId);
    charDetailDesc.textContent = describeAbility(stats, kind);
    [
        [charDetailAttackIcon, 'attack'],
        [charDetailSkillIcon, 'skill'],
        [charDetailUltimateIcon, 'ultimate'],
        [charDetailPassiveIcon, 'passive']
    ].forEach(([el, k]) => el.classList.toggle('selected', k === kind));
}

charDetailAttackIcon.addEventListener('click', () => selectCharDetailAbility('attack'));
charDetailSkillIcon.addEventListener('click', () => selectCharDetailAbility('skill'));
charDetailUltimateIcon.addEventListener('click', () => selectCharDetailAbility('ultimate'));
charDetailPassiveIcon.addEventListener('click', () => selectCharDetailAbility('passive'));

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
    great_slash: '⚔️'
};
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
const MOBILE_CONTROLS_KEY = 'boss_raid_mobile_controls';
const AUTO_AIM_KEY = 'boss_raid_auto_aim'; // same reasoning: device-local, not cloud-synced
let mobileControlsEnabled = localStorage.getItem(MOBILE_CONTROLS_KEY) === '1';
let autoAimEnabled = localStorage.getItem(AUTO_AIM_KEY) === '1';
const controlsMobileBtn = document.getElementById('controls-mobile-btn');
const controlsMobileStatus = document.getElementById('controls-mobile-status');
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
    controlsMobileStatus.textContent = mobileControlsEnabled ? '켜짐' : '꺼짐';
    controlsMobileStatus.classList.toggle('on', mobileControlsEnabled);

    const aimOn = autoAimActive();
    controlsAutoAimStatus.textContent = aimOn ? '켜짐' : '꺼짐';
    controlsAutoAimStatus.classList.toggle('on', aimOn);
    // While mobile controls are on, auto-aim can't be switched off -- the mobile
    // attack button has no other way to aim -- so the row goes unclickable.
    controlsAutoAimBtn.disabled = mobileControlsEnabled;
    controlsAutoAimBtn.classList.toggle('locked', mobileControlsEnabled);
    controlsAutoAimHint.textContent = mobileControlsEnabled
        ? '모바일 조작을 켜면 자동조준은 항상 켜져 있어요. 끄려면 먼저 모바일 조작을 꺼주세요.'
        : '켜면 조준할 필요 없이 클릭만 해도 가장 가까운 적을 자동으로 조준해서 공격해요.';
}
function applyMobileControlsVisibility() {
    if (!mobileControlsFight) return;
    mobileControlsFight.classList.toggle('hidden', !mobileControlsEnabled);
    mobileControlsStory.classList.toggle('hidden', !mobileControlsEnabled);
    const guestControls = document.getElementById('mobile-controls-guest');
    if (guestControls) guestControls.classList.toggle('hidden', !mobileControlsEnabled);
    document.body.classList.toggle('mc-on', mobileControlsEnabled);
}
updateControlsScreen();
applyMobileControlsVisibility(); // restore the saved preference on load
controlsMobileBtn.addEventListener('click', () => {
    mobileControlsEnabled = !mobileControlsEnabled;
    localStorage.setItem(MOBILE_CONTROLS_KEY, mobileControlsEnabled ? '1' : '0');
    updateControlsScreen();
    applyMobileControlsVisibility();
});
controlsAutoAimBtn.addEventListener('click', () => {
    if (mobileControlsEnabled) return; // locked on; see updateControlsScreen
    autoAimEnabled = !autoAimEnabled;
    localStorage.setItem(AUTO_AIM_KEY, autoAimEnabled ? '1' : '0');
    updateControlsScreen();
});
controlsBackBtn.addEventListener('click', () => showScreen('lobby'));

// Drives movement through the same keys{} object WASD already feeds into
// updateLocal()/storyFrame(), snapped to 8 directions -- so no change was
// needed to the underlying movement math. Also remembers the last push
// angle for aiming, since there's no mouse to derive facing from on touch.
let joystickFacing = null;
let storyJoystickFacing = null;
function applyJoystickAngle(angle, isStory) {
    keys['w'] = keys['a'] = keys['s'] = keys['d'] = false;
    if (angle !== null) {
        const deg = angle * 180 / Math.PI;
        if (deg > -22.5 && deg <= 22.5) keys['d'] = true;
        else if (deg > 22.5 && deg <= 67.5) { keys['d'] = true; keys['s'] = true; }
        else if (deg > 67.5 && deg <= 112.5) keys['s'] = true;
        else if (deg > 112.5 && deg <= 157.5) { keys['s'] = true; keys['a'] = true; }
        else if (deg > 157.5 || deg <= -157.5) keys['a'] = true;
        else if (deg > -157.5 && deg <= -112.5) { keys['a'] = true; keys['w'] = true; }
        else if (deg > -112.5 && deg <= -67.5) keys['w'] = true;
        else { keys['w'] = true; keys['d'] = true; }
    }
    if (isStory) storyJoystickFacing = angle; else joystickFacing = angle;
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

// 던져진 물방울. Drawn straight from the throw: its velocity never changes,
// so the client can place it exactly without a per-tick sync from the server.
function drawThrownDrops(c, drops, now) {
    Object.values(drops).forEach(d => {
        const t = (now - d.at) / 1000;
        const x = d.x + d.vx * t;
        const y = d.y + d.vy * t;
        const r = d.radius || 10;
        c.save();
        c.translate(x, y);
        const grad = c.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.2, 0, 0, r);
        grad.addColorStop(0, '#eaf8ff');
        grad.addColorStop(1, '#1f6fb2');
        c.beginPath();
        c.arc(0, 0, r, 0, Math.PI * 2);
        c.fillStyle = grad;
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.85)';
        c.lineWidth = 2;
        c.stroke();
        c.restore();
    });
}

// The splash where one landed (or fizzled out).
function drawDropSplashes(c, splashes, now) {
    splashes.forEach(s => {
        const life = (s.until - now) / 260;
        c.beginPath();
        c.arc(s.x, s.y, 8 + (1 - life) * 16, 0, Math.PI * 2);
        c.strokeStyle = `rgba(127, 212, 245, ${Math.max(0, life)})`;
        c.lineWidth = 3;
        c.stroke();
    });
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
    attackEl.textContent = SKILL_ICONS[stats.attackType] || '⚔';
    skillEl.textContent = SKILL_ICONS[stats.skillType] || '🌀';
    skillEl.appendChild(cdSkill);
    // The ultimate control is an aim joystick, so its icon lives on the thumb --
    // writing to the zone itself would wipe the base/thumb elements.
    const ultThumb = ultEl.querySelector('.mc-aim-thumb');
    ultThumb.textContent = SKILL_ICONS[stats.ultimateType] || '🔥';
    ultThumb.appendChild(cdUlt);
}

// Mirrors the text cooldown readouts into the buttons themselves, and dims a
// button while its ability is still recharging.
function syncMobileCooldowns(skillRemain, ultRemain, isStory) {
    if (!mobileControlsEnabled) return;
    const cdSkill = isStory ? mcSkillCdStoryEl : mcSkillCdFightEl;
    const cdUlt = isStory ? mcUltimateCdStoryEl : mcUltimateCdFightEl;
    const skillEl = isStory ? mcSkillStoryEl : mcSkillFightEl;
    const ultEl = isStory ? mcUltimateStoryEl : mcUltimateFightEl;
    cdSkill.textContent = skillRemain > 0.05 ? skillRemain.toFixed(1) : '';
    cdUlt.textContent = ultRemain > 0.05 ? ultRemain.toFixed(1) : '';
    skillEl.classList.toggle('recharging', skillRemain > 0.05);
    ultEl.classList.toggle('recharging', ultRemain > 0.05);
}

// ---- Character select ----
// Keeps both places the selection is shown in sync: the lobby's bottom-left
// button and the lobby centrepiece.
function updateSelectedCharLabel() {
    const stats = SHARED.CHARACTERS[gameData.selectedCharacter] || SHARED.CHARACTERS.kicker;
    selectedCharNameEl.textContent = stats.shortName || stats.name;
    lobbyCharBody.style.background = charIconBackground(stats);
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
    charactersByGradeDesc().forEach(([id, stats]) => {
        const unlocked = isCharacterUnlocked(id);
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
    charDetailIcon.style.background = charIconBackground(stats);
    charDetailName.textContent = stats.name;
    charDetailGrade.textContent = stats.grade || '-';
    charDetailGrade.className = gradeClass(stats.grade);
    charDetailElement.textContent = stats.element || '-';
    charDetailRole.textContent = stats.role || '-';
    const bonus = equipBonusOf(id);
    charDetailAtk.innerHTML = attackDamageText(stats)
        + (bonus.attack ? `<span class="cd-stat-bonus">+${bonus.attack}</span>` : '');
    charDetailHp.innerHTML = (stats.health != null ? stats.health : '-')
        + (bonus.health ? `<span class="cd-stat-bonus">+${bonus.health}</span>` : '');
    // 지금까지 비어 있던 헤더의 숫자: 장비를 포함한 공격력+체력 합산.
    charDetailPower.textContent = String(
        (Number(String(attackDamageText(stats)).split(' / ')[0]) || 0) + bonus.attack
        + (stats.health || 0) + bonus.health);
    charDetailAwakenSlot.classList.toggle('hidden', !SHARED.hasAwakenSlot(stats.grade));
    renderCharDetailEquipment(id);
    charDetailAttackIcon.textContent = SKILL_ICONS[stats.attackType] || '🗡';
    charDetailSkillIcon.textContent = SKILL_ICONS[stats.skillType] || '❔';
    charDetailUltimateIcon.textContent = SKILL_ICONS[stats.ultimateType] || '❔';
    charDetailPassiveIcon.classList.toggle('empty', !hasPassive(stats));
    selectCharDetailAbility('attack');
    showScreen('characterDetail');
}

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
    iap: '아직 판매 중인 상품이 없습니다.',
    item: '아직 판매 중인 아이템이 없습니다.'
};

function renderShopCategory(key) {
    Object.entries(shopCatButtons).forEach(([k, btn]) => btn.classList.toggle('selected', k === key));
    shopContent.innerHTML = `<p class="shop-empty">${SHOP_CATEGORIES[key]}</p>`;
}

Object.entries(shopCatButtons).forEach(([key, btn]) => {
    btn.addEventListener('click', () => renderShopCategory(key));
});

shopBtn.addEventListener('click', () => {
    renderShopCategory('currency');
    showScreen('shop');
});
backFromShopBtn.addEventListener('click', () => showScreen('lobby'));

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
    if (btn.dataset.key !== SHARED.AWAKEN_GEAR_ITEM_KEY) return;
    const res = useRandomAwakenGear();
    showItemsMsg(res.msg, res.ok);
    renderItems();
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

let awakenBossId = null;
let awakenLevel = 1;
// 3칸. 빈 칸은 null이고, 같은 쿠키를 두 칸에 넣지 못한다.
let awakenParty = new Array(SHARED.AWAKEN_PARTY_SIZE).fill(null);

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
        chip.addEventListener('click', () => { awakenLevel = lv; renderAwakenDetail(); });
        awakenLevelChipsEl.appendChild(chip);
    }
}

function renderAwakenParty() {
    awakenPartyEl.innerHTML = '';
    awakenParty.forEach((id, i) => {
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
    awakenPlayBtn.disabled = awakenParty.some(id => !id);
}

function openAwakenDetail(charType) {
    awakenBossId = charType;
    if (!SHARED.awakenLevelStats(awakenLevel)) awakenLevel = 1;
    showAwakenMsg('');
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
backFromAwakenDetailBtn.addEventListener('click', () => showScreen('awakenBoss'));

awakenPlayBtn.addEventListener('click', () => {
    if (awakenParty.some(id => !id)) {
        showAwakenMsg('파티 3명을 모두 채워 주세요.');
        return;
    }
    showAwakenMsg('');
    socket.emit('joinAwakenBoss', {
        charType: awakenBossId,
        level: awakenLevel,
        party: awakenParty,
        equipParty: awakenParty.map(id => equipPayload(id))
    });
});

// 한 판이 끝났을 때. 이겼으면 그 레벨의 드랍을 굴려 조각이나 각성 장비를 준다.
function showAwakenResult(awaken, result) {
    const stats = SHARED.CHARACTERS[awaken.charType] || SHARED.CHARACTERS.kicker;
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
    if (isAdmin()) return true;
    return eventStages(side).every(s => eventStageCleared(s.id));
}
// Stages open one at a time, like tower floors: you have to clear the one
// before it on the same side.
function eventStageUnlocked(side, index) {
    if (isAdmin()) return true; // 관리자 전용: every stage is open
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
    eventTicketAmountEl.textContent = isAdmin() ? '∞' : String(ticketAmount(tkey));

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
    socket.emit('joinStoryFloor', { floor: id, charType: gameData.selectedCharacter || 'kicker', equip: equipPayload(gameData.selectedCharacter || 'kicker') });
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
const gachaPull1Btn = document.getElementById('gacha-pull-1-btn');
const gachaPull10Btn = document.getElementById('gacha-pull-10-btn');
const gachaSoulListEl = document.getElementById('gacha-soul-list');
const gachaOddsListEl = document.getElementById('gacha-odds-list');

// Rendered straight from GACHA_TABLE so the displayed odds can never drift from
// the odds actually rolled.
function renderGachaOdds() {
    const soulKey = SHARED.GACHA_SOUL_STONE_KEY;
    gachaOddsListEl.innerHTML = Object.entries(SHARED.GACHA_TABLE).map(([key, pct]) => {
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
    const entries = Object.entries(SHARED.GACHA_TABLE);
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
        } else if (r.kind === 'char' && !gameData.unlockedCharacters.includes(r.charType)) {
            gameData.unlockedCharacters.push(r.charType);
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
        return `<div class="gacha-card">
            <div class="gacha-card-icon" style="background: ${charIconBackground(stats)}"></div>
            <span class="${gradeClass(stats.grade)}">${stats.grade}</span>
            <div class="gacha-card-name">${stats.name}</div>
        </div>`;
    }).join('');
}

function renderSoulStones() {
    const owned = Object.keys(SHARED.CHARACTERS)
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

// Spends a full set of one cookie's soul stones to unlock it.
function claimCharacterFromSoulStones(charType) {
    const need = SHARED.SOUL_STONES_PER_CHARACTER;
    const have = gameData.soulStones[charType] || 0;
    if (have < need) return;
    gameData.soulStones[charType] = have - need;
    if (!gameData.unlockedCharacters.includes(charType)) gameData.unlockedCharacters.push(charType);
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

// 일반 뽑기는 한 번에 티켓 한 장. 모자라면 아예 뽑히지 않는다.
function doGachaPull(count) {
    const have = currencyAmount('ticketNormal');
    if (have < count) {
        gachaResultEl.innerHTML = `<p class="gacha-result-empty">일반 뽑기 티켓이 모자랍니다.`
            + ` (${currencyText('ticketNormal')} / ${count}장 필요) 스토리를 깔 때마다 한 장씩 들어옵니다.</p>`;
        return;
    }
    if (!isAdmin()) grantCurrencies({ ticketNormal: -count });
    const results = [];
    for (let i = 0; i < count; i++) results.push(rollGachaOnce());
    applyGachaResults(results);
    renderGachaResults(results);
    renderSoulStones();
    updateGachaTicketLabel();
}

// 티켓이 몇 장 남았는지를 뽑기 화면과 배너에 같이 보여준다.
function updateGachaTicketLabel() {
    if (gachaTicketEl) gachaTicketEl.textContent = `🏷️ ${currencyText('ticketNormal')}장`;
    if (gachaNormalDescEl) gachaNormalDescEl.textContent = `일반 뽑기 티켓 ${currencyText('ticketNormal')}장 보유 (1회당 1장)`;
}

gachaPull1Btn.addEventListener('click', () => doGachaPull(1));
gachaPull10Btn.addEventListener('click', () => doGachaPull(10));

gachaBtn.addEventListener('click', () => {
    updateGachaTicketLabel();
    showScreen('gacha');
});
backFromGachaBtn.addEventListener('click', () => showScreen('lobby'));
gachaNormalBtn.addEventListener('click', () => {
    gachaResultEl.innerHTML = '<p class="gacha-result-empty">뽑기 버튼을 눌러보세요.</p>';
    updateGachaTicketLabel();
    renderGachaOdds();
    renderSoulStones();
    showScreen('gachaPull');
});
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
    if (!isAdmin()) {
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
            + `<span class="ev-cat-count">🎫 ${isAdmin() ? '∞' : bannerTickets(b)}장${ready ? '' : ' · 준비중'}</span></span>`;
        btn.addEventListener('click', () => { selectedBanner = b.id; renderLegendaryScreen(); });
        legendaryListEl.appendChild(btn);
    });

    const banner = SHARED.legendaryBannerFor(selectedBanner);
    const cookie = bannerCookie(banner);
    if (!cookie) {
        legendaryContentEl.innerHTML = `<div class="lg-soon-note">${bannerName(banner)}는 아직 준비중입니다.<br>`
            + `모아둔 🎫 ${isAdmin() ? '∞' : bannerTickets(banner)}장은 그대로 남아 있어요.</div>`;
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
        + `<b>${isAdmin() ? '∞' : tickets}</b>장 · 1회당 1장</div>`
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
storyModeCard.addEventListener('click', () => showScreen('storyMode'));

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
const STORY_TOTAL_FLOORS = 10; // floors 4+ are placeholders until they get real content (see STORY_FLOOR_DEFS)
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

function isFloorUnlocked(floor) {
    if (isAdmin()) return true; // 관리자 전용: every difficulty is open
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
    if (!storyIsMulti) {
        socket.emit('joinStoryFloor', { floor: selectedStoryFloor, charType, equip: equipPayload(charType), solo: true });
        return;
    }
    if (storyPhase === 'idle') {
        storyPhase = 'searching';
        towerPlayBtn.disabled = true;
        storySearchStartAt = Date.now();
        updateStorySearchLabel();
        storySearchHandle = setInterval(updateStorySearchLabel, 1000);
        socket.emit('joinStoryFloor', { floor: selectedStoryFloor, charType, equip: equipPayload(charType), solo: false });
    } else if (storyPhase === 'matched' && !storyMyReady) {
        storyMyReady = true;
        towerPlayBtn.disabled = true;
        towerPlayBtn.textContent = '플레이 (대기중)';
        socket.emit('storyPlayerReady');
    }
});

// 짝이 붙거나 떨어질 때마다 버튼과 파트너 칸을 고쳐 그린다.
socket.on('storyRoomUpdate', (data) => {
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
    storyPartnerShieldBadge.classList.toggle('hidden', !(partner.shieldHp > 0));
}

function resizeStoryCanvas() {
    storyCanvas.width = window.innerWidth;
    storyCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeStoryCanvas);
resizeStoryCanvas();

let storyFloorDef = null;
let storyPlayer = null; // {x,y,hp,maxHp,facing,charType,alive,lastAttackClientTime,...}
let storyMonsters = {}; // id -> {type,x,y,hp,maxHp,alive,state}
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
    const p = data.player;
    storyPlayer = {
        x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, facing: p.facing, charType: p.charType, alive: true, shieldHp: p.shieldHp || 0,
        equipSpeed: 0, equipCooldown: 1, // filled in below from what this cookie has on
        lastAttackClientTime: -Infinity, lastSkillClientTime: -Infinity, lastUltimateClientTime: -Infinity,
        attackEffectUntil: 0, skillEffectUntil: 0, ultimateEffectUntil: 0, healEffectUntil: 0, speedBoostUntil: 0, awakenUntil: 0, rapidStrikeUntil: 0,
        comboStage: 0, attackEffectStage: null, spearSide: 0, attackEffectSide: 0
    };
    isStoryTargetingUltimate = false;
    isStoryTargetingSkill = false;
    storyImpactEffects = [];
    storyMagmaZones = [];
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
    storyMonsters = monsters;
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
    if (monsters) storyMonsters = monsters;
    // 겹겹의 고리로 크게 터뜨린다.
    const now = performance.now();
    [70, 130, 200].forEach((r, i) => {
        storyImpactEffects.push({ x, y, radius: r, until: now + 500 + i * 220 });
    });
    storyQuakeUntil = now + 600;
    updateStoryMonstersLeft();
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
    storyMonsters = monsters;
    const at = performance.now();
    const next = {};
    for (const [id, pr] of Object.entries(projectiles || {})) next[id] = { ...pr, at };
    storyProjectiles = next;
    updateStoryMonstersLeft();
});

socket.on('storyDropThrown', ({ id, x, y, vx, vy, radius }) => {
    storyDrops[id] = { x, y, vx, vy, radius, at: performance.now() };
});

socket.on('storyDropGone', ({ id, hit, x, y }) => {
    delete storyDrops[id];
    if (hit) storyDropSplashes.push({ x, y, until: performance.now() + 260 });
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

socket.on('monsterDamaged', ({ id, hp }) => {
    if (storyMonsters[id]) storyMonsters[id].hp = hp;
    updateStoryBossBar();
});

socket.on('monsterDefeated', ({ id }) => {
    if (storyMonsters[id]) { storyMonsters[id].alive = false; storyMonsters[id].hp = 0; }
    updateStoryMonstersLeft();
});

socket.on('storyPlayerDamaged', ({ hp, alive, shieldHp }) => {
    if (!storyPlayer) return;
    storyPlayer.hp = hp;
    storyPlayer.alive = alive;
    storyPlayer.shieldHp = shieldHp || 0;
    updateStoryHpBar();
    if (awakenFightParty) {
        awakenFightParty.partyHp[awakenFightParty.active] = hp;
        renderAwakenSwapBar();
    }
});

socket.on('storyPlayerShielded', ({ shieldHp }) => {
    if (!storyPlayer) return;
    storyPlayer.shieldHp = shieldHp;
    updateStoryHpBar();
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

socket.on('storyPlayerHealed', ({ hp }) => {
    if (!storyPlayer) return;
    storyPlayer.hp = hp;
    storyPlayer.healEffectUntil = performance.now() + 250;
    updateStoryHpBar();
});

socket.on('storyUltimateImpact', ({ x, y, radius }) => {
    storyImpactEffects.push({ x, y, radius, until: performance.now() + 400 });
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

socket.on('storyMagmaZonePlaced', ({ x, y, radius, durationMs }) => {
    storyMagmaZones.push({ x, y, radius, until: performance.now() + durationMs });
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
            if (!gameData.clearedStoryFloors.includes(floor)) {
                gameData.clearedStoryFloors.push(floor);
                saveGameData(gameData);
            }
            // 깔 때마다 전액 -- 첫 클리어인지와 무관하다.
            const key = SHARED.storyRewardKey(floor);
            resultRewardsEl.innerHTML = rewardChipsHtml(payClearReward(key))
                + equipDropChipHtml(rollClearDrop(key));
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
        x: storyMouseX - storyCanvas.width / 2 + cam.x,
        y: storyMouseY - storyCanvas.height / 2 + cam.y
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
    storyPlayer.lastSkillClientTime = now;
    storyPlayer.skillEffectUntil = now
        + (SKILL_FULL_DURATION_EFFECTS.includes(stats.skillType) ? stats.skillDurationMs : 350);
    if (stats.skillType === 'speed_boost' || stats.skillType === 'charge_dash') storyPlayer.speedBoostUntil = now + stats.skillSpeedDurationMs;
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
    if (!isTargetedSkill(stats.skillType)) { tryStoryUseSkill(); return; }
    if (mobileControlsEnabled) {
        if (!storyCanUseSkill(performance.now())) return;
        storyPlayer.lastSkillClientTime = performance.now();
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
    storyPlayer.lastSkillClientTime = performance.now();
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
    const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
    const rapid = stats.ultimateType === 'awakening_rapid' && now < storyPlayer.rapidStrikeUntil;
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
    }
    syncMobileCooldowns(skillRemain, ultRemain, true);
}

function storyFrame() {
    const now = performance.now();
    if (storyPlayer && storyPlayer.alive) {
        const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
        const speed = moveSpeedFor(stats, now, storyPlayer.speedBoostUntil, storyPlayer.awakenUntil, storyPlayer.butterflyOn, storyPlayer.equipSpeed);
        let dx = 0, dy = 0;
        if (keys['w'] || keys['W']) dy -= speed;
        if (keys['s'] || keys['S']) dy += speed;
        if (keys['a'] || keys['A']) dx -= speed;
        if (keys['d'] || keys['D']) dx += speed;
        if (dx !== 0 || dy !== 0) {
            // Mirrors the server's storyPlayerMove clamping, along the bridge's
            // own axis so an upward floor (axis: 'y') behaves like a leftward one.
            const kept = SHARED.clampToLane(storyFloorDef, storyPlayer.x + dx, storyPlayer.y + dy);
            let along = SHARED.alongOf(storyFloorDef, kept.x, kept.y);
            const across = SHARED.acrossOf(storyFloorDef, kept.x, kept.y);
            if (storyFloorDef.gates) {
                const wasAlong = SHARED.alongOf(storyFloorDef, storyPlayer.x, storyPlayer.y);
                for (const gate of storyFloorDef.gates) {
                    if (!storyAnyMonsterAliveInRoom(gate.room)) continue;
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
            if (storyJoystickFacing !== null) storyPlayer.facing = storyJoystickFacing;
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
    storyRender(now);
    storyLoopHandle = requestAnimationFrame(storyFrame);
}

function storyAnyMonsterAliveInRoom(roomIndex) {
    return Object.values(storyMonsters).some(m => m.alive && m.room === roomIndex);
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
    storyCtx.clearRect(0, 0, storyCanvas.width, storyCanvas.height);
    storyCtx.save();
    const cam = storyCamera();
    const q = quakeOffset(now, storyQuakeUntil);
    storyCtx.translate(storyCanvas.width / 2 - cam.x + q.x, storyCanvas.height / 2 - cam.y + q.y);

    if (storyFloorDef) {
        const halfW = storyFloorDef.laneHalfWidth;
        const winding = !!storyFloorDef.path;
        const vertical = SHARED.floorAxis(storyFloorDef) === 'y';
        if (winding) {
            // 꺾은선 다리: 길을 그대로 굵게 그으면 모퉁이까지 알아서 이어진다.
            // 모서리를 둥글게 이어야 꺾이는 자리에 구멍이 안 생긴다.
            storyCtx.save();
            storyCtx.lineJoin = 'round';
            storyCtx.lineCap = 'round';
            storyCtx.beginPath();
            storyFloorDef.path.forEach(([px, py], i) => {
                if (i === 0) storyCtx.moveTo(px, py);
                else storyCtx.lineTo(px, py);
            });
            storyCtx.strokeStyle = 'rgba(255,255,255,0.15)';
            storyCtx.lineWidth = halfW * 2 + 4;
            storyCtx.stroke();
            storyCtx.strokeStyle = '#4a3c2f';
            storyCtx.lineWidth = halfW * 2;
            storyCtx.stroke();
            // 가운데 점선: 어느 쪽이 길인지 한눈에 보이게.
            storyCtx.setLineDash([26, 26]);
            storyCtx.strokeStyle = 'rgba(255,255,255,0.10)';
            storyCtx.lineWidth = 3;
            storyCtx.stroke();
            storyCtx.restore();
        } else {
            // The bridge runs along the level axis; on a vertical floor the same
            // rectangle is simply turned on its side.
            const deckAlong = -storyFloorDef.levelLength - 200;
            const deckLen = storyFloorDef.levelLength + 400;
            const deck = vertical
                ? [-halfW, deckAlong, halfW * 2, deckLen]
                : [deckAlong, -halfW, deckLen, halfW * 2];
            storyCtx.fillStyle = '#4a3c2f';
            storyCtx.fillRect(...deck);
            storyCtx.strokeStyle = 'rgba(255,255,255,0.15)';
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
                if (!storyAnyMonsterAliveInRoom(gate.room)) return;
                [gate.entrance, gate.exit].forEach(at => {
                    if (winding) {
                        // 길이 휘어 있으니 그 자리의 길 방향을 구해서 가로로 세운다.
                        const a = SHARED.pointOnPath(storyFloorDef, at, 0);
                        const b = SHARED.pointOnPath(storyFloorDef, at - 1, 0);
                        storyCtx.save();
                        storyCtx.translate(a.x, a.y);
                        storyCtx.rotate(Math.atan2(b.y - a.y, b.x - a.x));
                        storyCtx.fillStyle = `rgba(52, 152, 219, ${shieldAlpha})`;
                        storyCtx.fillRect(-6, -halfW, 12, halfW * 2);
                        storyCtx.strokeStyle = 'rgba(133, 202, 240, 0.9)';
                        storyCtx.lineWidth = 2;
                        storyCtx.strokeRect(-6, -halfW, 12, halfW * 2);
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
    }

    storyImpactEffects = storyImpactEffects.filter(fx => now < fx.until);
    storyImpactEffects.forEach(fx => {
        const t = 1 - Math.max(0, (fx.until - now) / 400);
        // Lightning uses a yellow flash plus a bolt dropping in from above.
        const rgb = fx.bolt ? '241, 196, 15' : '142, 68, 173';
        storyCtx.beginPath();
        storyCtx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
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
        storyCtx.beginPath();
        storyCtx.arc(z.x, z.y, z.radius + pulse, 0, Math.PI * 2);
        storyCtx.fillStyle = 'rgba(230, 81, 0, 0.25)';
        storyCtx.fill();
        storyCtx.strokeStyle = 'rgba(255, 152, 0, 0.85)';
        storyCtx.lineWidth = 3;
        storyCtx.stroke();
    });

    Object.values(storyMonsters).forEach(m => {
        if (!m.alive) return;
        const def = SHARED.MONSTERS[m.type];
        // 케이크 같은 보스는 잡몹보다 덩치가 크다. 판정도 같은 값을 쓴다.
        const mRad = SHARED.monsterRadiusOf(m.type);
        storyCtx.save();
        storyCtx.translate(m.x, m.y);
        if (m.state === 'telegraph') {
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
            storyCtx.beginPath();
            storyCtx.arc(0, 0, mRad, 0, Math.PI * 2);
            storyCtx.fillStyle = def.color;
            storyCtx.fill();
            storyCtx.strokeStyle = '#2c3e50';
            storyCtx.lineWidth = 2;
            storyCtx.stroke();
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
        storyCtx.globalAlpha = pl.alive ? 1 : 0.4;
        drawCookieBody(storyCtx, R, pStats, pl.alive);
        storyCtx.beginPath();
        storyCtx.arc(0, 0, R, 0, Math.PI * 2);
        storyCtx.lineWidth = 2;
        storyCtx.strokeStyle = '#3498db'; // 파란 테두리 = 파트너
        storyCtx.stroke();
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

        drawCookieBody(storyCtx, R, stats, storyPlayer.alive);
        storyCtx.beginPath();
        storyCtx.arc(0, 0, R, 0, Math.PI * 2);
        storyCtx.strokeStyle = '#f1c40f';
        storyCtx.lineWidth = 3;
        storyCtx.stroke();
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
        drawUltimatePreview(storyCtx, world.x, world.y, stats.ultimateRadius || 90);
    }

    // Live preview while the ultimate stick is being pushed on touch.
    if (storyUltimateAim && storyPlayer) {
        const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
        const pt = ultimateAimPoint(storyPlayer.x, storyPlayer.y, storyPlayer.facing, stats, storyUltimateAim);
        drawUltimatePreview(storyCtx, pt.targetX, pt.targetY, stats.ultimateRadius || 90, storyPlayer.x, storyPlayer.y);
    }

    storyCtx.restore();
}

// ---- Boss select ----
// 관리자 전용 opens progress-locked bosses, but NOT ones with no content yet:
// the server rejects a bossId it has no BOSS_DEFS entry for, so unlocking those
// would just be a dead end at the waiting screen.
function isBossUnlocked(b) {
    if (!SHARED.BOSS_DEFS[b.id]) return false;
    return !b.locked || isAdmin();
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
            socket.emit('joinRaid', { bossId: selectedBossId, charType, equip: equipPayload(charType) });
        } else {
            detailMultiBtn.disabled = true;
            detailSoloBtn.disabled = true;
            socket.emit('joinRaid', { bossId: selectedBossId, charType, solo: true, equip: equipPayload(charType) });
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
let bossMark = null; // { element, charges } | null -- element_mark ultimate (greenapple cookie)
let raidQuakeUntil = 0; // camera shakes until this timestamp (earthquake ultimate)
let raidSummons = {}; // 번개지옥맛 궁극기가 부른 부하들
let raidGreatSlashes = []; // 크게베기의 벤 자리
let raidDrops = {}; // id -> thrown 물방울 in flight
let raidDropSplashes = []; // [{x, y, until}]

socket.on('dropThrown', ({ id, x, y, vx, vy, radius }) => {
    raidDrops[id] = { x, y, vx, vy, radius, at: performance.now() };
});

socket.on('dropGone', ({ id, hit, x, y }) => {
    delete raidDrops[id];
    if (hit) raidDropSplashes.push({ x, y, until: performance.now() + 260 });
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

socket.on('magmaZonePlaced', ({ x, y, radius, durationMs }) => {
    magmaZones.push({ x, y, radius, until: performance.now() + durationMs });
});

socket.on('earthquake', () => {
    raidQuakeUntil = performance.now() + QUAKE_DURATION_MS;
});

socket.on('reviveBlast', ({ id }) => {
    const p = players[id];
    if (!p) return;
    impactEffects.push({ x: p.x, y: p.y, radius: 220, until: performance.now() + 500, bolt: true });
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
        myShieldBadge.textContent = `🛡${me.shieldHp || 0}`;
        myShieldBadge.classList.toggle('hidden', !me.shieldHp);
    }
    const partner = Object.values(players).find(p => p.id !== socket.id);
    if (partner) {
        partnerHpBar.style.width = `${Math.max(0, (partner.hp / partner.maxHp) * 100)}%`;
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
    }
    syncMobileCooldowns(skillRemain, ultRemain, false);
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
    if (!isTargetedSkill(me.stats.skillType)) { tryUseSkill(); return; }
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
        || type === 'magma_pour' || type === 'mark_flood';
}

// 때파기 / 물방울 터트리기 are the first SKILLS that are placed on a spot
// rather than fired from the body, so they arm the same way an ultimate does:
// trigger once to aim, left-click to commit, trigger again to cancel.
function isTargetedSkill(type) {
    return type === 'burrow_mark' || type === 'mark_burst' || type === 'blink_heal';
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
            // The attack button auto-aims separately (see fireAutoAimedAttack).
            if (joystickFacing !== null) me.facing = joystickFacing;
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
        const rgb = fx.bolt ? '241, 196, 15' : '142, 68, 173';
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
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
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.radius + pulse, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(230, 81, 0, 0.25)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 152, 0, 0.85)';
        ctx.lineWidth = 3;
        ctx.stroke();
    });

    if (isTargetingUltimate && mouseX !== null) {
        const me = players[socket.id];
        const world = screenToWorld(mouseX, mouseY);
        drawUltimatePreview(ctx, world.x, world.y, me ? me.stats.ultimateRadius : 90);
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
            drawUltimatePreview(ctx, pt.targetX, pt.targetY, me.stats.ultimateRadius || 90, me.x, me.y);
        }
    }

    ctx.restore();
}
