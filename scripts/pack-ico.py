#!/usr/bin/env python3
"""Pack raw BGRA frames into a classic multi-size Windows ICO.

Usage: pack-ico.py out.ico dir/
Reads <size>.bgra files (top-down 32-bit BGRA) and writes 32-bpp BMP entries.
"""
import os, struct, sys


def bmp_entry(bgra, size):
    header = struct.pack(
        "<IiiHHIIiiII",
        40,            # biSize
        size,          # biWidth
        size * 2,      # biHeight (XOR + AND)
        1,             # biPlanes
        32,            # biBitCount
        0,             # biCompression
        size * size * 4,
        0, 0, 0, 0,
    )
    stride = size * 4
    rows = []
    for y in range(size - 1, -1, -1):
        rows.append(bgra[y * stride:(y + 1) * stride])
    mask_stride = ((size + 31) // 32) * 4
    mask = b"\x00" * (mask_stride * size)
    return header + b"".join(rows) + mask


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    out, folder = sys.argv[1], sys.argv[2]
    sizes = sorted(
        int(f[:-5]) for f in os.listdir(folder)
        if f.endswith(".bgra") and f[:-5].isdigit()
    )
    entries, blobs = [], []
    offset = 6 + 16 * len(sizes)
    for size in sizes:
        with open(os.path.join(folder, str(size) + ".bgra"), "rb") as f:
            bgra = f.read()
        if len(bgra) != size * size * 4:
            raise SystemExit("bad frame %d: %d bytes" % (size, len(bgra)))
        blob = bmp_entry(bgra, size)
        dim = 0 if size >= 256 else size
        entries.append(struct.pack("<BBBBHHII", dim, dim, 0, 0, 1, 32, len(blob), offset))
        blobs.append(blob)
        offset += len(blob)
    with open(out, "wb") as f:
        f.write(struct.pack("<HHH", 0, 1, len(sizes)) + b"".join(entries) + b"".join(blobs))
    print("ico", os.path.basename(out), sizes)


if __name__ == "__main__":
    raise SystemExit(main())
