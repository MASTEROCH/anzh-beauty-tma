from PIL import Image, ImageStat
import sys, pathlib

def runs(vals, thr):
    """Отрезки подряд идущих «контентных» индексов."""
    out, start = [], None
    for i, v in enumerate(vals):
        hot = v > thr
        if hot and start is None: start = i
        if not hot and start is not None:
            out.append((start, i - 1)); start = None
    if start is not None: out.append((start, len(vals) - 1))
    return out

def photo_box(path, thr=20):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    step = max(1, h // 300)
    rs = [max(ImageStat.Stat(im.crop((0, y, w, min(y + step, h)))).stddev) for y in range(0, h, step)]
    rr = [(a * step, min((b + 1) * step, h)) for a, b in runs(rs, thr)]
    if not rr: return None
    top, bot = max(rr, key=lambda t: t[1] - t[0])          # самый высокий блок = фотография
    band = im.crop((0, top, w, bot))
    stepx = max(1, w // 300)
    cs = [max(ImageStat.Stat(band.crop((x, 0, min(x + stepx, w), bot - top))).stddev) for x in range(0, w, stepx)]
    cc = [(a * stepx, min((b + 1) * stepx, w)) for a, b in runs(cs, thr)]
    if not cc: return None
    left, right = min(c[0] for c in cc), max(c[1] for c in cc)
    return left, top, right, bot

if __name__ == '__main__':
    for p in sys.argv[1:]:
        b = photo_box(p)
        im = Image.open(p)
        print(f'{p}  {im.size}  ->  {b}  доля { (b[3]-b[1])/im.size[1]:.2f} по высоте' if b else f'{p} — не найдено')
