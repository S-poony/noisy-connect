// src/game.ts
var MAX_MOVES = 20;
function gaussRandom(mean, sigma) {
  let u1;
  let u2;
  do {
    u1 = Math.random();
  } while (u1 === 0);
  u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + sigma * z;
}
function uniform(a, b) {
  return Math.random() * (b - a) + a;
}
function createGame() {
  return {
    a: uniform(4, 10),
    b: uniform(0.1, 2),
    sigmaEta: uniform(0, 2),
    sigmaEps: uniform(0, 2),
    moves: [],
    moveCount: 0,
    claimed: false
  };
}
function submitMove(state, x) {
  const { a, b, sigmaEta, sigmaEps } = state;
  const eta = gaussRandom(0, sigmaEta);
  const trueX = x + eta;
  const trueF = a * Math.sin(b * trueX);
  const trueY = trueF;
  const epsilon = gaussRandom(0, sigmaEps);
  const observed = trueF + epsilon;
  const record = { x, trueX, observed, trueY };
  const newState = {
    ...state,
    moves: [...state.moves, record],
    moveCount: state.moveCount + 1
  };
  return { observed, trueY, newState };
}
function checkWin(state) {
  const k = 4;
  const W = 4;
  const d = 0.5;
  const sortedMoves = [...state.moves].sort((a, b) => a.trueY - b.trueY);
  let bestValid = [];
  let bestDiscarded = [];
  for (let i = 0;i < sortedMoves.length; i++) {
    const subset = [sortedMoves[i]];
    const discarded = [];
    let currentY = sortedMoves[i].trueY;
    for (let j = i + 1;j < sortedMoves.length; j++) {
      if (sortedMoves[j].trueY - sortedMoves[i].trueY > W) {
        break;
      }
      if (sortedMoves[j].trueY - currentY >= d) {
        subset.push(sortedMoves[j]);
        currentY = sortedMoves[j].trueY;
        if (subset.length === k) {
          return { isWin: true, valid: subset, discarded };
        }
      } else {
        discarded.push(sortedMoves[j]);
      }
    }
    const isBetter = subset.length > bestValid.length || subset.length === bestValid.length && discarded.length > bestDiscarded.length;
    if (isBetter) {
      bestValid = subset;
      bestDiscarded = discarded;
    }
  }
  return { isWin: false, valid: bestValid, discarded: bestDiscarded };
}

// src/main.ts
var canvas = document.getElementById("graph");
var ctx = canvas.getContext("2d");
var inputX = document.getElementById("input-x");
var btnDrop = document.getElementById("btn-drop");
var btnClaim = document.getElementById("btn-claim");
var btnRules = document.getElementById("btn-rules");
var movesValue = document.getElementById("moves-value");
var statusMsg = document.getElementById("status-msg");
var logList = document.getElementById("log");
var controls = document.getElementById("controls");
var logSection = document.getElementById("log-section");
var gameOverPanel = document.getElementById("game-over-panel");
var gameOverTitle = document.getElementById("game-over-title");
var gameOverBody = document.getElementById("game-over-body");
var btnGameOverNew = document.getElementById("btn-game-over-new");
var revealLegend = document.querySelectorAll(".reveal-only");
var rangeMin = document.getElementById("range-min");
var rangeMax = document.getElementById("range-max");
var rangeSelection = document.getElementById("range-selection");
var valMin = document.getElementById("val-min");
var valMax = document.getElementById("val-max");
var modalOverlay = document.getElementById("modal-overlay");
var modalContent = document.getElementById("modal-content");
var btnCloseModal = document.getElementById("btn-close-modal");
var state = createGame();
var viewXMin = parseFloat(rangeMin.value);
var viewXMax = parseFloat(rangeMax.value);
var PADDING = { top: 20, right: 20, bottom: 36, left: 48 };
var DOT_R_NOISY = 4;
var DOT_R_TRUE = 5;
var COLOR_NOISY = "#aaaaaa";
var COLOR_TRUE = "#2563eb";
var COLOR_WIN = "#10b981";
var COLOR_DISCARDED = "#ef4444";
var COLOR_AXIS = "#e5e7eb";
var COLOR_TICK = "#999999";
var COLOR_ZERO = "#cccccc";
var FONT_TICK = "11px 'JetBrains Mono', monospace";
function toPixel(x, y, xMin, xMax, yMin, yMax, w, h) {
  const px = PADDING.left + (x - xMin) / (xMax - xMin) * w;
  const py = PADDING.top + (yMax - y) / (yMax - yMin) * h;
  return [px, py];
}
function niceStep(range, targetTicks = 6) {
  if (range <= 0.000000000001 || isNaN(range))
    return 1;
  const rough = range / targetTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  if (pow === 0 || !isFinite(pow))
    return 1;
  const norm = rough / pow;
  if (norm <= 1)
    return pow;
  if (norm <= 2)
    return 2 * pow;
  if (norm <= 5)
    return 5 * pow;
  return 10 * pow;
}
function expand(min, max, margin = 0.12) {
  const span = max - min || 2;
  return [min - span * margin, max + span * margin];
}
function drawGraph(revealMoves = null, winResult = null) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const cssW = rect.width;
  const cssH = rect.height;
  if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.scale(dpr, dpr);
  }
  const W = cssW - PADDING.left - PADDING.right;
  const H = cssH - PADDING.top - PADDING.bottom;
  ctx.clearRect(0, 0, cssW, cssH);
  const noisyMoves = state.moves;
  const allX = noisyMoves.map((m) => m.x);
  const allY = noisyMoves.map((m) => m.observed);
  if (revealMoves) {
    revealMoves.forEach((m) => {
      allX.push(m.trueX);
      allY.push(m.trueY);
    });
  }
  const xMin = viewXMin;
  const xMax = viewXMax;
  let [yMin, yMax] = allY.length ? expand(Math.min(...allY), Math.max(...allY)) : [-12, 12];
  yMin = Math.min(yMin, 0);
  yMax = Math.max(yMax, 0);
  ctx.save();
  ctx.font = FONT_TICK;
  ctx.fillStyle = COLOR_TICK;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const yStep = niceStep(yMax - yMin);
  const yStart = Math.ceil(yMin / yStep) * yStep;
  if (yStep > 0 && isFinite(yStep)) {
    for (let yv = yStart;yv <= yMax + 0.000000001; yv += yStep) {
      const [, py] = toPixel(0, yv, xMin, xMax, yMin, yMax, W, H);
      const isZero = Math.abs(yv) < 0.000000001;
      ctx.strokeStyle = isZero ? COLOR_ZERO : COLOR_AXIS;
      ctx.lineWidth = isZero ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(PADDING.left, py);
      ctx.lineTo(PADDING.left + W, py);
      ctx.stroke();
      ctx.fillText(Number.isInteger(yv) ? String(yv) : yv.toFixed(1), PADDING.left - 6, py);
    }
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const xStep = niceStep(xMax - xMin);
  const xStart = Math.ceil(xMin / xStep) * xStep;
  if (xStep > 0 && isFinite(xStep)) {
    for (let xv = xStart;xv <= xMax + 0.000000001; xv += xStep) {
      const [px] = toPixel(xv, 0, xMin, xMax, yMin, yMax, W, H);
      const isZero = Math.abs(xv) < 0.000000001;
      ctx.strokeStyle = isZero ? COLOR_ZERO : COLOR_AXIS;
      ctx.lineWidth = isZero ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(px, PADDING.top);
      ctx.lineTo(px, PADDING.top + H);
      ctx.stroke();
      ctx.fillStyle = COLOR_TICK;
      ctx.fillText(Number.isInteger(xv) ? String(xv) : xv.toFixed(1), px, PADDING.top + H + 6);
    }
  }
  ctx.restore();
  noisyMoves.forEach((m) => {
    const [px, py] = toPixel(m.x, m.observed, xMin, xMax, yMin, yMax, W, H);
    ctx.beginPath();
    ctx.arc(px, py, DOT_R_NOISY, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_NOISY;
    ctx.fill();
  });
  if (revealMoves) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = COLOR_TRUE;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.25;
    ctx.lineJoin = "round";
    for (let i = 0;i <= W; i++) {
      const px = PADDING.left + i;
      const x = xMin + i / W * (xMax - xMin);
      const y = state.a * Math.sin(state.b * x);
      const [, py] = toPixel(x, y, xMin, xMax, yMin, yMax, W, H);
      if (i === 0)
        ctx.moveTo(px, py);
      else
        ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
  }
  if (revealMoves) {
    const drawDot = (m, type) => {
      const isWin = type === "winning";
      const isDiscarded = type === "discarded";
      let color = COLOR_TRUE;
      if (isWin)
        color = COLOR_WIN;
      else if (isDiscarded)
        color = COLOR_DISCARDED;
      const [px, py] = toPixel(m.trueX, m.trueY, xMin, xMax, yMin, yMax, W, H);
      const [, yZero] = toPixel(m.trueX, 0, xMin, xMax, yMin, yMax, W, H);
      ctx.beginPath();
      ctx.moveTo(px, yZero);
      ctx.lineTo(px, py);
      ctx.strokeStyle = color;
      ctx.lineWidth = isWin ? 2 : 1;
      ctx.globalAlpha = isWin ? 0.8 : isDiscarded ? 0.6 : 0.4;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(px, py, isWin ? DOT_R_TRUE + 1 : DOT_R_TRUE, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    };
    revealMoves.forEach((m) => {
      const isWin = winResult && winResult.isWin && winResult.valid.includes(m);
      const isDiscarded = winResult && winResult.discarded.includes(m);
      if (!isWin && !isDiscarded)
        drawDot(m, "normal");
    });
    revealMoves.forEach((m) => {
      const isDiscarded = winResult && winResult.discarded.includes(m);
      if (isDiscarded)
        drawDot(m, "discarded");
    });
    revealMoves.forEach((m) => {
      const isWin = winResult && winResult.isWin && winResult.valid.includes(m);
      if (isWin)
        drawDot(m, "winning");
    });
  }
}
function appendLog(text) {
  const li = document.createElement("li");
  li.textContent = text;
  logList.appendChild(li);
  logList.parentElement.scrollTop = logList.parentElement.scrollHeight;
}
function clearLog() {
  logList.innerHTML = "";
}
function setControlsDisabled(disabled) {
  inputX.disabled = disabled;
  btnDrop.disabled = disabled;
  btnClaim.disabled = disabled;
}
function updateMovesDisplay() {
  movesValue.textContent = String(MAX_MOVES - state.moveCount);
}
function reveal(claimed) {
  setControlsDisabled(true);
  const winResult = checkWin(state);
  const win = winResult.isWin;
  revealLegend.forEach((el) => el.classList.remove("hidden"));
  const trueYs = state.moves.map((m) => m.trueY).sort((a, b) => a - b);
  const body = [
    `Secret:  a = ${state.a.toFixed(2)},  b = ${state.b.toFixed(2)}`,
    `Noise:   σ_η = ${state.sigmaEta.toFixed(2)},  σ_ε = ${state.sigmaEps.toFixed(2)}`,
    `True Y values (sorted): [${trueYs.map((y) => y.toFixed(2)).join(", ")}]`,
    `Window Packing (k=4, W=4, d=0.5): ${win ? "YES" : "NO"}`,
    "",
    !claimed ? "You ran out of moves without claiming. You lose." : win ? "You claimed and were RIGHT — you win!" : "You claimed but were WRONG — you lose."
  ].join(`
`);
  gameOverTitle.textContent = win && claimed ? "You Win!" : "Game Over";
  gameOverTitle.className = win && claimed ? "win" : "lose";
  gameOverBody.textContent = body;
  controls.classList.add("hidden");
  logSection.classList.add("hidden");
  gameOverPanel.classList.remove("hidden");
  drawGraph(state.moves, winResult);
}
function startNewGame() {
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
var rulesLoaded = false;
async function openRules() {
  modalOverlay.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  if (!rulesLoaded) {
    try {
      const resp = await fetch("./public/noisy_connect_rules.html");
      if (!resp.ok)
        throw new Error("Failed to load rules");
      const html = await resp.text();
      modalContent.innerHTML = html;
      rulesLoaded = true;
    } catch (err) {
      modalContent.innerHTML = `<div class="error">Error loading rules: ${err}</div>`;
    }
  }
}
function closeRules() {
  modalOverlay.classList.add("hidden");
  document.body.style.overflow = "";
}
function dropPiece() {
  const raw = inputX.value.trim();
  const x = parseFloat(raw);
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
btnDrop.addEventListener("click", dropPiece);
btnClaim.addEventListener("click", () => reveal(true));
btnRules.addEventListener("click", openRules);
modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay)
    closeRules();
});
btnCloseModal.addEventListener("click", closeRules);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalOverlay.classList.contains("hidden")) {
    closeRules();
  }
});
btnGameOverNew.addEventListener("click", startNewGame);
inputX.addEventListener("keydown", (e) => {
  if (e.key === "Enter")
    dropPiece();
});
function updateSliderUI() {
  const min = parseFloat(rangeMin.value);
  const max = parseFloat(rangeMax.value);
  if (min >= max) {}
  viewXMin = min;
  viewXMax = max;
  valMin.textContent = min.toFixed(1);
  valMax.textContent = max.toFixed(1);
  const totalRange = parseFloat(rangeMax.max) - parseFloat(rangeMax.min);
  const left = (min - parseFloat(rangeMin.min)) / totalRange * 100;
  const right = (max - parseFloat(rangeMin.min)) / totalRange * 100;
  rangeSelection.style.left = `${left}%`;
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
updateSliderUI();
var resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    if (entry.target === canvas) {
      const isRevealed = !gameOverPanel.classList.contains("hidden") || btnDrop.disabled;
      drawGraph(isRevealed ? state.moves : null, isRevealed ? checkWin(state) : null);
    }
  }
});
resizeObserver.observe(canvas);
startNewGame();
