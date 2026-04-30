import { describe, it, expect } from "bun:test";
import { analyzeGame, type GameState, type MoveRecord } from "./game";

/** Helper to create a mock game state with specific moves. */
function createMockState(moves: Partial<MoveRecord>[]): GameState {
  return {
    a: 10,
    b: 1,
    sigmaEta: 0.1,
    sigmaEps: 0.1,
    moves: moves.map(m => ({
      x: m.trueX ?? 0,
      trueX: m.trueX ?? 0,
      observed: m.trueY ?? 0,
      trueY: m.trueY ?? 0,
      ...m
    })),
    moveCount: moves.length,
    claimed: false,
  };
}

describe("Game Analysis Logic", () => {
  it("should detect a win when 4 points are correctly separated and in window", () => {
    const moves = [
      { trueX: 0,  trueY: 0.5 },
      { trueX: 6,  trueY: 0.6 },
      { trueX: 12, trueY: 0.7 },
      { trueX: 18, trueY: 0.8 },
    ];
    const analysis = analyzeGame(createMockState(moves));
    expect(analysis.isWin).toBe(true);
    expect(analysis.valid.length).toBe(4);
    expect(analysis.hasClusteredWindow).toBe(false);
  });

  it("should detect clustered points (fail separation Dx=6.0)", () => {
    const moves = [
      { trueX: 0,   trueY: 0.5 },
      { trueX: 5.9, trueY: 0.6 }, // < 6.0 away from previous
      { trueX: 11.8, trueY: 0.7 },
      { trueX: 17.7, trueY: 0.8 },
    ];
    const analysis = analyzeGame(createMockState(moves));
    expect(analysis.isWin).toBe(false);
    expect(analysis.hasClusteredWindow).toBe(true);
  });

  it("should detect points out of vertical window (Wy=1.0)", () => {
    const moves = [
      { trueX: 0,  trueY: 0 },
      { trueX: 7,  trueY: 0.5 },
      { trueX: 14, trueY: 1.1 }, // > 1.0 away from first
      { trueX: 21, trueY: 1.6 },
    ];
    const analysis = analyzeGame(createMockState(moves));
    expect(analysis.isWin).toBe(false);
    expect(analysis.hasClusteredWindow).toBe(false);
  });

  it("should handle edge cases (exactly 6.0 separation and 1.0 window)", () => {
    const moves = [
      { trueX: 0,  trueY: 0 },
      { trueX: 6,  trueY: 0.5 },
      { trueX: 12, trueY: 1.0 }, // Exactly 1.0 from first
      { trueX: 18, trueY: 0.5 },
    ];
    const analysis = analyzeGame(createMockState(moves));
    expect(analysis.isWin).toBe(true);
    expect(analysis.hasClusteredWindow).toBe(false);
  });

  it("should find a win in a larger pool of points", () => {
    const moves = [
      { trueX: 0,  trueY: 5 }, // Junk
      { trueX: 1,  trueY: 0 }, // Start of win
      { trueX: 2,  trueY: 0 }, // Clustered (ignored)
      { trueX: 7,  trueY: 0 }, // Valid separation
      { trueX: 13, trueY: 0 }, // Valid separation
      { trueX: 19, trueY: 0 }, // Valid separation (4th point)
    ];
    const analysis = analyzeGame(createMockState(moves));
    expect(analysis.isWin).toBe(true);
  });

  it("should return isWin: false and hasClusteredWindow: false if < 4 points", () => {
    const moves = [
      { trueX: 0, trueY: 0 },
      { trueX: 1, trueY: 0 },
      { trueX: 2, trueY: 0 },
    ];
    const analysis = analyzeGame(createMockState(moves));
    expect(analysis.isWin).toBe(false);
    expect(analysis.hasClusteredWindow).toBe(false);
  });
});
