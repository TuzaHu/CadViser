/**
 * Part Analyzer - Utility to analyze OBJ files and identify individual parts
 * This class handles the complex task of parsing OBJ files and identifying
 * separate parts within a multi-part assembly
 */

class PartAnalyzer {
    constructor() {
        this.parts = [];
        this.materials = new Map();
        this.currentPart = null;
        this.currentMaterial = null;
    }

    /**
     * Analyze an OBJ file and extract individual parts
     * @param {string} objContent - The raw OBJ file content
     * @returns {Array} Array of part objects with geometry and metadata
     */
    analyzeOBJ(objContent) {
        if (!objContent || typeof objContent !== 'string') {
            console.error('❌ Invalid OBJ content');
            return [];
        }

        console.log('🔍 Starting OBJ analysis...');
        
        this.parts = [];
        this.materials = new Map();
        this.currentPart = null;
        this.currentMaterial = null;

        const lines = objContent.split('\n');
        let lineNumber = 0;

        for (const line of lines) {
            lineNumber++;
            const trimmedLine = line.trim();
            
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                continue;
            }

            const parts = trimmedLine.split(/\s+/);
            const command = parts[0];

            try {
                switch (command) {
                    case 'o': // Object name
                        this.handleObjectName(parts.slice(1).join(' '));
                        break;
                    case 'g': // Group name (treat as object for parts)
                        this.handleGroupName(parts.slice(1).join(' '));
                        break;
                    case 'usemtl': // Material usage
                        this.handleMaterialUsage(parts[1]);
                        break;
                    case 'v': // Vertex
                        this.handleVertex(parts.slice(1), lineNumber);
                        break;
                    case 'vn': // Normal
                        this.handleNormal(parts.slice(1), lineNumber);
                        break;
                    case 'vt': // Texture coordinate
                        this.handleTextureCoord(parts.slice(1), lineNumber);
                        break;
                    case 'f': // Face
                        this.handleFace(parts.slice(1), lineNumber);
                        break;
                    case 'mtllib': // Material library
                        this.handleMaterialLibrary(parts[1]);
                        break;
                }
            } catch (error) {
                console.warn(`⚠️ Error processing line ${lineNumber}: ${error.message}`);
            }
        }

        // Finalize the last part
        if (this.currentPart) {
            this.finalizePart();
        }

        console.log(`✅ Analysis complete! Found ${this.parts.length} parts`);
        return this.parts;
    }

    /**
     * Handle object name declaration
     */
    handleObjectName(name) {
        // Finalize previous part if exists
        if (this.currentPart) {
            this.finalizePart();
        }

        // Start new part
        this.currentPart = {
            name: name || `Part_${this.parts.length + 1}`,
            vertices: [],
            normals: [],
            textureCoords: [],
            faces: [],
            material: null,
            boundingBox: null,
            center: null,
            partNumber: this.generatePartNumber(),
            type: this.detectPartType(name)
        };
    }

    /**
     * Handle group name declaration
     */
    handleGroupName(name) {
        // Groups can define separate parts, so treat them like objects
        if (!this.currentPart) {
            this.handleObjectName(name);
        } else if (name && name !== this.currentPart.name) {
            // This is a new group/part, finalize the previous one
            this.finalizePart();
            this.handleObjectName(name);
        }
    }

    /**
     * Handle material usage
     */
    handleMaterialUsage(materialName) {
        if (this.currentPart) {
            this.currentPart.material = materialName || 'default';
        }
    }

    /**
     * Handle vertex data
     */
    handleVertex(coords, lineNumber) {
        if (this.currentPart && coords.length >= 3) {
            const [x, y, z] = coords.map(coord => {
                const value = parseFloat(coord);
                if (isNaN(value)) {
                    throw new Error(`Invalid vertex coordinate at line ${lineNumber}`);
                }
                return value;
            });
            this.currentPart.vertices.push({ x, y, z });
        }
    }

    /**
     * Handle normal data
     */
    handleNormal(coords, lineNumber) {
        if (this.currentPart && coords.length >= 3) {
            const [x, y, z] = coords.map(coord => {
                const value = parseFloat(coord);
                if (isNaN(value)) {
                    throw new Error(`Invalid normal coordinate at line ${lineNumber}`);
                }
                return value;
            });
            this.currentPart.normals.push({ x, y, z });
        }
    }

    /**
     * Handle texture coordinate data
     */
    handleTextureCoord(coords, lineNumber) {
        if (this.currentPart && coords.length >= 2) {
            const [u, v] = coords.map(coord => {
                const value = parseFloat(coord);
                if (isNaN(value)) {
                    throw new Error(`Invalid texture coordinate at line ${lineNumber}`);
                }
                return value;
            });
            this.currentPart.textureCoords.push({ u, v });
        }
    }

    /**
     * Handle face data
     */
    handleFace(faceData, lineNumber) {
        if (this.currentPart && faceData.length >= 3) {
            const face = faceData.map(vertexData => {
                const indices = vertexData.split('/');
                const vertexIndex = parseInt(indices[0]);
                if (isNaN(vertexIndex) || vertexIndex < 1) {
                    throw new Error(`Invalid face vertex index at line ${lineNumber}`);
                }
                return {
                    vertexIndex: vertexIndex - 1, // OBJ is 1-indexed
                    textureIndex: indices[1] ? parseInt(indices[1]) - 1 : -1,
                    normalIndex: indices[2] ? parseInt(indices[2]) - 1 : -1
                };
            });
            this.currentPart.faces.push(face);
        }
    }

    /**
     * Handle material library reference
     */
    handleMaterialLibrary(libName) {
        console.log(`📚 Material library: ${libName}`);
        // Note: Add material loading logic if needed
    }

    /**
     * Finalize the current part and add it to the parts array
     */
    finalizePart() {
        if (!this.currentPart || this.currentPart.vertices.length === 0) {
            return;
        }

        // Calculate bounding box and center
        this.calculateBoundingBox(this.currentPart);
        
        // Validate part
        if (this.validatePart(this.currentPart)) {
            this.parts.push(this.currentPart);
            console.log(`✅ Part added: ${this.currentPart.name} (${this.currentPart.vertices.length} vertices, ${this.currentPart.faces.length} faces)`);
        } else {
            console.warn(`⚠️ Part rejected: ${this.currentPart.name} (invalid geometry)`);
        }

        this.currentPart = null;
    }

    /**
     * Calculate bounding box and center for a part
     */
    calculateBoundingBox(part) {
        if (part.vertices.length === 0) return;

        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        for (const vertex of part.vertices) {
            minX = Math.min(minX, vertex.x);
            minY = Math.min(minY, vertex.y);
            minZ = Math.min(minZ, vertex.z);
            maxX = Math.max(maxX, vertex.x);
            maxY = Math.max(maxY, vertex.y);
            maxZ = Math.max(maxZ, vertex.z);
        }

        part.boundingBox = {
            min: { x: minX, y: minY, z: minZ },
            max: { x: maxX, y: maxY, z: maxZ }
        };

        part.center = {
            x: (minX + maxX) / 2,
            y: (minY + maxY) / 2,
            z: (minZ + maxZ) / 2
        };

        part.size = {
            x: maxX - minX,
            y: maxY - minY,
            z: maxZ - minZ
        };
    }

    /**
     * Validate a part to ensure it has valid geometry
     */
    validatePart(part) {
        return part.vertices.length > 0 && 
               part.faces.length > 0 && 
               part.boundingBox &&
               part.size.x > 0 && 
               part.size.y > 0 && 
               part.size.z > 0;
    }

    /**
     * Generate a part number based on part characteristics
     */
    generatePartNumber() {
        const partCount = this.parts.length + 1;
        return `P-${partCount.toString().padStart(3, '0')}`;
    }

    /**
     * Detect part type based on name and geometry
     */
    detectPartType(name) {
        if (!name) return 'Unknown';
        
        const lowerName = name.toLowerCase();
        
        if (lowerName.includes('pipe') || lowerName.includes('tube')) return 'Pipe';
        if (lowerName.includes('flange')) return 'Flange';
        if (lowerName.includes('elbow') || lowerName.includes('bend')) return 'Elbow';
        if (lowerName.includes('tee') || lowerName.includes('t-joint')) return 'Tee';
        if (lowerName.includes('valve')) return 'Valve';
        if (lowerName.includes('fitting')) return 'Fitting';
        if (lowerName.includes('support') || lowerName.includes('bracket')) return 'Support';
        if (lowerName.includes('gasket') || lowerName.includes('seal')) return 'Gasket';
        if (lowerName.includes('bolt') || lowerName.includes('screw')) return 'Fastener';
        if (lowerName.includes('nut')) return 'Nut';
        
        return 'Component';
    }

    /**
     * Get part statistics
     */
    getStatistics() {
        const stats = {
            totalParts: this.parts.length,
            totalVertices: 0,
            totalFaces: 0,
            partTypes: {},
            sizeRange: { min: Infinity, max: 0 }
        };

        for (const part of this.parts) {
            stats.totalVertices += part.vertices.length;
            stats.totalFaces += part.faces.length;
            
            stats.partTypes[part.type] = (stats.partTypes[part.type] || 0) + 1;
            
            const partSize = Math.max(part.size.x, part.size.y, part.size.z);
            stats.sizeRange.min = Math.min(stats.sizeRange.min, partSize);
            stats.sizeRange.max = Math.max(stats.sizeRange.max, partSize);
        }

        return stats;
    }

    /**
     * Find parts by type
     */
    findPartsByType(type) {
        return this.parts.filter(part => part.type === type);
    }

    /**
     * Find parts by name pattern
     */
    findPartsByName(pattern) {
        const regex = new RegExp(pattern, 'i');
        return this.parts.filter(part => regex.test(part.name));
    }

    /**
     * Get the largest part (by volume)
     */
    getLargestPart() {
        if (this.parts.length === 0) return null;
        
        return this.parts.reduce((largest, current) => {
            const currentVolume = current.size.x * current.size.y * current.size.z;
            const largestVolume = largest.size.x * largest.size.y * largest.size.z;
            return currentVolume > largestVolume ? current : largest;
        });
    }

    /**
     * Get the smallest part (by volume)
     */
    getSmallestPart() {
        if (this.parts.length === 0) return null;
        
        return this.parts.reduce((smallest, current) => {
            const currentVolume = current.size.x * current.size.y * current.size.z;
            const smallestVolume = smallest.size.x * smallest.size.y * smallest.size.z;
            return currentVolume < smallestVolume ? current : smallest;
        });
    }
}