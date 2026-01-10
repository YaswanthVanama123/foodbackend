# Firebase Setup Guide for Backend

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project" or select an existing project
3. Enter your project name (e.g., "Patlinks")
4. Enable/disable Google Analytics (optional)
5. Click "Create Project"

## Step 2: Get Service Account Credentials

### Method 1: Download JSON File (Recommended)

1. In Firebase Console, click the ⚙️ **Settings** icon → **Project Settings**
2. Go to the **Service Accounts** tab
3. Click **"Generate New Private Key"** button
4. A JSON file will be downloaded (e.g., `patlinks-firebase-adminsdk-xxxxx.json`)

### Method 2: View Credentials in Console

Alternatively, you can view the credentials directly in the Firebase Console:
- Project ID is shown at the top of the page
- Click "Generate New Private Key" to see the credentials

## Step 3: Extract Values from JSON File

Open the downloaded JSON file. It will look like this:

```json
{
  "type": "service_account",
  "project_id": "patlinks-12345",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-abc@patlinks-12345.iam.gserviceaccount.com",
  "client_id": "1234567890",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

## Step 4: Update Backend .env File

Open `/packages/backend/.env` and update these values:

```env
# ============================================
# FIREBASE CLOUD MESSAGING (FCM)
# ============================================

# Copy from JSON: "project_id"
FIREBASE_PROJECT_ID=patlinks-12345

# Copy from JSON: "private_key"
# IMPORTANT: Keep the quotes and \n characters exactly as they are!
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"

# Copy from JSON: "client_email"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-abc@patlinks-12345.iam.gserviceaccount.com

# Optional: Your Firebase database URL (if using Realtime Database)
FIREBASE_DATABASE_URL=https://patlinks-12345.firebaseio.com

# Enable Firebase
FIREBASE_ENABLED=true
```

### ⚠️ IMPORTANT: Private Key Format

The `FIREBASE_PRIVATE_KEY` must be wrapped in **double quotes** and include the `\n` characters:

✅ **CORRECT:**
```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADA...\n-----END PRIVATE KEY-----\n"
```

❌ **WRONG:**
```env
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
MIIEvQIBADA...
-----END PRIVATE KEY-----
```

## Step 5: Verify Setup

1. Start your backend server:
   ```bash
   cd /Users/yaswanthgandhi/Documents/patlinks/packages/backend
   npm run dev
   ```

2. Check the console output. You should see:
   ```
   ✅ Firebase Admin SDK initialized successfully
   ```

3. If you see an error, check:
   - Private key format (must have `\n` and quotes)
   - Project ID is correct
   - Client email is correct

## Step 6: Enable Cloud Messaging API

1. In Firebase Console, go to **Project Settings** → **Cloud Messaging**
2. Make sure **Cloud Messaging API** is enabled
3. If not enabled, click **"Enable"**

## Step 7: Setup Web Push Certificate (for Frontend)

1. In Firebase Console, go to **Project Settings** → **Cloud Messaging** tab
2. Scroll down to **"Web Push certificates"** section
3. Click **"Generate key pair"** if you don't have one
4. Copy the **"Key pair"** value (starts with `B...`)
5. Save this for the frontend `.env` file as `VITE_FIREBASE_VAPID_KEY`

## Troubleshooting

### Error: "Failed to initialize Firebase Admin SDK"

**Solution:** Check your private key format. It must be wrapped in quotes with `\n` characters.

### Error: "Invalid service account credentials"

**Solution:**
- Make sure you downloaded the correct JSON file
- Check that project ID matches
- Regenerate the private key if needed

### Firebase shows as "⚠️ Not Configured"

**Solution:**
- Check `FIREBASE_ENABLED=true` in `.env`
- Verify all three required fields are filled
- Restart the server

## Security Notes

⚠️ **NEVER commit the service account JSON file or .env file to Git!**

- Add `.env` to `.gitignore` (already done)
- Keep the JSON file secure
- Don't share credentials publicly
- Rotate keys regularly in production

## Need Help?

If you encounter any issues:
1. Check the Firebase Console for API quota limits
2. Verify your Firebase project is on the Spark (free) or Blaze (pay-as-you-go) plan
3. Make sure Cloud Messaging API is enabled in Google Cloud Console
