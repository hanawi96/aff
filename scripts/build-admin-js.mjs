/**
 * Nối các file JS theo đúng thứ tự public/admin/index.html rồi minify một lần.
 * Không dùng esbuild --bundle (tránh đổi tên biến toàn cục / phá onclick="...").
 *
 * Chạy: npm run build:admin-js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

/** Thứ tự khớp index.html (defer) — không query string. */
const RELATIVE_FILES = [
    'public/assets/js/config.js',
    'public/assets/js/toast-manager.js',
    'public/assets/js/timezone-utils.js',
    'public/assets/js/address-selector.js',
    'public/assets/js/orders/orders-utils.js',
    'public/assets/js/spx-export.js',
    'public/assets/js/orders/orders-address-learning.js',
    'public/assets/js/orders/orders-smart-paste.js',
    'public/assets/js/orders/orders-constants.js',
    'public/assets/js/orders/orders-ui-states.js',
    'public/assets/js/orders/orders-pagination.js',
    'public/assets/js/orders/orders-sorting.js',
    'public/assets/js/orders/orders-stats.js',
    'public/assets/js/orders/orders-data-loader.js',
    'public/assets/js/orders/orders-filters.js',
    'public/assets/js/orders/orders-bulk-actions.js',
    'public/assets/js/orders/orders-export-history.js',
    'public/assets/js/orders/orders-priority.js',
    'public/assets/js/orders/orders-table.js',
    'public/assets/js/orders/orders-status.js',
    'public/assets/js/orders/orders-products-display.js',
    'public/assets/js/orders/orders-profit-modal.js',
    'public/assets/js/orders/orders-ctv-modal.js',
    'public/assets/js/orders/orders-delete-modals.js',
    'public/assets/js/orders/orders-edit-modals.js',
    'public/assets/js/orders/orders-customer.js',
    'public/assets/js/orders/orders-chart.js',
    'public/assets/js/orders/orders-discount.js',
    'public/assets/js/orders/orders-discount-selector.js',
    'public/assets/js/orders/orders-discount-desktop-sheet.js',
    'public/assets/js/orders/orders-ctv.js',
    'public/assets/js/orders/orders-address.js',
    'public/assets/js/orders/orders-quick-add.js',
    'public/assets/js/orders/orders-product-edit.js',
    'public/assets/js/orders/orders-custom-product-modal.js',
    'public/assets/js/orders/orders-timezone-utils.js',
    'public/assets/js/orders/orders-send-later-reminder.js',
    'public/assets/js/orders/orders-duplicate.js',
    'public/assets/js/orders/orders-url-handler.js',
    'public/assets/js/orders/orders-product-management.js',
    'public/assets/js/orders/orders-add-modal-helpers.js',
    'public/assets/js/orders/orders-product-selection-modal.js',
    'public/assets/js/orders/orders-submit.js',
    'public/assets/js/orders.js',
    'public/assets/js/auth-check.js',
    'public/assets/js/orders/orders-quick-stats.js',
];

let combined = '';
for (const rel of RELATIVE_FILES) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full)) {
        throw new Error(`Thiếu file: ${rel}`);
    }
    combined += `\n/* ==== ${rel} ==== */\n`;
    combined += fs.readFileSync(full, 'utf8');
    combined += '\n;\n';
}

const result = await esbuild.transform(combined, {
    minify: true,
    loader: 'js',
    legalComments: 'none',
    target: 'es2020',
});

const outFile = path.join(root, 'public/assets/js/admin-orders.bundle.min.js');
fs.writeFileSync(outFile, result.code, 'utf8');
const kb = (Buffer.byteLength(result.code, 'utf8') / 1024).toFixed(1);
console.log(`OK: ${outFile} (${kb} KiB)`);
