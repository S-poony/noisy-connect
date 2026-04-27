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
  return {
    a: uniform(4.0, 10.0),         // amplitude
    b: uniform(0.1, 2.0),          // frequency
    sigmaEta: uniform(0.0, 2.0),   // input jitter
    sigmaEps: uniform(0.0, 2.0),   // output reading noise
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

/**
 * Check the "Window Packing" win condition.
 * Require at least k pieces in a continuous interval of length at most W,
 * with no two pieces closer than d.
 */
export function checkWin(state: GameState): boolean {
  const k = 4;
  const W = 4;
  const d = 0.5;

  const sortedY = state.moves.map((m) => m.trueY).sort((a, b) => a - b);

  for (let i = 0; i <= sortedY.length - k; i++) {
    let count = 1;
    let currentY = sortedY[i];
    let maxFoundY = currentY;

    for (let j = i + 1; j < sortedY.length; j++) {
      if (sortedY[j] - currentY >= d) {
        count++;
        currentY = sortedY[j];
        maxFoundY = currentY;
        if (count === k) break;
      }
    }

    if (count === k && maxFoundY - sortedY[i] <= W) {
      return true;
    }
  }

  return false;
}
