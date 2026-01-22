import { jsonResponse } from '../../utils/response.js';

// ============================================
// GET ALL CAMPAIGNS
// ============================================
export async function getAllCampaigns(env, corsHeaders) {
    try {
        const { results: campaigns } = await env.DB.prepare(`
            SELECT 
                c.*,
                COUNT(DISTINCT d.id) as discount_count,
                COALESCE(SUM(d.usage_count), 0) as total_usage,
                COALESCE(SUM(d.total_discount_amount), 0) as total_discount_amount
            FROM discount_campaigns c
            LEFT JOIN discounts d ON d.campaign_id = c.id
            GROUP BY c.id
            ORDER BY c.start_date DESC
        `).all();

        return jsonResponse({
            success: true,
            campaigns: campaigns || []
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting campaigns:', error);
        return jsonResponse({
            success: false,
            error: 'Failed to get campaigns'
        }, 500, corsHeaders);
    }
}

// ============================================
// GET SINGLE CAMPAIGN
// ============================================
export async function getCampaign(id, env, corsHeaders) {
    try {
        // Get campaign info
        const campaign = await env.DB.prepare(`
            SELECT * FROM discount_campaigns WHERE id = ?
        `).bind(id).first();

        if (!campaign) {
            return jsonResponse({
                success: false,
                error: 'Campaign not found'
            }, 404, corsHeaders);
        }

        // Get discounts in this campaign
        const { results: discounts } = await env.DB.prepare(`
            SELECT * FROM discounts 
            WHERE campaign_id = ?
            ORDER BY created_at_unix DESC
        `).bind(id).all();

        return jsonResponse({
            success: true,
            campaign: {
                ...campaign,
                discounts: discounts || []
            }
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error getting campaign:', error);
        return jsonResponse({
            success: false,
            error: 'Failed to get campaign'
        }, 500, corsHeaders);
    }
}

// ============================================
// CREATE CAMPAIGN
// ============================================
export async function createCampaign(data, env, corsHeaders) {
    try {
        // Validate required fields
        if (!data.name || !data.slug || !data.start_date || !data.end_date) {
            return jsonResponse({
                success: false,
                error: 'Missing required fields: name, slug, start_date, end_date'
            }, 400, corsHeaders);
        }

        // Check if slug already exists
        const existing = await env.DB.prepare(
            'SELECT id FROM discount_campaigns WHERE slug = ?'
        ).bind(data.slug).first();

        if (existing) {
            return jsonResponse({
                success: false,
                error: 'Campaign slug already exists'
            }, 400, corsHeaders);
        }

        const now = Date.now();

        const result = await env.DB.prepare(`
            INSERT INTO discount_campaigns (
                name, slug, icon, description,
                start_date, end_date,
                target_orders, target_revenue,
                is_active,
                created_at_unix, updated_at_unix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            data.name,
            data.slug,
            data.icon || '🎉',
            data.description || null,
            data.start_date,
            data.end_date,
            data.target_orders || null,
            data.target_revenue || null,
            data.is_active !== undefined ? data.is_active : 1,
            now,
            now
        ).run();

        return jsonResponse({
            success: true,
            message: 'Campaign created successfully',
            campaign: {
                id: Number(result.meta.last_row_id),
                ...data
            }
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error creating campaign:', error);
        return jsonResponse({
            success: false,
            error: 'Failed to create campaign'
        }, 500, corsHeaders);
    }
}

// ============================================
// UPDATE CAMPAIGN
// ============================================
export async function updateCampaign(data, env, corsHeaders) {
    try {
        if (!data.id) {
            return jsonResponse({
                success: false,
                error: 'Campaign ID is required'
            }, 400, corsHeaders);
        }

        // Check if campaign exists
        const existing = await env.DB.prepare(
            'SELECT id FROM discount_campaigns WHERE id = ?'
        ).bind(data.id).first();

        if (!existing) {
            return jsonResponse({
                success: false,
                error: 'Campaign not found'
            }, 404, corsHeaders);
        }

        const now = Date.now();

        await env.DB.prepare(`
            UPDATE discount_campaigns SET
                name = ?,
                slug = ?,
                icon = ?,
                description = ?,
                start_date = ?,
                end_date = ?,
                target_orders = ?,
                target_revenue = ?,
                is_active = ?,
                updated_at_unix = ?
            WHERE id = ?
        `).bind(
            data.name,
            data.slug,
            data.icon || '🎉',
            data.description || null,
            data.start_date,
            data.end_date,
            data.target_orders || null,
            data.target_revenue || null,
            data.is_active !== undefined ? data.is_active : 1,
            now,
            data.id
        ).run();

        return jsonResponse({
            success: true,
            message: 'Campaign updated successfully'
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error updating campaign:', error);
        return jsonResponse({
            success: false,
            error: 'Failed to update campaign'
        }, 500, corsHeaders);
    }
}

// ============================================
// DELETE CAMPAIGN
// ============================================
export async function deleteCampaign(data, env, corsHeaders) {
    try {
        if (!data.id) {
            return jsonResponse({
                success: false,
                error: 'Campaign ID is required'
            }, 400, corsHeaders);
        }

        // Check if campaign has discounts
        const { results: discounts } = await env.DB.prepare(
            'SELECT id FROM discounts WHERE campaign_id = ? LIMIT 1'
        ).bind(data.id).all();

        if (discounts && discounts.length > 0) {
            return jsonResponse({
                success: false,
                error: 'Cannot delete campaign with existing discounts. Remove discounts first or set campaign_id to NULL.'
            }, 400, corsHeaders);
        }

        await env.DB.prepare(
            'DELETE FROM discount_campaigns WHERE id = ?'
        ).bind(data.id).run();

        return jsonResponse({
            success: true,
            message: 'Campaign deleted successfully'
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error deleting campaign:', error);
        return jsonResponse({
            success: false,
            error: 'Failed to delete campaign'
        }, 500, corsHeaders);
    }
}

// ============================================
// TOGGLE CAMPAIGN STATUS
// ============================================
export async function toggleCampaignStatus(data, env, corsHeaders) {
    try {
        if (!data.id) {
            return jsonResponse({
                success: false,
                error: 'Campaign ID is required'
            }, 400, corsHeaders);
        }

        const now = Date.now();

        await env.DB.prepare(`
            UPDATE discount_campaigns 
            SET is_active = ?, updated_at_unix = ?
            WHERE id = ?
        `).bind(
            data.is_active ? 1 : 0,
            now,
            data.id
        ).run();

        return jsonResponse({
            success: true,
            message: 'Campaign status updated successfully'
        }, 200, corsHeaders);
    } catch (error) {
        console.error('Error toggling campaign status:', error);
        return jsonResponse({
            success: false,
            error: 'Failed to update campaign status'
        }, 500, corsHeaders);
    }
}
