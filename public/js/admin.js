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
    CANNOT_DELETE_SELF: '자기 자신의 계정은 삭제할 수 없습니다.'
};

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
