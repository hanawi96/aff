/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './public/shop/**/*.html',
        './public/shop/**/*.js',
    ],
    theme: {
        extend: {
            colors: {
                primary: '#f4a261',
                secondary: '#e76f51',
                accent: '#e9c46a',
                warm: '#f8edeb',
                soft: '#fec89a',
            },
            fontFamily: {
                handwritten: ['Pacifico', 'cursive'],
                body: ['Quicksand', 'sans-serif'],
            },
        },
    },
    plugins: [],
};
