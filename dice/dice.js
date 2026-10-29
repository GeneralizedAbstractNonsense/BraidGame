function initDice3D() {
  const container = document.getElementById('dice-canvas-container');
  
  if (!container) {
    console.error("[Dice 3D] Error: '#dice-canvas-container' wasn't found.");
    return;
  }


  container.innerHTML = '';


  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(2.8, 2.8, 3.5);
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

  // Textures
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
        console.log(`[Dice 3D] loaded: ${path}`);
        material.map = texture;
        material.needsUpdate = true;
      },
      undefined,
      (err) => {
        console.error(`[Dice 3D] ERROR in loading '${path}'.`, err);
      }
    );

    return material;
  });

  // Creation
  const geometry = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  const diceMesh = new THREE.Mesh(geometry, materials);
  scene.add(diceMesh);

  // Rotation
  function animate() {
    requestAnimationFrame(animate);
    diceMesh.rotation.x += 0.006;
    diceMesh.rotation.y += 0.009;
    renderer.render(scene, camera);
  }

  animate();
  console.log("[Dice 3D] Init completed.");
}


document.addEventListener('DOMContentLoaded', initDice3D);
