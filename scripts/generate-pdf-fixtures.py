from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas


OUTPUT = Path(__file__).parents[1] / "src" / "lib" / "documents" / "__fixtures__"
OUTPUT.mkdir(parents=True, exist_ok=True)


def textual_pdf() -> None:
    path = OUTPUT / "textual.pdf"
    document = canvas.Canvas(str(path), pagesize=A4)
    document.setTitle("Fixture textual Radar Concursos")
    document.drawString(72, 790, "RADAR CONCURSOS — EDITAL DE TESTE LOCAL")
    for index in range(1, 13):
        document.drawString(72, 790 - index * 28, f"Item {index}: conteúdo textual verificável para testar a extração de PDF sem acesso à internet.")
    document.save()


def image_only_pdf() -> None:
    path = OUTPUT / "scanned.pdf"
    document = canvas.Canvas(str(path), pagesize=A4)
    document.setTitle("Fixture sem camada de texto")
    document.setFillGray(0.92)
    document.rect(60, 120, 475, 650, fill=1, stroke=0)
    document.setStrokeGray(0.45)
    for y in range(160, 740, 24):
        document.line(90, y, 505, y)
    document.save()


if __name__ == "__main__":
    textual_pdf()
    image_only_pdf()
