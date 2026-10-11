"""Self-check for Assignment 2. Put this file, variants.py, menu_tools.py and menu_main.py in one folder, then run it.

It checks YOUR numbers (they come from your GitHub username). The real marking uses more checks and other menus.
"""
import ast
import importlib
import subprocess
import sys

USERNAME = ""  # optional: type your GitHub username here to skip the question

try:
    from variants import pick
except ImportError:
    sys.exit("Could not find variants.py. Download it and save it in this folder.")

name = USERNAME or input("GitHub username: ")
v = pick("a2", name)
my_menu = {v["drink_1"]: float(v["drink_1_price"]), v["drink_2"]: float(v["drink_2_price"]),
           v["bake_1"]: float(v["bake_1_price"]), v["bake_2"]: float(v["bake_2_price"]),
           v["meal"]: float(v["meal_price"])}
NAMES = ["price_of", "require_price", "order_total", "discount_percent", "apply_discount",
         "rank_items", "merge_orders", "cheapest_of"]
results = []


def check(label, test):
    try:
        ok = bool(test())
    except Exception as e:  # a crash is a fail, with a hint
        ok = False
        label += f"   (error: {type(e).__name__}: {e})"
    results.append(ok)
    print(("PASS  " if ok else "FAIL  ") + label)


def raises(message, fn, *args, **kwargs):
    try:
        fn(*args, **kwargs)
    except ValueError as e:
        return str(e) == message
    return False


try:
    m = importlib.import_module("menu_tools")
except Exception as e:
    sys.exit(f"Could not load menu_tools.py: {type(e).__name__}: {e}")

tiny = {"Tea": 2.0, "Roll": 1.5, "Cake": 2.0}
check("MENU has your 5 items and your prices", lambda: {k: float(x) for k, x in m.MENU.items()} == my_menu)
check("all 8 functions exist and each has a docstring",
      lambda: all(callable(getattr(m, n, None)) and (getattr(m, n).__doc__ or "").strip() for n in NAMES))
check("price_of gives None, and require_price raises ValueError('Unknown item: Pizza')",
      lambda: m.price_of("Pizza", tiny) is None and m.price_of("Tea", tiny) == 2.0
      and raises("Unknown item: Pizza", m.require_price, "Pizza", tiny))
check("order_total adds price x quantity", lambda: m.order_total({"Tea": 2, "Roll": 3}, tiny) == 8.5)
check("discount_percent uses bulk_at, bulk_pct and member_pct",
      lambda: m.discount_percent({"Tea": 3}, bulk_at=3, bulk_pct=10, member_pct=2) == 10
      and m.discount_percent({"Tea": 2}, bulk_at=3, bulk_pct=10, member_pct=2) == 0
      and m.discount_percent({"Tea": 2}, True, bulk_at=3, bulk_pct=10, member_pct=2) == 2)
check("discount_percent defaults are the numbers on your card",
      lambda: m.discount_percent({"Tea": int(v["bulk_at"])}, True)
      == m.discount_percent({"Tea": int(v["bulk_at"])}, True, bulk_at=int(v["bulk_at"]), bulk_pct=int(v["bulk_pct"]),
                            member_pct=int(v["member_pct"])))
check("apply_discount: (80, 25, 'nearest') is 60.0, pct defaults to 0, rounding defaults to your rule",
      lambda: m.apply_discount(80, 25, "nearest") == 60.0 and m.apply_discount(80) == 80
      and m.apply_discount(19.99, 15) == m.apply_discount(19.99, 15, v["rounding_rule"]))
check("rank_items: ties are A to Z, also when descending",
      lambda: m.rank_items(tiny) == ["Roll", "Cake", "Tea"] and m.rank_items(tiny, descending=True) == ["Cake", "Tea", "Roll"]
      and m.rank_items(tiny, limit=1) == ["Roll"])
a, b = {"Tea": 1}, {"Tea": 2, "Roll": 1}
check("merge_orders adds quantities and does not change its inputs",
      lambda: m.merge_orders(a, b) == {"Tea": 3, "Roll": 1} and a == {"Tea": 1} and b == {"Tea": 2, "Roll": 1})
check("cheapest_of takes any number of names (ties A to Z)",
      lambda: m.cheapest_of(tiny, "Tea", "Cake") == "Cake" and m.cheapest_of(tiny, "Tea") == "Tea"
      and raises("Give at least one item", m.cheapest_of, tiny))


def main_checks():
    try:
        src = open("menu_main.py", encoding="utf-8").read()
        tree = ast.parse(src)
    except (OSError, SyntaxError) as e:
        check(f"menu_main.py can be read ({type(e).__name__})", lambda: False)
        return
    check("menu_main.py imports menu_tools and has 3 or more assert lines",
          lambda: "menu_tools" in src and sum(isinstance(n, ast.Assert) for n in ast.walk(tree)) >= 3)
    try:
        run = subprocess.run([sys.executable, "menu_main.py"], capture_output=True, text=True, timeout=20)
    except subprocess.TimeoutExpired:
        check("menu_main.py finishes", lambda: False)
        return
    lines = run.stdout.splitlines()
    check("menu_main.py runs and prints the 13 report lines (first 'Menu Toolkit report', last 'Error check: ...')",
          lambda: run.returncode == 0 and len(lines) == 13 and lines[0] == "Menu Toolkit report"
          and lines[3] == "Price of Pizza: None" and lines[-1] == "Error check: Unknown item: Pizza")


main_checks()
print(f"\n{sum(results)} of {len(results)} checks passed.")
