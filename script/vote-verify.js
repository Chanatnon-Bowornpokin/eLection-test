/**
 * ข้อมูลตัวเลือกวิธียืนยันตัวตน (OTP / PIN)
 * ใช้ข้อมูลชุดเดียว ไม่แยก desktop / tablet / mobile
 */
const VOTE_VERIFY_DATA = [
    {
        id: 'otp',
        title: 'OTP',
        description: 'ระบบจะจัดส่งรหัสผ่านแบบใช้ครั้งเดียว (OTP) จำนวน 6 หลัก ไปยังหมายเลขโทรศัพท์มือถือที่ท่านได้ลงทะเบียนไว้ เพื่อยืนยันสิทธิและเริ่มกระบวนการลงคะแนน',
        defaultSelected: true
    },
    {
        id: 'pin',
        title: 'PIN',
        description: 'ยืนยันสิทธิทันทีด้วยรหัส PIN ความปลอดภัย 6 หลักที่คุณได้กำหนดไว้ล่วงหน้าขณะลงทะเบียนบัญชีผู้มีสิทธิเลือกตั้ง โดยไม่ต้องรอรับข้อความ SMS',
        defaultSelected: false
    }
];

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

// ดึง event id จาก URL query parameter เช่น ?id=house-election-2569
function getCurrentEventId() {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    if (eventId && typeof EVENTS !== 'undefined' && Array.isArray(EVENTS)) {
        const found = EVENTS.find(ev => ev.id === eventId);
        if (found) return found.id;
    }

    if (typeof EVENTS !== 'undefined' && Array.isArray(EVENTS) && EVENTS.length > 0) {
        return EVENTS[0].id;
    }

    return 'house-election-2569';
}

// 1. จัดการแสดงผล Hero Banner ตาม eventId ปัจจุบัน
function initHeroBanner(currentEventId) {
    const bannerImg = document.getElementById('voteVerifyHeroImg');
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

let selectedMethod = 'otp';

// 2. Render การ์ดวิธียืนยันตัวตน (OTP / PIN)
function renderVerifyCards() {
    const listContainer = document.getElementById('voteVerifyList');
    if (!listContainer || typeof VOTE_VERIFY_DATA === 'undefined') return;

    listContainer.innerHTML = VOTE_VERIFY_DATA.map(item => {
        const isSelected = item.id === selectedMethod;
        const title = escapeHtmlWithBreaks(item.title || '');
        const desc = escapeHtmlWithBreaks(item.description || '');

        return `
            <article class="vote-verify-card ${isSelected ? 'is-selected' : ''}" data-method="${escapeHtml(item.id)}" role="radio" aria-checked="${isSelected}" tabindex="0">
                <div class="vote-verify-radio-wrap" aria-hidden="true">
                    <span class="vote-verify-radio-circle">
                        <span class="vote-verify-radio-dot"></span>
                    </span>
                </div>
                <div class="vote-verify-body">
                    <div class="vote-verify-content">
                        <h2 class="vote-verify-card-title bold">${title}</h2>
                        <p class="vote-verify-card-desc regular">${desc}</p>
                    </div>
                </div>
            </article>
        `;
    }).join('');

    // เพิ่ม event listener ให้กับการ์ดแต่ละใบ
    const cards = listContainer.querySelectorAll('.vote-verify-card');
    cards.forEach(card => {
        const selectAction = () => {
            const method = card.getAttribute('data-method');
            if (method && method !== selectedMethod) {
                selectedMethod = method;
                cards.forEach(c => {
                    const active = c.getAttribute('data-method') === selectedMethod;
                    c.classList.toggle('is-selected', active);
                    c.setAttribute('aria-checked', String(active));
                });
            }
        };

        card.addEventListener('click', selectAction);
        card.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                selectAction();
            }
        });
    });
}

// 3. จัดการปุ่ม "ย้อนกลับ" และ "ถัดไป"
function initActions(currentEventId) {
    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = `Vote-Todo.html?id=${encodeURIComponent(currentEventId)}`;
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            // เมื่อกดถัดไป ให้ส่งต่อไปยังหน้ายืนยันตามวิธีที่เลือก (OTP หรือ PIN) พร้อม query param id
            if (selectedMethod === 'otp') {
                window.location.href = `Vote-Verify-Otp.html?id=${encodeURIComponent(currentEventId)}`;
            } else {
                window.location.href = `Vote-Verify-Pin.html?id=${encodeURIComponent(currentEventId)}`;
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const currentEventId = getCurrentEventId();
    initHeroBanner(currentEventId);
    renderVerifyCards();
    initActions(currentEventId);
});

