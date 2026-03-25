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

export async function uploadImage(env, file, filename) {
    try {
        console.log('📤 Starting image upload process:', {
            filename,
            size: file.size,
            type: file.type
        });

        // Validate file
        if (!file) {
            throw new Error('No file provided');
        }

        // Validate file type
        if (!file.type || !file.type.startsWith('image/')) {
            throw new Error('File must be an image');
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('File size must be less than 5MB');
        }

        // Sanitize original filename
        const sanitizedName = sanitizeFilename(filename);
        
        // Generate unique filename
        const timestamp = Date.now();
        const ext = sanitizedName.split('.').pop();
        const baseName = sanitizedName.substring(0, sanitizedName.lastIndexOf('.'));
        const uniqueFilename = `products/${timestamp}-${baseName}-${Math.random().toString(36).substring(7)}.${ext}`;
        
        console.log('📝 Generated filename:', uniqueFilename);
        
        // Upload to R2
        await env.R2_BUCKET.put(uniqueFilename, file, {
            httpMetadata: {
                contentType: file.type || 'image/jpeg',
                cacheControl: 'public, max-age=31536000' // 1 year cache
            }
        });
        
        console.log('☁️ File uploaded to R2 successfully');
        
        // Prefer the R2 public (r2.dev or custom domain) URL so `image_url` in DB is a
        // stable, shareable link. `<img src>` works without going through the Worker.
        // Optional: set env.R2_PUBLIC_BASE_URL in wrangler (no trailing slash) to override.
        const defaultPublicBase = 'https://pub-857086f8ce7248b6ab3b37c688164fb1.r2.dev';
        const base = (typeof env.R2_PUBLIC_BASE_URL === 'string' && env.R2_PUBLIC_BASE_URL.trim())
            ? env.R2_PUBLIC_BASE_URL.trim().replace(/\/$/, '')
            : defaultPublicBase;
        const publicUrl = `${base}/${uniqueFilename}`;
        
        console.log('✅ Image uploaded successfully:', {
            filename: uniqueFilename,
            url: publicUrl,
            size: file.size,
            type: file.type
        });
        
        return {
            success: true,
            url: publicUrl,
            filename: uniqueFilename
        };
    } catch (error) {
        console.error('❌ Error uploading image:', error);
        return {
            success: false,
            error: error.message || 'Upload failed'
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

    // Support worker-proxy URL format:
    // https://<worker-domain>/?action=getR2Image&key=products%2F123-abc.jpg
    if (imageUrl.includes('action=getR2Image') && imageUrl.includes('key=')) {
        try {
            const url = new URL(imageUrl);
            const key = url.searchParams.get('key');
            if (key) return decodeURIComponent(key);
        } catch (error) {
            console.warn('Unable to parse proxy image URL:', error);
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
