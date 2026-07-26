const socket = io();

// ---- Screens ----
const screens = {
    lobby: document.getElementById('lobby-screen'),
    shop: document.getElementById('shop-screen'),
    modeSelect: document.getElementById('mode-select-screen'),
    storyMode: document.getElementById('story-mode-screen'),
    storyTower: document.getElementById('story-tower-screen'),
    storyFight: document.getElementById('story-fight-screen'),
    login: document.getElementById('login-screen'),
    signup: document.getElementById('signup-screen'),
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
const GRADE_ORDER = ['일반', '희귀', '에픽', '에이션트', '비스트', '게스트'];
function hasAwakenSlot(grade) {
    const idx = GRADE_ORDER.indexOf(grade);
    return idx >= GRADE_ORDER.indexOf('에이션트');
}
const charDetailAttackIcon = document.getElementById('char-detail-attack-icon');
const charDetailSkillIcon = document.getElementById('char-detail-skill-icon');
const charDetailUltimateIcon = document.getElementById('char-detail-ultimate-icon');
const charDetailDesc = document.getElementById('char-detail-desc');
const charDetailSelectBtn = document.getElementById('char-detail-select-btn');

// ---- Auth (login / signup / persistent session) ----
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const menuBtn = document.getElementById('menu-btn');
const sideMenu = document.getElementById('side-menu');
const menuGuestSection = document.getElementById('menu-guest-section');
const menuUserSection = document.getElementById('menu-user-section');
const menuNickname = document.getElementById('menu-nickname');
const menuLoginBtn = document.getElementById('menu-login-btn');
const menuSignupBtn = document.getElementById('menu-signup-btn');
const menuLogoutBtn = document.getElementById('menu-logout-btn');
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
        menuGuestSection.classList.add('hidden');
        menuUserSection.classList.remove('hidden');
        menuNickname.textContent = currentUser.nickname + '님';
    } else {
        menuGuestSection.classList.remove('hidden');
        menuUserSection.classList.add('hidden');
    }
}

menuBtn.addEventListener('click', () => sideMenu.classList.toggle('hidden'));
document.addEventListener('click', (e) => {
    if (!sideMenu.classList.contains('hidden') && !sideMenu.contains(e.target) && e.target !== menuBtn) {
        sideMenu.classList.add('hidden');
    }
});

menuLoginBtn.addEventListener('click', () => {
    sideMenu.classList.add('hidden');
    loginError.textContent = '';
    showScreen('login');
});
menuSignupBtn.addEventListener('click', () => {
    sideMenu.classList.add('hidden');
    signupError.textContent = '';
    showScreen('signup');
});
menuLogoutBtn.addEventListener('click', () => {
    currentUser = null;
    saveAuthSession();
    updateMenuAuthUI();
    sideMenu.classList.add('hidden');
});

loginBackBtn.addEventListener('click', () => showScreen('lobby'));
signupBackBtn.addEventListener('click', () => showScreen('lobby'));
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
        gameData = { ...defaultData, ...cloudData };
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

function describeAbility(stats, kind) {
    const sec = ms => (ms / 1000).toString().replace(/\.0$/, '');
    if (kind === 'attack') {
        if (stats.attackType === 'alternating_punch') {
            return `오른손과 왼손을 번갈아 가며 공격합니다. 오른손 피해 ${stats.attackDamageRight}, 왼손 피해 ${stats.attackDamageLeft}. (재사용 대기시간 ${sec(stats.attackCooldown)}초)`;
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
        [charDetailUltimateIcon, 'ultimate']
    ].forEach(([el, k]) => el.classList.toggle('selected', k === kind));
}

charDetailAttackIcon.addEventListener('click', () => selectCharDetailAbility('attack'));
charDetailSkillIcon.addEventListener('click', () => selectCharDetailAbility('skill'));
charDetailUltimateIcon.addEventListener('click', () => selectCharDetailAbility('ultimate'));

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
    team_shield: '🔰'
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
let mobileControlsEnabled = localStorage.getItem(MOBILE_CONTROLS_KEY) === '1';
const menuMobileControlsBtn = document.getElementById('menu-mobile-controls-btn');
const menuMobileControlsStatus = document.getElementById('menu-mobile-controls-status');
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

function updateMobileControlsMenuLabel() {
    menuMobileControlsStatus.textContent = mobileControlsEnabled ? '켜짐' : '꺼짐';
    menuMobileControlsStatus.classList.toggle('on', mobileControlsEnabled);
}
function applyMobileControlsVisibility() {
    if (!mobileControlsFight) return;
    mobileControlsFight.classList.toggle('hidden', !mobileControlsEnabled);
    mobileControlsStory.classList.toggle('hidden', !mobileControlsEnabled);
    document.body.classList.toggle('mc-on', mobileControlsEnabled);
}
updateMobileControlsMenuLabel();
applyMobileControlsVisibility(); // restore the saved preference on load
menuMobileControlsBtn.addEventListener('click', () => {
    mobileControlsEnabled = !mobileControlsEnabled;
    localStorage.setItem(MOBILE_CONTROLS_KEY, mobileControlsEnabled ? '1' : '0');
    updateMobileControlsMenuLabel();
    applyMobileControlsVisibility();
});

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
// Attack button doubles as the ultimate-target confirm, mirroring how
// left-click already works on desktop (see the canvas mousedown handlers).
mcTap(mcAttackFightEl, () => { if (isTargetingUltimate) confirmUltimateTarget(); else tryAttack(); });
mcTap(mcSkillFightEl, () => tryUseSkill());
mcTap(mcUltimateFightEl, () => handleUltimateKey());
mcTap(mcAttackStoryEl, () => { if (isStoryTargetingUltimate) confirmStoryUltimateTarget(); else tryStoryAttack(); });
mcTap(mcSkillStoryEl, () => tryStoryUseSkill());
mcTap(mcUltimateStoryEl, () => storyHandleUltimateKey());

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
    ultEl.textContent = SKILL_ICONS[stats.ultimateType] || '🔥';
    skillEl.appendChild(cdSkill);
    ultEl.appendChild(cdUlt);
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
function updateSelectedCharLabel() {
    const stats = SHARED.CHARACTERS[gameData.selectedCharacter] || SHARED.CHARACTERS.kicker;
    selectedCharNameEl.textContent = stats.shortName || stats.name;
}
updateSelectedCharLabel();

let characterReturnScreen = 'lobby'; // where "뒤로"/selecting a character sends you back to

function renderCharacterList() {
    characterListEl.innerHTML = '';
    Object.entries(SHARED.CHARACTERS).forEach(([id, stats]) => {
        const unlocked = gameData.unlockedCharacters.includes(id);
        const card = document.createElement('div');
        card.className = 'boss-card' + (unlocked ? '' : ' locked') + (id === gameData.selectedCharacter ? ' selected' : '');
        const iconHtml = unlocked
            ? `<div class="icon char-swatch" style="background: ${charIconBackground(stats)}"></div>`
            : `<div class="icon">🔒</div>`;
        card.innerHTML = `${iconHtml}<div class="name">${stats.name}</div>`;
        if (unlocked) card.addEventListener('click', () => openCharacterDetail(id));
        characterListEl.appendChild(card);
    });
}

characterSelectBtn.addEventListener('click', () => {
    characterReturnScreen = 'lobby';
    renderCharacterList();
    showScreen('characterSelect');
});
backFromCharacterBtn.addEventListener('click', () => showScreen(characterReturnScreen));

// ---- Character detail (appearance/equipment preview before confirming a pick) ----
let viewingCharacterId = null;

function openCharacterDetail(id) {
    viewingCharacterId = id;
    const stats = SHARED.CHARACTERS[id];
    charDetailIcon.style.background = charIconBackground(stats);
    charDetailName.textContent = stats.name;
    charDetailPower.textContent = stats.combatPower;
    charDetailGrade.textContent = stats.grade || '-';
    const GRADE_CLASSES = { '희귀': 'rare', '에픽': 'epic', '에이션트': 'ancient', '비스트': 'ancient', '게스트': 'ancient' };
    charDetailGrade.className = 'grade-badge ' + (GRADE_CLASSES[stats.grade] || 'common');
    charDetailAwakenSlot.classList.toggle('hidden', !hasAwakenSlot(stats.grade));
    charDetailElement.textContent = stats.element || '-';
    charDetailRole.textContent = stats.role || '-';
    if (stats.attackDamageRight != null && stats.attackDamageLeft != null) {
        charDetailAtk.textContent = `${stats.attackDamageRight}~${stats.attackDamageLeft}`;
    } else {
        charDetailAtk.textContent = stats.attackDamage != null ? stats.attackDamage : '-';
    }
    charDetailHp.textContent = stats.health != null ? stats.health : '-';
    charDetailAttackIcon.textContent = SKILL_ICONS[stats.attackType] || '🗡';
    charDetailSkillIcon.textContent = SKILL_ICONS[stats.skillType] || '❔';
    charDetailUltimateIcon.textContent = SKILL_ICONS[stats.ultimateType] || '❔';
    selectCharDetailAbility('attack');
    showScreen('characterDetail');
}

charDetailBackBtn.addEventListener('click', () => showScreen('characterSelect'));

charDetailSelectBtn.addEventListener('click', () => {
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

detailChangeCharBtn.addEventListener('click', () => {
    characterReturnScreen = 'bossDetail';
    renderCharacterList();
    showScreen('characterSelect');
});

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

towerCharPreview.addEventListener('click', () => {
    characterReturnScreen = 'storyTower';
    renderCharacterList();
    showScreen('characterSelect');
});

backFromStoryModeBtn.addEventListener('click', () => showScreen('modeSelect'));
// story-multi-btn stays permanently disabled -- multiplayer story mode isn't built yet.
storySoloBtn.addEventListener('click', () => {
    selectedStoryFloor = 1;
    renderTower();
    showScreen('storyTower');
});

// ---- Story tower: floor select ----
const STORY_TOTAL_FLOORS = 10; // floors 3+ are placeholders until they get real content (see STORY_FLOOR_DEFS)
let selectedStoryFloor = 1;

function isFloorUnlocked(floor) {
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
let storyMagmaZones = []; // [{x, y, radius, until}] long-lived damage zones (volcano cookie ultimate)

socket.on('storyFloorStarted', (data) => {
    storyFloorDef = data.floorDef;
    storyMonsters = data.monsters;
    const p = data.player;
    storyPlayer = {
        x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, facing: p.facing, charType: p.charType, alive: true, shieldHp: p.shieldHp || 0,
        lastAttackClientTime: -Infinity, lastSkillClientTime: -Infinity, lastUltimateClientTime: -Infinity,
        attackEffectUntil: 0, skillEffectUntil: 0, ultimateEffectUntil: 0, healEffectUntil: 0, speedBoostUntil: 0, awakenUntil: 0, rapidStrikeUntil: 0
    };
    isStoryTargetingUltimate = false;
    storyImpactEffects = [];
    storyMagmaZones = [];
    updateStoryHpBar();
    updateStoryMonstersLeft();
    syncMobileButtonIcons(p.charType, true);
    showScreen('storyFight');
    startStoryLoop();
});

socket.on('storyTick', ({ monsters }) => {
    storyMonsters = monsters;
    updateStoryMonstersLeft();
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

socket.on('storyPlayerHealed', ({ hp }) => {
    if (!storyPlayer) return;
    storyPlayer.hp = hp;
    storyPlayer.healEffectUntil = performance.now() + 250;
    updateStoryHpBar();
});

socket.on('storyUltimateImpact', ({ x, y, radius }) => {
    storyImpactEffects.push({ x, y, radius, until: performance.now() + 400 });
});

socket.on('storyMagmaZonePlaced', ({ x, y, radius, durationMs }) => {
    storyMagmaZones.push({ x, y, radius, until: performance.now() + durationMs });
});

socket.on('storyFloorResult', ({ result, floor }) => {
    stopStoryLoop();
    selectedStoryFloor = floor;
    if (result === 'win') {
        resultTitle.textContent = '층 클리어!';
        resultTitle.style.color = '#2ecc71';
        resultDesc.textContent = `${floor}층을 클리어했습니다.`;
        if (!gameData.clearedStoryFloors.includes(floor)) {
            gameData.clearedStoryFloors.push(floor);
            saveGameData(gameData);
        }
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
        else tryStoryAttack();
    } else if (e.button === 2) {
        tryStoryUseSkill();
    }
});
// Targeted ultimates (targeted_aoe / magma_zone) need a world position, which
// on desktop comes from the mouse. On touch, tapping the canvas both sets that
// position and confirms the cast.
storyCanvas.addEventListener('pointerdown', (e) => {
    if (!mobileControlsEnabled || e.pointerType === 'mouse') return;
    const rect = storyCanvas.getBoundingClientRect();
    storyMouseX = (e.clientX - rect.left) * (storyCanvas.width / rect.width);
    storyMouseY = (e.clientY - rect.top) * (storyCanvas.height / rect.height);
    if (isStoryTargetingUltimate) confirmStoryUltimateTarget();
});

function storyWorldFromMouse() {
    const camX = storyPlayer ? storyPlayer.x : 0;
    return { x: storyMouseX - storyCanvas.width / 2 + camX, y: storyMouseY - storyCanvas.height / 2 };
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
    const matchesFullDuration = stats.skillType === 'spin_heal' || stats.skillType === 'guard_stance';
    storyPlayer.skillEffectUntil = now + (matchesFullDuration ? stats.skillDurationMs : 350);
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
    socket.emit('storyPlayerUltimate');
}

// F does different things depending on the character, mirroring the boss-raid version.
function storyHandleUltimateKey() {
    if (!storyPlayer) return;
    const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
    if (stats.ultimateType === 'targeted_aoe' || stats.ultimateType === 'magma_zone') {
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
    const cooldown = rapid ? stats.ultimateRapidCooldown : stats.attackCooldown;
    if (now - storyPlayer.lastAttackClientTime < cooldown) return;
    storyPlayer.lastAttackClientTime = now;
    storyPlayer.attackEffectUntil = now + 180;
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
        const boosted = stats.skillType === 'speed_boost' && now < storyPlayer.speedBoostUntil;
        const awakened = stats.ultimateType === 'awakening' && now < storyPlayer.awakenUntil;
        const speed = boosted ? stats.skillSpeedValue : (awakened ? stats.speed * stats.ultimateSpeedMultiplier : stats.speed);
        let dx = 0, dy = 0;
        if (keys['w'] || keys['W']) dy -= speed;
        if (keys['s'] || keys['S']) dy += speed;
        if (keys['a'] || keys['A']) dx -= speed;
        if (keys['d'] || keys['D']) dx += speed;
        if (dx !== 0 || dy !== 0) {
            let nx = storyPlayer.x + dx;
            let ny = storyPlayer.y + dy;
            const halfW = storyFloorDef.laneHalfWidth;
            if (ny > halfW) ny = halfW;
            if (ny < -halfW) ny = -halfW;
            if (nx > 40) nx = 40;
            if (nx < -storyFloorDef.levelLength) nx = -storyFloorDef.levelLength;
            if (storyFloorDef.gates) {
                for (const gate of storyFloorDef.gates) {
                    if (!storyAnyMonsterAliveInRoom(gate.room)) continue;
                    if (storyPlayer.x <= gate.entranceX || nx <= gate.entranceX) {
                        if (nx > gate.entranceX) nx = gate.entranceX;
                        if (nx < gate.exitX) nx = gate.exitX;
                    }
                }
            }
            storyPlayer.x = nx; storyPlayer.y = ny;
        }
        if (mobileControlsEnabled) {
            if (storyJoystickFacing !== null) storyPlayer.facing = storyJoystickFacing;
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

function storyRender(now) {
    storyCtx.clearRect(0, 0, storyCanvas.width, storyCanvas.height);
    storyCtx.save();
    const camX = storyPlayer ? storyPlayer.x : 0;
    storyCtx.translate(storyCanvas.width / 2 - camX, storyCanvas.height / 2);

    if (storyFloorDef) {
        const halfW = storyFloorDef.laneHalfWidth;
        storyCtx.fillStyle = '#4a3c2f';
        storyCtx.fillRect(-storyFloorDef.levelLength - 200, -halfW, storyFloorDef.levelLength + 400, halfW * 2);
        storyCtx.strokeStyle = 'rgba(255,255,255,0.15)';
        storyCtx.lineWidth = 2;
        storyCtx.strokeRect(-storyFloorDef.levelLength - 200, -halfW, storyFloorDef.levelLength + 400, halfW * 2);

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
                [gate.entranceX, gate.exitX].forEach(gateX => {
                    storyCtx.fillStyle = `rgba(52, 152, 219, ${shieldAlpha})`;
                    storyCtx.fillRect(gateX - 6, -halfW, 12, halfW * 2);
                    storyCtx.strokeStyle = 'rgba(133, 202, 240, 0.9)';
                    storyCtx.lineWidth = 2;
                    storyCtx.strokeRect(gateX - 6, -halfW, 12, halfW * 2);
                });
            });
        }
    }

    storyImpactEffects = storyImpactEffects.filter(fx => now < fx.until);
    storyImpactEffects.forEach(fx => {
        const t = 1 - Math.max(0, (fx.until - now) / 400);
        storyCtx.beginPath();
        storyCtx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
        storyCtx.fillStyle = `rgba(142, 68, 173, ${0.5 * (1 - t)})`;
        storyCtx.fill();
        storyCtx.strokeStyle = 'rgba(142, 68, 173, 0.9)';
        storyCtx.lineWidth = 3;
        storyCtx.stroke();
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
        storyCtx.beginPath();
        storyCtx.arc(0, 0, SHARED.MONSTER_RADIUS, 0, Math.PI * 2);
        storyCtx.fillStyle = def.color;
        storyCtx.fill();
        storyCtx.strokeStyle = '#2c3e50';
        storyCtx.lineWidth = 2;
        storyCtx.stroke();
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

    if (storyPlayer) {
        const stats = SHARED.CHARACTERS[storyPlayer.charType] || SHARED.CHARACTERS.kicker;
        const R = SHARED.PLAYER_RADIUS;
        storyCtx.save();
        storyCtx.translate(storyPlayer.x, storyPlayer.y);

        if (now < (storyPlayer.attackEffectUntil || 0)) {
            storyCtx.save();
            storyCtx.rotate(storyPlayer.facing);
            storyCtx.fillStyle = 'rgba(241, 196, 15, 0.35)';
            storyCtx.fillRect(R, -(stats.attackWidth || 40) / 2, stats.attackRange, stats.attackWidth || 40);
            storyCtx.strokeStyle = 'rgba(241, 196, 15, 0.9)';
            storyCtx.lineWidth = 2;
            storyCtx.strokeRect(R, -(stats.attackWidth || 40) / 2, stats.attackRange, stats.attackWidth || 40);
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

        storyCtx.beginPath();
        storyCtx.arc(0, 0, R, 0, Math.PI * 2);
        storyCtx.fillStyle = storyPlayer.alive ? stats.color : '#7f8c8d';
        storyCtx.fill();
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
        storyCtx.beginPath();
        storyCtx.setLineDash([8, 6]);
        storyCtx.arc(world.x, world.y, stats.ultimateRadius || 90, 0, Math.PI * 2);
        storyCtx.strokeStyle = 'rgba(142, 68, 173, 0.9)';
        storyCtx.lineWidth = 2;
        storyCtx.stroke();
        storyCtx.setLineDash([]);
    }

    storyCtx.restore();
}

// ---- Boss select ----
function renderBossList() {
    bossListEl.innerHTML = '';
    SHARED.BOSS_LIST.forEach(b => {
        const card = document.createElement('div');
        card.className = 'boss-card' + (b.locked ? ' locked' : '');
        card.innerHTML = `<div class="icon">${b.locked ? '🔒' : (b.icon || '🗿')}</div><div class="name">${b.name}</div>`;
        if (!b.locked) card.addEventListener('click', () => openBossDetail(b.id));
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

socket.on('magmaZonePlaced', ({ x, y, radius, durationMs }) => {
    magmaZones.push({ x, y, radius, until: performance.now() + durationMs });
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
        if (currentRoomState) recordClear(currentRoomState.bossId, performance.now() - raidStartAt);
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
// Tap-to-place for targeted ultimates on touch; see the story-mode twin.
canvas.addEventListener('pointerdown', (e) => {
    if (!mobileControlsEnabled || e.pointerType === 'mouse') return;
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);
    if (isTargetingUltimate) confirmUltimateTarget();
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

// F does different things depending on the character: instant cast for
// heal-over-time, or arm targeting mode for a click-to-place AOE.
function handleUltimateKey() {
    const me = players[socket.id];
    if (!me) return;
    if (me.stats.ultimateType === 'targeted_aoe' || me.stats.ultimateType === 'magma_zone') {
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
            // No mouse on touch -- face the direction the joystick is pushed,
            // keeping the last angle when it's released.
            if (joystickFacing !== null) me.facing = joystickFacing;
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
    ctx.translate(canvas.width / 2, canvas.height / 2);
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
        ctx.beginPath();
        ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(142, 68, 173, ${0.5 * (1 - t)})`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(142, 68, 173, 0.9)';
        ctx.lineWidth = 3;
        ctx.stroke();
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
        const radius = me ? me.stats.ultimateRadius : 90;
        const world = screenToWorld(mouseX, mouseY);
        ctx.beginPath();
        ctx.setLineDash([8, 6]);
        ctx.arc(world.x, world.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(142, 68, 173, 0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.restore();
}
