/**
 * Vote-Result.html — รายการการเลือกตั้งที่ดูผลได้
 * - ใช้ข้อมูลจาก EVENTS (script/events.js) เหมือนหน้า Vote-Check
 * - ช่องค้นหา + ตัวกรองหมวดหมู่ (Desktop) กรองการ์ดโดยซ่อน/แสดง ไม่ render ใหม่
 * - รองรับ loadMpResults() และ loadReferendumResults() จาก final_box ทั้งรูปแบบ Column แยก และ JSON / String
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

    const DEFAULT_SHARED_SECRET = 'eLection-Threshold-Demo-Shared-Secret-2569';
    const FALLBACK_SHARED_SECRETS = [
        'eLection-Threshold-Demo-Shared-Secret-2569',
        'eLection-ECT-SecretKey-2026-BKK'
    ];

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

    // ---- Helpers สำหรับถอดรหัสและอ่านผลคะแนนจาก final_box ----
    function base64ToBytes(base64) {
        const clean = String(base64 || '').trim();
        const bin = atob(clean);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) {
            bytes[i] = bin.charCodeAt(i);
        }
        return bytes;
    }

    async function tryDecryptAesGcmBuffer(ivBytes, cipherBytes, secretStr) {
        const enc = new TextEncoder();
        try {
            const rawKeyBytes = enc.encode(String(secretStr).padEnd(32, '0')).slice(0, 32);
            const rawKey = await crypto.subtle.importKey('raw', rawKeyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
            const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, rawKey, cipherBytes);
            return new TextDecoder().decode(plainBuf);
        } catch {}

        try {
            const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(String(secretStr)));
            const shaKey = await crypto.subtle.importKey('raw', hashBuf, { name: 'AES-GCM' }, false, ['decrypt']);
            const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, shaKey, cipherBytes);
            return new TextDecoder().decode(plainBuf);
        } catch {}

        return null;
    }

    async function decryptTextWithAesGcm(value, secret = DEFAULT_SHARED_SECRET) {
        if (value === null || value === undefined) return '';
        const secretsToTry = [secret, ...FALLBACK_SHARED_SECRETS.filter(s => s !== secret)];

        if (typeof value === 'object') {
            if (value.iv && value.ciphertext) {
                try {
                    const ivBytes = Array.isArray(value.iv) ? new Uint8Array(value.iv) : base64ToBytes(value.iv);
                    const cipherBytes = Array.isArray(value.ciphertext) ? new Uint8Array(value.ciphertext) : base64ToBytes(value.ciphertext);
                    for (const sec of secretsToTry) {
                        const res = await tryDecryptAesGcmBuffer(ivBytes, cipherBytes, sec);
                        if (res !== null) return res;
                    }
                } catch {}
            }
            if (typeof value.choice === 'string') return decryptTextWithAesGcm(value.choice, secret);
            if (typeof value.ciphertext === 'string') return decryptTextWithAesGcm(value.ciphertext, secret);
            return String(value);
        }

        const str = String(value).trim();
        if (!str) return '';

        if (str.startsWith('ENC[AES-GCM::')) {
            const rawBase64 = str.slice('ENC[AES-GCM::'.length).replace(/\]$/, '');
            try {
                const combined = base64ToBytes(rawBase64);
                const ivBytes = combined.slice(0, 12);
                const cipherBytes = combined.slice(12);
                for (const sec of secretsToTry) {
                    const res = await tryDecryptAesGcmBuffer(ivBytes, cipherBytes, sec);
                    if (res !== null) return res;
                }
            } catch {}
            return str;
        }

        if (str.startsWith('{') && str.endsWith('}')) {
            try {
                const parsed = JSON.parse(str);
                if (parsed && typeof parsed === 'object') {
                    return decryptTextWithAesGcm(parsed, secret);
                }
            } catch {}
        }

        return str;
    }

    function parseJsonObject(value) {
        if (!value) return null;
        if (typeof value === 'object') return value;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                try {
                    return JSON.parse(trimmed);
                } catch {
                    return null;
                }
            }
        }
        return null;
    }

    function parseChoiceNumber(value) {
        if (value === null || value === undefined) return null;
        const raw = String(value).trim().toLowerCase();
        if (!raw) return null;
        if (raw === 'abstain' || raw === 'no_vote' || raw === 'ไม่ประสงค์ลงคะแนน' || raw === 'งดออกเสียง' || raw === '0') {
            return 'abstain';
        }
        const num = Number.parseInt(raw, 10);
        return Number.isInteger(num) && num > 0 ? num : null;
    }

    function parseReferendumChoice(value) {
        if (value === null || value === undefined) return null;
        if (typeof value === 'object') {
            const inner = value.choice ?? value.vote ?? value.decrypted_vote ?? value.result ?? value.value ?? value.ciphertext;
            if (inner !== undefined) return parseReferendumChoice(inner);
        }
        const str = String(value).trim();
        if (!str) return null;

        if (str.startsWith('{') && str.endsWith('}')) {
            const obj = parseJsonObject(str);
            if (obj) return parseReferendumChoice(obj);
        }

        const lower = str.toLowerCase();
        if (['approve', 'yes', 'agree', '1', 'เห็นชอบ'].includes(lower) || str === 'เห็นชอบ') {
            return 'approve';
        }
        if (['disapprove', 'no', 'disagree', '2', 'ไม่เห็นชอบ'].includes(lower) || str === 'ไม่เห็นชอบ') {
            return 'disapprove';
        }
        if (
            ['abstain', 'no_opinion', 'no opinion', '0', '3', 'ไม่แสดงความคิดเห็น', 'งดออกเสียง', 'ไม่ประสงค์ลงคะแนน'].includes(lower) ||
            str === 'ไม่แสดงความคิดเห็น' ||
            str === 'งดออกเสียง'
        ) {
            return 'abstain';
        }
        return null;
    }

    /**
     * 1. การเลือกตั้ง ส.ส. (`loadMpResults()`):
     * - ดึงข้อมูลจาก `mp_final_box`, `mp_candidates`, และ `party_candidates`
     * - รองรับการอ่านหมายเลขผู้สมัครและหมายเลขพรรคทั้งแบบแยก Column (`candidate_number` / `party_number`)
     *   และแบบ JSON ใน `decrypted_vote` หรือ `encrypted_ballot` (`constituency` / `partyList`)
     * - นำหมายเลขที่ได้ไปเทียบชื่อผู้สมัครและชื่อพรรคให้ตรงกัน 100%
     */
    async function loadMpResults() {
        if (!db) return null;

        const [finalRes, activeStagingRes, candidatesRes, partiesRes] = await Promise.all([
            db.from('mp_final_box').select('*'),
            db.from('mp_staging_box').select('voter_id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
            db.from('mp_candidates').select('*'),
            db.from('party_candidates').select('*')
        ]);

        if (finalRes.error) throw finalRes.error;

        const finalRows = finalRes.data || [];
        const pendingCount = activeStagingRes.count || 0;
        const candidates = (candidatesRes.data || []).map(c => ({
            district_code: c.district_code || c.district || 'BKK-01',
            candidate_number: Number(c.candidate_number ?? c.number ?? c.id),
            candidate_name: c.candidate_name || c.full_name_th || c.full_name || c.name || '',
            party_name: c.party_name || c.party || '',
            party_number: Number(c.party_number ?? c.number ?? 0)
        }));
        const parties = (partiesRes.data || []).map(p => ({
            party_number: Number(p.party_number ?? p.number ?? p.id),
            party_name: p.party_name || p.name || ''
        }));

        const constituencyCounts = new Map();
        const partyListCounts = new Map();
        let constituencyAbstainCount = 0;
        let partyListAbstainCount = 0;
        const ballots = [];

        for (const row of finalRows) {
            const decObj = parseJsonObject(row.decrypted_vote) || {};
            const encObj = parseJsonObject(row.encrypted_ballot) || {};

            let rawConstituency =
                row.candidate_number ??
                row.constituency_number ??
                row.constituency ??
                decObj.constituency ??
                decObj.candidate_number ??
                decObj.candidateNumber ??
                encObj.constituency ??
                encObj.candidate_number ??
                encObj.candidateNumber ??
                null;

            let rawPartyList =
                row.party_number ??
                row.partylist_number ??
                row.party_list ??
                row.partyList ??
                decObj.partyList ??
                decObj.party_list ??
                decObj.party_number ??
                decObj.partyNumber ??
                encObj.partyList ??
                encObj.party_list ??
                encObj.party_number ??
                encObj.partyNumber ??
                null;

            if (typeof rawConstituency === 'string' && rawConstituency.startsWith('ENC[')) {
                rawConstituency = await decryptTextWithAesGcm(rawConstituency);
            }
            if (typeof rawPartyList === 'string' && rawPartyList.startsWith('ENC[')) {
                rawPartyList = await decryptTextWithAesGcm(rawPartyList);
            }

            const candidateNumber = parseChoiceNumber(rawConstituency);
            const partyNumber = parseChoiceNumber(rawPartyList);
            const districtCode = row.district_code || decObj.district_code || encObj.district_code || 'BKK-01';

            ballots.push({
                districtCode,
                candidateNumber,
                partyNumber
            });

            if (candidateNumber === 'abstain') {
                constituencyAbstainCount += 1;
            } else if (candidateNumber !== null) {
                const key = `${districtCode}:${candidateNumber}`;
                constituencyCounts.set(key, (constituencyCounts.get(key) || 0) + 1);
            }

            if (partyNumber === 'abstain') {
                partyListAbstainCount += 1;
            } else if (partyNumber !== null) {
                partyListCounts.set(partyNumber, (partyListCounts.get(partyNumber) || 0) + 1);
            }
        }

        const candidateResults = candidates.map(c => {
            const votes = constituencyCounts.get(`${c.district_code}:${c.candidate_number}`) || 0;
            return {
                ...c,
                votes,
                percentage: finalRows.length > 0 ? Number(((votes / finalRows.length) * 100).toFixed(1)) : 0
            };
        });

        const partyResults = parties.map(p => {
            const votes = partyListCounts.get(p.party_number) || 0;
            return {
                ...p,
                votes,
                percentage: finalRows.length > 0 ? Number(((votes / finalRows.length) * 100).toFixed(1)) : 0
            };
        });

        resultCounts.set('house-election-2569', {
            final: finalRows.length,
            pending: pendingCount,
            total: finalRows.length + pendingCount
        });

        return {
            finalCount: finalRows.length,
            pendingCount,
            totalCount: finalRows.length + pendingCount,
            ballots,
            candidateResults,
            partyResults,
            constituencyAbstainCount,
            partyListAbstainCount
        };
    }

    /**
     * 2. ประชามติ (`loadReferendumResults()`):
     * - ดึงข้อมูลจาก `referendum_final_box`
     * - รองรับการอ่านค่า `row.decrypted_vote` (และ `encrypted_ballot` fallback) ทั้งที่เป็น String
     *   (`'approve'`, `'disapprove'`, `'abstain'`, `'เห็นชอบ'`, `'ไม่เห็นชอบ'`, `'ไม่แสดงความคิดเห็น'`)
     *   และ JSON เพื่อนำมาคำนวณผลรวมและเปอร์เซ็นต์อย่างแม่นยำ
     */
    async function loadReferendumResults() {
        if (!db) return null;

        const [finalRes, activeStagingRes] = await Promise.all([
            db.from('referendum_final_box').select('*'),
            db.from('referendum_staging_box').select('voter_id', { count: 'exact', head: true }).eq('status', 'ACTIVE')
        ]);

        if (finalRes.error) throw finalRes.error;

        const finalRows = finalRes.data || [];
        const pendingCount = activeStagingRes.count || 0;
        const counts = { approve: 0, disapprove: 0, abstain: 0 };

        for (const row of finalRows) {
            let rawVote = row.decrypted_vote ?? row.vote ?? row.choice ?? null;

            if (rawVote === null || rawVote === undefined || rawVote === '') {
                const encObj = parseJsonObject(row.encrypted_ballot);
                if (encObj) {
                    rawVote = encObj.decrypted_vote ?? encObj.choice ?? encObj.vote ?? encObj.ciphertext ?? null;
                } else {
                    rawVote = row.encrypted_ballot ?? null;
                }
            }

            if (typeof rawVote === 'object' && rawVote !== null) {
                rawVote = rawVote.choice ?? rawVote.vote ?? rawVote.decrypted_vote ?? rawVote.value ?? rawVote.ciphertext ?? '';
            }

            if (typeof rawVote === 'string' && rawVote.startsWith('ENC[')) {
                rawVote = await decryptTextWithAesGcm(rawVote);
            } else if (typeof rawVote === 'string' && rawVote.trim().startsWith('{')) {
                const parsed = parseJsonObject(rawVote);
                if (parsed) {
                    const inner = parsed.choice ?? parsed.vote ?? parsed.decrypted_vote ?? parsed.value ?? parsed.ciphertext ?? '';
                    rawVote = (typeof inner === 'string' && inner.startsWith('ENC['))
                        ? await decryptTextWithAesGcm(inner)
                        : inner;
                }
            }

            const normalized = parseReferendumChoice(rawVote);
            if (normalized && counts[normalized] !== undefined) {
                counts[normalized] += 1;
            }
        }

        const totalProcessed = finalRows.length;
        const percentages = {
            approve: totalProcessed > 0 ? Number(((counts.approve / totalProcessed) * 100).toFixed(1)) : 0,
            disapprove: totalProcessed > 0 ? Number(((counts.disapprove / totalProcessed) * 100).toFixed(1)) : 0,
            abstain: totalProcessed > 0 ? Number(((counts.abstain / totalProcessed) * 100).toFixed(1)) : 0,
        };

        resultCounts.set('referendum-2569-03', {
            final: totalProcessed,
            pending: pendingCount,
            total: totalProcessed + pendingCount
        });

        return {
            finalCount: totalProcessed,
            pendingCount,
            totalCount: totalProcessed + pendingCount,
            counts,
            percentages
        };
    }

    const fmt = value => Math.round(Number(value) || 0).toLocaleString('en-US');
    const pct = (part, total, digits = 1) => (total > 0 ? (part / total) * 100 : 0).toFixed(digits);

    function barRowHtml(nameHtml, subText, percentText, widthPct = 0) {
        const cleanSub = String(subText).replace(/^[•\s-]+/, '').trim();
        return `
            <div class="vs-bar-row">
                ${nameHtml}
                <div class="vs-bar-meta">
                    <span class="vs-bar-sub"><span class="vs-bullet" aria-hidden="true">•</span><span class="vs-bar-text">${escapeHtml(cleanSub)}</span></span>
                    <span class="vs-bar-pct">${escapeHtml(percentText)}</span>
                </div>
                <div class="vs-bar-track vs-bar"><div class="vs-bar-fill" style="width: ${widthPct}%;"></div></div>
            </div>
        `;
    }

    async function renderReferendumResults(container = document.getElementById('scoreList')) {
        const list = container || document.getElementById('scoreList');
        const results = await loadReferendumResults();
        const counts = results?.counts || { approve: 0, disapprove: 0, abstain: 0 };
        const total = results?.finalCount || 0;

        const rows = [
            { label: 'เห็นชอบ (Approve)', votes: counts.approve || 0 },
            { label: 'ไม่เห็นชอบ (Disapprove)', votes: counts.disapprove || 0 },
            { label: 'ไม่แสดงความคิดเห็น (Abstain)', votes: counts.abstain || 0 },
        ];

        const html = rows.map(row => {
            const share = total > 0 ? Number(pct(row.votes, total)) : 0;
            const shareStr = total > 0 ? pct(row.votes, total) : '0.0';
            const sub = `${row.label} ${fmt(row.votes)} ใบ (${shareStr}%)`;
            const pctStr = `คิดเป็น ${shareStr}%`;
            return barRowHtml('', sub, pctStr, share);
        }).join('');

        if (list) list.innerHTML = html;
        return html;
    }

    async function renderMpResults(container = document.getElementById('scoreList'), mpType = 'partylist', district = null) {
        const list = container || document.getElementById('scoreList');
        const results = await loadMpResults();
        let rows = [];

        if (mpType === 'constituency') {
            const candidates = results?.candidateResults || [];
            const targetDistrict = district || candidates[0]?.district_code || 'BKK-01';
            rows = candidates
                .filter(c => !targetDistrict || c.district_code === targetDistrict)
                .map(c => ({
                    label: `เบอร์ ${c.candidate_number} ${c.candidate_name} (${c.party_name})`,
                    votes: c.votes || 0,
                    number: c.candidate_number,
                }));
            rows.push({
                label: 'ไม่ประสงค์ลงคะแนน (Abstain)',
                votes: results?.constituencyAbstainCount || 0,
                number: Number.MAX_SAFE_INTEGER,
            });
        } else {
            const parties = results?.partyResults || [];
            rows = parties.map(p => ({
                label: `${p.party_name} (เบอร์ ${p.party_number})`,
                votes: p.votes || 0,
                number: p.party_number,
            }));
            rows.push({
                label: 'ไม่ประสงค์ลงคะแนน (Abstain)',
                votes: results?.partyListAbstainCount || 0,
                number: Number.MAX_SAFE_INTEGER,
            });
        }

        rows.sort((a, b) => b.votes - a.votes || a.number - b.number);

        const total = rows.reduce((sum, r) => sum + r.votes, 0);

        const html = rows.map(row => {
            const share = total > 0 ? Number(pct(row.votes, total)) : 0;
            const shareStr = total > 0 ? pct(row.votes, total) : '0.0';
            const sub = `${row.label} ${fmt(row.votes)} คะแนน (${shareStr}%)`;
            const pctStr = `คิดเป็น ${shareStr}%`;
            return barRowHtml('', sub, pctStr, share);
        }).join('');

        if (list) list.innerHTML = html;
        return html;
    }

    function updateElectionCardsDOM() {
        if (!resultList) return;
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
    }

    function initRealtime() {
        if (!db || typeof db.channel !== 'function') return;
        try {
            db.channel('realtime_vote_results')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'mp_final_box' }, () => {
                    pollResultCounts();
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'referendum_final_box' }, () => {
                    pollResultCounts();
                })
                .subscribe();
        } catch (e) {
            console.warn('Realtime subscription not available, falling back to polling', e);
        }
    }

    async function pollResultCounts() {
        if (!db) return;

        try {
            await Promise.all([
                loadMpResults(),
                loadReferendumResults(),
            ]);
            updateElectionCardsDOM();
        } catch (error) {
            console.warn('Unable to load final box counts for result list', error);
        } finally {
            window.setTimeout(pollResultCounts, POLL_MS);
        }
    }

    // เปิดให้เรียกใช้งานจากภายนอกหรือ Console ได้โดยตรง
    window.loadMpResults = loadMpResults;
    window.loadReferendumResults = loadReferendumResults;
    window.renderReferendumResults = renderReferendumResults;
    window.renderMpResults = renderMpResults;

    renderElections();
    initRealtime();
    pollResultCounts();
})();
