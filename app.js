/**
 * FSFS Professional Core Application Logic - V2 (Stable)
 */

console.log('🚀 FSFS Pro Core Initializing...');

// 1. GLOBAL STATE
window.state = {
    currentUser: null,
    isAuthChecked: false,
    socket: null,
    onlineUsers: [],
    lastTypingTime: 0
};
const state = window.state;

// Configuration
if (!window.AppConfig) {
    window.AppConfig = {
        apiUrl: 'http://localhost:5000/api',
        socketUrl: 'http://localhost:5000'
    };
}

const PROTECTED_PAGES = ['chat', 'forum', 'reels', 'profile', 'post', 'graffiti'];

// 2. INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
    // Ensure we have a toast element
    if (!document.getElementById('toast')) {
        const t = document.createElement('div');
        t.id = 'toast';
        t.className = 'toast';
        t.innerHTML = '<span class="toast-message"></span>';
        document.body.appendChild(t);
    }

    await checkAuth();
    initGlobalUI();
    initAppFeatures();
});

// 3. AUTHENTICATION LOGIC
async function checkAuth() {
    const token = localStorage.getItem('fsfs_token');
    console.log('🔍 Checking session...');

    if (!token) {
        console.log('ℹ️ No token found');
        state.currentUser = null;
        state.isAuthChecked = true;
        updateUIBasedOnAuth();
        handlePageProtection();
        return;
    }

    try {
        const res = await fetch(`${AppConfig.apiUrl}/auth/me`, {
            headers: { 'Authorization': token }
        });

        if (res.ok) {
            const user = await res.json();
            console.log('✅ Session valid:', user.username);
            state.currentUser = user;
            initSocket(token);
        } else {
            console.warn('⚠️ Session expired');
            localStorage.removeItem('fsfs_token');
            state.currentUser = null;
        }
    } catch (err) {
        console.error('❌ Auth Check Error:', err);
    } finally {
        state.isAuthChecked = true;
        updateUIBasedOnAuth();
        handlePageProtection();
    }
}

function handlePageProtection() {
    const path = window.location.pathname.toLowerCase();
    const isProtected = PROTECTED_PAGES.some(p => path.includes(p));

    if (isProtected && !state.currentUser && state.isAuthChecked) {
        console.log('🛡️ Page protected, redirecting to login...');
        window.location.href = 'login.html';
    }
}

async function initAuthForms() {
    const loginForm = document.getElementById('actualLoginForm');
    const registerForm = document.getElementById('actualRegisterForm');

    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const btn = document.getElementById('logSubmitBtn');
            const email = document.getElementById('logEmail').value.trim();
            const password = document.getElementById('logPass').value;

            btn.disabled = true; btn.innerHTML = 'جاري التحقق... ⏳';

            try {
                const res = await fetch(`${AppConfig.apiUrl}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.msg || 'بيانات الدخول غير صحيحة');

                localStorage.setItem('fsfs_token', data.token);
                showToast('✅ تم تسجيل الدخول بنجاح!');
                setTimeout(() => window.location.href = 'index.html', 1000);
            } catch (err) {
                showToast('❌ ' + err.message);
                btn.disabled = false; btn.innerHTML = 'تسجيل الدخول 🚀';
            }
        };
    }

    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const btn = document.getElementById('regSubmitBtn');
            const username = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPass').value;

            btn.disabled = true; btn.innerHTML = 'جاري إنشاء الحساب... ⏳';

            try {
                const res = await fetch(`${AppConfig.apiUrl}/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.msg || 'فشل إنشاء الحساب');

                localStorage.setItem('fsfs_token', data.token);
                showToast('🎉 تهانينا! تم إنشاء الحساب');
                setTimeout(() => window.location.href = 'index.html', 1000);
            } catch (err) {
                showToast('❌ ' + err.message);
                btn.disabled = false; btn.innerHTML = 'إنشاء حساب 🎉';
            }
        };
    }
}

// 4. SOCKET LOGIC
function initSocket(token) {
    if (state.socket) return;
    console.log('🔌 Initializing Realtime Connection...');

    state.socket = io(AppConfig.socketUrl, {
        auth: { token: token }
    });

    state.socket.on('connect', () => {
        console.log('📡 Connected to Server');
        state.socket.emit('join_chat');
    });

    state.socket.on('receive_message', (msg) => {
        if (window.location.pathname.includes('chat')) {
            appendMessage(msg);
        }
        if (state.currentUser && msg.user_id !== state.currentUser.id) playNotificationSound();
    });

    state.socket.on('radio_updated', (data) => {
        if (window.location.pathname.includes('chat')) {
            syncRadio(data);
        }
    });

    state.socket.on('user_typing', (data) => {
        if (state.currentUser && data.userId !== state.currentUser.id) {
            showTypingIndicator(data.username);
        }
    });

    state.socket.on('user_buzz', (data) => {
        if (state.currentUser && data.userId !== state.currentUser.id) {
            triggerBuzzEffect(false);
        }
    });
}

// 5. UI UPDATES
function updateUIBasedOnAuth() {
    const navActions = document.querySelector('.nav-actions');
    const mobileLinkContainer = document.querySelector('.mobile-nav-links');
    const navLinkContainer = document.querySelector('.nav-links');

    if (navActions) {
        if (state.currentUser) {
            navActions.innerHTML = `
                <div class="user-pill glass">
                    <img src="${state.currentUser.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + state.currentUser.username}" class="nav-avatar">
                    <span class="nav-username">${state.currentUser.username}</span>
                </div>
                <button onclick="logout()" class="btn btn-ghost btn-sm">خروج</button>
            `;
        } else {
            navActions.innerHTML = `
                <a href="login.html" class="btn btn-ghost">دخول</a>
                <a href="register.html" class="btn btn-primary">انضم إلينا</a>
            `;
        }
    }

    // Hide/Show links based on auth
    [mobileLinkContainer, navLinkContainer].forEach(container => {
        if (!container) return;
        container.querySelectorAll('li').forEach(li => {
            const link = li.querySelector('a');
            if (!link) return;
            const href = link.getAttribute('href').toLowerCase();
            const isProtected = PROTECTED_PAGES.some(p => href.includes(p));

            if (isProtected && !state.currentUser) {
                li.style.display = 'none';
            } else {
                li.style.display = 'block';
            }
        });
    });
}

function initGlobalUI() {
    // Mobile Menu
    const mBtn = document.getElementById('mobileMenuBtn');
    const mMenu = document.getElementById('mobileMenu');
    if (mBtn && mMenu) {
        mBtn.onclick = () => {
            mMenu.classList.toggle('active');
            mBtn.classList.toggle('active');
        };
    }

    initAuthForms();
}

// 6. FEATURE SPECIFIC LOGIC
function initAppFeatures() {
    const path = window.location.pathname.toLowerCase();
    console.log('🚀 Routing page features for:', path);

    if (path.includes('chat')) initChatPage();
    if (path.includes('forum')) initForumPage();
    if (path.includes('reels')) initReelsPage();
    if (path.includes('post.html')) initSinglePostPage();
    if (path.includes('profile')) initProfilePage();
    if (path.includes('graffiti')) initGraffitiPage();
}

// --- CHAT PAGE ---
function initChatPage() {
    console.log('💬 Initializing Chat...');
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    const buzzBtn = document.getElementById('buzzBtn');

    if (sendBtn) sendBtn.onclick = sendMessage;
    if (messageInput) {
        messageInput.onkeypress = (e) => e.key === 'Enter' && sendMessage();
        messageInput.oninput = () => {
            if (Date.now() - state.lastTypingTime > 3000) {
                if (state.socket) state.socket.emit('typing');
                state.lastTypingTime = Date.now();
            }
        };
    }

    if (buzzBtn) buzzBtn.onclick = () => {
        if (state.socket) {
            state.socket.emit('send_buzz');
            triggerBuzzEffect(true);
        }
    };

    initRadio();
    loadInitialChat();
}

async function loadInitialChat() {
    // We don't have a messages GET route yet, but we could add one if wanted.
    // For now, let's just make sure chat is ready.
    console.log('📜 Chat history loading (via socket or sync)...');
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content || !state.currentUser || !state.socket) return;

    state.socket.emit('send_message', {
        content: content
    });
    input.value = '';
}

function appendMessage(msg) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const isMe = state.currentUser && msg.user_id === state.currentUser.id;
    const div = document.createElement('div');
    div.className = `message ${isMe ? 'message-self' : 'message-other'}`;

    div.innerHTML = `
        <div class="message-avatar">
            <img src="${msg.avatar || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + msg.username}" style="width:100%;height:100%;border-radius:50%">
        </div>
        <div class="message-content">
            ${isMe ? '' : `<span class="message-author">${escapeHtml(msg.username)}</span>`}
            <p>${escapeHtml(msg.content)}</p>
            <span class="message-time">${new Date(msg.created_at || Date.now()).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// --- RADIO ---
function initRadio() {
    const loadBtn = document.getElementById('radioLoad');
    const urlInput = document.getElementById('radioUrl');
    const toggleBtn = document.getElementById('radioToggle');
    const widget = document.getElementById('radioWidget');
    const minimizeBtn = document.getElementById('radioMinimize');

    if (toggleBtn) toggleBtn.onclick = () => widget.classList.toggle('active');
    if (minimizeBtn) minimizeBtn.onclick = () => widget.classList.remove('active');

    if (loadBtn) {
        loadBtn.onclick = () => {
            const url = urlInput.value.trim();
            const vidId = url.match(/(?:\?v=|\/embed\/|\/watch\?v=|youtu\.be\/|\/v\/|\/e\/|watch\?v%3D|watch\?feature=player_embedded&v=|%2Fvideos%2F|embed%\?v=|^)([a-zA-Z0-9_-]{11})/)?.[1];
            if (vidId && state.socket) {
                state.socket.emit('update_radio', { youtube_id: vidId });
                showToast('📻 جاري تحديث الراديو للجميع...');
            } else {
                showToast('❌ رابط غير صالح أو غير مسجل دخول');
            }
        };
    }

    // Load initial state
    fetch(`${AppConfig.apiUrl}/radio/state`)
        .then(r => r.json())
        .then(data => syncRadio(data))
        .catch(e => console.error('Radio State Error:', e));
}

function syncRadio(data) {
    const player = document.getElementById('youtubePlayer');
    if (!player || !data.youtube_id) return;

    player.innerHTML = `<iframe width="1" height="1" src="https://www.youtube.com/embed/${data.youtube_id}?autoplay=1&enablejsapi=1" frameborder="0" allow="autoplay; encrypted-media"></iframe>`;

    // Animate bars
    document.querySelectorAll('.bar').forEach(b => b.style.animationPlayState = 'running');
}

// --- FORUM ---
async function initForumPage() {
    const container = document.getElementById('forumPosts');
    if (!container) return;

    console.log('📢 Loading Forum...');
    container.innerHTML = '<div class="loader">جاري تحميل المواضيع... 🦋</div>';

    try {
        const res = await fetch(`${AppConfig.apiUrl}/forum/posts`);
        const posts = await res.json();

        container.innerHTML = posts.length ? '' : '<p class="text-center" style="grid-column: 1/-1; padding: 50px;">لا توجد مواضيع حالياً. كن أول من ينشر!</p>';
        posts.forEach(p => {
            const el = document.createElement('article');
            el.className = 'post-card glass';
            el.innerHTML = `
                <div class="post-content" onclick="window.location.href='post.html?id=${p.id}'" style="cursor:pointer">
                    <div class="post-header">
                        <span class="post-category">${p.category}</span>
                        <span class="post-author">${escapeHtml(p.username)}</span>
                    </div>
                    <h3>${escapeHtml(p.title)}</h3>
                    <p>${escapeHtml(p.content.substring(0, 150))}...</p>
                    <div class="post-footer">
                        <span>🗓️ ${new Date(p.created_at).toLocaleDateString('ar-EG')}</span>
                    </div>
                </div>
            `;
            container.appendChild(el);
        });
    } catch (err) {
        container.innerHTML = '<p class="text-center" style="grid-column: 1/-1;">❌ فشل تحميل المواضيع</p>';
    }

    initNewPostForm();
}

function initNewPostForm() {
    const form = document.getElementById('newPostForm');
    const modal = document.getElementById('newPostModal');
    const newPostBtn = document.getElementById('newPostBtn');
    const closeBtn = document.getElementById('closePostModal');

    if (newPostBtn) newPostBtn.onclick = () => modal.classList.add('active');
    if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;

            const postData = {
                title: document.getElementById('postTitle').value,
                category: document.getElementById('postCategory').value,
                content: document.getElementById('postContent').value
            };

            try {
                const res = await fetch(`${AppConfig.apiUrl}/forum/posts`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': localStorage.getItem('fsfs_token')
                    },
                    body: JSON.stringify(postData)
                });

                if (!res.ok) throw new Error('فشل النشر');
                showToast('🚀 تم نشر الموضوع!');
                modal.classList.remove('active');
                form.reset();
                initForumPage(); // reload
            } catch (err) {
                showToast('❌ ' + err.message);
            } finally {
                btn.disabled = false;
            }
        };
    }
}

// --- REELS ---
async function initReelsPage() {
    const container = document.getElementById('reelsGrid');
    if (!container) return;

    console.log('🎬 Loading Reels...');
    try {
        const res = await fetch(`${AppConfig.apiUrl}/reels`);
        const reels = await res.json();

        container.innerHTML = reels.length ? '' : '<p class="text-center" style="grid-column: 1/-1; padding: 50px;">لا توجد ريلزات حالياً</p>';
        reels.forEach(r => {
            const vidId = r.url.match(/reel\/([^\/\?]+)/)?.[1] || r.url.match(/p\/([^\/\?]+)/)?.[1];
            const el = document.createElement('div');
            el.className = 'reel-card glass';
            el.innerHTML = `
                <div class="reel-video">
                    ${vidId ? `<iframe src="https://www.instagram.com/reel/${vidId}/embed" frameborder="0" scrolling="no" allowtransparency="true" style="width:100%;height:450px;border-radius:12px;"></iframe>` : `<p>رابط غير مدعوم</p>`}
                </div>
                <div class="reel-info">
                    <span class="reel-username">@${escapeHtml(r.username)}</span>
                    <p class="reel-caption">${escapeHtml(r.caption)}</p>
                </div>
            `;
            container.appendChild(el);
        });
    } catch (err) { }

    initShareReelForm();
}

function initShareReelForm() {
    const form = document.getElementById('shareReelForm');
    const modal = document.getElementById('shareReelModal');
    const btn = document.getElementById('shareReelBtn');
    if (btn) btn.onclick = () => modal.classList.add('active');

    const closeBtn = document.getElementById('closeReelModal');
    if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');

    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const url = document.getElementById('reelUrl').value;
            const caption = document.getElementById('reelCaption').value;

            try {
                const res = await fetch(`${AppConfig.apiUrl}/reels`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': localStorage.getItem('fsfs_token')
                    },
                    body: JSON.stringify({ url, caption })
                });
                if (!res.ok) throw new Error('فشل المشاركة');
                showToast('🎬 تم مشاركة الريلز!');
                modal.classList.remove('active');
                form.reset();
                initReelsPage();
            } catch (err) { showToast('❌ ' + err.message); }
        };
    }
}

// 7. HELPERS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.querySelector('.toast-message').textContent = message;
    toast.classList.add('active');
    setTimeout(() => toast.classList.remove('active'), 3000);
}

function logout() {
    localStorage.removeItem('fsfs_token');
    window.location.href = 'index.html';
}
window.logout = logout;

function playNotificationSound() {
    const audio = document.getElementById('msgSound');
    if (audio) audio.play().catch(() => { });
}

function showTypingIndicator(username) {
    const el = document.getElementById('typingIndicator');
    if (!el) return;
    el.style.display = 'flex';
    el.querySelector('.typing-text').textContent = `${username} يكتب الآن...`;
    clearTimeout(window.typingTimer);
    window.typingTimer = setTimeout(() => el.style.display = 'none', 3000);
}

function triggerBuzzEffect(isMe) {
    if (!isMe) {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1204/1204-preview.mp3');
        audio.play().catch(() => { });
    }
    document.body.classList.add('shake-effect');
    setTimeout(() => document.body.classList.remove('shake-effect'), 1000);
}

// --- PROFILE PAGE ---
async function initProfilePage() {
    console.log('👤 Loading Profile...');
    try {
        const res = await fetch(`${AppConfig.apiUrl}/profile`, {
            headers: { 'Authorization': localStorage.getItem('fsfs_token') }
        });
        const profile = await res.json();

        const nameEl = document.getElementById('profileUsername');
        const emailEl = document.getElementById('profileEmail');
        const avatarEl = document.getElementById('profileAvatar');
        const countPostsEl = document.getElementById('countPosts');
        const countCommentsEl = document.getElementById('countComments');

        if (nameEl) nameEl.textContent = profile.username;
        if (emailEl) emailEl.textContent = profile.email;
        if (avatarEl) avatarEl.src = profile.avatar;
        if (countPostsEl) countPostsEl.textContent = profile.stats.posts;
        if (countCommentsEl) countCommentsEl.textContent = profile.stats.comments;

        const editForm = document.getElementById('editProfileForm');
        if (editForm) {
            document.getElementById('editUsername').value = profile.username;
            document.getElementById('editAvatar').value = profile.avatar;
            editForm.onsubmit = async (e) => {
                e.preventDefault();
                const updateRes = await fetch(`${AppConfig.apiUrl}/profile`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': localStorage.getItem('fsfs_token')
                    },
                    body: JSON.stringify({
                        username: document.getElementById('editUsername').value,
                        avatar: document.getElementById('editAvatar').value
                    })
                });
                if (updateRes.ok) {
                    showToast('✅ تم تحديث الملف الشخصي');
                    location.reload();
                }
            };
        }
    } catch (err) { }
}

// --- SINGLE POST PAGE ---
async function initSinglePostPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('id');
    if (!postId) return;

    try {
        const postRes = await fetch(`${AppConfig.apiUrl}/forum/posts/${postId}`);
        const post = await postRes.json();
        const contentBox = document.getElementById('singlePostContent');
        if (contentBox) {
            contentBox.innerHTML = `
                <div class="post-full glass" style="padding:20px; border-radius:15px; margin-bottom:20px;">
                    <div class="post-header" style="display:flex; gap:10px; margin-bottom:15px;">
                        <img src="${post.avatar}" style="width:40px;height:40px;border-radius:50%">
                        <div>
                            <div style="font-weight:bold">${escapeHtml(post.username)}</div>
                            <div style="font-size:0.8rem; color:var(--text-muted)">${new Date(post.created_at).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <h1 style="margin-bottom:15px;">${escapeHtml(post.title)}</h1>
                    <div style="white-space:pre-wrap;">${escapeHtml(post.content)}</div>
                </div>
            `;
        }
        loadComments(postId);
        const commentForm = document.getElementById('addCommentForm');
        if (commentForm) {
            commentForm.onsubmit = async (e) => {
                e.preventDefault();
                const content = document.getElementById('commentContent').value.trim();
                const res = await fetch(`${AppConfig.apiUrl}/forum/posts/${postId}/comments`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': localStorage.getItem('fsfs_token')
                    },
                    body: JSON.stringify({ content })
                });
                if (res.ok) {
                    document.getElementById('commentContent').value = '';
                    loadComments(postId);
                    showToast('✅ تم إضافة التعليق');
                }
            };
        }
    } catch (err) { }
}

async function loadComments(postId) {
    const list = document.getElementById('postCommentsList');
    if (!list) return;
    const res = await fetch(`${AppConfig.apiUrl}/forum/posts/${postId}/comments`);
    const comments = await res.json();
    list.innerHTML = comments.map(c => `
        <div class="comment-card glass" style="padding:15px; border-radius:10px; margin-bottom:10px;">
            <div style="display:flex; gap:10px; margin-bottom:5px; align-items:center;">
                <img src="${c.avatar}" style="width:30px;height:30px;border-radius:50%">
                <span style="font-weight:bold">${escapeHtml(c.username)}</span>
            </div>
            <p>${escapeHtml(c.content)}</p>
        </div>
    `).join('');
}

// --- GRAFFITI PAGE ---
function initGraffitiPage() {
    const canvas = document.getElementById('graffitiCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let isDrawing = false, lastX = 0, lastY = 0, color = '#ef4444';

    function resize() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width; canvas.height = rect.height;
    }
    window.onresize = resize; resize();

    if (state.socket) {
        state.socket.emit('join_graffiti');
        state.socket.on('draw', (data) => {
            drawLocal(data.x1 * canvas.width, data.y1 * canvas.height, data.x2 * canvas.width, data.y2 * canvas.height, data.color);
        });
        state.socket.on('clear_graffiti', () => ctx.clearRect(0, 0, canvas.width, canvas.height));
    }

    canvas.onmousedown = (e) => { isDrawing = true;[lastX, lastY] = [e.offsetX, e.offsetY]; };
    canvas.onmouseup = () => isDrawing = false;
    canvas.onmousemove = (e) => {
        if (!isDrawing || !state.socket) return;
        drawLocal(lastX, lastY, e.offsetX, e.offsetY, color);
        state.socket.emit('draw', { x1: lastX / canvas.width, y1: lastY / canvas.height, x2: e.offsetX / canvas.width, y2: e.offsetY / canvas.height, color });
        [lastX, lastY] = [e.offsetX, e.offsetY];
    };

    function drawLocal(x1, y1, x2, y2, c) {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = c; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke();
    }

    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.onclick = () => { color = dot.dataset.color; document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active')); dot.classList.add('active'); };
    });
    const clr = document.getElementById('clearBtn');
    if (clr) clr.onclick = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); state.socket.emit('clear_graffiti'); };
}
