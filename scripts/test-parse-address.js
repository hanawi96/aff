const fs = require('fs');
const tree = JSON.parse(fs.readFileSync('./public/assets/data/tree.json', 'utf8'));

// Build addressSelector.data format
const data = [];
Object.entries(tree).forEach(([pc, pv]) => {
    const po = { Id: pc, Name: pv.name_with_type, Districts: [] };
    if (pv['quan-huyen']) Object.entries(pv['quan-huyen']).forEach(([dc, dv]) => {
        const dobj = { Id: dc, Name: dv.name_with_type, Wards: [] };
        if (dv['xa-phuong']) Object.entries(dv['xa-phuong']).forEach(([wc, wv]) => {
            dobj.Wards.push({ Id: wc, Name: wv.name_with_type, Level: wv.type });
        });
        po.Districts.push(dobj);
    });
    data.push(po);
});

// Mock globals
global.removeVietnameseTones = function(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u0111/g,'d').replace(/\u0110/g,'D');
};
global.levenshteinDistance = function(a,b) {
    const m=[]; for(let i=0;i<=a.length;i++) m[i]=[i];
    for(let j=0;j<=b.length;j++) m[0][j]=j;
    for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++)
        m[i][j]=a[i-1]===b[j-1]?m[i-1][j-1]:1+Math.min(m[i-1][j-1],m[i][j-1],m[i-1][j]);
    return m[a.length][b.length];
};
function getVietnamAddressData() { return data; }

// Load v2
const code = fs.readFileSync('./scripts/parse-address-v2.js', 'utf8');
eval(code);

const tests = [
    { addr: '221/1 phan huy ich phuong 14 go vap',          exp: ['Go Vap','Phuong 14'] },
    { addr: 'Ap3 xa Phuoc van huyen Can Duoc tinh Long An',  exp: ['Long An','Can Duoc','Phuoc Van'] },
    { addr: 'xom 4, Dong Cao, Me Linh, Ha Noi',             exp: ['Ha Noi','Me Linh'] },
    { addr: '595/15f cmt8 p15 quan 10',                     exp: ['Ho Chi Minh','Quan 10','Phuong 15'] },
    { addr: 'Khom 3 thi tran Nam Can Ca Mau',               exp: ['Ca Mau','Nam Can'] },
    { addr: 'Cong ty formosa ky lien ky anh ha tinh',       exp: ['Ha Tinh'] },
    { addr: '135/17/43 Nguyen Huu Canh, P. 22., Q. B/Thanh', exp: ['Ho Chi Minh','Binh Thanh','Phuong 22'] },
    { addr: 'so 41, thon 4 tt easup huyen easup tinh daklak', exp: ['Dak Lak','Ea Sup'] },
    { addr: '135 Nguyen Van Linh noi dai, Q8, HCM',         exp: ['Ho Chi Minh','Quan 8'] },
    { addr: '88 Quang Trung G/Vap HCM',                     exp: ['Ho Chi Minh','Go Vap'] },
    { addr: 'xa Phuoc Hoa Phu Giao Binh Duong',             exp: ['Binh Duong','Phu Giao','Phuoc Hoa'] },
    { addr: '346a Huynh Van Luy, p.Phu Loi, tp TDM, BD',   exp: ['Binh Duong','Thu Dau Mot','Phu Loi'] },
    { addr: 'Khu pho 3 Tan lap Bac Tan Uyen Binh Duong',   exp: ['Binh Duong','Bac Tan Uyen'] },
    { addr: '59 phan huy ich Phu hoai phan thiet',          exp: ['Binh Thuan','Phan Thiet'] },
    { addr: 'xom1 xa thanh long huyen thanh chuong tinh nghe an', exp: ['Nghe An','Thanh Chuong','Thanh Long'] },
    { addr: 'thon Tan Duong xa Nhon an thi xa An Nhon tinh Binh Dinh', exp: ['Binh Dinh','An Nhon','Nhon An'] },
    { addr: 'so47/26 duong bui van binh phuong phu loi thanh pho thu dau mot', exp: ['Binh Duong','Thu Dau Mot','Phu Loi'] },
    { addr: 'Dong cao xa trang viet',                        exp: ['Me Linh','Trang Viet'] },
    { addr: 'cho cukty xa cukty krong bong daklak',         exp: ['Dak Lak','Krong Bong','Cu Kty'] },
    { addr: 'So nha 23, Ap 1, xa Tan Loc, Thoi Binh',       exp: ['Ca Mau','Thoi Binh','Tan Loc'] },
    { addr: 'khu pho Hai Son phuong Phuoc hoa thi xa Phu My brvt', exp: ['Ba Ria','Phu My','Phuoc Hoa'] },
    { addr: '567/12 Xo Viet Nghe Tinh B/Thanh',             exp: ['Ho Chi Minh','Binh Thanh'] },
];

(async () => {
    let pass = 0, total = tests.length;
    for (const t of tests) {
        const r = await parseAddress(t.addr);
        const pn = removeVietnameseTones(r.province?.Name || '').toLowerCase();
        const dn = removeVietnameseTones(r.district?.Name || '').toLowerCase();
        const wn = removeVietnameseTones(r.ward?.Name || '').toLowerCase();
        
        const ok = t.exp.every(e => {
            const en = removeVietnameseTones(e).toLowerCase();
            return pn.includes(en) || dn.includes(en) || wn.includes(en);
        });
        if (ok) pass++;
        
        const icon = ok ? '\u2705' : '\u274C';
        console.log(icon + ' [' + r.confidence + '] ' + t.addr);
        console.log('   => ' + [r.province?.Name, r.district?.Name, r.ward?.Name].filter(Boolean).join(' | '));
        if (!ok) console.log('   EXPECTED: ' + t.exp.join(', '));
        console.log('');
    }
    console.log('RESULT: ' + pass + '/' + total + ' passed');
})();
