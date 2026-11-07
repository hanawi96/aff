// Feedback track — chỉ lazy-load ảnh (scroll-snap thuần CSS)
(function () {
    'use strict';

    const track = document.getElementById('feedbackCarousel');
    if (!track) return;

    const images = track.querySelectorAll('img.lazy[data-src]');
    if (!images.length) return;

    function loadImg(img) {
        if (!img || img.classList.contains('loaded')) return;
        const src = img.getAttribute('data-src');
        if (!src) return;
        img.src = src;
        img.removeAttribute('data-src');
        img.classList.add('loaded');
    }

    if (!('IntersectionObserver' in window)) {
        images.forEach(loadImg);
        return;
    }

    const io = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                loadImg(entry.target);
                io.unobserve(entry.target);
            }
        },
        { root: track, rootMargin: '120px 80px', threshold: 0.01 }
    );

    images.forEach((img) => io.observe(img));
    // Ảnh đầu luôn load sớm
    loadImg(images[0]);
    if (images[1]) loadImg(images[1]);
})();
