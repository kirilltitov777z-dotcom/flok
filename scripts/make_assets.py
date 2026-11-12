#!/usr/bin/env python3
"""Flok asset generator — pure Python, no deps. Renders logo + splash."""
import math, os, struct, zlib
from multiprocessing import Pool, cpu_count

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets"))

def clamp(v, a=0.0, b=1.0): return max(a, min(b, v))
def mix(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
def smooth(e0, e1, x):
    t = clamp((x - e0) / (e1 - e0))
    return t * t * (3 - 2 * t)
def sd_rrect(x, y, cx, cy, hw, hh, r):
    qx, qy = abs(x - cx) - (hw - r), abs(y - cy) - (hh - r)
    return math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) - r

MINT = (0.45, 0.90, 0.76)
SKY  = (0.49, 0.65, 1.00)
VIO  = (0.73, 0.56, 1.00)
DARK = (0.05, 0.09, 0.12)

def over(dst, src, a):
    return (dst[0] * (1 - a) + src[0] * a, dst[1] * (1 - a) + src[1] * a, dst[2] * (1 - a) + src[2] * a)

def icon_color(x, y):
    d = sd_rrect(x, y, .5, .5, .5, .5, .235)
    if d > .0015: return (0, 0, 0, 0)
    t = clamp((x + y) * .5)
    c = mix(MINT, SKY, clamp(t * 1.7))
    c = mix(c, VIO, clamp((t - .45) * 1.9))
    g = math.exp(-(((x - .22) ** 2 + (y - .16) ** 2) / .045))
    c = over(c, (1, 1, 1), g * .32)
    g2 = math.exp(-(((x - .88) ** 2 + (y - .9) ** 2) / .09))
    c = over(c, VIO, g2 * .22)
    ds = sd_rrect(x, y, .505, .495, .30, .17, .115)
    if ds < .06: c = over(c, (0.02, 0.06, 0.09), .16 * (1 - smooth(-.01, .06, ds)))
    db = sd_rrect(x, y, .50, .455, .295, .155, .115)
    tail = math.hypot(x - .315, y - .625) - .062
    if db < 0 or tail < 0:
        c = over(c, (1, 0.995, 0.97), .95)
        tint = math.exp(-(((x - .42) ** 2 + (y - .36) ** 2) / .045))
        c = over(c, MINT, tint * .10)
        hl = math.exp(-(((x - .42) ** 2) / .028 + ((y - .355) ** 2) / .0022))
        c = over(c, (1, 1, 1), hl * .24)
    for dx in (.385, .50, .615):
        if math.hypot(x - dx, y - .465) < .031:
            c = over(c, DARK, .82)
    dd = abs(x - .765) + abs(y - .275)
    if dd < .062:
        c = over(c, (1, 1, 1), (1 - dd / .062) * .95)
    if d > -.012:
        c = over(c, (1, 1, 1), .24 * (1 - smooth(-.012, 0, d)))
    if d > -.02:
        c = over(c, (0.1, 0.2, 0.25), .10)
    return (c[0], c[1], c[2], 1.0)

def splat(c):
    return (int(clamp(c[0]) * 255 + .5), int(clamp(c[1]) * 255 + .5), int(clamp(c[2]) * 255 + .5), int(clamp(c[3]) * 255 + .5))

def icon_rows(args):
    y0, y1, size, inner = args
    ss = 2
    inv = 1.0 / (ss * ss)
    out = bytearray()
    for py in range(y0, y1):
        for px in range(size):
            r = g = b = a = 0.0
            for sy in range(ss):
                for sx in range(ss):
                    x = (px + (sx + .5) / ss) / size
                    y = (py + (sy + .5) / ss) / size
                    ux = (x - .5) / inner + .5
                    uy = (y - .5) / inner + .5
                    if 0 <= ux <= 1 and 0 <= uy <= 1:
                        cr, cg, cb, ca = icon_color(ux, uy)
                    else:
                        cr = cg = cb = ca = 0.0
                    r += cr * ca; g += cg * ca; b += cb * ca; a += ca
            a *= inv
            if a > 0:
                r *= inv / a; g *= inv / a; b *= inv / a
            out += bytes(splat((r, g, b, a)))
    return (y0, bytes(out))

def render_rows(size, inner, rows_fn):
    n = max(1, cpu_count() or 1)
    blocks = []
    step = max(1, size // n)
    for y in range(0, size, step):
        blocks.append((y, min(size, y + step), size, inner))
    try:
        with Pool(n) as p:
            parts = p.map(rows_fn, blocks)
    except Exception:
        parts = [rows_fn(b) for b in blocks]
    data = bytearray()
    for y0, chunk in sorted(parts):
        data += chunk
    return data

def png_bytes(data, W, H):
    raw = b"".join(b"\x00" + bytes(data[y*W*4:(y+1)*W*4]) for y in range(H))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))

def save_icon(path, size, inner=1.0):
    data = render_rows(size, inner, icon_rows)
    with open(path, "wb") as f: f.write(png_bytes(data, size, size))
    print("icon", os.path.basename(path), size, "inner", inner, flush=True)

def splash_rows(args):
    y0, y1, W, H = args
    ss = 2
    data = bytearray()
    for py in range(y0, y1):
        for px in range(W):
            r = g = b = 0.0
            for sy in range(ss):
                for sx in range(ss):
                    x = (px + (sx + .5) / ss) / W
                    y = (py + (sy + .5) / ss) / H
                    c = mix((0.035, 0.055, 0.075), (0.07, 0.10, 0.13), clamp(x * .4 + y * .8))
                    d1 = math.hypot(x - .22, y - .32)
                    c = over(c, MINT, .16 * math.exp(-(d1 * d1) / .035))
                    d2 = math.hypot(x - .85, y - .70)
                    c = over(c, VIO, .15 * math.exp(-(d2 * d2) / .05))
                    s = 0.34 * W
                    ix = (px + (sx + .5) / ss - W / 2) / s + .5
                    iy = (py + (sy + .5) / ss - H * .43) / s + .5
                    if 0 <= ix <= 1 and 0 <= iy <= 1:
                        ic = icon_color(ix, iy)
                        if ic[3] > 0: c = over(c, ic[:3], ic[3])
                    rr = math.hypot(x - .5, (y - .43) * H / W)
                    ring = 1 - smooth(0, .0035, abs(rr - .255))
                    c = over(c, (1, 1, 1), ring * .10)
                    r += c[0]; g += c[1]; b += c[2]
            o = int(clamp(r / (ss*ss)) * 255 + .5)
            o2 = int(clamp(g / (ss*ss)) * 255 + .5)
            o3 = int(clamp(b / (ss*ss)) * 255 + .5)
            data += bytes((o, o2, o3, 255))
    return (y0, bytes(data))

def save_splash(path, W, H):
    n = max(1, cpu_count() or 1)
    blocks, step = [], max(1, H // n)
    for y in range(0, H, step):
        blocks.append((y, min(H, y + step), W, H))
    try:
        with Pool(n) as p:
            parts = p.map(splash_rows, blocks)
    except Exception:
        parts = [splash_rows(b) for b in blocks]
    data = bytearray()
    for y0, chunk in sorted(parts):
        data += chunk
    with open(path, "wb") as f: f.write(png_bytes(data, W, H))
    print("splash", os.path.basename(path), W, H, flush=True)

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    save_icon(os.path.join(OUT, "icon.png"), 1024)
    save_icon(os.path.join(OUT, "icon-foreground.png"), 1024, inner=.66)
    save_splash(os.path.join(OUT, "splash.png"), 540, 960)
    print("cpu", cpu_count())
