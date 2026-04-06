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

        // --- YETKILENDIMRE ---
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

        let pollInterval = null;
        window.addEventListener('load', () => {
            if (pollInterval) clearInterval(pollInterval);
            pollInterval = setInterval(debouncedLoadMessages, POLL_INTERVAL);
        });

        window.addEventListener('beforeunload', () => {
            if (pollInterval) clearInterval(pollInterval);
        });
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

            const emailRegex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

            if (!emailRegex.test(email)) {
                errEl.innerText = "Lütfen geçerli bir e-posta adresi formatı girin.";
                errEl.style.display = 'block';
                return;
            }

            // --- GÜVENLİK KONTROLÜ ---
            if (endpoint === 'register') {
                if (password.length < 8) {
                    errEl.innerText = "Şifre en az 8 karakter olmalıdır.";
                    errEl.style.display = 'block';
                    return;
                }
                if (!/[A-Z]/.test(password)) {
                    errEl.innerText = "Şifre en az 1 BÜYÜK harf içermelidir.";
                    errEl.style.display = 'block';
                    return;
                }
                if (!/[a-z]/.test(password)) {
                    errEl.innerText = "Şifre en az 1 küçük harf içermelidir.";
                    errEl.style.display = 'block';
                    return;
                }
                if (!/[^a-zA-Z0-9]/.test(password)) {
                    errEl.innerText = "Şifre en az 1 özel karakter (!, @, #, _ vb.) içermelidir.";
                    errEl.style.display = 'block';
                    return;
                }
            }
            // ----------------------------------------------

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
                        alert("Kayıt başarılı! E-postan adresine gönderilen aktivasyon bağlantısını onayladıktan sonra giriş yapabilirsiniz.");
                        document.getElementById('back-to-login-btn').click();
                    } else if (endpoint === 'login') {
                        checkSession();
                    } else {
                        alert("İşlem başarılı.");
                    }
                } else {
                    errEl.innerText = data.error || "Hata.";
                    errEl.style.display = 'block';
                }
            } catch (e) {
                errEl.innerText = "Sunucu hatası.";
                errEl.style.display = 'block';
            } finally {
                if (btn) btn.disabled = false;
            }
        }
        // --- KATEGORİ DEĞİŞTİRME ---
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
                const navItems = document.querySelectorAll('.nav-item');
                for (let btn of navItems) {
                    if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(category)) {
                        btn.classList.add('active');
                        break;
                    }
                }
            }

            currentViewMode = 'forum-detail';
            document.getElementById('general-compose-area').style.display = 'none';
            lastPostsString = "";

            // --- URL GÜNCELLEME ---
            if (pushHistory) {
                const newUrl = `${window.location.pathname}?category=${currentCategory}&topic=${id}`;
                window.history.pushState({ mode: 'topic', val: id, cat: currentCategory }, '', newUrl);
            }
            // --------------------------------------------------

            loadMessages();
        }

        function backToForum() {
            switchCategory(currentCategory, null, true);
        }

        // --- MESAJLARI ÇEKME ---
        async function loadMessages() {
            if (activeEditId || activeReplyId) return;
            const detailInput = document.getElementById('detail-reply-input');
            if (detailInput && detailInput.value.trim().length > 0) return;
            // -----------------------

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
                    feed.innerHTML = "<div style='text-align:center; color:#555; margin-top:50px;'>Henüz bu kategoride bir konu yok. İlkini sen aç! (+ Butonu)</div>";
                    return;
                }

                // GÖRÜNÜM 1: GENEL AKIŞ
                // script.js içindeki loadMessages fonksiyonunun içindeki 'chat' bloğunu bul ve bununla değiştir:
                if (currentViewMode === 'chat') {
                    const postMap = {};
                    // 1. Önce tüm postları Map'e ekle
                    posts.forEach(p => {
                        postMap[p.id] = { ...p, children: [] };
                    });
                
                    const roots = [];
                    posts.forEach(p => {
                        // parent_id varsa ebeveynine ekle, yoksa ana mesaj (root) yap
                        const pid = p.parent_id ? parseInt(p.parent_id) : null;
                        
                        if (pid && postMap[pid]) {
                            postMap[pid].children.push(postMap[p.id]);
                        } else if (!pid) {
                            roots.push(postMap[p.id]);
                        }
                    });
                
                    // Kök mesajları en yeni en üstte olacak şekilde sırala
                    roots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                
                    let html = roots.map(root => buildPostHTML(root)).join('');
                    feed.innerHTML = html || "<div style='text-align:center; padding:50px; color:gray;'>Henüz mesaj yok.</div>";
                }

                // GÖRÜNÜM 2: FORUM LİSTESİ
                else if (currentViewMode === 'forum-list') {
                    let html = '';
                    posts.forEach(p => {
                        if (!p.parent_id) {
                            const initial = (p.author_email || 'A').charAt(0).toUpperCase();
                            const userStats = p.user_stats || { rank: 'member', message_count: 0, join_date: null };

                            const rankText = {
                                'admin': 'Admin',
                                'moderator': 'Moderatör',
                                'member': 'Üye'
                            }[userStats.rank] || 'Üye';

                            let joinDate = 'Bilinmiyor';
                            if (userStats.join_date) {
                                try {
                                    const d = new Date(userStats.join_date);
                                    joinDate = d.toLocaleDateString('tr-TR', { year: 'numeric', month: 'short' });
                                } catch (e) { }
                            }

                            const canDelete = p.is_mine || (currentUserRank === 'admin');
                            const deleteBtnHtml = canDelete ?
                                `<div onclick="deletePost(${p.id}); event.stopPropagation();" 
                                  style="margin-top: 15px; color: #ef4444; font-size: 16px; cursor: pointer; transition: 0.2s;" 
                                  onmouseover="this.style.transform='scale(1.2)'" 
                                  onmouseout="this.style.transform='scale(1)'"
                                  title="Konuyu Sil">
                                <i class="fa-regular fa-trash-can"></i>
                             </div>` : '';

                            html += `
                        <div class="message" style="cursor:pointer; flex-direction:row; padding:0; align-items:stretch;" onclick="viewTopic(${p.id}, '${p.category}')">
                            
                            <div class="msg-left" style="width: 110px; padding: 15px 5px; border-right: 1px solid rgba(255,255,255,0.05); background: transparent; flex-shrink:0; display:flex; flex-direction:column; justify-content:center;">
                                <div class="msg-avatar" style="width:40px; height:40px; font-size:16px; margin-bottom:10px;">
                                    ${initial}
                                </div>
                                <div class="user-stats" style="border-top:none; padding-top:0;">
                                    <div class="user-rank ${userStats.rank}" style="margin-bottom:15px;">${rankText}</div>
                                    
                                    <div class="user-stats-item" style="margin-left: 10px;">
                                        <i class="fa-solid fa-message"></i> ${userStats.message_count}
                                    </div>
                                    
                                    <div class="user-stats-item" style="margin-left: 10px;">
                                        <i class="fa-solid fa-calendar-days"></i> ${joinDate}
                                    </div>
                                </div>
                            </div>

                            <div style="padding:15px; flex-grow:1; display:flex; flex-direction:column; justify-content:flex-start;">
                                <div style="font-weight:700; color:#fff; font-size:16px; margin-bottom:4px;">
                                    ${escapeHTML(p.title || 'Başlıksız Konu')}
                                </div>
                                <div style="font-size:12px; color:var(--text-muted);">
                                    @${p.author_email.split('@')[0]} · ${formatTime(p.created_at)}
                                </div>
                                
                                <div style="
                                    font-size: 14px; 
                                    color: #a1a1aa; 
                                    margin-top: 22px; 
                                    display: -webkit-box;
                                    -webkit-line-clamp: 2;
                                    -webkit-box-orient: vertical;
                                    overflow: hidden;
                                    text-overflow: ellipsis;
                                ">
                                    ${escapeHTML(p.content)}
                                </div>
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
                        if (p.parent_id && postMap[p.parent_id]) {
                            postMap[p.parent_id].children.push(postMap[p.id]);
                        }
                    });
                    const topic = postMap[currentTopicId];
                    if (!topic) { backToForum(); return; }

                    let html = '';

                    // --- A. GERİ DÖN BUTONU ---
                    html += `
                <div style="max-width: 1000px; margin: 0 auto 20px auto; display:flex; align-items:center; gap:10px;">
                    <button onclick="backToForum()" class="action-btn" style="color:var(--text-muted); font-size:14px; background:rgba(255,255,255,0.05); padding:8px 16px; border-radius:8px;">
                        <i class="fa-solid fa-arrow-left"></i> Listeye Dön
                    </button>
                    <h3 style="margin:0; color:#fff; font-size:18px;">${escapeHTML(topic.title)}</h3>
                </div>
            `;
                    // --- B. ANA KONU ---
                    html += renderSingleMessage(topic, false);

                    // --- C. YANITLAR BAŞLIĞI ---
                    const directRepliesCount = topic.children.length;

                    html += `
                <div style="max-width: 1000px; margin: 30px auto 15px auto; border-bottom: 1px solid var(--border); padding-bottom: 10px; color: var(--primary); font-weight:600; font-size:14px;">
                    <i class="fa-solid fa-turn-up" style="transform: rotate(90deg);"></i> YANITLAR (${directRepliesCount})
                </div>
            `;

                    // --- D. YANITLARI LİSTELE ---
                    if (directRepliesCount > 0) {
                        topic.children.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

                        topic.children.forEach(child => {
                            html += buildPostHTML(child);
                        });
                    } else {
                        html += `<div style="text-align:center; color:var(--text-muted); padding:20px; font-style:italic;">Henüz yanıt yok. İlk yanıtı sen yaz!</div>`;
                    }

                    // --- E. CEVAP YAZMA KUTUSU ---
                    const now = Date.now();
                    const remaining = Math.ceil((detailCooldownEnd - now) / 1000);

                    let btnAttr = '';
                    let btnContent = 'Yanıtla <i class="fa-solid fa-paper-plane"></i>';

                    if (remaining > 0) {
                        btnAttr = 'disabled';
                        btnContent = `Bekle (${remaining})`;
                        startDetailButtonTicker();
                    }

                    html += `
                <div style="max-width: 1000px; margin: 30px auto 0 auto; background: #09090b; border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
                    <div style="margin-bottom:10px; font-size:14px; font-weight:600; color:#fff;">Bu konuya yanıt ver:</div>
                    
                    <textarea id="detail-reply-input" class="form-input" 
                        placeholder="Düşüncelerini paylaş..." 
                        style="min-height:100px; resize:vertical; background: #18181b; border-color: rgba(255,255,255,0.1);"
                        maxlength="2000"
                        oninput="updateCharCount(this, 'detail-char-count')"
                        onkeydown="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendDetailReply(${topic.id}); }"></textarea>
                    
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
                        <div id="detail-char-count" class="char-counter">0 / 2000</div>
                        
                        <button id="btn-detail-reply" onclick="sendDetailReply(${topic.id})" class="send-btn-modern" style="width:auto; padding:10px 24px;" ${btnAttr}>
                            ${btnContent}
                        </button>
                    </div>
                </div>
                <div style="height: 50px;"></div>
            `;

                    feed.innerHTML = html;
                }
            }
            catch (e) {
                const feed = document.getElementById('chat-feed');
                feed.innerHTML = `
                    <div style="text-align:center; color:var(--danger); padding:50px; background:rgba(239, 68, 68, 0.05); border-radius:10px; margin-top:20px;">
                        <i class="fa-solid fa-triangle-exclamation fa-lg"></i><br><br>
                        <strong>KRİTİK HATA!</strong> Sunucuya ulaşılamıyor veya bağlantı koptu.<br>
                        Lütfen internet bağlantınızı kontrol edin ve sayfayı yenileyin.
                    </div>
                `;
                console.error("Bağlantı/Sunucu Hatası:", e);
            }
        }

        const debouncedLoadMessages = debounce(loadMessages, 300);

        // --- YENİ KONU MODAL ---
        function openNewTopicModal() {
            document.getElementById('topic-title').value = '';
            document.getElementById('topic-content').value = '';
            document.getElementById('topic-category').selectedIndex = 0;
            document.getElementById('char-count-display').innerText = "0 / 2000";
            document.getElementById('char-count-display').className = "char-counter";

            document.getElementById('new-topic-modal').classList.add('active');
        }

        function closeNewTopicModal() {
            document.getElementById('new-topic-modal').classList.remove('active');
        }

        async function submitNewTopic() {
            const category = document.getElementById('topic-category').value;
            const title = document.getElementById('topic-title').value;
            const content = document.getElementById('topic-content').value;

            if (!title || !content) { alert("Başlık ve içerik gerekli!"); return; }

            try {
                const res = await fetch(`${API_URL}/posts`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, content, category, parent_id: null }),
                    credentials: 'include'
                });

                if (res.ok) {
                    closeNewTopicModal();
                    switchCategory(category, null);
                } else {
                    const data = await res.json();
                    alert(data.error || "Hata oluştu");
                }
            } catch (e) { alert("Bağlantı hatası"); }
        }
        function buildPostHTML(post) {
            let html = `<div class="message-wrapper">`;
            html += renderSingleMessage(post, true); // Ana mesajı bas
        
            function buildPostHTML(post) {
                    let html = `<div class="message-wrapper">`;
                    html += renderSingleMessage(post, true); // Ana mesaj
                
                    if (post.children && post.children.length > 0) {
                        // Yanıtları tarihe göre (eskiden yeniye) sırala
                        post.children.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                        
                        const isOpen = openRepliesSet.has(post.id);
                        const count = post.children.length;
                        
                        html += `
                        <div id="btn-${post.id}" class="view-replies-btn" data-count="${count}" onclick="toggleReplies(${post.id})">
                            ${isOpen ? '<i class="fa-solid fa-chevron-up"></i> Yanıtları gizle' : `<i class="fa-solid fa-turn-up" style="transform: rotate(90deg);"></i> ${count} yanıtı gör`}
                        </div>
                        <div id="replies-${post.id}" class="replies-container ${isOpen ? 'show' : ''}">`;
                        
                        // Özyineleme: Çocukların içindeki çocukları da bas
                        post.children.forEach(child => { 
                            html += buildPostHTML(child); 
                        });
                        
                        html += `</div>`;
                    }
                    html += `</div>`;
                    return html;
                }
        // --- MESAJ KUTUSU TASARIMI ---">
        function renderSingleMessage(p, showReplyBtn = true) {
            const initial = (p.author_email || 'A').charAt(0).toUpperCase();

            let rawName = p.author_email ? p.author_email.split('@')[0] : 'Anonim';
            const displayName = escapeHTML(rawName);
            const safeJsName = rawName.replace(/'/g, "\\'").replace(/"/g, '&quot;');

            const date = formatTime(p.created_at);
            let editedHtml = "";
            if (p.updated_at && p.updated_at !== p.created_at) {
                editedHtml = `<span class="msg-edited">(düzenlendi: ${formatTime(p.updated_at)})</span>`;
            }

            const userStats = p.user_stats || { rank: 'member', message_count: 0, join_date: null };
            const rankText = { 'admin': 'Admin', 'moderator': 'Moderatör', 'member': 'Üye' }[userStats.rank] || 'Üye';

            let joinDate = 'Bilinmiyor';
            if (userStats.join_date) {
                try { joinDate = new Date(userStats.join_date).toLocaleDateString('tr-TR', { year: 'numeric', month: 'short' }); } catch (e) { }
            }

            const replyBtn = showReplyBtn
                ? `<span class="action-btn action-reply" onclick="toggleReplyBox(${p.id}, '${safeJsName}')"><i class="fa-regular fa-comment"></i> Yanıtla</span>`
                : '';

            let interactBtns = '';
            if (currentCategory !== 'general') {
                const isLiked = p.is_liked;
                const likeClass = isLiked ? 'liked' : '';
                const likeIcon = isLiked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
                const displayCount = p.like_count || 0;
                interactBtns = `
            <span id="like-btn-${p.id}" class="action-btn ${likeClass}" onclick="toggleLike(${p.id})">
                <i class="${likeIcon}"></i> <span id="like-count-${p.id}" style="margin-left:3px;">${displayCount}</span>
            </span>
        `;
            }

            const isAdmin = currentUserRank === 'admin';
            let banBtn = '';
            if (isAdmin && !p.is_mine) {
                const isBanned = p.author_is_banned;
                const btnText = isBanned ? "Banı Aç" : "Banla";
                const btnColor = isBanned ? "#10b981" : "#ef4444";
                const btnIcon = isBanned ? "fa-lock-open" : "fa-gavel";
                banBtn = `<span class="action-btn" style="color: ${btnColor}; border-color: ${btnColor};" onclick="banUser(${p.author_id}, '${safeJsName}')"><i class="fa-solid ${btnIcon}"></i> ${btnText}</span>`;
            }

            const canDelete = p.is_mine || isAdmin;
            const deleteBtn = canDelete ? `<span class="action-btn action-delete" onclick="deletePost(${p.id})"><i class="fa-regular fa-trash-can"></i> Sil</span>` : '';
            const editBtn = p.is_mine ? `<span class="action-btn action-edit" onclick="toggleEditMode(${p.id})"><i class="fa-solid fa-pen"></i> Düzenle</span>` : '';

            return `
    <div id="msg-${p.id}" class="message"> 
        <div class="msg-left">
            <div class="msg-avatar">${initial}</div>
            <div class="user-stats">
                <div class="user-rank ${userStats.rank}" style="margin-bottom: 15px;">${rankText}</div>
                <div class="user-stats-item" style="margin-left: 10px;">
                    <i class="fa-solid fa-message"></i> <span>${userStats.message_count} mesaj</span>
                </div>
                <div class="user-stats-item" style="margin-left: 10px;">
                    <i class="fa-solid fa-calendar-days"></i> <span>${joinDate}</span>
                </div>
            </div>
        </div>
        <div class="msg-right">
            <div class="msg-header">
                <span class="msg-author">@${displayName}</span>
                <span class="msg-date">· ${date} ${editedHtml}</span>
            </div>
            <div class="msg-text">${escapeHTML(p.content)}</div>
            
            <div class="msg-actions">
                ${interactBtns} 
                ${replyBtn} 
                ${editBtn} 
                ${deleteBtn} 
                ${banBtn}
            </div>
        </div>
    </div>`;
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
        }

        // --- GÖNDERME İŞLEMİ ---
        const mainInput = document.getElementById('main-chat-input');
        const mainSendBtn = document.getElementById('main-send-btn');
        let cooldownInterval = null;

        mainInput.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = (this.style.scrollHeight) + 'px';
        });

        mainInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!mainSendBtn.disabled) mainSendBtn.click();
            }
        });

        mainSendBtn.onclick = async () => {
            if (isGuest) { window.openAuthModal('login'); return; }

            const content = mainInput.value;
            if (!content.trim()) return;

            mainSendBtn.disabled = true;
            mainSendBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

            try {
                const res = await fetch(`${API_URL}/posts`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: content, parent_id: null }),
                    credentials: 'include'
                });

                if (res.ok) {

                    mainInput.value = '';
                    mainInput.style.height = 'auto';

                    lastMessageTime = Date.now();
                    lastPostsString = "";
                    loadMessages();

                    if (currentUserRank !== 'admin') {
                        startButtonCooldown(3);
                    } else {
                        resetButton();
                    }

                } else {
                    alert("Hata oluştu.");
                    resetButton();
                }
            } catch (e) {
                alert("Bağlantı hatası.");
                resetButton();
            }
        }

        function startButtonCooldown(seconds) {
            let counter = seconds;
            mainSendBtn.disabled = true;
            mainSendBtn.innerText = `Bekle (${counter})`;

            if (cooldownInterval) clearInterval(cooldownInterval);

            cooldownInterval = setInterval(() => {
                counter--;
                if (counter > 0) {
                    mainSendBtn.innerText = `Bekle (${counter})`;
                } else {
                    clearInterval(cooldownInterval);
                    resetButton();
                }
            }, 1000);
        }

        function resetButton() {
            mainSendBtn.disabled = false;
            mainSendBtn.innerHTML = 'Paylaş <i class="fa-solid fa-paper-plane"></i>';
        }

        // --- DİĞER FONKSİYONLAR ---
        window.openAuthModal = function (type) {
            document.getElementById('auth-screen').classList.add('active');
            document.getElementById('login-view').classList.remove('hidden');
            document.getElementById('forgot-view').classList.add('hidden');
            document.getElementById('auth-title').textContent = (type === 'register') ? "Hesap Oluştur" : "Hoş Geldiniz";
        }
        window.closeAuthModal = function () { document.getElementById('auth-screen').classList.remove('active'); }
        document.getElementById('show-forgot-btn').onclick = () => {
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('forgot-view').classList.remove('hidden');
        };
        document.getElementById('back-to-login-btn').onclick = () => {
            document.getElementById('forgot-view').classList.add('hidden');
            document.getElementById('login-view').classList.remove('hidden');
        };
        document.getElementById('login-btn').onclick = () => handleAuth('login', 'login-btn');
        document.getElementById('register-btn').onclick = () => handleAuth('register', 'register-btn');
        document.getElementById('logout-btn').onclick = async () => { await fetch(`${API_URL}/logout`, { method: 'POST', credentials: 'include' }); location.reload(); };

        async function deletePost(id) {
            try {
                const res = await fetch(`${API_URL}/posts/${id}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });

                if (res.ok) {
                    lastPostsString = "";
                    debouncedLoadMessages();
                }
            } catch (e) {
                alert("Hata.");
            }
        }

        const formatTime = (dateStr) => {
            let date = new Date(dateStr); date.setHours(date.getHours() + 3);
            const now = new Date(); const diff = (now - date) / 1000;
            if (diff < 60) return "Şimdi";
            if (diff < 3600) return Math.floor(diff / 60) + "dk";
            if (diff < 86400) return Math.floor(diff / 3600) + "sa";
            return date.toLocaleDateString('tr-TR');
        };
        const escapeHTML = (str) => str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
        const unescapeHTML = (str) => str.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');

        checkSession().then(() => {
            handleInitialLoad();
        });

        // --- YENİ: SATIR İÇİ YANIT SİSTEMİ ---
        let activeReplyId = null;

        window.toggleReplyBox = function (id, authorName) {
            if (isGuest) { window.openAuthModal('login'); return; }
            if (activeReplyId === id) { closeReplyBox(); return; }
            if (activeReplyId !== null) { closeReplyBox(); }

            activeReplyId = id;
            const messageEl = document.getElementById(`msg-${id}`).querySelector('.msg-right');

            const replyHTML = `
                <div id="inline-reply-${id}" class="inline-reply-area">
                    <div style="font-size:12px; color:var(--primary); margin-bottom:5px;">
                        <i class="fa-solid fa-share"></i> @${authorName} kullanıcısına yanıt veriyorsun
                    </div>
                    
                    <textarea id="inline-input-${id}" class="form-input" 
                        placeholder="Yanıtını buraya yaz..." 
                        maxlength="500" 
                        style="min-height:80px; resize:none; overflow-y:auto;"
                        onkeydown="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submitInlineReply(${id}); }"></textarea>
                    
                    <div class="inline-footer">
                        <button onclick="closeReplyBox()" class="send-btn-modern" style="background:transparent; border:1px solid #555; width:auto; padding: 8px 20px;">Vazgeç</button>
                        <button id="btn-reply-${id}" onclick="submitInlineReply(${id})" class="send-btn-modern" style="width:auto; padding: 8px 20px;">Yanıtla</button>
                    </div>
                </div>
            `;
            messageEl.insertAdjacentHTML('beforeend', replyHTML);
            const textarea = document.getElementById(`inline-input-${id}`);
            textarea.focus();
            checkCooldownState(id);
        }

        window.closeReplyBox = function () {
            if (activeReplyId) {
                const box = document.getElementById(`inline-reply-${activeReplyId}`);
                if (box) box.remove();
                activeReplyId = null;
            }
        }

        window.submitInlineReply = async function (parentId) {
            const input = document.getElementById(`inline-input-${parentId}`);
            const btn = document.getElementById(`btn-reply-${parentId}`);
            const content = input.value;
        
            if (!content.trim()) return;
            btn.disabled = true; 
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        
            try {
                const res = await fetch(`${API_URL}/posts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        content: content, 
                        parent_id: parentId, // Kimin altına yazılıyor
                        category: currentCategory 
                    }),
                    credentials: 'include'
                });
                
                if (res.ok) {
                    closeReplyBox();
                    openRepliesSet.add(parseInt(parentId)); // Yanıt verince otomatik açılsın
                    lastPostsString = ""; // Listeyi yenilemeye zorla
                    loadMessages();
                    startGlobalReplyCooldown();
                } else {
                    const d = await res.json();
                    alert(d.error || "Hata oluştu.");
                    btn.disabled = false; btn.innerText = "Yanıtla";
                }
            } catch (e) {
                alert("Bağlantı hatası.");
                btn.disabled = false; btn.innerText = "Yanıtla";
            }
        }

        let activeEditId = null;

        window.toggleEditMode = function (id) {
            if (activeEditId && activeEditId !== id) { cancelEdit(activeEditId); }
            if (activeEditId === id) { cancelEdit(id); return; }

            activeEditId = id;
            const msgRight = document.getElementById(`msg-${id}`).querySelector('.msg-right');
            const msgText = msgRight.querySelector('.msg-text');
            const originalContent = unescapeHTML(msgText.innerHTML);

            msgText.style.display = 'none';

            const editHTML = `
                <div id="inline-edit-${id}" class="inline-edit-area">
                    <textarea id="edit-input-${id}" class="form-input" maxlength="500" style="min-height:80px; resize:none; overflow-y:auto;">${originalContent}</textarea>
                    <div class="inline-footer">
                        <button onclick="cancelEdit(${id})" class="send-btn-modern" style="background:transparent; border:1px solid #555; width:auto; padding: 8px 20px;">Vazgeç</button>
                        <button onclick="saveEdit(${id})" class="send-btn-modern" style="width:auto; padding: 8px 20px;">Kaydet</button>
                    </div>
                </div>
            `;
            msgText.insertAdjacentHTML('afterend', editHTML);
        }

        window.cancelEdit = function (id) {
            const editBox = document.getElementById(`inline-edit-${id}`);
            if (editBox) editBox.remove();

            const msgText = document.getElementById(`msg-${id}`).querySelector('.msg-right .msg-text');
            if (msgText) msgText.style.display = 'block';

            activeEditId = null;
        }

        window.saveEdit = async function (id) {
            const content = document.getElementById(`edit-input-${id}`).value;
            if (!content.trim()) return;

            try {
                await fetch(`${API_URL}/posts/${id}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content }), credentials: 'include'
                });

                cancelEdit(id);
                lastPostsString = "";
                debouncedLoadMessages();
            } catch (e) { alert("Hata"); }
        }

        // --- COOLDOWN YÖNETİMİ ---
        let globalCooldownEnd = 0;
        function startGlobalReplyCooldown() { globalCooldownEnd = Date.now() + 3000; }
        function checkCooldownState(id) {
            const remaining = Math.ceil((globalCooldownEnd - Date.now()) / 1000);
            if (remaining > 0) {
                const btn = document.getElementById(`btn-reply-${id}`);
                if (!btn) return;
                btn.disabled = true; btn.innerText = `Bekle (${remaining})`;
                const interval = setInterval(() => {
                    const newRem = Math.ceil((globalCooldownEnd - Date.now()) / 1000);
                    if (newRem <= 0) {
                        clearInterval(interval);
                        btn.disabled = false; btn.innerText = "Yanıtla";
                    } else {
                        btn.innerText = `Bekle (${newRem})`;
                    }
                }, 1000);
            }
        }
        async function banUser(userId, username) {
            if (!confirm(`@${username} kullanıcısının durumunu değiştirmek istiyor musun?`)) return;

            try {
                const res = await fetch(`${API_URL}/users/${userId}/ban`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include'
                });
                const data = await res.json();

                if (res.ok) {
                    lastPostsString = "";
                    loadMessages();
                    if (document.getElementById('user-list-modal').classList.contains('active')) {
                        loadAllUsers();
                    }
                } else {
                    alert("Hata: " + data.error);
                }
            } catch (e) {
                alert("Bağlantı hatası.");
            }
        }
        function openUserListModal() {
            document.getElementById('user-list-modal').classList.add('active');
            loadAllUsers();
        }

        function closeUserListModal() {
            document.getElementById('user-list-modal').classList.remove('active');
        }

        async function loadAllUsers() {
            const tbody = document.getElementById('user-list-body');
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Yükleniyor...</td></tr>';

            try {
                const res = await fetch(`${API_URL}/users`, { credentials: 'include' });
                if (!res.ok) throw new Error("Yetkisiz");
                const users = await res.json();

                tbody.innerHTML = '';
                users.forEach(u => {
                    const isBanned = u.is_banned;
                    const statusBadge = isBanned
                        ? '<span style="background:#ef4444; padding:2px 6px; border-radius:4px; font-size:10px; color:white;">BANLI</span>'
                        : '<span style="color:#10b981;">Aktif</span>';

                    const btnText = isBanned ? "Banı Aç" : "Banla";
                    const btnClass = isBanned ? "success" : "danger";
                    const btnStyle = isBanned
                        ? "background:rgba(16, 185, 129, 0.2); color:#10b981; border:1px solid #10b981;"
                        : "background:rgba(239, 68, 68, 0.2); color:#ef4444; border:1px solid #ef4444;";

                    const actionButton = (u.rank === 'admin')
                        ? '<span style="font-size:10px; opacity:0.5;">İşlem Yok</span>'
                        : `<button onclick="banUser(${u.id}, '${u.username}')" 
                    style="${btnStyle} cursor:pointer; padding:4px 8px; border-radius:4px; font-weight:600; font-size:11px;">
                    ${btnText}
                   </button>`;

                    const row = `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 12px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div class="avatar" style="width:30px; height:30px; font-size:12px;">${u.username.charAt(0).toUpperCase()}</div>
                            <span>${u.username}</span>
                        </div>
                    </td>
                    <td style="padding: 12px;"><span class="user-rank ${u.rank}">${u.rank}</span></td>
                    <td style="padding: 12px;">${statusBadge}</td>
                    <td style="padding: 12px; text-align:right;">${actionButton}</td>
                </tr>
            `;
                    tbody.innerHTML += row;
                });

            } catch (e) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Hata oluştu.</td></tr>';
            }
        }
        function updateCharCount(textarea) {
            const maxLength = textarea.getAttribute('maxlength');
            const currentLength = textarea.value.length;
            const counterEl = document.getElementById('char-count-display');

            counterEl.innerText = `${currentLength} / ${maxLength}`;

            if (currentLength >= maxLength) {
                counterEl.classList.add('limit-reached');
            } else if (currentLength >= maxLength * 0.9) {
                counterEl.classList.add('limit-near');
                counterEl.classList.remove('limit-reached');
            } else {
                counterEl.classList.remove('limit-near', 'limit-reached');
            }
        }
        // --- RATE LIMIT ---
        let detailCooldownInterval = null;

        function startDetailButtonCooldown(seconds) {
            const btn = document.getElementById('btn-detail-reply');
            if (!btn) return;

            let counter = seconds;
            btn.disabled = true;
            btn.innerHTML = `Bekle (${counter})`;

            if (detailCooldownInterval) clearInterval(detailCooldownInterval);

            detailCooldownInterval = setInterval(() => {
                counter--;
                if (counter > 0) {
                    btn.innerHTML = `Bekle (${counter})`;
                } else {
                    clearInterval(detailCooldownInterval);
                    btn.disabled = false;
                    btn.innerHTML = 'Yanıtla <i class="fa-solid fa-paper-plane"></i>';
                }
            }, 1000);
        }
        // --- KONU YANITLAMA FONKSİYONU ---
        async function sendDetailReply(topicId) {
            if (isGuest) { window.openAuthModal('login'); return; }

            const input = document.getElementById('detail-reply-input');
            const btn = document.getElementById('btn-detail-reply');
            const content = input.value;

            if (!content.trim()) return;

            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

            try {
                const res = await fetch(`${API_URL}/posts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: content,
                        parent_id: topicId,
                        category: currentCategory
                    }),
                    credentials: 'include'
                });

                if (res.ok) {
                    input.value = '';

                    if (currentUserRank !== 'admin') {
                        detailCooldownEnd = Date.now() + 3000;
                        startDetailButtonTicker();
                    }

                    lastPostsString = "";
                    loadMessages();
                } else {
                    const data = await res.json();
                    alert(data.error || "Hata oluştu.");
                    btn.disabled = false;
                    btn.innerHTML = 'Yanıtla <i class="fa-solid fa-paper-plane"></i>';
                }
            } catch (e) {
                alert("Bağlantı hatası.");
                btn.disabled = false;
                btn.innerHTML = 'Yanıtla <i class="fa-solid fa-paper-plane"></i>';
            }
            if (input) input.focus();
        }

        // --- CANLI SAYAÇ FONKSİYONU ---
        function startDetailButtonTicker() {
            if (detailTimerInterval) clearInterval(detailTimerInterval);

            detailTimerInterval = setInterval(() => {
                const btn = document.getElementById('btn-detail-reply');
                if (!btn) return;

                const now = Date.now();
                const remaining = Math.ceil((detailCooldownEnd - now) / 1000);

                if (remaining > 0) {
                    btn.disabled = true;
                    btn.innerHTML = `Bekle (${remaining})`;
                } else {
                    btn.disabled = false;
                    btn.innerHTML = 'Yanıtla <i class="fa-solid fa-paper-plane"></i>';
                    clearInterval(detailTimerInterval);
                }
            }, 1000);
        }

        // --- BEĞENİ VE KAYDETME SİSTEMİ ---
        async function toggleLike(id) {
            if (isGuest) { window.openAuthModal('login'); return; }

            const btn = document.getElementById(`like-btn-${id}`);
            const icon = btn.querySelector('i');
            const countSpan = document.getElementById(`like-count-${id}`);
            const isLiked = btn.classList.contains('liked');
            let currentCount = parseInt(countSpan.innerText);

            if (isLiked) {
                btn.classList.remove('liked');
                icon.className = 'fa-regular fa-heart';
                countSpan.innerText = Math.max(0, currentCount - 1);
            } else {
                btn.classList.add('liked');
                icon.className = 'fa-solid fa-heart';
                countSpan.innerText = currentCount + 1;
            }

            try {
                const res = await fetch(`${API_URL}/posts/${id}/like`, {
                    method: 'POST', credentials: 'include'
                });

                if (res.ok) {
                    const data = await res.json();
                    countSpan.innerText = data.like_count;

                } else {
                    console.error("Beğeni işlemi başarısız");
                }
            } catch (e) {
                console.error("Bağlantı hatası", e);
            }
        }


        // --- KARAKTER SAYACI ---
        function updateCharCount(textarea, displayId) {
            const maxLength = textarea.getAttribute('maxlength');
            const currentLength = textarea.value.length;
            const counterEl = document.getElementById(displayId);

            if (!counterEl) return;

            counterEl.innerText = `${currentLength} / ${maxLength}`;

            if (currentLength >= maxLength) {
                counterEl.classList.add('limit-reached');
                counterEl.classList.remove('limit-near');
            } else if (currentLength >= maxLength * 0.9) {
                counterEl.classList.add('limit-near');
                counterEl.classList.remove('limit-reached');
            } else {
                counterEl.classList.remove('limit-near', 'limit-reached');
            }
        }

        function handleInitialLoad() {
            const params = new URLSearchParams(window.location.search);
            const topicId = params.get('topic');
            const category = params.get('category');

            if (topicId && category) {
                viewTopic(topicId, category, false);
            } else if (category) {
                switchCategory(category, null, false);
            } else {
                switchCategory('general', null, false);
            }
        }

        // --- TARAYICI GEÇMİŞİ VE URL YÖNETİMİ ---

        window.addEventListener('popstate', function (event) {
            const params = new URLSearchParams(window.location.search);
            const topicId = params.get('topic');
            const category = params.get('category');

            if (topicId) {
                viewTopic(topicId, category || 'general', false);
            } else {
                switchCategory(category || 'general', null, false);
            }
        });

        document.getElementById('toggle-password').addEventListener('click', function () {
            const icon = this;
            const passwordInput = document.getElementById('password');
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            icon.classList.toggle('fa-eye');
            icon.classList.toggle('fa-eye-slash');
            passwordInput.focus();
        });
