"""Self-check for Assignment 3. Put it next to messy_orders.py and variants.py, then run it.

It builds a tiny orders.csv and menu.csv in a temporary folder, runs YOUR messy_orders.py on them,
and checks the answers for YOUR personal rules. Your own orders.csv and menu.csv are not touched.
The real marking uses more files and more tricky rows, so a pass here is a good sign, not a mark.
"""
import ast
import csv
import datetime
import json
import os
import shutil
import subprocess
import sys
import tempfile
from decimal import Decimal
from pathlib import Path

from variants import pick

USERNAME = ""  # you may type your GitHub username here, or leave it empty and type it when asked
username = USERNAME or input("GitHub username: ")
v = pick("a3", username)
MAXQ, START, END = int(v["max_qty"]), v["start_date"], v["end_date"]
TIDY, COOKIE, METRIC = v["name_rule"] == "tidy", v["cookie_rule"], v["best_metric"]
print(f"Your rules: max quantity {MAXQ}, names {v['name_rule']}, Cookie {COOKIE}, best day by {METRIC}, "
      f"cut-off ${float(v['min_revenue']):.2f}, window {START} to {END}\n")

here = Path.cwd()
script = here / "messy_orders.py"
results = []


def check(label, test):
    try:
        outcome = test()
        ok, extra = (outcome if isinstance(outcome, tuple) else (bool(outcome), ""))
    except Exception as e:  # noqa: BLE001
        ok, extra = False, f"error: {type(e).__name__}: {e}"
    results.append(ok)
    print(("PASS  " if ok else "FAIL  ") + label + (f"   ({extra})" if extra and not ok else ""))


if not script.is_file():
    sys.exit("Could not find messy_orders.py in this folder. Open the assignment-3 folder in VS Code and run again.")
src = script.read_text(encoding="utf-8")
try:
    tree = ast.parse(src)
except SyntaxError as e:
    sys.exit(f"messy_orders.py has a syntax error: {e}")

# ---- a tiny data set. Dates move with YOUR window. Every row tests one rule.
S = datetime.date.fromisoformat(START)
E = datetime.date.fromisoformat(END)
d = lambda n: (S + datetime.timedelta(days=n)).isoformat()  # noqa: E731
rows = [  # id, date, product, quantity, what we expect
    ("M01", d(0), "Coffee", "1", "good"),
    ("M02", d(1), "Tea", str(MAXQ), "good"),
    ("M03", d(1), "Muffin", str(MAXQ + 1), f"quantity over {MAXQ}"),
    ("M04", d(2), "Muffin", "two", "quantity not a number"),
    ("M05", d(2), "Tea", "0", "quantity 0 or less"),
    ("M06", d(3), "Waffle", "1", "unknown product"),
    ("M07", (S - datetime.timedelta(days=1)).isoformat(), "Coffee", "1", "outside"),
    ("M08", (E + datetime.timedelta(days=1)).isoformat(), "Tea", "1", "outside"),
    ("M09", E.isoformat(), "Muffin", "2", "good"),
    ("M10", d(3), "Cookie", "1", "good-alias" if COOKIE != "bad" else "unknown product"),
    ("M11", d(4), "  coffee ", "1", "good" if TIDY else "unknown product"),
    ("M01", d(4), "Coffee", "2", "duplicate order id"),
    ("M13", "2026-13-45", "Tea", "1", "bad date"),
]
MENU = {"Coffee": ("4.00", "1.00"), "Tea": ("2.00", "0.50"), "Muffin": ("3.00", "1.20")}
good, counts, outside, aliased = [], {}, 0, 0
for oid, day, prod, qty, what in rows:
    if what == "outside":
        outside += 1
    elif what.startswith("good"):
        name = {"good-alias": COOKIE}.get(what, prod.strip().title())
        good.append((oid, day, name, int(qty)))
        aliased += what == "good-alias"
    else:
        counts[what] = counts.get(what, 0) + 1
good.sort(key=lambda g: (g[1], g[0]))


def money(x):
    return f"{Decimal(x).quantize(Decimal('0.01')):.2f}"


def totals(name_qty):
    _, _, name, qty = name_qty
    price, cost = (Decimal(x) for x in MENU[name])
    return price * qty, (price - cost) * qty


per_day = {}
for g in good:
    rev, prof = totals(g)
    per_day[g[1]] = per_day.get(g[1], Decimal(0)) + (rev if METRIC == "revenue" else prof)
best_day = max(sorted(per_day), key=lambda k: per_day[k])
bad_total = sum(counts.values())
labels = [("bad date", "bad date"), ("unknown product", "unknown product"), ("quantity not a number", "quantity not a number"),
          ("quantity 0 or less", "quantity 0 or less"), (f"quantity over {MAXQ}", f"quantity over {MAXQ}"),
          ("duplicate order id", "duplicate order id")]

work = Path(tempfile.mkdtemp(prefix="a3check_"))
shutil.copy(script, work / "messy_orders.py")
with open(work / "orders.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["order_id", "date", "product", "quantity", "channel"])
    for oid, day, prod, qty, _ in rows:
        w.writerow([oid, day, prod, qty, "pickup"])
with open(work / "menu.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["product", "price", "cost"])
    for name, (price, cost) in MENU.items():
        w.writerow([name, price, cost])


def run(folder, code_args=("messy_orders.py",), timeout=30):
    env = dict(os.environ, MPLBACKEND="Agg")
    return subprocess.run([sys.executable, *code_args], cwd=folder, capture_output=True, text=True, timeout=timeout, env=env)


try:
    p = run(work)
except subprocess.TimeoutExpired:
    sys.exit("Your program did not finish in 30 seconds. Is there a loop that never ends?")
lines = [l.strip() for l in p.stdout.splitlines()]


def line_is(expected):
    prefix = expected.split(":")[0] + ":"
    got = next((l for l in lines if l.startswith(prefix)), "no such line")
    return expected in lines, f"expected '{expected}', your program printed '{got}'"


check("program runs on the small test files without an error",
      lambda: (p.returncode == 0, (p.stderr.strip().splitlines() or ["no message"])[-1]))
check("prints Rows read and Outside window", lambda: (
    line_is(f"Rows read: {len(rows)}")[0] and line_is(f"Outside window: {outside}")[0],
    f"expected 'Rows read: {len(rows)}' and 'Outside window: {outside}'"))
check("prints Good rows", lambda: line_is(f"Good rows: {len(good)}"))
check("prints Bad rows", lambda: line_is(f"Bad rows: {bad_total}"))
check("prints the bad-row breakdown, one exact line per reason", lambda: (
    all(f"{lab}: {counts.get(key, 0)}" in lines for lab, key in labels),
    "expected: " + ", ".join(f"'{lab}: {counts.get(key, 0)}'" for lab, key in labels)))
check("prints Aliased rows", lambda: line_is(f"Aliased rows: {aliased}"))
check("prints the best day", lambda: line_is(f"Best day by {METRIC}: {best_day} (${money(per_day[best_day])})"))


def csv_file():
    with open(work / "clean_orders.csv", newline="", encoding="utf-8") as f:
        table = list(csv.reader(f))
    want_head = ["order_id", "date", "product", "quantity", "revenue", "profit"]
    if table[0] != want_head:
        return False, f"header is {table[0]}"
    want = [[oid, day, name, str(qty), money(totals((oid, day, name, qty))[0]), money(totals((oid, day, name, qty))[1])]
            for oid, day, name, qty in good]
    if table[1:] != want:
        first = next((i for i, (a, b) in enumerate(zip(table[1:], want)) if a != b), min(len(table) - 1, len(want)))
        return False, f"row {first + 1}: expected {want[first] if first < len(want) else 'no row'}, got {table[1:][first] if first < len(table) - 1 else 'no row'}"
    return True, ""


check("clean_orders.csv has the right columns, cells and sort order", csv_file)


def class_tests():
    cls = next((n for n in ast.walk(tree) if isinstance(n, ast.ClassDef) and n.name == "Order"), None)
    if cls is None:
        return False, "no class called Order"
    code = ("import json\n" + ast.get_source_segment(src, cls) + "\n"
            "a = Order('O1', '2026-03-01', 'Coffee', 3, 4.5, 1.5)\n"
            "b = Order('O1', '2030-05-05', 'Tea', 1, 3.0, 0.5)\n"
            "c = Order('O2', '2026-03-01', 'Coffee', 3, 4.5, 1.5)\n"
            "print(json.dumps([str(a), a.revenue(), a.profit(), a == b, a == c, a == 'O1']))\n")
    q = run(work, ("-c", code), 10)
    if q.returncode != 0:
        return False, (q.stderr.strip().splitlines() or ["error"])[-1]
    text, rev, prof, same_id, other_id, other_type = json.loads(q.stdout.strip().splitlines()[-1])
    return {"text": text, "rev": rev, "prof": prof, "same": same_id, "other": other_id, "type": other_type}, ""


holder = {}


def order_str():
    out, note = class_tests()
    if not isinstance(out, dict):
        return False, note
    holder.update(out)
    want = "O1 | 2026-03-01 | Coffee x3 | revenue $13.50 | profit $9.00"
    return out["text"] == want and out["rev"] == 13.5 and out["prof"] == 9.0, f"str(order) gave '{out['text']}'"


check("Order: revenue(), profit() and __str__ in the exact format", order_str)
check("Order: __eq__ compares order_id only (and False for other types)", lambda: (
    holder.get("same") is True and holder.get("other") is False and holder.get("type") is False, f"got {holder}"))


def chart():
    data = (work / "revenue_by_product.png").read_bytes()
    return data[:8] == b"\x89PNG\r\n\x1a\n" and len(data) > 4000, "revenue_by_product.png missing or not a real picture"


check("revenue_by_product.png is a real picture", chart)
names = {getattr(n.func, "attr", getattr(n.func, "id", "")) for n in ast.walk(tree) if isinstance(n, ast.Call)}
check("uses csv.DictReader, try/except and groupby", lambda: (
    "DictReader" in names and "groupby" in names and any(isinstance(n, ast.Try) for n in ast.walk(tree)),
    "one of DictReader, try/except, groupby is missing"))
shutil.rmtree(work, ignore_errors=True)
print(f"\n{sum(results)} of {len(results)} checks passed")
