#!/usr/bin/env python3
"""
test-data-generator.py
======================
Generate large test files for the Resilient Async Job Processing Platform.

Usage:
    python test-data-generator.py [--type csv|json|both] [--rows N] [--output-dir PATH]

Defaults:
    --type      both
    --rows      700000   (~600 MB CSV / ~200 MB JSON)
    --output-dir .        (current directory)

Examples:
    python test-data-generator.py
    python test-data-generator.py --type csv --rows 100000
    python test-data-generator.py --type json --rows 50000 --output-dir /tmp

Generated files:
    large_test.csv   — Multi-column CSV, useful for CSV_ROW_COUNT / CSV_COLUMN_STATS / CSV_DEDUPLICATE jobs
    large_test.json  — Array of records, useful for JSON_CANONICALIZE jobs
"""

import csv
import json
import os
import argparse
import random
import string
import time

CATEGORIES = ["electronics", "clothing", "food", "books", "sports", "home", "toys", "health"]
STATUSES = ["active", "inactive", "pending", "archived"]


def random_string(length: int) -> str:
    return "".join(random.choices(string.ascii_lowercase, k=length))


def generate_csv(output_path: str, num_rows: int) -> None:
    print(f"Generating CSV with {num_rows:,} rows → {output_path}")
    start = time.time()

    with open(output_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "name", "category", "price", "quantity", "status", "description"])

        for i in range(1, num_rows + 1):
            writer.writerow([
                i,
                f"product_{random_string(8)}",
                random.choice(CATEGORIES),
                round(random.uniform(1.0, 9999.99), 2),
                random.randint(0, 10000),
                random.choice(STATUSES),
                "x" * 800,  # pad to ~900 bytes per row for realistic large file size
            ])

            if i % 100_000 == 0:
                elapsed = time.time() - start
                pct = i / num_rows * 100
                print(f"  {pct:.0f}% ({i:,} rows) — {elapsed:.1f}s elapsed")

    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"  ✓ CSV done: {size_mb:.1f} MB in {time.time() - start:.1f}s")


def generate_json(output_path: str, num_rows: int) -> None:
    print(f"Generating JSON with {num_rows:,} records → {output_path}")
    start = time.time()

    # Stream the JSON array to avoid loading everything in RAM
    with open(output_path, "w") as f:
        f.write("[\n")
        for i in range(1, num_rows + 1):
            record = {
                "id": i,
                "sku": f"SKU-{random_string(6).upper()}",
                "name": f"product_{random_string(8)}",
                "category": random.choice(CATEGORIES),
                "price": round(random.uniform(1.0, 9999.99), 2),
                "quantity": random.randint(0, 10000),
                "status": random.choice(STATUSES),
                "tags": [random_string(5) for _ in range(random.randint(1, 5))],
                "metadata": {
                    "created_at": f"2025-{random.randint(1,12):02d}-{random.randint(1,28):02d}",
                    "source": random_string(10),
                },
            }
            suffix = ",\n" if i < num_rows else "\n"
            f.write("  " + json.dumps(record) + suffix)

            if i % 10_000 == 0:
                elapsed = time.time() - start
                pct = i / num_rows * 100
                print(f"  {pct:.0f}% ({i:,} records) — {elapsed:.1f}s elapsed")

        f.write("]\n")

    size_mb = os.path.getsize(output_path) / 1024 / 1024
    print(f"  ✓ JSON done: {size_mb:.1f} MB in {time.time() - start:.1f}s")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate large test files for the platform")
    parser.add_argument("--type", choices=["csv", "json", "both"], default="both",
                        help="Type of file to generate (default: both)")
    parser.add_argument("--rows", type=int, default=700_000,
                        help="Number of rows/records (default: 700000 → ~600 MB CSV)")
    parser.add_argument("--output-dir", default=".", help="Output directory (default: current dir)")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)

    print(f"\n{'='*55}")
    print(f" Resilient Platform — Test Data Generator")
    print(f"{'='*55}")
    print(f" Type:       {args.type}")
    print(f" Rows:       {args.rows:,}")
    print(f" Output dir: {os.path.abspath(args.output_dir)}")
    print(f"{'='*55}\n")

    generated = []

    if args.type in ("csv", "both"):
        path = os.path.join(args.output_dir, "large_test.csv")
        generate_csv(path, args.rows)
        generated.append(path)

    if args.type in ("json", "both"):
        path = os.path.join(args.output_dir, "large_test.json")
        generate_json(path, args.rows)
        generated.append(path)

    print(f"\n{'='*55}")
    print(" Generated files:")
    for p in generated:
        size_mb = os.path.getsize(p) / 1024 / 1024
        print(f"  {size_mb:7.1f} MB  →  {os.path.abspath(p)}")
    print(f"{'='*55}")
    print("\n Upload one of these via the platform UI to test multipart upload.")
    print(" Job types to try:")
    print("   CSV: CSV_ROW_COUNT, CSV_COLUMN_STATS, CSV_DEDUPLICATE")
    print("   JSON: JSON_CANONICALIZE")


if __name__ == "__main__":
    main()
