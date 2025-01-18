import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { easing } from 'maath';

let scene, camera, renderer, controls;
let particles, backgroundSound;
let mouseX = 0;
let mouseY = 0;
let screenMesh1, screenMesh2, images = [], currentImageIndex = 0;

class Particles {
  constructor(scene) {
    this.scene = scene;
    this.particleCount = 300;
    this.initialRadius = 0.1;
    this.movementSpeed = 2;
    this.colors = ['#da6b00', '#8555d4', '#4ad3b5', '#ffffff'];
    this.directions = [];
    this.starSystems = [];
    this.systemCount = 1;

    this.mousePosition = new THREE.Vector3(0, -40, -30); 

    // Load sound
    this.loadSound();

    // Initialize the first star system at a default position
    this.addStars(this.getPastelColor(), this.mousePosition.x, this.mousePosition.y, this.mousePosition.z);

    // Add event listener for mouse clicks
    window.addEventListener('mousedown', this.mouseDown.bind(this));

    // Set interval for adding stars
    setInterval(() => {
      this.systemCount++;
      this.addStars(this.getPastelColor(), this.mousePosition.x, this.mousePosition.y, this.mousePosition.z); 
    }, 8000);
  }

  loadSound() {
    this.audioContext = new (window.AudioContext || window.AudioContext)();
    this.soundBuffer = null;

    const soundUrl = './public/sound/explosionSound.mp3';
    fetch(soundUrl)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => this.audioContext.decodeAudioData(arrayBuffer))
      .then(audioBuffer => {
        this.soundBuffer = audioBuffer;
      })
      .catch(error => console.error('Error loading sound:', error));
  }

  playSound() {
    if (!this.soundBuffer) return;
  
    // Create a gain node for volume control
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime); 
    gainNode.connect(this.audioContext.destination); // Connect to the audio context's output
  
    const source = this.audioContext.createBufferSource();
    source.buffer = this.soundBuffer;
    source.connect(gainNode); // Connect the source to the gain node
    source.start(0);
  }

  getPastelColor() {
    const color = new THREE.Color(`hsl(${Math.random() * 360}, ${25 + 70 * Math.random()}%, ${85 + 10 * Math.random()}%)`);
    return `#${color.getHexString()}`;
  }

  addStars(color, x, y, z) {
    const dirs = [];
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const particleMaterial = new THREE.PointsMaterial({
      color: color,
      size: 0.5,
      transparent: true,
      blending: THREE.AdditiveBlending,
      map: this.getTexture(color),
      depthTest: false,
    });

    for (let i = 0; i < this.particleCount; i++) {
      const vertex = new THREE.Vector3(x, y, z); // Use the current mouse position
      positions.push(vertex.x, vertex.y, vertex.z);
      dirs.push({
        x: (Math.random() * this.movementSpeed) - (this.movementSpeed / 2),
        y: (Math.random() * this.movementSpeed) - (this.movementSpeed / 2),
        z: (Math.random() * this.movementSpeed) - (this.movementSpeed / 2)
      });
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const starSystem = new THREE.Points(geometry, particleMaterial);
    this.directions.push(dirs);
    this.starSystems.push(starSystem);
    this.scene.add(starSystem);

    // Play sound when stars are added
    this.playSound();
  }

  mouseDown(event) {
    // Update mouse position based on click
    const canvasX = (event.clientX / window.innerWidth) * 2 - 1;
    const canvasY = - (event.clientY / window.innerHeight) * 2 + 1;
    
    // Unproject mouse position to world coordinates
    const vector = new THREE.Vector3(canvasX, canvasY, 0.5);
    vector.unproject(camera); // Assuming camera is defined in your scope
    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    this.mousePosition = camera.position.clone().add(dir.multiplyScalar(distance));

    // Add stars at the clicked position
    this.addStars(this.getPastelColor(), this.mousePosition.x, this.mousePosition.y, this.mousePosition.z);

    this.mousePosition.set(0, -40, -30);
  }

  getTexture(color) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, color);
    gradient.addColorStop(0.4, color);
    gradient.addColorStop(1, 'rgba(0,0,0,1)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 32, 32);
    const texture = new THREE.Texture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  animate() {
    this.starSystems.forEach((system, j) => {
      const positions = system.geometry.attributes.position.array;
      const directions = this.directions[j];

      for (let i = 0; i < this.particleCount; i++) {
        positions[i * 3] += directions[i].x;
        positions[i * 3 + 1] += directions[i].y;
        positions[i * 3 + 2] += directions[i].z;
      }
      system.geometry.attributes.position.needsUpdate = true;
    });
  }
}

init();
animate();

function init() {
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202123);

  // Camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, 3, 50);

  // Renderer
  const canvas = document.getElementById('root');
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Orbit Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // Light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  // Directional Lights
  addDirectionalLights();

  // Floor, Text, Table, Cake
  createFloor();
  addText();
  addTable();
  addCake();

  // Particles
  particles = new Particles(scene);

  // Load background sound
  backgroundSound = new Audio('./public/sound/backgroundSound.mp3');
  backgroundSound.loop = true; 
  backgroundSound.volume = 0.6; 

  // Handle Window Resize
  window.addEventListener('resize', onWindowResize);

  window.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1; // Normalize to [-1, 1]
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1; // Normalize to [-1, 1]
  });

  createStages();
}

function addDirectionalLights() {
  const positions = [
    { x: 10, y: 10, z: 10 },
    { x: -10, y: 10, z: 10 },
    { x: 10, y: 10, z: -10 },
    { x: -10, y: 10, z: -10 }
  ];
  positions.forEach((pos, index) => {
    const light = new THREE.DirectionalLight(0xffffff, index < 2 ? 1 : 0.5);
    light.position.set(pos.x, pos.y, pos.z);
    light.castShadow = true;
    scene.add(light);
  });
}

function addText() {
  const fontLoader = new FontLoader();
  fontLoader.load('./public/fonts/Roboto.json', (font) => {
    const textMaterial = new THREE.MeshStandardMaterial({ color: 0xE4B1F0, metalness: 0.7, roughness: 0.4 });

    let lines = [
      { text: "WISH YOU", positionY: 25.5 },
      { text: "HAPPY BIRTHDAY", positionY: 15.5 },
      { text: "Ankit Singh", positionY: 5.5 }
    ];

    let meshes = []; // Store individual text meshes
    lines.forEach(() => meshes.push(null)); // Initialize with null for each line

    let lineIndex = 0;
    let currentLineText = "";
    let letterIndex = 0;

    function revealNextLetter() {
      if (lineIndex < lines.length) {
        const line = lines[lineIndex];
        currentLineText += line.text[letterIndex] || ""; // Append next letter or an empty string
        letterIndex++;

        // Create text geometry for the current progress
        const geometry = new TextGeometry(currentLineText, {
          font: font,
          size: 6,
          depth: 0.5,
          curveSegments: 12,
          bevelEnabled: true,
          bevelThickness: 0.3,
          bevelSize: 0.2,
          bevelOffset: 0,
          bevelSegments: 5
        });
        geometry.center();

        // If this is the first letter, create a new mesh for this line
        if (!meshes[lineIndex]) {
          const mesh = new THREE.Mesh(geometry, textMaterial);
          mesh.position.y = line.positionY;
          scene.add(mesh);
          meshes[lineIndex] = mesh; // Store reference to the mesh
        } else {
          // Update existing mesh geometry
          meshes[lineIndex].geometry.dispose();
          meshes[lineIndex].geometry = geometry;
        }

        if (letterIndex < line.text.length) {
          setTimeout(revealNextLetter, 100); // Reveal next letter
        } else {
          currentLineText = ""; // Reset for next line
          letterIndex = 0;
          lineIndex++;
          setTimeout(revealNextLetter, 500); // Delay before next line
        }
      }
    }

    backgroundSound.play().catch(error => console.error('Error playing sound:', error));
    revealNextLetter(); // Start the letter-by-letter animation
  });
}

function createFloor() {
    const textureLoader = new THREE.TextureLoader();
    const tileTexture = textureLoader.load('./public/textures/tileTexture.jpg'); 

    tileTexture.wrapS = tileTexture.wrapT = THREE.RepeatWrapping;
    tileTexture.repeat.set(6, 6); // Adjust the number of tiles
    tileTexture.offset.set(0.09, 0.09); // Adjust the offset for the texture to create space

    const floorMaterial = new THREE.MeshStandardMaterial({
      map: tileTexture,
      metalness: 0.8, 
      roughness: 0.8 
    });

    const floorGeometry = new THREE.PlaneGeometry(150, 150);
    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.rotation.x = -Math.PI / 2; // Rotate the floor to be horizontal
    floorMesh.position.y = -10; // Position the floor below the text
    scene.add(floorMesh);
}

function addTable() {
  const loader = new GLTFLoader();
  loader.load('./public/models/Table.glb', (gltf) => {
    const model = gltf.scene;
    model.position.set(0, -10, 30); 
    model.scale.set(15, 12, 15); 

    scene.add(model);
  });
}

function addCake() {
  const loader = new GLTFLoader();
  loader.load('./public/models/cakeBirthday.glb', (gltf) => {
    const cake = gltf.scene;
    cake.position.set(0, -4, 30); 
    cake.scale.set(12, 12, 12); 

    scene.add(cake);
  });
}

function createStages() {
  const textureLoader = new THREE.TextureLoader();

  // Add dim lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 0.4); // Soft ambient light
  const pointLight = new THREE.PointLight(0xffffff, 0.5); // Point light with lower intensity
  pointLight.position.set(0, 30, 20); // Position above the stages
  scene.add(ambientLight);
  scene.add(pointLight);

  // Create a border material with glow effect
  const glowMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffbf, side: THREE.BackSide });

  // Helper function to create a glowing border around the stage
  function createGlowingBorder(mesh, width, height) {
    const borderGeometry = new THREE.PlaneGeometry(width + 1, height + 1); // Slightly larger for border
    const borderMesh = new THREE.Mesh(borderGeometry, glowMaterial);
    borderMesh.position.copy(mesh.position);
    borderMesh.rotation.copy(mesh.rotation);
    scene.add(borderMesh);
  }

  // Stage 1: Image Slideshow (5 images)
  const stage1Images = [
    './public/images/1.jpeg',
    './public/images/2.jpeg',
    './public/images/3.jpeg'
  ];
  setupSlideshow(stage1Images, -50, 10, 10);

  // Stage 2: Image Slideshow (5 images)
  const stage2Images = [
    './public/images/3.jpeg',
    './public/images/1.jpeg',
    './public/images/2.jpeg'
  ];
  setupSlideshow(stage2Images, 50, 10, 10);

  // Function to set up a slideshow with glowing border
  function setupSlideshow(images, posX, posY, posZ) {
    let index = 0;
    const texture = new THREE.Texture();
    const material = new THREE.MeshBasicMaterial({ map: texture });

    const geometry = new THREE.PlaneGeometry(50, 50); // Default initial size
    const screenMesh = new THREE.Mesh(geometry, material);
    screenMesh.position.set(posX, posY, posZ);
    scene.add(screenMesh);

    loadImageToStage(images[index], texture, screenMesh);

    // Create a glowing border for the screen
    createGlowingBorder(screenMesh, 50, 50);

    // Update slideshow every 5 seconds
    setInterval(() => {
      index = (index + 1) % images.length;
      loadImageToStage(images[index], texture, screenMesh);
    }, 5000);
  }

  // Function to load the image into the texture and update the stage
  function loadImageToStage(imageUrl, texture, screenMesh) {
    textureLoader.load(imageUrl, (loadedTexture) => {
      const imageAspectRatio = loadedTexture.image.width / loadedTexture.image.height;

      const scaleFactor = 0.6; // Adjust this value for desired scaling (smaller images)
      const stageWidth = 50 * scaleFactor; // Apply scaling
      const stageHeight = stageWidth / imageAspectRatio;

      const newGeometry = new THREE.PlaneGeometry(stageWidth, stageHeight);
      loadedTexture.needsUpdate = true;

      screenMesh.material.map = loadedTexture;
      screenMesh.geometry.dispose();
      screenMesh.geometry = newGeometry;
      screenMesh.material.needsUpdate = true;
    });
  }
}

function animate() {
  requestAnimationFrame(animate);
  particles.animate();
  // controls.target.set(mouseX * 10, mouseY * 10, 0);
  controls.update();
  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

