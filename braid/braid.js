    const STRAND_COLORS = [0x008b00, 0x1600ff, 0xfdff00, 0xff0000];
    const STRAND_POSITIONS_X = [-2.25, -0.75, 0.75, 2.25];
    const STEP_HEIGHT = 2.25; 
    const EXTENSION_LENGTH = 100;
    const DISC_Y_TOP = 4.5;

    let braidWord = [];
    let insertPosition = 'bottom';
    let animatedProgress = 1.0;
    let isAnimating = false;
    

    let scrollOffset = 0;
    let targetScrollOffset = 0;

    const canvasContainer = document.getElementById('braid-canvas-container');
    const sectionContainer = document.getElementById('section-4');
    const braidScene = new THREE.Scene();

    const braidCamera = new THREE.PerspectiveCamera(45, canvasContainer.clientWidth / canvasContainer.clientHeight, 0.1, 2000);
    braidCamera.position.set(0, 0, 14);
    braidCamera.lookAt(0, 0, 0);

    const braidRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    braidRenderer.setSize(canvasContainer.clientWidth, canvasContainer.clientHeight);
    braidRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    canvasContainer.appendChild(braidRenderer.domElement);

    braidScene.add(new THREE.AmbientLight(0xffffff, 1.2));

    const strandMeshes = [];
    for (let i = 0; i < 4; i++) {
      const strandMat = new THREE.MeshStandardMaterial({
        color: STRAND_COLORS[i],
        roughness: 0.25,
        metalness: 0.1
      });
      const strandMesh = new THREE.Mesh(new THREE.BufferGeometry(), strandMat);
      braidScene.add(strandMesh);
      strandMeshes.push(strandMesh);
    }

    // Calcola lo scorrimento massimo considerando l'altezza dei comandi inferiori
    function getMaxScroll() {
      const numSteps = braidWord.length;
      // Il margine (-2.2) permette di visualizzare l'ultima mossa sopra il pannello dei controlli
      return numSteps >= 3 ? (numSteps - 2.2) * STEP_HEIGHT : 0;
    }

    function updateCameraScroll() {
      const maxScroll = getMaxScroll();
      targetScrollOffset = Math.max(0, Math.min(maxScroll, targetScrollOffset));
      
      braidCamera.position.y = -scrollOffset;
      braidCamera.lookAt(0, -scrollOffset, 0);

      const scrollHint = document.getElementById('scroll-hint');
      if (scrollHint) {
        scrollHint.style.display = maxScroll > 0 ? 'block' : 'none';
      }
    }

  
    function autoFocusLastMove() {
      if (insertPosition === 'top') {
        targetScrollOffset = 0;
      } else {
        targetScrollOffset = getMaxScroll();
      }
    }

    function computeStrandCurves(word, tAnim = 1.0) {
      const numSteps = word.length;
      const strandPaths = [[], [], [], []];
      let currentPermutation = [0, 1, 2, 3];

      const topY = DISC_Y_TOP;
      const topExtensionY = topY + EXTENSION_LENGTH;

      for (let s = 0; s < 4; s++) {
        strandPaths[s].push(new THREE.Vector3(STRAND_POSITIONS_X[s], topExtensionY, 0));
        strandPaths[s].push(new THREE.Vector3(STRAND_POSITIONS_X[s], topY, 0));
      }

      if (numSteps === 0) {
        const bottomY = topY - 4 * STEP_HEIGHT;
        const bottomExtensionY = bottomY - EXTENSION_LENGTH;
        for (let s = 0; s < 4; s++) {
          strandPaths[s].push(new THREE.Vector3(STRAND_POSITIONS_X[s], bottomY, 0));
          strandPaths[s].push(new THREE.Vector3(STRAND_POSITIONS_X[s], bottomExtensionY, 0));
        }
      } else {
        for (let stepIdx = 0; stepIdx < numSteps; stepIdx++) {
          const gen = word[stepIdx];
          const i = gen.index - 1;
          const sign = gen.sign;

          const yStart = topY - stepIdx * STEP_HEIGHT;
          const yEnd = topY - (stepIdx + 1) * STEP_HEIGHT;

          const isLastStep = (stepIdx === numSteps - 1);
          const factor = isLastStep ? tAnim : 1.0;

          const strandA = currentPermutation[i];
          const strandB = currentPermutation[i + 1];

          const xA = STRAND_POSITIONS_X[i];
          const xB = STRAND_POSITIONS_X[i + 1];

          const zDepth = 0.85 * sign;
          const samples = 12;

          for (let s = 1; s <= samples; s++) {
            const frac = s / samples;
            const y = THREE.MathUtils.lerp(yStart, yEnd, frac);

            for (let pos = 0; pos < 4; pos++) {
              if (pos !== i && pos !== i + 1) {
                const st = currentPermutation[pos];
                const x = STRAND_POSITIONS_X[pos];
                strandPaths[st].push(new THREE.Vector3(x, y, 0));
              }
            }

            const xCurrentA = THREE.MathUtils.lerp(xA, THREE.MathUtils.lerp(xA, xB, factor), frac);
            const zCurrentA = Math.sin(frac * Math.PI) * zDepth * factor;
            strandPaths[strandA].push(new THREE.Vector3(xCurrentA, y, zCurrentA));

            const xCurrentB = THREE.MathUtils.lerp(xB, THREE.MathUtils.lerp(xB, xA, factor), frac);
            const zCurrentB = -Math.sin(frac * Math.PI) * zDepth * factor;
            strandPaths[strandB].push(new THREE.Vector3(xCurrentB, y, zCurrentB));
          }

          if (!isLastStep || tAnim >= 0.99) {
            currentPermutation[i] = strandB;
            currentPermutation[i + 1] = strandA;
          }
        }

        const finalY = topY - numSteps * STEP_HEIGHT;
        const bottomExtensionY = finalY - EXTENSION_LENGTH;
        for (let pos = 0; pos < 4; pos++) {
          const st = currentPermutation[pos];
          const x = STRAND_POSITIONS_X[pos];
          strandPaths[st].push(new THREE.Vector3(x, bottomExtensionY, 0));
        }
      }

      return { strandPaths, currentPermutation };
    }

    function updateBraidGeometries() {
      const { strandPaths } = computeStrandCurves(braidWord, animatedProgress);

      for (let s = 0; s < 4; s++) {
        const points = strandPaths[s];
        const curve = new THREE.CatmullRomCurve3(points);
        
        if (strandMeshes[s].geometry) strandMeshes[s].geometry.dispose();
        strandMeshes[s].geometry = new THREE.TubeGeometry(curve, points.length * 2, 0.14, 16, false);
      }
    }

 
sectionContainer.addEventListener('wheel', (e) => {
  if (e.target.closest('.braid-controls')) return; 
  const maxScroll = getMaxScroll();
  if (maxScroll <= 0) return;
  e.preventDefault();
  targetScrollOffset += e.deltaY * 0.005;
  targetScrollOffset = Math.max(0, Math.min(maxScroll, targetScrollOffset));
}, { passive: false });

let isDragging = false;
let startY = 0;
let startScroll = 0;

sectionContainer.addEventListener('pointerdown', (e) => {
  // SE IL CLICK AVVIENE SULLA UI (PULSANTI/CONTROLLI), NON CATTURARE IL POINTER
  if (e.target.closest('.braid-ui')) return;

  if (getMaxScroll() <= 0) return;
  isDragging = true;
  startY = e.clientY;
  startScroll = targetScrollOffset;
  sectionContainer.setPointerCapture(e.pointerId);
});

sectionContainer.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  const deltaY = e.clientY - startY;
  targetScrollOffset = startScroll - deltaY * 0.015;
  targetScrollOffset = Math.max(0, Math.min(getMaxScroll(), targetScrollOffset));
});

sectionContainer.addEventListener('pointerup', (e) => {
  if (isDragging) {
    isDragging = false;
    try { sectionContainer.releasePointerCapture(e.pointerId); } catch(err){}
  }
});

sectionContainer.addEventListener('pointercancel', () => { isDragging = false; });

    function setInsertPosition(pos) {
      insertPosition = pos;
      document.getElementById('pos-top-btn').classList.toggle('active', pos === 'top');
      document.getElementById('pos-bottom-btn').classList.toggle('active', pos === 'bottom');
      autoFocusLastMove();
    }

    function addGenerator(index, sign) {
      if (isAnimating) return;
      const gen = { index, sign };
      if (insertPosition === 'top') {
        braidWord.unshift(gen);
      } else {
        braidWord.push(gen);
      }
      isAnimating = true;
      animatedProgress = 0.0;
      updateUI();
      autoFocusLastMove();
    }

    function undoGenerator() {
      if (isAnimating || braidWord.length === 0) return;
      if (insertPosition === 'top') {
        braidWord.shift();
      } else {
        braidWord.pop();
      }
      isAnimating = true;
      animatedProgress = 0.0;
      updateUI();
      autoFocusLastMove();
    }

    function resetBraid() {
      braidWord = [];
      animatedProgress = 1.0;
      isAnimating = false;
      targetScrollOffset = 0;
      scrollOffset = 0;
      updateUI();
      updateCameraScroll();
      updateBraidGeometries();
    }

    function reduceBraidWord(word) {
      let current = word.map(g => ({ ...g }));

      function freeCancel(w) {
        let res = w.map(g => ({ ...g }));
        let changed = true;
        while (changed) {
          changed = false;
          for (let i = 0; i < res.length; i++) {
            for (let j = i + 1; j < res.length; j++) {
              let canCommute = true;
              for (let k = i + 1; k < j; k++) {
                if (Math.abs(res[i].index - res[k].index) < 2) {
                  canCommute = false;
                  break;
                }
              }
              if (canCommute && res[i].index === res[j].index && res[i].sign === -res[j].sign) {
                res.splice(j, 1);
                res.splice(i, 1);
                changed = true;
                break;
              }
            }
            if (changed) break;
          }
        }
        return res;
      }

      let changed = true;
      let iterations = 0;
      while (changed && iterations < 100) {
        iterations++;
        changed = false;

        let cancelled = freeCancel(current);
        if (cancelled.length < current.length) {
          current = cancelled;
          changed = true;
          continue;
        }

        for (let i = 0; i <= current.length - 3; i++) {
          const g1 = current[i], g2 = current[i+1], g3 = current[i+2];
          if (g1.sign === g2.sign && g2.sign === g3.sign) {
            if (g1.index === g3.index && Math.abs(g1.index - g2.index) === 1) {
              let test = current.map(g => ({ ...g }));
              test[i] = { index: g2.index, sign: g1.sign };
              test[i+1] = { index: g1.index, sign: g1.sign };
              test[i+2] = { index: g2.index, sign: g1.sign };

              let testReduced = freeCancel(test);
              if (testReduced.length < current.length) {
                current = testReduced;
                changed = true;
                break;
              }
            }
          }
        }
      }
      return current;
    }

    function normalizeBraid() {
      if (isAnimating) return;
      const reduced = reduceBraidWord(braidWord);
      if (reduced.length < braidWord.length) {
        braidWord = reduced;
        isAnimating = true;
        animatedProgress = 0.0;
        updateUI();
        autoFocusLastMove();
      }
    }

    function updateUI() {
      const labelEl = document.getElementById('braidLabel');
      if (braidWord.length === 0) {
        labelEl.innerText = "e";
      } else {
        labelEl.innerText = braidWord.map(g => `σ${g.index}${g.sign === -1 ? '⁻¹' : ''}`).join(' ');
      }

      document.getElementById('wordLengthVal').innerText = braidWord.length;

      const { currentPermutation } = computeStrandCurves(braidWord, 1.0);
      const visited = [false, false, false, false];
      const cycles = [];

      for (let s = 0; s < 4; s++) {
        if (!visited[s]) {
          let cycle = [];
          let curr = s;
          while (!visited[curr]) {
            visited[curr] = true;
            cycle.push(curr + 1);
            curr = currentPermutation.indexOf(curr);
          }
          cycles.push(cycle);
        }
      }

      document.getElementById('permutationVal').innerText = cycles.map(c => `(${c.join('')})`).join('');
    }

    let lastTime = performance.now();
    function animateBraid(currentTime) {
      requestAnimationFrame(animateBraid);

      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;


      if (Math.abs(scrollOffset - targetScrollOffset) > 0.001) {
        scrollOffset += (targetScrollOffset - scrollOffset) * 0.12;
        updateCameraScroll();
      } else {
        scrollOffset = targetScrollOffset;
        updateCameraScroll();
      }

      if (isAnimating) {
        animatedProgress += deltaTime * 2.8;
        if (animatedProgress >= 1.0) {
          animatedProgress = 1.0;
          isAnimating = false;
        }
        updateBraidGeometries();
      }

      braidRenderer.render(braidScene, braidCamera);
    }

    // Auto-Resize
    window.addEventListener('resize', () => {
      const w = canvasContainer.clientWidth;
      const h = canvasContainer.clientHeight;
      braidCamera.aspect = w / h;
      braidCamera.updateProjectionMatrix();
      braidRenderer.setSize(w, h);
    });

    updateUI();
    autoFocusLastMove();
    updateBraidGeometries();
    animateBraid(performance.now());
