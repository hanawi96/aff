// Check favorites count in database
const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env' });

async function checkFavorites() {
    const db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
    });

    try {
        // Check product 132
        const result = await db.execute({
            sql: 'SELECT id, name, favorites_count FROM products WHERE id = ?',
            args: [132]
        });

        console.log('Product 132 favorites:');
        console.log(JSON.stringify(result.rows, null, 2));

        // Check all products with favorites
        const allFavorites = await db.execute(
            'SELECT id, name, favorites_count FROM products WHERE favorites_count > 0 ORDER BY favorites_count DESC LIMIT 10'
        );

        console.log('\nTop 10 products with favorites:');
        console.log(JSON.stringify(allFavorites.rows, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
}

checkFavorites();
