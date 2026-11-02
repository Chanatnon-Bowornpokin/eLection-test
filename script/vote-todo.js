const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}[character]));

function escapeHtmlWithBreaks(value) {
    if (!value) return '';
    return String(value)
        .replace(/<span\s+class=["']phrase["']>([\s\S]*?)<\/span>/gi, '###SPAN_PHRASE_START###$1###SPAN_PHRASE_END###')
        .replace(/<wbr\s*\/?>/gi, '###WBR###')
        .replace(/<br\s*\/?>/gi, '###BR###')
        .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
        .replace(/###SPAN_PHRASE_START###/g, '<span class="phrase">')
        .replace(/###SPAN_PHRASE_END###/g, '</span>')
        .replace(/###WBR###/g, '<wbr>')
        .replace(/###BR###/g, '<br>');
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
function checkEligibility(currentEventId) {
    const voter = (typeof window.getVoter === 'function')
        ? window.getVoter()
        : (function () {
            try { return JSON.parse(localStorage.getItem('election_current_voter') || 'null'); } catch { return null; }
        })();

    if (!voter) return true;

    let isEligible = true;
    if (typeof window.isEligibleFor === 'function') {
        isEligible = window.isEligibleFor(currentEventId, voter);
    } else {
        if (currentEventId === 'house-election-2569') isEligible = voter.eligible_mp !== false;
        if (currentEventId === 'referendum-2569-03') isEligible = voter.eligible_referendum !== false;
    }

    if (!isEligible) {
        const list = document.getElementById('voteTodoList');
        const agreement = document.querySelector('.vote-todo-agreement');
        const nextBtn = document.getElementById('nextBtn');

        if (agreement) agreement.style.display = 'none';
        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.classList.add('is-disabled');
            nextBtn.style.display = 'none';
        }
        if (list) {
            list.innerHTML = `
                <div class="vote-todo-card" style="text-align: center; padding: 36px 20px;">
                    <div style="font-size: 20px; font-weight: 700; color: #dc2626; margin-bottom: 10px;">
                        ท่านไม่มีสิทธิลงคะแนนในรายการนี้
                    </div>
                    <div style="font-size: 15px; color: #555; line-height: 1.6; margin-bottom: 24px;">
                        ระบบตรวจสอบข้อมูลผู้มีสิทธิเลือกตั้งประจำเครื่องแล้ว พบว่าท่านไม่มีสิทธิลงคะแนนในการเลือกตั้งรายการนี้
                    </div>
                    <a href="Vote-Check.html" class="vote-todo-btn vote-todo-btn-back" style="display: inline-flex; align-items: center; justify-content: center; text-decoration: none; margin: 0 auto;">
                        กลับสู่หน้ารายการสิทธิลงคะแนน
                    </a>
                </div>
            `;
        }
        return false;
    }
    return true;
}

function renderVoteTodos(currentEventId) {
    if (!checkEligibility(currentEventId)) return;
    const listContainer = document.getElementById('voteTodoList');
    if (!listContainer || typeof VOTE_TODO_DATA === 'undefined') return;

    const todos = VOTE_TODO_DATA[currentEventId] || VOTE_TODO_DATA['house-election-2569'] || [];

    listContainer.innerHTML = todos.map(item => {
        const title = escapeHtmlWithBreaks(item.title || '');
        const desc = escapeHtmlWithBreaks(item.description || '');

        return `
            <article class="vote-todo-card">
                <div class="vote-todo-content">
                    <h2 class="vote-todo-card-title">${title}</h2>
                    <p class="vote-todo-card-desc">${desc}</p>
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

window.addEventListener('voter-claimed', () => {
    const currentEventId = getCurrentEventId();
    checkEligibility(currentEventId);
});
