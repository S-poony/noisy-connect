// ---------------------------------------------------------------------------
// main.ts — Browser UI controller for Noisy Connect
// ---------------------------------------------------------------------------

import {
  MAX_MOVES,
  createGame,
  submitMove,
  checkWin,
  type GameState,
  type MoveRecord,
} from "./game";

// ── DOM refs ────────────────────────────────────────────────────────────────

const canvas      = document.getElementById("graph")       as HTMLCanvasElement;
const ctx         = canvas.getContext("2d")!;
const inputX      = document.getElementById("input-x")     as HTMLInputElement;
const btnDrop     = document.getElementById("btn-drop")     as HTMLButtonElement;
const btnClaim    = document.getElementById("btn-claim")    as HTMLButtonElement;
const btnNewGame  = document.getElementById("btn-new-game") as HTMLButtonElement;
const movesValue  = document.getElementById("moves-value")  as HTMLElement;
const statusMsg   = document.getElementById("status-msg")   as HTMLElement;
const logList     = document.getElementById("log")          as HTMLUListElement;
const controls    = document.getElementById("controls")     as HTMLElement;
const logSection  = document.getElementById("log-section")  as HTMLElement;
const gameOverPanel = document.getElementById("game-over-panel") as HTMLElement;
const gameOverTitle = document.getElementById("game-over-title") as HTMLElement;
const gameOverBody  = document.getElementById("game-over-body")  as HTMLElement;
const btnGameOverNew= document.getElementById("btn-game-over-new") as HTMLButtonElement;
const revealLegend = document.querySelectorAll<HTMLElement>(".reveal-only");

// ── State ────────────────────────────────────────────────────────────────────

let state: GameState = createGame();

// ── Graph constants ──────────────────────────────────────────────────────────

const PADDING = { top: 20, right: 20, bottom: 36, left: 48 };
const DOT_R_NOISY = 4;
const DOT_R_TRUE  = 5;

const COLOR_NOISY  = "#aaaaaa";
const COLOR_TRUE   = "#2563eb";
const COLOR_AXIS   = "#e5e7eb";
const COLOR_TICK   = "#999999";
const COLOR_ZERO   = "#cccccc";
const FONT_TICK    = "11px 'JetBrains Mono', monospace";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Map data coords → canvas pixel coords. */
function toPixel(
  x: number, y: number,
  xMin: number, xMax: number,
  yMin: number, yMax: number,
  w: number, h: number
): [number, number] {
  const px = PADDING.left + ((x - xMin) / (xMax - xMin)) * w;
  const py = PADDING.top  + ((yMax - y) / (yMax - yMin)) * h;
  return [px, py];
}

/** Nice tick step given a range and desired tick count. */
function niceStep(range: number, targetTicks = 6): number {
  const rough = range / targetTicks;
  const pow   = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm  = rough / pow;
  if (norm <= 1)   return pow;
  if (norm <= 2)   return 2 * pow;
  if (norm <= 5)   return 5 * pow;
  return 10 * pow;
}

/** Expand a [min, max] range by a fractional margin. */
function expand(min: number, max: number, margin = 0.12): [number, number] {
  const span = max - min || 2;
  return [min - span * margin, max + span * margin];
}

// ── Canvas drawing ───────────────────────────────────────────────────────────

function drawGraph(revealMoves: MoveRecord[] | null = null): void {
  // DPR-aware sizing
  const dpr  = window.devicePixelRatio || 1;
  const rect  = canvas.getBoundingClientRect();
  const cssW  = rect.width;
  const cssH  = rect.height;

  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.scale(dpr, dpr);
  }

  const W = cssW - PADDING.left - PADDING.right;
  const H = cssH - PADDING.top  - PADDING.bottom;

  ctx.clearRect(0, 0, cssW, cssH);

  // Gather all points to determine axis range
  const noisyMoves = state.moves;
  const allX: number[] = noisyMoves.map((m) => m.x);
  const allY: number[] = noisyMoves.map((m) => m.observed);

  if (revealMoves) {
    revealMoves.forEach((m) => {
      allX.push(m.x);
      allY.push(m.col);
    });
  }

  // Default range when no data yet
  let [xMin, xMax] = allX.length ? expand(Math.min(...allX), Math.max(...allX)) : [-5, 5];
  let [yMin, yMax] = allY.length ? expand(Math.min(...allY), Math.max(...allY)) : [-12, 12];

  // Ensure 0 is always on screen
  xMin = Math.min(xMin, 0);
  xMax = Math.max(xMax, 0);
  yMin = Math.min(yMin, 0);
  yMax = Math.max(yMax, 0);

  // ── Grid / axes ────────────────────────────────────────────────────────────
  ctx.save();
  ctx.font      = FONT_TICK;
  ctx.fillStyle = COLOR_TICK;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  // Y ticks
  const yStep = niceStep(yMax - yMin);
  const yStart = Math.ceil(yMin / yStep) * yStep;
  for (let yv = yStart; yv <= yMax + 1e-9; yv += yStep) {
    const [, py] = toPixel(0, yv, xMin, xMax, yMin, yMax, W, H);
    const isZero = Math.abs(yv) < 1e-9;
    ctx.strokeStyle = isZero ? COLOR_ZERO : COLOR_AXIS;
    ctx.lineWidth   = isZero ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(PADDING.left, py);
    ctx.lineTo(PADDING.left + W, py);
    ctx.stroke();
    ctx.fillText(
      Number.isInteger(yv) ? String(yv) : yv.toFixed(1),
      PADDING.left - 6, py
    );
  }

  // X ticks
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  const xStep  = niceStep(xMax - xMin);
  const xStart = Math.ceil(xMin / xStep) * xStep;
  for (let xv = xStart; xv <= xMax + 1e-9; xv += xStep) {
    const [px] = toPixel(xv, 0, xMin, xMax, yMin, yMax, W, H);
    const isZero = Math.abs(xv) < 1e-9;
    ctx.strokeStyle = isZero ? COLOR_ZERO : COLOR_AXIS;
    ctx.lineWidth   = isZero ? 1.5 : 1;
    ctx.beginPath();
    ctx.moveTo(px, PADDING.top);
    ctx.lineTo(px, PADDING.top + H);
    ctx.stroke();
    ctx.fillStyle = COLOR_TICK;
    ctx.fillText(
      Number.isInteger(xv) ? String(xv) : xv.toFixed(1),
      px, PADDING.top + H + 6
    );
  }

  ctx.restore();

  // ── Noisy dots ─────────────────────────────────────────────────────────────
  noisyMoves.forEach((m) => {
    const [px, py] = toPixel(m.x, m.observed, xMin, xMax, yMin, yMax, W, H);
    ctx.beginPath();
    ctx.arc(px, py, DOT_R_NOISY, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_NOISY;
    ctx.fill();
  });

  // ── True placement dots (reveal only) ──────────────────────────────────────
  if (revealMoves) {
    revealMoves.forEach((m) => {
      const [px, py]   = toPixel(m.x, m.col, xMin, xMax, yMin, yMax, W, H);
      const [, yZero]  = toPixel(m.x, 0,     xMin, xMax, yMin, yMax, W, H);

      // Thin vertical line from x-axis to dot
      ctx.beginPath();
      ctx.moveTo(px, yZero);
      ctx.lineTo(px, py);
      ctx.strokeStyle = COLOR_TRUE;
      ctx.lineWidth   = 1;
      ctx.globalAlpha = 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Dot
      ctx.beginPath();
      ctx.arc(px, py, DOT_R_TRUE, 0, Math.PI * 2);
      ctx.fillStyle = COLOR_TRUE;
      ctx.fill();
    });
  }
}

// ── Log ──────────────────────────────────────────────────────────────────────

function appendLog(text: string): void {
  const li = document.createElement("li");
  li.textContent = text;
  logList.appendChild(li);
  logList.parentElement!.scrollTop = logList.parentElement!.scrollHeight;
}

function clearLog(): void {
  logList.innerHTML = "";
}

// ── UI state helpers ─────────────────────────────────────────────────────────

function setControlsDisabled(disabled: boolean): void {
  inputX.disabled  = disabled;
  btnDrop.disabled = disabled;
  btnClaim.disabled = disabled;
}

function updateMovesDisplay(): void {
  movesValue.textContent = String(MAX_MOVES - state.moveCount);
}

// ── Reveal ───────────────────────────────────────────────────────────────────

function reveal(claimed: boolean): void {
  setControlsDisabled(true);

  const win = checkWin(state);

  // Show legend item for true points
  revealLegend.forEach((el) => el.classList.remove("hidden"));

  // Build content
  const cols = state.moves.map((m) => m.col).sort((a, b) => a - b);
  const body = [
    `Secret:  a = ${state.a.toFixed(2)},  b = ${state.b.toFixed(2)}`,
    `Noise:   σ_η = ${state.sigmaEta.toFixed(2)},  σ_ε = ${state.sigmaEps.toFixed(2)}`,
    `True columns (sorted): [${cols.join(", ")}]`,
    `4-in-a-row: ${win ? "YES" : "NO"}`,
    "",
    !claimed
      ? "You ran out of moves without claiming. You lose."
      : win
      ? "You claimed and were RIGHT — you win!"
      : "You claimed but were WRONG — you lose.",
  ].join("\n");

  gameOverTitle.textContent = win && claimed ? "You Win!" : "Game Over";
  gameOverTitle.className   = win && claimed ? "win" : "lose";
  gameOverBody.textContent  = body;
  controls.classList.add("hidden");
  logSection.classList.add("hidden");
  gameOverPanel.classList.remove("hidden");

  // Redraw now that layout has shifted
  drawGraph(state.moves);
}

// ── New game ─────────────────────────────────────────────────────────────────

function startNewGame(): void {
  state = createGame();
  clearLog();
  gameOverPanel.classList.add("hidden");
  controls.classList.remove("hidden");
  logSection.classList.remove("hidden");
  revealLegend.forEach((el) => el.classList.add("hidden"));
  setControlsDisabled(false);
  updateMovesDisplay();
  statusMsg.textContent = "";
  inputX.value = "";
  inputX.focus();
  drawGraph();
}

// ── Drop piece ───────────────────────────────────────────────────────────────

function dropPiece(): void {
  const raw = inputX.value.trim();
  const x   = parseFloat(raw);

  if (raw === "" || isNaN(x)) {
    statusMsg.textContent = "Enter a valid number.";
    inputX.focus();
    return;
  }
  statusMsg.textContent = "";

  const { observed, newState } = submitMove(state, x);
  state = newState;

  appendLog(`move ${state.moveCount}  x = ${x}  →  y ≈ ${observed.toFixed(2)}`);
  updateMovesDisplay();
  drawGraph();

  inputX.value = "";
  inputX.focus();

  if (state.moveCount >= MAX_MOVES) {
    reveal(false);
  }
}

// ── Event wiring ─────────────────────────────────────────────────────────────

btnDrop.addEventListener("click", dropPiece);

btnClaim.addEventListener("click", () => reveal(true));

btnNewGame.addEventListener("click", startNewGame);

btnGameOverNew.addEventListener("click", startNewGame);

inputX.addEventListener("keydown", (e) => {
  if (e.key === "Enter") dropPiece();
});

// Redraw on resize (debounced)
// Redraw on resize via ResizeObserver (more reliable for layout shifts)
const resizeObserver = new ResizeObserver(() => {
  // Check if revealed
  const isRevealed = !gameOverPanel.classList.contains("hidden") || btnDrop.disabled;
  drawGraph(isRevealed ? state.moves : null);
});
resizeObserver.observe(canvas);

// ── Init ─────────────────────────────────────────────────────────────────────

startNewGame();
