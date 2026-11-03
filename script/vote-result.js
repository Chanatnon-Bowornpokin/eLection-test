/**
 * Vote-Result.html — รายการการเลือกตั้งที่ดูผลได้
 * - ใช้ข้อมูลจาก EVENTS (script/events.js) เหมือนหน้า Vote-Check
 * - ช่องค้นหา + ตัวกรองหมวดหมู่ (Desktop) กรองการ์ดโดยซ่อน/แสดง ไม่ render ใหม่
 */
(function () {
    'use strict';

    const resultList = document.getElementById('resultList');
    const emptyMessage = document.getElementById('resultEmpty');
    const searchInput = document.getElementById('resultSearchInput');
    const chipGroup = document.getElementById('resultChips');

    // สถานะการนับคะแนนของแต่ละการเลือกตั้ง (ใช้กำหนดข้อความ/สี/ปลายทางของปุ่ม)
    const RESULT_META = {
        'referendum-2569-03': { state: 'waiting', category: '' },
        'house-election-2569': { state: 'counting', category: 'สภาผู้แทนราษฎร' },
    };

    const STATE_TEXT = {
        waiting: 'ยังไม่ถึงเวลานับคะแนน',
        counting: 'กำลังนับคะแนน',
    };
    const POLL_MS = 5000;
    const resultCounts = new Map();
    const db = typeof supabaseClient !== 'undefined' ? supabaseClient : null;

    const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[character]));

    // รองรับ <span class="phrase"> / <wbr> / <br> ในชื่อการเลือกตั้ง (เหมือน vote-check.js)
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

    function plainText(html) {
        const holder = document.createElement('div');
        holder.innerHTML = html || '';
        return (holder.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function renderElections() {
        if (!resultList || typeof EVENTS === 'undefined' || !Array.isArray(EVENTS)) return;

        resultList.innerHTML = EVENTS.map(election => {
            const electionId = election.id || `${election.date}-${election.title}`;
            const meta = RESULT_META[electionId] || { state: 'waiting', category: '' };
            const date = new Intl.DateTimeFormat('th-TH', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            }).format(new Date(`${election.date}T00:00:00`));
            const deadline = election.voteDeadline ? escapeHtml(election.voteDeadline) : '';
            const count = resultCounts.get(electionId);
            const statusText = count
                ? (count.final > 0 ? `ประมวลผลแล้ว ${count.final} / ${count.total} ใบ` : `รอประมวลผล ${count.total} ใบ`)
                : STATE_TEXT[meta.state];
            const indicatorColor = count
                ? count.final > 0 && count.pending === 0 ? 'green' : count.pending > 0 ? 'yellow' : 'gray'
                : meta.state === 'counting' ? 'yellow' : 'gray';
            const indicator = `<i class="fa-solid fa-circle vote-election-indicator status-dot ${indicatorColor}" aria-hidden="true"></i>`;
            const href = `Vote-Status.html?id=${encodeURIComponent(electionId)}&state=${meta.state}`;

            return `
                <article class="vote-election-card" data-election-id="${escapeHtml(electionId)}" data-category="${escapeHtml(meta.category)}" data-search="${escapeHtml(plainText(election.title))}">
                    <div class="vote-election-copy">
                        <span class="vote-election-level">${escapeHtml(election.level)}</span>
                        <h2 class="vote-election-title">${escapeHtmlWithBreaks(election.title)}</h2>
                        <p class="vote-election-meta">
                            <span class="vote-election-date">${escapeHtml(date)}</span>${deadline ? ` <span class="vote-election-deadline">${deadline}</span>` : ''}
                        </p>
                        <div class="vote-election-status-wrap">
                            ${indicator}
                            <span class="vote-election-status" aria-label="สถานะ: ${statusText}">${statusText}</span>
                        </div>
                    </div>
                    <a class="vote-election-action" href="${href}">ติดตามสถานะ</a>
                </article>
            `;
        }).join('');
    }

    // ---- ค้นหา + กรองหมวดหมู่ ----
    let activeCategory = '';

    function applyFilters() {
        const keyword = (searchInput ? searchInput.value : '').trim().toLowerCase();
        let visible = 0;

        resultList.querySelectorAll('.vote-election-card').forEach(card => {
            const matchKeyword = !keyword || card.dataset.search.toLowerCase().includes(keyword);
            const matchCategory = !activeCategory || card.dataset.category === activeCategory;
            const show = matchKeyword && matchCategory;
            card.hidden = !show;
            if (show) visible += 1;
        });

        if (emptyMessage) emptyMessage.hidden = visible > 0;
    }

    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }

    if (chipGroup) {
        chipGroup.addEventListener('click', event => {
            const chip = event.target.closest('.vote-result-chip');
            if (!chip) return;

            const category = chip.dataset.category;
            activeCategory = activeCategory === category ? '' : category;
            chipGroup.querySelectorAll('.vote-result-chip').forEach(item => {
                const isActive = item.dataset.category === activeCategory;
                item.classList.toggle('is-active', isActive);
                item.setAttribute('aria-pressed', String(isActive));
            });
            applyFilters();
        });
    }

    async function fetchCount(table, column) {
        if (!db) throw new Error('Supabase client is unavailable');
        const { count, error } = await db.from(table).select(column, { count: 'exact', head: true });
        if (error) throw error;
        return count || 0;
    }

    async function pollResultCounts() {
        if (!db) return;

        try {
            const [mpFinal, mpPending, referendumFinal, referendumPending] = await Promise.all([
                fetchCount('mp_final_box', 'ballot_id'),
                fetchCount('mp_staging_box', 'voter_id'),
                fetchCount('referendum_final_box', 'ballot_id'),
                fetchCount('referendum_staging_box', 'voter_id'),
            ]);
            resultCounts.set('house-election-2569', {
                final: mpFinal,
                pending: mpPending,
                total: mpFinal + mpPending,
            });
            resultCounts.set('referendum-2569-03', {
                final: referendumFinal,
                pending: referendumPending,
                total: referendumFinal + referendumPending,
            });

            resultList.querySelectorAll('.vote-election-card').forEach(card => {
                const count = resultCounts.get(card.dataset.electionId);
                const status = card.querySelector('.vote-election-status');
                const indicator = card.querySelector('.status-dot');
                if (!count || !status || !indicator) return;

                status.textContent = count.final > 0
                    ? `ประมวลผลแล้ว ${count.final.toLocaleString('th-TH')} / ${count.total.toLocaleString('th-TH')} ใบ`
                    : count.pending > 0
                        ? `รอประมวลผล ${count.pending.toLocaleString('th-TH')} ใบ`
                        : 'ยังไม่มีบัตรที่ประมวลผล';
                status.setAttribute('aria-label', `สถานะ: ${status.textContent}`);

                indicator.classList.remove('green', 'yellow', 'gray');
                indicator.classList.add(count.final > 0 && count.pending === 0 ? 'green' : count.pending > 0 ? 'yellow' : 'gray');
            });
        } catch (error) {
            console.warn('Unable to load final box counts for result list', error);
        } finally {
            window.setTimeout(pollResultCounts, POLL_MS);
        }
    }

    renderElections();
    pollResultCounts();
})();
