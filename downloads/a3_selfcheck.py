"""Self-check for Assignment 3. Put it next to messy_orders.py, orders.csv and menu.csv, then run it."""
import ast
import csv
import subprocess
import sys

results = []


def check(label, test):
    try:
        ok = bool(test())
    except Exception as e:
        ok = False
        label += f"   (error: {type(e).__name__}: {e})"
    results.append(ok)
    print(("PASS  " if ok else "FAIL  ") + label)


try:
    src = open("messy_orders.py", encoding="utf-8").read()
    tree = ast.parse(src)
except Exception as e:
    sys.exit(f"Could not read messy_orders.py: {type(e).__name__}: {e}")

run = subprocess.run([sys.executable, "messy_orders.py"], capture_output=True, text=True, timeout=120)
if run.returncode != 0:
    print("Your program stopped with an error:\n")
    print(run.stderr.strip()[-700:] or "(no message)")
    sys.exit(1)
out = run.stdout

classes = {n.name: n for n in ast.walk(tree) if isinstance(n, ast.ClassDef)}
check("has a class called Order", lambda: "Order" in classes)
check("Order has a revenue method", lambda: any(isinstance(f, ast.FunctionDef) and f.name == "revenue" for f in classes["Order"].body))
check("uses try/except", lambda: any(isinstance(n, ast.Try) for n in ast.walk(tree)))
check("uses pandas", lambda: "pandas" in src)
check("prints 282 good rows", lambda: "Good rows: 282" in out)
check("prints 12 bad rows", lambda: "Bad rows: 12" in out)
check("prints the top product", lambda: "Top product: Coffee ($1426.50)" in out)
check("prints the best day", lambda: "Best day: 2026-03-04 ($152.50)" in out)


def clean_file():
    with open("clean_orders.csv", newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    return len(rows) == 282 and set(rows[0]) >= {"order_id", "date", "product", "quantity", "revenue"}


check("clean_orders.csv has 282 rows and the right columns", clean_file)


def chart_file():
    with open("revenue_by_product.png", "rb") as f:
        head = f.read(8)
    return head == b"\x89PNG\r\n\x1a\n"


check("revenue_by_product.png is a picture", chart_file)
print(f"\n{sum(results)} of {len(results)} checks passed.")
