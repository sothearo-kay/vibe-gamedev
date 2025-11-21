const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 800;
canvas.height = 400;

// Game Constants
let gameSpeed = 5;
const GRAVITY = 0.6;
const JUMP_FORCE = -14;
const GROUND_Y = canvas.height - 50;

// Game State Variables
let score = 0;
let highScore = 0;
let frame = 0;
let isGameOver = false;
let obstacles = [];
let particles = [];
let screenShake = { duration: 0, magnitude: 0 };
let animationFrameId; // NEW: Global ID for the animation loop

// Input State
const keys = { space: false };

// --- PARTICLES ---
class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.size = Math.random() * 2 + 1;
    this.speedX = Math.random() * 1.5 - 0.75;
    this.speedY = Math.random() * 1.5 - 0.75;
    this.alpha = 1;
    this.life = 60;
  }
  update() {
    this.x += this.speedX - gameSpeed / 5;
    this.y += this.speedY;
    this.alpha -= 1 / this.life;
    this.life--;
  }
  draw() {
    ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
    ctx.fillRect(this.x, this.y, this.size, this.size);
  }
}

// --- THE PLAYER (BALL) ---
class BallPlayer {
  constructor() {
    this.x = 100;
    this.y = GROUND_Y;
    this.dy = 0;
    this.radius = 20;
    this.width = this.radius * 2;
    this.height = this.radius * 2;
    this.isGrounded = true;
  }

  draw() {
    ctx.fillStyle = "white";
    ctx.beginPath();
    // Draw the ball centered on its hitbox defined by x, y
    ctx.arc(
      this.x + this.radius,
      this.y - this.radius,
      this.radius,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  update() {
    // Jump Logic (Space Only)
    if (keys.space && this.isGrounded) {
      this.dy = JUMP_FORCE;
      this.isGrounded = false;
      // Particles on jump
      for (let i = 0; i < 10; i++) {
        particles.push(
          new Particle(this.x + this.radius, this.y - this.radius),
        );
      }
    }

    // Apply Gravity
    this.y += this.dy;

    if (this.y < GROUND_Y) {
      this.dy += GRAVITY;
      this.isGrounded = false;
    } else {
      this.y = GROUND_Y;
      this.dy = 0;
      this.isGrounded = true;
    }

    this.draw();
  }
}

// --- OBSTACLES ---
class Obstacle {
  constructor() {
    this.w = 40;
    this.h = 40;

    // Use 50/50 chance for standard or higher obstacles
    this.isHighObstacle = Math.random() > 0.5;

    if (this.isHighObstacle) {
      this.h = 40;
      this.y = GROUND_Y - 90; // Bottom edge of obstacle hitbox is off the ground
      this.type = "drone"; // Diamond style
    } else {
      this.h = 50;
      this.y = GROUND_Y; // Bottom edge of obstacle hitbox is on the ground
      this.type = "block"; // Rectangle style
    }

    this.x = canvas.width + this.w;
    this.markedForDeletion = false;
  }

  update() {
    this.x -= gameSpeed;
    if (this.x + this.w < 0) this.markedForDeletion = true;
    this.draw();
  }

  draw() {
    ctx.fillStyle = "white";

    if (this.type === "block") {
      ctx.fillRect(this.x, this.y - this.h, this.w, this.h);
    } else {
      // Draw diamond using hitbox bounds for consistency
      const centerX = this.x + this.w / 2;
      const centerY = this.y - this.h / 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - this.h / 2);
      ctx.lineTo(centerX + this.w / 2, centerY);
      ctx.lineTo(centerX, centerY + this.h / 2);
      ctx.lineTo(centerX - this.w / 2, centerY);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// --- GAME LOGIC ---
const player = new BallPlayer();

function spawnObstacle() {
  if (frame % Math.round(1000 / (gameSpeed * 1.5)) === 0) {
    if (Math.random() > 0.2) {
      obstacles.push(new Obstacle());
    }
  }
}

function handleGameOver() {
  // NEW: Stop the animation loop explicitly
  cancelAnimationFrame(animationFrameId);
  isGameOver = true;

  if (score > highScore) highScore = score;
  document.getElementById("high-score").innerText =
    "HI: " + highScore.toString().padStart(5, "0");
  document.getElementById("game-over").style.display = "block";

  screenShake.duration = 15;
  screenShake.magnitude = 6;
}

function resetGame() {
  // NEW: Stop any running loop just in case
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  isGameOver = false;
  score = 0;
  gameSpeed = 5;
  frame = 0; // <-- Reset frame counter
  obstacles = [];
  particles = [];
  player.y = GROUND_Y;
  player.dy = 0;
  document.getElementById("game-over").style.display = "none";
  animate();
}

function animate() {
  // NEW: Store the ID of the current loop
  animationFrameId = requestAnimationFrame(animate);

  if (isGameOver) {
    // Allow screen shake to finish drawing
    if (screenShake.duration > 0) {
      // If the loop is only running for shake, we need to schedule one last frame
      if (!animationFrameId) requestAnimationFrame(animate);
    }
    return;
  }

  let shakeX = 0,
    shakeY = 0;
  if (screenShake.duration > 0) {
    shakeX =
      Math.random() * screenShake.magnitude * 2 - screenShake.magnitude;
    shakeY =
      Math.random() * screenShake.magnitude * 2 - screenShake.magnitude;
    ctx.translate(shakeX, shakeY);
    screenShake.duration--;
  }

  // Clear Canvas (Black)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";
  ctx.fillRect(-shakeX, -shakeY, canvas.width, canvas.height);

  // Draw Ground Line
  ctx.strokeStyle = "white";
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(canvas.width, GROUND_Y);
  ctx.stroke();

  frame++;

  // Increase Speed
  if (frame % 600 === 0) gameSpeed += 0.5;

  // Increase Score
  if (frame % 5 === 0) score++;
  document.getElementById("score").innerText = score
    .toString()
    .padStart(5, "0");

  // Manage Obstacles
  spawnObstacle();

  obstacles.forEach((obs, index) => {
    obs.update();

    // --- Collision Detection ---
    const pLeft = player.x;
    const pRight = player.x + player.width;
    const pBottom = player.y;
    const pTop = player.y - player.height;

    const oLeft = obs.x;
    const oRight = obs.x + obs.w;
    const oBottom = obs.y;
    const oTop = obs.y - obs.h;

    if (
      pRight > oLeft &&
      pLeft < oRight &&
      pBottom > oTop &&
      pTop < oBottom
    ) {
      handleGameOver();
    }

    if (obs.markedForDeletion) obstacles.splice(index, 1);
  });

  // Update Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    if (particles[i].life <= 0) {
      particles.splice(i, 1);
    } else {
      particles[i].draw();
    }
  }

  player.update();

  // Undo screen shake translation
  if (shakeX !== 0 || shakeY !== 0) {
    ctx.translate(-shakeX, -shakeY);
  }
}

// --- INPUT HANDLERS ---
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    if (isGameOver) {
      resetGame();
    } else {
      keys.space = true;
    }
  }
});

window.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    keys.space = false;
  }
});

animate();
