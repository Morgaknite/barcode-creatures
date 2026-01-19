# Barcode Creatures

A web app where you scan barcodes to discover unique creatures! Each barcode generates a completely unique creature with stats, traits, and scientific classification.

## Features
- 🔬 **Deterministic Generation** - Same barcode = same creature for everyone
- 📱 **Camera Scanning** - Use your phone camera to scan barcodes
- ☁️ **Cloud Storage** - Collection saved to Firebase (never lose your creatures!)
- 🔐 **Google Sign-In** - Secure authentication
- 📊 **Collection Management** - Filter by rarity, sort by name/date
- 💾 **Import/Export** - Backup your collection as JSON
- 🎨 **Unique Designs** - Thousands of possible creature combinations

## Setup Instructions

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter project name: `barcode-creatures` (or whatever you want)
4. Disable Google Analytics (optional)
5. Click "Create project"

### 2. Enable Authentication

1. In Firebase Console, click "Authentication" in left sidebar
2. Click "Get started"
3. Click "Google" under Sign-in providers
4. Toggle "Enable"
5. Choose a support email
6. Click "Save"

### 3. Create Firestore Database

1. In Firebase Console, click "Firestore Database" in left sidebar
2. Click "Create database"
3. Choose "Start in production mode"
4. Select your location (choose closest to you)
5. Click "Enable"

### 4. Set up Firestore Security Rules

1. In Firestore Database, click "Rules" tab
2. Replace with this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/creatures/{creatureId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

3. Click "Publish"

### 5. Get Firebase Config

1. In Firebase Console, click the gear icon (⚙️) next to "Project Overview"
2. Click "Project settings"
3. Scroll down to "Your apps"
4. Click the web icon (</>) to add a web app
5. Enter app nickname: "Barcode Creatures Web"
6. Check "Also set up Firebase Hosting" (optional)
7. Click "Register app"
8. Copy the `firebaseConfig` object

### 6. Update firebase-config.js

1. Open `firebase-config.js` in this folder
2. Replace the placeholder config with your actual config:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_ACTUAL_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123def456"
};
```

### 7. Test Locally

1. You need a local server because browsers block file:// URLs
2. Option A - Python (if installed):
   ```
   python -m http.server 8000
   ```
3. Option B - Node.js (if installed):
   ```
   npx serve
   ```
4. Open browser to `http://localhost:8000`

### 8. Deploy to GitHub Pages

1. Create a new repository on GitHub
2. Name it: `barcode-creatures`
3. Don't initialize with README
4. In your BarcodeGame folder, run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/barcode-creatures.git
git push -u origin main
```

5. Go to repository Settings → Pages
6. Source: Deploy from branch
7. Branch: main, folder: / (root)
8. Click Save
9. Your app will be live at: `https://YOUR_USERNAME.github.io/barcode-creatures/`

### 9. Add GitHub Pages URL to Firebase

1. Go to Firebase Console → Authentication
2. Click "Settings" tab → "Authorized domains"
3. Click "Add domain"
4. Add: `YOUR_USERNAME.github.io`
5. Click "Add"

## Usage

1. Open the app URL
2. Sign in with Google
3. Click "Start Camera" or "Enter Barcode Manually"
4. Scan any barcode (cereal box, shampoo, books, etc.)
5. Discover your unique creature!
6. Build your collection!

## Backup Your Collection

Click the backup button in your collection to download a JSON file. Keep this safe! You can re-import it anytime.

## Privacy

- Your collection is private (only you can see it)
- Stored securely in Firebase
- Google Sign-In for authentication

## Free Tier Limits

Firebase free tier includes:
- 50,000 reads/day
- 20,000 writes/day
- 1 GB storage

You won't hit these limits with normal use!
