# -*- coding: utf-8 -*-
"""Buat ikon PWA dari desain sederhana (Pillow)."""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "icons")
BASE = "#072b28"
TEAL = "#5eead4"
TEAL_LIGHT = "#99f6e4"
SIZE = 1024


def design(size=SIZE, scale=1.0):
    img = Image.new("RGBA", (size, size), BASE)
    draw = ImageDraw.Draw(img)

    # glow lembut di belakang simbol
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((size * 0.18, size * 0.16, size * 0.82, size * 0.84), fill=(94, 234, 212, 38))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.06))
    img.alpha_composite(glow)

    def s(v):
        return int(size * v)

    cx = size / 2
    # silinder database
    left, right = cx - 190 * scale, cx + 190 * scale
    top, bottom = 350 * scale, 735 * scale
    draw.ellipse((left, top - 58 * scale, right, top + 58 * scale), outline=TEAL, width=max(8, int(26 * scale)))
    draw.line((left, top, left, bottom), fill=TEAL, width=max(8, int(26 * scale)))
    draw.line((right, top, right, bottom), fill=TEAL, width=max(8, int(26 * scale)))
    draw.arc((left, bottom - 58 * scale, right, bottom + 58 * scale), 0, 180, fill=TEAL, width=max(8, int(26 * scale)))
    draw.arc((left, top + 132 * scale, right, top + 248 * scale), 0, 180, fill=TEAL_LIGHT, width=max(6, int(18 * scale)))

    # garis tren naik
    points = [
        (cx - 260 * scale, 760 * scale),
        (cx - 95 * scale, 600 * scale),
        (cx + 10 * scale, 655 * scale),
        (cx + 235 * scale, 405 * scale),
    ]
    draw.line(points, fill=TEAL_LIGHT, width=max(8, int(24 * scale)), joint="curve")
    ax, ay = points[-1]
    draw.polygon([
        (ax + 8 * scale, ay - 68 * scale),
        (ax + 68 * scale, ay - 6 * scale),
        (ax - 58 * scale, ay + 2 * scale),
    ], fill=TEAL_LIGHT)

    return img


def save(img, name, size):
    img.resize((size, size), Image.LANCZOS).save(f"{OUT}/{name}", optimize=True)
    print(name, size)


os.makedirs(OUT, exist_ok=True)
base = design()
save(base, "icon-512.png", 512)
save(base, "icon-192.png", 192)
save(base, "apple-touch-icon.png", 180)
save(base, "favicon-32.png", 32)
maskable = Image.new("RGBA", (SIZE, SIZE), BASE)
inner = base.resize((int(SIZE * 0.8), int(SIZE * 0.8)), Image.LANCZOS)
maskable.alpha_composite(inner, (int(SIZE * 0.1), int(SIZE * 0.1)))
save(maskable, "icon-maskable-512.png", 512)
