#!/usr/bin/env node

// Test Gmail OAuth credentials
require('dotenv').config();
const { google } = require('googleapis');

async function testGmailAuth() {
  console.log('Testing Gmail OAuth credentials...\n');
  
  // Check if credentials exist
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  
  if (!clientId || !clientSecret || !refreshToken) {
    console.error('❌ Missing Gmail credentials in .env file');
    console.log('Required: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN');
    process.exit(1);
  }
  
  console.log('✅ Credentials found in .env');
  console.log(`Client ID: ${clientId.substring(0, 20)}...`);
  console.log(`Client Secret: ${clientSecret.substring(0, 10)}...`);
  console.log(`Refresh Token: ${refreshToken.substring(0, 20)}...`);
  console.log('');
  
  try {
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'https://developers.google.com/oauthplayground'
    );
    
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });
    
    // Initialize Gmail API
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    console.log('Attempting to fetch emails from Gmail...\n');
    
    // Try to list recent messages
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:inbox newer_than:1d',
      maxResults: 5,
    });
    
    const messages = response.data.messages || [];
    console.log(`✅ Successfully authenticated! Found ${messages.length} recent emails\n`);
    
    if (messages.length > 0) {
      console.log('Fetching details for first email...');
      
      // Get details of first message
      const messageDetail = await gmail.users.messages.get({
        userId: 'me',
        id: messages[0].id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date'],
      });
      
      const headers = messageDetail.data.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || 'No subject';
      const from = headers.find(h => h.name === 'From')?.value || 'Unknown sender';
      const date = headers.find(h => h.name === 'Date')?.value || 'Unknown date';
      
      console.log('\nFirst email:');
      console.log(`  Subject: ${subject}`);
      console.log(`  From: ${from}`);
      console.log(`  Date: ${date}`);
    }
    
    console.log('\n✅ Gmail credentials are working correctly!');
    
  } catch (error) {
    console.error('\n❌ Gmail authentication failed!\n');
    console.error('Error details:');
    
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    } else if (error.message) {
      console.error('Message:', error.message);
    } else {
      console.error(error);
    }
    
    if (error.message?.includes('invalid_client')) {
      console.log('\n🔧 Fix: The client credentials are invalid. You need to:');
      console.log('1. Go to Google Cloud Console');
      console.log('2. Create new OAuth 2.0 credentials');
      console.log('3. Update GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env');
    } else if (error.message?.includes('invalid_grant') || error.message?.includes('Token has been expired or revoked')) {
      console.log('\n🔧 Fix: The refresh token has expired. You need to:');
      console.log('1. Run: npm run generate:oauth');
      console.log('2. Follow the authorization flow');
      console.log('3. Update GMAIL_REFRESH_TOKEN in .env with the new token');
    }
    
    process.exit(1);
  }
}

testGmailAuth().catch(console.error);