// Feedback Carousel - Optimized for Mobile with Lazy Loading
(function() {
    'use strict';

    class FeedbackCarousel {
        constructor() {
            this.carousel = document.getElementById('feedbackCarousel');
            if (!this.carousel) return;

            this.slides = Array.from(this.carousel.querySelectorAll('.feedback-slide'));
            this.currentIndex = 0;
            this.touchStartX = 0;
            this.touchEndX = 0;
            this.autoPlayInterval = null;
            this.autoPlayDelay = 5000; // 5 seconds

            this.init();
        }

        init() {
            // Create dots
            this.createDots();
            
            // Show first slide
            this.showSlide(0);
            
            // Lazy load first image
            this.lazyLoadImage(0);
            
            // Preload next image
            if (this.slides.length > 1) {
                setTimeout(() => this.lazyLoadImage(1), 500);
            }
            
            // Setup navigation
            this.setupNavigation();
            
            // Setup touch events
            this.setupTouchEvents();
            
            // Setup keyboard navigation
            this.setupKeyboardNavigation();
            
            // Start autoplay
            this.startAutoPlay();
            
            // Pause autoplay on hover (desktop)
            this.carousel.addEventListener('mouseenter', () => this.stopAutoPlay());
            this.carousel.addEventListener('mouseleave', () => this.startAutoPlay());
        }

        createDots() {
            const dotsContainer = document.getElementById('feedbackDots');
            if (!dotsContainer) return;

            this.slides.forEach((_, index) => {
                const dot = document.createElement('div');
                dot.className = 'feedback-dot';
                dot.setAttribute('aria-label', `Xem ảnh ${index + 1}`);
                dot.addEventListener('click', () => {
                    this.showSlide(index);
                    this.stopAutoPlay();
                    this.startAutoPlay();
                });
                dotsContainer.appendChild(dot);
            });

            this.dots = Array.from(dotsContainer.querySelectorAll('.feedback-dot'));
        }

        showSlide(index) {
            // Remove active class from all slides
            this.slides.forEach(slide => slide.classList.remove('active'));
            
            // Remove active class from all dots
            if (this.dots) {
                this.dots.forEach(dot => dot.classList.remove('active'));
            }

            // Add active class to current slide
            this.slides[index].classList.add('active');
            
            // Add active class to current dot
            if (this.dots && this.dots[index]) {
                this.dots[index].classList.add('active');
            }

            this.currentIndex = index;

            // Lazy load current and next images
            this.lazyLoadImage(index);
            const nextIndex = (index + 1) % this.slides.length;
            setTimeout(() => this.lazyLoadImage(nextIndex), 300);
        }

        lazyLoadImage(index) {
            const slide = this.slides[index];
            if (!slide) return;

            const img = slide.querySelector('img.lazy');
            if (!img || img.classList.contains('loaded')) return;

            const src = img.getAttribute('data-src');
            if (!src) return;

            // Create a new image to preload
            const tempImg = new Image();
            tempImg.onload = () => {
                img.src = src;
                img.classList.add('loaded');
            };
            tempImg.onerror = () => {
                console.error('Failed to load image:', src);
                img.classList.add('loaded'); // Still mark as loaded to remove skeleton
            };
            tempImg.src = src;
        }

        setupNavigation() {
            const prevBtn = document.getElementById('feedbackPrev');
            const nextBtn = document.getElementById('feedbackNext');

            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    this.prevSlide();
                    this.stopAutoPlay();
                    this.startAutoPlay();
                });
            }

            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    this.nextSlide();
                    this.stopAutoPlay();
                    this.startAutoPlay();
                });
            }
        }

        setupTouchEvents() {
            this.carousel.addEventListener('touchstart', (e) => {
                this.touchStartX = e.changedTouches[0].screenX;
            }, { passive: true });

            this.carousel.addEventListener('touchend', (e) => {
                this.touchEndX = e.changedTouches[0].screenX;
                this.handleSwipe();
            }, { passive: true });
        }

        setupKeyboardNavigation() {
            document.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') {
                    this.prevSlide();
                    this.stopAutoPlay();
                    this.startAutoPlay();
                } else if (e.key === 'ArrowRight') {
                    this.nextSlide();
                    this.stopAutoPlay();
                    this.startAutoPlay();
                }
            });
        }

        handleSwipe() {
            const swipeThreshold = 50;
            const diff = this.touchStartX - this.touchEndX;

            if (Math.abs(diff) > swipeThreshold) {
                if (diff > 0) {
                    // Swipe left - next slide
                    this.nextSlide();
                } else {
                    // Swipe right - previous slide
                    this.prevSlide();
                }
                this.stopAutoPlay();
                this.startAutoPlay();
            }
        }

        nextSlide() {
            const nextIndex = (this.currentIndex + 1) % this.slides.length;
            this.showSlide(nextIndex);
        }

        prevSlide() {
            const prevIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
            this.showSlide(prevIndex);
        }

        startAutoPlay() {
            this.stopAutoPlay(); // Clear any existing interval
            this.autoPlayInterval = setInterval(() => {
                this.nextSlide();
            }, this.autoPlayDelay);
        }

        stopAutoPlay() {
            if (this.autoPlayInterval) {
                clearInterval(this.autoPlayInterval);
                this.autoPlayInterval = null;
            }
        }
    }

    // Initialize carousel when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new FeedbackCarousel();
        });
    } else {
        new FeedbackCarousel();
    }
})();
