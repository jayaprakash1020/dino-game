const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const hiScoreEl = document.getElementById('hi-score');
const curScoreEl = document.getElementById('cur-score');

const W = canvas.width;
const H = canvas.height;
const GROUND = H - 30;

// ── Colours ──────────────────────────────────────────
const C = {
  ground:  '#bbb',
  dino:    '#555',
  cactus:  '#4a7c45',
  cloud:   '#ddd',
  score:   '#999',
};

// ── Game state ────────────────────────────────────────
let state = 'idle'; // idle | running | dead
let score = 0;
let hiScore = 0;
let frames = 0;
let speed = 6;
let raf;

// ── Dino ──────────────────────────────────────────────
const dino = {
  x: 80,
  y: GROUND,
  w: 44,
  h: 48,
  vy: 0,
  gravity: 1.2,
  jumpForce: -18,
  ducking: false,
  legPhase: 0,

  get bottom() { return this.y + (this.ducking ? this.h * 0.5 : this.h); },

  jump() {
    if (this.bottom >= GROUND + 1) {
      this.vy = this.jumpForce;
    }
  },

  duck(on) {
    this.ducking = on;
  },

  update() {
    this.vy += this.gravity;
    this.y += this.vy;

    const floor = GROUND - (this.ducking ? this.h * 0.5 : this.h);
    if (this.y >= floor) {
      this.y = floor;
      this.vy = 0;
    }

    if (this.bottom >= GROUND - 1) this.legPhase += 0.25;
  },

  draw() {
    ctx.save();
    ctx.fillStyle = C.dino;
    const x = this.x;
    const dh = this.ducking ? this.h * 0.5 : this.h;
    const dw = this.ducking ? this.w * 1.4 : this.w;
    const top = this.y;

    if (this.ducking) {
      // Body (flat)
      roundRect(x, top + dh * 0.3, dw, dh * 0.45, 6);
      // Head
      roundRect(x + dw - 22, top, 22, dh * 0.45, 5);
      // Eye
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + dw - 8, top + 8, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(x + dw - 7, top + 8, 2, 0, Math.PI * 2);
      ctx.fill();
      // Legs
      ctx.fillStyle = C.dino;
      const lp = Math.sin(this.legPhase) * 6;
      roundRect(x + 10, top + dh * 0.75, 10, dh * 0.3 + lp, 3);
      roundRect(x + 26, top + dh * 0.75, 10, dh * 0.3 - lp, 3);
    } else {
      // Body
      roundRect(x + 4, top + dh * 0.35, dw - 8, dh * 0.42, 6);
      // Neck
      roundRect(x + dw - 18, top + dh * 0.1, 14, dh * 0.42, 5);
      // Head
      roundRect(x + dw - 20, top, 20, dh * 0.28, 6);
      // Eye
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + dw - 7, top + 7, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(x + dw - 6, top + 7, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Tail
      ctx.fillStyle = C.dino;
      ctx.beginPath();
      ctx.moveTo(x + 4, top + dh * 0.55);
      ctx.quadraticCurveTo(x - 12, top + dh * 0.5, x - 6, top + dh * 0.7);
      ctx.quadraticCurveTo(x + 2, top + dh * 0.75, x + 4, top + dh * 0.6);
      ctx.fill();
      // Arm
      roundRect(x + dw - 22, top + dh * 0.52, 8, 5, 2);
      // Legs
      const lp = Math.sin(this.legPhase) * 8;
      roundRect(x + 10, top + dh * 0.77, 10, dh * 0.25 + lp, 3);
      roundRect(x + 24, top + dh * 0.77, 10, dh * 0.25 - lp, 3);
    }
    ctx.restore();
  },

  hitbox() {
    const dh = this.ducking ? this.h * 0.5 : this.h;
    const dw = this.ducking ? this.w * 1.4 : this.w;
    return { x: this.x + 6, y: this.y + 4, w: dw - 12, h: dh - 8 };
  }
};

// ── Clouds ────────────────────────────────────────────
const clouds = [];
function spawnCloud() {
  clouds.push({ x: W + 100, y: 20 + Math.random() * 50, w: 60 + Math.random() * 60, h: 20 + Math.random() * 14 });
}
function updateClouds() {
  if (frames % 90 === 0) spawnCloud();
  for (let i = clouds.length - 1; i >= 0; i--) {
    clouds[i].x -= speed * 0.4;
    if (clouds[i].x + clouds[i].w < 0) clouds.splice(i, 1);
  }
}
function drawClouds() {
  ctx.fillStyle = C.cloud;
  for (const c of clouds) {
    ctx.beginPath();
    ctx.ellipse(c.x + c.w / 2, c.y + c.h / 2, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Obstacles ─────────────────────────────────────────
const obstacles = [];
let nextSpawn = 80;

const CACTUS_TYPES = [
  { w: 20, h: 50 },
  { w: 34, h: 50 },
  { w: 52, h: 50 },
  { w: 20, h: 65 },
];

function spawnObstacle() {
  const t = CACTUS_TYPES[Math.floor(Math.random() * CACTUS_TYPES.length)];
  obstacles.push({ x: W + 10, y: GROUND - t.h, w: t.w, h: t.h, type: 'cactus' });
  nextSpawn = 60 + Math.floor(Math.random() * 80);
}

function updateObstacles() {
  nextSpawn--;
  if (nextSpawn <= 0) spawnObstacle();
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].x -= speed;
    if (obstacles[i].x + obstacles[i].w < 0) obstacles.splice(i, 1);
  }
}

function drawCactus(o) {
  ctx.fillStyle = C.cactus;
  const cx = o.x;
  const cy = o.y;
  const w = o.w;
  const h = o.h;
  const stems = Math.floor(w / 20);

  if (stems === 1) {
    // Single cactus
    roundRect(cx + w / 2 - 6, cy, 12, h, 4);
    // Left arm
    roundRect(cx + w / 2 - 14, cy + h * 0.3, 8, 14, 3);
    roundRect(cx + w / 2 - 14, cy + h * 0.15, 8, h * 0.2, 3);
    // Right arm
    roundRect(cx + w / 2 + 6, cy + h * 0.4, 8, 14, 3);
    roundRect(cx + w / 2 + 6, cy + h * 0.25, 8, h * 0.2, 3);
  } else if (stems === 2) {
    // Double cactus
    roundRect(cx, cy + h * 0.2, 12, h * 0.8, 4);
    roundRect(cx + w - 12, cy, 12, h, 4);
    roundRect(cx + 12, cy + h * 0.3, w - 24, 10, 3);
    // arms on right
    roundRect(cx + w - 20, cy + h * 0.35, 8, 12, 3);
    roundRect(cx + w - 20, cy + h * 0.2, 8, h * 0.18, 3);
  } else {
    // Triple / tall
    roundRect(cx, cy + h * 0.25, 12, h * 0.75, 4);
    roundRect(cx + w / 2 - 6, cy, 12, h, 4);
    roundRect(cx + w - 12, cy + h * 0.15, 12, h * 0.85, 4);
    roundRect(cx + 12, cy + h * 0.35, w / 2 - 18, 10, 3);
    roundRect(cx + w / 2 + 6, cy + h * 0.25, w / 2 - 18, 10, 3);
  }
}

function drawObstacles() {
  for (const o of obstacles) drawCactus(o);
}

// ── Collision ─────────────────────────────────────────
function checkCollision() {
  const dh = dino.hitbox();
  for (const o of obstacles) {
    const margin = 6;
    if (
      dh.x + dh.w - margin > o.x + margin &&
      dh.x + margin < o.x + o.w - margin &&
      dh.y + dh.h - margin > o.y + margin &&
      dh.y + margin < o.y + o.h
    ) return true;
  }
  return false;
}

// ── Ground ────────────────────────────────────────────
let groundOffset = 0;
function drawGround() {
  ctx.fillStyle = C.ground;
  ctx.fillRect(0, GROUND, W, 3);
  // Moving dashes
  ctx.fillStyle = '#ddd';
  for (let i = 0; i < 12; i++) {
    const x = ((i * 80 - groundOffset) % W + W) % W;
    ctx.fillRect(x, GROUND + 8, 40, 2);
  }
}

// ── Score ─────────────────────────────────────────────
function updateScore() {
  score++;
  if (score > hiScore) hiScore = score;
  curScoreEl.textContent = score;
  hiScoreEl.textContent = hiScore;
  // Speed up every 300 points
  if (score % 300 === 0) speed = Math.min(speed + 0.5, 18);
}

// ── Helpers ───────────────────────────────────────────
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

// ── Game loop ─────────────────────────────────────────
function loop() {
  if (state !== 'running') return;
  frames++;
  groundOffset = (groundOffset + speed) % W;

  ctx.clearRect(0, 0, W, H);

  updateClouds();
  drawClouds();
  drawGround();

  updateObstacles();
  drawObstacles();

  dino.update();
  dino.draw();

  if (frames % 3 === 0) updateScore();

  if (checkCollision()) {
    state = 'dead';
    showOverlay('GAME OVER', 'Press Space / ↑ to restart');
    return;
  }

  raf = requestAnimationFrame(loop);
}

// ── Start / Restart ───────────────────────────────────
function startGame() {
  state = 'running';
  score = 0;
  frames = 0;
  speed = 6;
  obstacles.length = 0;
  clouds.length = 0;
  nextSpawn = 80;
  dino.y = GROUND - dino.h;
  dino.vy = 0;
  dino.ducking = false;
  overlay.style.display = 'none';
  cancelAnimationFrame(raf);
  loop();
}

function showOverlay(title, sub) {
  overlay.innerHTML = `<h2>${title}</h2><p>${sub}</p>`;
  overlay.style.display = 'flex';
}

// ── Input ─────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (state === 'idle' || state === 'dead') { startGame(); return; }
    dino.jump();
  }
  if (e.code === 'ArrowDown') {
    e.preventDefault();
    if (state === 'running') dino.duck(true);
  }
});

document.addEventListener('keyup', e => {
  if (e.code === 'ArrowDown') dino.duck(false);
});

canvas.addEventListener('click', () => {
  if (state === 'idle' || state === 'dead') { startGame(); return; }
  dino.jump();
});
