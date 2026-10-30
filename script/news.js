// ฐานข้อมูลข่าวสาร (newsData)
// ใช้ข้อมูลชุดเดียว ไม่แยก desktop / tablet / mobile
// ควบคุมการแสดงผลและการตัดคำอัตโนมัติด้วย CSS Grid และ Semantic Chunking

const newsData = [
    {
        id: 1,
        image: "img/News/1.jpg",
        date: "20/10/69 , 06.00 น.",
        title: '<span class="phrase">กกต. ประกาศผลการเลือกตั้ง</span><span class="phrase">สมาชิกสภาท้องถิ่น</span><span class="phrase">และผู้บริหารท้องถิ่น</span>',
        description: "สำนักงานคณะกรรมการการเลือกตั้งเผยแพร่ประกาศผลการเลือกตั้งสมาชิกสภาท้องถิ่นและผู้บริหารท้องถิ่น ตามขั้นตอนที่กำหนดไว้ในกฎหมายเลือกตั้งท้องถิ่น โดยการประกาศผลดังกล่าวไม่ได้ตัดอำนาจของ กกต. ในการสืบสวน ไต่สวน หรือวินิจฉัย หากมีเหตุอันควรสงสัยว่าการเลือกตั้งไม่เป็นไปโดยสุจริตหรือเที่ยงธรรม"
    },
    {
        id: 2,
        image: "img/News/2.jpg",
        date: "20/09/69 , 06.00 น.",
        title: '<span class="phrase">กกต. เปิดเผยยอดเงินบริจาค</span><span class="phrase">ให้พรรคการเมือง</span> <span class="phrase">ประจำเดือนสิงหาคม 2569</span>',
        description: "กกต. เผยแพร่สรุปยอดเงินบริจาคให้พรรคการเมืองประจำเดือนสิงหาคม 2569 โดยมีพรรคการเมืองที่เกี่ยวข้อง 16 พรรค และผู้บริจาคที่บริจาคตั้งแต่ 5,000 บาท ขึ้นไป จำนวน 345 ราย รวมเป็นเงิน 12,753,990.07 บาท ข้อมูลดังกล่าวช่วยให้ประชาชนติดตามข้อมูลทางการเงินของพรรคการเมือง จากแหล่งข้อมูลทางการได้"
    },
    {
        id: 3,
        image: "img/News/3.jpg",
        date: "16/10/69 , 06.00 น.",
        title: '<span class="phrase">กกต. เผยแพร่หลักเกณฑ์</span><span class="phrase">การบริจาคเงินและทรัพย์สิน</span><span class="phrase">ให้พรรคการเมือง</span>',
        description: "กกต. เผยแพร่ข้อมูลเกี่ยวกับข้อกำหนดในการบริจาคเงิน ทรัพย์สิน หรือประโยชน์อื่นใดให้แก่พรรคการเมือง โดยเนื้อหาครอบคลุมการจัดทำหลักฐานการรับบริจาค การเปิดเผยข้อมูลผู้บริจาค และข้อจำกัดตามกฎหมาย เพื่อให้พรรคการเมือง ผู้บริจาค และประชาชนเข้าใจหลักเกณฑ์ที่เกี่ยวข้องได้อย่างถูกต้อง"
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
