// Fix R2 files with spaces in names
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

const R2_BASE_URL = 'https://pub-857086f8ce7248b6ab3b37c688164fb1.r2.dev';

async function fixSpacesInUrls() {
    console.log('🔧 Fixing spaces in R2 URLs...\n');
    
    // Get all products with R2 URLs containing spaces
    const result = await db.execute({
        sql: 'SELECT id, name, image_url FROM products WHERE image_url LIKE ? AND image_url LIKE ?',
        args: [`%${R2_BASE_URL}%`, `% %`]
    });
    
    console.log(`Found ${result.rows.length} products with spaces in URLs\n`);
    
    const updates = [];
    
    for (const row of result.rows) {
        // Replace spaces with hyphens in the URL
        const newUrl = row.image_url.replace(/ /g, '-');
        
        updates.push({
            id: row.id,
            name: row.name,
            oldUrl: row.image_url,
            newUrl: newUrl
        });
    }
    
    // Save to file for wrangler commands
    const commands = [];
    const LOCAL_BASE = 'D:/CTV/public';
    
    for (const update of updates) {
        // Extract path from URL
        const urlPath = update.oldUrl.replace(R2_BASE_URL + '/', '');
        const newPath = update.newUrl.replace(R2_BASE_URL + '/', '');
        
        // Local file path
        const localPath = path.join(LOCAL_BASE, urlPath).replace(/\\/g, '/');
        
        // Wrangler command
        commands.push(`wrangler r2 object put vdt-image/${newPath} --file="${localPath}" --remote`);
    }
    
    // Save commands
    fs.writeFileSync('migrations/r2-fix-spaces-commands.sh', commands.join('\n'), 'utf8');
    console.log(`✅ Generated ${commands.length} commands → migrations/r2-fix-spaces-commands.sh\n`);
    
    // Save URL mappings for database update
    fs.writeFileSync('migrations/r2-fix-spaces-mapping.json', JSON.stringify(updates, null, 2), 'utf8');
    console.log(`✅ Saved URL mappings → migrations/r2-fix-spaces-mapping.json\n`);
    
    console.log('📋 Next steps:');
    console.log('   1. Run: bash migrations/r2-fix-spaces-commands.sh (or PowerShell script)');
    console.log('   2. Run: node scripts/update-r2-fixed-urls.js');
}

fixSpacesInUrls().catch(console.error);
