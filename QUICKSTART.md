# Quick Start Guide

Follow these steps in order:

## Step 1: Create Firebase Project (5 minutes)

1. Go to https://console.firebase.google.com/
2. Click "Create a project"
3. Name it "barcode-creatures"
4. Disable Analytics
5. Click "Create project"

## Step 2: Enable Google Authentication (2 minutes)

1. Click "Authentication" in sidebar
2. Click "Get started"
3. Click "Google" provider
4. Toggle "Enable"
5. Choose your email as support email
6. Click "Save"

## Step 3: Create Database (2 minutes)

1. Click "Firestore Database" in sidebar
2. Click "Create database"
3. Choose "Production mode"
4. Select your region
5. Click "Enable"

## Step 4: Set Security Rules (1 minute)

1. In Firestore, click "Rules" tab
2. Copy this:

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

3. Paste and click "Publish"

## Step 5: Get Your Config (2 minutes)

1. Click gear icon ⚙️ next to "Project Overview"
2. Click "Project settings"
3. Scroll to "Your apps"
4. Click web icon (</>)
5. Register app name: "Barcode Creatures"
6. Copy the `firebaseConfig` code

## Step 6: Update firebase-config.js

1. Open `firebase-config.js` in this folder
2. Paste your actual config (replace the YOUR_... placeholders)
3. Save the file

## Step 7: Test Locally

Open Command Prompt in this folder and run:
```
python -m http.server 8000
```

Or if you have Node.js:
```
npx serve
```

Then open: http://localhost:8000

## Step 8: Deploy to GitHub Pages (optional)

1. Create repo on GitHub: "barcode-creatures"
2. In this folder (BarcodeGame), run:

```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/barcode-creatures.git
git push -u origin main
```

3. Go to repo Settings → Pages
4. Source: main branch
5. Save

Your app will be live at:
https://YOUR_USERNAME.github.io/barcode-creatures/

## Step 9: Add Domain to Firebase

1. Firebase Console → Authentication → Settings
2. Authorized domains → Add domain
3. Add: YOUR_USERNAME.github.io
4. Click Add

---

## You're Done!

Visit your GitHub Pages URL, sign in, and start scanning barcodes!

## Having Issues?

- Make sure firebase-config.js has your REAL config (not placeholders)
- Check browser console (F12) for errors
- Verify Firestore rules are published
- Ensure GitHub Pages is enabled
