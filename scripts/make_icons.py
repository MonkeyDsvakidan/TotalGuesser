"""Erzeugt die App-Icons (Zielscheibe) für Homebildschirm und Browser-Tab.

Ausgabe in web/public/: apple-touch-icon.png (180 px), icon-192.png, icon-512.png.
Braucht Pillow: pip install pillow
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).parent.parent / "web" / "public"
BACKGROUND = "#161615"  # --bg im dunklen Modus
ACCENT = "#fb923c"  # --accent im dunklen Modus
# Ringe von aussen nach innen als Anteil der Kantenlänge; iOS rundet die Ecken selbst ab
RINGS = [(0.36, ACCENT), (0.28, BACKGROUND), (0.20, ACCENT), (0.12, BACKGROUND), (0.05, ACCENT)]
SUPERSAMPLE = 4


def icon(size: int) -> Image.Image:
    big = size * SUPERSAMPLE
    image = Image.new("RGB", (big, big), BACKGROUND)
    draw = ImageDraw.Draw(image)
    center = big / 2
    for radius, color in RINGS:
        r = radius * big
        draw.ellipse((center - r, center - r, center + r, center + r), fill=color)
    return image.resize((size, size), Image.LANCZOS)


def main() -> None:
    for name, size in (("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512)):
        icon(size).save(OUT / name, optimize=True)
        print(f"{name} ({size} px)")


if __name__ == "__main__":
    main()
