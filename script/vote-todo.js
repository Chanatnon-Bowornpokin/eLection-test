const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}[character]));

function escapeHtmlWithBreaks(value) {
    return String(value)
        .split(/<br\s*\/?>/i)
        .map(escapeHtml)
        .join('<br>');
}

// รับ eventId ปัจจุบันจาก URL param (fallback เป็นรายการแรกใน EVENTS หรือ key แรกใน VOTE_TODO_DATA)
function getCurrentEventId() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    if (eventId && typeof VOTE_TODO_DATA !== 'undefined' && VOTE_TODO_DATA[eventId]) {
        return eventId;
    }

    if (typeof EVENTS !== 'undefined' && Array.isArray(EVENTS) && EVENTS.length > 0) {
        return EVENTS[0].id;
    }

    if (typeof VOTE_TODO_DATA !== 'undefined') {
        const keys = Object.keys(VOTE_TODO_DATA);
        if (keys.length > 0) return keys[0];
    }

    return 'house-election-2569';
}

// 1. จัดการ Banner ตามการเลือกตั้งที่เลือก
function initHeroBanner(currentEventId) {
    const bannerImg = document.getElementById('voteTodoHeroImg');
    if (!bannerImg) return;

    let currentEvent = null;
    if (typeof EVENTS !== 'undefined' && Array.isArray(EVENTS)) {
        currentEvent = EVENTS.find(ev => ev.id === currentEventId);
    }

    if (currentEvent && currentEvent.banner) {
        bannerImg.src = currentEvent.banner;
        bannerImg.alt = currentEvent.title || 'รายละเอียดการเลือกตั้ง';
    }
}

// 2. Render รายการการ์ดข้อพึงปฏิบัติ ดึงข้อมูลจาก VOTE_TODO_DATA ใน script/vote-todo-data.js
function renderVoteTodos(currentEventId) {
    const listContainer = document.getElementById('voteTodoList');
    if (!listContainer || typeof VOTE_TODO_DATA === 'undefined') return;

    const todos = VOTE_TODO_DATA[currentEventId] || VOTE_TODO_DATA['house-election-2569'] || [];

    listContainer.innerHTML = todos.map(item => {
        const titleDesktop = escapeHtmlWithBreaks(item.desktop?.title || '');
        const descDesktop = escapeHtmlWithBreaks(item.desktop?.description || '');

        const titleTablet = escapeHtmlWithBreaks(item.tablet?.title || item.desktop?.title || '');
        const descTablet = escapeHtmlWithBreaks(item.tablet?.description || item.desktop?.description || '');

        const titleMobile = escapeHtmlWithBreaks(item.mobile?.title || item.desktop?.title || '');
        const descMobile = escapeHtmlWithBreaks(item.mobile?.description || item.desktop?.description || '');

        return `
            <article class="vote-todo-card">
                <div class="vote-todo-content vote-todo-content--desktop">
                    <h2 class="vote-todo-card-title">${titleDesktop}</h2>
                    <p class="vote-todo-card-desc">${descDesktop}</p>
                </div>
                <div class="vote-todo-content vote-todo-content--tablet">
                    <h2 class="vote-todo-card-title">${titleTablet}</h2>
                    <p class="vote-todo-card-desc">${descTablet}</p>
                </div>
                <div class="vote-todo-content vote-todo-content--mobile">
                    <h2 class="vote-todo-card-title">${titleMobile}</h2>
                    <p class="vote-todo-card-desc">${descMobile}</p>
                </div>
            </article>
        `;
    }).join('');
}

// 3. จัดการ Checkbox และสลับสถานะปุ่ม "ถัดไป" (Disable / Active)
function initControls(currentEventId) {
    const agreeCheckbox = document.getElementById('agreeCheckbox');
    const nextBtn = document.getElementById('nextBtn');
    const backBtn = document.getElementById('backBtn');

    if (agreeCheckbox && nextBtn) {
        agreeCheckbox.addEventListener('change', () => {
            if (agreeCheckbox.checked) {
                nextBtn.classList.remove('is-disabled');
                nextBtn.removeAttribute('disabled');
                nextBtn.setAttribute('aria-disabled', 'false');
            } else {
                nextBtn.classList.add('is-disabled');
                nextBtn.setAttribute('disabled', 'true');
                nextBtn.setAttribute('aria-disabled', 'true');
            }
        });
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'Vote-Check.html';
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (nextBtn.disabled || nextBtn.classList.contains('is-disabled')) return;
            const targetUrl = `Vote-Verify.html?id=${encodeURIComponent(currentEventId)}`;
            window.location.href = targetUrl;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const currentEventId = getCurrentEventId();
    initHeroBanner(currentEventId);
    renderVoteTodos(currentEventId);
    initControls(currentEventId);
});
