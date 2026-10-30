// ฐานข้อมูลกฎหมายน่ารู้ (lawsData)
// ใช้ข้อมูลชุดเดียว ไม่แยก desktop / tablet / mobile
// ควบคุมการแสดงผลและการตัดคำอัตโนมัติด้วย CSS Grid และ Semantic Chunking

const lawsData = [
	{
		id: 1,
		image: "img/Laws/1.png",
		title: '<span class="phrase">รัฐธรรมนูญ</span><span class="phrase">แห่งราชอาณาจักรไทย</span> <span class="phrase">พ.ศ. ๒๕๖๐</span>',
		description: '<span class="phrase">คือกฎหมายสูงสุด</span><span class="phrase">ในการปกครองประเทศไทย</span> <span class="phrase">ฉบับที่ ๒๐</span> <span class="phrase">ประกาศใช้บังคับ</span><span class="phrase">เมื่อวันที่ ๖ เมษายน พ.ศ. ๒๕๖๐</span> <span class="phrase">โดยผ่านการเห็นชอบ</span><span class="phrase">จากประชาชน</span><span class="phrase">ในการทำประชามติเมื่อ พ.ศ. ๒๕๕๙</span>'
	},
	{
		id: 3,
		image: "img/Laws/3.png",
		title: '<span class="phrase">การเลือกตั้งบอร์ดประกันสังคม</span> <span class="phrase">(ผู้แทนฝ่ายนายจ้าง</span><span class="phrase">และผู้แทนฝ่ายผู้ประกันตน)</span>',
		description: '<span class="phrase">ประกาศคณะกรรมการการเลือกตั้ง</span><span class="phrase">ผู้แทนฝ่ายนายจ้าง</span><span class="phrase">และผู้แทนฝ่ายผู้ประกันตน</span> <span class="phrase">เรื่อง ให้มีการเลือกตั้ง</span><span class="phrase">ผู้แทนฝ่ายนายจ้าง</span><span class="phrase">และผู้แทนฝ่ายผู้ประกันตน</span> <span class="phrase">(ลงวันที่ ๒๕ พฤษภาคม พ.ศ. ๒๕๖๙)</span>'
	},
	{
		id: 2,
		image: "img/Laws/2.png",
		title: '<span class="phrase">พรบ.ประกอบรัฐธรรมนูญ</span> <span class="phrase">ว่าด้วยการเลือกตั้ง</span><span class="phrase">สมาชิกสภาผู้แทนราษฎร</span> <span class="phrase">(ฉบับที่ ๒) พ.ศ. ๒๕๖๖</span>',
		description: '<span class="phrase">พระราชบัญญัติประกอบรัฐธรรมนูญ</span><span class="phrase">ว่าด้วยการเลือกตั้ง</span><span class="phrase">สมาชิกสภาผู้แทนราษฎร</span> <span class="phrase">(ฉบับที่ ๒) พ.ศ. ๒๕๖๖</span> <span class="phrase">คือกฎหมายแก้ไขปรับปรุง</span><span class="phrase">ระบบการเลือกตั้ง ส.ส. ของไทย</span><span class="phrase">ให้เป็นระบบบัตรเลือกตั้ง ๒ ใบ</span> <span class="phrase">จำนวน ส.ส. ๕๐๐ คน :</span> <span class="phrase">แบบแบ่งเขต ๔๐๐ คน</span> <span class="phrase">และแบบบัญชีรายชื่อ ๑๐๐ คน</span>'
	}
];

function escapeLawHtml(value) {
	return String(value).replace(/[&<>"']/g, character => ({
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	}[character]));
}

function escapeLawHtmlWithBreaks(value) {
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

const lawsList = document.getElementById('lawsList');

if (lawsList) {
	lawsList.innerHTML = lawsData.map(law => `
		<article class="NewsCard LawCard" data-law-id="${law.id}">
			<div class="NewsImageFrame">
				<img src="${escapeLawHtml(law.image)}" class="imgNewsCard" alt="">
			</div>
			<div class="NewsCardName bold">${escapeLawHtmlWithBreaks(law.title)}</div>
			<div class="NewsCardDesc LawCardDesc regular">${escapeLawHtmlWithBreaks(law.description)}</div>
		</article>`).join('');
}
