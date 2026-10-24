#!/usr/bin/env python3
"""WAYFARER art generator: draws every sprite/strip as pixel art with Pillow and writes assets/*.png + manifest.json.

Run from the project root:  python3 tools/make_art.py
Look: Sonic-bright islands under a luminous sunset. Everything is drawn at 1.5x the old density
(the game renders at 480x270), with a 1px deep-indigo outline and a warm rim-light on the sun side.
Sprites are anchored bottom-centre; names in manifest.json are what src/assets.js exposes as SPR[name].
"""
import json, math, os, random
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUTDIR = os.path.join(ROOT, 'assets')
os.makedirs(OUTDIR, exist_ok=True)


def H(s, a=255):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


# ---------------------------------------------------------------- palette ramps (dark -> light)
OUT = H('#1b1034')
WARM = H('#ffd68a')
GREEN = [H(c) for c in ('#0f5a2a', '#1f8a3a', '#38b43a', '#6fd44a', '#b6f06a')]
JUNG = [H(c) for c in ('#07402e', '#0f6a46', '#1c9358', '#3cc070', '#8ae88a')]
EARTH = [H(c) for c in ('#5a2a14', '#8a4a22', '#c4622a', '#f08a3c', '#ffc070')]
GOLD = [H(c) for c in ('#8a3d00', '#d97a00', '#ffb81c', '#ffe066', '#fff8c2')]
WOOD = [H(c) for c in ('#4a2414', '#7a4020', '#b0703a', '#dca060', '#f6cf90')]
STONE = [H(c) for c in ('#4a3a5e', '#7a6a8c', '#aa9aae', '#d8c8c8', '#fff0e4')]
SAND = [H(c) for c in ('#8a5a3a', '#c48a50', '#e8b468', '#f8d890', '#fff0c0')]
WATER = [H(c) for c in ('#0b5a8a', '#1a8ab0', '#4cc4c8', '#9ae8e0', '#e0fff4')]
PINK = [H(c) for c in ('#6a1a5a', '#a02a78', '#e0488f', '#ff7a9a', '#ffc0c8')]
RED = [H(c) for c in ('#6a1428', '#a82038', '#e03a4a', '#ff6a6a', '#ffb0a0')]
TEAL = [H(c) for c in ('#0a4a5a', '#12808a', '#1fb0b8', '#5adcd0', '#b0f4e8')]
CREAM = H('#fff4e0')
BAY = [[0, 2], [3, 1]]


def mix(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


def pick(ramp, v, x=0, y=0):
    """ramp colour for v in 0..1 with 2x2 ordered dither (cel-style shading)."""
    f = v * (len(ramp) - 1) + (BAY[y & 1][x & 1] / 4.0 - 0.375) * 0.9
    return ramp[max(0, min(len(ramp) - 1, int(round(f))))]


class Cv:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    def rect(self, x, y, w, h, c):
        if w > 0 and h > 0:
            self.d.rectangle([int(x), int(y), int(x + w - 1), int(y + h - 1)], fill=c)

    def px(self, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            self.im.putpixel((x, y), c)

    def disc(self, cx, cy, rx, ry, c):
        self.d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=c)

    def poly(self, pts, c):
        self.d.polygon(pts, fill=c)

    def line(self, pts, c, w=1):
        self.d.line(pts, fill=c, width=w)

    def erase_disc(self, cx, cy, rx, ry):
        self.d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(0, 0, 0, 0))

    def ball(self, cx, cy, rx, ry, ramp, light=(-0.6, -0.7), gain=1.0):
        for y in range(int(cy - ry), int(cy + ry) + 1):
            for x in range(int(cx - rx), int(cx + rx) + 1):
                dx, dy = (x + .5 - cx) / rx, (y + .5 - cy) / ry
                d = dx * dx + dy * dy
                if d <= 1:
                    nz = math.sqrt(1 - d)
                    l = 0.5 + 0.5 * (-(dx * light[0] + dy * light[1]) * 0.75 + nz * 0.5)
                    self.px(x, y, pick(ramp, max(0, min(1, l * gain)), x, y))

    def slab(self, x, y, w, h, ramp, horizontal=False):
        """box shaded as a cylinder-ish slab: light from the left (or top)."""
        for j in range(h):
            for i in range(w):
                t = (j / max(1, h - 1)) if horizontal else (i / max(1, w - 1))
                v = 0.95 - t * 0.85
                if (j == 0 if horizontal else i == 0):
                    v = 1.0
                self.px(x + i, y + j, pick(ramp, v, x + i, y + j))


def finish(cv, rim=0.38, outline=OUT, pad=1):
    """add warm rim-light on the sun side (up/left edges) and a 1px outline; returns a new Image."""
    w, h = cv.im.size
    out = Image.new('RGBA', (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    out.paste(cv.im, (pad, pad))
    src = out.copy().load()
    px = out.load()
    W, Hh = out.size
    for y in range(Hh):
        for x in range(W):
            a = src[x, y][3]
            if a > 0 and rim:
                up = src[x, y - 1][3] if y > 0 else 0
                lf = src[x - 1, y][3] if x > 0 else 0
                if up == 0 or lf == 0:
                    px[x, y] = mix(src[x, y], WARM, rim)
            elif a == 0 and outline:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < W and 0 <= yy < Hh and src[xx, yy][3] > 0:
                        px[x, y] = outline
                        break
    return out


SPRITES = {}   # name -> (Image, meta)


def add(name, im, **meta):
    SPRITES[name] = (im, meta)


# ---------------------------------------------------------------- tiny 3x5 font for sign labels
FONT = {'A': '010101111101101', 'B': '110101110101110', 'C': '011100100100011', 'D': '110101101101110',
        'E': '111100110100111', 'F': '111100110100100', 'G': '011100101101011', 'H': '101101111101101',
        'I': '111010010010111', 'J': '001001001101010', 'K': '101101110101101', 'L': '100100100100111',
        'M': '101111111101101', 'N': '110101101101101', 'O': '010101101101010', 'P': '110101110100100',
        'R': '110101110101101', 'S': '011100010001110', 'T': '111010010010010', 'U': '101101101101111',
        'V': '101101101101010', 'W': '101101111111101', 'Y': '101101010010010'}


def text(cv, s, x, y, col, sc=2):
    for i, ch in enumerate(s):
        g = FONT.get(ch)
        if not g:
            continue
        for k in range(15):
            if g[k] == '1':
                cv.rect(x + i * 4 * sc + (k % 3) * sc, y + (k // 3) * sc, sc, sc, col)


# ================================================================ GAMEPLAY SPRITES
def make_coins():
    n = 8
    for i in range(n):
        th = i * math.pi / n * 2 * (n / 8)
        c = math.cos(th)
        rx = max(1, round(9 * abs(c)))
        cv = Cv(20, 20)
        cx, cy = 10, 10
        cv.ball(cx, cy, rx, 9, GOLD[:4] if abs(c) > 0.35 else GOLD[:3], gain=1.0)
        if rx >= 5:                                   # embossed inner ring + star mark
            cv.d.ellipse([cx - rx + 3, cy - 6, cx + rx - 3, cy + 6], outline=GOLD[1])
            cv.rect(cx - 1, cy - 3, 2, 6, GOLD[1])
            cv.rect(cx - 3, cy - 1, 6, 2, GOLD[1]) if rx >= 7 else None
            cv.px(cx - rx + 3, cy - 4, GOLD[4]); cv.px(cx - rx + 4, cy - 5, GOLD[4])
        if i == 0:                                    # glint
            for dx, dy in ((14, 3), (13, 3), (15, 3), (14, 2), (14, 4)):
                cv.px(dx, dy, GOLD[4])
        add('coin%d' % i, finish(cv, rim=0.2))
    # pickup burst: 4-frame sparkle (no outline)
    for k in range(4):
        cv = Cv(40, 40)
        r = 5 + k * 5
        col = [GOLD[4], GOLD[3], GOLD[2], GOLD[1]][k]
        cx = cy = 20
        for ang in range(8):
            a = ang * math.pi / 4
            for rr in range(r - 3, r + 1):
                cv.px(cx + math.cos(a) * rr, cy + math.sin(a) * rr, col)
        for rr in range(-(3 + k), 4 + k):
            cv.px(cx + rr, cy, GOLD[4] if k < 2 else GOLD[3]); cv.px(cx, cy + rr, GOLD[4] if k < 2 else GOLD[3])
        add('burst%d' % k, cv.im.copy())


THEMES = ('shore', 'jungle', 'cliffs')


def make_crates():
    for th in THEMES:
        cv = Cv(40, 22)
        base = {'shore': WOOD, 'jungle': WOOD, 'cliffs': SAND}[th]
        cv.slab(0, 0, 40, 22, base)
        cv.rect(0, 0, 40, 2, base[3]); cv.rect(0, 20, 40, 2, base[0])
        cv.rect(3, 3, 34, 16, base[1])                                    # inset panel
        cv.slab(4, 4, 32, 14, base)
        cv.line([(5, 17), (35, 5)], base[0], 2)                           # brace
        cv.line([(5, 16), (35, 4)], base[4], 1)
        for (rx, ry) in ((1, 1), (35, 1), (1, 17), (35, 17)):             # corner plates
            cv.rect(rx, ry, 4, 4, STONE[2]); cv.px(rx + 1, ry + 1, STONE[4]); cv.px(rx + 2, ry + 2, STONE[0])
        if th == 'shore':                                                # sunset-pink painted band + gold studs
            cv.rect(15, 0, 10, 22, PINK[2]); cv.rect(15, 0, 2, 22, PINK[3]); cv.rect(23, 0, 2, 22, PINK[1])
            for yy in (4, 17):
                cv.px(19, yy, GOLD[3]); cv.px(20, yy, GOLD[3])
        elif th == 'jungle':                                             # moss + dripping vine
            for x in range(2, 38, 3):
                cv.rect(x, 0, 3, 2 + (x * 7) % 3, JUNG[3])
            cv.rect(8, 2, 2, 9, JUNG[2]); cv.rect(8, 10, 3, 2, JUNG[3]); cv.rect(30, 2, 2, 12, JUNG[2]); cv.px(31, 14, JUNG[4])
        else:                                                            # coast crate: orange paint + cream stripes
            cv.rect(0, 9, 40, 4, EARTH[3]); cv.rect(0, 9, 40, 1, EARTH[4]); cv.rect(0, 12, 40, 1, EARTH[1])
            for x in range(2, 38, 8):
                cv.rect(x, 9, 3, 4, CREAM)
        add('crate_' + th, finish(cv))


def make_barriers():
    for th in THEMES:
        cv = Cv(94, 14)
        if th == 'shore':                      # striped bumper bar on two carved posts
            for x in (3, 82):
                cv.slab(x, 4, 9, 10, WOOD); cv.rect(x - 1, 3, 11, 2, WOOD[3])
            cv.slab(0, 0, 94, 9, RED, horizontal=True)
            # candy stripes, shaded so the bar reads as lit from above
            for x in range(-8, 94, 12):
                for yy in range(9):
                    for xx in range(6):
                        t = yy / 8.0
                        cv.px(x + yy + xx, yy, pick([H('#d8c8b0'), CREAM, H('#ffffff')], 1 - t, x, yy))
            cv.rect(0, 0, 94, 1, H('#ffffff'))
        elif th == 'jungle':                   # fallen mossy log
            cv.slab(2, 2, 90, 11, WOOD, horizontal=True)
            for x in range(8, 90, 14):
                cv.rect(x, 3, 1, 9, WOOD[0])
            cv.rect(4, 2, 86, 3, JUNG[2]); cv.rect(6, 2, 20, 2, JUNG[3]); cv.rect(52, 2, 24, 2, JUNG[3])
            cv.ball(5, 8, 4, 6, SAND)
            cv.d.ellipse([2, 5, 8, 11], outline=WOOD[1])
            cv.rect(30, 0, 3, 3, WOOD[1]); cv.rect(31, 0, 5, 2, JUNG[3]); cv.rect(66, 0, 3, 3, WOOD[1])
        else:                                  # coast: low rough stone wall with orange lichen
            rnd = random.Random(7)
            x = 0
            while x < 94:
                w = rnd.randint(14, 24)
                cv.ball(x + w // 2, 8, w // 2, 6, STONE)
                x += w - 3
            cv.rect(0, 11, 94, 3, STONE[1])
            for x in range(4, 90, 10):
                cv.rect(x, 3, 4, 2, EARTH[3]); cv.px(x + 1, 3, EARTH[4])
        add('barrier_' + th, finish(cv))


def make_overheads():
    for th in THEMES:
        cv = Cv(142, 82)
        post = {'shore': WOOD, 'jungle': JUNG, 'cliffs': STONE}[th]
        for x in (0, 130):                                      # posts
            if th == 'shore':                                   # carved colour-block totem posts
                cv.slab(x, 0, 12, 82, WOOD)
                for yy, col in ((14, PINK), (34, TEAL), (54, GOLD)):
                    cv.slab(x, yy, 12, 10, col)
                    cv.rect(x + 3, yy + 3, 2, 2, CREAM); cv.rect(x + 7, yy + 3, 2, 2, CREAM)
            elif th == 'jungle':                                # vine-wrapped trunks
                cv.slab(x, 0, 12, 82, WOOD)
                for yy in range(4, 80, 9):
                    cv.line([(x, yy), (x + 11, yy + 5)], JUNG[2], 2); cv.px(x + 3, yy, JUNG[4])
            else:                                               # sandstone columns with banding
                cv.slab(x, 0, 12, 82, STONE)
                for yy in (18, 40, 62):
                    cv.rect(x, yy, 12, 3, STONE[3]); cv.rect(x, yy + 3, 12, 1, STONE[0])
        lint = {'shore': WOOD, 'jungle': WOOD, 'cliffs': STONE}[th]
        cv.slab(0, 0, 142, 13, lint, horizontal=True)           # lintel
        cv.rect(0, 0, 142, 2, lint[4])
        if th == 'shore':                                       # sunset banner with pennant scallops
            for x in range(12, 130):
                top = 13
                bot = 58 + (4 if (x // 8) % 2 else 0)
                for yy in range(top, bot):
                    t = (yy - top) / (bot - top)
                    stripe = ((x - 12) // 14) % 2
                    cv.px(x, yy, pick(PINK if stripe else GOLD, 0.95 - t * 0.55 - (0.12 if x > 100 else 0), x, yy))
            for x in range(12, 130, 14):
                cv.rect(x, 13, 1, 45, PINK[0] if ((x - 12) // 14) % 2 else GOLD[0])
            cv.ball(71, 34, 11, 11, GOLD); cv.ball(71, 34, 6, 6, PINK)
        elif th == 'jungle':                                    # hanging vines with leaves
            rnd = random.Random(3)
            for x in range(14, 130, 6):
                ln = rnd.randint(28, 46)
                cv.rect(x, 13, 3, ln, JUNG[1]); cv.rect(x, 13, 1, ln, JUNG[3]); cv.rect(x + 2, 13, 1, ln, JUNG[0])
                cv.disc(x + 1, 13 + ln, 3, 3, JUNG[2]); cv.px(x, 13 + ln - 1, JUNG[4])
                if ln > 36:
                    cv.rect(x + 3, 13 + ln // 2, 5, 3, JUNG[3])
        else:                                                   # coast: rope net with coral tassels
            for x in range(14, 130, 9):
                cv.rect(x, 13, 1, 44, WOOD[3])
            for yy in range(18, 56, 9):
                cv.rect(12, yy, 118, 1, WOOD[3]); cv.rect(12, yy + 1, 118, 1, WOOD[0])
            for x in range(14, 130, 18):
                cv.ball(x, 58, 4, 5, RED)
        add('over_' + th, finish(cv))


def trim_bottom(im):
    """drop empty rows under the lowest opaque pixel so the sprite's bottom edge is its ground contact."""
    bb = im.getbbox()
    return im.crop((0, 0, im.width, bb[3])) if bb else im


def make_runner():
    # leg bottoms / arm tops per run frame: contact, pass, contact, pass
    RUN = [dict(l=41, r=36, la=17, ra=14, bob=1), dict(l=40, r=38, la=16, ra=16, bob=0),
           dict(l=36, r=41, la=14, ra=17, bob=1), dict(l=38, r=40, la=16, ra=16, bob=0)]
    SKIN, HAIR, BOOT = H('#f2b88a'), H('#5a3020'), H('#2a1840')
    PANTS = [H('#4a2418'), H('#7a3a2a'), H('#b86a48')]
    CAP = [H('#6a1a40'), H('#a02a5a'), H('#d63a6a'), H('#ff6a8a'), H('#ffb0c0')]
    PACK = [H('#6a1a28'), H('#a02838'), H('#d8404a'), H('#ff7060'), H('#ffb090')]

    def draw(kind, f=0):
        cv = Cv(26, 44)
        q = RUN[f] if kind == 'run' else dict(l=36, r=37, la=14, ra=14, bob=0)
        by = q['bob']
        top = 0 if kind != 'slide' else 14

        def leg(x, y0, bot):
            cv.slab(x, y0, 6, bot - 3 - y0, PANTS)
            cv.rect(x - 1, bot - 3, 8, 3, BOOT); cv.rect(x, bot - 3, 3, 1, H('#7a5a8a'))
        if kind != 'slide':
            leg(7, top + 27 + by, q['l']); leg(14, top + 27 + by, q['r'])
        cv.slab(7, top + 15 + by, 13, 14, PACK)                          # backpack
        cv.rect(9, top + 18 + by, 9, 2, PACK[1])                           # flap
        cv.rect(11, top + 23 + by, 5, 3, GOLD[2]); cv.rect(11, top + 23 + by, 5, 1, GOLD[3])
        cv.slab(5, top + 19 + by, 4, 9, TEAL); cv.slab(18, top + 19 + by, 4, 9, TEAL)   # jacket sides
        cv.slab(4, top + 13 + by, 19, 5, TEAL, horizontal=True)           # bedroll
        cv.rect(4, top + 13 + by, 19, 1, TEAL[4])

        def arm(x, y):
            cv.slab(x, y, 3, 9, TEAL); cv.rect(x, y + 9, 3, 3, SKIN)
        if kind == 'jump':
            arm(1, 9); arm(22, 9)
        elif kind != 'slide':
            arm(2, q['la'] + by); arm(21, q['ra'] + by)
        cv.slab(6, top + 10 + by, 15, 4, GOLD, horizontal=True)           # scarf
        cv.rect(6, top + 10 + by, 15, 1, GOLD[4])
        cv.rect(21, top + 11 + by, 4, 2, GOLD[2]); cv.rect(23, top + 12 + by + (f & 1), 3, 3, GOLD[1])
        cv.rect(7, top + 8 + by, 13, 3, HAIR)                              # hair under the cap
        cv.ball(13, top + 5 + by, 8, 5, CAP)                               # cap dome
        cv.slab(4, top + 8 + by, 19, 3, GOLD, horizontal=True)            # brim band
        cv.rect(4, top + 8 + by, 19, 1, GOLD[4])
        return trim_bottom(finish(cv))
    for f in range(4):
        add('run%d' % f, draw('run', f))
    add('jump', draw('jump'))
    add('slide', draw('slide'))


def make_signs_and_gore():
    def sign(icon, label, rim):
        cv = Cv(57, 90)
        cv.slab(26, 40, 5, 50, WOOD)                                   # post
        cv.slab(0, 0, 57, 42, rim, horizontal=True)                     # board frame
        cv.rect(2, 2, 53, 38, H('#2a1a5a')); cv.rect(2, 2, 53, 1, H('#4a3a8a'))
        cv.rect(2, 2, 53, 2, GOLD[2]); cv.rect(2, 38, 53, 2, GOLD[1])
        icon(cv)
        text(cv, label, (57 - (len(label) * 8 - 2)) // 2, 29, CREAM, 2)
        return finish(cv)

    def jungle_icon(cv):                                               # palm
        cv.slab(27, 14, 3, 12, WOOD)
        for a in (-1.2, -0.6, 0, 0.6, 1.2):
            cv.line([(28, 14), (28 + math.sin(a) * 12, 14 - math.cos(a) * 4 + abs(a) * 4)], JUNG[3], 3)
        cv.px(26, 15, GOLD[3]); cv.px(30, 15, GOLD[3])

    def cliff_icon(cv):                                                # arch
        cv.slab(17, 8, 23, 18, STONE)
        cv.erase_disc(28, 26, 6, 11)
        cv.rect(16, 7, 25, 2, STONE[4])

    add('signJungle', sign(jungle_icon, 'JUNGLE', JUNG))
    add('signCliffs', sign(cliff_icon, 'CLIFFS', EARTH))
    cv = Cv(14, 44)                                                    # striped divider post
    for y in range(44):
        cv.rect(0, y, 14, 1, pick([PINK[1], PINK[2], GOLD[3]] if (y // 7) % 2 else [GOLD[1], GOLD[2], GOLD[3]], 0.7, 0, y))
    add('gore', finish(cv))



# ================================================================ ROADSIDE PROPS
def palm(h, ramp, trunk, lean=8, fronds=7, seed=1):
    rnd = random.Random(seed)
    w = 80
    cv = Cv(w, h)
    cx0 = 30
    pts = []
    n = h // 6
    for i in range(n):
        t = i / (n - 1)
        x = cx0 + lean * t * t * 2
        y = h - 2 - i * 6
        pts.append((x, y))
        tw = 6 - int(t * 2)
        cv.slab(int(x) - tw // 2, int(y) - 6, tw + 1, 7, trunk)
        cv.rect(int(x) - tw // 2, int(y) - 1, tw + 1, 1, trunk[0])              # ring marks
    ex, ey = pts[-1]
    for a in (-2.7, -2.2, -1.7, -1.2, -0.7, -0.2, 0.3)[:fronds]:
        px, py = ex, ey
        ang = a
        for step in range(8):
            nx = px + math.cos(ang) * 6
            ny = py + math.sin(ang) * 3.2 + step * 0.9
            wdt = 4 if step < 5 else 3
            cv.line([(px, py + 1), (nx, ny + 1)], ramp[0], wdt)
            cv.line([(px, py), (nx, ny)], ramp[1], wdt - 1)
            cv.line([(px, py - 1), (nx, ny - 1)], ramp[3], 1)
            px, py = nx, ny
        cv.px(px, py + 2, ramp[2])
    cv.ball(ex - 2, ey + 3, 3, 3, WOOD); cv.ball(ex + 3, ey + 4, 3, 3, WOOD)
    return cv


def make_props():
    add('palm_shore', finish(palm(150, GREEN, WOOD, 10, 7, 1)))
    add('palm_short', finish(palm(96, GREEN, WOOD, -6, 6, 2)))
    add('palm_jungle', finish(palm(170, JUNG, [H('#3a2010'), H('#5a3018'), H('#8a5a30'), H('#b88a50'), H('#e0b070')], 12, 8, 3)))

    cv = Cv(30, 58)                                                    # sunflower
    cv.slab(13, 18, 4, 40, GREEN)
    cv.line([(15, 40), (4, 32)], GREEN[2], 3); cv.disc(4, 32, 4, 2, GREEN[3])
    cv.line([(15, 46), (26, 40)], GREEN[2], 3); cv.disc(26, 40, 4, 2, GREEN[3])
    for k in range(10):
        a = k * math.pi / 5
        cv.disc(15 + math.cos(a) * 9, 11 + math.sin(a) * 9, 3, 3, GOLD[3] if k % 2 else GOLD[2])
    cv.ball(15, 11, 6, 6, [H('#3a1a08'), H('#6a3010'), H('#8a4a18')])
    add('flower', finish(cv), low=True)

    cv = Cv(34, 100)                                                   # carved totem
    cv.slab(2, 0, 30, 100, WOOD)
    for k, col in enumerate((PINK, TEAL, GOLD, RED)):
        y = 4 + k * 24
        cv.slab(2, y, 30, 22, col)
        cv.rect(2, y, 30, 1, col[4]); cv.rect(2, y + 21, 30, 1, col[0])
        cv.rect(7, y + 6, 6, 5, CREAM); cv.rect(21, y + 6, 6, 5, CREAM)
        cv.rect(9, y + 8, 3, 3, H('#1b1034')); cv.rect(23, y + 8, 3, 3, H('#1b1034'))
        cv.rect(10, y + 15, 14, 3, H('#1b1034')); cv.rect(12, y + 15, 2, 2, CREAM); cv.rect(20, y + 15, 2, 2, CREAM)
    cv.poly([(0, 6), (6, 0), (6, 10)], GOLD[2]); cv.poly([(34, 6), (28, 0), (28, 10)], GOLD[2])
    add('totem', finish(cv))

    cv = Cv(48, 32)                                                    # flowering bush
    for (x, y, r) in ((12, 20, 11), (24, 15, 13), (36, 20, 11), (22, 24, 12)):
        cv.ball(x, y, r, r - 2, GREEN)
    for (x, y, c) in ((10, 14, PINK[3]), (26, 8, GOLD[3]), (38, 16, PINK[3]), (18, 22, GOLD[3]), (30, 24, PINK[2])):
        cv.rect(x, y, 3, 3, c); cv.px(x, y, CREAM)
    add('bush_shore', finish(cv), low=True)

    cv = Cv(66, 28)                                                    # rail fence
    for x in (3, 31, 59):
        cv.slab(x, 4, 5, 24, WOOD); cv.poly([(x - 1, 5), (x + 2, 0), (x + 6, 5)], WOOD[3])
    for y in (9, 18):
        cv.slab(0, y, 66, 4, WOOD, horizontal=True)
    for x, c in ((14, PINK[3]), (44, GOLD[3])):
        cv.rect(x, 2, 3, 3, c); cv.rect(x + 1, 4, 1, 6, GREEN[2])
    add('rail', finish(cv), low=True)

    # ---- jungle
    cv = Cv(100, 156)                                                  # big tree with vines
    cv.slab(40, 60, 18, 96, [H('#3a2010'), H('#5a3018'), H('#8a5a30'), H('#b88a50')])
    cv.slab(34, 140, 30, 16, [H('#3a2010'), H('#5a3018'), H('#8a5a30')])
    for (x, y, r) in ((26, 52, 26), (72, 50, 26), (50, 28, 28), (50, 62, 22)):
        cv.ball(x, y, r, r - 3, JUNG)
    for x in range(14, 90, 9):
        ln = 14 + (x * 13) % 22
        cv.rect(x, 62, 2, ln, JUNG[1]); cv.rect(x, 62, 1, ln, JUNG[3]); cv.disc(x + 1, 62 + ln, 2, 2, JUNG[3])
    cv.rect(46, 20, 3, 3, GOLD[3]); cv.rect(70, 40, 3, 3, PINK[3])
    add('tree_jungle', finish(cv))

    cv = Cv(46, 34)                                                    # fern fan
    for a in (-1.35, -0.9, -0.45, 0, 0.45, 0.9, 1.35):
        pts = [(23 + math.sin(a) * i * 2.4, 32 - math.cos(a) * i * 2.0 + (i * i) * 0.03 * abs(a)) for i in range(0, 13)]
        cv.line(pts, JUNG[1], 4); cv.line([(x, y - 1) for x, y in pts], JUNG[3], 2)
    add('fern', finish(cv), low=True)

    cv = Cv(34, 100)                                                   # mossy ruin pillar
    cv.slab(6, 14, 22, 86, STONE)
    cv.slab(2, 88, 30, 12, STONE); cv.slab(2, 6, 30, 8, STONE, horizontal=True)
    cv.poly([(2, 6), (10, 0), (16, 6)], STONE[3]); cv.rect(20, 0, 12, 7, STONE[1])
    for (x, y, w_, h_) in ((6, 30, 10, 6), (16, 52, 12, 5), (8, 72, 14, 6), (4, 10, 8, 4)):
        cv.rect(x, y, w_, h_, JUNG[2]); cv.rect(x, y, w_, 1, JUNG[4])
    cv.line([(6, 24), (28, 60)], JUNG[1], 2); cv.line([(28, 40), (8, 84)], JUNG[1], 2)
    add('ruin', finish(cv))

    cv = Cv(86, 124)                                                   # waterfall rock
    cv.poly([(6, 124), (10, 40), (26, 16), (60, 6), (78, 30), (82, 124)], STONE[1])
    cv.poly([(6, 124), (10, 40), (26, 16), (36, 14), (30, 60), (22, 124)], STONE[2])
    cv.rect(12, 6, 62, 8, JUNG[2]); cv.rect(14, 6, 56, 2, JUNG[4])
    for x in range(36, 56):                                            # cascade
        for y in range(14, 112):
            v = 0.6 + 0.4 * math.sin(y * 0.5 + x * 0.9)
            cv.px(x, y, pick(WATER, 0.55 + v * 0.45, x, y))
    cv.rect(34, 14, 2, 98, WATER[4]); cv.rect(56, 14, 1, 98, WATER[1])
    cv.ball(46, 116, 20, 7, WATER)
    for x in range(30, 64, 4):
        cv.rect(x, 112, 3, 2, CREAM)
    add('waterfall', finish(cv))

    cv = Cv(50, 32)                                                    # jungle bush
    for (x, y, r) in ((14, 20, 12), (26, 15, 13), (38, 20, 11)):
        cv.ball(x, y, r, r - 2, JUNG)
    cv.rect(20, 10, 4, 4, RED[3]); cv.rect(32, 16, 4, 4, PINK[3]); cv.px(20, 10, CREAM)
    add('bush_jungle', finish(cv), low=True)

    # ---- cliffs
    def strata(cv, x0, x1, y0, y1, seed):
        rnd = random.Random(seed)
        for y in range(y0, y1):
            k = ((y - y0) // 8) % 4
            col = (EARTH[3], EARTH[2], PINK[2] if False else EARTH[1], EARTH[2])[k]
            cv.rect(x0, y, x1 - x0, 1, col)
    cv = Cv(60, 150)                                                   # sea stack
    pts = [(8, 150), (6, 100), (12, 50), (18, 12), (42, 8), (50, 44), (54, 100), (56, 150)]
    cv.poly(pts, EARTH[2])
    for y in range(8, 150):
        k = ((y - 8) // 9) % 3
        l = 6 + max(0, int((y - 12) * 0.05)) if y > 12 else 18
        for x in range(6, 58):
            if cv.im.getpixel((x, y))[3]:
                t = (x - 6) / 52.0
                base = (EARTH, SAND, EARTH)[k]
                cv.px(x, y, pick(base, 1 - t * 0.9, x, y))
    cv.rect(16, 8, 28, 4, GREEN[2]); cv.rect(18, 8, 24, 2, GREEN[4])
    for x in range(14, 46, 5):
        cv.rect(x, 12, 2, 4 + (x % 3) * 2, GREEN[1])
    add('stack', finish(cv))

    cv = Cv(130, 124)                                                  # stone arch
    cv.poly([(4, 124), (8, 50), (24, 14), (64, 6), (104, 14), (122, 50), (126, 124)], EARTH[2])
    for y in range(6, 124):
        for x in range(4, 128):
            if cv.im.getpixel((x, y))[3]:
                t = (x - 4) / 124.0
                k = ((y - 6) // 10) % 3
                cv.px(x, y, pick((EARTH, SAND, EARTH)[k], 1 - t * 0.85, x, y))
    cv.erase_disc(65, 124, 30, 70)
    cv.rect(24, 6, 82, 4, GREEN[2]); cv.rect(26, 6, 78, 2, GREEN[4])
    add('arch', finish(cv))

    cv = Cv(38, 146)                                                   # lighthouse
    cv.poly([(8, 146), (12, 40), (26, 40), (30, 146)], CREAM)
    for k in range(5):
        y0 = 48 + k * 20
        cv.poly([(12 - (y0 - 40) * 0.04, y0), (26 + (y0 - 40) * 0.04, y0), (26 + (y0 + 10 - 40) * 0.04, y0 + 10), (12 - (y0 + 10 - 40) * 0.04, y0 + 10)], RED[2])
    cv.rect(6, 36, 26, 5, STONE[1]); cv.rect(6, 36, 26, 1, STONE[4])
    cv.rect(12, 20, 14, 16, GOLD[3]); cv.rect(12, 20, 14, 2, GOLD[4]); cv.rect(17, 24, 4, 8, GOLD[4])
    cv.poly([(8, 20), (19, 4), (30, 20)], RED[2]); cv.poly([(8, 20), (19, 4), (19, 20)], RED[3])
    add('lighthouse', finish(cv))

    cv = Cv(58, 34)                                                    # boulders
    RK = [H('#5a2a3a'), H('#8a4a4a'), H('#b87058'), H('#e0a078'), H('#ffd0a8')]
    cv.ball(16, 22, 14, 10, RK); cv.ball(38, 18, 16, 14, RK); cv.ball(50, 26, 8, 7, RK)
    for (x, y) in ((10, 12), (32, 6), (42, 8)):
        cv.rect(x, y, 5, 3, GREEN[3]); cv.rect(x, y, 5, 1, GREEN[4])
    add('rocks', finish(cv), low=True)

    cv = Cv(84, 70)                                                    # floating island
    cv.poly([(4, 24), (80, 24), (66, 44), (50, 60), (42, 68), (32, 52), (16, 38)], EARTH[2])
    for y in range(24, 69):
        for x in range(4, 82):
            if cv.im.getpixel((x, y))[3]:
                cv.px(x, y, pick(EARTH, 0.95 - (y - 24) / 50.0 * 0.8 - (x - 4) / 78.0 * 0.3, x, y))
    cv.slab(2, 14, 80, 12, GREEN, horizontal=True)
    for x in range(2, 82, 8):
        cv.rect(x, 14, 4, 12, GREEN[2] if (x // 8) % 2 else GREEN[3])
    cv.rect(2, 14, 80, 1, GREEN[4])
    cv.slab(38, 0, 3, 14, WOOD)
    for a in (-1.0, -0.4, 0.4, 1.0):
        cv.line([(39, 2), (39 + math.sin(a) * 12, 2 + 6 - math.cos(a) * 2)], GREEN[3], 3)
    add('float', finish(cv), lift=60)

    cv = Cv(44, 30)                                                    # dry shrub
    for (x, y, r) in ((12, 20, 10), (24, 14, 12), (34, 20, 9)):
        cv.ball(x, y, r, r - 2, [H('#7a6a10'), H('#a89a18'), H('#d0c030'), H('#f0e060'), H('#fff8a0')])
    for x in range(4, 42, 5):
        cv.line([(x, 22), (x + (x % 3) - 1, 6 + (x * 7) % 8)], H('#d0c030'), 2)
    for (x, y) in ((10, 14), (26, 8), (34, 16)):
        cv.rect(x, y, 3, 3, PINK[3])
    add('shrub', finish(cv), low=True)


# ================================================================ SKY PIECES, CLOUDS, CANOPY
def make_sky_bits():
    # sun with stepped dithered glow rings (no alpha: pure pixel dither)
    S = 200
    cv = Cv(S, S)
    c = S // 2
    rings = [(96, H('#ff9a6a')), (80, H('#ffb070')), (66, H('#ffc878')), (54, H('#ffdc88'))]
    for r, col in rings:
        for y in range(S):
            for x in range(S):
                d = math.hypot(x - c, y - c)
                if d <= r and ((x + y) & 1) == 0:
                    cv.px(x, y, col)
    cv.ball(c, c, 40, 40, [H('#ff7a40'), H('#ffa040'), H('#ffcc50'), H('#ffe880'), H('#fffbe0')], light=(-0.2, -0.5), gain=1.1)
    add('sun', cv.im.copy(), raw=True)
    # clouds: lit tops, magenta undersides
    for k, (w, h, seed) in enumerate(((130, 40, 1), (92, 32, 2), (160, 46, 3))):
        cv = Cv(w, h)
        rnd = random.Random(seed)
        x = 8
        while x < w - 12:
            r = rnd.randint(9, 17)
            cv.disc(x, h - 12 - rnd.randint(0, 6), r, min(r - 2, 13), H('#ffd0a0'))
            x += rnd.randint(10, 18)
        cv.rect(6, h - 14, w - 12, 10, H('#ffd0a0'))
        cv.rect(0, h - 8, w, 8, (0, 0, 0, 0)) if False else None
        # shade: top lighter, bottom magenta (dithered)
        for y in range(h):
            for xx in range(w):
                if cv.im.getpixel((xx, y))[3]:
                    t = y / h
                    cv.px(xx, y, pick([H('#a02a78'), H('#e0488f'), H('#ff8a8a'), H('#ffc890'), H('#fff0c0')], 1.0 - t * 1.0, xx, y))
        add('cloud%d' % k, cv.im.copy(), raw=True)


def strip_canopy():
    W, Hh = 960, 64
    cv = Cv(W, Hh)
    rnd = random.Random(11)
    cv.rect(0, 0, W, 14, JUNG[0])
    for x in range(0, W, 3):
        d = 14 + int(8 * (0.5 + 0.5 * math.sin(x * 2 * math.pi / 160 * 1))) + rnd.randint(0, 4)
        cv.rect(x, 0, 3, d, JUNG[0])
    for x in range(8, W, 36):                                          # hanging fronds
        ln = rnd.randint(24, 46)
        for i in range(ln):
            w = max(2, 12 - i // 4)
            cv.rect(x - w // 2, 10 + i, w, 1, pick(JUNG, 0.85 - i / ln * 0.5, x, i))
        cv.rect(x - 1, 10 + ln, 3, 3, JUNG[3])
    for x in range(20, W, 90):                                         # gold light leaks
        cv.rect(x, 18, 3, 2, GOLD[3]); cv.rect(x + 1, 19, 1, 1, GOLD[4])
    for x in range(0, W, 3):                                           # outline along the lower edge
        for y in range(Hh - 1):
            if cv.im.getpixel((x, y))[3] and not cv.im.getpixel((x, y + 1))[3]:
                cv.rect(x, y + 1, 3, 1, OUT)
    return cv.im


# ================================================================ PARALLAX STRIPS (tile every 960px)
W = 960


def hills(cv, ybase, amp, cycles, ramp, seed, rim=None, top_light=0.95):
    rnd = random.Random(seed)
    ph = [rnd.random() * 6.28 for _ in cycles]
    for x in range(W):
        hgt = amp * sum(math.sin(x / W * 2 * math.pi * c + p) * a for (c, a), p in zip(cycles, ph)) + amp
        top = int(ybase - hgt)
        for y in range(top, ybase + 1):
            t = (y - top) / max(1, ybase - top)
            cv.px(x, y, pick(ramp, top_light - t * 0.9, x, y))
        if rim:
            cv.px(x, top, rim)


def mini_palm(cv, x, yb, h, ramp, trunk, rim, lean=1):
    for i in range(h):
        t = i / h
        cv.rect(x + int(lean * 7 * t * t), yb - i, 3, 1, trunk)
    ex, ey = x + int(lean * 7) + 1, yb - h
    for a in (-2.9, -2.3, -1.7, -1.1, -0.45, 0.15):
        px, py = ex, ey
        for st in range(6):
            nx = px + math.cos(a) * 4.2; ny = py + math.sin(a) * 2.0 + st * 1.0
            cv.line([(px, py), (nx, ny)], ramp[1], 3)
            cv.px(nx, ny - 2, rim)
            px, py = nx, ny


def float_island(cv, x, y, w, top_col, under):
    cv.poly([(x - w // 2, y), (x + w // 2, y), (x + w // 4, y + w // 3), (x, y + w // 2), (x - w // 4, y + w // 4)], under[2])
    cv.poly([(x - w // 2, y), (x, y), (x - w // 8, y + w // 2), (x - w // 4, y + w // 4)], under[3])
    cv.rect(x - w // 2, y - 5, w, 6, top_col[2]); cv.rect(x - w // 2, y - 5, w, 1, top_col[4])
    mini_palm(cv, x - 4, y - 5, 14, [top_col[0], top_col[1]], top_col[0], top_col[4], 0)


def sea_stack(cv, x, yb, h, w, ramp, cap):
    for y in range(yb - h, yb):
        t = (y - (yb - h)) / h
        wid = int(w * (0.72 + 0.28 * t))
        for xx in range(x - wid // 2, x + wid // 2 + 1):
            u = (xx - (x - wid // 2)) / max(1, wid)
            v = 0.95 - u * 0.8
            if ((y - (yb - h)) // 7) % 2:
                v -= 0.18
            cv.px(xx, y, pick(ramp, v, xx, y))
    cv.rect(x - w // 2 + 1, yb - h - 3, int(w * 0.72) + 3, 4, cap[2]); cv.rect(x - w // 2 + 1, yb - h - 3, int(w * 0.72) + 3, 1, cap[4])


def make_strips():
    strips = {}
    # ----- SHORE: violet island peaks + floating islands -> green hills with palms -> flowering foreground
    far = Cv(W, 100)
    hz = [H('#4a1a7a'), H('#6a2a8a'), H('#9a3a9a'), H('#d0589a'), H('#ffa0a8')]
    hills(far, 100, 30, [(3, 0.5), (7, 0.32), (13, 0.18)], hz, 5, rim=H('#ffc0a8'))
    for (x, y, w_) in ((130, 34, 50), (410, 22, 40), (690, 40, 56), (880, 26, 34)):
        float_island(far, x, y, w_, [H('#6a2a8a'), H('#8a3a9a'), H('#c05aa0'), H('#e07aa0'), H('#ffc0b0')], hz)
    strips['shore_far'] = far.im
    mid = Cv(W, 64)
    hills(mid, 64, 14, [(4, 0.5), (9, 0.3), (17, 0.1)], [H('#07402e'), H('#0f6a46'), H('#1c9358'), H('#3cc070'), H('#8ae88a')], 9, rim=H('#ffd68a'))
    for x in range(30, W, 84):
        mini_palm(mid, x, 44 + (x * 7) % 12, 24 + (x * 3) % 12, [H('#04281c'), H('#0a5a3a')], H('#07402e'), H('#ffb070'), 1 if (x // 84) % 2 else -1)
    strips['shore_mid'] = mid.im
    near = Cv(W, 36)
    hills(near, 36, 8, [(6, 0.5), (15, 0.35), (31, 0.15)], GREEN, 13, rim=H('#d8f080'))
    for x in range(10, W, 22):
        near.rect(x, 16 + (x * 5) % 8, 3, 3, PINK[3] if (x // 22) % 2 else GOLD[3])
    strips['shore_near'] = near.im

    # ----- JUNGLE: blue-violet ridges with cascades -> dense canopy masses + palms -> big leaves
    far = Cv(W, 100)
    jz = [H('#1a2a6a'), H('#2a3a8a'), H('#3a5a9a'), H('#6a8ac0'), H('#b0c0e8')]
    hills(far, 100, 34, [(3, 0.5), (6, 0.35), (11, 0.15)], jz, 21, rim=H('#ffb8c0'))
    for x in range(60, W, 190):
        far.rect(x, 46, 3, 44, H('#d8f0ff')); far.rect(x + 1, 46, 1, 44, H('#8ac0e0'))
    strips['jungle_far'] = far.im
    mid = Cv(W, 64)
    hills(mid, 64, 14, [(5, 0.5), (11, 0.3)], [H('#04281c'), H('#07402e'), H('#0f6a46'), H('#1c9358')], 22, rim=H('#ffc080'))
    for x in range(8, W, 38):
        mid.ball(x, 40 + (x * 7) % 10, 15, 11, [H('#04281c'), H('#07402e'), H('#0f6a46'), H('#1c9358')])
    for x in range(20, W, 76):
        mini_palm(mid, x, 46 + (x * 11) % 10, 26 + (x * 5) % 12, [H('#04281c'), H('#0a5a3a')], H('#04281c'), H('#ff9a60'), 1 if (x // 76) % 2 else -1)
    strips['jungle_mid'] = mid.im
    near = Cv(W, 36)
    hills(near, 36, 8, [(7, 0.5), (19, 0.4)], JUNG, 23, rim=H('#b8f088'))
    for x in range(6, W, 30):
        for a in (-0.8, 0, 0.8):
            near.line([(x, 34), (x + math.sin(a) * 12, 34 - math.cos(a) * 18 + 8)], JUNG[2], 3)
    strips['jungle_near'] = near.im

    # ----- CLIFFS: magenta sea stacks -> striped cliff walls -> rocks & shrubs
    far = Cv(W, 100)
    cz = [H('#6a1a6a'), H('#9a2a7a'), H('#d0487a'), H('#ff7a80'), H('#ffc8a0')]
    hills(far, 100, 14, [(3, 0.5), (8, 0.25)], cz, 31, rim=H('#ffd0a0'))
    for (x, h_, w_) in ((70, 84, 28), (260, 66, 34), (430, 92, 26), (610, 60, 40), (790, 78, 30), (920, 54, 32)):
        sea_stack(far, x, 100, h_, w_, cz, [H('#6a2a8a'), H('#8a3a9a'), H('#c05aa0'), H('#e07aa0'), H('#ffc0b0')])
    strips['cliffs_far'] = far.im
    mid = Cv(W, 64)
    hills(mid, 64, 16, [(4, 0.5), (10, 0.25)], [H('#7a2a14'), H('#a84a1c'), H('#d8742c'), H('#f8a048'), H('#ffd08a')], 33, rim=H('#fff0b0'))
    for y in range(0, 64, 9):
        for x in range(W):
            px_ = mid.im.getpixel((x, y))
            if px_[3]:
                mid.px(x, y, mix(px_, H('#5a1a0a'), 0.45))
    for x in range(0, W, 3):
        for y in range(64):
            if mid.im.getpixel((x, y))[3]:
                mid.rect(x, y, 3, 3, H('#7ac038')); mid.rect(x, y, 3, 1, H('#d0f070'))
                break
    strips['cliffs_mid'] = mid.im
    near = Cv(W, 36)
    hills(near, 36, 7, [(8, 0.5), (21, 0.3)], [H('#7a4a2a'), H('#a86a3a'), H('#d8924a'), H('#f8c070')], 35, rim=H('#fff0b0'))
    for x in range(14, W, 38):
        near.ball(x, 28, 8, 6, [H('#5a2a3a'), H('#8a4a4a'), H('#b87058'), H('#e0a078')])
    strips['cliffs_near'] = near.im
    return strips


# ================================================================ PACK + WRITE
def build():
    make_coins(); make_crates(); make_barriers(); make_overheads(); make_runner(); make_signs_and_gore()
    make_props(); make_sky_bits()
    # shelf-pack all sprites into one atlas
    items = sorted(SPRITES.items(), key=lambda kv: -kv[1][0].height)
    AW = 1024
    x = y = rowh = 0
    place = {}
    for name, (im, meta) in items:
        if x + im.width + 2 > AW:
            x, y, rowh = 0, y + rowh + 2, 0
        place[name] = (x, y)
        x += im.width + 2
        rowh = max(rowh, im.height)
    atlas = Image.new('RGBA', (AW, y + rowh + 2), (0, 0, 0, 0))
    manifest = {'sprites': {}, 'files': {}}
    for name, (im, meta) in items:
        px_, py_ = place[name]
        atlas.paste(im, (px_, py_))
        manifest['sprites'][name] = dict(x=px_, y=py_, w=im.width, h=im.height, **meta)
    atlas.save(os.path.join(OUTDIR, 'atlas.png'), optimize=True)
    manifest['files']['atlas'] = 'atlas.png'
    for k, im in make_strips().items():
        im.save(os.path.join(OUTDIR, k + '.png'), optimize=True)
        manifest['files'][k] = k + '.png'
        manifest.setdefault('strips', {})[k] = dict(w=im.width, h=im.height)
    im = strip_canopy(); im.save(os.path.join(OUTDIR, 'canopy.png'), optimize=True)
    manifest['files']['canopy'] = 'canopy.png'; manifest.setdefault('strips', {})['canopy'] = dict(w=im.width, h=im.height)
    # a plain script (not fetch()ed JSON) so the game also runs when index.html is opened from disk
    open(os.path.join(OUTDIR, 'manifest.js'), 'w').write('const ASSET_MANIFEST = ' + json.dumps(manifest) + ';\n')
    print('atlas', atlas.size, len(manifest['sprites']), 'sprites;', len(manifest['strips']), 'strips')


if __name__ == '__main__':
    build()
