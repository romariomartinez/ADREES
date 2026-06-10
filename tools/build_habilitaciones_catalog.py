from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pandas as pd


CODE_COLUMNS = ("codigo", "codigo_habilitacion", "codigohabilitacion", "codigo prestador")
NAME_COLUMNS = ("nombre", "razon social", "razonsocial")
DEPARTMENT_COLUMNS = ("depanombre", "departamento", "depto")
MUNICIPALITY_COLUMNS = ("muninombre", "municipio")


def clean_text(value: object) -> str:
    if pd.isna(value):
        return ""
    return re.sub(r"\s+", " ", str(value).replace("\xa0", " ")).strip()


def normalize_header(value: object) -> str:
    return re.sub(r"[^a-z0-9]+", "", clean_text(value).lower())


def extract_code(value: object) -> str:
    text = clean_text(value)
    text = re.sub(r"\.0$", "", text)
    digits = re.sub(r"\D+", "", text)
    return digits if len(digits) == 12 else ""


def find_column(df: pd.DataFrame, candidates: tuple[str, ...]) -> object | None:
    normalized = {normalize_header(column): column for column in df.columns}
    for candidate in candidates:
        key = normalize_header(candidate)
        if key in normalized:
            return normalized[key]
    return None


def read_source(path: Path, source_name: str) -> tuple[list[dict], int]:
    tables = pd.read_html(path, header=0)
    if not tables:
        return [], 0
    df = max(tables, key=len)
    code_column = find_column(df, CODE_COLUMNS)
    if code_column is None:
        raise ValueError(f"No encontre columna de codigo en {path.name}")

    name_column = find_column(df, NAME_COLUMNS)
    department_column = find_column(df, DEPARTMENT_COLUMNS)
    municipality_column = find_column(df, MUNICIPALITY_COLUMNS)

    records = []
    for _, row in df.iterrows():
        code = extract_code(row.get(code_column))
        if not code:
            continue
        name = clean_text(row.get(name_column)) if name_column is not None else ""
        department = clean_text(row.get(department_column)) if department_column is not None else ""
        municipality = clean_text(row.get(municipality_column)) if municipality_column is not None else ""
        records.append(
            {
                "code": code,
                "name": name,
                "department": department,
                "municipality": municipality,
                "source": source_name,
                "label": f"{code} - {name}" if name else code,
            }
        )
    return records, len(df)


def merge_records(records: list[dict]) -> list[dict]:
    merged: dict[str, dict] = {}
    for record in records:
        current = merged.get(record["code"])
        if current is None:
            merged[record["code"]] = {**record}
            continue
        sources = {part.strip() for part in current["source"].split(",") if part.strip()}
        sources.add(record["source"])
        current["source"] = ", ".join(sorted(sources))
        for key in ("name", "department", "municipality"):
            if len(record.get(key, "")) > len(current.get(key, "")):
                current[key] = record[key]
        current["label"] = f"{current['code']} - {current['name']}" if current.get("name") else current["code"]
    return sorted(
        merged.values(),
        key=lambda item: (
            item.get("department", "").casefold(),
            item.get("municipality", "").casefold(),
            item.get("name", "").casefold(),
            item["code"],
        ),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Genera catalogo de codigos de habilitacion IPS de 12 digitos.")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("sources", nargs="+", help="Formato: nombre=ruta.xls")
    args = parser.parse_args()

    all_records = []
    for source in args.sources:
        if "=" not in source:
            raise ValueError(f"Fuente invalida: {source}. Usa nombre=ruta.xls")
        source_name, raw_path = source.split("=", 1)
        records, rows = read_source(Path(raw_path), source_name.strip())
        all_records.extend(records)
        print(f"{source_name.strip()}: {len(records)} codigos de 12 digitos desde {rows} filas")

    items = merge_records(all_records)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Total unico: {len(items)} codigos")
    print(f"Archivo generado: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
