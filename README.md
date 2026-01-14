# 🍼 Hệ Thống Quản Lý Cộng Tác Viên - Mẹ & Bé

Hệ thống quản lý cộng tác viên (CTV) cho shop Mẹ & Bé, sử dụng Cloudflare Workers và Turso Database.

## 🚀 Công nghệ

- **Backend:** Cloudflare Workers
- **Database:** Turso (Remote SQLite)
- **Frontend:** Vanilla JavaScript
- **Authentication:** Session-based with bcrypt

## 📦 Cấu trúc Project

```
├── public/              # Frontend files
│   ├── admin/          # Admin dashboard
│   ├── ctv/            # CTV portal
│   └── assets/         # CSS, JS, images
├── database/           # Database schemas and client
│   └── turso-client.js # Turso adapter
├── scripts/            # Utility scripts
│   └── verify-migration.js
├── docs/               # Documentation
├── worker.js           # Main API worker
├── wrangler.toml       # Cloudflare config
└── package.json        # Dependencies
```

## 🔧 Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create `.env` file:
```env
TURSO_DATABASE_URL=your-turso-url
TURSO_AUTH_TOKEN=your-turso-token
```

### 3. Add Secrets to Wrangler
```bash
npx wrangler secret put TURSO_AUTH_TOKEN
```

### 4. Deploy
```bash
npm run deploy
```

## 🛠️ Development

### Run Local Development Server
```bash
# Frontend
npm run dev

# Worker
npm run dev:worker
```

### Database Management
```bash
# Open Turso shell
npm run db:shell

# Verify database
npm run db:verify

# Backup database
npm run db:backup

# Check replicas
npm run db:replicas
```

## 📊 Features

### Admin Dashboard
- ✅ CTV Management
- ✅ Order Management
- ✅ Product Management
- ✅ Discount System
- ✅ Revenue & Profit Reports
- ✅ Location Analytics
- ✅ Payment Management

### CTV Portal
- ✅ Registration
- ✅ Order Tracking
- ✅ Commission Calculation
- ✅ Payment History

## 🔐 Authentication

Default admin credentials:
- Username: `admin`
- Password: `admin123`

**⚠️ Change password after first login!**

## 📝 API Endpoints

### CTV Management
- `GET ?action=getAllCTV` - Get all CTVs
- `POST /api/ctv/register` - Register new CTV
- `POST /api/ctv/update` - Update CTV info

### Order Management
- `GET ?action=getRecentOrders` - Get recent orders
- `POST /api/order/create` - Create new order
- `POST ?action=updateOrderStatus` - Update order status

### Product Management
- `GET ?action=getAllProducts` - Get all products
- `POST ?action=createProduct` - Create product
- `POST ?action=updateProduct` - Update product

### Authentication
- `POST ?action=login` - Login
- `GET ?action=verifySession` - Verify session
- `POST ?action=changePassword` - Change password

## 🗄️ Database

### Technology
- **Turso** - Remote SQLite database
- **Region:** AWS Tokyo (ap-northeast-1)
- **URL:** libsql://vdt-yendev96.aws-ap-northeast-1.turso.io

### Tables
- `ctv` - Collaborators
- `orders` - Orders
- `order_items` - Order line items
- `products` - Products
- `categories` - Product categories
- `discounts` - Discount codes
- `users` - Admin users
- `sessions` - User sessions

### Verify Database
```bash
node scripts/verify-migration.js
```

## 📚 Documentation

- `MIGRATION_COMPLETED.md` - Migration completion report
- `docs/migration-archive/` - Migration documentation archive
- `docs/*.md` - Feature documentation

## 🔄 Migration History

**January 14, 2026:** Successfully migrated from Cloudflare D1 to Turso
- ✅ 421 records migrated
- ✅ 70 indexes created
- ✅ 18 triggers working
- ✅ Zero downtime migration

See `docs/migration-archive/` for detailed migration documentation.

## 🚀 Deployment

### Production
```bash
npm run deploy
```

### Monitor Logs
```bash
npm run logs
```

### Production URL
```
https://ctv-api.yendev96.workers.dev
```

## 🎯 Performance

- Response time: ~150-200ms
- Database: Turso with replicas
- CDN: Cloudflare Edge Network

## 🔒 Security

- ✅ Session-based authentication
- ✅ Password hashing with bcrypt
- ✅ CORS enabled
- ✅ Environment variables for secrets
- ✅ Token-based database access

## 📞 Support

For issues or questions, check:
1. `MIGRATION_COMPLETED.md` - Migration details
2. `docs/` - Feature documentation
3. Cloudflare logs: `npm run logs`

## 📄 License

MIT

## 👨‍💻 Author

hanawi96

---

**Status:** 🟢 Production - Running on Turso  
**Last Updated:** January 14, 2026
