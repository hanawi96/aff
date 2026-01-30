// ============================================
// FLASH SALE TIMER
// ============================================

/**
 * Flash Sale Timer Manager
 */
export class FlashSaleTimer {
    constructor(flashSale) {
        this.flashSale = flashSale;
        this.intervalId = null;
        this.viewersIntervalId = null;
    }
    
    /**
     * Start timer
     */
    start() {
        if (!this.flashSale) return;
        
        // FAKE COUNTDOWN: Always show 2 hours 26 minutes countdown
        // This creates urgency without depending on actual database time
        const FAKE_HOURS = 2;
        const FAKE_MINUTES = 26;
        const FAKE_SECONDS = 0;
        
        // Calculate fake end time (2h 26m from now)
        const fakeEndTime = Date.now() + (FAKE_HOURS * 60 * 60 * 1000) + (FAKE_MINUTES * 60 * 1000) + (FAKE_SECONDS * 1000);
        
        const updateTimer = () => {
            const now = Date.now();
            const diff = fakeEndTime - now;
            
            if (diff <= 0) {
                // When countdown ends, restart it (loop forever)
                this.stop();
                this.start(); // Restart with fresh 2h 26m
                return;
            }
            
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            this.setTime(hours, minutes, seconds);
        };
        
        updateTimer();
        this.intervalId = setInterval(updateTimer, 1000);
        
        // Start random viewers counter
        this.startViewersCounter();
    }
    
    /**
     * Start random viewers counter (2-30 people)
     */
    startViewersCounter() {
        const updateViewers = () => {
            const randomViewers = Math.floor(Math.random() * 29) + 2; // 2-30
            const viewersEl = document.getElementById('flashSaleViewers');
            if (viewersEl) {
                viewersEl.textContent = randomViewers;
            }
        };
        
        // Update immediately
        updateViewers();
        
        // Update every 5-10 seconds randomly
        const scheduleNextUpdate = () => {
            const delay = Math.floor(Math.random() * 5000) + 5000; // 5-10 seconds
            this.viewersIntervalId = setTimeout(() => {
                updateViewers();
                scheduleNextUpdate();
            }, delay);
        };
        
        scheduleNextUpdate();
    }
    
    /**
     * Stop timer
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.viewersIntervalId) {
            clearTimeout(this.viewersIntervalId);
            this.viewersIntervalId = null;
        }
    }
    
    /**
     * Set time display with smart formatting
     */
    setTime(hours, minutes, seconds) {
        // Simple digital clock format: 02:26:26
        const h = String(hours).padStart(2, '0');
        const m = String(minutes).padStart(2, '0');
        const s = String(seconds).padStart(2, '0');
        
        let displayText = `<span class="time-number">${h}</span>:<span class="time-number">${m}</span>:<span class="time-number">${s}</span>`;
        
        // Legacy format for compatibility
        const timeString = `${h}:${m}:${s}`;
        
        // Update old timer elements (if exist)
        const hoursEl = document.getElementById('hours');
        const minutesEl = document.getElementById('minutes');
        const secondsEl = document.getElementById('seconds');
        
        if (hoursEl) hoursEl.textContent = h;
        if (minutesEl) minutesEl.textContent = m;
        if (secondsEl) secondsEl.textContent = s;
        
        // Update footer timer
        const footerTimer = document.getElementById('flashSaleTimer');
        if (footerTimer) {
            footerTimer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem; display: inline-block;"><path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clip-rule="evenodd" /></svg><span>${displayText}</span>`;
        }
        
        // Update badge timer
        const badgeTimer = document.getElementById('flashSaleBadgeTimer');
        if (badgeTimer) {
            // Check if content changed to trigger animation
            const oldContent = badgeTimer.getAttribute('data-old-content');
            const newContent = displayText;
            
            if (oldContent !== newContent) {
                badgeTimer.classList.add('updating');
                setTimeout(() => badgeTimer.classList.remove('updating'), 300);
            }
            
            badgeTimer.innerHTML = displayText;
            badgeTimer.setAttribute('data-old-content', newContent);
            
            // Add show-seconds class for consistent styling
            const badge = badgeTimer.closest('.bundle-offer-badge');
            if (badge) {
                badge.classList.add('show-seconds');
            }
        }
    }
}
