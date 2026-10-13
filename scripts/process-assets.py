#!/usr/bin/env python3
"""cellender-design-kit/assets/ の原本画像から、アプリで使う画像を生成する。

原本は変更しない。処理内容:
  1. 透過部分に散っているごく薄いノイズ（alpha < 24）を除去
  2. 半透明の縁に残った白っぽい色を、隣接する不透明部分の色で置き換え（白フチ除去）
  3. 余白を切り詰め、アイコンごとに決めた「見た目の大きさ」で正方形の枠の中央に配置
     （default / active で輪郭や余白がわずかに違っても、同じ位置・大きさに揃う）
  4. 表示サイズに合わせて縮小（premultiplied alpha で縮小して縁の濁りを防ぐ）

出力:
  src/assets/icons/{calendar,cells,seeding,settings}-{default,active}.png  … ナビ用
  src/assets/brand/cellender-symbol.png                                     … ヘッダー・空状態用
  public/favicon-16.png, favicon-32.png, favicon.ico, apple-touch-icon.png   … アプリアイコン

使い方:  python3 scripts/process-assets.py
"""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "cellender-design-kit" / "assets"
ICON_OUT = ROOT / "src" / "assets" / "icons"
BRAND_OUT = ROOT / "src" / "assets" / "brand"
PUBLIC = ROOT / "public"

ALPHA_FLOOR = 24  # これ未満の alpha はノイズとして透明にする
OFF_WHITE = (0xF7, 0xFA, 0xF8)

# アイコンごとの「内容の長辺 / 枠の一辺」。細いピペットは大きめにして視覚的な重さを揃える
OPTICAL = {
    "calendar": 0.80,
    "cells": 0.86,
    "seeding": 0.96,
    "settings": 0.82,
}
ICON_PX = 144  # 48px 表示 × 3x まで鮮明
SYMBOL_PX = 384


def load(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGBA"), dtype=np.float32) / 255.0


def clean(rgba: np.ndarray) -> np.ndarray:
    """薄いノイズの除去と、半透明部分の色の補正（白フチ除去）。"""
    out = rgba.copy()
    a = out[..., 3]
    a[a < ALPHA_FLOOR / 255.0] = 0.0

    solid = a >= 0.98
    color = out[..., :3] * solid[..., None]
    weight = solid.astype(np.float32)
    # 不透明部分の色を外側へ数 px 押し広げる（3x3 の平均を繰り返す）
    acc_c, acc_w = color.copy(), weight.copy()
    for _ in range(8):
        pc = np.pad(acc_c, ((1, 1), (1, 1), (0, 0)))
        pw = np.pad(acc_w, ((1, 1), (1, 1)))
        sc = sum(pc[y : y + acc_c.shape[0], x : x + acc_c.shape[1]] for y in range(3) for x in range(3))
        sw = sum(pw[y : y + acc_w.shape[0], x : x + acc_w.shape[1]] for y in range(3) for x in range(3))
        grow = (acc_w == 0) & (sw > 0)
        acc_c[grow] = sc[grow] / sw[grow][..., None]
        acc_w[grow] = 1.0
    semi = (a > 0) & ~solid & (acc_w > 0)
    out[..., :3][semi] = acc_c[semi]
    out[..., :3][a == 0] = 0.0
    return out


def bbox(rgba: np.ndarray):
    ys, xs = np.nonzero(rgba[..., 3] > 0)
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def to_image(rgba: np.ndarray) -> Image.Image:
    return Image.fromarray(np.clip(rgba * 255.0 + 0.5, 0, 255).astype(np.uint8), "RGBA")


def resize(img: Image.Image, size) -> Image.Image:
    # premultiplied で縮小して、透明部分の色が縁に混ざらないようにする
    return img.convert("RGBa").resize(size, Image.Resampling.LANCZOS).convert("RGBA")


def fit(rgba: np.ndarray, canvas: int, ratio: float, bg=None) -> Image.Image:
    """内容を切り出し、長辺が canvas*ratio になるよう縮小して中央に置く。"""
    x0, y0, x1, y1 = bbox(rgba)
    crop = to_image(rgba[y0:y1, x0:x1])
    w, h = crop.size
    scale = canvas * ratio / max(w, h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    small = resize(crop, (nw, nh))
    base = Image.new("RGBA", (canvas, canvas), (*bg, 255) if bg else (0, 0, 0, 0))
    base.alpha_composite(small, ((canvas - nw) // 2, (canvas - nh) // 2))
    return base


def main() -> None:
    ICON_OUT.mkdir(parents=True, exist_ok=True)
    BRAND_OUT.mkdir(parents=True, exist_ok=True)

    for name, ratio in OPTICAL.items():
        for state in ("default", "active"):
            src = SRC / f"{name}-{state}.png"
            img = fit(clean(load(src)), ICON_PX, ratio)
            img.save(ICON_OUT / src.name, optimize=True)
            print("icon  ", src.name, img.size)

    symbol = clean(load(SRC / "cellender-symbol.png"))
    fit(symbol, SYMBOL_PX, 0.92).save(BRAND_OUT / "cellender-symbol.png", optimize=True)
    print("brand  cellender-symbol.png")

    # favicon は透過のまま、わずかな余白をとる
    for px in (16, 32):
        fit(symbol, px * 8, 0.94).resize((px, px), Image.Resampling.LANCZOS).save(PUBLIC / f"favicon-{px}.png", optimize=True)
    ico = fit(symbol, 256, 0.94)
    ico.save(PUBLIC / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    # Apple touch icon は OS が角を丸めて切り抜くので、オフホワイトの背景と安全な余白をとる
    fit(symbol, 180 * 4, 0.70, bg=OFF_WHITE).resize((180, 180), Image.Resampling.LANCZOS).convert("RGB").save(
        PUBLIC / "apple-touch-icon.png", optimize=True
    )
    print("public favicon-16.png favicon-32.png favicon.ico apple-touch-icon.png")


if __name__ == "__main__":
    main()
