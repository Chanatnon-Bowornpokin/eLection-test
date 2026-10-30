// supabase-client.js
const SUPABASE_URL = 'https://nzobdkybbpufntionuze.supabase.co/';
const SUPABASE_ANON_KEY = 'sb_publishable_xBBzY0PXxUVWx4fINXBk3w_UwSEywAq'; // ใส่คีย์เต็มที่ก๊อปมา

// สร้าง Client กลางสำหรับเรียกใช้ในทุกหน้า
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);