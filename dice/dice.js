function initDice3D() {
  const container = document.getElementById('dice-canvas-container');
  
  if (!container) {
    console.error("[Dice 3D] Errore: Contenitore '#dice-canvas-container' non trovato.");
    return;
  }

 
  container.style.pointerEvents = 'auto';
  container.style.cursor = 'pointer';
  container.innerHTML = '';


  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 0, 4.2);
  camera.lookAt(0, 0, 0);


  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(90, 90);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

 
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7);
  scene.add(directionalLight);


  const textureLoader = new THREE.TextureLoader();
  const imagePaths = [
    'dice/face_sigma_1.png',
    'dice/face_sigma_1_inv.png',
    'dice/face_sigma_2.png',
    'dice/face_sigma_2_inv.png',
    'dice/face_sigma_3.png',
    'dice/face_sigma_3_inv.png'
  ];

  const materials = imagePaths.map((path) => {
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.3
    });

    textureLoader.load(
      path,
      (texture) => {
        material.map = texture;
        material.needsUpdate = true;
      },
      undefined,
      (err) => console.warn(`[Dice 3D] Immagine non trovata/CORS: ${path}`)
    );

    return material;
  });


  const geometry = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  const diceMesh = new THREE.Mesh(geometry, materials);
  scene.add(diceMesh);


  diceMesh.rotation.set(0.5, 0.6, 0);


  let isRolling = false;
  let rollProgress = 0;
  let startRotation = { x: 0, y: 0, z: 0 };
  let targetRotation = { x: 0, y: 0, z: 0 };

  
  const faceRotations = [
    { x: 0, y: -Math.PI / 2, z: 0 }, // Faccia 1 (+X)
    { x: 0, y: Math.PI / 2, z: 0 },  // Faccia 2 (-X)
    { x: Math.PI / 2, y: 0, z: 0 },  // Faccia 3 (+Y)
    { x: -Math.PI / 2, y: 0, z: 0 }, // Faccia 4 (-Y)
    { x: 0, y: 0, z: 0 },            // Faccia 5 (+Z)
    { x: 0, y: Math.PI, z: 0 }       // Faccia 6 (-Z)
  ];


  function rollDice() {
    if (isRolling) return;

    isRolling = true;
    rollProgress = 0;

    
    const randomIndex = Math.floor(Math.random() * 6);
    const finalRot = faceRotations[randomIndex];

    
    const extraTurnsX = (Math.floor(Math.random() * 3) + 2) * Math.PI * 2;
    const extraTurnsY = (Math.floor(Math.random() * 3) + 2) * Math.PI * 2;

    startRotation = {
      x: diceMesh.rotation.x,
      y: diceMesh.rotation.y,
      z: diceMesh.rotation.z
    };

    targetRotation = {
      x: startRotation.x + extraTurnsX + (finalRot.x - (startRotation.x % (Math.PI * 2))),
      y: startRotation.y + extraTurnsY + (finalRot.y - (startRotation.y % (Math.PI * 2))),
      z: startRotation.z + (finalRot.z - (startRotation.z % (Math.PI * 2)))
    };
  }

 
  container.addEventListener('click', rollDice);

  /
  function animate() {
    requestAnimationFrame(animate);

    if (isRolling) {
      rollProgress += 0.02;

      if (rollProgress >= 1) {
        rollProgress = 1;
        isRolling = false;
      }

 
      const ease = 1 - Math.pow(1 - rollProgress, 3);

      diceMesh.rotation.x = startRotation.x + (targetRotation.x - startRotation.x) * ease;
      diceMesh.rotation.y = startRotation.y + (targetRotation.y - startRotation.y) * ease;
      diceMesh.rotation.z = startRotation.z + (targetRotation.z - startRotation.z) * ease;
    }

    renderer.render(scene, camera);
  }

  animate();
}

document.addEventListener('DOMContentLoaded', initDice3D);
