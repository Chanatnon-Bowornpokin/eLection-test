// ฐานข้อมูลกฎหมายน่ารู้ (lawsData)
// ใช้ข้อมูลชุดเดียว ไม่แยก desktop / tablet / mobile
// ควบคุมการแสดงผลและการตัดคำอัตโนมัติด้วย CSS Grid และ Semantic Chunking

const lawsData = [
	{
		id: 1,
		image: "img/Laws/1.png",
		title: '<span class="phrase">รัฐธรรมนูญแห่งราชอาณาจักรไทย</span> <span class="phrase">พ.ศ. ๒๕๖๐</span>',
		description: "คือกฎหมายสูงสุดในการปกครองประเทศไทย ฉบับที่ ๒๐ ประกาศใช้บังคับเมื่อวันที่ ๖ เมษายน พ.ศ. ๒๕๖๐ โดยผ่านการเห็นชอบจากประชาชนในการทำประชามติเมื่อ พ.ศ. ๒๕๕๙"
	},
	{
		id: 3,
		image: "img/Laws/3.png",
		title: '<span class="phrase">การเลือกตั้งบอร์ดประกันสังคม</span> <span class="phrase">(ผู้แทนฝ่ายนายจ้างและผู้แทนฝ่ายผู้ประกันตน)</span>',
		description: "ประกาศคณะกรรมการการเลือกตั้งผู้แทนฝ่ายนายจ้างและผู้แทนฝ่ายผู้ประกันตน เรื่อง ให้มีการเลือกตั้งผู้แทนฝ่ายนายจ้างและผู้แทนฝ่ายผู้ประกันตน (ลงวันที่ ๒๕ พฤษภาคม พ.ศ. ๒๕๖๙)"
	},
	{
		id: 2,
		image: "img/Laws/2.png",
		title: '<span class="phrase">พรบ.ประกอบรัฐธรรมนูญ</span> <span class="phrase">ว่าด้วยการเลือกตั้ง</span><span class="phrase">สมาชิกสภาผู้แทนราษฎร</span> <span class="phrase">(ฉบับที่ ๒) พ.ศ. ๒๕๖๖</span>',
		description: "พระราชบัญญัติประกอบรัฐธรรมนูญว่าด้วยการเลือกตั้งสมาชิกสภาผู้แทนราษฎร (ฉบับที่ ๒) พ.ศ. ๒๕๖๖ คือกฎหมายแก้ไขปรับปรุงระบบการเลือกตั้ง ส.ส. ของไทยให้เป็น ระบบบัตรเลือกตั้ง ๒ ใบ จำนวน ส.ส. ๕๐๐ คน : แบบแบ่งเขต ๔๐๐ คน และแบบบัญชีรายชื่อ ๑๐๐ คน"
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
