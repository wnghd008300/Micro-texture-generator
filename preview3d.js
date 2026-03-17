/**
 * preview3d.js — 3D Viewer for Micro-Texture Generator
 */

window.Preview3D = (() => {
  let scene, camera, renderer, controls;
  let material, planeMesh;
  let canvas3DWrapper;
  let initialized = false;
  let animationId = null;

  function init() {
    canvas3DWrapper = document.getElementById('canvas-wrapper-3d');
    if (!canvas3DWrapper) return;

    // Fixed aspect ratio similar to 2D
    const size = Math.min(window.innerHeight - 140, window.innerWidth - 420, 600);

    // Scene setup
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, -6, 8);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(window.devicePixelRatio);
    canvas3DWrapper.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 20;
    // Allow full orbital rotation for sphere
    // controls.maxPolarAngle = Math.PI; 

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 5, 10);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-5, -5, 5);
    scene.add(fillLight);
    
    const backLight = new THREE.DirectionalLight(0xffffff, 0.8);
    backLight.position.set(0, 5, -10);
    scene.add(backLight);

    // Material setup
    // Use a dense SphereGeometry for displacement
    const geometry = new THREE.SphereGeometry(3, 256, 256);
    
    // Calculate tangents for normal mapping on sphere
    geometry.computeTangents();
    
    material = new THREE.MeshStandardMaterial({
      color: 0xaaaaaa,
      roughness: 0.2, // Lower roughness for stronger reflections
      metalness: 0.4, // Add some metalness for better light interaction
      displacementScale: 0.5
    });

    planeMesh = new THREE.Mesh(geometry, material);
    scene.add(planeMesh);

    initialized = true;

    // Resize handler
    window.addEventListener('resize', () => {
      const newSize = Math.min(window.innerHeight - 140, window.innerWidth - 420, 600);
      if (renderer && camera) {
        renderer.setSize(newSize, newSize);
      }
    });
  }

  function start() {
    if (!initialized) init();
    if (!animationId) animate();
  }

  function stop() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  function animate() {
    animationId = requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  function updateTextures(heightData, normalData, width, height, strength) {
    if (!initialized) init();

    // Create DataTextures for Three.js
    const heightTex = new THREE.DataTexture(heightData, width, height, THREE.RGBAFormat);
    heightTex.needsUpdate = true;
    
    const normalTex = new THREE.DataTexture(normalData, width, height, THREE.RGBAFormat);
    normalTex.needsUpdate = true;

    if (material.displacementMap) material.displacementMap.dispose();
    if (material.normalMap) material.normalMap.dispose();

    material.displacementMap = heightTex;
    // Map strength (-1 ~ 1) to a scale (e.g. up to 1 unit)
    material.displacementScale = strength * 1.5;

    material.normalMap = normalTex;
    // If strength is negative, invert normal scale so Lighting matches the engraved geometry
    const nScale = strength < 0 ? -1 : 1;
    material.normalScale.set(nScale, -nScale);

    // Refresh material
    material.needsUpdate = true;
  }
  
  function updateBaseColor(hexColor) {
    if (initialized && material) {
      material.color = new THREE.Color(hexColor);
    }
  }

  return { start, stop, updateTextures, updateBaseColor };
})();
