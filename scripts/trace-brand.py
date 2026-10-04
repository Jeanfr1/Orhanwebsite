#!/usr/bin/env python3
"""Trace the kit's flat brand PNGs (ORHAN logo, O monogram) into SVG paths.

Both marks are a single flat silver on transparency, so their silhouette is all there is:
the alpha is upsampled, thresholded and traced (outer shapes and holes, even-odd fill).
The roteiro asks for a proper vector master for print; until it exists, these traces keep
the marks sharp on screen at any size. Fill is the brand silver (#DCE3E8).

Output: src/assets/brand/{logo,monogram,wordmark}.svg
Usage: python3 scripts/trace-brand.py   (needs opencv-python, numpy, Pillow)
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
KIT = ROOT / "design/source/kit/05-marca"
OUT = ROOT / "src/assets/brand"
UP = 4  # trace at 4x, write in source pixels


def trace(alpha, box, epsilon=0.9):
    x0, y0, x1, y1 = box
    a = alpha[y0:y1, x0:x1]
    a = np.pad(a, 4)
    big = cv2.resize(a, None, fx=UP, fy=UP, interpolation=cv2.INTER_CUBIC)
    _, bw = cv2.threshold(big, 127, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(bw, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    parts = []
    for c in contours:
        if cv2.contourArea(c) < 40 * UP * UP:
            continue
        c = cv2.approxPolyDP(c, epsilon, True)[:, 0, :].astype(float) / UP - 4
        pts = " ".join(f"{x:.1f} {y:.1f}" for x, y in c)
        parts.append(f"M{pts}Z")
    w, h = x1 - x0, y1 - y0
    return w, h, "".join(parts)


def write(name, w, h, d, title):
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" fill="#DCE3E8" role="img">'
        f"<title>{title}</title><path fill-rule=\"evenodd\" d=\"{d}\"/></svg>\n"
    )
    (OUT / name).write_text(svg)
    print(f"{name:16s} {w}x{h}  {len(svg) / 1024:.1f} KB")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    logo = np.array(Image.open(KIT / "orhan-logo-transparente.png").convert("RGBA"))[..., 3]
    mono = np.array(Image.open(KIT / "monograma-o-transparente.png").convert("RGBA"))[..., 3]
    # alpha boxes from manifesto-imagens.json; rows: O 174–576, ORHAN 620–812, tagline 844–885
    write("logo.svg", *trace(logo, (125, 174, 1410, 886)), "ORHAN Barber, St Albans")
    write("monogram.svg", *trace(mono, (544, 174, 966, 578)), "ORHAN")
    # the header sets BARBER · ST ALBANS in HTML (too small to read as part of a trace)
    write("wordmark.svg", *trace(logo, (125, 612, 1410, 820)), "ORHAN")


if __name__ == "__main__":
    main()
