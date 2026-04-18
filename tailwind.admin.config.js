/** @type {import('tailwindcss').Config} */
/** Cấu hình riêng trang admin đơn (index) — không ảnh hưởng build shop. */
module.exports = {
    content: [
        './public/admin/index.html',
        './public/assets/js/**/*.js',
    ],
    theme: {
        extend: {
            colors: {
                'admin-primary': '#6366f1',
                'admin-secondary': '#8b5cf6',
                'admin-success': '#10b981',
                'admin-warning': '#f59e0b',
                'admin-danger': '#ef4444',
            },
        },
    },
    plugins: [],
};
