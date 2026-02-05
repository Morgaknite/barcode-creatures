// Main App Logic
let currentUser = null;
let currentUserProfile = null;
let currentDiscoveryBarcode = null;
let editingBarcode = null;
let codeReader = null;
let scanning = false;

// Debug logging helper
function debugLog(message, data = null) {
    const timestamp = new Date().toISOString();
    if (data) {
        console.log(`[${timestamp}] ${message}`, data);
    } else {
        console.log(`[${timestamp}] ${message}`);
    }
}

// Show status message on login page
function showLoginStatus(message, isError = false) {
    const statusEl = document.getElementById('login-status');
    const errorEl = document.getElementById('login-error');
    
    if (isError) {
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        }
        if (statusEl) statusEl.style.display = 'none';
    } else {
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.display = 'block';
        }
        if (errorEl) errorEl.style.display = 'none';
    }
}

// Authentication State
auth.onAuthStateChanged(async user => {
    debugLog('Auth state changed:', user ? user.email : 'no user');
    
    if (user) {
        showLoginStatus('Signed in as ' + user.email + '. Loading your collection...');
        currentUser = user;
        
        // Check if user has username
        const hasUsername = await checkUsername();
        if (!hasUsername) {
            showUsernameModal();
        } else {
            showApp();
            updateUserInfo();
            loadCollection();
        }
    } else {
        currentUser = null;
        currentUserProfile = null;
        showLogin();
    }
});

// Handle redirect result - wait for Firebase to be ready
async function handleRedirectResult() {
    try {
        debugLog('Checking for redirect result...');
        showLoginStatus('Checking authentication...');
        
        const result = await auth.getRedirectResult();
        
        if (result && result.user) {
            debugLog('User signed in via redirect:', result.user.email);
            showLoginStatus('Sign in successful! Loading...');
            // Auth state change will handle the rest
        } else {
            debugLog('No redirect result found (this is normal on first visit)');
        }
    } catch (error) {
        debugLog('Redirect result error:', error);
        
        let errorMessage = '';
        
        switch (error.code) {
            case 'auth/account-exists-with-different-credential':
                errorMessage = 'An account already exists with this email using a different sign-in method.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your internet connection and try again.';
                break;
            case 'auth/unauthorized-domain':
                errorMessage = `ERROR: Domain not authorized. Current domain: ${window.location.hostname}. Add it to Firebase Console > Authentication > Settings > Authorized domains.`;
                break;
            case 'auth/popup-closed-by-user':
            case 'auth/cancelled-popup-request':
                // User closed popup, not an error
                break;
            case 'auth/internal-error':
                errorMessage = 'Authentication error. Please try again. If using an ad blocker, try disabling it.';
                break;
            default:
                if (error.code && error.message) {
                    errorMessage = `Sign in error (${error.code}): ${error.message}`;
                }
        }
        
        if (errorMessage) {
            showLoginStatus(errorMessage, true);
        }
    }
}

// Call redirect handler after a short delay to ensure Firebase is fully initialized
setTimeout(handleRedirectResult, 500);

function showLogin() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('login-page').classList.add('active');
    document.getElementById('main-nav').style.display = 'none';
    
    // Clear any previous status/error messages
    const statusEl = document.getElementById('login-status');
    const errorEl = document.getElementById('login-error');
    if (statusEl) statusEl.style.display = 'none';
    if (errorEl) errorEl.style.display = 'none';
}

function showApp() {
    document.getElementById('login-page').classList.remove('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('scanner-page').classList.add('active');
    document.getElementById('main-nav').style.display = 'flex';
    updateStats();
}

function updateUserInfo() {
    if (currentUser) {
        document.getElementById('user-email').textContent = currentUser.email;
    }
}

// Username Functions
async function checkUsername() {
    if (!currentUser) return false;
    
    try {
        const doc = await db.collection('users').doc(currentUser.uid).get();
        if (doc.exists && doc.data().username) {
            currentUserProfile = doc.data();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error checking username:', error);
        return false;
    }
}

function showUsernameModal() {
    // Hide login page first
    document.getElementById('login-page').classList.remove('active');
    // Show username modal
    document.getElementById('username-modal').classList.add('active');
    setTimeout(() => document.getElementById('username-input').focus(), 100);
}

async function validateUsername(username) {
    // Check format
    if (!username || username.length === 0) {
        return { valid: false, error: 'Username cannot be empty' };
    }
    
    if (username.length > 20) {
        return { valid: false, error: 'Username must be 20 characters or less' };
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        return { valid: false, error: 'Only letters, numbers, underscores, and hyphens allowed' };
    }
    
    // Check uniqueness (case-insensitive)
    const lowerUsername = username.toLowerCase();
    try {
        const doc = await db.collection('usernames').doc(lowerUsername).get();
        if (doc.exists) {
            const data = doc.data();
            if (data.userId && data.userId !== currentUser.uid) {
                return { valid: false, error: 'Username already taken' };
            }
        }
        return { valid: true };
    } catch (error) {
        console.error('Error validating username:', error);
        console.log('Cannot check username availability, proceeding anyway');
        return { valid: true };
    }
}

async function saveUsername(username) {
    if (!currentUser) return false;
    
    const lowerUsername = username.toLowerCase();
    
    try {
        await db.collection('users').doc(currentUser.uid).set({
            username: username,
            email: currentUser.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        await db.collection('usernames').doc(lowerUsername).set({
            userId: currentUser.uid,
            claimedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        currentUserProfile = { username, email: currentUser.email };
        return true;
    } catch (error) {
        console.error('Error saving username:', error);
        return false;
    }
}

async function updateLeaderboard() {
    if (!currentUser || !currentUserProfile) return;
    
    try {
        const collection = await loadCollection();
        const entries = Object.entries(collection);
        
        const rarityCounts = { Mythic: 0, Legendary: 0, Epic: 0, Rare: 0, Uncommon: 0, Common: 0 };
        let specialTagCount = 0;
        
        entries.forEach(([_, data]) => {
            rarityCounts[data.rarity] = (rarityCounts[data.rarity] || 0) + 1;
            specialTagCount += (data.specialTags?.length || 0);
        });
        
        await db.collection('leaderboard').doc(currentUser.uid).set({
            username: currentUserProfile.username,
            totalCreatures: entries.length,
            mythicCount: rarityCounts.Mythic,
            legendaryCount: rarityCounts.Legendary,
            epicCount: rarityCounts.Epic,
            rareCount: rarityCounts.Rare,
            uncommonCount: rarityCounts.Uncommon,
            commonCount: rarityCounts.Common,
            specialTagCount: specialTagCount,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error updating leaderboard:', error);
    }
}

// ==========================================
// GOOGLE SIGN IN
// ==========================================
document.getElementById('google-signin').onclick = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    const signInBtn = document.getElementById('google-signin');
    
    try {
        signInBtn.disabled = true;
        signInBtn.innerHTML = '<span class="google-icon">G</span> Signing in...';
        showLoginStatus('Opening Google sign-in...');
        
        debugLog('Starting Google sign-in...');
        debugLog('Current URL:', window.location.href);
        debugLog('Auth domain:', auth.app.options.authDomain);
        
        // Detect if we're on mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        debugLog('Is mobile:', isMobile);
        
        // On mobile, use redirect (more reliable)
        // On desktop, try popup first
        if (isMobile) {
            debugLog('Using redirect method (mobile)...');
            showLoginStatus('Redirecting to Google...');
            await auth.signInWithRedirect(provider);
            // Page will redirect, no code after this runs
        } else {
            // Desktop - try popup first
            try {
                debugLog('Trying popup method (desktop)...');
                const result = await auth.signInWithPopup(provider);
                debugLog('Popup sign in successful:', result.user.email);
                // Auth state change will handle the rest
            } catch (popupError) {
                debugLog('Popup failed:', popupError.code);
                
                // If popup fails, fall back to redirect
                if (popupError.code === 'auth/popup-blocked' || 
                    popupError.code === 'auth/popup-closed-by-user' ||
                    popupError.code === 'auth/cancelled-popup-request') {
                    debugLog('Falling back to redirect...');
                    showLoginStatus('Popup blocked, redirecting...');
                    await auth.signInWithRedirect(provider);
                } else {
                    throw popupError;
                }
            }
        }
        
    } catch (error) {
        debugLog('Sign in error:', error);
        signInBtn.disabled = false;
        signInBtn.innerHTML = '<span class="google-icon">G</span> Sign in with Google';
        
        let errorMessage = 'Sign in failed. ';
        
        switch (error.code) {
            case 'auth/popup-blocked':
                errorMessage = 'Popup blocked. Please allow popups or try again.';
                break;
            case 'auth/network-request-failed':
                errorMessage += 'Network error. Please check your internet connection.';
                break;
            case 'auth/unauthorized-domain':
                errorMessage += `Domain not authorized: ${window.location.hostname}`;
                break;
            case 'auth/operation-not-allowed':
                errorMessage += 'Google sign-in is not enabled in Firebase.';
                break;
            case 'auth/internal-error':
                errorMessage += 'Internal error. Please try again.';
                break;
            default:
                errorMessage += error.message || 'Unknown error occurred.';
        }
        
        showLoginStatus(errorMessage, true);
    }
};

// ==========================================
// EMAIL/PASSWORD SIGN IN
// ==========================================

// Toggle between sign in and sign up mode
let isSignUpMode = false;

function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    const toggleBtn = document.getElementById('email-toggle-mode');
    const submitBtn = document.getElementById('email-submit');
    const confirmPasswordGroup = document.getElementById('confirm-password-group');
    
    if (isSignUpMode) {
        toggleBtn.textContent = 'Already have an account? Sign In';
        submitBtn.textContent = 'Create Account';
        if (confirmPasswordGroup) confirmPasswordGroup.style.display = 'block';
    } else {
        toggleBtn.textContent = "Don't have an account? Sign Up";
        submitBtn.textContent = 'Sign In';
        if (confirmPasswordGroup) confirmPasswordGroup.style.display = 'none';
    }
}

async function handleEmailAuth() {
    const email = document.getElementById('email-input').value.trim();
    const password = document.getElementById('password-input').value;
    const confirmPassword = document.getElementById('confirm-password-input')?.value;
    const submitBtn = document.getElementById('email-submit');
    
    // Validation
    if (!email || !password) {
        showLoginStatus('Please enter email and password', true);
        return;
    }
    
    if (isSignUpMode && password !== confirmPassword) {
        showLoginStatus('Passwords do not match', true);
        return;
    }
    
    if (password.length < 6) {
        showLoginStatus('Password must be at least 6 characters', true);
        return;
    }
    
    try {
        submitBtn.disabled = true;
        submitBtn.textContent = isSignUpMode ? 'Creating account...' : 'Signing in...';
        showLoginStatus(isSignUpMode ? 'Creating your account...' : 'Signing you in...');
        
        if (isSignUpMode) {
            debugLog('Creating new account:', email);
            const result = await auth.createUserWithEmailAndPassword(email, password);
            debugLog('Account created:', result.user.email);
        } else {
            debugLog('Signing in with email:', email);
            const result = await auth.signInWithEmailAndPassword(email, password);
            debugLog('Signed in:', result.user.email);
        }
        // Auth state change will handle the rest
        
    } catch (error) {
        debugLog('Email auth error:', error);
        submitBtn.disabled = false;
        submitBtn.textContent = isSignUpMode ? 'Create Account' : 'Sign In';
        
        let errorMessage = '';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'This email is already registered. Try signing in instead.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Please enter a valid email address.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak. Use at least 6 characters.';
                break;
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email. Try signing up instead.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password. Please try again.';
                break;
            case 'auth/invalid-credential':
                errorMessage = 'Invalid email or password. Please check and try again.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your connection.';
                break;
            default:
                errorMessage = error.message || 'Authentication failed. Please try again.';
        }
        
        showLoginStatus(errorMessage, true);
    }
}

// Password reset
async function handlePasswordReset() {
    const email = document.getElementById('email-input').value.trim();
    
    if (!email) {
        showLoginStatus('Please enter your email address first', true);
        return;
    }
    
    try {
        showLoginStatus('Sending password reset email...');
        await auth.sendPasswordResetEmail(email);
        showLoginStatus('Password reset email sent! Check your inbox.');
    } catch (error) {
        debugLog('Password reset error:', error);
        
        let errorMessage = '';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Please enter a valid email address.';
                break;
            default:
                errorMessage = error.message || 'Failed to send reset email.';
        }
        showLoginStatus(errorMessage, true);
    }
}

// Attach event listeners for email auth (will be attached after DOM is ready)
document.addEventListener('DOMContentLoaded', () => {
    const emailSubmit = document.getElementById('email-submit');
    const emailToggle = document.getElementById('email-toggle-mode');
    const forgotPassword = document.getElementById('forgot-password');
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    
    if (emailSubmit) {
        emailSubmit.onclick = handleEmailAuth;
    }
    
    if (emailToggle) {
        emailToggle.onclick = toggleAuthMode;
    }
    
    if (forgotPassword) {
        forgotPassword.onclick = handlePasswordReset;
    }
    
    // Enter key handlers
    if (emailInput) {
        emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                passwordInput?.focus();
            }
        });
    }
    
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (isSignUpMode) {
                    document.getElementById('confirm-password-input')?.focus();
                } else {
                    handleEmailAuth();
                }
            }
        });
    }
    
    const confirmPasswordInput = document.getElementById('confirm-password-input');
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleEmailAuth();
            }
        });
    }
});

// ==========================================
// USERNAME MODAL
// ==========================================
document.getElementById('save-username').onclick = async () => {
    const username = document.getElementById('username-input').value.trim();
    const errorEl = document.getElementById('username-error');
    const saveBtn = document.getElementById('save-username');
    
    errorEl.style.display = 'none';
    
    const validation = await validateUsername(username);
    if (!validation.valid) {
        errorEl.textContent = validation.error;
        errorEl.style.display = 'block';
        return;
    }
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
        const success = await saveUsername(username);
        if (success) {
            document.getElementById('username-modal').classList.remove('active');
            showApp();
            updateUserInfo();
            await loadCollection();
            await updateLeaderboard();
        } else {
            throw new Error('Failed to save username');
        }
    } catch (error) {
        console.error('Username save error:', error);
        errorEl.textContent = 'Failed to save username. Please try again or contact support.';
        errorEl.style.display = 'block';
        saveBtn.disabled = false;
        saveBtn.textContent = 'Continue';
    }
};

document.getElementById('username-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('save-username').click();
    }
});

document.getElementById('username-input').addEventListener('input', () => {
    document.getElementById('username-error').style.display = 'none';
});

// Sign Out
document.getElementById('signout-btn').onclick = async () => {
    if (confirm('Are you sure you want to sign out?')) {
        await auth.signOut();
    }
};

// Database Functions
async function saveCreature(barcode, data, sourceItem = '') {
    if (!currentUser) return;
    
    try {
        const { rng, ...cleanData } = data;
        
        await db.collection('users').doc(currentUser.uid).collection('creatures').doc(barcode).set({
            ...cleanData,
            sourceItem,
            capturedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error('Error saving creature:', error);
        showError('Failed to save creature. Please try again.');
    }
}

async function updateCreatureSource(barcode, sourceItem) {
    if (!currentUser) return;
    
    try {
        await db.collection('users').doc(currentUser.uid).collection('creatures').doc(barcode).update({
            sourceItem
        });
    } catch (error) {
        console.error('Error updating source:', error);
    }
}

async function loadCollection() {
    if (!currentUser) return;
    
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid).collection('creatures').get();
        const collection = {};
        snapshot.forEach(doc => {
            collection[doc.id] = doc.data();
        });
        return collection;
    } catch (error) {
        console.error('Error loading collection:', error);
        return {};
    }
}

async function getCreature(barcode) {
    if (!currentUser) return null;
    
    try {
        const doc = await db.collection('users').doc(currentUser.uid).collection('creatures').doc(barcode).get();
        return doc.exists ? doc.data() : null;
    } catch (error) {
        console.error('Error getting creature:', error);
        return null;
    }
}

async function getCollectionCount() {
    if (!currentUser) return 0;
    
    try {
        const snapshot = await db.collection('users').doc(currentUser.uid).collection('creatures').get();
        return snapshot.size;
    } catch (error) {
        return 0;
    }
}

// UI Functions
function showSuccess(message) {
    const el = document.getElementById('success-message');
    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
}

function showError(message) {
    const el = document.getElementById('camera-error');
    el.textContent = message;
    el.style.display = 'block';
}

async function updateStats() {
    const count = await getCollectionCount();
    document.getElementById('total-count').textContent = count;
    document.getElementById('collection-total').textContent = count;
}

// Barcode Processing
async function processBarcode(barcode) {
    if (!/^\d{12}$/.test(barcode)) {
        showError('Please enter a valid 12-digit barcode');
        return;
    }

    const existing = await getCreature(barcode);
    if (existing) {
        showSuccess(`Already in collection: ${existing.scientificName}`);
        document.getElementById('last-scan').textContent = existing.scientificName;
        return;
    }

    showSuccess('Scanning... Looking up product info...');
    
    const data = generateCreatureData(barcode);
    
    let productName = '';
    try {
        const productInfo = await lookupProduct(barcode);
        if (productInfo) {
            productName = productInfo;
            console.log('Found product:', productName);
        }
    } catch (error) {
        console.log('Product lookup failed, continuing anyway:', error);
    }
    
    await saveCreature(barcode, data, productName);
    
    showDiscovery(barcode, data, productName);
    
    document.getElementById('last-scan').textContent = data.scientificName;
    updateStats();
    
    await updateLeaderboard();
}

// Product Lookup Function
async function lookupProduct(barcode) {
    console.log('Looking up product for barcode:', barcode);
    
    const apis = [
        async () => {
            try {
                const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
                if (!response.ok) throw new Error('UPCitemdb failed');
                const data = await response.json();
                if (data.items && data.items.length > 0) {
                    const item = data.items[0];
                    return item.title || item.brand || null;
                }
                return null;
            } catch (error) {
                console.log('UPCitemdb lookup failed:', error);
                return null;
            }
        },
        
        async () => {
            try {
                const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
                if (!response.ok) throw new Error('OpenFoodFacts failed');
                const data = await response.json();
                if (data.status === 1 && data.product && data.product.product_name) {
                    return data.product.product_name;
                }
                return null;
            } catch (error) {
                console.log('OpenFoodFacts lookup failed:', error);
                return null;
            }
        },
        
        async () => {
            try {
                const response = await fetch(`https://api.upcdatabase.org/product/${barcode}`);
                if (!response.ok) throw new Error('UPCDatabase failed');
                const data = await response.json();
                if (data.success && data.title) {
                    return data.title;
                }
                return null;
            } catch (error) {
                console.log('UPCDatabase lookup failed:', error);
                return null;
            }
        },
        
        async () => {
            try {
                const response = await fetch(`https://api.barcodelookup.com/v3/products?barcode=${barcode}&formatted=y&key=trial`);
                if (!response.ok) throw new Error('Barcodelookup failed');
                const data = await response.json();
                if (data.products && data.products.length > 0) {
                    return data.products[0].title || data.products[0].product_name;
                }
                return null;
            } catch (error) {
                console.log('Barcodelookup lookup failed:', error);
                return null;
            }
        }
    ];
    
    for (const apiFunc of apis) {
        try {
            const result = await apiFunc();
            if (result) {
                console.log('Product found:', result);
                return result;
            }
        } catch (error) {
            continue;
        }
    }
    
    console.log('No product info found from any API');
    return null;
}

function showDiscovery(barcode, data, productName = '') {
    currentDiscoveryBarcode = barcode;
    const modal = document.getElementById('discovery-modal');
    const canvas = document.getElementById('discovery-canvas');
    
    document.getElementById('discovery-scientific').textContent = data.scientificName;
    document.getElementById('discovery-common').textContent = data.commonName;
    
    const sourceInput = document.getElementById('discovery-source-input');
    sourceInput.value = productName;
    if (productName) {
        sourceInput.placeholder = 'Product auto-detected!';
    } else {
        sourceInput.placeholder = 'e.g., PS5 box, Shampoo bottle';
    }
    
    const rarityBadge = document.getElementById('discovery-rarity');
    rarityBadge.textContent = data.rarity;
    rarityBadge.className = `discovery-rarity-big rarity-${data.rarity.toLowerCase()}`;
    
    drawCreature(canvas, data);
    modal.classList.add('active');
}

// Collection Rendering
async function renderCollection() {
    const grid = document.getElementById('collection-grid');
    const emptyState = document.getElementById('empty-state');
    const collection = await loadCollection();
    const entries = Object.entries(collection);

    if (entries.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    const rarityFilter = document.getElementById('rarity-filter').value;
    const sortFilter = document.getElementById('sort-filter').value;

    let filtered = entries;
    if (rarityFilter) {
        filtered = filtered.filter(([_, data]) => data.rarity === rarityFilter);
    }

    if (sortFilter === 'recent') {
        filtered.sort((a, b) => {
            const timeA = a[1].capturedAt?.toMillis?.() || 0;
            const timeB = b[1].capturedAt?.toMillis?.() || 0;
            return timeB - timeA;
        });
    } else if (sortFilter === 'name') {
        filtered.sort((a, b) => a[1].scientificName.localeCompare(b[1].scientificName));
    } else if (sortFilter === 'rarity') {
        const rarityOrder = { 'Mythic': 0, 'Legendary': 1, 'Epic': 2, 'Rare': 3, 'Uncommon': 4, 'Common': 5 };
        filtered.sort((a, b) => rarityOrder[a[1].rarity] - rarityOrder[b[1].rarity]);
    }

    grid.innerHTML = '';
    filtered.forEach(([barcode, data]) => {
        const card = document.createElement('div');
        card.className = 'creature-card-mini';
        card.onclick = () => showDetail(barcode);

        card.innerHTML = `
            <div class="mini-canvas-container">
                <canvas width="120" height="120"></canvas>
            </div>
            <div class="mini-info">
                <div class="mini-name">${data.scientificName.split(' ')[0]}</div>
                <div class="mini-common">${data.commonName}</div>
                <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                    <span class="mini-rarity rarity-${data.rarity.toLowerCase()}">${data.rarity}</span>
                    ${data.specialTags && data.specialTags.length > 0 ? `<span style="font-size: 1.1rem; line-height: 1;">${data.specialTags.map(tag => tag.icon).join('')}</span>` : ''}
                </div>
            </div>
        `;

        const canvas = card.querySelector('canvas');
        drawCreature(canvas, data);
        grid.appendChild(card);
    });
}

async function showDetail(barcode) {
    const data = await getCreature(barcode);
    if (!data) return;

    const modal = document.getElementById('detail-modal');
    const content = document.getElementById('detail-content');

    const sourceDisplay = data.sourceItem ? `
        <div class="source-display">
            <div>
                <span class="source-label-small">Source:</span>
                <span class="source-text">${data.sourceItem}</span>
            </div>
            <button class="edit-source-btn" onclick="editSource('${barcode}')">Edit</button>
        </div>
    ` : `
        <div class="source-display">
            <div>
                <span class="source-label-small">Source:</span>
                <span class="source-text" style="opacity: 0.5;">Not specified</span>
            </div>
            <button class="edit-source-btn" onclick="editSource('${barcode}')">Add</button>
        </div>
    `;
    
    let captureDate = 'Unknown';
    if (data.capturedAt) {
        const date = data.capturedAt.toDate ? data.capturedAt.toDate() : new Date(data.capturedAt);
        captureDate = date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    content.innerHTML = `
        <div class="creature-card-full">
            <div class="card-header">
                <div class="rarity-badge rarity-${data.rarity.toLowerCase()}">${data.rarity}</div>
                ${data.specialTags && data.specialTags.length > 0 ? `<div class="special-tags-icons">${data.specialTags.map(tag => tag.icon).join(' ')}</div>` : ''}
                <div class="scientific-name">${data.scientificName}</div>
                <div class="common-name">${data.commonName}</div>
                <div class="specimen-id">Specimen ID: ${barcode}</div>
            </div>
            <div class="creature-display">
                <canvas width="280" height="280"></canvas>
            </div>
            <div class="card-body">
                ${sourceDisplay}
                
                <div class="habitat-bar">
                    <span class="habitat-label">Captured:</span>
                    <span class="habitat-tag">${captureDate}</span>
                </div>
                
                <div class="section-title">Physical Traits</div>
                <div class="trait-grid">
                    <div class="trait-item">
                        <span class="trait-label">Body</span>
                        <span class="trait-value">${data.bodyDescriptor}</span>
                    </div>
                    <div class="trait-item">
                        <span class="trait-label">Limbs</span>
                        <span class="trait-value">${data.limbDescriptor}</span>
                    </div>
                    <div class="trait-item">
                        <span class="trait-label">Eyes</span>
                        <span class="trait-value">${data.eyeDescriptor}</span>
                    </div>
                    <div class="trait-item">
                        <span class="trait-label">Features</span>
                        <span class="trait-value">${data.featureDescriptor}</span>
                    </div>
                </div>
                <div class="habitat-bar">
                    <span class="habitat-label">Coloration:</span>
                    <span class="habitat-tag">${data.colors.paletteName}</span>
                </div>
                
                <div class="section-title">Statistics</div>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-label">Vitality</div>
                        <div class="stat-value">${data.stats.vitality}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Mobility</div>
                        <div class="stat-value">${data.stats.mobility}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Awareness</div>
                        <div class="stat-value">${data.stats.awareness}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">Defense</div>
                        <div class="stat-value">${data.stats.defense}</div>
                    </div>
                </div>
                <div class="habitat-bar">
                    <span class="habitat-label">Temperament:</span>
                    <span class="habitat-tag">${data.stats.temperament}</span>
                </div>
                
                ${data.specialTags && data.specialTags.length > 0 ? `
                    <div class="section-title">Special Traits</div>
                    <div class="special-traits-list">
                        ${data.specialTags.map(tag => `
                            <div class="special-trait-item">
                                <span class="special-trait-icon">${tag.icon}</span>
                                <div class="special-trait-info">
                                    <div class="special-trait-name">${tag.name}</div>
                                    <div class="special-trait-reason">${tag.reason}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    const canvas = content.querySelector('canvas');
    drawCreature(canvas, data);

    modal.classList.add('active');
}

function editSource(barcode) {
    editingBarcode = barcode;
    getCreature(barcode).then(data => {
        const modal = document.getElementById('source-edit-modal');
        const input = document.getElementById('source-edit-input');
        
        input.value = data.sourceItem || '';
        modal.classList.add('active');
        
        setTimeout(() => input.focus(), 100);
    });
}

// Camera scanning
let activeStream = null;

document.getElementById('start-camera').onclick = async () => {
    const startBtn = document.getElementById('start-camera');
    
    if (scanning) {
        scanning = false;
        if (activeStream) {
            activeStream.getTracks().forEach(track => track.stop());
            activeStream = null;
        }
        document.getElementById('video').srcObject = null;
        startBtn.textContent = 'Start Camera';
        const scanGuide = document.getElementById('scan-guide');
        if (scanGuide) {
            scanGuide.style.display = 'none';
            document.getElementById('scanner-container').classList.remove('scanning');
        }
        return;
    }
    
    try {
        const video = document.getElementById('video');
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showError('Camera not supported in this browser. Please use "Enter Barcode Manually" instead.');
            return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            } 
        });
        activeStream = stream;
        video.srcObject = stream;
        
        await video.play();

        codeReader = new ZXing.BrowserMultiFormatReader();
        
        scanning = true;
        startBtn.textContent = 'Stop Camera';
        document.getElementById('camera-error').style.display = 'none';
        
        const scanGuide = document.getElementById('scan-guide');
        if (scanGuide) {
            scanGuide.style.display = 'block';
            document.getElementById('scanner-container').classList.add('scanning');
        }

        codeReader.decodeFromVideoDevice(undefined, 'video', (result, error) => {
            if (result) {
                const barcode = result.text;
                console.log('Detected barcode:', barcode);
                
                if (/^\d{12,13}$/.test(barcode)) {
                    console.log('Valid barcode found:', barcode);
                    
                    processBarcode(barcode.substring(0, 12));
                    
                    scanning = false;
                    codeReader.reset();
                    startBtn.textContent = 'Start Camera';
                    
                    if (scanGuide) {
                        scanGuide.style.display = 'none';
                        document.getElementById('scanner-container').classList.remove('scanning');
                    }
                    
                    if (activeStream) {
                        activeStream.getTracks().forEach(track => track.stop());
                        activeStream = null;
                    }
                    video.srcObject = null;
                    
                    if (navigator.vibrate) {
                        navigator.vibrate(200);
                    }
                }
            }
        });
        
    } catch (err) {
        console.error('Camera error:', err);
        scanning = false;
        let message = 'Camera access denied or not available. ';
        if (err.name === 'NotAllowedError') {
            message += 'Please allow camera access in your browser settings.';
        } else if (err.name === 'NotFoundError') {
            message += 'No camera found on this device.';
        } else if (err.name === 'NotSupportedError') {
            message += 'Camera requires HTTPS connection. Use "Enter Barcode Manually" instead.';
        } else {
            message += 'Error: ' + err.message + '. Use "Enter Barcode Manually" to add creatures.';
        }
        showError(message);
        document.getElementById('start-camera').textContent = 'Start Camera';
        
        const scanGuide = document.getElementById('scan-guide');
        if (scanGuide) {
            scanGuide.style.display = 'none';
            document.getElementById('scanner-container').classList.remove('scanning');
        }
    }
};

document.getElementById('submit-barcode').onclick = () => {
    const barcode = document.getElementById('barcode-input').value;
    processBarcode(barcode);
    document.getElementById('barcode-input').value = '';
};

document.getElementById('barcode-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('submit-barcode').click();
    }
});

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.onclick = () => {
        const page = btn.dataset.page;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(page).classList.add('active');
        btn.classList.add('active');

        if (page === 'collection-page') {
            renderCollection();
        } else if (page === 'stats-page') {
            renderStats();
        } else if (page === 'leaderboards-page') {
            renderLeaderboards('total');
        }
    };
});

// Filters
document.getElementById('rarity-filter').onchange = renderCollection;
document.getElementById('sort-filter').onchange = renderCollection;

// Leaderboards
let currentLeaderboardCategory = 'total';

document.querySelectorAll('.leaderboard-tab').forEach(tab => {
    tab.onclick = () => {
        const category = tab.dataset.category;
        document.querySelectorAll('.leaderboard-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderLeaderboards(category);
    };
});

async function renderLeaderboards(category) {
    currentLeaderboardCategory = category;
    const listEl = document.getElementById('leaderboard-list');
    
    listEl.innerHTML = '<div class="loading-state"><div class="loading-icon">🔄</div><p>Loading...</p></div>';
    
    try {
        let query = db.collection('leaderboard');
        
        if (category === 'total') {
            query = query.orderBy('totalCreatures', 'desc').limit(100);
        } else if (category === 'mythic') {
            query = query.orderBy('mythicCount', 'desc').limit(100);
        } else if (category === 'tags') {
            query = query.orderBy('specialTagCount', 'desc').limit(100);
        }
        
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            listEl.innerHTML = `
                <div class="empty-leaderboard">
                    <div class="empty-leaderboard-icon">🏆</div>
                    <h2>No Rankings Yet</h2>
                    <p>Be the first to appear on the leaderboard!</p>
                </div>
            `;
            return;
        }
        
        listEl.innerHTML = '';
        let rank = 1;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const isCurrentUser = currentUser && doc.id === currentUser.uid;
            
            let score, columnLabel;
            if (category === 'total') {
                score = data.totalCreatures || 0;
                columnLabel = 'Total Creatures';
            } else if (category === 'mythic') {
                score = data.mythicCount || 0;
                columnLabel = 'Mythic & Legendary';
            } else if (category === 'tags') {
                score = data.specialTagCount || 0;
                columnLabel = 'Special Tags';
            }
            
            const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
            
            const item = document.createElement('div');
            item.className = `leaderboard-item${isCurrentUser ? ' current-user' : ''}`;
            item.innerHTML = `
                <div class="leaderboard-rank ${rankClass}">${rank}</div>
                <div class="leaderboard-info">
                    <div class="leaderboard-username">${data.username || 'Anonymous'}${isCurrentUser ? ' (You)' : ''}</div>
                    <div class="leaderboard-column-label">${columnLabel}</div>
                </div>
                <div class="leaderboard-score">${score}</div>
            `;
            
            listEl.appendChild(item);
            rank++;
        });
        
    } catch (error) {
        console.error('Error loading leaderboard:', error);
        listEl.innerHTML = `
            <div class="empty-leaderboard">
                <div class="empty-leaderboard-icon">⚠️</div>
                <h2>Error Loading Leaderboard</h2>
                <p>Please try again later.</p>
            </div>
        `;
    }
}

// Stats Rendering
async function renderStats() {
    const collection = await loadCollection();
    const entries = Object.entries(collection);
    
    document.getElementById('total-creatures-stat').textContent = entries.length;
    
    if (entries.length === 0) {
        document.getElementById('rarest-creature-stat').textContent = 'None';
        document.getElementById('recent-scans-stat').textContent = '0';
        document.getElementById('rarity-breakdown').innerHTML = '<p style="opacity: 0.7;">No creatures yet</p>';
        document.getElementById('recent-discoveries').innerHTML = '<p style="opacity: 0.7;">Start scanning!</p>';
        return;
    }
    
    const rarityOrder = { 'Mythic': 6, 'Legendary': 5, 'Epic': 4, 'Rare': 3, 'Uncommon': 2, 'Common': 1 };
    const rarest = entries.reduce((prev, curr) => 
        rarityOrder[curr[1].rarity] > rarityOrder[prev[1].rarity] ? curr : prev
    );
    document.getElementById('rarest-creature-stat').textContent = rarest[1].rarity;
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentCount = entries.filter(([_, data]) => {
        if (!data.capturedAt) return false;
        const captureDate = data.capturedAt.toDate ? data.capturedAt.toDate() : new Date(data.capturedAt);
        return captureDate >= weekAgo;
    }).length;
    document.getElementById('recent-scans-stat').textContent = recentCount;
    
    const rarityCounts = {};
    entries.forEach(([_, data]) => {
        rarityCounts[data.rarity] = (rarityCounts[data.rarity] || 0) + 1;
    });
    
    const rarityBreakdown = document.getElementById('rarity-breakdown');
    rarityBreakdown.innerHTML = '';
    ['Mythic', 'Legendary', 'Epic', 'Rare', 'Uncommon', 'Common'].forEach(rarity => {
        const count = rarityCounts[rarity] || 0;
        const percentage = ((count / entries.length) * 100).toFixed(1);
        rarityBreakdown.innerHTML += `
            <div class="rarity-bar">
                <div class="rarity-bar-label">
                    <span class="mini-rarity rarity-${rarity.toLowerCase()}">${rarity}</span>
                    <span>${percentage}%</span>
                </div>
                <div class="rarity-bar-count">${count}</div>
            </div>
        `;
    });
    
    const sorted = entries.sort((a, b) => {
        const timeA = a[1].capturedAt?.toMillis?.() || 0;
        const timeB = b[1].capturedAt?.toMillis?.() || 0;
        return timeB - timeA;
    });
    
    const recentDiscoveries = document.getElementById('recent-discoveries');
    recentDiscoveries.innerHTML = '';
    sorted.slice(0, 5).forEach(([barcode, data]) => {
        let dateStr = 'Recently';
        if (data.capturedAt) {
            const date = data.capturedAt.toDate ? data.capturedAt.toDate() : new Date(data.capturedAt);
            dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        recentDiscoveries.innerHTML += `
            <div class="recent-discovery-item" onclick="showDetail('${barcode}')">
                <div>
                    <div class="recent-discovery-name">${data.scientificName}</div>
                    <div class="recent-discovery-date">${dateStr}</div>
                </div>
                <span class="mini-rarity rarity-${data.rarity.toLowerCase()}">${data.rarity}</span>
            </div>
        `;
    });
    
    const bodyCounts = {};
    const colorCounts = {};
    let totalEyes = 0;
    let totalLimbs = 0;
    
    entries.forEach(([_, data]) => {
        bodyCounts[data.bodyDescriptor] = (bodyCounts[data.bodyDescriptor] || 0) + 1;
        colorCounts[data.colors.paletteName] = (colorCounts[data.colors.paletteName] || 0) + 1;
        totalEyes += data.eyeCount || 0;
        totalLimbs += data.limbCount || 0;
    });
    
    const mostCommonBody = Object.keys(bodyCounts).reduce((a, b) => bodyCounts[a] > bodyCounts[b] ? a : b, 'None');
    const mostCommonColor = Object.keys(colorCounts).reduce((a, b) => colorCounts[a] > colorCounts[b] ? a : b, 'None');
    
    document.getElementById('common-body').textContent = mostCommonBody;
    document.getElementById('common-color').textContent = mostCommonColor;
    document.getElementById('avg-eyes').textContent = (totalEyes / entries.length).toFixed(1);
    document.getElementById('avg-limbs').textContent = (totalLimbs / entries.length).toFixed(1);
}

// Modals
document.getElementById('close-modal').onclick = () => {
    document.getElementById('detail-modal').classList.remove('active');
};

document.getElementById('close-discovery').onclick = async () => {
    const sourceInput = document.getElementById('discovery-source-input').value.trim();
    if (sourceInput && currentDiscoveryBarcode) {
        await updateCreatureSource(currentDiscoveryBarcode, sourceInput);
    }
    
    document.getElementById('discovery-modal').classList.remove('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('collection-page').classList.add('active');
    document.querySelector('[data-page="collection-page"]').classList.add('active');
    renderCollection();
};

document.getElementById('save-source-edit').onclick = async () => {
    const sourceInput = document.getElementById('source-edit-input').value.trim();
    if (editingBarcode) {
        await updateCreatureSource(editingBarcode, sourceInput);
        document.getElementById('source-edit-modal').classList.remove('active');
        showDetail(editingBarcode);
        renderCollection();
    }
};

document.getElementById('cancel-source-edit').onclick = () => {
    document.getElementById('source-edit-modal').classList.remove('active');
};

document.getElementById('source-edit-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('save-source-edit').click();
    }
});

// Export/Import
document.getElementById('export-btn').onclick = async () => {
    const collection = await loadCollection();
    const dataStr = JSON.stringify(collection, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `barcode-creatures-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showSuccess('Collection exported successfully!');
};

document.getElementById('import-btn').onclick = () => {
    document.getElementById('import-file').click();
};

document.getElementById('import-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (confirm(`Import ${Object.keys(data).length} creatures? This will add to your existing collection.`)) {
            for (const [barcode, creatureData] of Object.entries(data)) {
                await saveCreature(barcode, creatureData, creatureData.sourceItem || '');
            }
            showSuccess('Collection imported successfully!');
            updateStats();
            renderCollection();
        }
    } catch (error) {
        showError('Failed to import collection. Please check the file format.');
    }
    
    e.target.value = '';
};

document.getElementById('backup-btn').onclick = () => {
    document.getElementById('export-btn').click();
};
