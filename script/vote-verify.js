/**
 * ข้อมูลตัวเลือกวิธียืนยันตัวตน (OTP / PIN)
 * รองรับการใส่ <br> แยกตามหน้าจอ Desktop, Tablet, Mobile เพื่อให้ปรับแต่งการตัดคำได้อย่างอิสระ
 */
const VOTE_VERIFY_DATA = [
    {
        id: 'otp',
        title: 'OTP',
        defaultSelected: true, // ค่าเริ่มต้นเลือก OTP
        desktop: {
            title: 'OTP',
            description: 'ระบบจะจัดส่งรหัสผ่านแบบใช้ครั้งเดียว (OTP) จำนวน 6 หลัก ไปยังหมายเลขโทรศัพท์มือถือที่ท่านได้ลงทะเบียนไว้ เพื่อยืนยันสิทธิและเริ่มกระบวนการลงคะแนน'
        },
        tablet: {
            title: 'OTP',
            description: 'ระบบจะจัดส่งรหัสผ่านแบบใช้ครั้งเดียว (OTP) จำนวน 6 หลัก ไปยังหมายเลขโทรศัพท์<br>มือถือที่ท่านได้ลงทะเบียนไว้ เพื่อยืนยันสิทธิและเริ่มกระบวนการลงคะแนน'
        },
        mobile: {
            title: 'OTP',
            description: 'ระบบจะจัดส่งรหัสผ่านแบบใช้ครั้งเดียว (OTP)<br>จำนวน 6 หลัก ไปยังหมายเลขโทรศัพท์มือถือที่ท่าน<br>ได้ลงทะเบียนไว้ เพื่อยืนยันสิทธิและ เริ่มกระบวนการ<br>ลงคะแนน'
        }
    },
    {
        id: 'pin',
        title: 'PIN',
        defaultSelected: false,
        desktop: {
            title: 'PIN',
            description: 'ยืนยันสิทธิทันทีด้วยรหัส PIN ความปลอดภัย 6 หลักที่คุณได้กำหนดไว้ล่วงหน้าขณะลงทะเบียนบัญชีผู้มีสิทธิเลือกตั้ง โดยไม่ต้องรอรับข้อความ SMS'
        },
        tablet: {
            title: 'PIN',
            description: 'ยืนยันสิทธิทันทีด้วยรหัส PIN ความปลอดภัย 6 หลัก ที่คุณได้กำหนดไว้ล่วงหน้า<br>ขณะลงทะเบียนบัญชีผู้มีสิทธิเลือกตั้ง โดยไม่ต้องรอรับข้อความ SMS'
        },
        mobile: {
            title: 'PIN',
            description: 'ยืนยันสิทธิทันทีด้วยรหัส PIN ความปลอดภัย 6 หลัก<br>ที่คุณได้กำหนดไว้ล่วงหน้าขณะลงทะเบียนบัญชีผู้มีสิทธิ<br>เลือกตั้ง โดยไม่ต้องรอรับข้อความ SMS'
        }
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
    return String(value)
        .split(/<br\s*\/?>/i)
        .map(escapeHtml)
        .join('<br>');
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
        const titleDesktop = escapeHtmlWithBreaks(item.desktop?.title || item.title || '');
        const descDesktop = escapeHtmlWithBreaks(item.desktop?.description || '');

        const titleTablet = escapeHtmlWithBreaks(item.tablet?.title || item.title || '');
        const descTablet = escapeHtmlWithBreaks(item.tablet?.description || item.desktop?.description || '');

        const titleMobile = escapeHtmlWithBreaks(item.mobile?.title || item.title || '');
        const descMobile = escapeHtmlWithBreaks(item.mobile?.description || item.desktop?.description || '');

        return `
            <article class="vote-verify-card ${isSelected ? 'is-selected' : ''}" data-method="${escapeHtml(item.id)}" role="radio" aria-checked="${isSelected}" tabindex="0">
                <div class="vote-verify-radio-wrap" aria-hidden="true">
                    <span class="vote-verify-radio-circle">
                        <span class="vote-verify-radio-dot"></span>
                    </span>
                </div>
                <div class="vote-verify-body">
                    <!-- Desktop -->
                    <div class="vote-verify-content vote-verify-content--desktop">
                        <h2 class="vote-verify-card-title bold">${titleDesktop}</h2>
                        <p class="vote-verify-card-desc regular">${descDesktop}</p>
                    </div>
                    <!-- Tablet -->
                    <div class="vote-verify-content vote-verify-content--tablet">
                        <h2 class="vote-verify-card-title bold">${titleTablet}</h2>
                        <p class="vote-verify-card-desc regular">${descTablet}</p>
                    </div>
                    <!-- Mobile -->
                    <div class="vote-verify-content vote-verify-content--mobile">
                        <h2 class="vote-verify-card-title bold">${titleMobile}</h2>
                        <p class="vote-verify-card-desc regular">${descMobile}</p>
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

