# Assignment 2: Menu Toolkit
# File name: menu_tools.py   (save this starter under that name)

MENU = {
    "Coffee": {"price": 4.50, "cost": 1.50},
    "Muffin": {"price": 3.25, "cost": 1.10},
    "Tea": {"price": 3.00, "cost": 0.60},
    "Sandwich": {"price": 6.50, "cost": 2.80},
}


def price_of(item, menu):
    """Return the price of item, or None if the item is not on the menu."""
    pass


def order_total(order, menu):
    """order is a dictionary like {"Coffee": 30, "Muffin": 18}.
    Return the total price, rounded to 2 decimals."""
    pass


def apply_discount(total, pct=0):
    """Take pct percent off total. The default is no discount. Round to 2 decimals."""
    pass


def most_expensive(menu):
    """Return the name of the item with the highest price."""
    pass


def items_under(menu, limit):
    """Return a sorted list of item names whose price is limit or less."""
    pass


def profit_report(order, menu):
    """Return a dictionary: {"revenue": ..., "cost": ..., "profit": ...}, each rounded to 2 decimals.
    Profit = revenue - cost. (Ignore any event fees.)"""
    pass
