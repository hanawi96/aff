const fs = require('fs');
const raw = JSON.parse(fs.readFileSync('./public/assets/data/tree_2.json', 'utf8'));
const data = [];
for (const province of raw) {
    const provinceObj = { Id: province.code, Name: province.fullName, Wards: [] };
    if (province.wards) for (const ward of province.wards) {
        const shortLabel = ward.fullName.includes(',') ? ward.fullName.split(',')[0].trim() : ward.fullName;
        provinceObj.Wards.push({ Id: ward.code, Name: shortLabel, ShortName: ward.name });
    }
    data.push(provinceObj);
}
global.removeVietnameseTones = s => !s ? '' : s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd').replace(/\u0110/g, 'D').trim();
global.levenshteinDistance = function (a, b) { const m = []; for (let i = 0; i <= a.length; i++) m[i] = [i]; for (let j = 0; j <= b.length; j++) m[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = a[i - 1] === b[j - 1] ? m[i - 1][j - 1] : 1 + Math.min(m[i - 1][j - 1], m[i][j - 1], m[i - 1][j]); return m[a.length][b.length]; };
function getVietnamAddressData() { return data; }
eval(fs.readFileSync('./scripts/parse-address-v3-block.js', 'utf8'));

// Cùng 1 địa chỉ, 3 biến thể: (a) chuẩn có keyword, (b) bỏ keyword + bỏ dấu phẩy, (c) viết tắt
const cases = [
  ['198/8 nguyễn bỉnh khiêm, phường vĩnh quang, tp rạch giá, kiên giang'],
  ['198/8 nguyen binh khiem vinh quang rach gia kien giang'],
  ['số 5 lê lợi vị thanh hậu giang'],
  ['12 trần phú phường lộc thọ nha trang khánh hòa'],
  ['12 tran phu loc tho nha trang khanh hoa'],
  ['45 hai bà trưng phường 6 đà lạt lâm đồng'],
  ['nhà 7 ngõ 3 cầu giấy hà nội'],
  ['thôn 2 xã ea kly krông pắc đắk lắk'],
  ['thon 2 ea kly krong pac dak lak'],
  ['25 nguyễn huệ bến nghé quận 1 tphcm'],
  ['25 nguyen hue ben nghe q1 hcm'],
  ['so 10 hung vuong phuong dien hong pleiku gia lai'],
  ['15 lê duẩn phường tân an buôn ma thuột daklak'],
  ['kp1 p tân đông hiệp dĩ an bình dương'],
];
(async () => {
  for (const [addr] of cases) {
    const r = await parseAddress(addr);
    console.log('IN :', addr);
    console.log('OUT: P=' + (r.province?.Name||'-') + ' | W=' + (r.ward?.Name||'-') + ' | street=' + (r.street||'-') + ' | ' + r.confidence);
    console.log('');
  }
})();
