// Main App Logic
let currentUser = null;
let currentDiscoveryBarcode = null;
let editingBarcode = null;
let codeReader = null;
let scanning = false;

// Authentication State
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        showApp();
        updateUserInfo();
        loadCollection();
    } else {
        currentUser = null;
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

// Google Sign In
document.getElementById('google-signin').onclick = async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
    } catch (error) {
        alert('Sign in failed: ' + error.message);
    }
};

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

    const data = generateCreatureData(barcode);
    await saveCreature(barcode, data);
    
    // Show discovery modal
    showDiscovery(barcode, data);
    
    document.getElementById('last-scan').textContent = data.scientificName;
    updateStats();
}

function showDiscovery(barcode, data) {
    currentDiscoveryBarcode = barcode;
    const modal = document.getElementById('discovery-modal');
    const canvas = document.getElementById('discovery-canvas');
    
    document.getElementById('discovery-scientific').textContent = data.scientificName;
    document.getElementById('discovery-common').textContent = data.commonName;
    document.getElementById('discovery-source-input').value = '';
    
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
                <div class="mini-rarity rarity-${data.rarity.toLowerCase()}">${data.rarity}</div>
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

    content.innerHTML = `
        <div class="creature-card-full">
            <div class="card-header">
                <div class="rarity-badge rarity-${data.rarity.toLowerCase()}">${data.rarity}</div>
                <div class="scientific-name">${data.scientificName}</div>
                <div class="common-name">${data.commonName}</div>
                <div class="specimen-id">Specimen ID: ${barcode}</div>
            </div>
            <div class="creature-display">
                <canvas width="280" height="280"></canvas>
            </div>
            <div class="card-body">
                ${sourceDisplay}
                
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
document.getElementById('start-camera').onclick = async () => {
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
        video.srcObject = stream;
        
        // Wait for video to be ready
        await video.play();

        codeReader = new ZXing.BrowserMultiFormatReader();
        
        scanning = true;
        document.getElementById('start-camera').textContent = 'Scanning...';
        document.getElementById('camera-error').style.display = 'none';
        
        // Show scan guide
        const scanGuide = document.getElementById('scan-guide');
        if (scanGuide) {
            scanGuide.style.display = 'block';
            document.getElementById('scanner-container').classList.add('scanning');
        }

        // Scan continuously but process results with throttle
        let lastAttempt = 0;
        const throttleMs = 100; // Try scanning every 100ms
        
        const scanLoop = async () => {
            if (!scanning) return;
            
            const now = Date.now();
            if (now - lastAttempt < throttleMs) {
                requestAnimationFrame(scanLoop);
                return;
            }
            lastAttempt = now;
            
            try {
                const result = await codeReader.decodeOnceFromVideoDevice(undefined, 'video');
                if (result && scanning) {
                    const barcode = result.text;
                    console.log('Scanned:', barcode);
                    if (/^\d{12,13}$/.test(barcode)) {
                        processBarcode(barcode.substring(0, 12));
                        scanning = false;
                        document.getElementById('start-camera').textContent = 'Start Camera';
                        
                        // Hide scan guide
                        if (scanGuide) {
                            scanGuide.style.display = 'none';
                            document.getElementById('scanner-container').classList.remove('scanning');
                        }
                        
                        // Stop the camera
                        stream.getTracks().forEach(track => track.stop());
                        video.srcObject = null;
                        
                        // Vibrate on success
                        if (navigator.vibrate) {
                            navigator.vibrate(200);
                        }
                    }
                }
            } catch (err) {
                // No barcode found, continue scanning
            }
            
            if (scanning) {
                requestAnimationFrame(scanLoop);
            }
        };
        
        scanLoop();
        
    } catch (err) {
        console.error('Camera error:', err);
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

// Manual input
document.getElementById('toggle-manual').onclick = () => {
    const input = document.getElementById('manual-input');
    input.classList.toggle('active');
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
        }
    };
});

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
