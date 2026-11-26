"""
Regenerate data/courses.json from an updated Excel course matrix.
Usage: python scripts/update_catalog.py path/to/List_of_Training.xlsx
"""
import json
import re
import sys
import pandas as pd

def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/update_catalog.py <path-to-excel.xlsx>")
        sys.exit(1)
    xlsx_path = sys.argv[1]
    df = pd.read_excel(xlsx_path)
    print(f"Loaded {len(df)} rows from {xlsx_path}. Columns: {list(df.columns)}")
