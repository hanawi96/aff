// Cloudflare Worker for handling form submissions to Google Sheets

export default {
  async fetch(request, env, ctx) {
    // Handle CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only handle POST requests to /api/submit
    if (request.method === 'POST' && new URL(request.url).pathname === '/api/submit') {
      try {
        const formData = await request.json();
        
        // Validate required fields
        const requiredFields = ['fullName', 'phone', 'email', 'city'];
        for (const field of requiredFields) {
          if (!formData[field]) {
            return new Response(
              JSON.stringify({ error: `Missing required field: ${field}` }),
              { 
                status: 400, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            );
          }
        }

        // Send to Google Sheets
        const result = await sendToGoogleSheets(formData, env);
        
        if (result.success) {
          return new Response(
            JSON.stringify({ message: 'Form submitted successfully' }),
            { 
              status: 200, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          );
        } else {
          throw new Error(result.error);
        }
        
      } catch (error) {
        console.error('Error processing form:', error);
        return new Response(
          JSON.stringify({ error: 'Internal server error' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Serve static files (for development)
    return new Response('Not Found', { status: 404 });
  }
};

async function sendToGoogleSheets(data, env) {
  try {
    // Google Sheets API configuration
    const SPREADSHEET_ID = env.GOOGLE_SPREADSHEET_ID;
    const SHEET_NAME = env.GOOGLE_SHEET_NAME || 'Referral Registrations';
    const API_KEY = env.GOOGLE_API_KEY;
    
    if (!SPREADSHEET_ID || !API_KEY) {
      throw new Error('Missing Google Sheets configuration');
    }

    // Prepare the row data
    const rowData = [
      data.timestamp || new Date().toLocaleString('vi-VN'),
      data.fullName,
      data.phone,
      data.email,
      data.city,
      data.age || '',
      data.experience || '',
      data.facebook || '',
      data.motivation || '',
      'Pending' // Status column
    ];

    // Google Sheets API endpoint
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}:append?valueInputOption=RAW&key=${API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowData]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Sheets API error: ${response.status} - ${errorText}`);
    }

    return { success: true };
    
  } catch (error) {
    console.error('Google Sheets error:', error);
    return { success: false, error: error.message };
  }
}

// Alternative method using Google Apps Script Web App
async function sendToGoogleAppsScript(data, env) {
  try {
    const WEB_APP_URL = env.GOOGLE_WEB_APP_URL;
    
    if (!WEB_APP_URL) {
      throw new Error('Missing Google Web App URL');
    }

    const response = await fetch(WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Web App error: ${response.status}`);
    }

    const result = await response.json();
    return { success: true, data: result };
    
  } catch (error) {
    console.error('Google Apps Script error:', error);
    return { success: false, error: error.message };
  }
}