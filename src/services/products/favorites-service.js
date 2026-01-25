// ============================================
// FAVORITES SERVICE
// ============================================

/**
 * Toggle favorite status for a product
 */
export async function toggleFavorite(db, productId, sessionId) {
    try {
        // Check if already favorited
        const existing = await db.execute({
            sql: `SELECT id FROM product_favorites 
                  WHERE product_id = ? AND session_id = ?`,
            args: [productId, sessionId]
        });

        let isFavorited = false;
        let favoritesCount = 0;

        if (existing.rows.length > 0) {
            // Remove favorite
            await db.execute({
                sql: `DELETE FROM product_favorites 
                      WHERE product_id = ? AND session_id = ?`,
                args: [productId, sessionId]
            });

            // Decrement count
            await db.execute({
                sql: `UPDATE products 
                      SET favorites_count = MAX(0, favorites_count - 1) 
                      WHERE id = ?`,
                args: [productId]
            });

            isFavorited = false;
        } else {
            // Add favorite
            await db.execute({
                sql: `INSERT INTO product_favorites (product_id, session_id, created_at) 
                      VALUES (?, ?, ?)`,
                args: [productId, sessionId, Math.floor(Date.now() / 1000)]
            });

            // Increment count
            await db.execute({
                sql: `UPDATE products 
                      SET favorites_count = favorites_count + 1 
                      WHERE id = ?`,
                args: [productId]
            });

            isFavorited = true;
        }

        // Get updated count
        const result = await db.execute({
            sql: `SELECT favorites_count FROM products WHERE id = ?`,
            args: [productId]
        });

        if (result.rows.length > 0) {
            favoritesCount = result.rows[0].favorites_count || 0;
        }

        return {
            success: true,
            isFavorited,
            favoritesCount
        };

    } catch (error) {
        console.error('Error toggling favorite:', error);
        throw error;
    }
}

/**
 * Get user's favorited products
 */
export async function getUserFavorites(db, sessionId) {
    try {
        const result = await db.execute({
            sql: `SELECT pf.product_id, pf.created_at, p.name, p.price, p.image_url
                  FROM product_favorites pf
                  JOIN products p ON pf.product_id = p.id
                  WHERE pf.session_id = ?
                  ORDER BY pf.created_at DESC`,
            args: [sessionId]
        });

        return result.rows;
    } catch (error) {
        console.error('Error getting user favorites:', error);
        throw error;
    }
}

/**
 * Check if product is favorited by user
 */
export async function isFavorited(db, productId, sessionId) {
    try {
        const result = await db.execute({
            sql: `SELECT id FROM product_favorites 
                  WHERE product_id = ? AND session_id = ?`,
            args: [productId, sessionId]
        });

        return result.rows.length > 0;
    } catch (error) {
        console.error('Error checking favorite status:', error);
        return false;
    }
}
