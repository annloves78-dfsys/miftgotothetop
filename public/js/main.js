const socket = io();

// ---- Screens ----
const screens = {
    lobby: document.getElementById('lobby-screen'),
    shop: document.getElementById('shop-screen'),
    gacha: document.getElementById('gacha-screen'),
    gachaPull: document.getElementById('gacha-pull-screen'),
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
}

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
const charDetailPower = document.getElementById('char-detail-power');
const charDetailGrade = document.getElementById('char-detail-grade');
const charDetailElement = document.getElementById('char-detail-element');
const charDetailRole = document.getElementById('char-detail-role');
const charDetailAtk = document.getElementById('char-detail-atk');
const charDetailHp = document.getElementById('char-detail-hp');
const charDetailAwakenSlot = document.getElementById('char-detail-awaken-slot');

// Cookie Run Kingdom-style rarity ladder. From 에이션트 up, cookies get an
// extra "각성" (awakening) equipment slot above their weapon slot.
const GRADE_ORDER = ['일반', '희귀', '에픽', '레전더리', '에이션트', '비스트', '게스트'];
function hasAwakenSlot(grade) {
    const idx = GRADE_ORDER.indexOf(grade);
    return idx >= GRADE_ORDER.indexOf('에이션트');
}
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
    material: '일반 장비강화 재료',
    materialRare: '고급 장비강화 재료',
    potion: '강화포션',
    potionRare: '고급 강화포션',
    seasonTicket: '시즌 뽑기 티켓'
};

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
        let text = `전방 ${stats.attackRange}px 범위를 공격해 ${stats.attackDamage}의 피해를 줍니다. (재사용 대기시간 ${sec(stats.attackCooldown)}초)`;
        if (stats.attackHealOnUse) {
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
            case 'undying_soul':
                return `죽지 않는 영혼을 불러내 체력을 최대 체력의 ${Math.round(stats.ultimateHealRatio * 100)}%만큼 회복합니다. ${sec(stats.ultimateDurationMs)}초 동안 이동 속도가 ${stats.ultimateSpeedBonus} 빨라지고 기본 공격 피해가 ${stats.ultimateAttackDamage}가 됩니다.${cd}`;
            case 'lightning_strike':
                return `원하는 지점에 번개를 내려 반경 ${stats.ultimateRadius}px 내의 적에게 ${stats.ultimateDamage}의 피해를 줍니다. 맞은 적은 ${sec(stats.ultimateStunMs)}초 동안 기절하고, ${sec(stats.ultimateDebuffDurationMs)}초 동안 주는 피해가 ${stats.ultimateDamageDebuffMultiplier}배로 줄어듭니다.${cd}`;
            default:
                return '궁극기 정보가 없습니다.';
        }
    }
    return '';
}

const ELEMENT_ICONS = { '바람': '🌪️', '불': '🔥', '어둠': '🌑' };

// Split-color icon background so similarly-colored cookies stay tellable
// apart at a glance -- a hard 50/50 split, not a blend.
function charIconBackground(stats) {
    if (stats.colorLeft && stats.colorRight) {
        return `linear-gradient(90deg, ${stats.colorLeft} 50%, ${stats.colorRight} 50%)`;
    }
    return stats.color;
}

function selectCharDetailAbility(kind) {
    const stats = SHARED.CHARACTERS[viewingCharacterId];
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
    earthquake: '🌎'
};
const detailCharIcon = document.getElementById('detail-char-icon');
const detailCharName = document.getElementById('detail-char-name');
const detailChangeCharBtn = document.getElementById('detail-change-char-btn');
const detailBossName = document.getElementById('detail-boss-name');
const detailBossIcon = document.getElementById('detail-boss-icon');
const detailBossPower = document.getElementById('detail-boss-power');
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
        const ga = GRADE_ORDER.indexOf(a.grade);
        const gb = GRADE_ORDER.indexOf(b.grade);
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

function openCharacterDetail(id) {
    viewingCharacterId = id;
    const stats = SHARED.CHARACTERS[id];
    charDetailIcon.style.background = charIconBackground(stats);
    charDetailName.textContent = stats.name;
    charDetailPower.textContent = stats.combatPower;
    charDetailGrade.textContent = stats.grade || '-';
    charDetailGrade.className = gradeClass(stats.grade);
    charDetailAwakenSlot.classList.toggle('hidden', !hasAwakenSlot(stats.grade));
    charDetailElement.textContent = stats.element || '-';
    charDetailRole.textContent = stats.role || '-';
    charDetailAtk.textContent = attackDamageText(stats);
    charDetailHp.textContent = stats.health != null ? stats.health : '-';
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

// ---- Event: 물과 불의 싸움 ----
// Laid out like the shop -- categories down the left, the selected one on the
// right. 안내 / 물 미션 / 불 미션.
const eventBtn = document.getElementById('event-btn');
const eventBadge = document.getElementById('event-badge');
const backFromEventBtn = document.getElementById('back-from-event-btn');
const eventTitleEl = document.getElementById('event-title');
const eventTicketAmountEl = document.getElementById('event-ticket-amount');
const eventCategoriesEl = document.getElementById('event-categories');
const eventContentEl = document.getElementById('event-content');

const EV = SHARED.EVENT;
let eventCategory = 'water';

function eventMissions(side) {
    return (EV.missions[side] && EV.missions[side].missions) || [];
}
function allEventMissions() {
    return Object.keys(EV.missions).flatMap(eventMissions);
}
// A mission either counts something up, or asks a question about the save.
const EVENT_CONDITIONS = {
    // "에픽 캐릭터 가지고 있기"
    ownEpic: () => Object.keys(SHARED.CHARACTERS)
        .some(id => SHARED.CHARACTERS[id].grade === '에픽' && isCharacterUnlocked(id))
};

function eventProgressOf(mission) {
    if (mission.condition) {
        const met = EVENT_CONDITIONS[mission.condition] && EVENT_CONDITIONS[mission.condition]();
        return met ? mission.goal : 0;
    }
    return Math.min(mission.goal, gameData.eventProgress[mission.track] || 0);
}
function eventMissionDone(mission) {
    return eventProgressOf(mission) >= mission.goal;
}
function eventMissionClaimed(id) {
    return gameData.eventClaimed.includes(id);
}
// The both-sides bonus is a mission too, just one you can't see until it's live.
function bothSidesCleared() {
    return allEventMissions().every(eventMissionDone);
}
function claimableCount() {
    let n = allEventMissions().filter(m => eventMissionDone(m) && !eventMissionClaimed(m.id)).length;
    if (bothSidesCleared() && !eventMissionClaimed('both')) n += 1;
    return n;
}

function ticketAmount() {
    return isAdmin() ? Infinity : (gameData.currencies[SHARED.EVENT_TICKET_KEY] || 0);
}

function updateEventBadge() {
    const n = claimableCount();
    eventBadge.textContent = String(n);
    eventBadge.classList.toggle('hidden', n === 0);
}

function grantTickets(n) {
    gameData.currencies[SHARED.EVENT_TICKET_KEY] =
        (gameData.currencies[SHARED.EVENT_TICKET_KEY] || 0) + n;
    saveGameData(gameData);
}

function claimEventMission(id) {
    if (eventMissionClaimed(id)) return;
    if (id === 'both') {
        if (!bothSidesCleared()) return;
        gameData.eventClaimed.push('both');
        grantTickets(EV.bothClearedReward);
    } else {
        const mission = allEventMissions().find(m => m.id === id);
        if (!mission || !eventMissionDone(mission)) return;
        gameData.eventClaimed.push(id);
        grantTickets(mission.reward);
    }
    saveGameData(gameData);
    renderEventScreen();
    updateEventBadge();
}

function claimCellHtml(id, reward, ready, claimed) {
    if (claimed) return '<span class="ev-claimed">획득 완료</span>';
    return `<button class="ev-claim-btn" data-mission="${id}"${ready ? '' : ' disabled'}>획득</button>`;
}

function missionRowHtml(m, index, sideIcon) {
    const have = eventProgressOf(m);
    const done = eventMissionDone(m);
    const claimed = eventMissionClaimed(m.id);
    const pct = (have / m.goal) * 100;
    return `<div class="ev-mission${claimed ? ' claimed' : ''}">`
        + `<div class="ev-mission-badge"><span class="ev-badge-icon">${sideIcon}</span>`
        + `<span class="ev-badge-step">${index + 1}</span></div>`
        + `<div class="ev-mission-main">`
        + `<div class="ev-mission-name">${m.name}</div>`
        + `<div class="ev-mission-text">${m.text}</div>`
        + `<div class="ev-mission-bar"><div class="ev-mission-fill" style="width:${pct}%"></div>`
        + `<span class="ev-mission-count">${have}/${m.goal}</span></div>`
        + `</div>`
        + `<div class="ev-reward-chip"><span class="ev-reward-icon">🎫</span>`
        + `<span class="ev-reward-amount">${m.reward}</span></div>`
        + claimCellHtml(m.id, m.reward, done, claimed)
        + `</div>`;
}

// The bar across the top: overall completion and the 전체 클리어 reward.
function eventHeaderHtml() {
    const all = allEventMissions();
    const done = all.filter(eventMissionDone).length;
    const claimed = eventMissionClaimed('both');
    return `<div class="ev-total">`
        + `<div class="ev-total-badge">🏆</div>`
        + `<div class="ev-total-main">`
        + `<div class="ev-total-title">${EV.name} 전체 클리어</div>`
        + `<div class="ev-mission-bar big"><div class="ev-mission-fill" style="width:${(done / all.length) * 100}%"></div>`
        + `<span class="ev-mission-count">${done}/${all.length}</span></div>`
        + `</div>`
        + `<div class="ev-reward-chip"><span class="ev-reward-icon">🎫</span>`
        + `<span class="ev-reward-amount">${EV.bothClearedReward}</span></div>`
        + claimCellHtml('both', EV.bothClearedReward, bothSidesCleared(), claimed)
        + `</div>`;
}

function renderEventScreen() {
    eventTitleEl.textContent = `${EV.icon} ${EV.name}`;
    eventTicketAmountEl.textContent = isAdmin() ? '∞' : String(ticketAmount());

    eventCategoriesEl.innerHTML = '';
    Object.entries(EV.missions).forEach(([key, side]) => {
        const cleared = side.missions.filter(eventMissionDone).length;
        const btn = document.createElement('button');
        btn.className = 'shop-cat-btn ev-cat' + (key === eventCategory ? ' selected' : '');
        btn.dataset.eventCat = key;
        btn.innerHTML = `<span class="ev-cat-icon">${side.icon}</span>`
            + `<span class="ev-cat-body"><span class="ev-cat-label">${side.label}</span>`
            + `<span class="ev-cat-count">${cleared} / ${side.missions.length}</span></span>`;
        btn.addEventListener('click', () => { eventCategory = key; renderEventScreen(); });
        eventCategoriesEl.appendChild(btn);
    });

    const side = EV.missions[eventCategory] || EV.missions.water;
    eventContentEl.innerHTML = eventHeaderHtml()
        + side.missions.map((m, i) => missionRowHtml(m, i, side.icon)).join('');
}

eventContentEl.addEventListener('click', (e) => {
    const btn = e.target.closest ? e.target.closest('.ev-claim-btn') : null;
    if (!btn || btn.disabled) return;
    claimEventMission(btn.dataset.mission);
});

// Called wherever the game finishes something a mission counts. Bumping a track
// the event doesn't use is harmless, so callers don't have to know the missions.
function recordEventProgress(track, amount = 1) {
    gameData.eventProgress[track] = (gameData.eventProgress[track] || 0) + amount;
    saveGameData(gameData);
    updateEventBadge();
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
            gameData.soulStones[r.charType] = (gameData.soulStones[r.charType] || 0) + 1;
            changed = true;
        } else if (r.kind === 'char' && !gameData.unlockedCharacters.includes(r.charType)) {
            gameData.unlockedCharacters.push(r.charType);
            changed = true;
        }
    }
    if (changed) saveGameData(gameData);
}

function renderGachaResults(results) {
    gachaResultEl.innerHTML = results.map(r => {
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
                <div class="gacha-card-name">${stats.name}의 영혼석</div>
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

function doGachaPull(count) {
    const results = [];
    for (let i = 0; i < count; i++) results.push(rollGachaOnce());
    recordEventProgress('gachaPull', count); // 뽑기 N번 하기
    applyGachaResults(results);
    renderGachaResults(results);
    renderSoulStones();
}

gachaPull1Btn.addEventListener('click', () => doGachaPull(1));
gachaPull10Btn.addEventListener('click', () => doGachaPull(10));

gachaBtn.addEventListener('click', () => showScreen('gacha'));
backFromGachaBtn.addEventListener('click', () => showScreen('lobby'));
gachaNormalBtn.addEventListener('click', () => {
    gachaResultEl.innerHTML = '<p class="gacha-result-empty">뽑기 버튼을 눌러보세요.</p>';
    renderGachaOdds();
    renderSoulStones();
    showScreen('gachaPull');
});
gachaPullBackBtn.addEventListener('click', () => showScreen('gacha'));

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
const towerFloorListEl = document.getElementById('tower-floor-list');
const towerFloorPower = document.getElementById('tower-floor-power');
const towerCharPreview = document.getElementById('tower-char-preview');
const towerCharIcon = document.getElementById('tower-char-icon');
const towerCharName = document.getElementById('tower-char-name');
const towerPlayBtn = document.getElementById('tower-play-btn');
const backFromTowerBtn = document.getElementById('back-from-tower-btn');

towerCharPreview.addEventListener('click', () => openCharacterSelect('storyTower'));

backFromStoryModeBtn.addEventListener('click', () => showScreen('modeSelect'));
// story-multi-btn stays permanently disabled -- multiplayer story mode isn't built yet.
storySoloBtn.addEventListener('click', () => {
    selectedStoryFloor = 1;
    renderTower();
    showScreen('storyTower');
});

// ---- Story tower: floor select ----
const STORY_TOTAL_FLOORS = 10; // floors 4+ are placeholders until they get real content (see STORY_FLOOR_DEFS)
let selectedStoryFloor = 1;

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
        card.className = 'floor-card' + (unlocked ? '' : ' locked') + (f === selectedStoryFloor ? ' selected' : '');
        card.textContent = unlocked ? `${f}층` : `🔒 ${f}층`;
        if (unlocked) {
            card.addEventListener('click', () => {
                selectedStoryFloor = f;
                renderTower();
            });
        }
        towerFloorListEl.appendChild(card);
    });

    const floorDef = SHARED.STORY_FLOOR_DEFS[selectedStoryFloor];
    towerFloorPower.textContent = floorDef ? floorDef.recommendedPower : '준비중';
    const stats = SHARED.CHARACTERS[gameData.selectedCharacter] || SHARED.CHARACTERS.kicker;
    towerCharIcon.style.background = charIconBackground(stats);
    towerCharName.textContent = stats.name;
    towerPlayBtn.disabled = !isFloorUnlocked(selectedStoryFloor) || !floorDef;
}

backFromTowerBtn.addEventListener('click', () => showScreen('storyMode'));

towerPlayBtn.addEventListener('click', () => {
    if (towerPlayBtn.disabled) return;
    if (!SHARED.STORY_FLOOR_DEFS[selectedStoryFloor]) return; // no content for this floor yet
    recordEventProgress(`storyEnter${selectedStoryFloor}`); // "스토리 N층 가기"
    socket.emit('joinStoryFloor', { floor: selectedStoryFloor, charType: gameData.selectedCharacter || 'kicker' });
});

// ---- Story fight: floor bridge combat ----
const storyCanvas = document.getElementById('storyCanvas');
const storyCtx = storyCanvas.getContext('2d');
const storyMyHpBar = document.getElementById('story-my-hp-bar');
const storyMyShieldBadge = document.getElementById('story-my-shield-badge');
const storyMySkillCdEl = document.getElementById('story-my-skill-cd');
const storyMyUltimateCdEl = document.getElementById('story-my-ultimate-cd');
const storyMonstersLeftEl = document.getElementById('story-monsters-left');
const storyLeaveBtn = document.getElementById('story-leave-btn');

function resizeStoryCanvas() {
    storyCanvas.width = window.innerWidth;
    storyCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeStoryCanvas);
resizeStoryCanvas();

let storyFloorDef = null;
let storyPlayer = null; // {x,y,hp,maxHp,facing,charType,alive,lastAttackClientTime,...}
let storyMonsters = {}; // id -> {type,x,y,hp,maxHp,alive,state}
let storyMouseX = null;
let storyMouseY = null;
let storyLoopHandle = null;
let storyLastMoveEmit = 0;
let isStoryTargetingUltimate = false;
let storyImpactEffects = []; // [{x, y, radius, until}]
// Arrows in flight (ranged monsters). Held as id -> {x,y,vx,vy,angle,at} where
// `at` is when that position was received, so the render can dead-reckon
// between the server's 50ms ticks instead of visibly stepping.
let storyProjectiles = {};
let storyProjectileSparks = []; // [{x, y, until}] brief flash where an arrow landed
let storyMagmaZones = []; // [{x, y, radius, until}] long-lived damage zones (volcano cookie ultimate)
let storyQuakeUntil = 0; // camera shakes until this timestamp (earthquake ultimate)

socket.on('storyFloorStarted', (data) => {
    storyFloorDef = data.floorDef;
    storyMonsters = data.monsters;
    const p = data.player;
    storyPlayer = {
        x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, facing: p.facing, charType: p.charType, alive: true, shieldHp: p.shieldHp || 0,
        lastAttackClientTime: -Infinity, lastSkillClientTime: -Infinity, lastUltimateClientTime: -Infinity,
        attackEffectUntil: 0, skillEffectUntil: 0, ultimateEffectUntil: 0, healEffectUntil: 0, speedBoostUntil: 0, awakenUntil: 0, rapidStrikeUntil: 0,
        comboStage: 0, attackEffectStage: null, spearSide: 0, attackEffectSide: 0
    };
    isStoryTargetingUltimate = false;
    storyImpactEffects = [];
    storyMagmaZones = [];
    storyProjectiles = {};
    storyProjectileSparks = [];
    storyQuakeUntil = 0;
    updateStoryHpBar();
    updateStoryMonstersLeft();
    syncMobileButtonIcons(p.charType, true);
    showScreen('storyFight');
    startStoryLoop();
});

socket.on('storyTick', ({ monsters, projectiles }) => {
    storyMonsters = monsters;
    const at = performance.now();
    const next = {};
    for (const [id, pr] of Object.entries(projectiles || {})) next[id] = { ...pr, at };
    storyProjectiles = next;
    updateStoryMonstersLeft();
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
    storyPlayer.healEffectUntil = performance.now() + 900; // brighter, longer flash
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
    selectedStoryFloor = floor;
    if (result === 'win') {
        resultTitle.textContent = '층 클리어!';
        resultTitle.style.color = '#2ecc71';
        resultDesc.textContent = `${floor}층을 클리어했습니다.`;
        const clearedBefore = gameData.clearedStoryFloors.includes(floor);
        if (!clearedBefore) {
            gameData.clearedStoryFloors.push(floor);
            saveGameData(gameData);
        }
        // 물 미션: the per-floor ones only count the first clear of that floor,
        // but "아무 층이나 5회" counts every run.
        if (!clearedBefore) recordEventProgress(`story${floor}`);
        recordEventProgress('storyAny');
    } else {
        resultTitle.textContent = '패배...';
        resultTitle.style.color = '#e74c3c';
        resultDesc.textContent = '몬스터에게 쓰러졌습니다.';
    }
    resultReturnScreen = 'storyTower';
    resultBackBtn.textContent = '올라가기';
    showScreen('result');
});

storyLeaveBtn.addEventListener('click', () => {
    stopStoryLoop();
    socket.emit('leaveRaid');
    renderTower();
    showScreen('storyTower');
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
        // With 자동조준 on, a click doesn't aim -- it snaps onto the nearest
        // enemy and swings there (the same path the mobile button uses).
        else if (autoAimActive()) fireAutoAimedAttack(true);
        else tryStoryAttack();
    } else if (e.button === 2) {
        tryStoryUseSkill();
    }
});

// The camera scrolls along the bridge's own axis: sideways on a leftward floor,
// vertically on an upward one. Both storyRender and the mouse->world mapping
// read it from here so they can't disagree.
function storyCamera() {
    if (!storyPlayer) return { x: 0, y: 0 };
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
    return !!stats.skillType && now - storyPlayer.lastSkillClientTime >= stats.skillCooldown;
}

function storyCanUseUltimate(now) {
    if (!storyPlayer || !storyPlayer.alive) return false;
    const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
    return !!stats.ultimateType && now - storyPlayer.lastUltimateClientTime >= stats.ultimateCooldownMs;
}

function tryStoryUseSkill() {
    const now = performance.now();
    if (!storyCanUseSkill(now)) return;
    const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
    storyPlayer.lastSkillClientTime = now;
    storyPlayer.skillEffectUntil = now
        + (SKILL_FULL_DURATION_EFFECTS.includes(stats.skillType) ? stats.skillDurationMs : 350);
    if (stats.skillType === 'speed_boost') storyPlayer.speedBoostUntil = now + stats.skillSpeedDurationMs;
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
}

function updateStoryCooldownDisplay(now) {
    if (!storyPlayer) return;
    const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
    let skillRemain = 0, ultRemain = 0;
    if (stats.skillType) {
        const remain = Math.max(0, stats.skillCooldown - (now - storyPlayer.lastSkillClientTime)) / 1000;
        storyMySkillCdEl.textContent = remain > 0.05 ? `${remain.toFixed(1)}s` : '사용가능';
        skillRemain = remain;
    }
    if (stats.ultimateType) {
        const remain = Math.max(0, stats.ultimateCooldownMs - (now - storyPlayer.lastUltimateClientTime)) / 1000;
        storyMyUltimateCdEl.textContent = remain > 0.05 ? `${remain.toFixed(1)}s` : '사용가능';
        ultRemain = remain;
    }
    syncMobileCooldowns(skillRemain, ultRemain, true);
}

function storyFrame() {
    const now = performance.now();
    if (storyPlayer && storyPlayer.alive) {
        const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
        const speed = moveSpeedFor(stats, now, storyPlayer.speedBoostUntil, storyPlayer.awakenUntil);
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
        const vertical = SHARED.floorAxis(storyFloorDef) === 'y';
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
        storyCtx.save();
        storyCtx.translate(m.x, m.y);
        if (m.state === 'telegraph') {
            storyCtx.beginPath();
            storyCtx.arc(0, 0, SHARED.MONSTER_RADIUS + 10, 0, Math.PI * 2);
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
            const r = SHARED.MONSTER_RADIUS;
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
            storyCtx.arc(0, 0, SHARED.MONSTER_RADIUS, 0, Math.PI * 2);
            storyCtx.fillStyle = def.color;
            storyCtx.fill();
            storyCtx.strokeStyle = '#2c3e50';
            storyCtx.lineWidth = 2;
            storyCtx.stroke();
        }
        storyCtx.restore();

        const barW = 32, barH = 4;
        storyCtx.fillStyle = '#c0392b';
        storyCtx.fillRect(m.x - barW / 2, m.y - SHARED.MONSTER_RADIUS - 8 - barH, barW, barH);
        storyCtx.fillStyle = '#2ecc71';
        storyCtx.fillRect(m.x - barW / 2, m.y - SHARED.MONSTER_RADIUS - 8 - barH, barW * (m.hp / m.maxHp), barH);

        if (m.elementMark) {
            storyCtx.save();
            storyCtx.font = 'bold 14px sans-serif';
            storyCtx.textAlign = 'center';
            storyCtx.fillStyle = '#fff';
            storyCtx.shadowColor = 'rgba(0,0,0,0.8)';
            storyCtx.shadowBlur = 3;
            storyCtx.fillText(`${ELEMENT_ICONS[m.elementMark.element] || '✨'} x${m.elementMark.charges}`, m.x, m.y - SHARED.MONSTER_RADIUS - 14 - barH);
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

    storyProjectileSparks = storyProjectileSparks.filter(s => now < s.until);
    storyProjectileSparks.forEach(s => {
        const life = (s.until - now) / 220;
        storyCtx.beginPath();
        storyCtx.arc(s.x, s.y, 6 + (1 - life) * 10, 0, Math.PI * 2);
        storyCtx.strokeStyle = `rgba(231, 76, 60, ${life})`;
        storyCtx.lineWidth = 3;
        storyCtx.stroke();
    });

    if (storyPlayer) {
        const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
        const R = SHARED.PLAYER_RADIUS;
        storyCtx.save();
        storyCtx.translate(storyPlayer.x, storyPlayer.y);

        if (now < (storyPlayer.attackEffectUntil || 0)) {
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
    detailBossPower.textContent = '미정';
    detailBossHp.textContent = `${bossDef.maxHpPerPlayer} (1인 기준)`;
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
            socket.emit('joinRaid', { bossId: selectedBossId, charType });
        } else {
            detailMultiBtn.disabled = true;
            detailSoloBtn.disabled = true;
            socket.emit('joinRaid', { bossId: selectedBossId, charType, solo: true });
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
        if (!myReady) {
            detailMultiBtn.textContent = '플레이';
            detailMultiBtn.disabled = false;
        }
    } else if (raidPhase !== 'idle') {
        // partner left before the fight started -- go back to searching alone
        raidPhase = 'searching';
        myReady = false;
        detailPartnerPreview.classList.add('hidden');
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
let impactEffects = []; // [{x, y, radius, until}] fading impact markers, in arena space
let magmaZones = []; // [{x, y, radius, until}] long-lived damage zones (volcano cookie ultimate)
let bossMark = null; // { element, charges } | null -- element_mark ultimate (greenapple cookie)
let raidQuakeUntil = 0; // camera shakes until this timestamp (earthquake ultimate)

socket.on('raidStarted', (data) => {
    boss = new Boss(currentRoomState.bossId);
    boss.setHp(data.bossHp, data.bossMaxHp);
    players = {};
    Object.entries(data.players).forEach(([id, p]) => {
        const pl = new Player(id, p.charType, p.x, p.y, id === socket.id);
        pl.hp = p.hp; pl.maxHp = p.maxHp; pl.facing = p.facing; pl.alive = p.alive; pl.shieldHp = p.shieldHp || 0;
        players[id] = pl;
    });
    partnerHpContainer.classList.toggle('hidden', Object.keys(players).length < 2);
    raidStartAt = performance.now();
    isTargetingUltimate = false;
    impactEffects = [];
    magmaZones = [];
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

socket.on('bossMarked', ({ element, charges }) => {
    bossMark = element ? { element, charges } : null;
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
    p.healEffectUntil = performance.now() + 900; // brighter, longer flash
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
            recordEventProgress(currentRoomState.bossId); // 불 미션: boss1 / boss2
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
    if (resultReturnScreen === 'storyTower') {
        renderTower();
        showScreen('storyTower');
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
        const remain = Math.max(0, me.stats.skillCooldown - (now - me.lastSkillClientTime)) / 1000;
        mySkillCdEl.textContent = remain > 0.05 ? `${remain.toFixed(1)}s` : '사용가능';
        skillRemain = remain;
    }
    if (me.stats.ultimateType) {
        const remain = Math.max(0, me.stats.ultimateCooldownMs - (now - me.lastUltimateClientTime)) / 1000;
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
    }
});
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        if (isTargetingUltimate) confirmUltimateTarget();
        else if (autoAimActive()) fireAutoAimedAttack(false);
        else tryAttack();
    } else if (e.button === 2) {
        tryUseSkill();
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

function isTargetedUltimate(type) {
    return type === 'targeted_aoe' || type === 'magma_zone' || type === 'lightning_strike';
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
        ctx.fillText(`${ELEMENT_ICONS[bossMark.element] || '✨'} x${bossMark.charges}`, 0, 0);
        ctx.restore();
    }
    Object.values(players).forEach(p => p.draw(ctx, now));

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
