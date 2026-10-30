/**
 * Script ควบคุมหน้ากรอกรหัส PIN (Vote-Verify-Pin.html)
 * - สลับ Banner ตาม Event ID (เลือกตั้ง / ลงประชามติ)
 * - จัดการช่องกรอก PIN 6 หลัก (Auto-tab, Backspace, Paste)
 * - ปุ่มสลับแสดง/ซ่อน PIN (<i class="fa-solid fa-eye"></i> / <i class="fa-solid fa-eye-slash"></i>)
 * - ปุ่ม "ย้อนกลับ", "ถัดไป" และลิงก์สลับไปยืนยันด้วย OTP
 */

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

let isPinVisible = false;

// 2. ดึงค่า PIN ที่กรอกทั้งหมด 6 ช่อง
function getEnteredPin() {
    const inputs = document.querySelectorAll('.vote-digit-input');
    return Array.from(inputs).map(input => input.value.trim()).join('');
}

// ตรวจสอบความถูกต้องและปรับสถานะปุ่ม "ถัดไป"
function validatePinInputs() {
    const entered = getEnteredPin();
    const nextBtn = document.getElementById('nextBtn');
    if (!nextBtn) return;

    if (entered.length === 6) {
        nextBtn.disabled = false;
    } else {
        nextBtn.disabled = true;
    }
}

// 3. จัดการ Keyboard Navigation ของช่องกรอก PIN 6 หลัก
function initPinInputs() {
    const inputs = Array.from(document.querySelectorAll('.vote-digit-input'));
    if (inputs.length === 0) return;

    inputs.forEach((input, index) => {
        // เมื่อพิมพ์ตัวเลข
        input.addEventListener('input', () => {
            const val = input.value.replace(/[^0-9]/g, '');
            input.value = val ? val[val.length - 1] : '';

            if (input.value) {
                input.classList.add('has-value');
                if (index < inputs.length - 1) {
                    inputs[index + 1].focus();
                }
            } else {
                input.classList.remove('has-value');
            }

            validatePinInputs();
        });

        // เมื่อกดปุ่ม Backspace หรือ Arrow
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace') {
                if (!input.value && index > 0) {
                    inputs[index - 1].focus();
                    inputs[index - 1].value = '';
                    inputs[index - 1].classList.remove('has-value');
                    validatePinInputs();
                } else {
                    input.value = '';
                    input.classList.remove('has-value');
                    validatePinInputs();
                }
            } else if (e.key === 'ArrowLeft' && index > 0) {
                inputs[index - 1].focus();
            } else if (e.key === 'ArrowRight' && index < inputs.length - 1) {
                inputs[index + 1].focus();
            }
        });

        // รองรับการ Paste PIN 6 หลัก
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = (e.clipboardData || window.clipboardData).getData('text');
            const cleanDigits = pastedData.replace(/[^0-9]/g, '').slice(0, 6);

            if (cleanDigits.length > 0) {
                const digits = cleanDigits.split('');
                inputs.forEach((inp, i) => {
                    inp.value = digits[i] || '';
                    if (inp.value) {
                        inp.classList.add('has-value');
                    } else {
                        inp.classList.remove('has-value');
                    }
                });
                if (inputs.length > 0) {
                    inputs[inputs.length - 1].focus();
                }
                validatePinInputs();
            }
        });
    });

    // โฟกัสช่องแรกเมื่อโหลดหน้า
    setTimeout(() => {
        inputs[0].focus();
    }, 400);
}

// 4. สลับการแสดง/ซ่อน PIN (Toggle PIN Visibility)
function initTogglePinVisibility() {
    const toggleBtn = document.getElementById('togglePinVisibility');
    const eyeIcon = document.getElementById('eyeIcon');
    const eyeText = document.getElementById('eyeText');
    const inputs = document.querySelectorAll('.vote-digit-input');

    if (!toggleBtn || !eyeIcon || !eyeText) return;

    toggleBtn.addEventListener('click', () => {
        isPinVisible = !isPinVisible;

        inputs.forEach(input => {
            input.type = isPinVisible ? 'text' : 'password';
        });

        if (isPinVisible) {
            eyeIcon.className = 'fa-solid fa-eye-slash';
            eyeText.textContent = 'ซ่อน PIN';
        } else {
            eyeIcon.className = 'fa-solid fa-eye';
            eyeText.textContent = 'แสดง PIN';
        }
    });
}

// 5. จัดการปุ่มต่างๆ ในหน้า
function initActions(currentEventId) {
    const backBtn = document.getElementById('backBtn');
    const nextBtn = document.getElementById('nextBtn');
    const switchToOtpLink = document.getElementById('switchToOtpLink');

    // ปุ่มย้อนกลับ
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = `Vote-Verify.html?id=${encodeURIComponent(currentEventId)}`;
        });
    }

    // ลิงก์สลับไปใช้ OTP
    if (switchToOtpLink) {
        switchToOtpLink.href = `Vote-Verify-Otp.html?id=${encodeURIComponent(currentEventId)}`;
    }

    // ปุ่มถัดไป
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const entered = getEnteredPin();
            if (entered.length !== 6) return;

            // เมื่อกรอก PIN 6 หลักครบถ้วน ให้ไปสู่ขั้นตอนลงคะแนนใบที่ 1
            window.location.href = `Vote.html?id=${encodeURIComponent(currentEventId)}`;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const currentEventId = getCurrentEventId();
    initHeroBanner(currentEventId);
    initPinInputs();
    initTogglePinVisibility();
    initActions(currentEventId);
});

