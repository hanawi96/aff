/**
 * Test parseAddress v3 against tree_2.json (2 cấp)
 * Run: node scripts/test-parse-address.js
 */
const fs = require('fs');

const raw = JSON.parse(fs.readFileSync('./public/assets/data/tree_2.json', 'utf8'));
const data = [];
for (const province of raw) {
    const provinceObj = { Id: province.code, Name: province.fullName, Wards: [] };
    if (province.wards) {
        for (const ward of province.wards) {
            const shortLabel = ward.fullName.includes(',')
                ? ward.fullName.split(',')[0].trim()
                : ward.fullName;
            provinceObj.Wards.push({ Id: ward.code, Name: shortLabel, ShortName: ward.name });
        }
    }
    data.push(provinceObj);
}

global.removeVietnameseTones = function (str) {
    if (!str) return '';
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd').replace(/\u0110/g, 'D').trim();
};
global.levenshteinDistance = function (a, b) {
    const m = [];
    for (let i = 0; i <= a.length; i++) m[i] = [i];
    for (let j = 0; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            m[i][j] = a[i - 1] === b[j - 1]
                ? m[i - 1][j - 1]
                : 1 + Math.min(m[i - 1][j - 1], m[i][j - 1], m[i - 1][j]);
        }
    }
    return m[a.length][b.length];
};
function getVietnamAddressData() { return data; }

const block = fs.readFileSync('./scripts/parse-address-v3-block.js', 'utf8');
eval(block);

const tests = [
    { addr: '221/1 phan huy ich phuong 14 go vap tphcm', exp: ['Ho Chi Minh', 'Go Vap'] },
    { addr: '88 Quang Trung G/Vap HCM', exp: ['Ho Chi Minh', 'Go Vap'] },
    { addr: '135 Nguyen Van Linh noi dai, Q8, HCM', exp: ['Ho Chi Minh'] },
    { addr: '595/15f cmt8 p15 quan 10 tphcm', exp: ['Ho Chi Minh'] },
    { addr: 'xom 4, Dong Cao, Me Linh, Ha Noi', exp: ['Ha Noi', 'Me Linh'] },
    { addr: 'Ap3 xa Phuoc van huyen Can Duoc tinh Long An', exp: ['Tay Ninh', 'Long An'] },
    { addr: '346a Huynh Van Luy, p.Phu Loi, tp TDM, BD', exp: ['Ho Chi Minh', 'Phu Loi'] },
    { addr: 'So nha 23, Ap 1, xa Tan Loc, Thoi Binh, Ca Mau', exp: ['Ca Mau'] },
    { addr: '175 Minh Khai - Dong Ngan - Tu Son - Bac Ninh', exp: ['Bac Ninh', 'Tu Son'] },
    { addr: '47/11 Bui Minh Truc p6,q8 , tpHCM', exp: ['Ho Chi Minh'] },
    { addr: '249/11 Ly Thai To p9q10 tphcm', exp: ['Ho Chi Minh'] },
    { addr: '567/12 Xo Viet Nghe Tinh B/Thanh', exp: ['Ho Chi Minh', 'Binh Thanh'] },
    { addr: 'Hùng hữu mai tdp 10, nguyên trường tộ, ninh hiệp,ninh hòa khanh hòa', exp: ['Khanh Hoa', 'Ninh Hoa'] },
    { addr: 'khu pho Hai Son phuong Phuoc hoa thi xa Phu My brvt', exp: ['Ho Chi Minh', 'Phuoc Hoa'] },
    { addr: 'ngõ 268, 2/20 trần quang khải, Phường Nam Định, Tỉnh Ninh Bình', exp: ['Ninh Bình', 'Nam Định'] },
    { addr: 'Đội 4 ấp đông kim, Xã Thống Nhất, Tỉnh Đồng Nai', exp: ['Đồng Nai', 'Thống Nhất'] },
];

(async () => {
    let pass = 0;
    for (const t of tests) {
        const r = await parseAddress(t.addr);
        const pn = removeVietnameseTones(r.province?.Name || '').toLowerCase();
        const wn = removeVietnameseTones(r.ward?.Name || '').toLowerCase();
        const sn = removeVietnameseTones(r.ward?.ShortName || '').toLowerCase();
        const ok = t.exp.every((e) => {
            const en = removeVietnameseTones(e).toLowerCase();
            return pn.includes(en) || wn.includes(en) || sn.includes(en);
        });
        if (ok) pass++;
        console.log((ok ? 'OK' : 'FAIL') + ` [${r.confidence}] ${t.addr}`);
        console.log(`   => P:${r.province?.Name || '-'} | W:${r.ward?.Name || '-'}`);
        if (!ok) console.log(`   EXPECTED: ${t.exp.join(', ')}`);
    }
    console.log(`\nRESULT: ${pass}/${tests.length} passed`);
    process.exit(pass === tests.length ? 0 : 1);
})();
