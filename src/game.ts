// ---------------------------------------------------------------------------
// game.ts — Pure game logic (no I/O, no DOM)
// Ported from noisyconnect-sin.py; see walkthrough.md for parity table.
// ---------------------------------------------------------------------------

export const MAX_MOVES = 20;

// ---------- helpers ---------------------------------------------------------

/** Box-Muller transform — equivalent to Python's random.gauss(mu, sigma). */
export function gaussRandom(mean: number, sigma: number): number {
  let u1: number;
  let u2: number;
  do {
    u1 = Math.random();
  } while (u1 === 0); // avoid log(0)
  u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + sigma * z;
}

/** Equivalent to Python's random.uniform(a, b). */
export function uniform(a: number, b: number): number {
  return Math.random() * (b - a) + a;
}

// ---------- state -----------------------------------------------------------

export interface MoveRecord {
  /** Raw x value typed by the player. */
  x: number;
  /** Jittered x value: x + eta. Used for reveal. */
  trueX: number;
  /** Noisy readout shown to the player: trueF + epsilon. */
  observed: number;
  /** True y value: a * sin(b * (x + eta)). Hidden until reveal. */
  trueY: number;
}

export interface GameState {
  /** Amplitude — secret. */
  a: number;
  /** Frequency — secret. */
  b: number;
  /** Std-dev of input jitter η. */
  sigmaEta: number;
  /** Std-dev of output noise ε. */
  sigmaEps: number;
  moves: MoveRecord[];
  moveCount: number;
  claimed: boolean;
}

// ---------- game API --------------------------------------------------------

/** Create a new game with randomised secret parameters. */
export function createGame(): GameState {
  const a = uniform(4.0, 10.0);         // amplitude
  const b = uniform(0.1, 2.0);          // frequency

  // Scale sigmaEta inversely with |a|*b to keep jitter-caused output noise roughly constant
  const c = uniform(0.5, 2.0);
  const sigmaEta = c / (Math.abs(a) * b);

  // Scale sigmaEps proportional to |a| to keep reading noise relative to wave height
  const d = uniform(0.05, 0.2);
  const sigmaEps = d * Math.abs(a);

  return {
    a,
    b,
    sigmaEta,
    sigmaEps,
    moves: [],
    moveCount: 0,
    claimed: false,
  };
}

export interface MoveResult {
  observed: number;
  trueY: number;
  newState: GameState;
}

/**
 * Process one player move.
 * x — the raw value typed by the player.
 * Returns the noisy readout, the true (hidden) column, and the updated state.
 */
export function submitMove(state: GameState, x: number): MoveResult {
  const { a, b, sigmaEta, sigmaEps } = state;

  // Apply input jitter — equivalent to Python: eta = random.gauss(0, sigma_eta)
  const eta = gaussRandom(0, sigmaEta);
  const trueX = x + eta;

  // True function value — equivalent to Python: true_f = a * math.sin(b * true_x)
  const trueF = a * Math.sin(b * trueX);

  // True y value — replaces the old integer column
  const trueY = trueF;

  // Output noise — equivalent to Python: epsilon = random.gauss(0, sigma_eps)
  const epsilon = gaussRandom(0, sigmaEps);

  // Observed — equivalent to Python: observed = true_f + epsilon
  const observed = trueF + epsilon;

  const record: MoveRecord = { x, trueX, observed, trueY };
  const newState: GameState = {
    ...state,
    moves: [...state.moves, record],
    moveCount: state.moveCount + 1,
  };

  return { observed, trueY, newState };
}

export interface WinResult {
  isWin: boolean;
  valid: MoveRecord[];
}

/**
 * Check the "Window Packing" win condition.
 * Find a subset of k pieces that are vertically close (Wy=1.0)
 * but horizontally separated (Dx=6.0).
 */
export function checkWin(state: GameState): WinResult {
  const k = 4;
  const Wy = 1.0;
  const Dx = 6.0;

  const sortedByY = [...state.moves].sort((a, b) => a.trueY - b.trueY);

  let bestValid: MoveRecord[] = [];

  for (let i = 0; i < sortedByY.length; i++) {
    // 1. Candidate pool: points within Wy window
    const candidates: MoveRecord[] = [];
    for (let j = i; j < sortedByY.length; j++) {
      if (sortedByY[j].trueY - sortedByY[i].trueY > Wy) break;
      candidates.push(sortedByY[j]);
    }

    // 2. Greedy packing by trueX
    candidates.sort((a, b) => a.trueX - b.trueX);
    const packed: MoveRecord[] = [];
    if (candidates.length > 0) {
      packed.push(candidates[0]);
      for (let c = 1; c < candidates.length; c++) {
        if (candidates[c].trueX - packed[packed.length - 1].trueX >= Dx) {
          packed.push(candidates[c]);
        }
      }
    }

    if (packed.length >= k) {
      return { isWin: true, valid: packed.slice(0, k) };
    }

    if (packed.length > bestValid.length) {
      bestValid = packed;
    }
  }

  return { isWin: false, valid: bestValid };
}
