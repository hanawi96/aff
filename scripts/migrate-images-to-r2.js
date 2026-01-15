// Migrate local images to R2 Storage
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LOCAL_IMAGE_DIR = path.join(__dirname, '../public/assets/images');
const R2_BUCKET_NAME = 'vdt-image';
const R2_BASE_URL = 'https://6732e495e6dc332a4d51e0aba6c0408a.r2.cloudflarestorage.com/vdt-image';

// Mapping file
const MAPPING_FILE = path.join(__dirname, '../migrations/image-url-mapping.json');

// Get all image files recursively
function getAllImageFiles(dir, baseDir = dir) {
    const files = [];
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
            files.push(...getAllImageFiles(fullPath, baseDir));
        } else if (stat.isFile()) {
            // Check if it's an image
            const ext = path.extname(item).toLowerCase();
            if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext)) {
                const relativePath = path.relative(baseDir, fullPath);
                files.push({
                    localPath: fullPath,
                    relativePath: relativePath.replace(/\\/g, '/'), // Convert to forward slashes
                    size: stat.size
                });
            }
        }
    }
    
    return files;
}

// Generate wrangler commands
function generateWranglerCommands(files) {
    console.log('📝 Generating Wrangler R2 upload commands...\n');
    console.log('# Copy and run these commands in your terminal:\n');
    
    const commands = [];
    
    for (const file of files) {
        // R2 path: assets/images/...
        const r2Path = `assets/images/${file.relativePath}`;
        const localPath = file.localPath.replace(/\\/g, '/');
        
        const cmd = `wrangler r2 object put ${R2_BUCKET_NAME}/${r2Path} --file="${localPath}"`;
        commands.push(cmd);
    }
    
    return commands;
}

// Generate URL mapping for database update
function generateUrlMapping(files) {
    const mapping = [];
    
    for (const file of files) {
        // Database uses both ./ and ../ patterns
        const oldUrl1 = `./assets/images/${file.relativePath}`;
        const oldUrl2 = `../assets/images/${file.relativePath}`;
        const newUrl = `${R2_BASE_URL}/assets/images/${file.relativePath}`;
        
        mapping.push({
            oldUrls: [oldUrl1, oldUrl2], // Support both patterns
            newUrl,
            relativePath: file.relativePath,
            size: file.size
        });
    }
    
    return mapping;
}

// Main function
async function main() {
    console.log('🚀 Starting image migration to R2...\n');
    
    // Check if directory exists
    if (!fs.existsSync(LOCAL_IMAGE_DIR)) {
        console.error('❌ Directory not found:', LOCAL_IMAGE_DIR);
        process.exit(1);
    }
    
    // Get all image files
    console.log('📂 Scanning directory:', LOCAL_IMAGE_DIR);
    const files = getAllImageFiles(LOCAL_IMAGE_DIR);
    console.log(`✅ Found ${files.length} image files\n`);
    
    // Calculate total size
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
    console.log(`📊 Total size: ${totalSizeMB} MB\n`);
    
    // Generate wrangler commands
    const commands = generateWranglerCommands(files);
    
    // Save commands to file
    const commandsFile = path.join(__dirname, '../migrations/r2-upload-commands.sh');
    fs.mkdirSync(path.dirname(commandsFile), { recursive: true });
    fs.writeFileSync(commandsFile, commands.join('\n'), 'utf8');
    console.log(`✅ Commands saved to: ${commandsFile}\n`);
    
    // Generate URL mapping
    const mapping = generateUrlMapping(files);
    fs.writeFileSync(MAPPING_FILE, JSON.stringify(mapping, null, 2), 'utf8');
    console.log(`✅ URL mapping saved to: ${MAPPING_FILE}\n`);
    
    // Print summary
    console.log('📋 Summary:');
    console.log(`   - Total files: ${files.length}`);
    console.log(`   - Total size: ${totalSizeMB} MB`);
    console.log(`   - Commands file: migrations/r2-upload-commands.sh`);
    console.log(`   - Mapping file: migrations/image-url-mapping.json`);
    console.log('\n🎯 Next steps:');
    console.log('   1. Run: bash migrations/r2-upload-commands.sh');
    console.log('   2. Run: node scripts/update-image-urls-in-db.js');
    console.log('   3. Verify images are accessible');
    console.log('   4. Delete local images (optional)');
}

main().catch(console.error);
