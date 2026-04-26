import * as readline from "node:readline/promises";

const MAX_MOVES = 20;

// ---------- helpers ----------

/** Box-Muller transform – equivalent to Python's random.gauss(mu, sigma). */
function gaussRandom(mean: number, sigma: number): number {
  let u1: number, u2: number;
  do { u1 = Math.random(); } while (u1 === 0); // avoid log(0)
  u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + sigma * z;
}

/** Equivalent to Python's random.uniform(a, b). */
function uniform(a: number, b: number): number {
  return Math.random() * (b - a) + a;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function prompt(msg: string): Promise<string> {
  const answer = await rl.question(msg);
  return answer.trim();
}

async function yesNo(promptMsg: string): Promise<boolean> {
  while (true) {
    const ans = (await prompt(promptMsg + " (y/n): ")).toLowerCase();
    if (ans === "y" || ans === "yes") return true;
    if (ans === "n" || ans === "no") return false;
  }
}

// ---------- game ----------

async function playOneGame(): Promise<void> {
  // Randomise function parameters and noise levels for this game
  const a = uniform(8.0, 16.0);          // amplitude: 8 to 16
  const b = uniform(0.5, 2.0);           // frequency: 0.5 to 2
  const sigmaEta = uniform(0.0, 3.0);    // input jitter
  const sigmaEps = uniform(0.0, 3.0);    // output reading noise

  console.log("\n" + "=".repeat(50));
  console.log("   NEW GAME – INFINITE BOARD");
  console.log("=".repeat(50));
  console.log("Secret function:  column = round( a·sin(b·x) )");
  console.log("You see a noisy output:  y = a·sin(b·(x+η)) + ε");
  console.log("Goal: occupy any 4 consecutive integer columns.");
  console.log(`You have ${MAX_MOVES} pieces. Type 'claim' to assert a win.\n`);

  const trueColumns: number[] = [];
  const noisyLog: number[] = [];

  let moveCount = 0;
  let claimed = false;

  while (moveCount < MAX_MOVES && !claimed) {
    const cmd = await prompt(`Move ${moveCount + 1}/${MAX_MOVES} – enter x or 'claim': `);
    if (cmd.toLowerCase() === "claim") {
      claimed = true;
      break;
    }

    const x = parseFloat(cmd);
    if (isNaN(x)) {
      console.log("  -> Invalid input. Enter a number or 'claim'.");
      continue;
    }

    // Apply input jitter
    const eta = gaussRandom(0, sigmaEta);
    const trueX = x + eta;

    // True function value and column placement
    const trueF = a * Math.sin(b * trueX);
    const col = Math.round(trueF);

    // Output noise (added to the continuous value, column hidden)
    const epsilon = gaussRandom(0, sigmaEps);
    const observed = trueF + epsilon;

    trueColumns.push(col);
    noisyLog.push(observed);
    moveCount++;

    console.log(`  -> Noisy readout: y ≈ ${observed.toFixed(2)}`);
    console.log(`     (${trueColumns.length} pieces placed.)\n`);
  }

  // ----- Reveal and check win -----
  const occupied = new Set(trueColumns);
  const win = [...occupied].some((c) =>
    [0, 1, 2, 3].every((i) => occupied.has(c + i))
  );

  console.log("\n" + "=".repeat(40));
  console.log("         GAME OVER – REVEAL");
  console.log("=".repeat(40));
  console.log(`Secret function: a = ${a.toFixed(2)}, b = ${b.toFixed(2)}`);
  console.log(`Input noise σ_η = ${sigmaEta.toFixed(2)}, Output noise σ_ε = ${sigmaEps.toFixed(2)}`);
  console.log(`True piece columns (sorted): [${[...trueColumns].sort((x, y) => x - y).join(", ")}]`);
  console.log(`4-in-a-row present? ${win ? "YES" : "NO"}`);

  if (!claimed) {
    console.log("You didn't claim a win. You lose.");
  } else {
    if (win) {
      console.log("You claimed a win and were RIGHT – you win!");
    } else {
      console.log("You claimed a win but were WRONG – you lose.");
    }
  }
  console.log("=".repeat(40));
}

// ---------- main ----------

async function main(): Promise<void> {
  while (true) {
    await playOneGame();
    if (!(await yesNo("\nPlay another game?"))) {
      console.log("Thanks for playing!");
      break;
    }
  }
  rl.close();
}

main();
