import { createGame, submitMove, analyzeGame, WIN_DX, MAX_MOVES } from "../src/game";

const mode = process.argv[2];
const numGames = 100;

if (!mode || (mode !== "dx" && mode !== "max")) {
  console.error("Usage: bun scripts/cheese-test.ts <dx|max>");
  process.exit(1);
}

console.log(`Running ${numGames} games in mode: ${mode}`);
console.log("------------------------------------------");

let wins = 0;

for (let g = 0; g < numGames; g++) {
  let state = createGame();
  const startX = -100;
  let step = 0;

  if (mode === "dx") {
    step = WIN_DX;
  } else {
    step = 200 / MAX_MOVES;
  }

  // 29 moves total (leaving 1 piece left)
  for (let i = 0; i < MAX_MOVES - 1; i++) {
    const x = startX + i * step;
    const result = submitMove(state, x);
    state = result.newState;
  }

  const analysis = analyzeGame(state);
  if (analysis.isWin) {
    wins++;
    console.log(`Game ${g + 1}: WIN`);
  } else {
    console.log(`Game ${g + 1}: LOSS ${analysis.hasClusteredWindow ? "(Clustered)" : ""}`);
  }
}

console.log("------------------------------------------");
console.log(`Total Wins:   ${wins}`);
console.log(`Total Losses: ${numGames - wins}`);
console.log(`Win Rate:     ${(wins / numGames * 100).toFixed(1)}%`);
