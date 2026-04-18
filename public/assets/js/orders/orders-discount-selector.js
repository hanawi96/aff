/**
 * Load active discounts for admin order form (desktop sheet + validate).
 */

async function loadActiveDiscounts() {
    if (typeof allDiscountsList !== 'undefined' && allDiscountsList.length > 0) {
        return;
    }

    try {
        const response = await fetch(`${CONFIG.API_URL}?action=getAllDiscounts&timestamp=${Date.now()}`);
        const data = await response.json();

        if (data.success && data.discounts) {
            const now = new Date();
            allDiscountsList = data.discounts.filter((d) => {
                if (!d.active) return false;
                if (d.expiry_date && new Date(d.expiry_date) < now) return false;
                if (d.start_date && new Date(d.start_date) > now) return false;
                return true;
            });
        }
    } catch (error) {
        console.error('Error loading discounts:', error);
    }
}
