/**
 * Gestore della Treccia 3D (Braid Group Representation)
 * Utilizza la libreria globale THREE.js
 */
class BraidManager {
    /**
     * @param {THREE.Scene} scene - La scena Three.js dove aggiungere la treccia.
     * @param {Object} options - Configurazione di rendering e struttura.
     */
    constructor(scene, options = {}) {
        this.scene = scene;
        this.numStrands = options.numStrands || 4;       // Numero di fili (default 4)
        this.strandSpacing = options.strandSpacing || 2.0; // Distanza orizzontale tra fili
        this.stepHeight = options.stepHeight || 3.0;    // Altezza di ciascun incrocio
        this.tubeRadius = options.tubeRadius || 0.25;   // Spessore del filo
        this.overOffset = options.overOffset || 0.8;    // Scostamento Z per sopra/sotto

        // Palette colori per i fili della treccia
        this.strandColors = options.colors || [
            0xff595e, // Filo 1 - Rosso
            0xffca3a, // Filo 2 - Giallo
            0x8ac926, // Filo 3 - Verde
            0x1982c4  // Filo 4 - Blu
        ];

        this.word = [];
        this.nextId = 1;

        this.braidGroup = new THREE.Group();
        this.scene.add(this.braidGroup);

        this.crossingClickables = [];
        this.onWordChangeCallback = options.onWordChange || null;
    }

    setWord(wordSequence, autoNormalize = true) {
        this.word = wordSequence.map(g => ({
            id: this.nextId++,
            index: g.index,
            type: g.type >= 0 ? 1 : -1
        }));

        if (autoNormalize) {
            this.normalize();
        }
        this.render();
    }

    addGenerator(index, type = 1, autoNormalize = true) {
        if (index < 0 || index >= this.numStrands - 1) return;
        this.word.push({ id: this.nextId++, index, type: type >= 0 ? 1 : -1 });
        
        if (autoNormalize) {
            this.normalize();
        }
        this.render();
    }

    normalize() {
        let changed = true;
        while (changed) {
            changed = false;
            for (let i = 0; i < this.word.length - 1; i++) {
                const g1 = this.word[i];
                const g2 = this.word[i + 1];

                if (g1.index === g2.index && g1.type === -g2.type) {
                    this.word.splice(i, 2);
                    changed = true;
                    break;
                }
            }
        }

        if (this.onWordChangeCallback) {
            this.onWordChangeCallback([...this.word]);
        }
    }

    flipCrossing(stepIndex) {
        if (stepIndex >= 0 && stepIndex < this.word.length) {
            this.word[stepIndex].type *= -1;
            this.normalize();
            this.render();
        }
    }

    computeStrandPoints() {
        const steps = this.word.length;
        const pointsPerStrand = Array.from({ length: this.numStrands }, () => []);
        let currentStrandAtColumn = Array.from({ length: this.numStrands }, (_, k) => k);

        const startY = (steps * this.stepHeight) / 2;

        for (let col = 0; col < this.numStrands; col++) {
            const strandId = currentStrandAtColumn[col];
            const x = (col - (this.numStrands - 1) / 2) * this.strandSpacing;
            pointsPerStrand[strandId].push(new THREE.Vector3(x, startY, 0));
        }

        for (let step = 0; step < steps; step++) {
            const { index, type } = this.word[step];
            const topY = startY - step * this.stepHeight;
            const midY = topY - this.stepHeight / 2;
            const bottomY = topY - this.stepHeight;

            const leftCol = index;
            const rightCol = index + 1;

            const strandLeft = currentStrandAtColumn[leftCol];
            const strandRight = currentStrandAtColumn[rightCol];

            const leftX = (leftCol - (this.numStrands - 1) / 2) * this.strandSpacing;
            const rightX = (rightCol - (this.numStrands - 1) / 2) * this.strandSpacing;
            const midX = (leftX + rightX) / 2;

            const zOffsetLeft = type * this.overOffset;
            const zOffsetRight = -type * this.overOffset;

            pointsPerStrand[strandLeft].push(
                new THREE.Vector3(THREE.MathUtils.lerp(leftX, midX, 0.5), THREE.MathUtils.lerp(topY, midY, 0.5), zOffsetLeft * 0.7),
                new THREE.Vector3(midX, midY, zOffsetLeft),
                new THREE.Vector3(THREE.MathUtils.lerp(midX, rightX, 0.5), THREE.MathUtils.lerp(midY, bottomY, 0.5), zOffsetLeft * 0.7),
                new THREE.Vector3(rightX, bottomY, 0)
            );

            pointsPerStrand[strandRight].push(
                new THREE.Vector3(THREE.MathUtils.lerp(rightX, midX, 0.5), THREE.MathUtils.lerp(topY, midY, 0.5), zOffsetRight * 0.7),
                new THREE.Vector3(midX, midY, zOffsetRight),
                new THREE.Vector3(THREE.MathUtils.lerp(midX, leftX, 0.5), THREE.MathUtils.lerp(midY, bottomY, 0.5), zOffsetLeft * 0.7),
                new THREE.Vector3(leftX, bottomY, 0)
            );

            for (let col = 0; col < this.numStrands; col++) {
                if (col !== leftCol && col !== rightCol) {
                    const strandStraight = currentStrandAtColumn[col];
                    const xStraight = (col - (this.numStrands - 1) / 2) * this.strandSpacing;
                    pointsPerStrand[strandStraight].push(
                        new THREE.Vector3(xStraight, midY, 0),
                        new THREE.Vector3(xStraight, bottomY, 0)
                    );
                }
            }

            currentStrandAtColumn[leftCol] = strandRight;
            currentStrandAtColumn[rightCol] = strandLeft;
        }

        return pointsPerStrand;
    }

    render() {
        while (this.braidGroup.children.length > 0) {
            const child = this.braidGroup.children.pop();
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        }
        this.crossingClickables = [];

        const pointsPerStrand = this.computeStrandPoints();

        pointsPerStrand.forEach((pts, strandIdx) => {
            if (pts.length < 2) return;

            const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.2);
            const geometry = new THREE.TubeGeometry(curve, pts.length * 10, this.tubeRadius, 16, false);

            const material = new THREE.MeshStandardMaterial({
                color: this.strandColors[strandIdx % this.strandColors.length],
                roughness: 0.35,
                metalness: 0.25
            });

            const tubeMesh = new THREE.Mesh(geometry, material);
            this.braidGroup.add(tubeMesh);
        });

        const steps = this.word.length;
        const startY = (steps * this.stepHeight) / 2;

        for (let step = 0; step < steps; step++) {
            const { index, type } = this.word[step];
            const midY = startY - step * this.stepHeight - this.stepHeight / 2;
            const leftX = (index - (this.numStrands - 1) / 2) * this.strandSpacing;
            const rightX = (index + 1 - (this.numStrands - 1) / 2) * this.strandSpacing;
            const midX = (leftX + rightX) / 2;

            const hitGeo = new THREE.SphereGeometry(this.strandSpacing * 0.55, 16, 16);
            const hitMat = new THREE.MeshBasicMaterial({
                transparent: true,
                opacity: 0,
                depthWrite: false
            });

            const hitMesh = new THREE.Mesh(hitGeo, hitMat);
            hitMesh.position.set(midX, midY, 0);
            hitMesh.userData = { stepIndex: step, crossingIndex: index, type };

            this.braidGroup.add(hitMesh);
            this.crossingClickables.push(hitMesh);
        }
    }

    setupInteractivity(camera, domElement) {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        domElement.addEventListener('pointerdown', (event) => {
            const rect = domElement.getBoundingClientRect();
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(this.crossingClickables);

            if (intersects.length > 0) {
                const stepIndex = intersects[0].object.userData.stepIndex;
                this.flipCrossing(stepIndex);
            }
        });
    }
}

// Esponi globalmente
window.BraidManager = BraidManager;
