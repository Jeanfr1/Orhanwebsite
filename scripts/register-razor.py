#!/usr/bin/env python3
"""Measure how the razor layers fit together, and write the geometry the hero reads.

The kit's parts (blade, chrome support, navy handle) and the closed razor were generated
separately from the open razor, so they do not register pixel for pixel (ROTEIRO-DE-MONTAGEM:
"ajustar escala/posição ... sem presumir correspondência perfeita"). This script measures
instead of guessing, and every layer gets a pose on the open razor's 1536 x 1024 frame
(centre of its alpha box, in-plane angle in CSS degrees, scale):

1. the blade is found on navalha-montada.png by masked template matching over a sweep of
   scales and angles (it is fully visible there);
2. the support is mostly hidden under the blade and the handle has a flat navy face, so both
   are fitted on two points measured on zoomed grids: the pivot and the far end;
3. the closed razor is fitted the same way on the open razor's handle (pivot and handle end),
   so closing reads as the blade folding into a handle that stays put;
4. the separation reuses the spacing of navalha-explodida.png, across the blade axis;
5. hand-measured points for what has no template: the fade line in the opening photos, the
   lit edge in the macro, the counter of the O and the razor inside the monogram.

Output: src/data/razor.json
Usage: python3 scripts/register-razor.py   (needs opencv-python, numpy, Pillow)
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
KIT = ROOT / "design/source/kit"
OUT = ROOT / "src/data/razor.json"

PIVOT = (900, 340)  # rivet of the open razor
# measured pairs: (point on the layer's own PNG, same point on navalha-montada.png)
FITS = {
    "support": [((966, 525), PIVOT), ((1421, 692), (1384, 507))],  # pivot hole, tip of the hook
    "handle": [((231, 654), PIVOT), ((1451, 937), (1474, 965))],  # pivot rivet, end of the handle
    "closed": [((1382, 757), PIVOT), ((67, 275), (1474, 965))],  # pivot rivet, end of the handle
}


def rgba(path):
    return np.array(Image.open(path).convert("RGBA")).astype(np.float32)


def flat(img):
    """premultiplied grey: transparent areas read as black on both sides"""
    a = img[..., 3:4] / 255
    return cv2.cvtColor((img[..., :3] * a).astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32)


def alpha_box(img, threshold=8):
    ys, xs = np.nonzero(img[..., 3] > threshold)
    return [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]


def pose_template(crop, angle, scale):
    """rotate (CSS sense) and scale a cropped RGBA layer around its centre, canvas expanded"""
    h, w = crop.shape[:2]
    m = cv2.getRotationMatrix2D((w / 2, h / 2), -angle, scale)
    c, s = abs(m[0, 0]), abs(m[0, 1])
    W, H = int(h * s + w * c) + 2, int(h * c + w * s) + 2
    m[0, 2] += W / 2 - w / 2
    m[1, 2] += H / 2 - h / 2
    return cv2.warpAffine(crop, m, (W, H), flags=cv2.INTER_AREA, borderValue=(0, 0, 0, 0))


def match(target, crop, angles, scales, down):
    tgt = cv2.resize(flat(target), None, fx=1 / down, fy=1 / down, interpolation=cv2.INTER_AREA)
    best = None
    for a in angles:
        for s in scales:
            t = pose_template(crop, a, s / down)
            if t.shape[0] >= tgt.shape[0] or t.shape[1] >= tgt.shape[1]:
                continue
            mask = (t[..., 3] > 200).astype(np.float32)
            r = cv2.matchTemplate(tgt, flat(t), cv2.TM_SQDIFF, mask=mask) / max(mask.sum(), 1)
            mn, _, loc, _ = cv2.minMaxLoc(r)
            if best is None or mn < best[0]:
                best = (mn, float(a), float(s), (loc[0] + t.shape[1] / 2) * down, (loc[1] + t.shape[0] / 2) * down)
    return best


def locate(layer, target):
    x0, y0, x1, y1 = alpha_box(layer)
    crop = layer[y0:y1, x0:x1]
    b = match(target, crop, np.arange(-4, 4.01, 2), np.arange(0.75, 1.101, 0.03), 4)
    b = match(target, crop, np.arange(b[1] - 2, b[1] + 2.01, 0.5), np.arange(b[2] - 0.03, b[2] + 0.031, 0.01), 2)
    b = match(target, crop, np.arange(b[1] - 0.5, b[1] + 0.51, 0.25), np.arange(b[2] - 0.01, b[2] + 0.011, 0.005), 1)
    _, a, s, cx, cy = b
    return {"box": [x0, y0, x1, y1], "x": round(cx, 1), "y": round(cy, 1), "rot": round(a, 2), "scale": round(s, 3)}


def fit(layer, pairs):
    """similarity transform from two point pairs, expressed as a pose of the layer's alpha box"""
    (a1, b1), (a2, b2) = [(np.array(a, float), np.array(b, float)) for a, b in pairs]
    va, vb = a2 - a1, b2 - b1
    s = np.linalg.norm(vb) / np.linalg.norm(va)
    rot = np.arctan2(vb[1], vb[0]) - np.arctan2(va[1], va[0])
    box = alpha_box(layer)
    c = np.array([(box[0] + box[2]) / 2, (box[1] + box[3]) / 2])
    d = c - a1
    R = np.array([[np.cos(rot), -np.sin(rot)], [np.sin(rot), np.cos(rot)]])
    x, y = b1 + s * (R @ d)
    deg = (np.degrees(rot) + 180) % 360 - 180
    return {"box": box, "x": round(float(x), 1), "y": round(float(y), 1), "rot": round(float(deg), 2), "scale": round(float(s), 3)}


def main():
    open_img = rgba(KIT / "02-animacao/navalha-montada.png")
    files = {"blade": "lamina.png", "support": "suporte.png", "handle": "cabo.png"}
    layers = {k: rgba(KIT / "02-animacao" / f) for k, f in files.items()}
    closed = rgba(KIT / "02-animacao/navalha-fechada.png")

    poses = {"blade": locate(layers["blade"], open_img)}
    poses["support"] = fit(layers["support"], FITS["support"])
    poses["handle"] = fit(layers["handle"], FITS["handle"])

    # direction across the blade on the open razor (alpha PCA of lamina.png + its pose), pointing down
    a = layers["blade"][..., 3]
    ys, xs = np.nonzero(a > 128)
    _, vecs = np.linalg.eigh(np.cov(np.stack([xs - xs.mean(), ys - ys.mean()])))
    ang = np.radians(np.degrees(np.arctan2(vecs[1, 1], vecs[0, 1])) + poses["blade"]["rot"])
    n = np.array([-np.sin(ang), np.cos(ang)])
    if n[1] < 0:
        n = -n

    # spacing of the exploded reference (the parts' own frames are laid out like it), on that axis
    def centre(img):
        ys, xs = np.nonzero(img[..., 3] > 128)
        return np.array([xs.mean(), ys.mean()])

    c = {k: centre(v) for k, v in layers.items()}
    k = poses["blade"]["scale"]
    spread = {name: round(float((c[name] - c["support"]) @ n * k), 1) for name in files}

    data = {
        "canvas": {"width": int(open_img.shape[1]), "height": int(open_img.shape[0])},
        # measured on the open razor: pivot rivet, middle of the blade's end, end of the handle
        "open": {"box": alpha_box(open_img), "pivot": list(PIVOT), "tip": [78, 128], "handleEnd": list(FITS["handle"][1][1])},
        "across": [round(float(n[0]), 4), round(float(n[1]), 4)],
        "parts": {name: {**poses[name], "spread": spread[name]} for name in files},
        "closed": fit(closed, FITS["closed"]),
        # monograma-o-transparente.png (alpha box), measured: the counter of the O and the razor in it
        "mono": {"box": [544, 174, 966, 578], "counter": {"cx": 752, "cy": 374, "rx": 118, "ry": 176},
                 "pivot": [785, 548], "tip": [946, 348]},
        # macro-fio-navalha.png, measured: the lit cutting edge, from the tip towards the pivot
        # (plus the blade's end and the pivot, to hand over to the open razor)
        "macro": {"width": 1672, "height": 941, "edge": [[240, 795], [560, 696], [860, 589], [1040, 525], [1260, 446], [1500, 361]],
                  "tip": [210, 650], "pivot": [1600, 102]},
        # the fade line in the opening photos, back of the head to the temple
        "fade": {
            "desktop": {"width": 1672, "height": 941,
                        "points": [[1092, 352], [1120, 330], [1160, 316], [1205, 309], [1250, 311], [1292, 322], [1316, 340], [1330, 368]]},
            "mobile": {"width": 1086, "height": 1448,
                       "points": [[492, 938], [530, 914], [580, 901], [632, 899], [672, 906], [698, 928], [708, 958]]},
        },
        # look-01-signature-fade.png (= retrato-final-transparente.png, same frame): the head, hair to beard
        "portrait": {"width": 1086, "height": 1448, "head": {"cx": 575, "cy": 495, "h": 770}},
    }
    OUT.write_text(json.dumps(data, indent=2) + "\n")
    for name in ("blade", "support", "handle"):
        print(name, data["parts"][name])
    print("closed", data["closed"], "across", data["across"])


if __name__ == "__main__":
    main()
