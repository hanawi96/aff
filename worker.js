// Cloudflare Worker to handle form submissions and save to Google Sheets
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Only handle POST requests to /api/submit
    if (request.method === 'POST' && new URL(request.url).pathname === '/api/submit') {
      try {
        const data = await request.json();
        
        // Validate required fields
        if (!data.fullName || !data.phone || !data.email) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Missing required fields'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        // Save to Google Sheets
        const result = await saveToGoogleSheets(data, env);
        
        if (result.success) {
          // Send notification email (optional)
          await sendNotificationEmail(data, env);
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Data saved successfully'
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        } else {
          throw new Error(result.error);
        }
        
      } catch (error) {
        console.error('Error processing request:', error);
        
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // Return 404 for other requests
    return new Response('Not Found', { status: 404 });
  },
};

// Function to save data to Google Sheets
async function saveToGoogleSheets(data, env) {
  try {
    // Prepare the row data
    const rowData = [
      data.timestamp || new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      data.fullName || '',
      data.phone || '',
      data.email || '',
      data.city || '',
      data.age || '',
      data.experience || '',
      data.facebook || '',
      data.motivation || '',
      'Mới' // Status
    ];

    // Google Sheets API endpoint
    const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SPREADSHEET_ID}/values/Sheet1:append?valueInputOption=RAW&key=${env.GOOGLE_API_KEY}`;
    
    const response = await fetch(sheetsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowData]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google Sheets API error: ${response.status} - ${errorText}`);
    }

    return { success: true };
    
  } catch (error) {
    console.error('Error saving to Google Sheets:', error);
    return { success: false, error: error.message };
  }
}

// Function to send notification email using Cloudflare Email Workers (optional)
async function sendNotificationEmail(data, env) {
  try {
    // Skip if no email service configured
    if (!env.NOTIFICATION_EMAIL) {
      return;
    }

    const emailContent = {
      personalizations: [{
        to: [{ email: env.NOTIFICATION_EMAIL }],
        subject: '🎉 Đăng Ký Cộng Tác Viên Mới'
      }],
      from: { email: env.FROM_EMAIL || 'noreply@yourdomain.com' },
      content: [{
        type: 'text/html',
        value: generateEmailHTML(data)
      }]
    };

    // Use SendGrid API or similar email service
    if (env.SENDGRID_API_KEY) {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailContent),
      });

      if (!response.ok) {
        console.error('Email sending failed:', await response.text());
      }
    }
    
  } catch (error) {
    console.error('Error sending notification email:', error);
  }
}

// Generate HTML email content
function generateEmailHTML(data) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #f8b4cb, #d4a5d4); padding: 20px; border-radius: 10px 10px 0 0;">
        <h2 style="color: white; margin: 0;">Đăng Ký Cộng Tác Viên Mới</h2>
      </div>
      
      <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px;">
        <h3 style="color: #333; margin-top: 0;">Thông Tin Người Đăng Ký:</h3>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Họ Tên:</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.fullName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Số Điện Thoại:</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.phone}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Email:</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.email}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Tỉnh/Thành:</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.city}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Tuổi:</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.age || 'Không cung cấp'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Kinh Nghiệm:</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.experience || 'Không cung cấp'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">Facebook:</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${data.facebook || 'Không cung cấp'}</td>
          </tr>
        </table>
        
        ${data.motivation ? `
          <h4 style="color: #333; margin-top: 20px;">Lý Do Tham Gia:</h4>
          <p style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid #f8b4cb;">
            ${data.motivation}
          </p>
        ` : ''}
        
        <p style="margin-top: 20px; color: #666; font-size: 14px;">
          Thời gian đăng ký: ${data.timestamp || new Date().toLocaleString('vi-VN')}
        </p>
      </div>
    </div>
  `;
}