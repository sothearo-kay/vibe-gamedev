import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// --- Configuration ---
const BRICK_L = 40;
const BRICK_W = 20;
const BRICK_H = 12;
const STUD_R = 3;
const STUD_H = 4;

const COLORS = [
  "#E32822",
  "#0055BF",
  "#F6AD33",
  "#237841",
  "#A0A5A9",
  "#1A1A1A",
  "#FFFFFF",
  "#9B59B6",
];

// --- State ---
let mode = "add";
let selectedColor = COLORS[0];
let isRotated = false;
let objects = []; // Interaction targets (meshes)

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2a2a);
scene.fog = new THREE.Fog(0x2a2a2a, 200, 1200);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  1,
  5000,
);
camera.position.set(150, 200, 150);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- Lights ---
const ambientLight = new THREE.AmbientLight(0x606060, 1.5);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
dirLight.position.set(100, 300, 100);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 4096;
dirLight.shadow.mapSize.height = 4096;
scene.add(dirLight);

// --- Grid & Plane ---
const planeGeometry = new THREE.PlaneGeometry(2000, 2000);
planeGeometry.rotateX(-Math.PI / 2);
const plane = new THREE.Mesh(
  planeGeometry,
  new THREE.MeshBasicMaterial({ visible: false }),
);
scene.add(plane);
objects.push(plane);

const gridHelper = new THREE.GridHelper(2000, 200); // 10 unit grid
gridHelper.material.opacity = 0.15;
gridHelper.material.transparent = true;
scene.add(gridHelper);

// --- Ghost Brick (The Preview) ---
// We create a simple box for the ghost to represent the brick volume
const ghostGeo = new THREE.BoxGeometry(BRICK_L, BRICK_H, BRICK_W);
ghostGeo.translate(0, BRICK_H / 2, 0); // Pivot bottom center
const ghostMaterial = new THREE.MeshBasicMaterial({
  color: 0xff0000,
  opacity: 0.5,
  transparent: true,
});
const rollOverMesh = new THREE.Mesh(ghostGeo, ghostMaterial);
scene.add(rollOverMesh);

// --- Brick Factory ---
function createBrickMesh(colorHex) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.2,
  });

  // Body
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(BRICK_L - 0.2, BRICK_H, BRICK_W - 0.2),
    material,
  );
  base.position.y = BRICK_H / 2;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Studs
  const studGeo = new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 16);
  const startX = -(BRICK_L / 2) + 5;
  const startZ = -(BRICK_W / 2) + 5;

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      const stud = new THREE.Mesh(studGeo, material);
      stud.position.set(
        startX + i * 10,
        BRICK_H + STUD_H / 2,
        startZ + j * 10,
      );
      stud.castShadow = true;
      stud.receiveShadow = true;
      group.add(stud);
    }
  }

  group.userData = { isBrick: true, color: colorHex };
  return group;
}

// --- Interaction Logic ---
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function getIntersects(event, targetArray) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(targetArray, true); // recursive true for groups
}

function onPointerMove(event) {
  const intersects = getIntersects(event, objects);

  if (intersects.length > 0) {
    const intersect = intersects[0];

    if (mode === "add" || mode === "move") {
      rollOverMesh.visible = true;

      // Basic Grid Snap (10 units)
      // We need to account for rotation to keep it on the grid lines
      const gridSize = 10;

      // Position calculation
      let px =
        Math.floor(intersect.point.x / gridSize) * gridSize +
        gridSize / 2;
      let pz =
        Math.floor(intersect.point.z / gridSize) * gridSize +
        gridSize / 2;
      let py = intersect.point.y;

      // If we are on top of another brick, stack it
      if (intersect.object !== plane) {
        // Find the top of the object we hit
        // Usually normal.y is 1 (top face).
        if (intersect.face.normal.y > 0.5) {
          py = intersect.point.y;
        }
      }

      rollOverMesh.position.set(px, py, pz);

      // Apply Rotation
      rollOverMesh.rotation.y = isRotated ? Math.PI / 2 : 0;

      // Update Ghost Color
      ghostMaterial.color.set(selectedColor);

      // Visual cue for Move mode
      if (mode === "move") ghostMaterial.opacity = 0.7;
      else ghostMaterial.opacity = 0.5;
    } else {
      rollOverMesh.visible = false;
    }
  }
}

function onPointerDown(event) {
  if (event.target.closest("#ui-container")) return;
  if (event.button !== 0) return; // Left click only

  const intersects = getIntersects(event, objects);
  if (intersects.length > 0) {
    const intersect = intersects[0];

    // 1. BUILD MODE
    if (mode === "add") {
      const brick = createBrickMesh(selectedColor);
      brick.position.copy(rollOverMesh.position);
      brick.rotation.y = rollOverMesh.rotation.y;
      scene.add(brick);

      // Add children to raycast targets
      brick.children.forEach((c) => objects.push(c));
    }

    // 2. DELETE MODE
    else if (mode === "delete") {
      if (intersect.object !== plane) {
        const group = intersect.object.parent;
        removeBrick(group);
      }
    }

    // 3. PAINT MODE
    else if (mode === "paint") {
      if (intersect.object !== plane) {
        const group = intersect.object.parent;
        group.children.forEach((m) =>
          m.material.color.set(selectedColor),
        );
        group.userData.color = selectedColor;
      }
    }

    // 4. MOVE MODE
    else if (mode === "move") {
      if (intersect.object !== plane) {
        // Pick it up!
        const group = intersect.object.parent;

        // Get properties of clicked brick
        selectedColor = group.userData.color;
        isRotated = Math.abs(group.rotation.y - Math.PI / 2) < 0.1; // Check if rotated

        // Delete existing
        removeBrick(group);

        // Switch to Add mode (so the user can place it immediately)
        setMode("add");

        // Update UI to reflect the color of the brick we just picked up
        updateColorSelection();
      }
    }
  }
}

function removeBrick(group) {
  scene.remove(group);
  // Clean up objects array
  group.children.forEach((child) => {
    const index = objects.indexOf(child);
    if (index > -1) objects.splice(index, 1);
  });
}

// --- Helpers ---

window.rotateBrick = () => {
  isRotated = !isRotated;
  // Trigger a visual update even if mouse doesn't move
  rollOverMesh.rotation.y = isRotated ? Math.PI / 2 : 0;
};

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "r") rotateBrick();
});

// UI Generation
const paletteDiv = document.getElementById("color-palette");

function renderPalette() {
  paletteDiv.innerHTML = "";
  COLORS.forEach((color) => {
    const btn = document.createElement("div");
    btn.className = "color-btn";
    if (color === selectedColor) btn.classList.add("selected");
    btn.style.backgroundColor = color;
    btn.onclick = () => {
      selectedColor = color;
      renderPalette();
    };
    paletteDiv.appendChild(btn);
  });
}

function updateColorSelection() {
  renderPalette();
}

window.setMode = (newMode) => {
  mode = newMode;
  document
    .querySelectorAll(".tool-btn")
    .forEach((b) => b.classList.remove("active"));
  const btn = document.getElementById("btn-" + newMode);
  if (btn) btn.classList.add("active");

  // Cursor feedback
  if (mode === "delete") document.body.style.cursor = "not-allowed";
  else if (mode === "move") document.body.style.cursor = "grab";
  else if (mode === "paint") document.body.style.cursor = "crosshair";
  else document.body.style.cursor = "default";
};

window.clearScene = () => {
  // Filter out the plane (first object)
  // Remove all other groups
  const toRemove = [];
  scene.traverse((obj) => {
    if (obj.userData && obj.userData.isBrick) toRemove.push(obj);
  });
  toRemove.forEach((obj) => removeBrick(obj));
};

// Init
renderPalette();
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
document.addEventListener("pointermove", onPointerMove);
document.addEventListener("pointerdown", onPointerDown);

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
