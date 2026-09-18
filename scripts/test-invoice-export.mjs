import fs from 'fs';
import XLSX from 'xlsx';
import vm from 'vm';

const code = fs.readFileSync('public/assets/js/invoice-export.js', 'utf8');
const sandbox = { XLSX, console };
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const { createInvoiceExcelWorkbook, INVOICE_EXCEL_HEADERS } = sandbox;

const template = XLSX.readFile('assets/MauUploadHD.xlsx');
const templateHeaders = XLSX.utils.sheet_to_json(template.Sheets['Hóa đơn'], { header: 1 })[0];

const orders = [
    {
        id: 1,
        order_id: 'DH001',
        customer_name: 'Nguyen Van A',
        address: '123 Duong ABC, Phuong 1, Quan 1, TP HCM',
        payment_method: 'cod',
        created_at_unix: Date.now(),
        products: JSON.stringify([
            { product_id: 10, name: 'Ao thun', quantity: 2, price: 100000, size: 'M' },
            { product_id: 11, name: 'Quan', quantity: 1, price: 150000, weight: '500g' },
        ]),
    },
    {
        id: 2,
        order_id: 'DH002',
        payment_method: 'bank_transfer',
        total_amount: 250000,
        products: null,
    },
];

const { wb, filename, rowCount } = createInvoiceExcelWorkbook(orders);
const data = XLSX.utils.sheet_to_json(wb.Sheets['Hóa đơn']);

console.log('headers match template:', JSON.stringify(INVOICE_EXCEL_HEADERS) === JSON.stringify(templateHeaders));
console.log('filename pattern:', filename);
console.log('rowCount:', rowCount, 'expected 3 (2 products + 1 fallback)');
console.log('sheet names:', wb.SheetNames.join(', '));
console.log('sample row keys filled:', Object.entries(data[0]).filter(([, v]) => v !== '').map(([k]) => k).join(', '));
console.log('MaHD same per order:', data[0].MaHD === data[1].MaHD && data[0].MaHD !== data[2].MaHD);
console.log('payment CK:', data[2].PhuongThucTT);
