/**
 * Part Manager - Handles part isolation, highlighting, and interaction
 * This class manages the visual state and interactions of individual parts
 * within the 3D assembly viewer
 */

class PartManager {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        this.parts = new Map();
        this.partMeshes = new Map();
        this.partLabels = new Map();
        this.selectedPart = null;
        this.visibleParts = new Set();
        this.highlightedParts = new Set();
        this.sectionPlanes = new Map();
        this.sectionHelpers = new Map();
        this.crossSections = new Map();
        this.sectionedPartId = null; // Track which part is being sectioned
        this.showCuttingPlane = true; // Track cutting plane visibility
        this.videoSequences = new Map(); // Store video sequences for parts
        this.currentVideo = null; // Current playing video
        this.videoPanel = null; // 3D video panel in scene
        
        this.originalMaterials = new Map();
        this.highlightMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            transparent: true, 
            opacity: 0.7 
        });
        // highlight2Material will be created dynamically to reference hdpeMaterial
        this.highlight2Material = null;
        this.hdpeMaterial = null; // Store reference to hdpeMaterial
        this.hiddenMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x333333, 
            transparent: true, 
            opacity: 0.1 
        });
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.handleClick = this.handleClick.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.setupEventListeners();
        
        // Initialize video controls to disabled state
        this.initializeVideoControls();
    }

    /**
     * Add a part to the manager
     */
    addPart(partData, mesh) {
        const partId = partData.partNumber;
        
        this.parts.set(partId, {
            ...partData,
            mesh: mesh,
            originalVisible: true,
            isSelected: false,
            isHighlighted: false,
            isHidden: false
        });
        
        this.partMeshes.set(partId, mesh);
        this.visibleParts.add(partId);
        
        if (mesh.material) {
            this.originalMaterials.set(partId, mesh.material.clone());
        }
        
        this.createPartLabel(partId, partData);
        
        console.log(`✅ Part added to manager: ${partId} (${partData.name})`);
    }

    /**
     * Create a floating part number label
     */
    createPartLabel(partId, partData) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 64;
        
        context.fillStyle = 'rgba(52, 152, 219, 0.9)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.strokeStyle = 'white';
        context.lineWidth = 2;
        context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
        
        context.fillStyle = 'white';
        context.font = 'bold 14px Arial';
        context.textAlign = 'center';
        context.fillText(partData.partNumber, canvas.width / 2, 25);
        
        context.font = '10px Arial';
        const truncatedName = partData.name.length > 12 ? 
            partData.name.substring(0, 12) + '...' : partData.name;
        context.fillText(truncatedName, canvas.width / 2, 45);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            alphaTest: 0.1
        });
        
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(0.5, 0.25, 1); // Smaller scale for better visibility
        
        if (partData && partData.center) {
            sprite.position.set(
                partData.center.x,
                partData.center.y + (partData.size?.y || 1) / 2 + 0.5,
                partData.center.z
            );
        }
        
        sprite.userData = { partId: partId, type: 'label' };
        this.scene.add(sprite);
        
        this.partLabels.set(partId, sprite);
    }

    /**
     * Setup event listeners for part interaction
     */
    setupEventListeners() {
        this.renderer.domElement.addEventListener('click', this.handleClick);
        this.renderer.domElement.addEventListener('mousemove', this.handleMouseMove);
    }

    /**
     * Initialize video controls to disabled state
     */
    initializeVideoControls() {
        const playButton = document.getElementById('playVideo');
        if (playButton) {
            this.forceDisableButton(playButton);
            console.log(`🎬 Initialized video controls in disabled state`);
        }
    }

    /**
     * Force disable a button completely
     */
    forceDisableButton(button) {
        button.disabled = true;
        button.style.opacity = '0.3';
        button.style.cursor = 'not-allowed';
        button.style.backgroundColor = '#333333';
        button.style.pointerEvents = 'none';
        button.style.color = '#888888';
        button.style.userSelect = 'none';
        button.textContent = 'Ingen video tilgjengelig';
        button.title = 'Ingen video tilgjengelig for denne delen';
        
        // Remove any existing event listeners by cloning the element
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // Re-add the event listener to the new button
        newButton.addEventListener('click', (event) => {
            if (event.target.disabled) {
                console.log(`🎬 Button click ignored - button is disabled`);
                event.preventDefault();
                event.stopPropagation();
                return false;
            }
            
            const selectedPart = partManager.getSelectedPart();
            if (selectedPart) {
                partManager.playVideo(selectedPart.partNumber);
            }
        });
        
        console.log(`🎬 Button force disabled and event listener re-added`);
    }

    /**
     * Handle mouse click events
     */
    handleClick(event) {
        // If in sectioning mode, do absolutely nothing - don't process any clicks
        if (this.isInSectioningMode()) {
            console.log(`🔒 In sectioning mode - ignoring all clicks`);
            return;
        }
        
        const part = this.getClickedPart(event);
        
        if (part) {
            console.log(`🖱️ Clicked on part: ${part.partId}`);
            this.selectPart(part.partId);
        } else {
            console.log(`🖱️ Clicked outside - deselecting all parts`);
            this.deselectAllParts();
        }
    }

    /**
     * Handle mouse move events for hover effects
     */
    handleMouseMove(event) {
        const part = this.getClickedPart(event);
        this.renderer.domElement.style.cursor = part ? 'pointer' : 'default';
    }

    /**
     * Check if we're currently in sectioning mode
     */
    isInSectioningMode() {
        return this.sectionedPartId !== null;
    }
    
    /**
     * Ensure sectioning isolation is maintained
     */
    maintainSectioningIsolation() {
        if (this.isInSectioningMode()) {
            console.log(`🔒 Maintaining sectioning isolation for part: ${this.sectionedPartId}`);
            // Hide all parts except the sectioned part
            for (const [id, mesh] of this.partMeshes) {
                if (id !== this.sectionedPartId) {
                    mesh.visible = false;
                    console.log(`   Hiding part: ${id}`);
                } else {
                    // Ensure the sectioned part remains visible
                    mesh.visible = true;
                    console.log(`   Keeping visible: ${id}`);
                }
            }
        } else {
            console.log(`🔓 Not in sectioning mode, sectionedPartId: ${this.sectionedPartId}`);
        }
    }
    
    /**
     * Force sectioning mode - this should never be lost
     */
    forceSectioningMode(partId) {
        this.sectionedPartId = partId;
        console.log(`🔧 FORCED sectioning mode for part: ${partId}`);
        this.maintainSectioningIsolation();
    }
    
    /**
     * Update method called every frame to maintain sectioning
     */
    update() {
        // Always maintain sectioning isolation if in sectioning mode
        this.maintainSectioningIsolation();
        
        // Debug: Log sectioning state every 60 frames (about once per second)
        if (Math.random() < 0.016) { // ~1/60 chance
            console.log(`🔄 Frame update - sectioning mode: ${this.isInSectioningMode()}, sectionedPartId: ${this.sectionedPartId}`);
        }
        
        // BULLETPROOF: If we have a sectioned part but sectioning mode is false, force it back
        if (this.sectionedPartId && !this.isInSectioningMode()) {
            console.log(`🚨 BULLETPROOF: Restoring sectioning mode for part: ${this.sectionedPartId}`);
            this.forceSectioningMode(this.sectionedPartId);
        }
    }
    
    /**
     * Get the part that was clicked
     */
    getClickedPart(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const partMeshes = Array.from(this.partMeshes.values());
        const intersects = this.raycaster.intersectObjects(partMeshes, true);
        
        if (intersects.length > 0) {
            const intersectedObject = intersects[0].object;
            for (const [partId, mesh] of this.partMeshes) {
                if (mesh === intersectedObject || (mesh.children && mesh.children.includes(intersectedObject))) {
                    return { partId, mesh, intersection: intersects[0] };
                }
            }
        }
        
        const labels = Array.from(this.partLabels.values());
        const labelIntersects = this.raycaster.intersectObjects(labels);
        
        if (labelIntersects.length > 0) {
            const label = labelIntersects[0].object;
            return { partId: label.userData.partId, mesh: null, intersection: labelIntersects[0] };
        }
        
        return null;
    }

    /**
     * Select a part
     */
    selectPart(partId) {
        if (this.selectedPart && this.selectedPart !== partId) {
            this.deselectPart(this.selectedPart);
        }
        
        this.selectedPart = partId;
        const part = this.parts.get(partId);
        
        if (part) {
            part.isSelected = true;
            this.highlightPart(partId);
            this.showPartInfo(part);
            this.updateUI();
            
            // Update video controls with a small delay to ensure video sequences are loaded
            setTimeout(() => {
                this.updateVideoControls(partId);
            }, 100);
            
            console.log(`🎯 Part selected: ${partId} (${part.name})`);
        }
        
        // Ensure sectioning isolation is maintained
        this.maintainSectioningIsolation();
    }

    /**
     * Deselect a part
     */
    deselectPart(partId) {
        const part = this.parts.get(partId);
        if (part) {
            part.isSelected = false;
            this.removeHighlight(partId);
            this.hidePartInfo();
        }
        
        // NEVER lose sectioning mode when deselecting
        // Sectioning mode is independent of part selection
        this.maintainSectioningIsolation();
    }

    /**
     * Deselect all parts
     */
    deselectAllParts() {
        if (this.selectedPart) {
            this.deselectPart(this.selectedPart);
            this.selectedPart = null;
            this.updateUI();
        }
        
        // NEVER lose sectioning mode when deselecting all parts
        // Sectioning mode is independent of part selection
        this.maintainSectioningIsolation();
    }

    /**
     * Highlight a part
     */
    highlightPart(partId) {
        const part = this.parts.get(partId);
        const mesh = this.partMeshes.get(partId);
        
        if (part && mesh && !part.isHighlighted) {
            part.isHighlighted = true;
            this.highlightedParts.add(partId);
            mesh.material = this.highlightMaterial;
            this.addGlowEffect(mesh);
        }
    }

    /**
     * Remove highlight from a part
     */
    removeHighlight(partId) {
        const part = this.parts.get(partId);
        const mesh = this.partMeshes.get(partId);
        
        if (part && mesh && part.isHighlighted) {
            part.isHighlighted = false;
            this.highlightedParts.delete(partId);
            const originalMaterial = this.originalMaterials.get(partId);
            if (originalMaterial) {
                mesh.material = originalMaterial;
            }
            this.removeGlowEffect(mesh);
        }
    }

    /**
     * Create highlight2Material dynamically based on hdpeMaterial
     */
    createHighlight2Material(hdpeMaterial) {
        this.hdpeMaterial = hdpeMaterial; // Store reference
        this.highlight2Material = new THREE.MeshStandardMaterial({
            color: hdpeMaterial.color.clone(),
            roughness: hdpeMaterial.roughness,
            metalness: hdpeMaterial.metalness,
            transparent: true,
            opacity: 1.0
        });
        console.log(`🔧 Created highlight2Material linked to hdpeMaterial`);
    }

    /**
     * Update highlight2Material when hdpeMaterial changes
     */
    updateHighlight2Material(hdpeMaterial) {
        this.hdpeMaterial = hdpeMaterial; // Update reference
        if (this.highlight2Material) {
            this.highlight2Material.color.copy(hdpeMaterial.color);
            this.highlight2Material.roughness = hdpeMaterial.roughness;
            this.highlight2Material.metalness = hdpeMaterial.metalness;
            this.highlight2Material.needsUpdate = true;
            console.log(`🔧 Updated highlight2Material to match hdpeMaterial`);
        }
    }

    /**
     * Switch to highlight2 for sectioning
     */
    switchToOrangeHighlight(partId) {
        const part = this.parts.get(partId);
        const mesh = this.partMeshes.get(partId);
        
        if (part && mesh && part.isHighlighted) {
            if (!this.highlight2Material) {
                console.log(`⚠️ highlight2Material not initialized, creating fallback`);
                // Create a fallback material with default properties
                this.highlight2Material = new THREE.MeshStandardMaterial({
                    color: 0x1a1a1a,
                    roughness: 0.2,
                    metalness: 0.0,
                    transparent: true,
                    opacity: 1.0
                });
            }
            mesh.material = this.highlight2Material;
            console.log(`🟠 Switched to highlight2 for part ${partId}`);
        }
    }

    /**
     * Switch back to green highlight
     */
    switchToGreenHighlight(partId) {
        const part = this.parts.get(partId);
        const mesh = this.partMeshes.get(partId);
        
        if (part && mesh && part.isHighlighted) {
            mesh.material = this.highlightMaterial;
            console.log(`🟢 Switched to GREEN highlight for part ${partId}`);
        }
    }

    /**
     * Toggle cutting plane visibility
     */
    toggleCuttingPlaneVisibility(show) {
        this.showCuttingPlane = show;
        
        if (this.cuttingPlaneVisuals) {
            for (const visualPlane of this.cuttingPlaneVisuals.values()) {
                visualPlane.visible = show;
            }
        }
        
        console.log(`🔧 Cutting plane visibility: ${show ? 'ON' : 'OFF'}`);
    }

    /**
     * Load video sequences from Resources folder
     */
    async loadVideoSequences() {
        // Scan Resources folder for MP4 files and match by exact part name
        await this.scanResourcesFolder();
        
        console.log(`🎬 Video loading complete. Total sequences: ${this.videoSequences.size}`);
    }

    /**
     * Scan Resources folder for MP4 videos
     */
    async scanResourcesFolder() {
        try {
            // Get list of all parts to check for corresponding videos
            const partNames = Array.from(this.parts.keys()).map(partId => {
                const part = this.parts.get(partId);
                return part ? part.name : null;
            }).filter(name => name);

            console.log(`🎬 Scanning Resources folder for videos for parts:`, partNames);

            // Check for videos by exact part name match
            for (const partName of partNames) {
                const videoPath = `Resources/${partName}.mp4`;
                try {
                    const response = await fetch(videoPath, { method: 'HEAD' });
                    if (response.ok) {
                        this.videoSequences.set(partName, videoPath);
                        console.log(`🎬 ✅ Found video for part: ${partName} -> ${videoPath}`);
                    } else {
                        console.log(`🎬 ❌ No video found for part: ${partName}`);
                    }
                } catch (error) {
                    console.log(`🎬 ❌ No video found for part: ${partName}`);
                }
            }

            console.log(`🎬 Video scanning complete. Total videos found: ${this.videoSequences.size}`);
            
            // Update video controls for currently selected part after scanning is complete
            if (this.selectedPart) {
                this.updateVideoControls(this.selectedPart);
            }
        } catch (error) {
            console.log(`Error scanning Resources folder:`, error);
        }
    }

    /**
     * Check if part has video sequence
     */
    async checkForVideo(partId) {
        const part = this.parts.get(partId);
        console.log(`🎬 Checking part:`, part ? part.name : 'null', 'for video');
        console.log(`🎬 Available video sequences:`, Array.from(this.videoSequences.keys()));
        
        if (part && this.videoSequences.has(part.name)) {
            console.log(`🎬 Found video for part: ${part.name}`);
            return this.videoSequences.get(part.name);
        } else {
            console.log(`🎬 No video found for part: ${part ? part.name : 'null'}`);
        }
        return null;
    }

    /**
     * Show/hide video controls based on part selection
     */
    updateVideoControls(partId) {
        const videoControls = document.getElementById('videoControls');
        const playButton = document.getElementById('playVideo');
        
        if (videoControls && playButton) {
            const part = this.parts.get(partId);
            const hasVideo = partId && part && this.videoSequences.has(part.name);
            
            console.log(`🎬 updateVideoControls: partId=${partId}, partName=${part?.name}, hasVideo=${hasVideo}`);
            console.log(`🎬 videoSequences keys:`, Array.from(this.videoSequences.keys()));
            console.log(`🎬 videoSequences size:`, this.videoSequences.size);
            
            // Always show video controls section
            videoControls.style.display = 'block';
            
            if (hasVideo) {
                // Enable play button - make it fully functional
                playButton.disabled = false;
                playButton.style.opacity = '1';
                playButton.style.cursor = 'pointer';
                playButton.style.backgroundColor = '#ff0000';
                playButton.style.pointerEvents = 'auto';
                playButton.style.color = 'white';
                playButton.textContent = 'Spill av video';
                playButton.title = 'Klikk for å spille av video';
                console.log(`🎬 ✅ ENABLING video controls for part: ${part.name}`);
            } else {
                // Completely disable play button - make it non-interactive
                this.forceDisableButton(playButton);
                console.log(`🎬 ❌ DISABLING video controls - no video available for: ${part?.name || 'unknown'}`);
            }
        } else {
            console.log(`🎬 videoControls or playButton element not found!`);
        }
    }

    /**
     * Play video for selected part
     */
    async playVideo(partId) {
        console.log(`🎬 playVideo called for partId: ${partId}`);
        
        // First check if the play button is disabled
        const playButton = document.getElementById('playVideo');
        if (playButton && playButton.disabled) {
            console.log(`🎬 ❌ Play button is disabled - ignoring click`);
            return;
        }

        const part = this.parts.get(partId);
        if (!part) {
            console.log(`🎬 No part found for ID: ${partId}`);
            return;
        }

        console.log(`🎬 Looking for video for part: ${part.name}`);
        console.log(`🎬 Video sequences map:`, this.videoSequences);
        console.log(`🎬 Available video keys:`, Array.from(this.videoSequences.keys()));
        
        const videoPath = this.videoSequences.get(part.name);
        if (!videoPath) {
            console.log(`🎬 ❌ No video available for part: ${part.name}`);
            console.log(`🎬 Available videos:`, Array.from(this.videoSequences.keys()));
            console.log(`🎬 Video sequences map:`, this.videoSequences);
            return;
        }
        
        console.log(`🎬 Found video path for part ${part.name}: ${videoPath}`);

        try {
            // Stop any current video
            this.stopVideo();

            console.log(`🎬 ✅ Playing video for part: ${part.name} -> ${videoPath}`);

            // Create video overlay
            this.createVideoOverlay(partId, videoPath);

        } catch (error) {
            console.error('Error playing video:', error);
            this.stopVideo();
        }
    }

    /**
     * Create video overlay for HTML5 video playback
     */
    createVideoOverlay(partId, videoPath) {
        // Get video overlay elements
        const videoOverlay = document.getElementById('videoOverlay');
        const videoContainer = document.getElementById('videoContainer');
        
        if (!videoOverlay || !videoContainer) {
            console.error('Video overlay elements not found');
            return;
        }

        // Clean up any existing video
        this.cleanupVideoOverlay();

        // Ensure video path has .mp4 extension
        let fullVideoPath = videoPath;
        if (!videoPath.endsWith('.mp4')) {
            fullVideoPath = videoPath + '.mp4';
        }

        console.log(`🎬 Creating video with path: ${fullVideoPath}`);
        console.log(`🎬 Original videoPath: ${videoPath}`);
        console.log(`🎬 Full video path: ${fullVideoPath}`);

        // Create video element
        const video = document.createElement('video');
        video.src = fullVideoPath;
        video.controls = true;
        video.autoplay = true;
        video.loop = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        video.preload = 'auto';
        video.crossOrigin = 'anonymous';

        // Add error handling
        video.addEventListener('error', (e) => {
            console.error('🎬 Video error:', e);
            console.error('🎬 Video src:', video.src);
            console.error('🎬 Video networkState:', video.networkState);
            console.error('🎬 Video readyState:', video.readyState);
            console.error('🎬 Video error details:', video.error);
        });

        video.addEventListener('loadstart', () => {
            console.log('🎬 Video load started:', video.src);
        });

        video.addEventListener('loadedmetadata', () => {
            console.log('🎬 Video metadata loaded:', video.src);
        });

        video.addEventListener('canplay', () => {
            console.log('🎬 Video can play:', video.src);
        });

        video.addEventListener('canplaythrough', () => {
            console.log('🎬 Video can play through:', video.src);
        });

        video.addEventListener('loadeddata', () => {
            console.log('🎬 Video data loaded:', video.src);
        });

        // Clear existing content and add video
        videoContainer.innerHTML = '';
        videoContainer.appendChild(video);

        // Add overlay controls
        const overlayControls = document.createElement('div');
        overlayControls.id = 'videoOverlayControls';
        overlayControls.innerHTML = `
            <button id="videoPlayPause">⏸️</button>
            <button id="videoClose">✕</button>
        `;
        videoContainer.appendChild(overlayControls);

        // Show overlay
        videoOverlay.style.display = 'block';

        // Debug: Log video element details
        console.log('🎬 Video element created:', video);
        console.log('🎬 Video src:', video.src);
        console.log('🎬 Video container:', videoContainer);
        console.log('🎬 Video overlay:', videoOverlay);
        console.log('🎬 Video overlay display:', videoOverlay.style.display);
        console.log('🎬 Video container children:', videoContainer.children.length);

        // Store current video reference
        this.currentVideo = {
            partId: partId,
            videoPath: fullVideoPath,
            videoElement: video,
            isPlaying: true
        };

        // Add event listeners with proper cleanup
        this.addVideoEventListeners();

        console.log(`🎬 Created video overlay for ${partId} with video: ${fullVideoPath}`);
    }

    /**
     * Add event listeners for video controls
     */
    addVideoEventListeners() {
        const playPauseBtn = document.getElementById('videoPlayPause');
        const closeBtn = document.getElementById('videoClose');
        
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                this.toggleVideoPlayPause();
            });
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.stopVideo();
            });
        }
    }

    /**
     * Clean up video overlay elements
     */
    cleanupVideoOverlay() {
        const videoContainer = document.getElementById('videoContainer');
        if (videoContainer) {
            // Remove all child elements
            videoContainer.innerHTML = '';
        }
        
        // Clean up any existing video element
        if (this.currentVideo && this.currentVideo.videoElement) {
            this.currentVideo.videoElement.pause();
            this.currentVideo.videoElement.src = '';
            this.currentVideo.videoElement.load();
        }
    }

    /**
     * Stop current video
     */
    stopVideo() {
        // Clean up video overlay
        this.cleanupVideoOverlay();

        // Hide video overlay
        const videoOverlay = document.getElementById('videoOverlay');
        if (videoOverlay) {
            videoOverlay.style.display = 'none';
        }

        // Clear current video reference
        this.currentVideo = null;
        console.log(`🎬 Video stopped and overlay hidden`);
    }

    /**
     * Toggle video play/pause
     */
    toggleVideoPlayPause() {
        if (!this.currentVideo || !this.currentVideo.videoElement) return;

        const video = this.currentVideo.videoElement;
        const playPauseBtn = document.getElementById('videoPlayPause');
        
        if (video.paused) {
            video.play();
            playPauseBtn.textContent = '⏸️';
            this.currentVideo.isPlaying = true;
            console.log(`🎬 Video resumed`);
        } else {
            video.pause();
            playPauseBtn.textContent = '▶️';
            this.currentVideo.isPlaying = false;
            console.log(`🎬 Video paused`);
        }
    }

    /**
     * Update video panel position to follow camera (no longer needed for HTML5 video)
     */
    updateVideoPanelPosition() {
        // No longer needed for HTML5 video overlay
        return;
    }

    /**
     * Add glow effect to a mesh
     */
    addGlowEffect(mesh) {
        if (!mesh.geometry) return;
        const glowGeometry = mesh.geometry.clone();
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.3,
            side: THREE.BackSide
        });
        
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        glowMesh.scale.multiplyScalar(0.0);
        glowMesh.userData = { type: 'glow', parentPart: mesh.userData.partId };
        
        mesh.add(glowMesh);
    }
    
    /**
     * Remove glow effect from part
     */
    removeGlowEffect(mesh) {
        if (!mesh.children) return;
        
        // Find and remove glow meshes
        for (let i = mesh.children.length - 1; i >= 0; i--) {
            const child = mesh.children[i];
            if (child.userData && child.userData.type === 'glow') {
                mesh.remove(child);
                child.geometry.dispose();
                child.material.dispose();
            }
        }
    }

    /**
     * Remove glow effect from a mesh
     */
    removeGlowEffect(mesh) {
        const glowMesh = mesh.children.find(child => child.userData.type === 'glow');
        if (glowMesh) {
            mesh.remove(glowMesh);
            glowMesh.geometry.dispose();
            glowMesh.material.dispose();
        }
    }

    /**
     * Isolate a part (hide all others)
     */
    isolatePart(partId) {
        console.log(`🔍 Isolating part: ${partId}`);
        
        this.preIsolationState = new Map();
        for (const [id, part] of this.parts) {
            this.preIsolationState.set(id, part.isHidden);
        }
        
        for (const [id, part] of this.parts) {
            if (id !== partId) {
                this.hidePart(id);
            } else {
                this.showPart(id);
            }
        }
        
        this.updatePartInfoOverlayForIsolation();
        this.updateUI();
    }

    /**
     * Update part info overlay for isolation mode
     */
    updatePartInfoOverlayForIsolation() {
        const isolateBtn = document.getElementById('isolatePart');
        const showAllBtn = document.getElementById('showAllPartsBtn');
        
        if (isolateBtn && showAllBtn) {
            isolateBtn.style.display = 'none';
            showAllBtn.style.display = 'block';
        }
    }

    /**
     * Show all parts
     */
    showAllParts() {
        console.log('👁️ Showing all parts');
        
        if (this.preIsolationState) {
            for (const [partId, wasHidden] of this.preIsolationState) {
                if (wasHidden) {
                    this.hidePart(partId);
                } else {
                    this.showPart(partId);
                }
            }
        } else {
            for (const [partId] of this.parts) {
                this.showPart(partId);
            }
        }
        
        const isolateBtn = document.getElementById('isolatePart');
        const showAllBtn = document.getElementById('showAllPartsBtn');
        
        if (isolateBtn && showAllBtn) {
            isolateBtn.style.display = 'block';
            showAllBtn.style.display = 'none';
        }
        
        this.updateUI();
    }

    /**
     * Hide a specific part
     */
    hidePart(partId) {
        const part = this.parts.get(partId);
        const mesh = this.partMeshes.get(partId);
        const label = this.partLabels.get(partId);
        
        if (part && mesh) {
            part.isHidden = true;
            mesh.visible = false;
            this.visibleParts.delete(partId);
            
            if (label) {
                label.visible = false;
            }
        }
    }

    /**
     * Show a specific part
     */
    showPart(partId) {
        const part = this.parts.get(partId);
        const mesh = this.partMeshes.get(partId);
        const label = this.partLabels.get(partId);
        
        if (part && mesh) {
            part.isHidden = false;
            mesh.visible = true;
            this.visibleParts.add(partId);
            
            if (label) {
                label.visible = true;
            }
        }
    }

    /**
     * Toggle part visibility
     */
    togglePartVisibility(partId) {
        const part = this.parts.get(partId);
        if (part) {
            if (part.isHidden) {
                this.showPart(partId);
            } else {
                this.hidePart(partId);
            }
        }
    }

    /**
     * Show part information overlay
     */
    showPartInfo(part) {
        const overlay = document.getElementById('partInfoOverlay');
        const partName = document.getElementById('partName');
        const partNumber = document.getElementById('partNumber');
        const partDescription = document.getElementById('partDescription');
        
        if (overlay && partName && partNumber && partDescription) {
            partName.textContent = part.name || 'Unnamed Part';
            partNumber.textContent = `Part #: ${part.partNumber}`;
            partDescription.textContent = `${part.type} - ${part.vertices.length} vertices, ${part.faces.length} faces`;
            
            overlay.classList.add('visible');
        }
    }

    /**
     * Hide part information overlay
     */
    hidePartInfo() {
        const overlay = document.getElementById('partInfoOverlay');
        if (overlay) {
            overlay.classList.remove('visible');
        }
    }

    /**
     * Update UI elements
     */
    updateUI() {
        const totalParts = document.getElementById('totalParts');
        const selectedPart = document.getElementById('selectedPart');
        const visibleParts = document.getElementById('visibleParts');
        
        if (totalParts) {
            totalParts.textContent = this.parts.size;
        }
        
        if (selectedPart) {
            selectedPart.textContent = this.selectedPart || 'None';
        }
        
        if (visibleParts) {
            visibleParts.textContent = this.visibleParts.size;
        }
        
        this.updatePartsList();
    }

    /**
     * Update the parts list in the UI
     */
    updatePartsList() {
        const partsList = document.getElementById('partsList');
        if (!partsList) return;
        
        partsList.innerHTML = '';
        
        for (const [partId, part] of this.parts) {
            const partItem = document.createElement('div');
            partItem.className = 'part-item';
            
            if (part.isSelected) {
                partItem.classList.add('selected');
            }
            
            if (part.isHidden) {
                partItem.classList.add('hidden');
            }
            
            partItem.innerHTML = `
                <div class="part-name">${part.name}</div>
                <div class="part-number">${part.partNumber}</div>
            `;
            
            partItem.addEventListener('click', () => {
                this.selectPart(partId);
            });
            
            partsList.appendChild(partItem);
        }
    }

    /**
     * Get all parts
     */
    getAllParts() {
        return Array.from(this.parts.values());
    }

    /**
     * Get visible parts
     */
    getVisibleParts() {
        return Array.from(this.parts.values()).filter(part => !part.isHidden);
    }

    /**
     * Get selected part
     */
    getSelectedPart() {
        return this.selectedPart ? this.parts.get(this.selectedPart) : null;
    }

    /**
     * Find parts by type
     */
    findPartsByType(type) {
        return Array.from(this.parts.values()).filter(part => part.type === type);
    }

    /**
     * Search parts by name
     */
    searchParts(query) {
        const regex = new RegExp(query, 'i');
        return Array.from(this.parts.values()).filter(part => 
            regex.test(part.name) || regex.test(part.partNumber)
        );
    }

    /**
     * Toggle part number labels visibility
     */
    togglePartLabels(visible) {
        for (const label of this.partLabels.values()) {
            label.visible = visible;
        }
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.renderer.domElement.removeEventListener('click', this.handleClick);
        this.renderer.domElement.removeEventListener('mousemove', this.handleMouseMove);
        
        for (const material of this.originalMaterials.values()) {
            material.dispose();
        }
        
        this.highlightMaterial.dispose();
        this.highlight2Material.dispose();
        this.hiddenMaterial.dispose();
        
        // Clean up visual planes
        if (this.cuttingPlaneVisuals) {
            for (const visualPlane of this.cuttingPlaneVisuals.values()) {
                this.scene.remove(visualPlane);
                visualPlane.geometry.dispose();
                visualPlane.material.dispose();
            }
            this.cuttingPlaneVisuals.clear();
        }
        
        this.parts.clear();
        this.partMeshes.clear();
        this.partLabels.clear();
        this.originalMaterials.clear();
        this.visibleParts.clear();
        this.highlightedParts.clear();
    }
    /**
     * Create a section plane for the selected part
     */
    createSectionPlane(partId, planeType = 'XY', position = 0) {
        const part = this.parts.get(partId);
        const mesh = this.partMeshes.get(partId);
        
        if (!part || !mesh) return null;
        
        // Remove existing section plane for this part
        this.removeSectionPlane(partId);
        
        // Hide all other parts during sectioning (only show the selected part)
        for (const [id, otherMesh] of this.partMeshes) {
            if (id !== partId) {
                otherMesh.visible = false;
            }
        }
        
        // Force sectioning mode - this should never be lost
        this.forceSectioningMode(partId);
        
        // Get part bounding box to size the plane appropriately
        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());
        
        // Create invisible section plane for positioning calculations only
        const sectionPlane = new THREE.Object3D();
        sectionPlane.userData = { type: 'sectionPlane', partId: partId, planeType: planeType };
        
        // Position the plane based on type
        this.positionSectionPlane(sectionPlane, planeType, position, mesh);
        
        // Store the section plane (invisible, no visual clutter)
        this.sectionPlanes.set(partId, sectionPlane);
        
        // Switch to orange highlight for sectioning
        this.switchToOrangeHighlight(partId);
        
        // Add clipping plane to the material AFTER switching to orange
        this.addClippingPlane(mesh, sectionPlane);
        
        return sectionPlane;
    }
    
    /**
     * Position section plane based on type and position relative to part's local origin
     */
    positionSectionPlane(plane, planeType, position, mesh) {
        // Get the part's local bounding box
        const box = new THREE.Box3().setFromObject(mesh);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Reset plane position to part's local origin
        plane.position.set(0, 0, 0);
        
        // Calculate the offset based on the position slider (-1 to 1)
        // This moves the plane from one edge to the other of the part
        let offset;
        let axis;
        
        switch (planeType) {
            case 'XY':
                // XY plane cuts along Z axis (horizontal plane)
                plane.rotation.set(0, 0, 0);
                axis = 'z';
                offset = position * (size.z / 2);
                plane.position.set(center.x, center.y, center.z + offset);
                break;
            case 'XZ':
                // XZ plane cuts along Y axis (frontal plane)
                plane.rotation.set(-Math.PI / 2, 0, 0);
                axis = 'y';
                offset = position * (size.y / 2);
                plane.position.set(center.x, center.y + offset, center.z);
                break;
            case 'YZ':
                // YZ plane cuts along X axis (side plane)
                plane.rotation.set(0, Math.PI / 2, 0);
                axis = 'x';
                offset = position * (size.x / 2);
                plane.position.set(center.x + offset, center.y, center.z);
                break;
        }
        
        console.log(`🔧 Positioned ${planeType} plane at offset ${offset} along ${axis} axis`);
    }
    
    /**
     * Add clipping plane to mesh material
     */
    addClippingPlane(mesh, sectionPlane) {
        if (!mesh.material.clippingPlanes) {
            mesh.material.clippingPlanes = [];
        }
        
        const clippingPlane = new THREE.Plane();
        const normal = new THREE.Vector3();
        sectionPlane.getWorldQuaternion(new THREE.Quaternion()).multiplyVector3(normal.set(0, 0, 1));
        const point = sectionPlane.getWorldPosition(new THREE.Vector3());
        clippingPlane.setFromNormalAndCoplanarPoint(normal, point);
        
        mesh.material.clippingPlanes.push(clippingPlane);
        mesh.material.clipIntersection = false; // Show the part that's NOT clipped
        mesh.material.needsUpdate = true;
        
        // Enable local clipping on the renderer
        this.renderer.localClippingEnabled = true;
        
        // Create a cross-section material for the cut surface only
        this.createCrossSectionMaterial(mesh, sectionPlane);
        
        // Create visual helper for the cutting plane
        this.createCuttingPlaneVisualization(sectionPlane, mesh);
    }
    
    /**
     * Create visual representation of the cutting plane
     */
    createCuttingPlaneVisualization(sectionPlane, mesh) {
        // Get part bounding box to size the plane appropriately
        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Create a semi-transparent plane to show the cutting position
        // Size the plane based on the part dimensions
        let planeWidth, planeHeight;
        const planeType = sectionPlane.userData.planeType;
        
        switch (planeType) {
            case 'XY':
                planeWidth = size.x * 1.5;
                planeHeight = size.y * 1.5;
                break;
            case 'XZ':
                planeWidth = size.x * 1.5;
                planeHeight = size.z * 1.5;
                break;
            case 'YZ':
                planeWidth = size.y * 1.5;
                planeHeight = size.z * 1.5;
                break;
        }
        
        const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
        
        const planeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00, // Bright green
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            wireframe: false
        });
        
        const visualPlane = new THREE.Mesh(planeGeometry, planeMaterial);
        visualPlane.position.copy(sectionPlane.position);
        visualPlane.rotation.copy(sectionPlane.rotation);
        visualPlane.visible = this.showCuttingPlane; // Respect visibility setting
        
        // Add a border to make it more visible
        const borderGeometry = new THREE.EdgesGeometry(planeGeometry);
        const borderMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 2
        });
        const border = new THREE.LineSegments(borderGeometry, borderMaterial);
        visualPlane.add(border);
        
        // Store for cleanup
        visualPlane.userData = { 
            type: 'cuttingPlaneVisualization', 
            partId: mesh.userData.partId 
        };
        
        this.scene.add(visualPlane);
        
        // Store reference for updates and cleanup
        if (!this.cuttingPlaneVisuals) {
            this.cuttingPlaneVisuals = new Map();
        }
        this.cuttingPlaneVisuals.set(mesh.userData.partId, visualPlane);
        
        console.log(`🔧 Created cutting plane visualization for part ${mesh.userData.partId}`);
    }

    /**
     * Create cross-section material to show internal structure
     */
    createCrossSectionMaterial(mesh, sectionPlane) {
        // Create a duplicate mesh with cross-section material
        const crossSectionGeometry = mesh.geometry.clone();
        const crossSectionMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00, // Yellow color for cut surface
            transparent: false,
            opacity: 1.0,
            side: THREE.DoubleSide,
            emissive: 0x000000, // No glow for solid appearance
            emissiveIntensity: 0.0
        });
        
        const crossSectionMesh = new THREE.Mesh(crossSectionGeometry, crossSectionMaterial);
        crossSectionMesh.position.copy(mesh.position);
        crossSectionMesh.rotation.copy(mesh.rotation);
        crossSectionMesh.scale.copy(mesh.scale);
        
        // Apply the same clipping plane but with intersection (shows only the cut surface)
        const clippingPlane = new THREE.Plane();
        const normal = new THREE.Vector3();
        sectionPlane.getWorldQuaternion(new THREE.Quaternion()).multiplyVector3(normal.set(0, 0, 1));
        const point = sectionPlane.getWorldPosition(new THREE.Vector3());
        clippingPlane.setFromNormalAndCoplanarPoint(normal, point);
        
        crossSectionMaterial.clippingPlanes = [clippingPlane];
        crossSectionMaterial.clipIntersection = true; // Show only the cut surface (interface)
        crossSectionMaterial.needsUpdate = true;
        
        // Store reference for cleanup
        crossSectionMesh.userData = { 
            type: 'crossSection', 
            partId: mesh.userData.partId,
            originalMesh: mesh 
        };
        
        this.scene.add(crossSectionMesh);
        
        // Store for cleanup
        if (!this.crossSections) {
            this.crossSections = new Map();
        }
        this.crossSections.set(mesh.userData.partId, crossSectionMesh);
    }
    
    /**
     * Create visual helper for section plane
     */
    createSectionHelper(partId, sectionPlane) {
        const helperGeometry = new THREE.PlaneGeometry(0.5, 0.5);
        const helperMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        
        const helper = new THREE.Mesh(helperGeometry, helperMaterial);
        helper.userData = { type: 'sectionHelper', partId: partId };
        
        // Position helper at the edge of the section plane
        helper.position.copy(sectionPlane.position);
        helper.rotation.copy(sectionPlane.rotation);
        helper.position.add(new THREE.Vector3(0, 0, 0.1));
        
        this.sectionHelpers.set(partId, helper);
        this.scene.add(helper);
    }
    
    /**
     * Remove section plane for a part
     */
    removeSectionPlane(partId) {
        const sectionPlane = this.sectionPlanes.get(partId);
        const crossSection = this.crossSections.get(partId);
        
        if (sectionPlane) {
            // Remove clipping plane from material
            const mesh = this.partMeshes.get(partId);
            if (mesh && mesh.material.clippingPlanes) {
                mesh.material.clippingPlanes = [];
                mesh.material.needsUpdate = true;
            }
            
            // Section plane is invisible, just dispose if it has geometry
            if (sectionPlane.geometry) {
                sectionPlane.geometry.dispose();
            }
            if (sectionPlane.material) {
                sectionPlane.material.dispose();
            }
            this.sectionPlanes.delete(partId);
        }
        
        if (crossSection) {
            this.scene.remove(crossSection);
            crossSection.geometry.dispose();
            crossSection.material.dispose();
            this.crossSections.delete(partId);
        }
        
        // Remove visual plane
        const visualPlane = this.cuttingPlaneVisuals?.get(partId);
        if (visualPlane) {
            this.scene.remove(visualPlane);
            visualPlane.geometry.dispose();
            visualPlane.material.dispose();
            this.cuttingPlaneVisuals.delete(partId);
        }
        
        // Restore visibility of all parts when sectioning is removed
        for (const [id, otherMesh] of this.partMeshes) {
            otherMesh.visible = true;
        }
        
        // Clear sectioned part ID
        this.sectionedPartId = null;
        console.log(`🗑️ Removed section plane for part: ${partId}, sectionedPartId: ${this.sectionedPartId}`);
        
        // Switch back to green highlight if part is selected
        if (this.selectedPart === partId) {
            this.switchToGreenHighlight(partId);
        }
    }
    
    /**
     * Update section plane position
     */
    updateSectionPlane(partId, position) {
        const sectionPlane = this.sectionPlanes.get(partId);
        const mesh = this.partMeshes.get(partId);
        const crossSection = this.crossSections.get(partId);
        const visualPlane = this.cuttingPlaneVisuals?.get(partId);
        
        if (sectionPlane && mesh) {
            console.log(`🔧 Updating section plane for part ${partId} to position ${position}`);
            const planeType = sectionPlane.userData.planeType;
            this.positionSectionPlane(sectionPlane, planeType, position, mesh);
            
            // Update visual plane position
            if (visualPlane) {
                visualPlane.position.copy(sectionPlane.position);
                visualPlane.rotation.copy(sectionPlane.rotation);
            }
            
            // Update clipping plane for main mesh
            if (mesh.material.clippingPlanes && mesh.material.clippingPlanes.length > 0) {
                const clippingPlane = mesh.material.clippingPlanes[0];
                const normal = new THREE.Vector3();
                sectionPlane.getWorldQuaternion(new THREE.Quaternion()).multiplyVector3(normal.set(0, 0, 1));
                const point = sectionPlane.getWorldPosition(new THREE.Vector3());
                clippingPlane.setFromNormalAndCoplanarPoint(normal, point);
            }
            
            // Update cross-section clipping plane
            if (crossSection && crossSection.material.clippingPlanes && crossSection.material.clippingPlanes.length > 0) {
                const clippingPlane = crossSection.material.clippingPlanes[0];
                const normal = new THREE.Vector3();
                sectionPlane.getWorldQuaternion(new THREE.Quaternion()).multiplyVector3(normal.set(0, 0, 1));
                const point = sectionPlane.getWorldPosition(new THREE.Vector3());
                clippingPlane.setFromNormalAndCoplanarPoint(normal, point);
            }
        }
    }
    
    /**
     * Get section plane for a part
     */
    getSectionPlane(partId) {
        return this.sectionPlanes.get(partId);
    }
    
    /**
     * Check if part has section plane
     */
    hasSectionPlane(partId) {
        return this.sectionPlanes.has(partId);
    }

    /**
     * Set the camera for raycasting
     */
    setCamera(camera) {
        this.camera = camera;
    }
}
 