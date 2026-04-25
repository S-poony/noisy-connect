import random
import math

MAX_MOVES = 20

def yes_no(prompt):
    while True:
        ans = input(prompt + " (y/n): ").strip().lower()
        if ans in ('y', 'yes'):
            return True
        if ans in ('n', 'no'):
            return False

def play_one_game():
    # Randomise function parameters and noise levels for this game
    a = random.uniform(4.0, 10.0)          # amplitude: 4 to 10
    b = random.uniform(0.5, 2.0)           # frequency: 0.5 to 2
    sigma_eta = random.uniform(0.0, 3.0)   # input jitter
    sigma_eps = random.uniform(0.0, 3.0)   # output reading noise

    print("\n" + "=" * 50)
    print("   NEW GAME – INFINITE BOARD")
    print("=" * 50)
    print("Secret function:  column = round( a·sin(b·x) )")
    print("You see a noisy output:  y = a·sin(b·(x+η)) + ε")
    print("Goal: occupy any 4 consecutive integer columns.")
    print(f"You have {MAX_MOVES} pieces. Type 'claim' to assert a win.\n")

    true_columns = []
    noisy_log = []

    move_count = 0
    claimed = False

    while move_count < MAX_MOVES and not claimed:
        cmd = input(f"Move {move_count+1}/{MAX_MOVES} – enter x or 'claim': ").strip()
        if cmd.lower() == 'claim':
            claimed = True
            break

        try:
            x = float(cmd)
        except ValueError:
            print("  -> Invalid input. Enter a number or 'claim'.")
            continue

        # Apply input jitter
        eta = random.gauss(0, sigma_eta)
        true_x = x + eta

        # True function value and column placement
        true_f = a * math.sin(b * true_x)
        col = round(true_f)

        # Output noise (added to the continuous value, column hidden)
        epsilon = random.gauss(0, sigma_eps)
        observed = true_f + epsilon

        true_columns.append(col)
        noisy_log.append(observed)
        move_count += 1

        print(f"  -> Noisy readout: y ≈ {observed:.2f}")
        print(f"     ({len(true_columns)} pieces placed.)\n")

    # ----- Reveal and check win -----
    occupied = set(true_columns)
    win = any(all((c + i) in occupied for i in range(4)) for c in occupied)

    print("\n" + "=" * 40)
    print("         GAME OVER – REVEAL")
    print("=" * 40)
    print(f"Secret function: a = {a:.2f}, b = {b:.2f}")
    print(f"Input noise σ_η = {sigma_eta:.2f}, Output noise σ_ε = {sigma_eps:.2f}")
    print(f"True piece columns (sorted): {sorted(true_columns)}")
    print(f"4-in-a-row present? {'YES' if win else 'NO'}")

    if not claimed:
        print("You didn't claim a win. You lose.")
    else:
        if win:
            print("You claimed a win and were RIGHT – you win!")
        else:
            print("You claimed a win but were WRONG – you lose.")
    print("=" * 40)

def main():
    while True:
        play_one_game()
        if not yes_no("\nPlay another game?"):
            print("Thanks for playing!")
            break

if __name__ == "__main__":
    main()