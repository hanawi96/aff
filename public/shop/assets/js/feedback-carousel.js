// Feedback — hiện ảnh khi load xong (skeleton CSS trên slide)
(function () {
    'use strict';

    const track = document.getElementById('feedbackCarousel');
    if (!track) return;

    function reveal(img) {
        img.classList.add('is-loaded');
    }

    track.querySelectorAll('img.feedback-image').forEach((img) => {
        if (img.complete && img.naturalWidth > 0) {
            reveal(img);
            return;
        }
        img.addEventListener('load', () => reveal(img), { once: true });
        img.addEventListener('error', () => reveal(img), { once: true });
    });
})();
