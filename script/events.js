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
