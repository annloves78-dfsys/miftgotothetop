// 관리자 콘솔 (/admin). 게임 클라이언트와 완전히 분리되어 있고, 모든 조회/수정은
// is_admin = true 인 계정의 토큰을 요구하는 br_admin_* RPC를 통해서만 이루어집니다.
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ADMIN_SESSION_KEY = 'boss_raid_admin_session';
const PAGE_SIZE = 25;

let admin = null;          // { id, email, nickname, token }
let currentSearch = '';
let currentOffset = 0;
let totalUsers = 0;
let openUser = null;       // 드로어에 열려 있는 유저 상세

const $ = id => document.getElementById(id);

const loginScreen = $('admin-login-screen');
const consoleScreen = $('admin-console-screen');
const loginEmail = $('admin-login-email');
const loginPassword = $('admin-login-password');
const loginError = $('admin-login-error');
const loginBtn = $('admin-login-btn');
const userTbody = $('user-tbody');
const searchInput = $('user-search');
const listSummary = $('list-summary');
const pageLabel = $('page-label');
const prevPageBtn = $('prev-page-btn');
const nextPageBtn = $('next-page-btn');
const detailOverlay = $('detail-overlay');

// ---- 공용 ----
function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d)) return '-';
    return d.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
}

let toastTimer = null;
function toast(message, isError) {
    const el = $('toast');
    el.textContent = message;
    el.classList.toggle('error', !!isError);
    el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}

const ERROR_MESSAGES = {
    INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다.',
    NOT_ADMIN: '관리자 권한이 없는 계정입니다.',
    NO_TOKEN: '세션이 만료되었습니다. 다시 로그인해주세요.',
    INVALID_TOKEN: '세션이 만료되었습니다. 다시 로그인해주세요.',
    USER_NOT_FOUND: '해당 계정을 찾을 수 없습니다.',
    NICKNAME_REQUIRED: '닉네임을 입력해주세요.',
    PASSWORD_WEAK: '비밀번호는 10자 이상, 영문/숫자/특수문자를 모두 포함해야 합니다.',
    INVALID_DATA: '세이브 데이터는 JSON 객체여야 합니다.',
    CANNOT_DEMOTE_SELF: '자기 자신의 관리자 권한은 해제할 수 없습니다.',
    CANNOT_DELETE_SELF: '자기 자신의 계정은 삭제할 수 없습니다.',
    INVALID_CURRENCY: '알 수 없는 재화 종류입니다.',
    INVALID_AMOUNT: '수량을 입력해주세요.',
    INVALID_CHARACTER: '알 수 없는 캐릭터입니다.',
    CANNOT_REVOKE_KICKER: '자두맛 쿠키는 제거할 수 없습니다.',
    INVALID_PACKAGE: '알 수 없는 상품입니다.',
    DEPOSITOR_REQUIRED: '입금자명을 입력해주세요.',
    REQUEST_NOT_FOUND: '해당 신청을 찾을 수 없습니다.',
    ALREADY_RESOLVED: '이미 처리된 신청입니다.'
};

// main.js의 CURRENCY_LABELS와 같은 표. 게임 쪽 표시 이름을 그대로 씁니다.
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

$('currency-select').innerHTML = Object.entries(CURRENCY_LABELS)
    .map(([key, label]) => `<option value="${key}">${escapeHtml(label)}</option>`).join('');

// shared.js의 CHARACTERS 키/name과 같은 표. kicker(자두맛)는 모든 유저가 기본 보유라 목록에서 뺐다.
const CHARACTER_LABELS = {
    sweetpotato: '자색 고구마맛 쿠키',
    spinach: '시금치맛 쿠키',
    reddragon: '레드 드레곤맛 쿠키',
    volcano: '화산맛 쿠키',
    greenapple: '청사과맛 쿠키',
    orangelemon: '오렌지 레몬맛 쿠키',
    board: '보드맛 쿠키',
    electriccord: '전기줄맛 쿠키',
    lightning: '번개전사맛 쿠키',
    waterdrop: '물방울맛 쿠키',
    magma: '마그마맛 쿠키',
    blacksugar: '블랙 슈거맛 쿠키',
    dragonfruit: '용과맛 쿠키',
    sugarfly: '슈가 플라이맛 쿠키',
    lightningdevil: '번개악마맛 쿠키',
    seapearl: '바다펄맛 쿠키',
    lightninghell: '번개지옥맛 쿠키',
    cheesedumpling: '치즈만두맛 쿠키',
    hellflavor: '지옥맛 쿠키',
    flamefairy: '불꽃요정맛 쿠키',
    plaincookie: '쿠키맛 쿠키'
};

$('character-select').innerHTML = Object.entries(CHARACTER_LABELS)
    .map(([key, label]) => `<option value="${key}">${escapeHtml(label)}</option>`).join('');

function describeError(e) {
    const msg = (e && e.message) || '';
    const key = Object.keys(ERROR_MESSAGES).find(k => msg.includes(k));
    return key ? ERROR_MESSAGES[key] : '요청에 실패했습니다.';
}

// 토큰이 죽었으면 콘솔을 닫고 로그인 화면으로 되돌립니다.
function isSessionError(e) {
    const msg = (e && e.message) || '';
    return msg.includes('INVALID_TOKEN') || msg.includes('NO_TOKEN') || msg.includes('NOT_ADMIN');
}

async function rpc(fn, params) {
    const { data, error } = await sb.rpc(fn, { p_token: admin.token, ...params });
    if (error) {
        if (isSessionError(error)) {
            logout(describeError(error));
            throw error;
        }
        throw error;
    }
    return data;
}

// ---- 로그인 / 세션 ----
function saveSession() {
    if (admin) localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ token: admin.token }));
    else localStorage.removeItem(ADMIN_SESSION_KEY);
}

function enterConsole() {
    loginScreen.classList.add('hidden');
    consoleScreen.classList.remove('hidden');
    $('admin-who').textContent = `${admin.nickname}님 (${admin.email})`;
    loadStats();
    loadUsers();
    loadPurchaseRequests();
}

function logout(message) {
    admin = null;
    saveSession();
    closeDetail();
    consoleScreen.classList.add('hidden');
    loginScreen.classList.remove('hidden');
    loginPassword.value = '';
    loginError.textContent = message || '';
}

loginBtn.addEventListener('click', async () => {
    const email = loginEmail.value.trim();
    const password = loginPassword.value;
    loginError.textContent = '';
    if (!email || !password) {
        loginError.textContent = '이메일과 비밀번호를 입력해주세요.';
        return;
    }
    loginBtn.disabled = true;
    try {
        const { data, error } = await sb.rpc('br_admin_login', { p_email: email, p_password: password });
        if (error) throw error;
        admin = { id: data.id, email: data.email, nickname: data.nickname, token: data.session_token };
        saveSession();
        loginPassword.value = '';
        enterConsole();
    } catch (e) {
        loginError.textContent = describeError(e);
    } finally {
        loginBtn.disabled = false;
    }
});

[loginEmail, loginPassword].forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') loginBtn.click(); });
});

$('admin-logout-btn').addEventListener('click', () => logout());

async function restoreSession() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(ADMIN_SESSION_KEY)); } catch { saved = null; }
    if (!saved || !saved.token) return;
    admin = { token: saved.token };
    try {
        const { data, error } = await sb.rpc('br_admin_me', { p_token: saved.token });
        if (error) throw error;
        admin = { ...data, token: saved.token };
        enterConsole();
    } catch {
        admin = null;
        localStorage.removeItem(ADMIN_SESSION_KEY);
    }
}
restoreSession();

// ---- 통계 ----
async function loadStats() {
    try {
        const s = await rpc('br_admin_stats', {});
        $('stat-total').textContent = s.total_users;
        $('stat-today').textContent = s.new_today;
        $('stat-week').textContent = s.new_week;
        $('stat-save').textContent = s.with_save;
        $('stat-admins').textContent = s.admins;
    } catch (e) {
        console.error(e);
    }
}

// ---- 유저 목록 ----
async function loadUsers() {
    userTbody.innerHTML = '<tr><td colspan="7" class="table-empty">불러오는 중...</td></tr>';
    try {
        const res = await rpc('br_admin_list_users', {
            p_search: currentSearch, p_limit: PAGE_SIZE, p_offset: currentOffset
        });
        totalUsers = res.total;
        renderUsers(res.users);
        const from = totalUsers === 0 ? 0 : currentOffset + 1;
        const to = Math.min(currentOffset + PAGE_SIZE, totalUsers);
        listSummary.textContent = `${from}-${to} / 총 ${totalUsers}명`;
        pageLabel.textContent = `${Math.floor(currentOffset / PAGE_SIZE) + 1} 페이지`;
        prevPageBtn.disabled = currentOffset === 0;
        nextPageBtn.disabled = currentOffset + PAGE_SIZE >= totalUsers;
    } catch (e) {
        userTbody.innerHTML = `<tr><td colspan="7" class="table-empty">${escapeHtml(describeError(e))}</td></tr>`;
    }
}

function renderUsers(users) {
    if (!users.length) {
        userTbody.innerHTML = '<tr><td colspan="7" class="table-empty">해당하는 계정이 없습니다.</td></tr>';
        return;
    }
    userTbody.innerHTML = users.map(u => `
        <tr>
            <td>${escapeHtml(u.nickname)}${u.is_admin ? '<span class="admin-tag">ADMIN</span>' : ''}</td>
            <td class="muted">${escapeHtml(u.email)}</td>
            <td class="num">${u.cleared_bosses}</td>
            <td class="num">${u.cleared_floors}</td>
            <td class="muted">${escapeHtml(u.selected_character)}</td>
            <td class="muted">${formatDate(u.created_at)}</td>
            <td class="right"><button class="ghost-btn" data-user-id="${escapeHtml(u.id)}">상세</button></td>
        </tr>
    `).join('');
    userTbody.querySelectorAll('button[data-user-id]').forEach(btn => {
        btn.addEventListener('click', () => openDetail(btn.dataset.userId));
    });
}

function runSearch() {
    currentSearch = searchInput.value.trim();
    currentOffset = 0;
    loadUsers();
}

$('search-btn').addEventListener('click', runSearch);
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });
$('refresh-btn').addEventListener('click', () => { loadStats(); loadUsers(); });

prevPageBtn.addEventListener('click', () => {
    currentOffset = Math.max(0, currentOffset - PAGE_SIZE);
    loadUsers();
});
nextPageBtn.addEventListener('click', () => {
    if (currentOffset + PAGE_SIZE >= totalUsers) return;
    currentOffset += PAGE_SIZE;
    loadUsers();
});

// ---- 유저 상세 드로어 ----
async function openDetail(userId) {
    try {
        openUser = await rpc('br_admin_get_user', { p_user_id: userId });
    } catch (e) {
        toast(describeError(e), true);
        return;
    }
    $('detail-nickname').textContent = openUser.nickname;
    $('detail-email').textContent = openUser.email;
    $('detail-created').textContent = formatDate(openUser.created_at);
    $('detail-role').textContent = openUser.is_admin ? '관리자' : '일반 유저';
    $('detail-id').textContent = openUser.id;
    $('detail-nickname-input').value = openUser.nickname;
    $('detail-password-input').value = '';
    $('detail-gamedata').value = JSON.stringify(openUser.game_data || {}, null, 2);
    $('toggle-admin-btn').textContent = openUser.is_admin ? '관리자 권한 해제' : '관리자 권한 부여';
    detailOverlay.classList.remove('hidden');
}

function closeDetail() {
    openUser = null;
    detailOverlay.classList.add('hidden');
}

$('detail-close-btn').addEventListener('click', closeDetail);
detailOverlay.addEventListener('click', e => { if (e.target === detailOverlay) closeDetail(); });
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !detailOverlay.classList.contains('hidden')) closeDetail();
});

// 드로어 안의 모든 작업은 성공하면 목록/통계를 다시 읽어 화면을 최신 상태로 맞춥니다.
async function runAction(fn, params, successMessage, opts) {
    try {
        await rpc(fn, params);
        toast(successMessage);
        await loadUsers();
        await loadStats();
        if (opts && opts.close) closeDetail();
        else if (openUser) await openDetail(openUser.id);
    } catch (e) {
        toast(describeError(e), true);
    }
}

$('save-nickname-btn').addEventListener('click', () => {
    const nickname = $('detail-nickname-input').value.trim();
    if (!nickname) { toast('닉네임을 입력해주세요.', true); return; }
    runAction('br_admin_set_nickname', { p_user_id: openUser.id, p_nickname: nickname }, '닉네임을 변경했습니다.');
});

$('reset-password-btn').addEventListener('click', () => {
    const password = $('detail-password-input').value;
    if (!password) { toast('새 비밀번호를 입력해주세요.', true); return; }
    if (!confirm(`${openUser.nickname}님의 비밀번호를 변경할까요? 해당 유저는 로그아웃됩니다.`)) return;
    runAction('br_admin_reset_password', { p_user_id: openUser.id, p_password: password }, '비밀번호를 변경했습니다.');
});

$('save-gamedata-btn').addEventListener('click', () => {
    let parsed;
    try {
        parsed = JSON.parse($('detail-gamedata').value);
    } catch {
        toast('JSON 형식이 올바르지 않습니다.', true);
        return;
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        toast('세이브 데이터는 JSON 객체여야 합니다.', true);
        return;
    }
    runAction('br_admin_set_game_data', { p_user_id: openUser.id, p_data: parsed }, '세이브 데이터를 저장했습니다.');
});

$('reset-data-btn').addEventListener('click', () => {
    if (!confirm(`${openUser.nickname}님의 세이브 데이터를 초기화할까요? 되돌릴 수 없습니다.`)) return;
    runAction('br_admin_reset_data', { p_user_id: openUser.id }, '세이브 데이터를 초기화했습니다.');
});

$('grant-currency-btn').addEventListener('click', () => {
    const currency = $('currency-select').value;
    const amount = Number($('currency-amount-input').value);
    if (!Number.isFinite(amount) || amount === 0) { toast('수량을 입력해주세요.', true); return; }
    runAction(
        'br_admin_grant_currency',
        { p_user_id: openUser.id, p_currency: currency, p_amount: Math.trunc(amount) },
        `${CURRENCY_LABELS[currency]}를(을) ${amount > 0 ? '지급' : '차감'}했습니다.`
    );
    $('currency-amount-input').value = '';
});

$('grant-character-btn').addEventListener('click', () => {
    const character = $('character-select').value;
    runAction(
        'br_admin_grant_character',
        { p_user_id: openUser.id, p_character: character },
        `${CHARACTER_LABELS[character]}를(을) 지급했습니다.`
    );
});

$('revoke-character-btn').addEventListener('click', () => {
    const character = $('character-select').value;
    if (!confirm(`${openUser.nickname}님의 ${CHARACTER_LABELS[character]}를(을) 제거할까요?`)) return;
    runAction(
        'br_admin_revoke_character',
        { p_user_id: openUser.id, p_character: character },
        `${CHARACTER_LABELS[character]}를(을) 제거했습니다.`
    );
});

$('reset-characters-btn').addEventListener('click', () => {
    if (!confirm(`${openUser.nickname}님의 캐릭터를 전부 삭제할까요? 자두맛만 남고 장착 장비/영혼석도 초기화되며 되돌릴 수 없습니다.`)) return;
    runAction('br_admin_reset_characters', { p_user_id: openUser.id }, '캐릭터를 전부 삭제했습니다.');
});

$('reset-currencies-btn').addEventListener('click', () => {
    if (!confirm(`${openUser.nickname}님의 재화를 전부 삭제할까요? 되돌릴 수 없습니다.`)) return;
    runAction('br_admin_reset_currencies', { p_user_id: openUser.id }, '재화를 전부 삭제했습니다.');
});

$('reset-progress-btn').addEventListener('click', () => {
    if (!confirm(`${openUser.nickname}님의 보스/스토리 층/이벤트 진행도를 전부 삭제할까요? 되돌릴 수 없습니다.`)) return;
    runAction('br_admin_reset_progress', { p_user_id: openUser.id }, '진행도를 전부 삭제했습니다.');
});

$('toggle-admin-btn').addEventListener('click', () => {
    const next = !openUser.is_admin;
    const label = next ? '관리자 권한을 부여' : '관리자 권한을 해제';
    if (!confirm(`${openUser.nickname}님에게 ${label}할까요?`)) return;
    runAction('br_admin_set_admin', { p_user_id: openUser.id, p_is_admin: next }, `${label}했습니다.`);
});

$('delete-user-btn').addEventListener('click', () => {
    if (!confirm(`${openUser.nickname}(${openUser.email}) 계정을 삭제할까요? 세이브 데이터까지 영구 삭제되며 되돌릴 수 없습니다.`)) return;
    runAction('br_admin_delete_user', { p_user_id: openUser.id }, '계정을 삭제했습니다.', { close: true });
});

// ---- 현질 신청 ----
// main.js의 IAP_PACKAGES와 같은 표. 게임 쪽 표시 이름을 그대로 씁니다.
const PACKAGE_LABELS = {
    iapDiamonds5000: '다이아 5000개',
    iapTicketNormal260: '일반 뽑기 티켓 260장',
    iapRandomCharBox: '랜덤 캐릭터 상자'
};
const PURCHASE_STATUS_LABELS = { pending: '대기중', approved: '지급완료', rejected: '거절됨' };

let purchaseRequests = [];

function describePurchaseResult(result) {
    if (!result || !result.character) return '';
    const name = CHARACTER_LABELS[result.character] || result.character;
    return result.duplicate ? `${name} 보유 중 → 영혼석 30개 지급` : `${name} 지급 (${result.grade})`;
}

async function loadPurchaseRequests() {
    try {
        purchaseRequests = await rpc('br_admin_list_purchase_requests', { p_status: '' });
        renderPurchaseRequests();
    } catch (e) {
        $('purchase-tbody').innerHTML = `<tr><td colspan="8" class="table-empty">${escapeHtml(describeError(e))}</td></tr>`;
    }
}

function renderPurchaseRequests() {
    const tbody = $('purchase-tbody');
    const pendingCount = purchaseRequests.filter(r => r.status === 'pending').length;
    $('purchase-pending-count').textContent = pendingCount;
    $('purchase-pending-count').classList.toggle('hidden', pendingCount === 0);

    if (!purchaseRequests.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="table-empty">신청 내역이 없습니다.</td></tr>';
        return;
    }
    tbody.innerHTML = purchaseRequests.map(r => `
        <tr>
            <td>${escapeHtml(r.nickname)}</td>
            <td class="muted">${escapeHtml(r.email)}</td>
            <td>${escapeHtml(PACKAGE_LABELS[r.package_key] || r.package_key)}</td>
            <td class="num">₩${Number(r.price_krw).toLocaleString()}</td>
            <td class="muted">${escapeHtml(r.depositor_name || '-')}</td>
            <td class="muted">${formatDate(r.created_at)}</td>
            <td>${PURCHASE_STATUS_LABELS[r.status] || r.status}${r.result ? `<div class="hint">${escapeHtml(describePurchaseResult(r.result))}</div>` : ''}</td>
            <td class="right">${r.status === 'pending' ? `
                <button class="primary-btn small" data-approve="${r.id}">지급</button>
                <button class="danger-btn small" data-reject="${r.id}">거절</button>
            ` : '-'}</td>
        </tr>
    `).join('');
    tbody.querySelectorAll('button[data-approve]').forEach(btn => {
        btn.addEventListener('click', () => resolvePurchase(btn.dataset.approve, true));
    });
    tbody.querySelectorAll('button[data-reject]').forEach(btn => {
        btn.addEventListener('click', () => resolvePurchase(btn.dataset.reject, false));
    });
}

async function resolvePurchase(id, approve) {
    const req = purchaseRequests.find(r => r.id === id);
    if (!req) return;
    const label = approve ? '지급' : '거절';
    if (!confirm(`${req.nickname}님의 "${PACKAGE_LABELS[req.package_key] || req.package_key}" (₩${Number(req.price_krw).toLocaleString()}) 신청을 ${label}할까요?`)) return;
    try {
        await rpc('br_admin_resolve_purchase_request', { p_request_id: id, p_approve: approve });
        toast(`${label}했습니다.`);
        await loadPurchaseRequests();
    } catch (e) {
        toast(describeError(e), true);
    }
}

$('purchase-refresh-btn').addEventListener('click', loadPurchaseRequests);
