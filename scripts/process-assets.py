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
  src/assets/brand/cellender-symbol.png                                     … 空状態用
  src/assets/brand/cellender-logo.png                                       … 横長ロゴ（ヘッダー・ようこそ・設定）
  src/assets/brand/cellender-mark.png, cellender-wordmark.png               … 起動画面（シンボルの下にロゴタイプ）
  src/assets/external/lovematri.png                                         … 設定の外部接続（マトリちゃん）
  public/favicon-16.png, favicon-32.png, favicon.ico, apple-touch-icon.png   … アプリアイコン
  public/icon-192.png, icon-512.png, icon-maskable-512.png                   … ホーム画面（PWA）用

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
LOGO_H = 192  # 横長ロゴの高さ（64px 表示 × 3x まで鮮明）
WORD_SCALE = 0.8  # ロゴタイプをシンボルに対して 20% 小さくしてバランスを整える
MARK_PX = 384  # 起動画面のシンボル（128px 表示 × 3x）
WORDMARK_H = 128  # 起動画面のロゴタイプの高さ
MATRI_PX = 144  # マトリちゃん（48px 表示 × 3x）
EXTERNAL_OUT = ROOT / "src" / "assets" / "external"


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


def save_small(img: Image.Image, path: Path) -> None:
    """色数の少ない画像は 256 色に減色して軽くする（見た目はほぼ変わらず数分の 1 のサイズになる）"""
    img.quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(path, optimize=True)


def split_logo(logo: np.ndarray):
    """横長ロゴの原本を、シンボルとロゴタイプに切り分ける（間の透明な列で分ける）"""
    x0, y0, x1, y1 = bbox(logo)
    cols = (logo[..., 3] > 0).any(axis=0)
    # 左から 1/3 までの範囲で、最初に現れる透明な列の並びをシンボルとロゴタイプの境目とみなす
    gap_start = next(x for x in range(x0 + 1, x0 + (x1 - x0) // 3) if not cols[x])
    gap_end = next(x for x in range(gap_start, x1) if cols[x])
    sym, word = logo[:, x0:gap_start], logo[:, gap_end:x1]
    sx0, sy0, sx1, sy1 = bbox(sym)
    wx0, wy0, wx1, wy1 = bbox(word)
    return sym[sy0:sy1, sx0:sx1], word[wy0:wy1, wx0:wx1], gap_end - gap_start, (wy0 + wy1) / 2 - sy0


def scaled(rgba: np.ndarray, height: int) -> Image.Image:
    img = to_image(rgba)
    return resize(img, (max(1, round(img.width * height / img.height)), height))


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

    # 横長ロゴ：シンボルの高さはそのまま、ロゴタイプを 20% 小さくして組み直す（縦位置は元の中心に合わせる）
    sym, word, gap, word_cy = split_logo(clean(load(SRC / "cellender-logo.png")))
    sh, sw = sym.shape[:2]
    word_img = scaled(word, round(word.shape[0] * WORD_SCALE))
    canvas = Image.new("RGBA", (sw + gap + word_img.width, sh), (0, 0, 0, 0))
    canvas.alpha_composite(to_image(sym), (0, 0))
    canvas.alpha_composite(word_img, (sw + gap, round(word_cy - word_img.height / 2)))
    out = resize(canvas, (round(canvas.width * LOGO_H / sh), LOGO_H))
    save_small(out, BRAND_OUT / "cellender-logo.png")
    print("brand  cellender-logo.png", out.size)

    # 起動画面用：シンボルとロゴタイプを別々の画像にする（縦に並べて、別々に動かす）
    mark = scaled(sym, MARK_PX)
    save_small(mark, BRAND_OUT / "cellender-mark.png")
    wordmark = scaled(word, WORDMARK_H)
    save_small(wordmark, BRAND_OUT / "cellender-wordmark.png")
    print("brand  cellender-mark.png", mark.size, "cellender-wordmark.png", wordmark.size)

    # 外部接続：LoveMatri のマトリちゃん
    EXTERNAL_OUT.mkdir(parents=True, exist_ok=True)
    matri = fit(clean(load(SRC / "lovematri-matri.png")), MATRI_PX, 0.98)
    matri.save(EXTERNAL_OUT / "lovematri.png", optimize=True)
    print("ext    lovematri.png", matri.size)

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

    # ホーム画面（PWA）用。any はオフホワイト地に余白 15%、maskable は OS の丸や角丸の切り抜きでも
    # 欠けないよう、中央 80% の安全領域にシンボル（60%）を収める
    for px in (192, 512):
        fit(symbol, px * 2, 0.72, bg=OFF_WHITE).resize((px, px), Image.Resampling.LANCZOS).convert("RGB").save(
            PUBLIC / f"icon-{px}.png", optimize=True
        )
    fit(symbol, 1024, 0.60, bg=OFF_WHITE).resize((512, 512), Image.Resampling.LANCZOS).convert("RGB").save(
        PUBLIC / "icon-maskable-512.png", optimize=True
    )
    print("public icon-192.png icon-512.png icon-maskable-512.png")


if __name__ == "__main__":
    main()
