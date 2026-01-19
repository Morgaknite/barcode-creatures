// Seeded random number generator for deterministic creature generation
class SeededRandom {
    constructor(seed) {
        this.seed = seed;
    }
    
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
    
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
    
    choice(array) {
        return array[this.nextInt(0, array.length - 1)];
    }
}

// Constants for creature generation
const GENUS_NAMES = ['Globus', 'Angulus', 'Cylus', 'Torius', 'Prismus', 'Tentaculus', 'Alatus', 'Spinax', 'Cornus', 'Cristus', 'Maculatus', 'Striatus', 'Texturus', 'Magnus', 'Parvus', 'Rapidus', 'Fortis', 'Sagax', 'Polymorphus', 'Proteus', 'Oculus', 'Appendix', 'Dermatus', 'Chitinus', 'Mollus', 'Radiatus', 'Spiralus', 'Fractus', 'Symmetrus', 'Asymmetrus'];

const SPECIES_NAMES = ['ocularis', 'digitatus', 'corniger', 'spinatus', 'alatus', 'rubrus', 'viridis', 'caeruleus', 'aureus', 'argentus', 'striatus', 'maculatus', 'variegatus', 'cristatus', 'armatus', 'maximus', 'minimus', 'medius', 'validus', 'tenuis', 'elegans', 'robustus', 'gracilis', 'formosus', 'mirabilis', 'tentaculis', 'appendicus', 'dorsalis', 'lateralis', 'ventralis'];

const BODY_DESCRIPTORS = ['Spheroid', 'Cuboid', 'Pyramidal', 'Cylindrical', 'Toroidal', 'Prismatic', 'Amorphous', 'Segmented'];
const LIMB_DESCRIPTORS = ['Limbless', 'Twin-Limbed', 'Tri-Limbed', 'Quad-Limbed', 'Hexa-Limbed', 'Octo-Limbed'];
const EYE_DESCRIPTORS = ['Eyeless', 'Monocular', 'Binocular', 'Tri-Ocular', 'Quad-Ocular', 'Multi-Ocular'];
const FEATURE_DESCRIPTORS = ['Plain', 'Spiked', 'Horned', 'Antennae', 'Crested', 'Winged', 'Finned'];

const COLOR_PALETTES = {
    volcanic: { primary: [0, 20], secondary: [350, 360], accent: [30, 45], name: 'Volcanic' },
    oceanic: { primary: [190, 220], secondary: [240, 280], accent: [160, 180], name: 'Oceanic' },
    forest: { primary: [90, 140], secondary: [60, 80], accent: [40, 50], name: 'Forest' },
    arctic: { primary: [180, 220], secondary: [200, 240], accent: [0, 0], name: 'Arctic' },
    toxic: { primary: [280, 320], secondary: [120, 140], accent: [300, 330], name: 'Toxic' },
    desert: { primary: [30, 50], secondary: [15, 35], accent: [40, 60], name: 'Desert' },
    cosmic: { primary: [260, 290], secondary: [220, 250], accent: [280, 310], name: 'Cosmic' }
};

// Generate creature data from barcode
function generateCreatureData(barcode) {
    const rng = new SeededRandom(parseInt(barcode.substring(0, 10)));
    const digits = barcode.split('').map(Number);
    
    // Rarity calculation
    const sum = digits.reduce((a, b) => a + b);
    const uniqueDigits = new Set(digits).size;
    const patterns = {
        allSame: uniqueDigits === 1,
        pairs: digits.filter((d, i) => i < 11 && d === digits[i + 1]).length,
        sequential: digits.filter((d, i) => i < 11 && d + 1 === digits[i + 1]).length
    };
    
    let rarity = 'Common';
    if (patterns.allSame) rarity = 'Mythic';
    else if (sum > 100 || sum < 10) rarity = 'Legendary';
    else if (patterns.sequential >= 5) rarity = 'Epic';
    else if (patterns.pairs >= 4) rarity = 'Rare';
    else if (uniqueDigits <= 4) rarity = 'Uncommon';
    
    // Body
    const bodyTypes = ['circle', 'square', 'triangle', 'pentagon', 'hexagon', 'octagon', 'ellipse'];
    const bodyType = rng.choice(bodyTypes);
    const bodyDescriptor = rng.choice(BODY_DESCRIPTORS);
    
    // Limbs
    const limbCounts = [0, 2, 3, 4, 6, 8];
    const limbCount = rng.choice(limbCounts);
    const limbType = rng.choice(['standard', 'tentacle', 'wing', 'fin']);
    const limbDescriptor = LIMB_DESCRIPTORS[limbCounts.indexOf(limbCount)];
    
    // Eyes
    const eyeCounts = [0, 1, 2, 3, 4, 5];
    const eyeCount = rng.choice(eyeCounts);
    const eyeStyle = rng.choice(['simple', 'compound', 'stalked']);
    const eyeDescriptor = EYE_DESCRIPTORS[eyeCounts.indexOf(eyeCount)];
    
    // Features
    const hasSpikes = rng.next() > 0.7;
    const hasHorns = rng.next() > 0.7;
    const hasAntennae = rng.next() > 0.7;
    const hasCrest = rng.next() > 0.7;
    
    let featureDescriptor = 'Plain';
    if (hasSpikes) featureDescriptor = 'Spiked';
    else if (hasHorns) featureDescriptor = 'Horned';
    else if (hasAntennae) featureDescriptor = 'Antennae';
    else if (hasCrest) featureDescriptor = 'Crested';
    
    // Pattern
    const patterns_surface = ['smooth', 'spotted', 'striped', 'geometric'];
    const pattern = rng.choice(patterns_surface);
    
    // Colors
    const paletteKeys = Object.keys(COLOR_PALETTES);
    const paletteKey = rng.choice(paletteKeys);
    const palette = COLOR_PALETTES[paletteKey];
    
    const primaryHue = rng.nextInt(palette.primary[0], palette.primary[1]);
    const secondaryHue = rng.nextInt(palette.secondary[0], palette.secondary[1]);
    const accentHue = rng.nextInt(palette.accent[0], palette.accent[1]);
    
    // Names
    const genus = rng.choice(GENUS_NAMES);
    const species = rng.choice(SPECIES_NAMES);
    
    let commonName = '';
    if (eyeCount > 2) commonName += eyeDescriptor + ' ';
    if (featureDescriptor !== 'Plain') commonName += featureDescriptor + ' ';
    commonName += bodyDescriptor;
    
    // Stats
    const stats = {
        vitality: 30 + (digits[0] + digits[1]) * 4,
        mobility: 25 + (digits[2] + digits[3]) * 4,
        awareness: 20 + (digits[4] + digits[5]) * 4,
        defense: 35 + (digits[6] + digits[7]) * 3,
        adaptability: 30 + (digits[8] + digits[9]) * 3,
        temperament: ['Docile', 'Calm', 'Neutral', 'Wary', 'Aggressive'][rng.nextInt(0, 4)]
    };
    
    return {
        barcode,
        scientificName: `${genus} ${species}`,
        commonName,
        rarity,
        bodyType,
        bodyDescriptor,
        limbCount,
        limbType,
        limbDescriptor,
        eyeCount,
        eyeStyle,
        eyeDescriptor,
        hasSpikes,
        hasHorns,
        hasAntennae,
        hasCrest,
        featureDescriptor,
        pattern,
        colors: {
            primary: `hsl(${primaryHue}, 70%, 55%)`,
            secondary: `hsl(${secondaryHue}, 70%, 65%)`,
            accent: `hsl(${accentHue}, 70%, 50%)`,
            paletteName: palette.name
        },
        stats
    };
}

// Draw creature on canvas
function drawCreature(canvas, data) {
    const ctx = canvas.getContext('2d');
    // Recreate RNG from barcode for consistent spotted patterns
    const rng = new SeededRandom(parseInt(data.barcode.substring(0, 10)));
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    
    const { colors, bodyType, limbCount, limbType, eyeCount } = data;
    const { hasSpikes, hasHorns, hasAntennae, hasCrest, pattern } = data;
    
    // Scale for smaller canvases
    const scale = canvas.width / 280;
    ctx.scale(scale, scale);
    
    // Draw limbs (behind body)
    if (limbCount > 0) {
        ctx.fillStyle = colors.secondary;
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 3;
        
        for (let i = 0; i < limbCount; i++) {
            const angle = (i * Math.PI * 2) / limbCount;
            const baseX = Math.cos(angle) * 55;
            const baseY = Math.sin(angle) * 55;
            
            if (limbType === 'tentacle') {
                ctx.beginPath();
                ctx.moveTo(baseX, baseY);
                const segments = 4;
                for (let s = 1; s <= segments; s++) {
                    const dist = 55 + s * 15;
                    const wave = Math.sin(s) * 8;
                    const x = Math.cos(angle) * dist + Math.cos(angle + Math.PI/2) * wave;
                    const y = Math.sin(angle) * dist + Math.sin(angle + Math.PI/2) * wave;
                    ctx.lineTo(x, y);
                }
                ctx.strokeStyle = colors.secondary;
                ctx.lineWidth = 6;
                ctx.stroke();
                
                const tipDist = 55 + segments * 15;
                ctx.fillStyle = colors.accent;
                ctx.beginPath();
                ctx.arc(Math.cos(angle) * tipDist, Math.sin(angle) * tipDist, 6, 0, Math.PI * 2);
                ctx.fill();
            } else if (limbType === 'wing') {
                ctx.fillStyle = colors.secondary;
                ctx.beginPath();
                ctx.moveTo(baseX, baseY);
                ctx.quadraticCurveTo(
                    Math.cos(angle) * 90,
                    Math.sin(angle) * 90,
                    Math.cos(angle - 0.5) * 80,
                    Math.sin(angle - 0.5) * 80
                );
                ctx.lineTo(baseX, baseY);
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.fillStyle = colors.secondary;
                ctx.beginPath();
                ctx.arc(baseX, baseY, 18, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                
                ctx.fillStyle = colors.accent;
                ctx.beginPath();
                ctx.arc(Math.cos(angle) * 80, Math.sin(angle) * 80, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }
    }
    
    // Draw body
    ctx.fillStyle = colors.primary;
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 4;
    
    if (bodyType === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    } else if (bodyType === 'square') {
        ctx.fillRect(-45, -45, 90, 90);
        ctx.strokeRect(-45, -45, 90, 90);
    } else if (bodyType === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(0, -55);
        ctx.lineTo(-50, 45);
        ctx.lineTo(50, 45);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else if (bodyType === 'pentagon') {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
            const x = Math.cos(angle) * 50;
            const y = Math.sin(angle) * 50;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else if (bodyType === 'hexagon') {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI * 2) / 6;
            const x = Math.cos(angle) * 50;
            const y = Math.sin(angle) * 50;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else if (bodyType === 'octagon') {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI * 2) / 8;
            const x = Math.cos(angle) * 50;
            const y = Math.sin(angle) * 50;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else if (bodyType === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(0, 0, 50, 35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
    
    // Surface pattern
    if (pattern === 'spotted') {
        ctx.fillStyle = colors.accent;
        for (let i = 0; i < 5; i++) {
            const x = rng.nextInt(-30, 30);
            const y = rng.nextInt(-30, 30);
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (pattern === 'striped') {
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 3;
        for (let i = -40; i <= 40; i += 15) {
            ctx.beginPath();
            ctx.moveTo(i, -50);
            ctx.lineTo(i, 50);
            ctx.stroke();
        }
    }
    
    // Eyes
    if (eyeCount > 0) {
        ctx.fillStyle = 'white';
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        
        if (eyeCount === 1) {
            ctx.beginPath();
            ctx.arc(0, -10, 16, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath();
            ctx.arc(0, -10, 8, 0, Math.PI * 2);
            ctx.fill();
        } else if (eyeCount === 2) {
            [[-18, -15], [18, -15]].forEach(([x, y]) => {
                ctx.beginPath();
                ctx.arc(x, y, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#2c3e50';
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'white';
            });
        } else if (eyeCount === 3) {
            [[-20, -15], [0, -20], [20, -15]].forEach(([x, y]) => {
                ctx.beginPath();
                ctx.arc(x, y, 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#2c3e50';
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'white';
            });
        } else {
            for (let i = 0; i < eyeCount; i++) {
                const angle = (i * Math.PI * 2) / eyeCount;
                const x = Math.cos(angle) * 25;
                const y = Math.sin(angle) * 25 - 10;
                ctx.beginPath();
                ctx.arc(x, y, 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#2c3e50';
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'white';
            }
        }
    }
    
    // Cranial features
    if (hasSpikes) {
        ctx.fillStyle = colors.accent;
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            const x = -30 + i * 15;
            ctx.beginPath();
            ctx.moveTo(x - 5, -50);
            ctx.lineTo(x, -70);
            ctx.lineTo(x + 5, -50);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }
    
    if (hasHorns) {
        ctx.fillStyle = colors.accent;
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(-35, -45, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-35, -45);
        ctx.lineTo(-45, -65);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(35, -45, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(35, -45);
        ctx.lineTo(45, -65);
        ctx.stroke();
    }
    
    if (hasAntennae) {
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-15, -50);
        ctx.lineTo(-20, -75);
        ctx.stroke();
        ctx.fillStyle = colors.accent;
        ctx.beginPath();
        ctx.arc(-20, -75, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(15, -50);
        ctx.lineTo(20, -75);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(20, -75, 5, 0, Math.PI * 2);
        ctx.fill();
    }
    
    if (hasCrest) {
        ctx.fillStyle = colors.accent;
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-25, -50);
        ctx.quadraticCurveTo(0, -70, 25, -50);
        ctx.lineTo(20, -45);
        ctx.quadraticCurveTo(0, -60, -20, -45);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    
    ctx.restore();
}
