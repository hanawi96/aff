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
    }
    
    /**
     * Stop timer
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
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
            footerTimer.innerHTML = `<i class="fas fa-clock"></i><span>Kết thúc sau: <strong>${timeString}</strong></span>`;
        }
        
        // Update badge timer (inside badge - just time)
        const badgeTimer = document.getElementById('flashSaleBadgeTimer');
        if (badgeTimer) {
            badgeTimer.textContent = timeString;
        }
    }
}
