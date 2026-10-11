"""Self-check for Assignment 1 (Lunch Rush Calculator).

Put this file, variants.py and your lunch_rush.py in the SAME folder, then run it.
It uses YOUR personal numbers (worked out from your GitHub username).
It tests some things. Your teacher's hidden checks test more, including edge cases.
"""
import re
import subprocess
import sys

from variants import pick

USERNAME = ""  # you may type your GitHub username here so it does not ask every time

# (coffees, muffins, delivery) for the main run: six customers
MAIN = [(2, 1, "yes"), (6, 3, "no"), (5, 5, "yes"), (12, 6, "yes"), (1, 0, "no"), (9, 9, "yes")]

FIELDS = {
    "subtotal": r"Subtotal: \$(\d+\.\d\d)(?!\d)",
    "rate": r"Discount: (\d+)%",
    "after": r"After discount: \$(\d+\.\d\d)(?!\d)",
    "fee": r"Delivery fee: \$(\d+\.\d\d)(?!\d)",
    "loyalty": r"Loyalty: -\$(\d+\.\d\d)(?!\d)",
    "total": r"Total: \$(-?\d+\.\d\d)(?!\d)",
}


def run(lines):
    """Run lunch_rush.py with these typed lines. Returns (output, problem)."""
    try:
        p = subprocess.run([sys.executable, "lunch_rush.py"], input="\n".join(lines) + "\n",
                           capture_output=True, text=True, timeout=10)
    except subprocess.TimeoutExpired:
        return "", "it did not finish in 10 seconds (a loop that never ends?)"
    if p.returncode != 0:
        last = (p.stderr.strip().splitlines() or ["(no message)"])[-1]
        return p.stdout, "it stopped with an error: " + last[:100]
    return p.stdout, ""


def lines_for(count, customers):
    out = [str(count)]
    for c, m, d in customers:
        out += [str(c), str(m), d]
    return out


def receipts(out):
    parts = re.split(r"Customer (\d+)(?!\d)", out)
    found = {}
    for i in range(1, len(parts) - 1, 2):
        found.setdefault(int(parts[i]), {k: (re.search(rx, parts[i + 1]) or [None, None])[1] for k, rx in FIELDS.items()})
    return found


def summary(out):
    def last(rx):
        hits = re.findall(rx, out)
        return hits[-1] if hits else None
    return {"n": last(r"Customers: (\d+)"), "day": last(r"Day total: \$(\d+\.\d\d)(?!\d)"),
            "avg": last(r"Average receipt: \$(\d+\.\d\d)(?!\d)"),
            "big": last(r"Biggest receipt: \$(\d+\.\d\d) \(customer (\d+)\)")}


def main():
    name = USERNAME.strip() or input("GitHub username: ").strip()
    v = pick("a1", name)
    cp, mp = float(v["coffee_price"]), float(v["muffin_price"])
    t1, r1, t2, r2 = float(v["disc1_over"]), int(v["disc1_rate"]), float(v["disc2_over"]), int(v["disc2_rate"])
    at_least = v["compare"] == "at least"
    fee_amount, free_from = float(v["delivery_fee"]), float(v["free_from"])
    k, off = int(v["loyalty_every"]), float(v["loyalty_off"])

    def rate_for(sub):
        def over(t):
            return sub >= t - 1e-9 if at_least else sub > t + 1e-9
        return r2 if over(t2) else r1 if over(t1) else 0

    out, problem = run(lines_for(len(MAIN), MAIN))
    got = receipts(out)
    sm = summary(out)
    fails = []

    def check(label, ok, detail=""):
        if not ok:
            fails.append((label, detail))
        return ok

    def each(label, test):
        """test(i, customer_input, printed) returns '' when fine, or a short complaint."""
        if problem:
            return check(label, False, problem)
        for i, cust in enumerate(MAIN, 1):
            row = got.get(i)
            if row is None or any(x is None for x in row.values()):
                return check(label, False, f"customer {i}: a receipt line is missing or not in the exact format")
            msg = test(i, cust, {a: float(b) for a, b in row.items()})
            if msg:
                return check(label, False, f"customer {i}: {msg}")
        return check(label, True)

    total_checks = 12
    check("The program runs and finishes", not problem, problem)
    check("Every receipt has all 7 lines in the right format",
          not problem and len(got) == len(MAIN) and all(all(x is not None for x in r.values()) for r in got.values()),
          problem or "a line is missing, reworded or has the wrong number of decimals")
    each("Subtotal uses your prices", lambda i, c, r: "" if abs(r["subtotal"] - (c[0] * cp + c[1] * mp)) < 0.005
         else f"Subtotal should be {c[0] * cp + c[1] * mp:.2f}")
    each("Discount percent follows your two thresholds", lambda i, c, r: "" if int(r["rate"]) == rate_for(c[0] * cp + c[1] * mp)
         else f"Discount should be {rate_for(c[0] * cp + c[1] * mp)}%")
    each("After discount matches subtotal and percent", lambda i, c, r: "" if abs(r["after"] - r["subtotal"] * (100 - r["rate"]) / 100) < 0.006
         else "After discount does not match Subtotal and Discount")

    def fee_test(i, c, r):
        want = fee_amount if (c[2] == "yes" and r["after"] < free_from - 1e-9) else 0.0
        return "" if abs(r["fee"] - want) < 0.005 else f"Delivery fee should be {want:.2f}"
    each("Delivery fee: pickup is free, delivery is free from your limit", fee_test)

    def loyalty_test(i, c, r):
        before = r["after"] + r["fee"]
        want = min(off, before) if i % k == 0 else 0.0
        return "" if abs(r["loyalty"] - want) < 0.006 else f"Loyalty should be -${want:.2f}"
    each("Loyalty amount only on every k-th customer", loyalty_test)
    each("Total = after discount + fee - loyalty, never below 0",
         lambda i, c, r: "" if abs(r["total"] - (r["after"] + r["fee"] - r["loyalty"])) < 0.006 and r["total"] >= 0
         else "Total does not match the lines above it")

    ok = not problem and all(x is not None for x in sm.values()) and len(got) == len(MAIN)
    if ok:
        totals = [float(got[i]["total"]) for i in range(1, len(MAIN) + 1)]
        best = max(totals)
        first = totals.index(best) + 1
        ok = (sm["n"] == str(len(MAIN)) and abs(float(sm["day"]) - sum(totals)) < 0.006
              and abs(float(sm["avg"]) - sum(totals) / len(totals)) < 0.0051
              and abs(float(sm["big"][0]) - best) < 0.006 and sm["big"][1] == str(first))
    check("Day summary: count, total, average, biggest receipt and who", ok,
          problem or "one of the four summary lines is missing or wrong")

    two = [(3, 2, "yes"), (4, 1, "no")]
    out2, prob2 = run(["abc", "0", "-3", "2.5"] + lines_for(2, two))
    check("Asks again for a bad customer count", not prob2 and summary(out2)["n"] == "2",
          prob2 or "after bad answers it should ask again, then use 2")
    bad = ["2", "-1", "x", "3", "2.5", "1", "maybe", "y", "yes", "0", "0", "no"]
    out3, prob3 = run(bad)
    r3 = receipts(out3)
    ok3 = (not prob3 and len(r3) == 2 and r3.get(1, {}).get("subtotal") == f"{3 * cp + 1 * mp:.2f}"
           and r3.get(2, {}).get("subtotal") == "0.00")
    check("Asks again for bad coffees, muffins and delivery answers", ok3,
          prob3 or "bad answers should be rejected and asked again, not used")

    passed = total_checks - len(fails)
    for label, detail in fails:
        print(f"FAIL  {label}   ({detail})")
    print(f"\n{passed} of {total_checks} checks passed.")
    if fails:
        print("Tip: the hidden checks also test exact threshold amounts and strange input.")


if __name__ == "__main__":
    main()
