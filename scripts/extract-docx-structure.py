from __future__ import annotations

import sys
from pathlib import Path

from docx import Document
from docx.table import Table
from docx.text.paragraph import Paragraph


def iter_blocks(document: Document):
    for child in document.element.body.iterchildren():
        if child.tag.endswith("}p"):
            yield Paragraph(child, document)
        elif child.tag.endswith("}tbl"):
            yield Table(child, document)


source = Path(sys.argv[1])
start_marker = sys.argv[2] if len(sys.argv) > 2 else None
end_marker = sys.argv[3] if len(sys.argv) > 3 else None
document = Document(source)
sys.stdout.reconfigure(encoding="utf-8")
printing = start_marker is None

for block in iter_blocks(document):
    if isinstance(block, Paragraph):
        text = block.text.strip()
        is_heading = block.style.name.startswith("Heading")
        if start_marker and is_heading and text.startswith(start_marker):
            printing = True
        if end_marker and is_heading and text.startswith(end_marker):
            break
        if not printing:
            continue
        if text:
            print(f"[{block.style.name}] {text}")
        continue

    if not printing:
        continue
    print("[TABLE]")
    for row in block.rows:
        cells = [" ".join(cell.text.split()) for cell in row.cells]
        print(" | ".join(cells))
    print("[/TABLE]")
