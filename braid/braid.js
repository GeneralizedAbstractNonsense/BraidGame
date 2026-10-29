import * as THREE from 'three';

/**
 * Gestore della Treccia 3D (Braid Group Representation)
 */
export class BraidManager {
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

        // Parola algebrica della treccia: lista di generatori { id, index, type }
        // index: 0..numStrands-2 (es. 0 per sigma_1, 1 per sigma_2, 2 per sigma_3)
        // type: 1 = sigma_i (passa sopra), -1 = inv(sigma_i) (passa sotto)
        this.word = [];
        this.nextId = 1;

        // Gruppo Three.js per contenere le geometrie
        this.braidGroup = new THREE.Group();
        this.scene.add(this.braidGroup);

        this.crossingClickables = [];
        this.onWordChangeCallback = options.onWordChange || null;
    }

    /**
     * Imposta la sequenza della treccia generata dal lancio delle carte.
     * @param {Array<{index: number, type: number}>} wordSequence 
     * @param {boolean} autoNormalize 
     */
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

    /**
     * Aggiunge un singolo incrocio (generatore) alla treccia.
     * @param {number} index - Indice dell'incrocio (0, 1 o 2 per 4 fili)
     * @param {number} type - 1 per sigma_i, -1 per inv(sigma_i)
     */
    addGenerator(index, type = 1, autoNormalize = true) {
        if (index < 0 || index >= this.numStrands - 1) return;
        this.word.push({ id: this.nextId++, index, type: type >= 0 ? 1 : -1 });
        
        if (autoNormalize) {
            this.normalize();
        }
        this.render();
    }

    /**
     * NORMALIZZAZIONE: Elimina coppie adiacenti inverse sigma_i * inv(sigma_i) o inv(sigma_i) * sigma_i.
     */
    normalize() {
        let changed = true;
        while (changed) {
            changed = false;
            for (let i = 0; i < this.word.length - 1; i++) {
                const g1 = this.word[i];
                const g2 = this.word[i + 1];

                // Stesso filo/incrocio ma segno opposto -> si annullano (reidemeister move 1/2)
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

    /**
     * Inverte la struttura dell'incrocio selezionato ("sopra" <-> "sotto")
     * e ri-normalizza automaticamente la treccia.
     * @param {number} stepIndex - Indice del livello nella sequenza word.
     */
    flipCrossing(stepIndex) {
        if (stepIndex >= 0 && stepIndex < this.word.length) {
            this.word[stepIndex].type *= -1; // Inverte sigma_i <-> inv(sigma_i)
            this.normalize();
            this.render();
        }
    }

    /**
     * Calcola i punti 3D nello spazio per ciascun filo della treccia.
     */
    computeStrandPoints() {
        const steps = this.word.length;
        const pointsPerStrand = Array.from({ length: this.numStrands }, () => []);

        // Traccia quale filo si trova in quale colonna orizzontale
        let currentStrandAtColumn = Array.from({ length: this.numStrands }, (_, k) => k);

        // Centratura verticale della treccia
        const startY = (steps * this.stepHeight) / 2;

        // Punti iniziali in alto
        for (let col = 0; col < this.numStrands; col++) {
            const strandId = currentStrandAtColumn[col];
            const x = (col - (this.numStrands - 1) / 2) * this.strandSpacing;
            pointsPerStrand[strandId].push(new THREE.Vector3(x, startY, 0));
        }

        // Calcolo traiettorie passo per passo
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

            // Offset Z per il passaggio sopra (+Z) o sotto (-Z)
            const zOffsetLeft = type * this.overOffset;
            const zOffsetRight = -type * this.overOffset;

            // Curva per il filo di sinistra che si sposta a destra
            pointsPerStrand[strandLeft].push(
                new THREE.Vector3(THREE.MathUtils.lerp(leftX, midX, 0.5), THREE.MathUtils.lerp(topY, midY, 0.5), zOffsetLeft * 0.7),
                new THREE.Vector3(midX, midY, zOffsetLeft),
                new THREE.Vector3(THREE.MathUtils.lerp(midX, rightX, 0.5), THREE.MathUtils.lerp(midY, bottomY, 0.5), zOffsetLeft * 0.7),
                new THREE.Vector3(rightX, bottomY, 0)
            );

            // Curva per il filo di destra che si sposta a sinistra
            pointsPerStrand[strandRight].push(
                new THREE.Vector3(THREE.MathUtils.lerp(rightX, midX, 0.5), THREE.MathUtils.lerp(topY, midY, 0.5), zOffsetRight * 0.7),
                new THREE.Vector3(midX, midY, zOffsetRight),
                new THREE.Vector3(THREE.MathUtils.lerp(midX, leftX, 0.5), THREE.MathUtils.lerp(midY, bottomY, 0.5), zOffsetRight * 0.7),
                new THREE.Vector3(leftX, bottomY, 0)
            );

            // Fili non coinvolti nell'incrocio scendono dritti
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

            // Aggiorna la mappa delle posizioni per il prossimo livello
            currentStrandAtColumn[leftCol] = strandRight;
            currentStrandAtColumn[rightCol] = strandLeft;
        }

        return pointsPerStrand;
    }

    /**
     * Rigenera le mesh 3D della treccia e gli hot-spot interattivi.
     */
    render() {
        // Pulisce la geometria precedente
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

        // 1. Costruzione dei tubi 3D per i fili
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

        // 2. Creazione degli hotspot cliccabili per ciascun incrocio
        const steps = this.word.length;
        const startY = (steps * this.stepHeight) / 2;

        for (let step = 0; step < steps; step++) {
            const { index, type } = this.word[step];
            const midY = startY - step * this.stepHeight - this.stepHeight / 2;
            const leftX = (index - (this.numStrands - 1) / 2) * this.strandSpacing;
            const rightX = (index + 1 - (this.numStrands - 1) / 2) * this.strandSpacing;
            const midX = (leftX + rightX) / 2;

            // Sfera invisibile per raycasting ed eventuale anello indicatore
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

    /**
     * Abilita l'interazione con il mouse/touch per invertire gli incroci "sopra/sotto".
     * @param {THREE.Camera} camera 
     * @param {HTMLElement} domElement 
     */
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
