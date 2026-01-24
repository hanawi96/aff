// ============================================
// PERFORMANCE MONITOR
// ============================================

/**
 * Performance Monitor - Track page load metrics
 */
class PerformanceMonitor {
    constructor() {
        this.metrics = {};
        this.enabled = true; // Set to false in production
    }
    
    /**
     * Start timing a metric
     */
    start(label) {
        if (!this.enabled) return;
        this.metrics[label] = {
            start: performance.now(),
            end: null,
            duration: null
        };
    }
    
    /**
     * End timing a metric
     */
    end(label) {
        if (!this.enabled || !this.metrics[label]) return;
        
        this.metrics[label].end = performance.now();
        this.metrics[label].duration = this.metrics[label].end - this.metrics[label].start;
        
        console.log(`⏱️ ${label}: ${this.metrics[label].duration.toFixed(2)}ms`);
    }
    
    /**
     * Get all metrics
     */
    getMetrics() {
        return this.metrics;
    }
    
    /**
     * Log performance summary
     */
    logSummary() {
        if (!this.enabled) return;
        
        console.group('📊 Performance Summary');
        
        Object.entries(this.metrics).forEach(([label, data]) => {
            if (data.duration !== null) {
                const color = data.duration < 100 ? '🟢' : data.duration < 500 ? '🟡' : '🔴';
                console.log(`${color} ${label}: ${data.duration.toFixed(2)}ms`);
            }
        });
        
        // Web Vitals
        if (window.performance && window.performance.timing) {
            const timing = window.performance.timing;
            const loadTime = timing.loadEventEnd - timing.navigationStart;
            const domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
            const firstPaint = timing.responseEnd - timing.fetchStart;
            
            console.log('\n🎯 Web Vitals:');
            console.log(`  Page Load: ${loadTime}ms`);
            console.log(`  DOM Ready: ${domReady}ms`);
            console.log(`  First Paint: ${firstPaint}ms`);
        }
        
        console.groupEnd();
    }
    
    /**
     * Monitor page load performance
     */
    monitorPageLoad() {
        if (!this.enabled) return;
        
        window.addEventListener('load', () => {
            setTimeout(() => {
                this.logSummary();
                
                // Log recommendations
                this.logRecommendations();
            }, 1000);
        });
    }
    
    /**
     * Log performance recommendations
     */
    logRecommendations() {
        const recommendations = [];
        
        Object.entries(this.metrics).forEach(([label, data]) => {
            if (data.duration > 1000) {
                recommendations.push(`⚠️ ${label} is slow (${data.duration.toFixed(0)}ms). Consider optimization.`);
            }
        });
        
        if (recommendations.length > 0) {
            console.group('💡 Recommendations');
            recommendations.forEach(rec => console.log(rec));
            console.groupEnd();
        } else {
            console.log('✅ All metrics are within acceptable range!');
        }
    }
}

// Export singleton
export const performanceMonitor = new PerformanceMonitor();
