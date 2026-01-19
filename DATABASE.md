# Database Information

## Current Database: Turso

This project uses **Turso Database** (libSQL) for data storage.

### Why Turso?

- ✅ **Edge-optimized**: Low latency worldwide
- ✅ **SQLite-compatible**: Familiar SQL syntax
- ✅ **Scalable**: Better performance than Cloudflare D1
- ✅ **Cost-effective**: Generous free tier
- ✅ **Modern features**: Built-in replication, branching

### Connection Details

Database connection is configured via environment variables in `.env`:

```env
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

### Database Client

We use `@libsql/client` to connect to Turso:

```javascript
import { createClient } from '@libsql/client';

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});
```

### Migration History

- **Before**: Cloudflare D1 (SQLite on Cloudflare Workers)
- **After**: Turso Database (libSQL)
- **Migration Date**: January 2026
- **Reason**: Better performance, more features, easier management

### Key Differences from D1

| Feature | Cloudflare D1 | Turso |
|---------|---------------|-------|
| Protocol | HTTP API | libSQL protocol |
| Latency | ~50-100ms | ~10-30ms |
| Features | Basic SQLite | SQLite + extensions |
| CLI | wrangler d1 | turso db |
| Replication | No | Yes |
| Branching | No | Yes |

### Common Operations

#### Query Database
```bash
# Using Turso CLI (if installed)
turso db shell your-database "SELECT * FROM orders LIMIT 5;"

# Using Node.js script
node database/query-database.js
```

#### Run Migrations
```bash
node database/run-migration.js
```

#### Backup Database
```bash
turso db shell your-database ".dump" > backup.sql
```

### Schema

See `database/schema.sql` for the complete database schema.

Main tables:
- `orders` - Customer orders
- `order_items` - Order line items
- `ctv` - Collaborators (CTV)
- `products` - Product catalog
- `categories` - Product categories
- `customers` - Customer information
- `discounts` - Discount codes
- `cost_config` - Cost configuration

### Troubleshooting

#### Connection Issues
- Check `.env` file has correct `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
- Verify network connectivity
- Check Turso dashboard for database status

#### Query Errors
- Turso uses SQLite syntax
- Some D1-specific features may not work
- Check migration scripts for compatibility

### Resources

- [Turso Documentation](https://docs.turso.tech/)
- [libSQL Client Docs](https://github.com/tursodatabase/libsql-client-ts)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

---

**Note**: Old Cloudflare D1 configuration is kept in `wrangler.toml.backup` for reference only.
