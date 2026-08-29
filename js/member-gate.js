// js/member-gate.js (已轉為 100% 全面開放模式)
export function initMemberGate(toolName = '專業工具') {
    const existing = document.getElementById('member-gate-overlay');
    if (existing) existing.remove();
    console.log(`[NOVERA] ${toolName} 已開放免登入完全免費使用。`);
}
