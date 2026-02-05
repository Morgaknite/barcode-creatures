// Firebase Configuration
// Using Firebase Compat (v9 compat mode) to match the HTML script tags

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDi6Gy-Z3E6SlRqraacuc-IhK1A5ABJW7A",
  authDomain: "barcode-creatures.firebaseapp.com",
  projectId: "barcode-creatures",
  storageBucket: "barcode-creatures.firebasestorage.app",
  messagingSenderId: "1050983051702",
  appId: "1:1050983051702:web:3bc532db40920656b3d117",
  measurementId: "G-SNG8PHM5MJ"
};

// Initialize Firebase (using compat mode)
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Set auth persistence to LOCAL (survives browser restarts)
// This helps with mobile browsers that may clear session storage
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => {
    console.log('Auth persistence set to LOCAL');
  })
  .catch((error) => {
    console.warn('Could not set auth persistence:', error);
  });

console.log('Firebase initialized successfully!');
console.log('Auth domain:', firebaseConfig.authDomain);
console.log('Current domain:', window.location.hostname);
