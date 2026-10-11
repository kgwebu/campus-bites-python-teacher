"""Self-check for the group project. Put it in your project folder (next to main.py) and run it.

It checks the SHAPE of your project: files, functions, a class, error handling, a README, a report and charts.
It does not judge whether your analysis is right. Your teacher does that.
"""
import ast
import glob
import os
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


mine = [p for p in glob.glob("*.py") if "selfcheck" not in p]
trees = {}
for p in mine:
    try:
        trees[p] = ast.parse(open(p, encoding="utf-8").read())
    except SyntaxError as e:
        print(f"FAIL  {p} has a syntax error on line {e.lineno}")
        results.append(False)

funcs = sum(isinstance(n, ast.FunctionDef) for t in trees.values() for n in ast.walk(t))
classes = sum(isinstance(n, ast.ClassDef) for t in trees.values() for n in ast.walk(t))
modules_with_funcs = [p for p, t in trees.items() if p != "main.py" and any(isinstance(n, ast.FunctionDef) for n in ast.walk(t))]
all_src = "\n".join(open(p, encoding="utf-8").read() for p in trees)

check("there is a main.py", lambda: os.path.exists("main.py"))
check("at least 2 modules besides main.py hold functions", lambda: len(modules_with_funcs) >= 2)
check("at least 6 functions in total", lambda: funcs >= 6)
check("at least 1 class", lambda: classes >= 1)
check("uses try/except for bad data", lambda: any(isinstance(n, ast.Try) for t in trees.values() for n in ast.walk(t)))
check("uses pandas", lambda: "import pandas" in all_src)
check("makes charts with matplotlib", lambda: "matplotlib" in all_src)
check("README.md has at least 80 words", lambda: len(open("README.md", encoding="utf-8").read().split()) >= 80)

for name in ("report.txt",):
    if os.path.exists(name):
        os.remove(name)
for png in glob.glob("*.png"):
    os.remove(png)

if os.path.exists("main.py"):
    run = subprocess.run([sys.executable, "main.py"], capture_output=True, text=True, timeout=120)
    if run.returncode != 0:
        print("\nmain.py stopped with an error:\n" + (run.stderr.strip()[-600:] or "(no message)"))
    check("main.py runs without an error", lambda: run.returncode == 0)
check("main.py wrote a report.txt that is not empty", lambda: os.path.getsize("report.txt") > 50)
check("main.py saved at least 2 chart pictures (.png)", lambda: len(glob.glob("*.png")) >= 2)
print(f"\n{sum(results)} of {len(results)} checks passed.")
