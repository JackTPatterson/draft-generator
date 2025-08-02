import { google } from 'googleapis';

// Environment variables
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.NEXTAUTH_URL}/api/auth/callback/google`;

// Validate environment variables
if (!CLIENT_ID || !CLIENT_SECRET || !process.env.NEXTAUTH_URL) {
  console.error('Missing required environment variables:', {
    CLIENT_ID: !!CLIENT_ID,
    CLIENT_SECRET: !!CLIENT_SECRET,
    NEXTAUTH_URL: !!process.env.NEXTAUTH_URL
  });
}

export const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send', 
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
];

export function getAuthUrl(): string {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('OAuth client not properly configured. Check environment variables.');
  }

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
    include_granted_scopes: true
  });
}

export async function exchangeCodeForTokens(code: string) {
  if (!code) {
    throw new Error('Authorization code is required');
  }
  
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export function setCredentials(tokens: any) {
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

export async function getGmailClient(tokens: any) {
  const authClient = setCredentials(tokens);
  return google.gmail({ version: 'v1', auth: authClient });
}

export async function getUserProfile(tokens: any) {
  const authClient = setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: authClient });
  const { data } = await oauth2.userinfo.get();
  return data;
}