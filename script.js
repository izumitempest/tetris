/*
  Tetris implementation with:
  - 10x20 field, 7-bag randomizer
  - SRS rotation system (basic wall kicks)
  - Hold, Next Queue (5)
  - Soft/Hard drop, DAS/ARR-ish key repeat
  - Scoring, levels, combo, back-to-back, T-Spins detection (basic)
  - Pause, Game Over, APM
*/

const BOARD_COLS = 10;
const BOARD_ROWS = 20;
const VISIBLE_ROWS = 20;
const CELL_SIZE = 30; // canvas internal pixels (board is 300x600)

const GRAVITY_LEVELS = [
  1000, 793, 618, 473, 355, 262, 190, 135, 94, 64,
  43, 28, 18, 11, 7, 5, 3, 2, 1, 1
];

const SCORE_SINGLE = 100;
const SCORE_DOUBLE = 300;
const SCORE_TRIPLE = 500;
const SCORE_TETRIS = 800;
const SCORE_TSPIN_MINI = 100;
const SCORE_TSPIN = 400;
const SCORE_TSPIN_SINGLE = 800;
const SCORE_TSPIN_DOUBLE = 1200;
const SCORE_TSPIN_TRIPLE = 1600;
const SCORE_SOFT_DROP = 1;
const SCORE_HARD_DROP = 2;

const LOCK_DELAY_MS = 500; // generous lock delay

const PIECE_TYPES = ["I","J","L","O","S","T","Z"];

const KICK_TABLE = {
  // JLTSZ pieces (Super Rotation System)
  JLTSZ: {
    // from orientation index -> test offsets [dx, dy]
    cw: [
      // 0 -> 1
      [ [0,0],[-1,0],[-1, 1],[0,-2],[-1,-2] ],
      // 1 -> 2
      [ [0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2] ],
      // 2 -> 3
      [ [0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2] ],
      // 3 -> 0
      [ [0,0],[-1,0],[-1,-1],[0, 2],[-1, 2] ],
    ],
    ccw: [
      // 0 -> 3
      [ [0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2] ],
      // 3 -> 2
      [ [0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2] ],
      // 2 -> 1
      [ [0,0],[-1,0],[-1, 1],[0,-2],[-1,-2] ],
      // 1 -> 0
      [ [0,0],[-1,0],[-1,-1],[0, 2],[-1, 2] ],
    ],
    // Reasonable community 180° kicks (identical per from-state)
    rot180: [
      [ [0,0],[1,0],[-1,0],[0,-1],[2,0],[-2,0],[0,-2],[1,-1],[-1,-1] ],
      [ [0,0],[1,0],[-1,0],[0,-1],[2,0],[-2,0],[0,-2],[1,-1],[-1,-1] ],
      [ [0,0],[1,0],[-1,0],[0,-1],[2,0],[-2,0],[0,-2],[1,-1],[-1,-1] ],
      [ [0,0],[1,0],[-1,0],[0,-1],[2,0],[-2,0],[0,-2],[1,-1],[-1,-1] ],
    ],
  },
  // I piece has its own SRS kicks
  I: {
    cw: [
      // 0 -> 1
      [ [0,0],[-2,0],[ 1,0],[-2,-1],[ 1, 2] ],
      // 1 -> 2
      [ [0,0],[-1,0],[ 2,0],[-1, 2],[ 2,-1] ],
      // 2 -> 3
      [ [0,0],[ 2,0],[-1,0],[ 2, 1],[-1,-2] ],
      // 3 -> 0
      [ [0,0],[ 1,0],[-2,0],[ 1,-2],[-2, 1] ],
    ],
    ccw: [
      // 0 -> 3
      [ [0,0],[ 2,0],[-1,0],[ 2,-1],[-1, 2] ],
      // 3 -> 2
      [ [0,0],[ 1,0],[-2,0],[ 1, 2],[-2,-1] ],
      // 2 -> 1
      [ [0,0],[-2,0],[ 1,0],[-2, 1],[ 1,-2] ],
      // 1 -> 0
      [ [0,0],[-1,0],[ 2,0],[-1,-2],[ 2, 1] ],
    ],
    rot180: [
      [ [0,0],[1,0],[-1,0],[2,0],[-2,0],[0,-1],[0,-2],[1,-1],[-1,-1] ],
      [ [0,0],[1,0],[-1,0],[2,0],[-2,0],[0,-1],[0,-2],[1,-1],[-1,-1] ],
      [ [0,0],[1,0],[-1,0],[2,0],[-2,0],[0,-1],[0,-2],[1,-1],[-1,-1] ],
      [ [0,0],[1,0],[-1,0],[2,0],[-2,0],[0,-1],[0,-2],[1,-1],[-1,-1] ],
    ],
  },
};

const SHAPES = {
  I: [
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
    [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
    [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
  ],
  J: [
    [[1,0,0],[1,1,1],[0,0,0]],
    [[0,1,1],[0,1,0],[0,1,0]],
    [[0,0,0],[1,1,1],[0,0,1]],
    [[0,1,0],[0,1,0],[1,1,0]],
  ],
  L: [
    [[0,0,1],[1,1,1],[0,0,0]],
    [[0,1,0],[0,1,0],[0,1,1]],
    [[0,0,0],[1,1,1],[1,0,0]],
    [[1,1,0],[0,1,0],[0,1,0]],
  ],
  O: [
    [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
    [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
    [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
    [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
  ],
  S: [
    [[0,1,1],[1,1,0],[0,0,0]],
    [[0,1,0],[0,1,1],[0,0,1]],
    [[0,0,0],[0,1,1],[1,1,0]],
    [[1,0,0],[1,1,0],[0,1,0]],
  ],
  T: [
    [[0,1,0],[1,1,1],[0,0,0]],
    [[0,1,0],[0,1,1],[0,1,0]],
    [[0,0,0],[1,1,1],[0,1,0]],
    [[0,1,0],[1,1,0],[0,1,0]],
  ],
  Z: [
    [[1,1,0],[0,1,1],[0,0,0]],
    [[0,0,1],[0,1,1],[0,1,0]],
    [[0,0,0],[1,1,0],[0,1,1]],
    [[0,1,0],[1,1,0],[1,0,0]],
  ],
};

const COLOR = { I: getCss('--I'), J: getCss('--J'), L: getCss('--L'), O: getCss('--O'), S: getCss('--S'), T: getCss('--T'), Z: getCss('--Z') };

function getCss(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#ccc';
}

function playSound(ctx, freq, duration, type='sine', volume=0.02) {
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(volume, t);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(t + duration/1000);
  } catch {}
}

class Bag7 {
  constructor() { this.bag = []; }
  next() {
    if (this.bag.length === 0) this.bag = shuffle([...PIECE_TYPES]);
    return this.bag.pop();
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

class Matrix {
  constructor(cols, rows) {
    this.cols = cols; this.rows = rows;
    this.cells = Array.from({length: rows}, () => Array(cols).fill(null));
  }
  clone() {
    const m = new Matrix(this.cols, this.rows);
    m.cells = this.cells.map(row => row.slice());
    return m;
  }
  get(x,y) { if (x<0||x>=this.cols||y<0||y>=this.rows) return 'OUT'; return this.cells[y][x]; }
  set(x,y,v) { if (x<0||x>=this.cols||y<0||y>=this.rows) return; this.cells[y][x]=v; }
  rowFilled(y) { return this.cells[y].every(v => v); }
  clearRows(ys) {
    ys.sort((a,b)=>a-b);
    for (const y of ys) this.cells.splice(y,1);
    while (this.cells.length < this.rows) this.cells.unshift(Array(this.cols).fill(null));
  }
}

class Piece {
  constructor(type) {
    this.type = type;
    this.rot = 0; // 0,1,2,3
    this.shape = SHAPES[type];
    this.x = 3; // spawn x
    this.y = -2; // spawn y (above board)
    if (type === 'I') { this.x = 3; this.y = -1; }
    if (type === 'O') { this.x = 4; this.y = -1; }
  }
  blocks(rot=this.rot) {
    const m = this.shape[rot];
    const cells = [];
    for (let r=0;r<m.length;r++) for (let c=0;c<m[r].length;c++) if (m[r][c]) cells.push([this.x+c,this.y+r]);
    return cells;
  }
}

class Game {
  constructor() {
    this.board = new Matrix(BOARD_COLS, BOARD_ROWS);
    this.hold = null; this.holdUsed = false;
    this.queue = []; this.bag = new Bag7();
    this.active = null; this.ghostY = 0;
    this.level = 1; this.lines = 0; this.score = 0;
    this.combo = -1; this.b2b = 0;
    this.tspin = null; // 'T', 'T-mini', or null
    this.dropDistance = 0;
    this.startTime = performance.now();
    this.linesClearedCounter = 0;
    this.lockTimer = null; this.lockStart = 0;
    this.isGameOver = false; this.isPaused = false;
    this.apm = 0; this.actions = 0; this.lastApmUpdate = performance.now();

    for (let i=0;i<5;i++) this.queue.push(this.bag.next());
    this.spawn();
  }
  spawn() {
    const nextType = this.queue.shift();
    this.queue.push(this.bag.next());
    this.active = new Piece(nextType);
    this.holdUsed = false;
    if (!this.valid(this.active)) { this.gameOver(); return; }
    this.updateGhost();
  }
  valid(piece) {
    for (const [x,y] of piece.blocks()) {
      if (y<0) continue;
      if (x<0 || x>=BOARD_COLS || y>=BOARD_ROWS) return false;
      if (this.board.get(x,y)) return false;
    }
    return true;
  }
  move(dx, dy) {
    if (this.isPaused || this.isGameOver) return false;
    const p = new Piece(this.active.type);
    Object.assign(p, this.active);
    p.x += dx; p.y += dy;
    if (this.valid(p)) { this.active = p; this.resetLock(); this.updateGhost(); return true; }
    return false;
  }
  rotate(dir) { // dir: +1 cw, -1 ccw, 2 180
    if (this.isPaused || this.isGameOver) return false;
    const original = this.active;
    const p = new Piece(original.type);
    Object.assign(p, original);

    let newRot;
    if (dir === 2) newRot = (p.rot + 2) & 3; else if (dir === -1) newRot = (p.rot + 3) & 3; else newRot = (p.rot + 1) & 3;

    const isI = p.type === 'I';
    const table = isI ? KICK_TABLE.I : KICK_TABLE.JLTSZ;
    let tests;
    if (dir === 2) {
      tests = table.rot180[p.rot];
    } else if (dir === -1) {
      tests = table.ccw[p.rot];
    } else {
      tests = table.cw[p.rot];
    }

    for (const [kx, ky] of tests) {
      const test = new Piece(p.type);
      Object.assign(test, p);
      test.rot = newRot;
      test.x = p.x + kx;
      test.y = p.y + ky;
      if (this.valid(test)) {
        this.active = test; this.resetLock(); this.noteTSpinAttempt(dir); this.updateGhost(); return true;
      }
    }
    return false;
  }
  noteTSpinAttempt(dir) {
    // Simple T-Spin detection: after rotation, if piece is T and three corners filled around its center.
    if (this.active.type !== 'T') { this.tspin = null; return; }
    const cx = this.active.x + 1; const cy = this.active.y + 1;
    const corners = [ [cx-1,cy-1],[cx+1,cy-1],[cx-1,cy+1],[cx+1,cy+1] ];
    let occupied = 0;
    for (const [x,y] of corners) {
      if (x<0 || x>=BOARD_COLS || y>=BOARD_ROWS) { occupied++; continue; }
      if (y>=0 && this.board.get(x,y)) occupied++;
    }
    // Mini heuristic: if rotated and only two opposite corners occupied
    if (occupied >= 3) this.tspin = 'T';
    else if (dir !== 2 && occupied === 2) this.tspin = 'T-mini';
    else this.tspin = null;
  }
  softDrop() {
    if (this.move(0,1)) { this.score += SCORE_SOFT_DROP; this.dropDistance++; return true; }
    return false;
  }
  hardDrop() {
    if (this.isPaused || this.isGameOver) return;
    let dist = 0;
    while (this.move(0,1)) { dist++; }
    this.score += dist * SCORE_HARD_DROP;
    this.lock();
  }
  holdPiece() {
    if (this.isPaused || this.isGameOver || this.holdUsed) return;
    const currentType = this.active.type;
    if (this.hold) {
      this.active = new Piece(this.hold);
      this.hold = currentType;
    } else {
      this.hold = currentType;
      this.spawn();
      return;
    }
    this.holdUsed = true;
    if (!this.valid(this.active)) { this.gameOver(); return; }
    this.updateGhost();
  }
  lock() {
    for (const [x,y] of this.active.blocks()) {
      if (y>=0 && y<BOARD_ROWS) this.board.set(x,y,this.active.type);
    }
    // Clear lines
    const filled = [];
    for (let y=0;y<BOARD_ROWS;y++) if (this.board.rowFilled(y)) filled.push(y);

    let lines = filled.length; let scored = 0; let tspin = this.tspin;
    if (lines > 0) {
      this.board.clearRows(filled);
      this.lines += lines; this.linesClearedCounter += lines; this.combo++;
      const levelMulti = this.level;
      if (tspin === 'T' || tspin === 'T-mini') {
        const tspinScore = (
          lines === 0 ? (tspin==='T-mini' ? SCORE_TSPIN_MINI : SCORE_TSPIN) :
          lines === 1 ? SCORE_TSPIN_SINGLE :
          lines === 2 ? SCORE_TSPIN_DOUBLE :
          SCORE_TSPIN_TRIPLE
        );
        scored += tspinScore * levelMulti;
        if (lines > 0) this.b2b++;
      } else {
        if (lines === 1) scored += SCORE_SINGLE * levelMulti;
        if (lines === 2) scored += SCORE_DOUBLE * levelMulti;
        if (lines === 3) scored += SCORE_TRIPLE * levelMulti;
        if (lines === 4) { scored += SCORE_TETRIS * levelMulti; this.b2b++; }
      }
      if (this.combo > 0) scored += 50 * this.combo * levelMulti;
      if (this.b2b > 0 && (lines>=4 || tspin)) scored = Math.floor(scored * 1.5);
    } else {
      this.combo = -1; // reset combo
      if (tspin === 'T' || tspin === 'T-mini') {
        scored += (tspin==='T-mini'? SCORE_TSPIN_MINI : SCORE_TSPIN) * this.level;
      }
      this.b2b = 0;
    }

    this.score += scored;
    this.tspin = null; this.dropDistance = 0;

    // level up every 10 lines
    const targetLevel = Math.min(20, Math.floor(this.lines / 10) + 1);
    if (targetLevel !== this.level) this.level = targetLevel;

    this.spawn();
  }
  gravityStep() {
    if (this.isPaused || this.isGameOver) return;
    if (!this.move(0,1)) {
      // start lock delay
      if (!this.lockTimer) {
        this.lockStart = performance.now();
        this.lockTimer = setTimeout(() => { this.lockTimer = null; this.lock(); }, LOCK_DELAY_MS);
      }
    }
  }
  resetLock() {
    if (this.lockTimer) { clearTimeout(this.lockTimer); this.lockTimer = null; }
  }
  updateGhost() {
    const p = new Piece(this.active.type); Object.assign(p, this.active);
    while (true) {
      p.y++;
      if (!this.valid(p)) { this.ghostY = p.y - 1; break; }
    }
  }
  gameOver() {
    this.isGameOver = true; this.isPaused = true; showOverlay('Game Over', 'Press N for new game', 'New Game');
  }
}

// Rendering
const boardCanvas = document.getElementById('board');
const holdCanvas = document.getElementById('hold');
const nextCanvases = Array.from(document.querySelectorAll('canvas.next'));
const ctxBoard = boardCanvas.getContext('2d');
const ctxHold = holdCanvas.getContext('2d');
const ctxNext = nextCanvases.map(c => c.getContext('2d'));

// audio
let audioCtx = null; let muted = false;
function ensureAudio() { if (!audioCtx) try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }

function drawCell(ctx, x, y, color, size) {
  const s = size || CELL_SIZE;
  const px = x * s; const py = y * s;
  ctx.fillStyle = color;
  ctx.fillRect(px+1, py+1, s-2, s-2);
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(px+1, py+1, s-2, Math.floor((s-2)/2));
}

function clearCanvas(ctx, w, h) { ctx.clearRect(0,0,w,h); }

function drawBoard(game) {
  // resize to logical internal pixels
  boardCanvas.width = BOARD_COLS * CELL_SIZE; boardCanvas.height = VISIBLE_ROWS * CELL_SIZE;
  clearCanvas(ctxBoard, boardCanvas.width, boardCanvas.height);

  // grid background
  ctxBoard.fillStyle = 'rgba(255,255,255,0.03)';
  for (let y=0;y<VISIBLE_ROWS;y++) for (let x=0;x<BOARD_COLS;x++) {
    ctxBoard.fillRect(x*CELL_SIZE+0.5, y*CELL_SIZE+0.5, CELL_SIZE-1, CELL_SIZE-1);
  }

  // placed blocks
  for (let y=0;y<BOARD_ROWS;y++) for (let x=0;x<BOARD_COLS;x++) {
    const t = game.board.get(x,y);
    if (t && y>=0) drawCell(ctxBoard, x, y, COLOR[t]);
  }

  // ghost
  ctxBoard.globalAlpha = 0.25;
  for (const [x,y] of game.active.blocks()) {
    if (y<0) continue; drawCell(ctxBoard, x, game.ghostY + (y - game.active.y), COLOR[game.active.type]);
  }
  ctxBoard.globalAlpha = 1;

  // active
  for (const [x,y] of game.active.blocks()) { if (y<0) continue; drawCell(ctxBoard, x, y, COLOR[game.active.type]); }
}

function drawMini(ctx, type, rot=0) {
  const s = 20; const pad = 2; const W = ctx.canvas.width; const H = ctx.canvas.height;
  ctx.clearRect(0,0,W,H);
  if (!type) return;
  const shape = SHAPES[type][rot];
  let w = shape[0].length; let h = shape.length;
  // center
  const totalW = w * s; const totalH = h * s;
  const ox = Math.floor((W - totalW)/2) / s; const oy = Math.floor((H - totalH)/2) / s;
  for (let r=0;r<h;r++) for (let c=0;c<w;c++) if (shape[r][c]) {
    const px = c + ox; const py = r + oy;
    drawCell(ctx, px, py, COLOR[type], s);
  }
}

function drawHold(game) {
  drawMini(ctxHold, game.hold);
}
function drawNext(game) {
  for (let i=0;i<ctxNext.length;i++) drawMini(ctxNext[i], game.queue[i]);
}

// UI controls
const elScore = document.getElementById('score');
const elLevel = document.getElementById('level');
const elLines = document.getElementById('lines');
const elApm = document.getElementById('apm');
const btnNew = document.getElementById('btn-new');
const btnPause = document.getElementById('btn-pause');
const btnAudio = document.getElementById('btn-audio');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg = document.getElementById('overlay-msg');
const overlayAction = document.getElementById('overlay-action');

function showOverlay(title, msg, actionText) {
  overlayTitle.textContent = title; overlayMsg.textContent = msg; overlayAction.textContent = actionText;
  overlay.classList.remove('hidden');
}
function hideOverlay() { overlay.classList.add('hidden'); }

let game = new Game();

// input handling with DAS/ARR-like feel
const keys = new Map();
let leftTimer=null,rightTimer=null,downTimer=null;
const DAS = 120, ARR = 20, SDF = 40; // milliseconds

function startRepeat(key, firstDelay, repeatDelay, fn) {
  stopRepeat(key);
  const t1 = setTimeout(function tick(){ fn(); const t2 = setInterval(fn, repeatDelay); keys.set(key, t2); }, firstDelay);
  keys.set(key, t1);
}
function stopRepeat(key) {
  const t = keys.get(key);
  if (!t) return;
  clearTimeout(t); clearInterval(t);
  keys.delete(key);
}

function updateStats() {
  elScore.textContent = game.score.toLocaleString();
  elLevel.textContent = game.level;
  elLines.textContent = game.lines;
  const now = performance.now();
  if (now - game.lastApmUpdate >= 1000) {
    game.apm = Math.round((game.actions * 60) / ((now - game.startTime)/1000));
    elApm.textContent = game.apm;
    game.lastApmUpdate = now;
  }
}

function tick(timestamp) {
  if (!game.isPaused && !game.isGameOver) {
    // gravity by level
    if (!tick.lastFall) tick.lastFall = timestamp;
    const interval = GRAVITY_LEVELS[Math.min(game.level-1, GRAVITY_LEVELS.length-1)];
    if (timestamp - tick.lastFall >= interval) { game.gravityStep(); tick.lastFall = timestamp; }
    drawBoard(game); drawHold(game); drawNext(game); updateStats();
  }
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

function handleKeyDown(e) {
  if (e.repeat) { e.preventDefault(); return; }
  const k = e.key.toLowerCase();
  if (k === 'n') { newGame(); return; }
  if (k === 'p') { togglePause(); return; }
  if (k === 'm') { toggleMute(); return; }
  if (game.isPaused || game.isGameOver) { e.preventDefault(); return; }

  ensureAudio();
  switch (e.key) {
    case 'ArrowLeft':
      game.move(-1,0); game.actions++; startRepeat('left', DAS, ARR, () => game.move(-1,0)); e.preventDefault(); if (!muted) playSound(audioCtx, 220, 30, 'square'); break;
    case 'ArrowRight':
      game.move(1,0); game.actions++; startRepeat('right', DAS, ARR, () => game.move(1,0)); e.preventDefault(); if (!muted) playSound(audioCtx, 220, 30, 'square'); break;
    case 'ArrowDown':
      game.softDrop(); game.actions++; startRepeat('down', 0, SDF, () => game.softDrop()); e.preventDefault(); if (!muted) playSound(audioCtx, 330, 20, 'sine'); break;
    case 'ArrowUp':
    case 'x': case 'X':
      game.rotate(1); game.actions++; e.preventDefault(); if (!muted) playSound(audioCtx, 550, 30, 'triangle'); break;
    case 'z': case 'Z':
      game.rotate(-1); game.actions++; e.preventDefault(); if (!muted) playSound(audioCtx, 500, 30, 'triangle'); break;
    case 'a': case 'A':
      game.rotate(2); game.actions++; e.preventDefault(); if (!muted) playSound(audioCtx, 480, 30, 'triangle'); break;
    case 'c': case 'C':
      game.holdPiece(); game.actions++; e.preventDefault(); if (!muted) playSound(audioCtx, 180, 50, 'sawtooth'); break;
    case ' ': // space
      game.hardDrop(); game.actions++; e.preventDefault(); if (!muted) playSound(audioCtx, 160, 80, 'square'); break;
  }
}
function handleKeyUp(e) {
  switch (e.key) {
    case 'ArrowLeft': stopRepeat('left'); break;
    case 'ArrowRight': stopRepeat('right'); break;
    case 'ArrowDown': stopRepeat('down'); break;
  }
}

function newGame() {
  game = new Game(); hideOverlay(); tick.lastFall = 0;
}
function togglePause() {
  if (game.isGameOver) return;
  game.isPaused = !game.isPaused;
  if (game.isPaused) showOverlay('Paused', 'Press P to resume', 'Resume');
  else hideOverlay();
}
function toggleMute() {
  muted = !muted; btnAudio.textContent = muted ? '🔈' : '🔊';
}

btnNew.addEventListener('click', newGame);
btnPause.addEventListener('click', togglePause);
btnAudio.addEventListener('click', toggleMute);
overlayAction.addEventListener('click', () => { if (game.isGameOver) newGame(); else togglePause(); });

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

// initial draw
drawBoard(game); drawHold(game); drawNext(game); updateStats();
