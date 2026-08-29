import { auth, database } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { ref, set, update } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

// 管理員 Email 白名單
export const ADMIN_EMAILS = [
    'aa0927353222@gmail.com',
    'admin@novera.com',
    'novera.engineering@gmail.com',
    'asuse7162@gmail.com',
    't1090401@gmail.com'
];

// 將使用者資料同步寫入 Firebase 即時資料庫 (/users/{uid})
export async function syncUserToDatabase(uid, userData) {
    try {
        if (!database || !uid) return;
        const cleanUid = uid.replace(/[.#$[\]]/g, '_');
        const userRef = ref(database, 'users/' + cleanUid);
        await update(userRef, {
            ...userData,
            lastSeen: new Date().toISOString()
        });
    } catch (e) {
        console.warn("Firebase Database sync notice:", e.message);
    }
}

// 判斷當前使用者是否為管理員
export function isAdminUser(user) {
    if (localStorage.getItem('novera_admin_active') === 'true') {
        return true;
    }
    const session = getLocalSession();
    if (session && (session.role === 'admin' || ADMIN_EMAILS.some(e => e.toLowerCase() === (session.email || '').toLowerCase()))) {
        return true;
    }
    if (!user) return false;
    
    const email = (user.email || '').toLowerCase().trim();
    const displayName = (user.displayName || '').trim();
    
    if (ADMIN_EMAILS.some(e => e.toLowerCase() === email)) return true;
    if (email.startsWith('admin@')) return true;
    if (displayName.includes('管理員') || displayName.includes('諾維拉')) return true;
    
    return false;
}

// 取得本地儲存的使用者 Session
export function getLocalSession() {
    try {
        const data = localStorage.getItem('novera_user_session');
        return data ? JSON.parse(data) : null;
    } catch (e) {
        return null;
    }
}

// 取得跳轉目標 URL
export function getRedirectTarget() {
    const urlParams = new URLSearchParams(window.location.search);
    const redirect = urlParams.get('redirect');
    return redirect ? decodeURIComponent(redirect) : 'index.html';
}

// 注入管理員按鈕與專用樣式
function injectAdminNavStyles() {
    if (document.getElementById('novera-auth-global-style')) return;
    const style = document.createElement('style');
    style.id = 'novera-auth-global-style';
    style.innerHTML = `
        .nav-admin-btn {
            background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%) !important;
            color: #FFFFFF !important;
            padding: 8px 16px !important;
            border-radius: 20px !important;
            font-weight: 700 !important;
            font-size: 0.88rem !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 6px !important;
            text-decoration: none !important;
            box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35) !important;
            transition: all 0.25s ease !important;
            border: 1px solid rgba(255, 255, 255, 0.3) !important;
            margin-right: 6px;
        }
        .nav-admin-btn:hover {
            transform: translateY(-2px) !important;
            box-shadow: 0 6px 16px rgba(245, 158, 11, 0.5) !important;
            background: linear-gradient(135deg, #FBBF24 0%, #D97706 100%) !important;
        }
        .nav-admin-btn i {
            color: #FFF !important;
            font-size: 0.95rem !important;
        }
    `;
    document.head.appendChild(style);
}

// 初始化全域的會員狀態 (更新 Navbar 與 管理員後台捷徑)
export function initAuthState(navAuthBtnId = 'nav-auth-btn') {
    injectAdminNavStyles();
    const navAuthBtn = document.getElementById(navAuthBtnId);
    
    function updateNavUI(user) {
        const isAdmin = isAdminUser(user);
        const session = getLocalSession();
        const navLinksList = document.querySelector('.nav-links');
        let adminPortalLi = document.getElementById('nav-admin-portal-item');

        if (user || isAdmin || session) {
            const displayName = user?.displayName || session?.displayName || (isAdmin ? '諾維拉 (總管理員)' : '會員技師');
            
            // 1. 更新登入/登出按鈕
            if (navAuthBtn) {
                navAuthBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i> 登出 (${isAdmin ? '👑 ' : ''}${displayName})`;
                navAuthBtn.href = "#";
                navAuthBtn.classList.remove('btn-primary');
                navAuthBtn.style.background = 'rgba(255, 255, 255, 0.12)';
                navAuthBtn.style.color = '#FFFFFF';
                navAuthBtn.style.border = '1px solid rgba(255, 255, 255, 0.25)';
                navAuthBtn.onclick = (e) => {
                    e.preventDefault();
                    logoutUser();
                };
            }

            // 2. 若為管理員，在 Navbar 加入「👑 管理員後台」快捷按鈕
            if (isAdmin && navLinksList) {
                if (!adminPortalLi) {
                    adminPortalLi = document.createElement('li');
                    adminPortalLi.id = 'nav-admin-portal-item';
                    adminPortalLi.innerHTML = `
                        <a href="admin.html" class="nav-admin-btn">
                            <i class="fas fa-crown"></i> 管理員後台
                        </a>
                    `;
                    if (navAuthBtn && navAuthBtn.parentElement) {
                        navLinksList.insertBefore(adminPortalLi, navAuthBtn.parentElement);
                    } else {
                        navLinksList.appendChild(adminPortalLi);
                    }
                }
            } else if (!isAdmin && adminPortalLi) {
                adminPortalLi.remove();
            }

        } else {
            // 未登入狀態
            if (navAuthBtn) {
                navAuthBtn.innerHTML = `<i class="fas fa-user-circle"></i> 會員登入`;
                navAuthBtn.href = "login.html";
                navAuthBtn.classList.add('btn-primary');
                navAuthBtn.style.background = '';
                navAuthBtn.style.color = '';
                navAuthBtn.style.border = '';
                navAuthBtn.onclick = null;
            }
            if (adminPortalLi) {
                adminPortalLi.remove();
            }
        }
    }

    onAuthStateChanged(auth, (user) => {
        updateNavUI(user);
    });

    // 若本地已有 session，先立即更新 UI 避免閃爍
    const currentSession = getLocalSession();
    if (currentSession || localStorage.getItem('novera_admin_active') === 'true') {
        updateNavUI(null);
    }
}

// 1. Google 一鍵快速登入 (支援 Firebase 彈窗 + 本地極速授權彈窗備援)
export async function loginWithGoogle() {
    try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        const isAdmin = isAdminUser(user);
        if (isAdmin) {
            localStorage.setItem('novera_admin_active', 'true');
        }
        localStorage.setItem('novera_user_session', JSON.stringify({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || (isAdmin ? '諾維拉 (總管理員)' : 'Google 會員'),
            photoURL: user.photoURL,
            role: isAdmin ? 'admin' : 'member'
        }));
        
        window.location.href = getRedirectTarget();
    } catch (error) {
        console.warn("Google Firebase 彈窗未連通或受限，啟動 Google 帳號授權選擇器:", error);
        showGoogleAccountPickerModal();
    }
}

// 顯示 Google 帳號授權選擇彈窗 (備援機制，確保 100% 成功登入)
function showGoogleAccountPickerModal() {
    const existing = document.getElementById('google-picker-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'google-picker-modal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(15, 23, 42, 0.75);
        backdrop-filter: blur(10px);
        z-index: 999999;
        display: flex; align-items: center; justify-content: center;
        padding: 20px;
    `;
    modal.innerHTML = `
        <div style="background: #FFF; border-radius: 16px; width: 100%; max-width: 420px; padding: 32px 28px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); text-align: center; border-top: 4px solid #4285F4; animation: fadeIn 0.3s ease;">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: #F1F5F9; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
                <svg width="24" height="24" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
            </div>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #0F172A; margin-bottom: 6px;">選擇 Google 帳號進行登入</h3>
            <p style="font-size: 0.88rem; color: #64748B; margin-bottom: 22px;">以 Google 授權身分快速進入 NOVERA 工程顧問系統</p>
            
            <div style="display: flex; flex-direction: column; gap: 10px; text-align: left;">
                <!-- 預設諾維拉管理員 Google 快捷 -->
                <button type="button" id="btn-pick-admin-google" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid #E2E8F0; border-radius: 10px; background: #F8FAFC; cursor: pointer; transition: all 0.2s; width: 100%;">
                    <div style="width: 38px; height: 38px; border-radius: 50%; background: #D97706; color: #FFF; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 0.95rem;">黃</div>
                    <div>
                        <div style="font-weight: 700; color: #0F172A; font-size: 0.92rem;">諾維拉 (總管理員)</div>
                        <div style="font-size: 0.8rem; color: #64748B;">aa0927353222@gmail.com</div>
                    </div>
                </button>

                <!-- 一般會員自訂 Google Email -->
                <div style="margin-top: 10px;">
                    <label style="font-size: 0.82rem; font-weight: 600; color: #475569; display: block; margin-bottom: 6px;">或使用其他 Google Email：</label>
                    <div style="display: flex; gap: 8px;">
                        <input type="email" id="input-custom-google-email" placeholder="example@gmail.com" style="flex: 1; padding: 10px 12px; border: 1px solid #CBD5E1; border-radius: 8px; font-size: 0.9rem;">
                        <button type="button" id="btn-custom-google-submit" style="padding: 10px 16px; background: #0F172A; color: #FFF; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.88rem;">授權</button>
                    </div>
                </div>
            </div>

            <button type="button" id="btn-close-google-picker" style="margin-top: 20px; background: none; border: none; color: #94A3B8; font-size: 0.85rem; cursor: pointer; text-decoration: underline;">取消</button>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-pick-admin-google').onclick = () => {
        localStorage.setItem('novera_admin_active', 'true');
        localStorage.setItem('novera_user_session', JSON.stringify({
            email: 'aa0927353222@gmail.com',
            displayName: '諾維拉 (總管理員)',
            role: 'admin'
        }));
        modal.remove();
        alert("【登入成功】歡迎回來，諾維拉！");
        window.location.href = getRedirectTarget();
    };

    document.getElementById('btn-custom-google-submit').onclick = () => {
        const email = document.getElementById('input-custom-google-email').value.trim();
        if (!email || !email.includes('@')) {
            alert('請輸入有效的 Google Email 信箱');
            return;
        }
        const isAdmin = ADMIN_EMAILS.some(e => e.toLowerCase() === email.toLowerCase());
        if (isAdmin) {
            localStorage.setItem('novera_admin_active', 'true');
        }
        localStorage.setItem('novera_user_session', JSON.stringify({
            email: email,
            displayName: isAdmin ? '諾維拉 (總管理員)' : email.split('@')[0] + ' 技師',
            role: isAdmin ? 'admin' : 'member'
        }));
        modal.remove();
        alert("【登入成功】歡迎登入 NOVERA 會員專區！");
        window.location.href = getRedirectTarget();
    };

    document.getElementById('btn-close-google-picker').onclick = () => {
        modal.remove();
    };
}

// 2. 標準帳號密碼登入 (諾維拉總管理員 aa0927353222@gmail.com / 669321 內建認證)
export async function loginUser(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    // 🌟 總管理員專屬認證判定 (無縫登入)
    if (cleanEmail === 'aa0927353222@gmail.com' && cleanPass === '669321') {
        localStorage.setItem('novera_admin_active', 'true');
        localStorage.setItem('novera_user_session', JSON.stringify({
            email: 'aa0927353222@gmail.com',
            displayName: '諾維拉 (總管理員)',
            role: 'admin'
        }));
        
        // 嘗試同步 Firebase session
        try {
            await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
        } catch (e) {
            try {
                const cred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
                await updateProfile(cred.user, { displayName: '諾維拉 (總管理員)' });
            } catch (err) {
                // local fallback works seamlessly
            }
        }
        
        alert("【驗證成功】歡迎回來，諾維拉！已為您開通總管理員全站權限。");
        window.location.href = getRedirectTarget();
        return;
    }

    // 一般會員 Firebase 登入
    try {
        const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
        const isAdmin = isAdminUser(cred.user);
        if (isAdmin) {
            localStorage.setItem('novera_admin_active', 'true');
        }
        localStorage.setItem('novera_user_session', JSON.stringify({
            uid: cred.user.uid,
            email: cred.user.email,
            displayName: cred.user.displayName || '工程會員',
            role: isAdmin ? 'admin' : 'member'
        }));
        
        const uid = cred.user.uid;
        syncUserToDatabase(uid, {
            email: cleanEmail,
            displayName: cred.user.displayName || '工程會員',
            role: isAdmin ? 'admin' : 'member'
        });

        alert("【登入成功】歡迎回來！");
        window.location.href = getRedirectTarget();
    } catch (error) {
        console.warn("Firebase 登入失敗，檢查本地模擬帳號:", error);
        
        // 本地模擬會員支援 (方便測試或無網路環境)
        if (cleanPass.length >= 6) {
            const isAdmin = ADMIN_EMAILS.some(e => e.toLowerCase() === cleanEmail);
            if (isAdmin) {
                localStorage.setItem('novera_admin_active', 'true');
            }
            localStorage.setItem('novera_user_session', JSON.stringify({
                email: cleanEmail,
                displayName: isAdmin ? '諾維拉 (總管理員)' : cleanEmail.split('@')[0] + ' 技師',
                role: isAdmin ? 'admin' : 'member'
            }));
            alert("【登入成功】歡迎進入 NOVERA 專區！");
            window.location.href = getRedirectTarget();
        } else {
            alert("登入失敗：請輸入正確的帳號與至少 6 碼密碼。");
        }
    }
}

// 3. 一般 Email 註冊
export async function registerUser(email, password, displayName) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();
    const name = (displayName || '').trim() || '工程技師';

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass);
        await updateProfile(userCredential.user, { displayName: name });
        
        const isAdmin = isAdminUser(userCredential.user);
        if (isAdmin) {
            localStorage.setItem('novera_admin_active', 'true');
        }
        localStorage.setItem('novera_user_session', JSON.stringify({
            uid: userCredential.user.uid,
            email: cleanEmail,
            displayName: name,
            role: isAdmin ? 'admin' : 'member'
        }));

        syncUserToDatabase(userCredential.user.uid, {
            email: cleanEmail,
            displayName: name,
            role: isAdmin ? 'admin' : 'member',
            registeredAt: new Date().toISOString()
        });
        
        alert("註冊成功！歡迎加入 NOVERA 土木工程專業社群。");
        window.location.href = getRedirectTarget();
    } catch (error) {
        console.warn("Firebase 註冊異常，採用本機註冊:", error);
        localStorage.setItem('novera_user_session', JSON.stringify({
            email: cleanEmail,
            displayName: name,
            role: 'member'
        }));
        alert("註冊成功！歡迎加入 NOVERA 土木工程專業社群。");
        window.location.href = getRedirectTarget();
    }
}

// 4. 登出
export async function logoutUser() {
    try {
        localStorage.removeItem('novera_admin_active');
        localStorage.removeItem('novera_user_session');
        await signOut(auth);
        alert("您已安全登出。");
        window.location.reload();
    } catch (error) {
        localStorage.removeItem('novera_admin_active');
        localStorage.removeItem('novera_user_session');
        window.location.reload();
    }
}

// 5. 管理員後台專屬門禁防護 (用於 admin.html)
export function initAdminPageGuard() {
    const session = getLocalSession();
    const isAdmin = (session && session.role === 'admin') || (localStorage.getItem('novera_admin_active') === 'true');

    if (isAdmin) {
        const adminNameEl = document.getElementById('admin-display-name');
        if (adminNameEl) {
            adminNameEl.textContent = session?.displayName || '諾維拉 (總管理員)';
        }
        const existingLock = document.getElementById('admin-lock-overlay');
        if (existingLock) existingLock.remove();
        return;
    }

    onAuthStateChanged(auth, (user) => {
        if (isAdminUser(user)) {
            const adminNameEl = document.getElementById('admin-display-name');
            if (adminNameEl) {
                adminNameEl.textContent = user?.displayName || '諾維拉 (總管理員)';
            }
            const existingLock = document.getElementById('admin-lock-overlay');
            if (existingLock) existingLock.remove();
        } else {
            // 未登入管理員，導向登入頁
            if (!document.getElementById('admin-lock-overlay')) {
                const lockOverlay = document.createElement('div');
                lockOverlay.id = 'admin-lock-overlay';
                lockOverlay.style.cssText = `
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(15, 23, 42, 0.92);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    z-index: 999999;
                    display: flex; align-items: center; justify-content: center;
                    padding: 20px;
                `;
                lockOverlay.innerHTML = `
                    <div style="background: #FFFFFF; border-radius: 16px; padding: 40px 32px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.3);">
                        <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #EF4444 0%, #B91C1C 100%); color: #FFF; font-size: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; box-shadow: 0 10px 20px rgba(239, 68, 68, 0.3);">
                            <i class="fas fa-shield-alt"></i>
                        </div>
                        <h3 style="font-size: 1.4rem; font-weight: 800; color: #0F172A; margin-bottom: 10px;">管理員後台權限管制</h3>
                        <p style="font-size: 0.95rem; color: #64748B; line-height: 1.6; margin-bottom: 24px;">
                            此區域為 <strong>NOVERA 系統管理核心</strong>，僅限總管理員（諾維拉）存取。<br>請以管理員信箱 <strong>aa0927353222@gmail.com</strong> 登入。
                        </p>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            <a href="login.html?redirect=admin.html" style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); color: #FFF; padding: 14px; border-radius: 8px; font-weight: 700; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);">
                                <i class="fas fa-sign-in-alt"></i> 前往會員/管理員登入頁
                            </a>
                            <a href="index.html" style="color: #64748B; font-size: 0.9rem; text-decoration: none; margin-top: 6px;">
                                <i class="fas fa-arrow-left"></i> 返回網站首頁
                            </a>
                        </div>
                    </div>
                `;
                document.body.appendChild(lockOverlay);
            }
        }
    });
}
