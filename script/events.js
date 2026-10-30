// ฐานข้อมูลรายการการเลือกตั้ง (EVENTS)
// รองรับ Semantic Chunking ด้วย <span class="phrase"> เพื่อให้ข้อความตัดคำเป็นก้อนประโยคที่สมบูรณ์ในทุกหน้าจอ
// ใช้ข้อความชุดเดียว ไม่แยก desktop / tablet / mobile อีกต่อไป

const EVENTS = [
    {
        id: 'referendum-2569-03',
        date: '2026-02-08',
        level: 'ระดับประเทศ',
        banner: '../img/Banner/Referendum_Banner.png',
        title: '<span class="phrase">การออกเสียงประชามติ</span> <span class="phrase">ครั้งที่ 3 ปี 2569</span>',
        calendarTitle: '<span class="phrase">การออกเสียงประชามติ</span> <span class="phrase">ครั้งที่ 3 ปี 2569</span>',
        time: '08:00 - 17:00 น.',
        voteDeadline: 'ปิดหีบเลือกตั้งเวลา 17.00 น.',
        hasVoted: false
    },
    {
        id: 'house-election-2569',
        date: '2026-02-08',
        level: 'ระดับประเทศ',
        banner: '../img/Banner/House_Election.png',
        title: '<span class="phrase">การเลือกตั้ง</span><span class="phrase">สมาชิกสภา</span><span class="phrase">ผู้แทนราษฎร</span> <span class="phrase">(ส.ส.)</span> <span class="phrase">ครั้งที่ 28</span>',
        calendarTitle: '<span class="phrase">การเลือกตั้ง</span><span class="phrase">สมาชิกสภา</span><span class="phrase">ผู้แทนราษฎร</span> <span class="phrase">(ส.ส.)</span> <span class="phrase">ครั้งที่ 28</span>',
        time: '08:00 - 17:00 น.',
        voteDeadline: 'ปิดหีบเลือกตั้งเวลา 17.00 น.',
        hasVoted: false
    }
];

/**
 * ระบบจัดระเบียบการตัดคำและช่องไฟอัตโนมัติ (Responsive Thai Micro-Typesetter)
 * ปรับช่องไฟระดับไมโคร (Micro-tracking) อัตโนมัติตามความกว้างการ์ดจริงในทุกขนาดหน้าจอ
 * เพื่อลดพื้นที่ว่างท้ายบรรทัด (Ragged Right) และป้องกันคำติ่ง (Orphan) ท้ายย่อหน้า
 */
(function initThaiTypesetter() {
    const TARGET_SELECTORS = [
        '.NewsCardDesc',
        '.vote-todo-card-desc',
        '.vote-verify-card-desc',
        '.NewsCardName',
        '.vote-election-title',
        '.vote-receipt-election-title'
    ].join(', ');

    function measurePhraseLines(el) {
        const phrases = Array.from(el.querySelectorAll('.phrase'));
        if (phrases.length === 0) return null;
        const elRect = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        const padLeft = parseFloat(cs.paddingLeft) || 0;
        const padRight = parseFloat(cs.paddingRight) || 0;
        const boxWidth = elRect.width - padLeft - padRight;
        if (boxWidth <= 0) return null;

        const lines = [];
        let cur = [];
        let curTop = null;
        for (const p of phrases) {
            const r = p.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            if (curTop === null || Math.abs(r.top - curTop) > 6) {
                if (cur.length > 0) lines.push(cur);
                cur = [{ el: p, rect: r }];
                curTop = r.top;
            } else {
                cur.push({ el: p, rect: r });
            }
        }
        if (cur.length > 0) lines.push(cur);
        return {
            boxWidth,
            lines: lines.map(line => {
                const lineWidth = line[line.length - 1].rect.right - line[0].rect.left;
                return {
                    phrases: line,
                    lineWidth,
                    fillPct: lineWidth / boxWidth
                };
            })
        };
    }

    function hasOverflow(m) {
        if (!m) return false;
        return m.lines.some(l => l.fillPct > 1.005);
    }

    function optimizeElement(el) {
        if (!el || el.offsetParent === null) return;
        if (!el.dataset.origHtml) {
            el.dataset.origHtml = el.innerHTML;
        } else if (el.dataset.mergedOrphan === '1') {
            el.innerHTML = el.dataset.origHtml;
            el.dataset.mergedOrphan = '0';
        }
        el.style.letterSpacing = '';
        el.style.wordSpacing = '';

        let m = measurePhraseLines(el);
        if (!m || m.lines.length <= 1) return;

        const k = m.lines.length;
        const lastLine = m.lines[k - 1];

        // 1. หากบรรทัดสุดท้ายสั้น (< 32%) ลองบีบช่องไฟระดับไมโครเพื่อดึงขึ้นไปรวมกับบรรทัดก่อนหน้า
        if (lastLine.fillPct < 0.32) {
            const steps = [-0.004, -0.008, -0.012, -0.016, -0.02, -0.024, -0.028, -0.032, -0.036, -0.04, -0.044, -0.046];
            for (const ls of steps) {
                el.style.letterSpacing = ls + 'em';
                el.style.wordSpacing = (ls * 2.5) + 'em';
                const mTry = measurePhraseLines(el);
                if (mTry && mTry.lines.length < k && !hasOverflow(mTry)) {
                    return;
                }
            }
            el.style.letterSpacing = '';
            el.style.wordSpacing = '';
        }

        // 2. หากบรรทัดก่อนหน้า (ที่ไม่ใช่บรรทัดสุดท้าย) เหลือพื้นที่ว่างด้านขวาเยอะ (< 88%)
        // ลองบีบช่องไฟเล็กน้อยเพื่อดึงกลุ่มคำถัดไปขึ้นมาเติมให้เต็มบรรทัด
        m = measurePhraseLines(el);
        if (m && m.lines.length >= 2) {
            const hasUnderfilledLine = m.lines.slice(0, -1).some(l => l.fillPct < 0.88);
            if (hasUnderfilledLine) {
                const origScores = m.lines.slice(0, -1).map(l => l.fillPct);
                const origMinFill = Math.min(...origScores);
                const steps = [-0.004, -0.008, -0.012, -0.016, -0.02, -0.024, -0.028, -0.032];
                let applied = false;
                for (const ls of steps) {
                    el.style.letterSpacing = ls + 'em';
                    el.style.wordSpacing = (ls * 2) + 'em';
                    const mTry = measurePhraseLines(el);
                    if (!mTry || hasOverflow(mTry)) continue;
                    const newMinFill = mTry.lines.length > 1
                        ? Math.min(...mTry.lines.slice(0, -1).map(l => l.fillPct))
                        : 1;
                    const newLastFill = mTry.lines[mTry.lines.length - 1].fillPct;
                    if (newMinFill >= origMinFill + 0.05 && (mTry.lines.length === 1 || newLastFill >= 0.18)) {
                        applied = true;
                        break;
                    }
                }
                if (!applied) {
                    el.style.letterSpacing = '';
                    el.style.wordSpacing = '';
                }
            }
        }

        // 3. ป้องกันคำติ่งสั้นมากในบรรทัดสุดท้าย (< 18%) โดยผูก 2 กลุ่มคำสุดท้ายเข้าด้วยกันหากบรรทัดบนยังเต็ม (>= 88%)
        m = measurePhraseLines(el);
        if (m && m.lines.length >= 2) {
            const curLast = m.lines[m.lines.length - 1];
            const prevLine = m.lines[m.lines.length - 2];
            if (curLast.fillPct < 0.18 && prevLine.phrases.length >= 2) {
                const movePhrase = prevLine.phrases[prevLine.phrases.length - 1];
                const remainWidth = prevLine.lineWidth - movePhrase.rect.width;
                if (remainWidth / m.boxWidth >= 0.88) {
                    const allPhrases = Array.from(el.querySelectorAll('.phrase'));
                    if (allPhrases.length >= 2) {
                        const p1 = allPhrases[allPhrases.length - 2];
                        const p2 = allPhrases[allPhrases.length - 1];
                        const wrapper = document.createElement('span');
                        wrapper.className = 'phrase';
                        p1.parentNode.insertBefore(wrapper, p1);
                        wrapper.appendChild(p1);
                        if (wrapper.nextSibling && wrapper.nextSibling !== p2) {
                            wrapper.appendChild(wrapper.nextSibling);
                        }
                        wrapper.appendChild(p2);
                        p1.className = '';
                        p2.className = '';
                        el.dataset.mergedOrphan = '1';
                    }
                }
            }
        }
    }

    let observer = null;
    let isOptimizing = false;

    function optimizeAll() {
        if (isOptimizing) return;
        isOptimizing = true;
        if (observer) observer.disconnect();
        try {
            const els = document.querySelectorAll(TARGET_SELECTORS);
            els.forEach(optimizeElement);
        } finally {
            if (observer && document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
            }
            isOptimizing = false;
        }
    }

    window.optimizeThaiTypography = optimizeAll;

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(optimizeAll, 60);
    });

    document.addEventListener('DOMContentLoaded', () => {
        optimizeAll();
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(optimizeAll);
        }
        observer = new MutationObserver(() => {
            optimizeAll();
        });
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        }
    });
})();
