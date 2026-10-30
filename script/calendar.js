const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

const FAKE_TODAY = '2026-02-01';

const titleEl = document.getElementById('calTitle');
const gridEl = document.getElementById('calGrid');
const listEl = document.getElementById('upcomingList');

const pad = n => String(n).padStart(2, '0');
const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function escWithBreaks(s) {
    if (!s) return '';
    return String(s)
        .replace(/<span\s+class=["']phrase["']>([\s\S]*?)<\/span>/gi, '###SPAN_PHRASE_START###$1###SPAN_PHRASE_END###')
        .replace(/<wbr\s*\/?>/gi, '###WBR###')
        .replace(/<br\s*\/?>/gi, '###BR###')
        .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
        .replace(/###SPAN_PHRASE_START###/g, '<span class="phrase">')
        .replace(/###SPAN_PHRASE_END###/g, '</span>')
        .replace(/###WBR###/g, '<wbr>')
        .replace(/###BR###/g, '<br>');
}

const now = FAKE_TODAY ? new Date(FAKE_TODAY + 'T00:00:00') : new Date();
const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const eventDates = new Set(EVENTS.map(e => e.date));

let view = new Date(now.getFullYear(), now.getMonth(), 1);

function renderCalendar() {
    const y = view.getFullYear();
    const m = view.getMonth();
    const firstWeekday = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const weeks = Math.ceil((firstWeekday + daysInMonth) / 7);   // 4, 5 หรือ 6

    titleEl.textContent = `${MONTHS[m]} ${y}`;
    gridEl.style.setProperty('--weeks', weeks);

    let html = DAYS.map(d => `<div class="cal-dow">${d}</div>`).join('');
    for (let i = 0; i < weeks * 7; i++) {
        const day = i - firstWeekday + 1;
        if (day < 1 || day > daysInMonth) {
            html += '<div class="cal-day"></div>';
            continue;
        }
        const key = `${y}-${pad(m + 1)}-${pad(day)}`;
        const cls = eventDates.has(key) ? 'cal-mark has-event' : 'cal-mark';
        html += `<div class="cal-day"><span class="${cls}">${day}</span></div>`;
    }
    gridEl.innerHTML = html;
}

function renderUpcoming() {
    const upcoming = EVENTS
        .filter(e => e.date >= todayKey)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5);

    if (upcoming.length === 0) {
        listEl.innerHTML = '<div class="event-empty">ไม่มีกำหนดการที่กำลังจะมาถึง</div>';
        return;
    }

    listEl.innerHTML = upcoming.map(e => {
        const [, mm, dd] = e.date.split('-');
        const title = escWithBreaks(e.calendarTitle || e.title);

        return `
        <div class="eventCard">
            <div class="datesec">
                <div class="datesec-month">${MONTHS[+mm - 1].slice(0, 3)}</div>
                <div class="datesec-day">${dd}</div>
            </div>
            <div class="event-level">${esc(e.level)}</div>
            <div class="event-name">${title}</div>
            <div class="event-time">${esc(e.time)}</div>
        </div>`;
    }).join('');
}

document.getElementById('calPrev').onclick = () => { view.setMonth(view.getMonth() - 1); renderCalendar(); };
document.getElementById('calNext').onclick = () => { view.setMonth(view.getMonth() + 1); renderCalendar(); };

renderCalendar();
renderUpcoming();
