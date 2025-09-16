console.log("Starting Assembly Viewer...");

// Screen Detection and Scaling System
class ScreenScaler {
    constructor() {
        this.screenWidth = window.innerWidth;
        this.screenHeight = window.innerHeight;
        this.screenDiagonal = Math.sqrt(this.screenWidth * this.screenWidth + this.screenHeight * this.screenHeight);
        this.baseWidth = 1920; // Base desktop width
        this.baseHeight = 1080; // Base desktop height
        this.baseDiagonal = Math.sqrt(this.baseWidth * this.baseWidth + this.baseHeight * this.baseHeight);
        
        // Calculate scale factors
        this.scaleX = this.screenWidth / this.baseWidth;
        this.scaleY = this.screenHeight / this.baseHeight;
        this.scaleDiagonal = this.screenDiagonal / this.baseDiagonal;
        
        // Use the smallest scale to maintain proportions
        this.scale = Math.min(this.scaleX, this.scaleY, this.scaleDiagonal);
        
        // Clamp scale between 0.5 and 2.0 for usability
        this.scale = Math.max(0.5, Math.min(2.0, this.scale));
        
        console.log(`📱 Screen: ${this.screenWidth}x${this.screenHeight}, Scale: ${this.scale.toFixed(2)}`);
        
        // Apply scaling to CSS custom properties
        this.applyScaling();
        
        // Listen for resize events
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('orientationchange', () => this.handleResize());
    }
    
    applyScaling() {
        const root = document.documentElement;
        root.style.setProperty('--scale-factor', this.scale);
        root.style.setProperty('--screen-width', `${this.screenWidth}px`);
        root.style.setProperty('--screen-height', `${this.screenHeight}px`);
        
        // Update viewport meta tag for better mobile scaling
        let viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
        }
        viewport.content = `width=device-width, initial-scale=${this.scale}, maximum-scale=${this.scale * 1.5}, user-scalable=yes`;
    }
    
    handleResize() {
        setTimeout(() => {
            this.screenWidth = window.innerWidth;
            this.screenHeight = window.innerHeight;
            this.screenDiagonal = Math.sqrt(this.screenWidth * this.screenWidth + this.screenHeight * this.screenHeight);
            
            this.scaleX = this.screenWidth / this.baseWidth;
            this.scaleY = this.screenHeight / this.baseHeight;
            this.scaleDiagonal = this.screenDiagonal / this.baseDiagonal;
            
            this.scale = Math.min(this.scaleX, this.scaleY, this.scaleDiagonal);
            this.scale = Math.max(0.5, Math.min(2.0, this.scale));
            
            console.log(`📱 Resized: ${this.screenWidth}x${this.screenHeight}, Scale: ${this.scale.toFixed(2)}`);
            this.applyScaling();
            
            // Update camera aspect ratio
            if (perspectiveCamera) {
                perspectiveCamera.aspect = this.screenWidth / this.screenHeight;
                perspectiveCamera.updateProjectionMatrix();
            }
            
            // Update renderer size
            if (renderer) {
                renderer.setSize(this.screenWidth, this.screenHeight);
            }
        }, 100);
    }
    
    getScaledSize(baseSize) {
        return Math.round(baseSize * this.scale);
    }
    
    getScaledFontSize(baseFontSize) {
        return Math.max(10, Math.round(baseFontSize * this.scale));
    }
}

// Initialize screen scaler
const screenScaler = new ScreenScaler();

// Create scene
const scene = new THREE.Scene();
const sceneGroup = new THREE.Group(); // Only for model
scene.add(sceneGroup);
const perspectiveCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const orthographicCamera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);
let activeCamera = perspectiveCamera;
perspectiveCamera.position.set(0, 0, 5);
orthographicCamera.position.set(0, 0, 5);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Set a Blender-like background
renderer.setClearColor(0x2c3e50);

// Add a floor plane to receive shadows (fixed on XZ plane)
const floorGeometry = new THREE.PlaneGeometry(100, 100);
const floorMaterial = new THREE.ShadowMaterial({ opacity: 0.2 });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2; // Fixed XZ plane
floor.position.y = -2;
floor.receiveShadow = true;
scene.add(floor); // Add to scene, not sceneGroup

// Add axis indicator (cube gizmo with labels)
const cubeSize = 1.0;
const cubeGeometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
const cubeMaterials = [
    new THREE.MeshBasicMaterial({ color: 0xff0000 }), // +X (red)
    new THREE.MeshBasicMaterial({ color: 0xff0000 }), // -X
    new THREE.MeshBasicMaterial({ color: 0x00ff00 }), // +Y (green)
    new THREE.MeshBasicMaterial({ color: 0x00ff00 }), // -Y
    new THREE.MeshBasicMaterial({ color: 0x0000ff }), // +Z (blue)
    new THREE.MeshBasicMaterial({ color: 0x0000ff })  // -Z
];
const axisCube = new THREE.Mesh(cubeGeometry, cubeMaterials);
const axisGroup = new THREE.Group();
axisGroup.add(axisCube);

// Add axis labels (simplified without FontLoader)
const labelMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const xLabel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), labelMaterial);
const yLabel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), labelMaterial);
const zLabel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), labelMaterial);

xLabel.position.set(cubeSize / 2 + 0.3, 0, 0);
yLabel.position.set(0, cubeSize / 2 + 0.3, 0);
zLabel.position.set(0, 0, cubeSize / 2 + 0.3);
axisGroup.add(xLabel, yLabel, zLabel);
scene.add(axisGroup);

const axisCamera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
axisCamera.position.set(0, 0, 5);
axisCamera.lookAt(0, 0, 0);

// Add enhanced lights for a Blender-like scene
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
hemisphereLight.position.set(0, 20, 0);
scene.add(hemisphereLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
directionalLight.position.set(5, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
scene.add(directionalLight);
const pointLight = new THREE.PointLight(0xffffff, 0.8, 100);
pointLight.position.set(0, 5, 0);
pointLight.castShadow = true;
scene.add(pointLight);

// Add OrbitControls with extended zoom and mobile support
const controls = new THREE.OrbitControls(activeCamera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 1;
controls.maxDistance = 500;

// Mobile touch controls
controls.enableTouch = true;
controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN
};

// Mobile-specific settings
controls.enableKeys = true;
controls.keyPanSpeed = 7.0;
controls.rotateSpeed = 0.5;
controls.zoomSpeed = 0.5;
controls.panSpeed = 0.8;

// Initialize PartAnalyzer and PartManager
const partAnalyzer = new PartAnalyzer();
const partManager = new PartManager(scene, activeCamera, renderer);

// Video sequences will be loaded after parts are loaded

// Glossy black HDPE-like material
let hdpeMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.2,
    metalness: 0.0
});

// Initialize highlight2Material based on hdpeMaterial
console.log(`🔧 Initializing highlight2Material with hdpeMaterial:`, hdpeMaterial);
partManager.createHighlight2Material(hdpeMaterial);
console.log(`🔧 highlight2Material created:`, partManager.highlight2Material);

// Ghost material for non-selected parts
const ghostMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.2,
    metalness: 0.0,
    opacity: 0.3,
    transparent: true
});

// Track ghost mode
let isGhostMode = false;

// Track up-axis and apply scope
let upAxis = localStorage.getItem('upAxis') || 'Y';
let applyScope = localStorage.getItem('applyScope') || 'global';
let modelGroup = null;

// Function to toggle ghost mode
function toggleGhostMode() {
    isGhostMode = !isGhostMode;
    const button = document.getElementById('toggleGhostMode');
    button.textContent = isGhostMode ? 'Deaktiver spøkelsesmodus' : 'Aktiver spøkelsesmodus';

    const selectedPart = partManager.getSelectedPart();
    partManager.getAllParts().forEach(part => {
        const mesh = part.mesh;
        if (mesh) {
            if (isGhostMode && part !== selectedPart) {
                if (!mesh.userData.originalMaterial) {
                    mesh.userData.originalMaterial = mesh.material;
                }
                mesh.material = ghostMaterial;
            } else {
                mesh.material = mesh.userData.originalMaterial || hdpeMaterial;
            }
        }
    });
}

// Function to update ghost mode on part selection
function updateGhostMode() {
    if (isGhostMode) {
        const selectedPart = partManager.getSelectedPart();
        partManager.getAllParts().forEach(part => {
            const mesh = part.mesh;
            if (mesh) {
                if (part === selectedPart || !selectedPart) {
                    mesh.material = mesh.userData.originalMaterial || hdpeMaterial;
                } else {
                    mesh.material = ghostMaterial;
                }
            }
        });
    }
}

// Override PartManager's selectPart to handle ghost mode
const originalSelectPart = partManager.selectPart;
partManager.selectPart = function(partId) {
    originalSelectPart.call(this, partId);
    updateGhostMode();
};

// Function to apply up-axis orientation (only to modelGroup)
function applyUpAxis(axis) {
    // Reset modelGroup rotation
    modelGroup.rotation.set(0, 0, 0);
    // Apply rotations based on up-axis
    switch (axis) {
        case 'Y':
            // No rotation needed
            break;
        case '-Y':
            modelGroup.rotation.x = Math.PI;
            break;
        case 'Z':
            modelGroup.rotation.x = Math.PI / 2;
            break;
        case '-Z':
            modelGroup.rotation.x = -Math.PI / 2;
            break;
        case 'X':
            modelGroup.rotation.z = -Math.PI / 2;
            break;
        case '-X':
            modelGroup.rotation.z = Math.PI / 2;
            break;
    }
    // Update axis gizmo orientation
    axisGroup.rotation.copy(modelGroup.rotation);
}

// Function to fit camera to object
function fitCameraToObject(object, offset = 1.5) {
    const boundingBox = new THREE.Box3().setFromObject(object);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (activeCamera === perspectiveCamera) {
        const fov = activeCamera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= offset;
        activeCamera.position.copy(center);
        activeCamera.position.z += cameraZ;
    } else {
        const frustumSize = maxDim * offset;
        activeCamera.left = -frustumSize / 2;
        activeCamera.right = frustumSize / 2;
        activeCamera.top = frustumSize / 2;
        activeCamera.bottom = -frustumSize / 2;
        activeCamera.position.copy(center);
        activeCamera.position.z += maxDim * offset;
        activeCamera.updateProjectionMatrix();
    }
    activeCamera.lookAt(center);
    controls.target.copy(center);
    controls.update();
}

// Function to set predefined camera views
function setCameraView(view) {
    if (!modelGroup) return;
    const boundingBox = new THREE.Box3().setFromObject(modelGroup);
    const center = boundingBox.getCenter(new THREE.Vector3());
    const size = boundingBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const distance = maxDim * 1.5;

    if (activeCamera === perspectiveCamera) {
        switch (view) {
            case 'front':
                activeCamera.position.set(center.x, center.y, center.z + distance);
                break;
            case 'top':
                activeCamera.position.set(center.x, center.y + distance, center.z);
                break;
            case 'back':
                activeCamera.position.set(center.x, center.y, center.z - distance);
                break;
            case 'isometric':
                activeCamera.position.set(center.x + distance, center.y + distance, center.z + distance);
                break;
        }
    } else {
        const frustumSize = maxDim * 1.5;
        activeCamera.left = -frustumSize / 2;
        activeCamera.right = frustumSize / 2;
        activeCamera.top = frustumSize / 2;
        activeCamera.bottom = -frustumSize / 2;
        switch (view) {
            case 'front':
                activeCamera.position.set(center.x, center.y, center.z + distance);
                break;
            case 'top':
                activeCamera.position.set(center.x, center.y + distance, center.z);
                break;
            case 'back':
                activeCamera.position.set(center.x, center.y, center.z - distance);
                break;
            case 'isometric':
                activeCamera.position.set(center.x + distance, center.y + distance, center.z + distance);
                break;
        }
        activeCamera.updateProjectionMatrix();
    }
    activeCamera.lookAt(center);
    controls.target.copy(center);
    controls.update();
}

// Function to toggle camera mode
function toggleCameraMode() {
    activeCamera = document.getElementById('orthographicToggle').checked ? orthographicCamera : perspectiveCamera;
    controls.object = activeCamera;
    partManager.setCamera(activeCamera);
    if (modelGroup) {
        fitCameraToObject(modelGroup);
    }
}

// Function to toggle settings visibility
function toggleSettings() {
    const settingsOverlay = document.getElementById('settingsOverlay');
    settingsOverlay.style.display = settingsOverlay.style.display === 'none' ? 'block' : 'none';
}

// Function to load settings
function loadSettings() {
    const savedMaterialColor = localStorage.getItem('materialColor') || '#1a1a1a';
    const savedRoughness = parseFloat(localStorage.getItem('roughness') || 0.2);
    const savedLightIntensity = parseFloat(localStorage.getItem('lightIntensity') || 1.0);
    const savedShadowQuality = parseInt(localStorage.getItem('shadowQuality') || 2048);
    const savedUpAxis = localStorage.getItem('upAxis') || 'Y';
    const savedApplyScope = localStorage.getItem('applyScope') || 'global';
    const savedOrthographic = localStorage.getItem('orthographic') === 'true';

    hdpeMaterial.color.set(savedMaterialColor);
    hdpeMaterial.roughness = savedRoughness;
    directionalLight.intensity = savedLightIntensity;
    directionalLight.shadow.mapSize.width = savedShadowQuality;
    directionalLight.shadow.mapSize.height = savedShadowQuality;
    upAxis = savedUpAxis;
    applyScope = savedApplyScope;
    activeCamera = savedOrthographic ? orthographicCamera : perspectiveCamera;
    controls.object = activeCamera;
    partManager.setCamera(activeCamera);

    document.getElementById('materialColor').value = savedMaterialColor;
    document.getElementById('glossiness').value = savedRoughness;
    document.getElementById('lightIntensity').value = savedLightIntensity;
    document.getElementById('shadowQuality').value = savedShadowQuality;
    document.getElementById('upAxis').value = savedUpAxis;
    document.getElementById('applyScope').value = savedApplyScope;
    document.getElementById('orthographicToggle').checked = savedOrthographic;

    if (modelGroup) {
        applyUpAxis(upAxis);
        fitCameraToObject(modelGroup);
    }
}

// Function to save settings
function saveSettings() {
    if (applyScope === 'global') {
        localStorage.setItem('materialColor', hdpeMaterial.color.getHexString());
        localStorage.setItem('roughness', hdpeMaterial.roughness);
        localStorage.setItem('lightIntensity', directionalLight.intensity);
        localStorage.setItem('shadowQuality', directionalLight.shadow.mapSize.width);
        localStorage.setItem('upAxis', upAxis);
        localStorage.setItem('applyScope', applyScope);
        localStorage.setItem('orthographic', activeCamera === orthographicCamera);
    }
}

// Function to reset settings
function resetSettings() {
    localStorage.clear();
    hdpeMaterial.color.set('#1a1a1a');
    hdpeMaterial.roughness = 0.2;
    directionalLight.intensity = 1.0;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    upAxis = 'Y';
    applyScope = 'global';
    activeCamera = perspectiveCamera;
    controls.object = activeCamera;
    partManager.setCamera(activeCamera);

    document.getElementById('materialColor').value = '#1a1a1a';
    document.getElementById('glossiness').value = 0.2;
    document.getElementById('lightIntensity').value = 1.0;
    document.getElementById('shadowQuality').value = 2048;
    document.getElementById('upAxis').value = 'Y';
    document.getElementById('applyScope').value = 'global';
    document.getElementById('orthographicToggle').checked = false;

    if (modelGroup) {
        applyUpAxis(upAxis);
        fitCameraToObject(modelGroup);
    }
    partManager.getAllParts().forEach(part => {
        const mesh = part.mesh;
        if (mesh && !isGhostMode) {
            mesh.material = hdpeMaterial;
        }
    });
}

// Load OBJ model
console.log("Attempting to load PipeAssembly.obj...");
document.getElementById('status').textContent = "Laster modell...";

fetch('PipeAssembly.obj')
    .then(response => {
        console.log("Fetch response received:", response);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
    })
    .then(objContent => {
        console.log("OBJ content fetched, length:", objContent.length);
        const parts = partAnalyzer.analyzeOBJ(objContent);
        console.log("Parts analyzed:", parts.length);
        
        const loader = new THREE.OBJLoader();
        loader.load(
            'PipeAssembly.obj',
            (object) => {
                console.log("✅ Model loaded successfully!", object);
                document.getElementById('status').textContent = "Modell lastet! Klikk på deler for å interagere.";
                
                object.traverse(child => {
                    if (child.isMesh) {
                        console.log("Processing mesh:", child.name || "Unnamed");
                        child.castShadow = true;
                        child.receiveShadow = true;
                        child.material = hdpeMaterial;
                        child.userData.originalMaterial = hdpeMaterial;
                        
                        const partData = parts.find(p => p.name === child.name || p.name === child.parent.name) || {
                            name: child.name || `Part_${partManager.parts.size + 1}`,
                            partNumber: `P-${(partManager.parts.size + 1).toString().padStart(3, '0')}`,
                            type: 'Component',
                            vertices: [],
                            faces: [],
                            center: { x: 0, y: 0, z: 0 },
                            size: { x: 1, y: 1, z: 1 }
                        };
                        child.userData.partId = partData.partNumber;
                        partManager.addPart(partData, child);
                    }
                });
                
                modelGroup = object;
                modelGroup.position.set(0, 0, 0); // Fix to world origin
                sceneGroup.add(modelGroup);
                applyUpAxis(upAxis);
                fitCameraToObject(modelGroup);
                
                // Load video sequences after all parts are loaded
                partManager.loadVideoSequences();
                
                function animate() {
                    requestAnimationFrame(animate);
                    controls.update();
                    // Update part manager to maintain sectioning isolation
                    partManager.update();
                    // Update video panel position to follow camera
                    partManager.updateVideoPanelPosition();
                    // Render axis gizmo in bottom-right corner
                    const viewport = renderer.getViewport(new THREE.Vector4());
                    renderer.setViewport(window.innerWidth - 160, 10, 150, 150);
                    renderer.render(scene, axisCamera);
                    renderer.setViewport(viewport);
                    renderer.render(scene, activeCamera);
                }
                animate();
            },
            (xhr) => {
                const percent = Math.round((xhr.loaded / xhr.total) * 100);
                document.getElementById('status').textContent = `Laster modell... ${percent}%`;
                console.log(`Loading progress: ${percent}%`);
            },
            (error) => {
                console.error("❌ Error loading model:", error);
                document.getElementById('status').textContent = `Feil: ${error.message}`;
                document.getElementById('status').style.color = "red";
            }
        );
    })
    .catch(error => {
        console.error("❌ Error fetching OBJ file:", error);
        document.getElementById('status').textContent = `Feil: Kunne ikke hente modell - ${error.message}`;
        document.getElementById('status').style.color = "red";
    });

// Handle window resize
window.addEventListener('resize', () => {
    const aspect = window.innerWidth / window.innerHeight;
    perspectiveCamera.aspect = aspect;
    perspectiveCamera.updateProjectionMatrix();
    orthographicCamera.left = -10 * aspect;
    orthographicCamera.right = 10 * aspect;
    orthographicCamera.top = 10;
    orthographicCamera.bottom = -10;
    orthographicCamera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Handle isolate and show all buttons
document.getElementById('isolatePart').addEventListener('click', () => {
    const selectedPart = partManager.getSelectedPart();
    if (selectedPart) {
        partManager.isolatePart(selectedPart.partNumber);
        fitCameraToObject(selectedPart.mesh);
    }
});

document.getElementById('showAllPartsBtn').addEventListener('click', () => {
    partManager.showAllParts();
    if (modelGroup) {
        fitCameraToObject(modelGroup);
    }
});

// Sectioning Controls (integrated with part info overlay)

// Section position slider
document.getElementById('sectionPosition').addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    document.getElementById('sectionPositionValue').textContent = value.toFixed(2);
    
    // Update section plane position if it exists
    const selectedPart = partManager.getSelectedPart();
    if (selectedPart && partManager.hasSectionPlane(selectedPart.partNumber)) {
        partManager.updateSectionPlane(selectedPart.partNumber, value);
    }
});

// Create section
document.getElementById('createSection').addEventListener('click', () => {
    const selectedPart = partManager.getSelectedPart();
    if (selectedPart) {
        const planeType = document.getElementById('sectionPlaneType').value;
        const position = parseFloat(document.getElementById('sectionPosition').value);
        
        partManager.createSectionPlane(selectedPart.partNumber, planeType, position);
        console.log(`Created ${planeType} section plane for part ${selectedPart.partNumber}`);
    } else {
        alert('Please select a part first');
    }
});

// Remove section
document.getElementById('removeSection').addEventListener('click', () => {
    const selectedPart = partManager.getSelectedPart();
    if (selectedPart) {
        partManager.removeSectionPlane(selectedPart.partNumber);
        console.log(`Removed section plane for part ${selectedPart.partNumber}`);
    } else {
        alert('Please select a part first');
    }
});

// Reset section view
document.getElementById('resetSection').addEventListener('click', () => {
    const selectedPart = partManager.getSelectedPart();
    if (selectedPart) {
        partManager.removeSectionPlane(selectedPart.partNumber);
        document.getElementById('sectionPosition').value = 0;
        document.getElementById('sectionPositionValue').textContent = '0.00';
        console.log('Reset section view');
    }
});

// Handle ghost mode toggle
document.getElementById('toggleGhostMode').addEventListener('click', toggleGhostMode);

// Handle settings gear button
document.getElementById('settingsGear').addEventListener('click', toggleSettings);

// Handle up-axis change
document.getElementById('upAxis').addEventListener('change', (event) => {
    upAxis = event.target.value;
    saveSettings();
    if (modelGroup) {
        applyUpAxis(upAxis);
        fitCameraToObject(modelGroup);
    }
});

// Handle material color change
document.getElementById('materialColor').addEventListener('input', (event) => {
    hdpeMaterial.color.set(event.target.value);
    partManager.updateHighlight2Material(hdpeMaterial); // Update highlight2Material
    saveSettings();
    partManager.getAllParts().forEach(part => {
        const mesh = part.mesh;
        if (mesh && !isGhostMode) {
            mesh.material = hdpeMaterial;
        }
    });
});

// Handle glossiness change
document.getElementById('glossiness').addEventListener('input', (event) => {
    hdpeMaterial.roughness = parseFloat(event.target.value);
    partManager.updateHighlight2Material(hdpeMaterial); // Update highlight2Material
    saveSettings();
    partManager.getAllParts().forEach(part => {
        const mesh = part.mesh;
        if (mesh && !isGhostMode) {
            mesh.material = hdpeMaterial;
        }
    });
});

// Handle light intensity change
document.getElementById('lightIntensity').addEventListener('input', (event) => {
    directionalLight.intensity = parseFloat(event.target.value);
    saveSettings();
});

// Handle shadow quality change
document.getElementById('shadowQuality').addEventListener('change', (event) => {
    const size = parseInt(event.target.value);
    directionalLight.shadow.mapSize.width = size;
    directionalLight.shadow.mapSize.height = size;
    renderer.shadowMap.needsUpdate = true;
    saveSettings();
});

// Handle orthographic toggle
document.getElementById('orthographicToggle').addEventListener('change', toggleCameraMode);

// Handle apply scope change
document.getElementById('applyScope').addEventListener('change', (event) => {
    applyScope = event.target.value;
    saveSettings();
});

// Handle reset settings
document.getElementById('resetSettings').addEventListener('click', resetSettings);

// Handle camera view buttons
document.getElementById('frontView').addEventListener('click', () => setCameraView('front'));
document.getElementById('topView').addEventListener('click', () => setCameraView('top'));
document.getElementById('backView').addEventListener('click', () => setCameraView('back'));
document.getElementById('isometricView').addEventListener('click', () => setCameraView('isometric'));

// Handle cutting plane visibility toggle
document.getElementById('showCuttingPlane').addEventListener('change', (event) => {
    partManager.toggleCuttingPlaneVisibility(event.target.checked);
});

// Handle video controls - now handled by part-manager.js
// The event listener is dynamically added/removed by the part manager

document.getElementById('stopVideo').addEventListener('click', () => {
    partManager.stopVideo();
});

// Handle video overlay controls
document.getElementById('videoPlayPause').addEventListener('click', () => {
    partManager.toggleVideoPlayPause();
});

document.getElementById('videoClose').addEventListener('click', () => {
    partManager.stopVideo();
});

// Handle keyboard shortcuts
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        partManager.stopVideo();
    }
});

// Mobile and touch-specific functionality
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let isTablet = /iPad|Android/i.test(navigator.userAgent) && window.innerWidth >= 768;

// Touch gesture handling
let touchStartDistance = 0;
let touchStartZoom = 0;
let lastTouchTime = 0;
let touchCount = 0;

// Add touch event listeners for mobile gestures
function addMobileTouchHandlers() {
    const canvas = renderer.domElement;
    let doubleTapTimer = null;
    
    // Only prevent default for specific gestures, let OrbitControls handle normal touch
    canvas.addEventListener('touchstart', (e) => {
        touchCount = e.touches.length;
        
        // Double tap to reset view (only for single touch)
        if (e.touches.length === 1) {
            const currentTime = Date.now();
            if (currentTime - lastTouchTime < 300) {
                // Clear any existing timer
                if (doubleTapTimer) {
                    clearTimeout(doubleTapTimer);
                }
                
                // Double tap detected
                if (modelGroup) {
                    fitCameraToObject(modelGroup);
                }
                lastTouchTime = 0; // Reset to prevent triple tap
            } else {
                lastTouchTime = currentTime;
            }
        }
        
        // Pinch to zoom gesture - let OrbitControls handle this
        if (e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            touchStartDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            touchStartZoom = controls.object.position.length();
        }
    });
    
    // Let OrbitControls handle touchmove - don't interfere
    canvas.addEventListener('touchmove', (e) => {
        // Only handle custom pinch zoom if we started it
        if (e.touches.length === 2 && touchStartDistance > 0) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const currentDistance = Math.sqrt(
                Math.pow(touch2.clientX - touch1.clientX, 2) +
                Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            
            const zoomFactor = currentDistance / touchStartDistance;
            const newZoom = touchStartZoom * zoomFactor;
            const direction = controls.object.position.clone().normalize();
            controls.object.position.copy(direction.multiplyScalar(newZoom));
            controls.update();
        }
    });
    
    canvas.addEventListener('touchend', (e) => {
        touchCount = e.touches.length;
        // Reset pinch zoom tracking
        if (e.touches.length < 2) {
            touchStartDistance = 0;
            touchStartZoom = 0;
        }
    });
}

// Mobile-specific UI adjustments
function adjustUIForMobile() {
    if (isMobile) {
        // Hide some UI elements on very small screens
        if (window.innerWidth < 480) {
            const stats = document.getElementById('stats');
            if (stats) stats.style.display = 'none';
        }
        
        // Adjust button sizes for touch
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
            if (button.id !== 'videoClose' && button.id !== 'videoPlayPause') {
                button.style.minHeight = '44px';
                button.style.minWidth = '44px';
            }
        });
        
        // Make part list more touch-friendly
        const partItems = document.querySelectorAll('.part-item');
        partItems.forEach(item => {
            item.style.minHeight = '44px';
            item.style.padding = '12px';
        });
    }
}

// Handle orientation change
function handleOrientationChange() {
    setTimeout(() => {
        const aspect = window.innerWidth / window.innerHeight;
        perspectiveCamera.aspect = aspect;
        perspectiveCamera.updateProjectionMatrix();
        orthographicCamera.left = -10 * aspect;
        orthographicCamera.right = 10 * aspect;
        orthographicCamera.top = 10;
        orthographicCamera.bottom = -10;
        orthographicCamera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        
        if (modelGroup) {
            fitCameraToObject(modelGroup);
        }
        
        adjustUIForMobile();
    }, 100);
}

// Add mobile-specific event listeners
if (isMobile) {
    addMobileTouchHandlers();
    adjustUIForMobile();
    
    // Handle orientation changes
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);
    
    // Prevent zoom on double tap
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
}

// Add haptic feedback for supported devices
function hapticFeedback() {
    if ('vibrate' in navigator) {
        navigator.vibrate(50); // Short vibration
    }
}

// Enhanced mobile click handling - simplified to avoid conflicts
function addMobileClickHandlers() {
    const canvas = renderer.domElement;
    let touchStartTime = 0;
    let touchStartX = 0;
    let touchStartY = 0;
    
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            touchStartTime = Date.now();
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }
    });
    
    canvas.addEventListener('touchend', (e) => {
        if (e.touches.length === 0 && e.changedTouches.length === 1) {
            const touchDuration = Date.now() - touchStartTime;
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const touchDistance = Math.sqrt(
                Math.pow(touchEndX - touchStartX, 2) + 
                Math.pow(touchEndY - touchStartY, 2)
            );
            
            // Only trigger click if it's a very short tap with minimal movement
            // This prevents interference with camera controls
            if (touchDuration < 150 && touchDistance < 5) {
                // Convert touch coordinates to mouse coordinates
                const rect = canvas.getBoundingClientRect();
                const mouseEvent = new MouseEvent('click', {
                    clientX: touchEndX,
                    clientY: touchEndY,
                    bubbles: true
                });
                
                // Dispatch the click event
                canvas.dispatchEvent(mouseEvent);
                hapticFeedback();
            }
        }
    });
}

if (isMobile) {
    addMobileClickHandlers();
}

// Load initial settings
loadSettings();