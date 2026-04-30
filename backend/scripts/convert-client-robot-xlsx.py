import argparse
import json
import re
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {
    "x": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def col_index(cell_ref):
    letters = re.match(r"^[A-Z]+", cell_ref or "")
    if not letters:
        return 0
    value = 0
    for char in letters.group(0):
        value = value * 26 + ord(char) - ord("A") + 1
    return value - 1


def clean(value):
    if value is None:
        return ""
    return str(value).replace("\r\n", "\n").strip()


def excel_date(value):
    if value is None or value == "":
        return None
    if isinstance(value, str):
        raw = value.strip()
        if not raw or raw.lower() == "aucun":
            return None
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
            try:
                return datetime.strptime(raw, fmt).date().isoformat()
            except ValueError:
                pass
        try:
            value = float(raw)
        except ValueError:
            return None
    try:
        serial = float(value)
    except (TypeError, ValueError):
        return None
    if serial <= 0:
        return None
    return (datetime(1899, 12, 30) + timedelta(days=serial)).date().isoformat()


def read_entry(zip_file, name):
    with zip_file.open(name) as entry:
        return entry.read()


def read_shared_strings(zip_file):
    try:
        root = ET.fromstring(read_entry(zip_file, "xl/sharedStrings.xml"))
    except KeyError:
        return []

    strings = []
    for si in root.findall("x:si", NS):
        strings.append("".join(t.text or "" for t in si.findall(".//x:t", NS)))
    return strings


def workbook_sheets(zip_file):
    workbook = ET.fromstring(read_entry(zip_file, "xl/workbook.xml"))
    rels = ET.fromstring(read_entry(zip_file, "xl/_rels/workbook.xml.rels"))
    rel_map = {
        rel.attrib["Id"]: "xl/" + rel.attrib["Target"].lstrip("/")
        for rel in rels.findall("rel:Relationship", NS)
    }

    sheets = []
    for sheet in workbook.findall("x:sheets/x:sheet", NS):
        rid = sheet.attrib[f"{{{NS['r']}}}id"]
        sheets.append((sheet.attrib["name"], rel_map[rid]))
    return sheets


def read_sheet(zip_file, entry_name, shared_strings):
    root = ET.fromstring(read_entry(zip_file, entry_name))
    rows = {}

    for row in root.findall(".//x:sheetData/x:row", NS):
        row_index = int(row.attrib.get("r", "0"))
        cells = {}
        for cell in row.findall("x:c", NS):
            cell_type = cell.attrib.get("t")
            value_node = cell.find("x:v", NS)
            value = ""

            if cell_type == "s" and value_node is not None:
                idx = int(value_node.text or 0)
                value = shared_strings[idx] if idx < len(shared_strings) else ""
            elif cell_type == "inlineStr":
                text_node = cell.find("x:is/x:t", NS)
                value = text_node.text if text_node is not None else ""
            elif value_node is not None:
                value = value_node.text or ""

            cells[col_index(cell.attrib.get("r"))] = clean(value)
        rows[row_index] = cells
    return rows


def build_index(rows):
    entries = []
    for row_num in sorted(rows):
        row = rows[row_num]
        responsible = clean(row.get(0))
        name = clean(row.get(1))
        if not responsible or not name or name.upper() in {"MAINTENANCE ROBOT"}:
            continue
        if name.lower() in {"client", "deplacement"}:
            continue
        entries.append(
            {
                "name": name.upper(),
                "responsible": responsible.lower(),
                "commissioning_date": excel_date(row.get(11)),
                "attention": clean(row.get(12)),
            }
        )
    return entries


def parse_client_sheet(sheet_name, rows, client_meta):
    responsible = clean(rows.get(1, {}).get(0)) or client_meta.get("responsible", "")
    client = {
        "name": client_meta.get("name") or sheet_name.upper(),
        "responsible": responsible.lower(),
        "commissioning_date": client_meta.get("commissioning_date"),
        "attention": client_meta.get("attention", ""),
        "history": [],
        "maintenance_kits": [],
        "todos": [],
    }

    for row_num in sorted(rows):
        if row_num < 5:
            continue
        row = rows[row_num]

        history_date = excel_date(row.get(1))
        piece = clean(row.get(0))
        comment = clean(row.get(2))
        technician = clean(row.get(3))
        if history_date and (piece or comment or technician):
            client["history"].append(
                {
                    "date": history_date,
                    "piece": piece,
                    "comment": comment,
                    "technician": technician,
                }
            )

    return client


def convert(input_path, output_path):
    with zipfile.ZipFile(input_path) as zip_file:
        shared_strings = read_shared_strings(zip_file)
        sheets = workbook_sheets(zip_file)
        all_rows = [
            (name, read_sheet(zip_file, entry_name, shared_strings))
            for name, entry_name in sheets
        ]

    index_rows = all_rows[0][1]
    index_entries = build_index(index_rows)
    clients = []

    for idx, (sheet_name, rows) in enumerate(all_rows[1:]):
        meta = index_entries[idx] if idx < len(index_entries) else {}
        client = parse_client_sheet(sheet_name, rows, meta)
        if client["history"] or client["maintenance_kits"] or client["todos"]:
            clients.append(client)

    payload = {
        "source": Path(input_path).name,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "clients": clients,
    }

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    history_count = sum(len(client["history"]) for client in clients)
    kit_count = sum(len(client["maintenance_kits"]) for client in clients)
    todo_count = sum(len(client["todos"]) for client in clients)
    print(f"Clients: {len(clients)}")
    print(f"Anciennes interventions: {history_count}")
    print(f"Maintenances kit: {kit_count}")
    print(f"A prevoir sans date: {todo_count}")
    print(f"JSON: {output}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input")
    parser.add_argument(
        "--output",
        default=str(Path(__file__).resolve().parents[1] / "imports" / "client-robot-import.json"),
    )
    args = parser.parse_args()
    convert(args.input, args.output)


if __name__ == "__main__":
    main()
