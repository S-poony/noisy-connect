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
  type WinResult,
} from "./game";

// ── DOM refs ────────────────────────────────────────────────────────────────

const canvas      = document.getElementById("graph")       as HTMLCanvasElement;
const ctx         = canvas.getContext("2d")!;
const inputX      = document.getElementById("input-x")     as HTMLInputElement;
const btnDrop     = document.getElementById("btn-drop")     as HTMLButtonElement;
const btnClaim    = document.getElementById("btn-claim")    as HTMLButtonElement;
const btnRules    = document.getElementById("btn-rules")    as HTMLButtonElement;
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
const rangeMin     = document.getElementById("range-min")     as HTMLInputElement;
const rangeMax     = document.getElementById("range-max")     as HTMLInputElement;
const rangeSelection = document.getElementById("range-selection") as HTMLElement;
const valMin       = document.getElementById("val-min")       as HTMLElement;
const valMax       = document.getElementById("val-max")       as HTMLElement;
const modalOverlay = document.getElementById("modal-overlay") as HTMLElement;
const modalContent = document.getElementById("modal-content") as HTMLElement;
const btnCloseModal= document.getElementById("btn-close-modal") as HTMLButtonElement;

// ── State ────────────────────────────────────────────────────────────────────

let state: GameState = createGame();
let viewXMin = parseFloat(rangeMin.value);
let viewXMax = parseFloat(rangeMax.value);

// ── Graph constants ──────────────────────────────────────────────────────────

const PADDING = { top: 20, right: 20, bottom: 36, left: 48 };
const DOT_R_NOISY = 4;
const DOT_R_TRUE  = 5;

const COLOR_NOISY  = "#aaaaaa";
const COLOR_TRUE   = "#2563eb";
const COLOR_WIN    = "#10b981"; // emerald-500
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
  if (range <= 1e-12 || isNaN(range)) return 1;
  const rough = range / targetTicks;
  const pow   = Math.pow(10, Math.floor(Math.log10(rough)));
  if (pow === 0 || !isFinite(pow)) return 1;
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

function drawGraph(revealMoves: MoveRecord[] | null = null, winResult: WinResult | null = null): void {
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
      allX.push(m.trueX);
      allY.push(m.trueY);
    });
  }

  // Use viewport from sliders
  const xMin = viewXMin;
  const xMax = viewXMax;

  // Y range still auto-calculated or fixed
  let [yMin, yMax] = allY.length ? expand(Math.min(...allY), Math.max(...allY)) : [-12, 12];
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
  if (yStep > 0 && isFinite(yStep)) {
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
  }

  // X ticks
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  const xStep  = niceStep(xMax - xMin);
  const xStart = Math.ceil(xMin / xStep) * xStep;
  if (xStep > 0 && isFinite(xStep)) {
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

  // ── Secret Curve (reveal only) ──────────────────────────────────────────
  if (revealMoves) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = COLOR_TRUE;
    ctx.lineWidth   = 2;
    ctx.globalAlpha = 0.25;
    ctx.lineJoin    = "round";

    for (let i = 0; i <= W; i++) {
      const px = PADDING.left + i;
      // Map px -> x data coord
      const x  = xMin + (i / W) * (xMax - xMin);
      const y  = state.a * Math.sin(state.b * x);
      const [, py] = toPixel(x, y, xMin, xMax, yMin, yMax, W, H);

      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ── True placement dots (reveal only) ──────────────────────────────────────
  if (revealMoves) {
    const drawDot = (m: MoveRecord, type: 'winning' | 'normal') => {
      const isWin = type === 'winning';

      let color = COLOR_TRUE;
      if (isWin) color = COLOR_WIN;

      const [px, py]   = toPixel(m.trueX, m.trueY, xMin, xMax, yMin, yMax, W, H);
      const [xZero]    = toPixel(0,       m.trueY, xMin, xMax, yMin, yMax, W, H);

      // Thin horizontal line from y-axis to dot
      ctx.beginPath();
      ctx.moveTo(xZero, py);
      ctx.lineTo(px, py);
      ctx.strokeStyle = color;
      ctx.lineWidth   = isWin ? 2 : 1;
      ctx.globalAlpha = isWin ? 0.8 : 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Dot
      ctx.beginPath();
      ctx.arc(px, py, isWin ? DOT_R_TRUE + 1 : DOT_R_TRUE, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };

    // Draw non-winning dots first
    revealMoves.forEach((m) => {
      const isWin = winResult && winResult.isWin && winResult.valid.includes(m);
      if (!isWin) drawDot(m, 'normal');
    });

    // Draw winning dots on top
    revealMoves.forEach((m) => {
      const isWin = winResult && winResult.isWin && winResult.valid.includes(m);
      if (isWin) drawDot(m, 'winning');
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

  const winResult = checkWin(state);
  const win = winResult.isWin;

  // Show legend item for true points
  revealLegend.forEach((el) => el.classList.remove("hidden"));

  // Build content
  const trueYs = state.moves.map((m) => m.trueY).sort((a, b) => a - b);
  const body = [
    `Secret:  a = ${state.a.toFixed(2)},  b = ${state.b.toFixed(2)}`,
    `Noise:   σ_η = ${state.sigmaEta.toFixed(2)},  σ_ε = ${state.sigmaEps.toFixed(2)}`,
    `True Y values (sorted): [${trueYs.map((y) => y.toFixed(2)).join(", ")}]`,
    `Window Packing (k=4, Wy=1.0, Dx=6.0): ${win ? "YES" : "NO"}`,
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
  drawGraph(state.moves, winResult);
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

// ── Rules Modal ─────────────────────────────────────────────────────────────

let rulesLoaded = false;

async function openRules(): Promise<void> {
  modalOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden"; // Prevent scroll

  if (!rulesLoaded) {
    try {
      const resp = await fetch("./public/noisy_connect_rules.html");
      if (!resp.ok) throw new Error("Failed to load rules");
      const html = await resp.text();
      modalContent.innerHTML = html;
      rulesLoaded = true;
    } catch (err) {
      modalContent.innerHTML = `<div class="error">Error loading rules: ${err}</div>`;
    }
  }
}

function closeRules(): void {
  modalOverlay.classList.add("hidden");
  document.body.style.overflow = "";
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

btnRules.addEventListener("click", openRules);

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeRules();
});

btnCloseModal.addEventListener("click", closeRules);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalOverlay.classList.contains("hidden")) {
    closeRules();
  }
});

btnGameOverNew.addEventListener("click", startNewGame);

inputX.addEventListener("keydown", (e) => {
  if (e.key === "Enter") dropPiece();
});

// ── Slider logic ────────────────────────────────────────────────────────────

function updateSliderUI(): void {
  const min = parseFloat(rangeMin.value);
  const max = parseFloat(rangeMax.value);

  // Keep min < max
  if (min >= max) {
    // If min was changed, push max forward. If max was changed, push min back.
    // We can check which one was focused, but simpler is just to prevent crossover.
  }

  viewXMin = min;
  viewXMax = max;

  valMin.textContent = min.toFixed(1);
  valMax.textContent = max.toFixed(1);

  // Update track selection highlight
  const totalRange = parseFloat(rangeMax.max) - parseFloat(rangeMax.min);
  const left = ((min - parseFloat(rangeMin.min)) / totalRange) * 100;
  const right = ((max - parseFloat(rangeMin.min)) / totalRange) * 100;
  rangeSelection.style.left  = `${left}%`;
  rangeSelection.style.width = `${right - left}%`;

  const isRevealed = !gameOverPanel.classList.contains("hidden");
  drawGraph(isRevealed ? state.moves : null, isRevealed ? checkWin(state) : null);
}

rangeMin.addEventListener("input", () => {
  rangeMin.style.zIndex = "3";
  rangeMax.style.zIndex = "2";
  if (parseFloat(rangeMin.value) >= parseFloat(rangeMax.value)) {
    rangeMin.value = String(parseFloat(rangeMax.value) - 0.1);
  }
  updateSliderUI();
});

rangeMax.addEventListener("input", () => {
  rangeMax.style.zIndex = "3";
  rangeMin.style.zIndex = "2";
  if (parseFloat(rangeMax.value) <= parseFloat(rangeMin.value)) {
    rangeMax.value = String(parseFloat(rangeMin.value) + 0.1);
  }
  updateSliderUI();
});

// Sync UI on init
updateSliderUI();

// Redraw on resize via ResizeObserver
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    if (entry.target === canvas) {
      // Check if revealed
      const isRevealed = !gameOverPanel.classList.contains("hidden") || btnDrop.disabled;
      drawGraph(isRevealed ? state.moves : null, isRevealed ? checkWin(state) : null);
    }
  }
});
resizeObserver.observe(canvas);

// ── Init ─────────────────────────────────────────────────────────────────────

startNewGame();
