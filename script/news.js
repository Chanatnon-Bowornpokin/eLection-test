// ฐานข้อมูลข่าวสาร (newsData)
// ใช้ข้อมูลชุดเดียว ไม่แยก desktop / tablet / mobile
// ควบคุมการแสดงผลและการตัดคำอัตโนมัติด้วย CSS Grid และ Semantic Chunking

const newsData = [
    {
        id: 1,
        image: "img/News/1.jpg",
        date: "20/10/69 , 06.00 น.",
        title: '<span class="phrase">กกต. ประกาศผลการเลือกตั้ง</span><span class="phrase">สมาชิกสภาท้องถิ่น</span><span class="phrase">และผู้บริหารท้องถิ่น</span>',
        description: '<span class="phrase">สำนักงานคณะกรรมการการเลือกตั้ง</span><span class="phrase">เผยแพร่ประกาศ</span><span class="phrase">ผลการเลือกตั้ง</span><span class="phrase">สมาชิกสภาท้องถิ่น</span><span class="phrase">และผู้บริหารท้องถิ่น</span> <span class="phrase">ตามขั้นตอนที่กำหนดไว้</span><span class="phrase">ในกฎหมายเลือกตั้งท้องถิ่น</span> <span class="phrase">โดยการประกาศผลดังกล่าว</span><span class="phrase">ไม่ได้ตัดอำนาจของ กกต.</span> <span class="phrase">ในการสืบสวน ไต่สวน</span> <span class="phrase">หรือวินิจฉัย</span> <span class="phrase">หากมีเหตุอันควรสงสัยว่า</span><span class="phrase">การเลือกตั้งไม่เป็นไป</span><span class="phrase">โดยสุจริตหรือเที่ยงธรรม</span>'
    },
    {
        id: 2,
        image: "img/News/2.jpg",
        date: "20/09/69 , 06.00 น.",
        title: '<span class="phrase">กกต. เปิดเผยยอดเงินบริจาค</span><span class="phrase">ให้พรรคการเมือง</span> <span class="phrase">ประจำเดือนสิงหาคม 2569</span>',
        description: '<span class="phrase">กกต. เผยแพร่สรุป</span><span class="phrase">ยอดเงินบริจาค</span><span class="phrase">ให้พรรคการเมือง</span><span class="phrase">ประจำเดือนสิงหาคม 2569</span> <span class="phrase">โดยมีพรรคการเมือง</span><span class="phrase">ที่เกี่ยวข้อง 16 พรรค</span> <span class="phrase">และผู้บริจาค</span><span class="phrase">ที่บริจาคตั้งแต่ 5,000 บาท ขึ้นไป</span> <span class="phrase">จำนวน 345 ราย</span> <span class="phrase">รวมเป็นเงิน 12,753,990.07 บาท</span> <span class="phrase">ข้อมูลดังกล่าว</span><span class="phrase">ช่วยให้ประชาชน</span><span class="phrase">ติดตามข้อมูลทางการเงิน</span><span class="phrase">ของพรรคการเมือง</span> <span class="phrase">จากแหล่งข้อมูลทางการได้</span>'
    },
    {
        id: 3,
        image: "img/News/3.jpg",
        date: "16/10/69 , 06.00 น.",
        title: '<span class="phrase">กกต. เผยแพร่หลักเกณฑ์</span><span class="phrase">การบริจาคเงินและทรัพย์สิน</span><span class="phrase">ให้พรรคการเมือง</span>',
        description: '<span class="phrase">กกต. เผยแพร่ข้อมูล</span><span class="phrase">เกี่ยวกับข้อกำหนด</span><span class="phrase">ในการบริจาคเงิน</span> <span class="phrase">ทรัพย์สิน</span> <span class="phrase">หรือประโยชน์อื่นใด</span><span class="phrase">ให้แก่พรรคการเมือง</span> <span class="phrase">โดยเนื้อหาครอบคลุม</span><span class="phrase">การจัดทำหลักฐาน</span><span class="phrase">การรับบริจาค</span> <span class="phrase">การเปิดเผยข้อมูลผู้บริจาค</span> <span class="phrase">และข้อจำกัดตามกฎหมาย</span> <span class="phrase">เพื่อให้พรรคการเมือง</span> <span class="phrase">ผู้บริจาค</span> <span class="phrase">และประชาชน</span><span class="phrase">เข้าใจหลักเกณฑ์</span><span class="phrase">ที่เกี่ยวข้องได้อย่างถูกต้อง</span>'
    }
];

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[character]));
}

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

const newsList = document.getElementById('newsList');

if (newsList) {
    newsList.innerHTML = newsData.map(news => `
        <article class="NewsCard" data-news-id="${news.id}">
            <div class="NewsImageFrame">
                <img src="${escapeHtml(news.image)}" class="imgNewsCard" alt="">
            </div>
            <div class="NewsCardDate exLight">${escapeHtml(news.date)}</div>
            <div class="NewsCardName bold">${escapeHtmlWithBreaks(news.title)}</div>
            <div class="NewsCardDesc regular">${escapeHtmlWithBreaks(news.description)}</div>
        </article>`).join('');
}
