const API_URL = 'https://SistemAnalizProje.pythonanywhere.com';
let detailCooldownEnd = 0;
let detailTimerInterval = null;
let currentTopicId = null;
let currentUserRank = 'member';
let isGuest = true;
const POLL_INTERVAL = 30000;
const MESSAGE_COOLDOWN = 5;
let lastMessageTime = 0;
let openRepliesSet = new Set();
let lastPostsString = "";
let currentCategory = 'general';
let currentViewMode = 'chat';
let activeReplyId = null;
let activeEditId = null;

// --- GENEL YARDIMCI FONKSİYONLAR ---

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

const formatTime = (dateStr) => {
    let date = new Date(dateStr);
    date.setHours(date.getHours() + 3);
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60) return "Şimdi";
    if (diff < 3600) return Math.floor(diff / 60) + "dk";
    if (diff < 86400) return Math.floor(diff / 3600) + "sa";
    return date.toLocaleDateString('tr-TR');
};

const escapeHTML = (str) => str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[tag]));

const unescapeHTML = (str) => str.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');

// --- OTURUM VE YETKİLENDİRME ---

async function checkSession() {
    try {
        const res = await fetch(`${API_URL}/session`, { credentials: 'include' });
        const data = await res.json();
        if (data.is_logged_in) {
            isGuest = false;
            if (data.user.rank === 'admin') {
                document.getElementById('admin-panel-btn').style.display = 'flex';
            }
            currentUserRank = data.user.rank || 'member';
            document.getElementById('auth-screen').classList.remove('active');
            document.getElementById('guest-bar').classList.remove('active');
            document.getElementById('user-name').innerText = data.user.username || "Hacker";
            document.getElementById('avatar-initial').innerText = (data.user.username || "U").charAt(0).toUpperCase();
        } else {
            isGuest = true;
            document.getElementById('guest-bar').classList.add('active');
        }
    } catch (e) {
        isGuest = true;
        document.getElementById('guest-bar').classList.add('active');
    }
}

async function handleAuth(endpoint, btnId) {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById(btnId);
    const errEl = document.getElementById('login-error');

    errEl.style.display = 'none';
    errEl.innerText = '';

    if (!email || (!password && endpoint !== 'forgot-password')) {
        errEl.innerText = "Lütfen tüm alanları doldurun.";
        errEl.style.display = 'block';
        return;
    }

    if (btn) btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrf_token')
            },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });
        const data = await res.json();

        if (res.ok) {
            if (endpoint === 'register') {
                alert("Kayıt başarılı! Aktivasyon bağlantısı için e-postanızı kontrol edin.");
                document.getElementById('back-to-login-btn').click();
            } else if (endpoint === 'login') {
                checkSession();
            } else {
                alert("İşlem başarılı.");
            }
        } else {
            errEl.innerText = data.error || "Hata oluştu.";
            errEl.style.display = 'block';
        }
    } catch (e) {
        errEl.innerText = "Sunucu hatası.";
        errEl.style.display = 'block';
    } finally {
        if (btn) btn.disabled = false;
    }
}

// --- NAVİGASYON VE KATEGORİ YÖNETİMİ ---

function switchCategory(category, element, pushHistory = true) {
    currentCategory = category;
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    if (element) {
        element.classList.add('active');
    } else {
        const navItems = document.querySelectorAll('.nav-item');
        for (let btn of navItems) {
            if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${category}'`)) {
                btn.classList.add('active');
                break;
            }
        }
    }

    const headerTitle = {
        'general': '<i class="fa-solid fa-earth-americas"></i> Genel Akış',
        'soru-cevap': '<i class="fa-solid fa-circle-question"></i> Soru - Cevap',
        'siber-guvenlik': '<i class="fa-solid fa-shield-halved"></i> Siber Güvenlik',
        'pentesting': '<i class="fa-solid fa-chess-knight"></i> Pentesting',
        'bug-bounty': '<i class="fa-solid fa-sack-dollar"></i> Bug Bounty',
        'donanim': '<i class="fa-solid fa-laptop-code"></i> Yazılım & Donanım',
        'tool-paylasim': '<i class="fa-solid fa-screwdriver-wrench"></i> Tool Paylaşımı',
        'etik-hukuk': '<i class="fa-solid fa-scale-balanced"></i> Etik & Hukuk',
        'diger': '<i class="fa-solid fa-mug-hot"></i> Diğer Konular'
    };
    
    document.getElementById('channel-header-info').innerHTML = headerTitle[category] || escapeHTML(category);
    
    if (category === 'general') {
        currentViewMode = 'chat';
        document.getElementById('general-compose-area').style.display = 'block';
    } else {
        currentViewMode = 'forum-list';
        document.getElementById('general-compose-area').style.display = 'none';
    }

    if (pushHistory) {
        const newUrl = `${window.location.pathname}?category=${category}`;
        window.history.pushState({ mode: 'category', val: category }, '', newUrl);
    }

    lastPostsString = "";
    document.getElementById('chat-feed').innerHTML = '<div style="padding:20px; text-align:center;"><i class="fa-solid fa-circle-notch fa-spin"></i> Yükleniyor...</div>';
    loadMessages();
}

function viewTopic(id, category, pushHistory = true) {
    currentTopicId = parseInt(id);
    if (category) {
        currentCategory = category;
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    }

    currentViewMode = 'forum-detail';
    document.getElementById('general-compose-area').style.display = 'none';
    lastPostsString = "";

    if (pushHistory) {
        const newUrl = `${window.location.pathname}?category=${currentCategory}&topic=${id}`;
        window.history.pushState({ mode: 'topic', val: id, cat: currentCategory }, '', newUrl);
    }

    loadMessages();
}

function backToForum() {
    switchCategory(currentCategory, null, true);
}

// --- VERİ ÇEKME VE LİSTELEME ---

async function loadMessages() {
    if (activeEditId || activeReplyId) return;
    const detailInput = document.getElementById('detail-reply-input');
    if (detailInput && detailInput.value.trim().length > 0) return;

    try {
        let urlParams = `category=${currentCategory}`;
        if (currentViewMode === 'forum-detail' && currentTopicId) {
            urlParams += `&topic=${currentTopicId}`;
        }

        const res = await fetch(`${API_URL}/posts?${urlParams}`, { credentials: 'include' });
        const posts = await res.json();
        const feed = document.getElementById('chat-feed');

        const currentDataString = JSON.stringify(posts);
        if (currentDataString === lastPostsString && !activeEditId) return;
        lastPostsString = currentDataString;

        feed.innerHTML = '';

        if (posts.length === 0) {
            feed.innerHTML = "<div style='text-align:center; color:#555; margin-top:50px;'>Henüz bu kategoride bir içerik yok.</div>";
            return;
        }

        if (currentViewMode === 'chat') {
            const postMap = {};
            posts.forEach(p => postMap[p.id] = { ...p, children: [] });
            const roots = [];
            posts.forEach(p => {
                const pid = p.parent_id ? parseInt(p.parent_id) : null;
                if (pid && postMap[pid]) {
                    postMap[pid].children.push(postMap[p.id]);
                } else {
                    roots.push(postMap[p.id]);
                }
            });
            roots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            feed.innerHTML = roots.map(root => buildPostHTML(root)).join('');
        } 
        else if (currentViewMode === 'forum-list') {
            let html = '';
            posts.forEach(p => {
                if (!p.parent_id) {
                    const initial = (p.author_email || 'A').charAt(0).toUpperCase();
                    const userStats = p.user_stats || { rank: 'member', message_count: 0 };
                    const canDelete = p.is_mine || (currentUserRank === 'admin');
                    const deleteBtnHtml = canDelete ? `<div onclick="deletePost(${p.id}); event.stopPropagation();" style="margin-top: 15px; color: #ef4444; font-size: 16px; cursor: pointer;"><i class="fa-regular fa-trash-can"></i></div>` : '';

                    html += `
                        <div class="message" style="cursor:pointer; flex-direction:row; padding:0; align-items:stretch;" onclick="viewTopic(${p.id}, '${p.category}')">
                            <div class="msg-left" style="width: 110px; padding: 15px 5px; border-right: 1px solid rgba(255,255,255,0.05); background: transparent; flex-shrink:0; display:flex; flex-direction:column; justify-content:center;">
                                <div class="msg-avatar" style="width:40px; height:40px; font-size:16px; margin-bottom:10px;">${initial}</div>
                                <div class="user-stats" style="border-top:none; padding-top:0;">
                                    <div class="user-rank ${userStats.rank}">${userStats.rank}</div>
                                    <div class="user-stats-item" style="margin-left: 10px;"><i class="fa-solid fa-message"></i> ${userStats.message_count}</div>
                                </div>
                            </div>
                            <div style="padding:15px; flex-grow:1; display:flex; flex-direction:column; justify-content:flex-start;">
                                <div style="font-weight:700; color:#fff; font-size:16px; margin-bottom:4px;">${escapeHTML(p.title || 'Başlıksız Konu')}</div>
                                <div style="font-size:12px; color:var(--text-muted);">@${p.author_email.split('@')[0]} · ${formatTime(p.created_at)}</div>
                                <div style="font-size: 14px; color: #a1a1aa; margin-top: 22px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(p.content)}</div>
                            </div>
                            <div style="text-align:center; min-width:70px; display:flex; flex-direction:column; align-items:center; justify-content:center; border-left:1px solid rgba(255,255,255,0.05);">
                                <div style="font-size:18px; color:var(--primary);"><i class="fa-regular fa-comments"></i></div>
                                <div style="font-size:12px; color:var(--text-muted); margin-top:5px;">${p.reply_count || 0}</div>
                                ${deleteBtnHtml}
                            </div>
                        </div>`;
                }
            });
            feed.innerHTML = html;
        }
        else if (currentViewMode === 'forum-detail') {
            const postMap = {};
            posts.forEach(p => postMap[p.id] = { ...p, children: [] });
            posts.forEach(p => {
                if (p.parent_id && postMap[p.parent_id]) postMap[p.parent_id].children.push(postMap[p.id]);
            });
            const topic = postMap[currentTopicId];
            if (!topic) { backToForum(); return; }

            let html = `
                <div style="max-width: 1000px; margin: 0 auto 20px auto; display:flex; align-items:center; gap:10px;">
                    <button onclick="backToForum()" class="action-btn" style="color:var(--text-muted); font-size:14px; background:rgba(255,255,255,0.05); padding:8px 16px; border-radius:8px;">
                        <i class="fa-solid fa-arrow-left"></i> Listeye Dön
                    </button>
                    <h3 style="margin:0; color:#fff; font-size:18px;">${escapeHTML(topic.title)}</h3>
                </div>`;
            
            html += renderSingleMessage(topic, false);
            html += `<div style="max-width: 1000px; margin: 30px auto 15px auto; border-bottom: 1px solid var(--border); padding-bottom: 10px; color: var(--primary); font-weight:600; font-size:14px;">YANITLAR (${topic.children.length})</div>`;
            
            if (topic.children.length > 0) {
                topic.children.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                topic.children.forEach(child => { html += buildPostHTML(child); });
            } else {
                html += `<div style="text-align:center; color:var(--text-muted); padding:20px; font-style:italic;">Henüz yanıt yok.</div>`;
            }

            html += `
                <div style="max-width: 1000px; margin: 30px auto 0 auto; background: #09090b; border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
                    <textarea id="detail-reply-input" class="form-input" placeholder="Düşüncelerini paylaş..." style="min-height:100px;"></textarea>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                        <div id="detail-char-count" class="char-counter">0 / 2000</div>
                        <button id="btn-detail-reply" onclick="sendDetailReply(${topic.id})" class="send-btn-modern" style="width:auto; padding:10px 24px;">Gönder</button>
                    </div>
                </div>`;
            feed.innerHTML = html;
        }
    } catch (e) { console.error("Yükleme Hatası:", e); }
}

const debouncedLoadMessages = debounce(loadMessages, 300);

// --- HTML İNŞA (BUILD) SİSTEMİ ---

function buildPostHTML(post) {
    let html = `<div class="message-wrapper">`;
    html += renderSingleMessage(post, true);

    if (post.children && post.children.length > 0) {
        post.children.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const isOpen = openRepliesSet.has(post.id);
        const count = post.children.length;
        
        html += `
        <div id="btn-${post.id}" class="view-replies-btn" data-count="${count}" onclick="toggleReplies(${post.id})">
            ${isOpen ? '<i class="fa-solid fa-chevron-up"></i> Yanıtları gizle' : `<i class="fa-solid fa-turn-up" style="transform: rotate(90deg);"></i> ${count} yanıtı gör`}
        </div>
        <div id="replies-${post.id}" class="replies-container ${isOpen ? 'show' : ''}">`;
        
        post.children.forEach(child => { 
            html += buildPostHTML(child); 
        });
        
        html += `</div>`;
    }
    html += `</div>`;
    return html;
}

function renderSingleMessage(p, showReplyBtn = true) {
    const initial = (p.author_email || 'A').charAt(0).toUpperCase();
    let rawName = p.author_email ? p.author_email.split('@')[0] : 'Anonim';
    const displayName = escapeHTML(rawName);
    const safeJsName = rawName.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const date = formatTime(p.created_at);
    
    const userStats = p.user_stats || { rank: 'member', message_count: 0, join_date: null };
    let joinDateYear = userStats.join_date ? new Date(userStats.join_date).getFullYear() : '2024';

    const replyBtn = showReplyBtn ? `<span class="action-btn action-reply" onclick="toggleReplyBox(${p.id}, '${safeJsName}')"><i class="fa-regular fa-comment"></i> Yanıtla</span>` : '';
    const editBtn = p.is_mine ? `<span class="action-btn action-edit" onclick="toggleEditMode(${p.id})"><i class="fa-solid fa-pen"></i> Düzenle</span>` : '';
    const deleteBtn = (p.is_mine || currentUserRank === 'admin') ? `<span class="action-btn action-delete" onclick="deletePost(${p.id})"><i class="fa-regular fa-trash-can"></i> Sil</span>` : '';
    
    let likeBtn = '';
    if (currentCategory !== 'general') {
        const likeIcon = p.is_liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
        likeBtn = `<span class="action-btn ${p.is_liked ? 'liked' : ''}" onclick="toggleLike(${p.id})"><i class="${likeIcon}"></i> ${p.like_count || 0}</span>`;
    }

    return `
    <div id="msg-${p.id}" class="message">
        <div class="msg-left">
            <div class="msg-avatar">${initial}</div>
            <div class="user-stats">
                <div class="user-rank ${userStats.rank}">${userStats.rank}</div>
                <div class="user-stats-item"><i class="fa-solid fa-message"></i> ${userStats.message_count}</div>
                <div class="user-stats-item"><i class="fa-solid fa-calendar"></i> ${joinDateYear}</div>
            </div>
        </div>
        <div class="msg-right">
            <div class="msg-header">
                <span class="msg-author">@${displayName}</span>
                <span class="msg-date">· ${date}</span>
            </div>
            <div class="msg-text">${escapeHTML(p.content)}</div>
            <div class="msg-actions">${likeBtn} ${replyBtn} ${editBtn} ${deleteBtn}</div>
        </div>
    </div>`;
}

// --- YANITLAMA VE DÜZENLEME SİSTEMİ ---

window.toggleReplyBox = function (id, authorName) {
    if (isGuest) { openAuthModal('login'); return; }
    if (activeReplyId === id) { closeReplyBox(); return; }
    if (activeReplyId !== null) closeReplyBox();

    activeReplyId = id;
    const messageEl = document.getElementById(`msg-${id}`).querySelector('.msg-right');
    const replyHTML = `
        <div id="inline-reply-${id}" class="inline-reply-area">
            <div style="font-size:12px; color:var(--primary); margin-bottom:5px;"><i class="fa-solid fa-share"></i> @${authorName} kullanıcısına yanıt veriyorsun</div>
            <textarea id="inline-input-${id}" class="form-input" placeholder="Yanıtınızı buraya yazınız..." maxlength="500" style="min-height:80px;"></textarea>
            <div class="inline-footer">
                <button onclick="closeReplyBox()" class="send-btn-modern" style="background:transparent; border:1px solid #555; width:auto; padding:8px 20px;">Vazgeç</button>
                <button id="btn-reply-${id}" onclick="submitInlineReply(${id})" class="send-btn-modern" style="width:auto; padding: 8px 20px;">Yanıtla</button>
            </div>
        </div>`;
    messageEl.insertAdjacentHTML('beforeend', replyHTML);
    document.getElementById(`inline-input-${id}`).focus();
};

window.closeReplyBox = function () {
    if (activeReplyId) {
        const box = document.getElementById(`inline-reply-${activeReplyId}`);
        if (box) box.remove();
        activeReplyId = null;
    }
};

window.submitInlineReply = async function (parentId) {
    const input = document.getElementById(`inline-input-${parentId}`);
    const content = input.value;
    if (!content.trim()) return;

    try {
        const res = await fetch(`${API_URL}/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content, parent_id: parentId, category: currentCategory }),
            credentials: 'include'
        });
        if (res.ok) {
            closeReplyBox();
            openRepliesSet.add(parseInt(parentId));
            lastPostsString = "";
            loadMessages();
        } else {
            const data = await res.json();
            alert(data.error || "Yanıt gönderilemedi.");
        }
    } catch (e) { alert("Bağlantı hatası."); }
};

window.toggleEditMode = function (id) {
    if (activeEditId && activeEditId !== id) cancelEdit(activeEditId);
    if (activeEditId === id) { cancelEdit(id); return; }

    activeEditId = id;
    const msgText = document.getElementById(`msg-${id}`).querySelector('.msg-text');
    const originalContent = unescapeHTML(msgText.innerHTML);
    msgText.style.display = 'none';

    const editHTML = `
        <div id="inline-edit-${id}" class="inline-edit-area">
            <textarea id="edit-input-${id}" class="form-input" style="min-height:80px;">${originalContent}</textarea>
            <div class="inline-footer">
                <button onclick="cancelEdit(${id})" class="send-btn-modern" style="background:transparent; border:1px solid #555;">Vazgeç</button>
                <button onclick="saveEdit(${id})" class="send-btn-modern">Kaydet</button>
            </div>
        </div>`;
    msgText.insertAdjacentHTML('afterend', editHTML);
};

window.cancelEdit = function (id) {
    const editBox = document.getElementById(`inline-edit-${id}`);
    if (editBox) editBox.remove();
    document.getElementById(`msg-${id}`).querySelector('.msg-text').style.display = 'block';
    activeEditId = null;
};

window.saveEdit = async function (id) {
    const content = document.getElementById(`edit-input-${id}`).value;
    if (!content.trim()) return;
    try {
        const res = await fetch(`${API_URL}/posts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content }),
            credentials: 'include'
        });
        if (res.ok) { cancelEdit(id); lastPostsString = ""; loadMessages(); }
    } catch (e) { alert("Güncellenemedi."); }
};

// --- DİĞER AKSİYONLAR VE MODALLAR ---

async function deletePost(id) {
    if (!confirm("Bu mesajı silmek istediğinize emin misiniz?")) return;
    try {
        const res = await fetch(`${API_URL}/posts/${id}`, { method: 'DELETE', credentials: 'include' });
        if (res.ok) { lastPostsString = ""; loadMessages(); }
    } catch (e) { alert("Silme işlemi başarısız."); }
}

async function toggleLike(id) {
    if (isGuest) { openAuthModal('login'); return; }
    try {
        const res = await fetch(`${API_URL}/posts/${id}/like`, { method: 'POST', credentials: 'include' });
        if (res.ok) { lastPostsString = ""; loadMessages(); }
    } catch (e) { console.error("Beğeni hatası:", e); }
}

window.toggleReplies = function (id) {
    const container = document.getElementById(`replies-${id}`);
    const btn = document.getElementById(`btn-${id}`);
    const count = btn.getAttribute('data-count');
    if (container.classList.contains('show')) {
        container.classList.remove('show');
        openRepliesSet.delete(id);
        btn.innerHTML = `<i class="fa-solid fa-turn-up" style="transform: rotate(90deg);"></i> ${count} yanıtı gör`;
    } else {
        container.classList.add('show');
        openRepliesSet.add(id);
        btn.innerHTML = `<i class="fa-solid fa-chevron-up"></i> Yanıtları gizle`;
    }
};

const mainSendBtn = document.getElementById('main-send-btn');
const mainInput = document.getElementById('main-chat-input');

if (mainSendBtn) {
    mainSendBtn.onclick = async () => {
        if (isGuest) { openAuthModal('login'); return; }
        const content = mainInput.value;
        if (!content.trim()) return;
        mainSendBtn.disabled = true;
        try {
            const res = await fetch(`${API_URL}/posts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: content, parent_id: null }),
                credentials: 'include'
            });
            if (res.ok) {
                mainInput.value = '';
                lastPostsString = "";
                loadMessages();
            }
        } catch (e) { alert("Gönderilemedi."); }
        mainSendBtn.disabled = false;
    };
}

window.openAuthModal = function (type) {
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('auth-title').textContent = (type === 'register') ? "Hesap Oluştur" : "Hoş Geldiniz";
};

window.closeAuthModal = function () { 
    document.getElementById('auth-screen').classList.remove('active'); 
};

document.getElementById('login-btn').onclick = () => handleAuth('login', 'login-btn');
document.getElementById('register-btn').onclick = () => handleAuth('register', 'register-btn');

document.getElementById('toggle-password').addEventListener('click', function () {
    const passInput = document.getElementById('password');
    const type = passInput.type === 'password' ? 'text' : 'password';
    passInput.type = type;
    this.classList.toggle('fa-eye');
    this.classList.toggle('fa-eye-slash');
});

function updateCharCount(textarea, displayId) {
    const display = document.getElementById(displayId);
    if (display) display.innerText = `${textarea.value.length} / ${textarea.maxLength}`;
}

// --- BAŞLANGIÇ YÜKLEMESİ ---

function handleInitialLoad() {
    const params = new URLSearchParams(window.location.search);
    const tId = params.get('topic');
    const cat = params.get('category');
    if (tId) viewTopic(tId, cat);
    else switchCategory(cat || 'general', null, false);
}

checkSession().then(handleInitialLoad);

window.addEventListener('popstate', function (event) {
    const params = new URLSearchParams(window.location.search);
    const tId = params.get('topic');
    const cat = params.get('category');
    if (tId) viewTopic(tId, cat || 'general', false);
    else switchCategory(cat || 'general', null, false);
});
