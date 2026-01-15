import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read Excel file
const workbook = XLSX.readFile(join(__dirname, '..', 'tao_don.xlsx'));

// Get all sheet names
console.log('📊 Sheet names:', workbook.SheetNames);
console.log('');

// Read each sheet
workbook.SheetNames.forEach(sheetName => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📄 Sheet: ${sheetName}`);
    console.log('='.repeat(60));
    
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    
    console.log(`\n📝 Total rows: ${data.length}`);
    
    if (data.length > 0) {
        console.log('\n🔑 Columns:', Object.keys(data[0]).join(', '));
        console.log('\n📋 First 5 rows:');
        console.log(JSON.stringify(data.slice(0, 5), null, 2));
        
        if (data.length > 5) {
            console.log(`\n... and ${data.length - 5} more rows`);
        }
    }
});

console.log('\n\n✅ Done!');
