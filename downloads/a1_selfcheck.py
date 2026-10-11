"""Self-check for Assignment 1. Put this file next to lunch_rush.py and run it."""
import subprocess
import sys

# Three customers: coffees, muffins, delivery
ANSWERS = "5\n2\nyes\n1\n0\nyes\n12\n6\nyes\n"
CHECKS = [
    ("Customer 1 subtotal", "Subtotal: $29.00"),
    ("Customer 1 discount", "Discount: 10%"),
    ("Customer 1 after discount", "After discount: $26.10"),
    ("Customer 1 free delivery", "Delivery fee: $0.00"),
    ("Customer 1 total", "Total: $26.10"),
    ("Customer 2 subtotal", "Subtotal: $4.50"),
    ("Customer 2 no discount", "Discount: 0%"),
    ("Customer 2 delivery fee", "Delivery fee: $3.00"),
    ("Customer 2 total", "Total: $7.50"),
    ("Customer 3 subtotal", "Subtotal: $73.50"),
    ("Customer 3 big discount", "Discount: 20%"),
    ("Customer 3 total", "Total: $58.80"),
    ("Customer count", "Customers: 3"),
    ("Day total", "Day total: $92.40"),
]


def main():
    try:
        run = subprocess.run([sys.executable, "lunch_rush.py"], input=ANSWERS, capture_output=True,
                             text=True, timeout=20)
    except FileNotFoundError:
        sys.exit("Could not run Python.")
    except subprocess.TimeoutExpired:
        sys.exit("Your program did not finish. Check for a loop that never ends.")
    if run.returncode != 0:
        print("Your program stopped with an error:\n")
        print(run.stderr.strip()[-600:] or "(no message)")
        sys.exit(1)
    passed = 0
    for label, expected in CHECKS:
        ok = expected in run.stdout
        passed += ok
        print(("PASS  " if ok else "FAIL  ") + label + ("" if ok else f'   (looking for: {expected})'))
    print(f"\n{passed} of {len(CHECKS)} checks passed.")
    if passed < len(CHECKS):
        print("Tip: copy the text exactly, including spaces, $ signs and two decimals.")


if __name__ == "__main__":
    main()
