// Shopee Express API Configuration
const SPX_CONFIG = {
    // API Credentials
    partnerId: '162695267691149',
    secretKey: 'c6744cab-e5e7-4f35-b1ac-2980adb0b9c2',
    accountId: '750794417',

    // API Endpoints
    apiUrl: 'https://open-api.spx.vn/api/v1',
    
    // Sender Information (Thông tin người gửi)
    sender: {
        name: 'Ánh Lê',
        phone: '0386190596',
        address: 'xóm 4, đông cao',
        ward: 'Tráng Việt',
        district: 'Me Linh',
        province: 'Hà Nội',
        fullAddress: 'xóm 4, đông cao, Xã Tráng Việt, Huyện Me Linh, Hà Nội'
    },

    // Default parcel settings
    defaultParcel: {
        weight: 500, // gram
        length: 20, // cm
        width: 15, // cm
        height: 10 // cm
    }
};
