// Main App Logic
let currentUser = null;
let currentUserProfile = null;
let currentDiscoveryBarcode = null;
let editingBarcode = null;
let codeReader = null;
let scanning = false;

// Authentication State
auth.onAuthStateChanged(async user => {
    if (user) {
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

function showLogin() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('login-page').classList.add('active');
    document.getElementById('main-nav').style.display = 'none';
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
        // Try to get the username document
        const doc = await db.collection('usernames').doc(lowerUsername).get();
        if (doc.exists) {
            const data = doc.data();
            // If it exists and belongs to someone else, it's taken
            if (data.userId && data.userId !== currentUser.uid) {
                return { valid: false, error: 'Username already taken' };
            }
        }
        // Username is available
        return { valid: true };
    } catch (error) {
        console.error('Error validating username:', error);
        // If we can't check (permissions issue), allow it and let the save operation handle it
        console.log('Cannot check username availability, proceeding anyway');
        return { valid: true };
    }
}

async function saveUsername(username) {
    if (!currentUser) return false;
    
    const lowerUsername = username.toLowerCase();
    
    try {
        // Save to users collection
        await db.collection('users').doc(currentUser.uid).set({
            username: username,
            email: currentUser.email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Claim username
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
        
        // Calculate stats
        const rarityCounts = { Mythic: 0, Legendary: 0, Epic: 0, Rare: 0, Uncommon: 0, Common: 0 };
        let specialTagCount = 0;
        
        entries.forEach(([_, data]) => {
            rarityCounts[data.rarity] = (rarityCounts[data.rarity] || 0) + 1;
            specialTagCount += (data.specialTags?.length || 0);
        });
        
        // Update leaderboard
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

// Google Sign In
document.getElementById('google-signin').onclick = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    const signInBtn = document.getElementById('google-signin');
    
    try {
        signInBtn.disabled = true;
        signInBtn.innerHTML = '<span class="google-icon">G</span> Signing in...';
        
        // Use redirect instead of popup for better mobile compatibility
        await auth.signInWithRedirect(provider);
    } catch (error) {
        console.error('Sign in error:', error);
        signInBtn.disabled = false;
        signInBtn.innerHTML = '<span class="google-icon">G</span> Sign in with Google';
        
        let errorMessage = 'Sign in failed. ';
        if (error.code === 'auth/popup-blocked') {
            errorMessage += 'Please allow popups for this site.';
        } else if (error.code === 'auth/network-request-failed') {
            errorMessage += 'Network error. Please check your internet connection.';
        } else if (error.code === 'auth/unauthorized-domain') {
            errorMessage += 'This domain is not authorized. Please contact support.';
        } else {
            errorMessage += error.message;
        }
        
        alert(errorMessage);
    }
};

// Handle redirect result on page load
auth.getRedirectResult().then((result) => {
    if (result.user) {
        console.log('Successfully signed in via redirect');
    }
}).catch((error) => {
    console.error('Redirect result error:', error);
    
    // Show user-friendly error messages
    if (error.code === 'auth/account-exists-with-different-credential') {
        alert('An account already exists with this email using a different sign-in method.');
    } else if (error.code === 'auth/network-request-failed') {
        alert('Network error during sign in. Please check your internet connection and try again.');
    } else if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        alert('Sign in error: ' + error.message + '\n\nPlease try again or contact support if the problem persists.');
    }
});

// Username Modal
document.getElementById('save-username').onclick = async () => {
    const username = document.getElementById('username-input').value.trim();
    const errorEl = document.getElementById('username-error');
    const saveBtn = document.getElementById('save-username');
    
    // Clear previous errors
    errorEl.style.display = 'none';
    
    // Validate
    const validation = await validateUsername(username);
    if (!validation.valid) {
        errorEl.textContent = validation.error;
        errorEl.style.display = 'block';
        return;
    }
    
    // Save
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
        // Remove the rng object before saving (Firebase doesn't support it)
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

    // Show loading message
    showSuccess('Scanning... Looking up product info...');
    
    const data = generateCreatureData(barcode);
    
    // Try to lookup product info
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
    
    // Show discovery modal
    showDiscovery(barcode, data, productName);
    
    document.getElementById('last-scan').textContent = data.scientificName;
    updateStats();
    
    // Update leaderboard
    await updateLeaderboard();
}

// Product Lookup Function - tries multiple APIs
async function lookupProduct(barcode) {
    console.log('Looking up product for barcode:', barcode);
    
    // Try multiple APIs in sequence
    const apis = [
        // API 1: UPCitemdb (good general coverage)
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
        
        // API 2: Open Food Facts (food/drinks)
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
        
        // API 3: UPCDatabase.org (another good option)
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
        
        // API 4: Barcodelookup.com
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
    
    // Try each API until one succeeds
    for (const apiFunc of apis) {
        try {
            const result = await apiFunc();
            if (result) {
                console.log('Product found:', result);
                return result;
            }
        } catch (error) {
            // Continue to next API
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
    
    // Pre-fill with product name if found
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

    // Apply filters
    const rarityFilter = document.getElementById('rarity-filter').value;
    const sortFilter = document.getElementById('sort-filter').value;

    let filtered = entries;
    if (rarityFilter) {
        filtered = filtered.filter(([_, data]) => data.rarity === rarityFilter);
    }

    // Sort
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
    
    // Format capture date
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
    
    // If already scanning, stop it
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
        
        // Wait for video to be ready
        await video.play();

        codeReader = new ZXing.BrowserMultiFormatReader();
        
        scanning = true;
        startBtn.textContent = 'Stop Camera';
        document.getElementById('camera-error').style.display = 'none';
        
        // Show scan guide
        const scanGuide = document.getElementById('scan-guide');
        if (scanGuide) {
            scanGuide.style.display = 'block';
            document.getElementById('scanner-container').classList.add('scanning');
        }

        // Use the callback-based continuous scanning (it actually works better)
        codeReader.decodeFromVideoDevice(undefined, 'video', (result, error) => {
            if (result) {
                const barcode = result.text;
                console.log('Detected barcode:', barcode);
                
                // Only process valid 12-13 digit barcodes
                if (/^\d{12,13}$/.test(barcode)) {
                    console.log('Valid barcode found:', barcode);
                    
                    // Process it
                    processBarcode(barcode.substring(0, 12));
                    
                    // Stop scanning
                    scanning = false;
                    codeReader.reset();
                    startBtn.textContent = 'Start Camera';
                    
                    // Hide scan guide
                    if (scanGuide) {
                        scanGuide.style.display = 'none';
                        document.getElementById('scanner-container').classList.remove('scanning');
                    }
                    
                    // Stop the camera
                    if (activeStream) {
                        activeStream.getTracks().forEach(track => track.stop());
                        activeStream = null;
                    }
                    video.srcObject = null;
                    
                    // Vibrate on success
                    if (navigator.vibrate) {
                        navigator.vibrate(200);
                    }
                }
            }
            // Errors are normal - just means no barcode detected in this frame
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
        
        // Hide scan guide on error
        const scanGuide = document.getElementById('scan-guide');
        if (scanGuide) {
            scanGuide.style.display = 'none';
            document.getElementById('scanner-container').classList.remove('scanning');
        }
    }
};

// Manual input - now in Settings page, no toggle needed

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
        
        // Sort by category
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

// Filters
document.getElementById('rarity-filter').onchange = renderCollection;
document.getElementById('sort-filter').onchange = renderCollection;

// Stats Rendering
async function renderStats() {
    const collection = await loadCollection();
    const entries = Object.entries(collection);
    
    // Total creatures
    document.getElementById('total-creatures-stat').textContent = entries.length;
    
    if (entries.length === 0) {
        document.getElementById('rarest-creature-stat').textContent = 'None';
        document.getElementById('recent-scans-stat').textContent = '0';
        document.getElementById('rarity-breakdown').innerHTML = '<p style="opacity: 0.7;">No creatures yet</p>';
        document.getElementById('recent-discoveries').innerHTML = '<p style="opacity: 0.7;">Start scanning!</p>';
        return;
    }
    
    // Rarest creature (Mythic > Legendary > Epic > Rare > Uncommon > Common)
    const rarityOrder = { 'Mythic': 6, 'Legendary': 5, 'Epic': 4, 'Rare': 3, 'Uncommon': 2, 'Common': 1 };
    const rarest = entries.reduce((prev, curr) => 
        rarityOrder[curr[1].rarity] > rarityOrder[prev[1].rarity] ? curr : prev
    );
    document.getElementById('rarest-creature-stat').textContent = rarest[1].rarity;
    
    // Recent scans (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentCount = entries.filter(([_, data]) => {
        if (!data.capturedAt) return false;
        const captureDate = data.capturedAt.toDate ? data.capturedAt.toDate() : new Date(data.capturedAt);
        return captureDate >= weekAgo;
    }).length;
    document.getElementById('recent-scans-stat').textContent = recentCount;
    
    // Rarity breakdown
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
    
    // Recent discoveries (last 5)
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
    
    // Top stats
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

// Filters
document.getElementById('rarity-filter').onchange = renderCollection;
document.getElementById('sort-filter').onchange = renderCollection;

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
