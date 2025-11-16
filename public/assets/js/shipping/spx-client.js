// Shopee Express API Client
class SPXClient {
    constructor() {
        this.apiUrl = CONFIG.API_URL; // Sử dụng API backend của bạn
    }

    /**
     * Tạo vận đơn SPX
     * @param {Object} orderData - Thông tin đơn hàng
     * @returns {Promise<Object>} - Kết quả tạo vận đơn
     */
    async createOrder(orderData) {
        try {
            console.log('📤 Sending SPX order data:', orderData);
            
            const response = await fetch(`${this.apiUrl}?action=createSPXOrder`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(orderData)
            });

            console.log('📥 Response status:', response.status);
            
            // Try to get response text first
            const responseText = await response.text();
            console.log('📥 Response text:', responseText);

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}`;
                try {
                    const errorData = JSON.parse(responseText);
                    errorMessage = errorData.error || errorMessage;
                } catch (e) {
                    errorMessage = responseText || errorMessage;
                }
                throw new Error(errorMessage);
            }

            const result = JSON.parse(responseText);
            return result;
        } catch (error) {
            console.error('❌ Error creating SPX order:', error);
            throw error;
        }
    }

    /**
     * Lấy trạng thái vận đơn
     * @param {string} trackingNumber - Mã vận đơn
     * @returns {Promise<Object>} - Trạng thái vận đơn
     */
    async getTracking(trackingNumber) {
        try {
            const response = await fetch(`${this.apiUrl}?action=getSPXTracking&tracking=${trackingNumber}`);

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const result = await response.json();
            return result;
        } catch (error) {
            console.error('❌ Error getting SPX tracking:', error);
            throw error;
        }
    }
}

// Initialize SPX Client
const spxClient = new SPXClient();
