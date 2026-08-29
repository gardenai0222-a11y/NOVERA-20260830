// js/chat.js
import { database, auth } from './firebase-config.js';
import { ref, push, onChildAdded, onChildRemoved, remove, set, onValue, serverTimestamp, onDisconnect } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";

const chatRef = ref(database, 'messages');
const ADMIN_EMAIL = 'gardenai0222@gmail.com';
let currentUser = null;

export function initChat(chatBoxId, inputId, sendBtnId) {
    const chatBox = document.getElementById(chatBoxId);
    const input = document.getElementById(inputId);
    const sendBtn = document.getElementById(sendBtnId);

    // 監聽在線名單
    const presenceListRef = ref(database, 'presence');
    const onlineUsersList = document.getElementById('online-users-list');
    const onlineCount = document.getElementById('online-count');

    if (onlineUsersList && onlineCount) {
        onValue(presenceListRef, (snapshot) => {
            onlineUsersList.innerHTML = '';
            let count = 0;
            snapshot.forEach((childSnapshot) => {
                const userData = childSnapshot.val();
                count++;
                
                const li = document.createElement('li');
                li.classList.add('online-user-item');
                
                const dot = document.createElement('span');
                dot.classList.add('status-dot');
                
                const nameSpan = document.createElement('span');
                nameSpan.classList.add('user-name');
                nameSpan.textContent = userData.name;
                
                li.appendChild(dot);
                li.appendChild(nameSpan);
                
                if (userData.email === ADMIN_EMAIL) {
                    const adminBadge = document.createElement('span');
                    adminBadge.classList.add('admin-badge');
                    adminBadge.textContent = '管理員';
                    li.appendChild(adminBadge);
                }
                
                onlineUsersList.appendChild(li);
            });
            onlineCount.textContent = count;
        });
    }

    // 檢查登入與封鎖狀態
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            
            // 處理 Presence (在線狀態)
            const myPresenceRef = ref(database, `presence/${user.uid}`);
            const connectedRef = ref(database, '.info/connected');
            
            onValue(connectedRef, (snap) => {
                if (snap.val() === true) {
                    // 當斷線時自動移除
                    onDisconnect(myPresenceRef).remove().then(() => {
                        // 寫入在線狀態
                        set(myPresenceRef, {
                            name: user.displayName || '無名技師',
                            email: user.email,
                            timestamp: serverTimestamp()
                        });
                    });
                }
            });

            // 監聽此用戶是否被封鎖
            const banRef = ref(database, 'banned_users/' + user.uid);
            onValue(banRef, (snapshot) => {
                const isBanned = snapshot.exists();
                if (isBanned) {
                    input.disabled = true;
                    sendBtn.disabled = true;
                    input.placeholder = "您已被管理員封鎖，無法發言。";
                } else {
                    input.disabled = false;
                    sendBtn.disabled = false;
                    input.placeholder = `以「${user.displayName || '技師'}」的身分發言...`;
                }
            });
            
        } else {
            currentUser = null;
            input.disabled = true;
            sendBtn.disabled = true;
            input.placeholder = "請先登入會員才能參與討論";
        }
    });

    // 監聽新訊息
    onChildAdded(chatRef, (snapshot) => {
        const msg = snapshot.val();
        const msgId = snapshot.key;
        displayMessage(chatBox, msg, msgId);
    });

    // 監聽刪除訊息 (即時在畫面上移除)
    onChildRemoved(chatRef, (snapshot) => {
        const msgId = snapshot.key;
        const msgElement = document.getElementById(`msg-${msgId}`);
        if (msgElement) {
            msgElement.remove();
        }
    });

    // 發送訊息
    const sendMessage = async () => {
        if (!currentUser || input.value.trim() === '') return;
        
        const msgText = input.value.trim();
        input.value = ''; // 清空輸入框

        try {
            await push(chatRef, {
                uid: currentUser.uid,
                email: currentUser.email, // 紀錄 Email 以判斷管理員
                name: currentUser.displayName || '無名技師',
                text: msgText,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("發送訊息失敗:", error);
            alert("發送失敗，請確認您沒有被封鎖，或檢查資料庫規則。");
        }
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

function displayMessage(chatBox, msg, msgId) {
    const msgDiv = document.createElement('div');
    msgDiv.id = `msg-${msgId}`;
    const isMine = currentUser && msg.uid === currentUser.uid;
    
    msgDiv.classList.add('message');
    msgDiv.classList.add(isMine ? 'my-message' : 'other-message');
    
    // 時間格式化
    let timeString = '';
    if (msg.timestamp) {
        const date = new Date(msg.timestamp);
        timeString = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    // 管理員視覺特權
    const isMsgFromAdmin = msg.email === ADMIN_EMAIL;
    const nameDisplay = isMsgFromAdmin ? `👑 總管理員 (${msg.name})` : msg.name;
    const nameStyle = isMsgFromAdmin ? 'color: var(--accent-hover); font-size: 0.95rem;' : '';
    const bubbleStyle = isMsgFromAdmin && !isMine ? 'border-left: 4px solid var(--accent-hover); background-color: #FFFAF0;' : '';

    // 管理員專屬操作按鈕 (只有登入者是管理員，且留言不是自己發的，才會看到按鈕)
    const imAdmin = currentUser && currentUser.email === ADMIN_EMAIL;
    let adminControlsHTML = '';
    
    if (imAdmin && !isMsgFromAdmin) {
        adminControlsHTML = `
            <div style="margin-top: 8px; font-size: 0.8rem; display: flex; gap: 8px; justify-content: flex-start;">
                <button onclick="window.deleteMessage('${msgId}')" style="background: rgba(220,53,69,0.1); color: #dc3545; border: 1px solid #dc3545; padding: 3px 8px; cursor: pointer; border-radius: 3px; font-size: 0.75rem;"><i class="fas fa-trash"></i> 刪除</button>
                <button onclick="window.banUser('${msg.uid}')" style="background: rgba(33,37,41,0.1); color: #212529; border: 1px solid #212529; padding: 3px 8px; cursor: pointer; border-radius: 3px; font-size: 0.75rem;"><i class="fas fa-ban"></i> 封鎖此人</button>
            </div>
        `;
    }

    msgDiv.innerHTML = `
        <div class="msg-sender" style="${nameStyle}">${nameDisplay} <span class="msg-time">${timeString}</span></div>
        <div class="msg-bubble" style="${bubbleStyle}">${msg.text}</div>
        ${adminControlsHTML}
    `;
    
    chatBox.appendChild(msgDiv);
    // 自動捲動到最底部
    chatBox.scrollTop = chatBox.scrollHeight;
}

// 將管理員功能綁定到 window 供 onclick 呼叫
window.deleteMessage = async (msgId) => {
    if(confirm("【管理員操作】確定要刪除這則留言嗎？刪除後無法復原。")) {
        await remove(ref(database, `messages/${msgId}`));
    }
};

window.banUser = async (uid) => {
    if(confirm("【管理員操作】危險！確定要永遠封鎖此會員嗎？他將永遠無法在此聊天室發言。")) {
        await set(ref(database, `banned_users/${uid}`), true);
        alert("已成功封鎖該會員！");
    }
};
