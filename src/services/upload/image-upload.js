// Sanitize filename: remove special chars, replace spaces with hyphens
function sanitizeFilename(filename) {
    // Get extension
    const ext = filename.split('.').pop();
    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
    
    // Remove special chars, replace spaces with hyphens, lowercase
    const sanitized = nameWithoutExt
        .toLowerCase()
        .replace(/\s+/g, '-')           // Replace spaces with hyphens
        .replace(/[^a-z0-9-_]/g, '')    // Remove special chars except hyphen and underscore
        .replace(/-+/g, '-')            // Replace multiple hyphens with single
        .replace(/^-|-$/g, '');         // Remove leading/trailing hyphens
    
    return `${sanitized}.${ext}`;
}

// Upload image to R2
export async function uploadImage(env, file, filename) {
    try {
        // Sanitize original filename
        const sanitizedName = sanitizeFilename(filename);
        
        // Generate unique filename
        const timestamp = Date.now();
        const ext = sanitizedName.split('.').pop();
        const baseName = sanitizedName.substring(0, sanitizedName.lastIndexOf('.'));
        const uniqueFilename = `products/${timestamp}-${baseName}-${Math.random().toString(36).substring(7)}.${ext}`;
        
        // Upload to R2
        await env.R2_BUCKET.put(uniqueFilename, file, {
            httpMetadata: {
                contentType: file.type || 'image/jpeg'
            }
        });
        
        // Return public URL
        const publicUrl = `https://pub-857086f8ce7248b6ab3b37c688164fb1.r2.dev/${uniqueFilename}`;
        
        return {
            success: true,
            url: publicUrl,
            filename: uniqueFilename
        };
    } catch (error) {
        console.error('Error uploading image:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Delete image from R2
export async function deleteImage(env, filename) {
    try {
        await env.R2_BUCKET.delete(filename);
        return { success: true };
    } catch (error) {
        console.error('Error deleting image:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Extract R2 filename from full URL
export function extractR2Filename(imageUrl) {
    if (!imageUrl) return null;
    
    // Check if it's an R2 URL
    if (imageUrl.includes('pub-857086f8ce7248b6ab3b37c688164fb1.r2.dev')) {
        // Extract filename after domain
        // Example: https://pub-857086f8ce7248b6ab3b37c688164fb1.r2.dev/products/123-abc.jpg
        // Returns: products/123-abc.jpg
        const parts = imageUrl.split('pub-857086f8ce7248b6ab3b37c688164fb1.r2.dev/');
        if (parts.length > 1) {
            // Decode URL to handle encoded characters (%20, etc.)
            return decodeURIComponent(parts[1]);
        }
    }
    
    return null;
}

// Delete R2 image by URL (helper function)
export async function deleteImageByUrl(env, imageUrl) {
    const filename = extractR2Filename(imageUrl);
    if (filename) {
        return await deleteImage(env, filename);
    }
    return { success: false, error: 'Not an R2 URL' };
}
