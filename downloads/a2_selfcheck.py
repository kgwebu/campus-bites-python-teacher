"""Self-check for Assignment 2. Put this file in the same folder as menu_tools.py and menu_main.py, then run it."""
import ast
import subprocess
import sys

results = []


def check(label, test):
    try:
        ok = bool(test())
    except Exception as e:  # a crash is a fail, with a hint
        ok = False
        label += f"   (error: {type(e).__name__}: {e})"
    results.append(ok)
    print(("PASS  " if ok else "FAIL  ") + label)


try:
    import menu_tools as m
except Exception as e:
    sys.exit(f"Could not load menu_tools.py: {type(e).__name__}: {e}")

menu = m.MENU
first = {"Coffee": 30, "Muffin": 18}
check("price_of('Tea') is 3.0", lambda: m.price_of("Tea", menu) == 3.0)
check("price_of('Cookie') is None", lambda: m.price_of("Cookie", menu) is None)
check("order_total for the first event is 193.5", lambda: m.order_total(first, menu) == 193.5)
check("order_total of an empty order is 0", lambda: m.order_total({}, menu) == 0)
check("apply_discount(100) is 100", lambda: m.apply_discount(100) == 100)
check("apply_discount(100, 10) is 90", lambda: m.apply_discount(100, 10) == 90)
check("apply_discount(50, pct=20) is 40", lambda: m.apply_discount(50, pct=20) == 40)
check("most_expensive is Sandwich", lambda: m.most_expensive(menu) == "Sandwich")
check("items_under(3.25) is ['Muffin', 'Tea']", lambda: m.items_under(menu, 3.25) == ["Muffin", "Tea"])
check("items_under(1) is an empty list", lambda: m.items_under(menu, 1) == [])
check("profit_report revenue is 193.5", lambda: m.profit_report(first, menu)["revenue"] == 193.5)
check("profit_report cost is 64.8", lambda: m.profit_report(first, menu)["cost"] == 64.8)
check("profit_report profit is 128.7", lambda: m.profit_report(first, menu)["profit"] == 128.7)
check("menu_tools does not change MENU", lambda: menu["Tea"]["price"] == 3.0 and len(menu) == 4)


def main_checks():
    try:
        src = open("menu_main.py", encoding="utf-8").read()
    except OSError:
        print("FAIL  menu_main.py was not found")
        results.append(False)
        return
    tree = ast.parse(src)
    asserts = sum(isinstance(n, ast.Assert) for n in ast.walk(tree))
    check("menu_main.py has at least 2 assert lines", lambda: asserts >= 2)
    check("menu_main.py imports from menu_tools", lambda: "menu_tools" in src)
    run = subprocess.run([sys.executable, "menu_main.py"], capture_output=True, text=True, timeout=30)
    check("menu_main.py runs without an error", lambda: run.returncode == 0)
    check("menu_main.py prints the 193.5 total", lambda: "193.5" in run.stdout)
    check("menu_main.py prints the 128.7 profit", lambda: "128.7" in run.stdout)
    check("menu_main.py prints Sandwich", lambda: "Sandwich" in run.stdout)


main_checks()
print(f"\n{sum(results)} of {len(results)} checks passed.")
