# Assignment 3: Messy Orders
# File name: messy_orders.py   (save this starter under that name)
# Put orders.csv and menu.csv in the same folder as this file.
import csv

import matplotlib
matplotlib.use("Agg")          # lets charts be saved to a file on any computer
import matplotlib.pyplot as plt
import pandas as pd


# TODO 1: read menu.csv and make a dictionary PRICES like {"Coffee": 4.5, ...}


class Order:
    # TODO 2: __init__ takes order_id, date, product, quantity and stores them.
    #         Add a method revenue() that returns price * quantity, rounded to 2 decimals.
    pass


# TODO 3: read orders.csv with csv.DictReader.
#   A row is BAD if the quantity is not a whole number, the quantity is 0 or less,
#   or the product is not in PRICES. Use try/except. Make an Order for every good row.
#   Count the bad rows.

# TODO 4: print the counts, for example:
#   Good rows: 100
#   Bad rows: 5

# TODO 5: put the good orders in a pandas DataFrame with the columns
#   order_id, date, product, quantity, revenue
#   and save it with:  table.to_csv("clean_orders.csv", index=False)

# TODO 6: use groupby to print the top product and the best day, for example:
#   Top product: Coffee ($1426.50)
#   Best day: 2026-03-04 ($152.50)

# TODO 7: draw a bar chart of revenue by product, with a title and a y label,
#   and save it as revenue_by_product.png
