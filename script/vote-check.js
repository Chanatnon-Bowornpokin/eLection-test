const electionList = document.getElementById('electionList');
const voteStatusKey = 'election-vote-status-v2';

// ล้างแคชข้อมูลการทดสอบเก่าใน LocalStorage อัตโนมัติ เพื่อให้เริ่มต้นเป็น "ยังไม่ได้ลงคะแนน" ทั้งหมด
try {
    if (localStorage.getItem('election-vote-status')) {
        localStorage.removeItem('election-vote-status');
    }
} catch (e) {
    // Ignore storage errors
}

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

function getTitle(election, device) {
    if (election[device] && election[device].title) {
        return election[device].title;
    }
    return election.title;
}

function readVoteStatus() {
    try {
        return JSON.parse(localStorage.getItem(voteStatusKey) || '{}');
    } catch {
        return {};
    }
}

function writeVoteStatus(status) {
    try {
        localStorage.setItem(voteStatusKey, JSON.stringify(status));
    } catch {
        // Keep the current page interactive when storage is unavailable.
    }
}

function isElectionClosed() {
    try {
        return localStorage.getItem('demo-election-time') === 'closed';
    } catch {
        return false;
    }
}

function setCardStatus(card, voted) {
    const statuses = card.querySelectorAll('.vote-election-status');
    const indicator = card.querySelector('.vote-election-indicator');
    const action = card.querySelector('.vote-election-action');

    const closed = isElectionClosed();
    card.classList.toggle('is-voted', voted);
    card.classList.toggle('is-closed', closed);
    statuses.forEach(status => {
        const label = voted ? 'ลงคะแนนแล้ว' : (closed ? 'ไม่ได้มาใช้สิทธิ' : 'ยังไม่ได้ลงคะแนน');
        status.textContent = label;
        status.setAttribute('aria-label', `สถานะ: ${label}`);
    });
    if (indicator) {
        indicator.classList.toggle('green', voted);
        indicator.classList.toggle('yellow', !voted && !closed);
        indicator.classList.toggle('red', !voted && closed);
    }
    if (action) {
        action.textContent = closed ? 'หมดเวลา' : (voted ? 'ลงคะแนนใหม่' : 'ลงคะแนน');
        action.disabled = closed;
        action.setAttribute('aria-pressed', String(voted));
    }
}

function renderElections() {
    if (!electionList || !Array.isArray(EVENTS)) return;

    const savedStatus = readVoteStatus();
    const voter = (typeof window.getVoter === 'function')
        ? window.getVoter()
        : (function () {
            try { return JSON.parse(localStorage.getItem('election_current_voter') || 'null'); } catch { return null; }
        })();

    // กรองการ์ดการเลือกตั้งตามสิทธิ์จริงของผู้มีสิทธิเลือกตั้ง (Eligibility UI Filtering)
    const visibleEvents = EVENTS.filter(election => {
        if (!voter) return true;
        if (typeof window.isEligibleFor === 'function') {
            return window.isEligibleFor(election.id, voter);
        }
        if (election.id === 'house-election-2569') return voter.eligible_mp !== false;
        if (election.id === 'referendum-2569-03') return voter.eligible_referendum !== false;
        return true;
    });

    if (visibleEvents.length === 0) {
        electionList.innerHTML = `
            <div class="vote-election-empty" style="text-align: center; padding: 48px 20px; color: #666;">
                <p style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #000;">ไม่พบรายการที่ท่านมีสิทธิลงคะแนน</p>
                <p style="font-size: 14px; color: #666; margin: 0;">ตามข้อมูลทะเบียน ท่านไม่มีสิทธิลงคะแนนในการเลือกตั้งหรือการออกเสียงประชามติในขณะนี้</p>
            </div>
        `;
        return;
    }

    electionList.innerHTML = visibleEvents.map(election => {
        const electionId = election.id || `${election.date}-${election.title}`;
        const date = new Intl.DateTimeFormat('th-TH', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).format(new Date(`${election.date}T00:00:00`));
        const voted = Object.hasOwn(savedStatus, electionId)
            ? Boolean(savedStatus[electionId])
            : false;
        const deadline = election.voteDeadline ? escapeHtml(election.voteDeadline) : '';

        const title = escapeHtmlWithBreaks(election.title);

        const closed = isElectionClosed();
        const statusLabel = voted ? 'ลงคะแนนแล้ว' : (closed ? 'ไม่ได้มาใช้สิทธิ' : 'ยังไม่ได้ลงคะแนน');
        return `
            <article class="vote-election-card${voted ? ' is-voted' : ''}${closed ? ' is-closed' : ''}" data-election-id="${escapeHtml(electionId)}">
                <div class="vote-election-copy">
                    <span class="vote-election-level">${escapeHtml(election.level)}</span>
                    <h2 class="vote-election-title">${title}</h2>
                    <p class="vote-election-meta">
                        <span class="vote-election-date">${escapeHtml(date)}</span>${deadline ? ` <span class="vote-election-deadline">${deadline}</span>` : ''}
                    </p>
                    <div class="vote-election-status-wrap">
                        <i class="fa-solid fa-circle vote-election-indicator status-dot ${voted ? 'green' : (closed ? 'red' : 'yellow')}" aria-hidden="true"></i>
                        <span class="vote-election-status" aria-label="สถานะ: ${statusLabel}">${statusLabel}</span>
                    </div>
                </div>
                <button class="vote-election-action" type="button" aria-pressed="${voted}"${closed ? ' disabled' : ''}>${closed ? 'หมดเวลา' : (voted ? 'ลงคะแนนใหม่' : 'ลงคะแนน')}</button>
            </article>
        `;
    }).join('');

    electionList.onclick = event => {
        const action = event.target.closest('.vote-election-action');
        if (!action || action.disabled) return;

        const card = action.closest('.vote-election-card');
        const id = card.dataset.electionId;

        // นำทางไปหน้าข้อพึงปฏิบัติ พร้อมส่ง query parameter id ไปด้วย
        window.location.href = `Vote-Todo.html?id=${encodeURIComponent(id)}`;
    };
}

// อัปเดตรายการเมื่อดึงข้อมูลผู้โหวตประจำเครื่องสำเร็จ
window.addEventListener('voter-claimed', () => {
    renderElections();
});
window.addEventListener('demo-time-changed', () => renderElections());
window.addEventListener('storage', event => {
    if (event.key === 'demo-election-time') renderElections();
});

renderElections();
