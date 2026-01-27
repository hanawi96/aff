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
        
        const endTime = this.flashSale.end_time * 1000;
        
        const updateTimer = () => {
            const now = Date.now();
            const diff = endTime - now;
            
            if (diff <= 0) {
                this.stop();
                this.setTime(0, 0, 0);
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
     * Set time display
     */
    setTime(hours, minutes, seconds) {
        const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        // Update old timer elements (if exist)
        const hoursEl = document.getElementById('hours');
        const minutesEl = document.getElementById('minutes');
        const secondsEl = document.getElementById('seconds');
        
        if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
        if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
        if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');
        
        // Update footer timer
        const footerTimer = document.getElementById('flashSaleTimer');
        if (footerTimer) {
            footerTimer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width: 1rem; height: 1rem; display: inline-block;"><path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clip-rule="evenodd" /></svg><span>Kết thúc sau: <strong>${timeString}</strong></span>`;
        }
        
        // Update badge timer (inside badge - just time)
        const badgeTimer = document.getElementById('flashSaleBadgeTimer');
        if (badgeTimer) {
            badgeTimer.textContent = timeString;
        }
    }
}
