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
  /** True column: round(a * sin(b * (x + eta))). Hidden until reveal. */
  col: number;
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
    a: uniform(8.0, 16.0),         // amplitude, lower is easier for connect 4
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
  col: number;
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

  // Column — equivalent to Python: col = round(true_f)
  const col = Math.round(trueF);

  // Output noise — equivalent to Python: epsilon = random.gauss(0, sigma_eps)
  const epsilon = gaussRandom(0, sigmaEps);

  // Observed — equivalent to Python: observed = true_f + epsilon
  const observed = trueF + epsilon;

  const record: MoveRecord = { x, trueX, observed, col };
  const newState: GameState = {
    ...state,
    moves: [...state.moves, record],
    moveCount: state.moveCount + 1,
  };

  return { observed, col, newState };
}

/**
 * Check the 4-in-a-row win condition.
 * Equivalent to Python:
 *   occupied = set(true_columns)
 *   win = any(all((c + i) in occupied for i in range(4)) for c in occupied)
 */
export function checkWin(state: GameState): boolean {
  const occupied = new Set(state.moves.map((m) => m.col));
  return [...occupied].some((c) =>
    [0, 1, 2, 3].every((i) => occupied.has(c + i))
  );
}
