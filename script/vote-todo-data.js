// ฐานข้อมูลข้อพึงปฏิบัติในการลงคะแนน (Vote-Todo Guidelines)
// ใช้ข้อมูลชุดเดียว ไม่แยก desktop / tablet / mobile
// รองรับการตัดคำแบบ Responsive และ Semantic Chunking ผ่าน <span class="phrase">

const VOTE_TODO_DATA = {
    // -------------------------------------------------------------------------
    // 1. การเลือกตั้งสมาชิกสภาผู้แทนราษฎร (ส.ส.)
    // -------------------------------------------------------------------------
    'house-election-2569': [
        {
            id: 1,
            title: '1. ลงคะแนนในที่มิดชิด',
            description: '<span class="phrase">โปรดตรวจสอบสภาพแวดล้อม</span><span class="phrase">รอบตัว</span><span class="phrase">ก่อนลงคะแนน</span> <span class="phrase">เพื่อให้มั่นใจว่า</span><span class="phrase">ไม่มีผู้อื่นมองเห็นหน้าจอ</span><span class="phrase">หรือเฝ้าดูขณะทำรายการ</span> <span class="phrase">ทั้งนี้เพื่อรักษา</span><span class="phrase">ความเป็นส่วนตัวสูงสุด</span><span class="phrase">และป้องกันไม่ให้ผู้อื่น</span><span class="phrase">ล่วงรู้เจตจำนง</span><span class="phrase">ในการเลือกตั้งของคุณ</span>'
        },
        {
            id: 2,
            title: '2. จำนวนบัตรลงคะแนน',
            description: '<span class="phrase">การลงคะแนนครั้งนี้</span><span class="phrase">ประกอบด้วย</span><span class="phrase">บัตรเลือกตั้ง 2 ใบ</span> <span class="phrase">ได้แก่ บัตรเลือกตั้ง</span><span class="phrase">สมาชิกสภาผู้แทนราษฎร</span><span class="phrase">แบบแบ่งเขตเลือกตั้ง</span> <span class="phrase">(1 ใบ)</span> <span class="phrase">และบัตรเลือกตั้ง</span><span class="phrase">สมาชิกสภาผู้แทนราษฎร</span><span class="phrase">แบบบัญชีรายชื่อ</span> <span class="phrase">(1 ใบ)</span> <span class="phrase">โดยระบบจะนำท่าน</span><span class="phrase">เข้าสู่การลงคะแนนทีละขั้นตอน</span>'
        },
        {
            id: 3,
            title: '<span class="phrase">3. ห้ามบันทึกภาพหน้าจอ</span><span class="phrase">ขณะลงคะแนน</span>',
            description: '<span class="phrase">ห้ามบันทึกภาพหน้าจอ</span> <span class="phrase">ถ่ายภาพ</span> <span class="phrase">หรือบันทึกวิดีโอ</span><span class="phrase">บัตรเลือกตั้ง</span><span class="phrase">ที่ลงคะแนนแล้ว</span> <span class="phrase">รวมถึงห้ามเผยแพร่</span><span class="phrase">ภาพดังกล่าว</span><span class="phrase">สู่สาธารณะโดยเด็ดขาด</span> <span class="phrase">การกระทำดังกล่าว</span><span class="phrase">ถือเป็นความผิด</span><span class="phrase">และมีบทลงโทษตามกฎหมาย</span><span class="phrase">ว่าด้วยการเลือกตั้ง</span>'
        },
        {
            id: 4,
            title: '4. สามารถลงคะแนนใหม่ได้',
            description: '<span class="phrase">เพื่อป้องกันการถูกบังคับ</span><span class="phrase">หรือการชี้นำ</span> <span class="phrase">หากต้องการ</span><span class="phrase">แก้ไขตัวเลือก</span> <span class="phrase">คุณสามารถ</span><span class="phrase">เข้าสู่ระบบ</span><span class="phrase">เพื่อลงคะแนนใหม่</span><span class="phrase">ได้ตลอดเวลา</span> <span class="phrase">จนถึงเวลาปิดหีบ</span> <span class="phrase">17:00 น.</span> <span class="phrase">โดยระบบจะนับ</span><span class="phrase">เฉพาะคะแนน</span><span class="phrase">จากบัตรครั้งล่าสุดของคุณเท่านั้น</span>'
        }
    ],

    // -------------------------------------------------------------------------
    // 2. การออกเสียงประชามติ
    // -------------------------------------------------------------------------
    'referendum-2569-03': [
        {
            id: 1,
            title: '1. ลงคะแนนในที่มิดชิด',
            description: '<span class="phrase">โปรดตรวจสอบสภาพแวดล้อม</span><span class="phrase">รอบตัว</span><span class="phrase">ก่อนลงคะแนน</span> <span class="phrase">เพื่อให้มั่นใจว่า</span><span class="phrase">ไม่มีผู้อื่นมองเห็นหน้าจอ</span><span class="phrase">หรือเฝ้าดูขณะทำรายการ</span> <span class="phrase">ทั้งนี้เพื่อรักษา</span><span class="phrase">ความเป็นส่วนตัวสูงสุด</span><span class="phrase">และป้องกันไม่ให้ผู้อื่น</span><span class="phrase">ล่วงรู้เจตจำนง</span><span class="phrase">ในการออกเสียงประชามติของคุณ</span>'
        },
        {
            id: 2,
            title: '2. จำนวนบัตรลงคะแนน',
            description: '<span class="phrase">การออกเสียงประชามติครั้งนี้</span><span class="phrase">มีบัตรลงคะแนน</span> <span class="phrase">1 ใบ</span> <span class="phrase">ประกอบด้วย</span><span class="phrase">คำถามประชามติ</span><span class="phrase">เพื่อให้ท่าน</span><span class="phrase">แสดงเจตจำนง</span> <span class="phrase">โดยเลือกทำเครื่องหมาย</span> <span class="phrase">"เห็นชอบ"</span> <span class="phrase">"ไม่เห็นชอบ"</span> <span class="phrase">หรือ "ไม่แสดงความคิดเห็น"</span> <span class="phrase">เพียงตัวเลือกเดียว</span><span class="phrase">ในแต่ละข้อคำถาม</span> <span class="phrase">และระบบจะนำท่าน</span><span class="phrase">เข้าสู่การลงคะแนนตามลำดับ</span>'
        },
        {
            id: 3,
            title: '<span class="phrase">3. ห้ามบันทึกภาพหน้าจอ</span><span class="phrase">ขณะลงคะแนน</span>',
            description: '<span class="phrase">ห้ามบันทึกภาพหน้าจอ</span> <span class="phrase">ถ่ายภาพ</span> <span class="phrase">หรือบันทึกวิดีโอ</span><span class="phrase">บัตรออกเสียงประชามติ</span><span class="phrase">ที่ลงคะแนนแล้ว</span> <span class="phrase">รวมถึงห้ามเผยแพร่</span><span class="phrase">ภาพดังกล่าว</span><span class="phrase">สู่สาธารณะโดยเด็ดขาด</span> <span class="phrase">การกระทำดังกล่าว</span><span class="phrase">ถือเป็นความผิด</span><span class="phrase">และมีบทลงโทษตามกฎหมาย</span><span class="phrase">ว่าด้วยการออกเสียงประชามติ</span>'
        },
        {
            id: 4,
            title: '4. สามารถลงคะแนนใหม่ได้',
            description: '<span class="phrase">เพื่อป้องกันการถูกบังคับ</span><span class="phrase">หรือการชี้นำ</span> <span class="phrase">หากต้องการ</span><span class="phrase">แก้ไขตัวเลือก</span> <span class="phrase">คุณสามารถ</span><span class="phrase">เข้าสู่ระบบ</span><span class="phrase">เพื่อลงคะแนนใหม่</span><span class="phrase">ได้ตลอดเวลา</span> <span class="phrase">จนถึงเวลาปิดหีบ</span> <span class="phrase">17:00 น.</span> <span class="phrase">โดยระบบจะนับ</span><span class="phrase">เฉพาะคะแนน</span><span class="phrase">จากบัตรครั้งล่าสุดของคุณเท่านั้น</span>'
        }
    ]
};
