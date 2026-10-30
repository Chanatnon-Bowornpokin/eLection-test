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
    return String(value)
        .split(/<br\s*\/?>/i)
        .map(escapeHtml)
        .join('<br>');
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

function setCardStatus(card, voted) {
    const statuses = card.querySelectorAll('.vote-election-status');
    const indicator = card.querySelector('.vote-election-indicator');
    const action = card.querySelector('.vote-election-action');

    card.classList.toggle('is-voted', voted);
    statuses.forEach(status => {
        status.textContent = voted ? 'ลงคะแนนแล้ว' : 'ยังไม่ได้ลงคะแนน';
        status.setAttribute('aria-label', voted ? 'สถานะ: ลงคะแนนแล้ว' : 'สถานะ: ยังไม่ได้ลงคะแนน');
    });
    if (indicator) {
        indicator.src = voted
            ? '../img/Custom-Icon/vote-status-cast.svg'
            : '../img/Custom-Icon/vote-status-pending.svg';
    }
    if (action) {
        action.textContent = voted ? 'ลงคะแนนใหม่' : 'ลงคะแนน';
        action.setAttribute('aria-pressed', String(voted));
    }
}

function renderElections() {
    if (!electionList || !Array.isArray(EVENTS)) return;

    const savedStatus = readVoteStatus();
    electionList.innerHTML = EVENTS.map(election => {
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

        const titleDesktop = escapeHtmlWithBreaks(getTitle(election, 'desktop'));
        const titleTablet = escapeHtmlWithBreaks(getTitle(election, 'tablet'));
        const titleMobile = escapeHtmlWithBreaks(getTitle(election, 'mobile'));

        return `
            <article class="vote-election-card${voted ? ' is-voted' : ''}" data-election-id="${escapeHtml(electionId)}">
                <div class="vote-election-copy">
                    <span class="vote-election-level">${escapeHtml(election.level)}</span>
                    <h2 class="vote-election-title vote-election-title--desktop">${titleDesktop}</h2>
                    <h2 class="vote-election-title vote-election-title--tablet">${titleTablet}</h2>
                    <h2 class="vote-election-title vote-election-title--mobile">${titleMobile}</h2>
                    <p class="vote-election-meta">
                        <span class="vote-election-date">${escapeHtml(date)}</span>${deadline ? ` <span class="vote-election-deadline">${deadline}</span>` : ''}
                    </p>
                    <div class="vote-election-status-wrap">
                        <img class="vote-election-indicator" src="../img/Custom-Icon/${voted ? 'vote-status-cast' : 'vote-status-pending'}.svg" alt="">
                        <span class="vote-election-status" aria-label="สถานะ: ${voted ? 'ลงคะแนนแล้ว' : 'ยังไม่ได้ลงคะแนน'}">${voted ? 'ลงคะแนนแล้ว' : 'ยังไม่ได้ลงคะแนน'}</span>
                    </div>
                </div>
                <button class="vote-election-action" type="button" aria-pressed="${voted}">${voted ? 'ลงคะแนนใหม่' : 'ลงคะแนน'}</button>
            </article>
        `;
    }).join('');

    electionList.addEventListener('click', event => {
        const action = event.target.closest('.vote-election-action');
        if (!action) return;

        const card = action.closest('.vote-election-card');
        const id = card.dataset.electionId;

        // นำทางไปหน้าข้อพึงปฏิบัติ พร้อมส่ง query parameter id ไปด้วย
        window.location.href = `Vote-Todo.html?id=${encodeURIComponent(id)}`;
    });
}

renderElections();
