# /// script
# requires-python = ">=3.10"
# dependencies = ["fonttools==4.66.1", "uharfbuzz==0.55.0", "brotli"]
# ///
"""Generate the approved Freebo / Atma 600 brand from editable vector sources.

Run: uv run scripts/generate-brand.py
Render/package: pnpm exec electron scripts/render-brand.cjs
"""
from pathlib import Path
import base64
import hashlib
import html
import json
import xml.etree.ElementTree as ET
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
import uharfbuzz as hb

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "assets/brand/freebo"
NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
PINE, LIME, PAPER = "#193C35", "#BDE64D", "#FBFCF9"
FONT_SOURCE = BRAND / "fonts/Atma-SemiBold.ttf"
JOBS = []

def n(value):
    return f"{value:.4f}".rstrip("0").rstrip(".") or "0"

def svg(width, height, content, title="Freebo"):
    return f'<svg xmlns="{NS}" width="{n(width)}" height="{n(height)}" viewBox="0 0 {n(width)} {n(height)}" role="img" aria-label="{html.escape(title)}"><title>{html.escape(title)}</title>{content}</svg>\n'

def write(relative, content):
    target = BRAND / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)
    return target

def mark_content(mode="color"):
    root = ET.parse(BRAND / "source/mark.svg").getroot()
    group = next(element for element in root if element.tag.endswith("g"))
    if mode == "color":
        return ET.tostring(group, encoding="unicode")
    paths = list(group)
    silhouette = paths[0].attrib["d"]
    white = paths[2].attrib["d"]
    color = {"pine": PINE, "white": "#FFFFFF", "black": "#000000"}[mode]
    return f'<g transform="{group.attrib["transform"]}"><path fill="{color}" fill-rule="evenodd" d="{silhouette}{white}"/></g>'

def shape(font_file, text="Freebo"):
    data = font_file.read_bytes()
    tt = TTFont(font_file)
    glyphs = tt.getGlyphSet()
    upem = tt["head"].unitsPerEm
    face = hb.Face(data)
    font = hb.Font(face)
    font.scale = (upem, upem)
    buffer = hb.Buffer()
    buffer.add_str(text)
    buffer.guess_segment_properties()
    hb.shape(font, buffer, {"kern": True, "liga": True})
    cursor = 0
    paths = []
    bounds = []
    scale = 100 / upem
    for info, position in zip(buffer.glyph_infos, buffer.glyph_positions):
        name = tt.getGlyphName(info.codepoint)
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        bbox = BoundsPen(glyphs)
        glyphs[name].draw(bbox)
        x, y = (cursor + position.x_offset) * scale, position.y_offset * scale
        paths.append(f'<path transform="matrix({n(scale)} 0 0 {n(-scale)} {n(x)} {n(-y)})" d="{pen.getCommands()}"/>')
        if bbox.bounds:
            a, b, c, d = bbox.bounds
            bounds.append((a * scale + x, -d * scale - y, c * scale + x, -b * scale - y))
        cursor += position.x_advance + upem * -0.015
    return "".join(paths), (min(b[0] for b in bounds), min(b[1] for b in bounds), max(b[2] for b in bounds), max(b[3] for b in bounds))

def raster(svg_file, target, width, height):
    JOBS.append({"svg": str((BRAND / svg_file).relative_to(ROOT)), "output": str((BRAND / target).relative_to(ROOT)), "width": width, "height": height})

def main():
    for directory in ["source", "fonts", "svg", "png", "icons", "social", "wallpapers"]:
        (BRAND / directory).mkdir(parents=True, exist_ok=True)
    font = TTFont(FONT_SOURCE, recalcTimestamp=False)
    font.flavor = "woff2"
    font.save(BRAND / "fonts/Atma-SemiBold.woff2")
    source = ET.parse(BRAND / "source/mark.svg").getroot()
    mark_width = float(source.attrib["viewBox"].split()[2])
    outlined, (left, top, right, bottom) = shape(FONT_SOURCE)
    word_width, word_height = right - left, bottom - top
    for mode in ["color", "pine", "white", "black"]:
        write(f"svg/mark-{mode}.svg", svg(mark_width, 100, mark_content(mode)))
    for label, color in [("pine", PINE), ("white", "#FFFFFF"), ("black", "#000000"), ("lime", LIME)]:
        content = f'<g fill="{color}" transform="translate({n(-left)} {n(-top)})">{outlined}</g>'
        write(f"svg/wordmark-{label}.svg", svg(word_width, word_height, content))
    head_h, gap = word_height * 1.1, word_height * 0.1
    head_w = head_h * mark_width / 100
    logo_w, logo_h = head_w + gap + word_width, head_h
    for name, word_color, mark_mode in [("logo", PINE, "color"), ("logo-on-dark", PAPER, "color"), ("logo-mono", PINE, "pine"), ("logo-white", "#FFFFFF", "white"), ("logo-black", "#000000", "black")]:
        content = f'<g transform="scale({n(head_h / 100)})">{mark_content(mark_mode)}</g>'
        content += f'<g fill="{word_color}" transform="translate({n(head_w + gap - left)} {n((head_h - word_height) / 2 - top)})">{outlined}</g>'
        write(f"svg/{name}.svg", svg(logo_w, logo_h, content))
        raster(f"svg/{name}.svg", f"png/{name}.png", 1600, round(1600 * logo_h / logo_w))
    stacked_gap = word_height * 0.12
    stack_w, stack_h = max(word_width, head_w), head_h + stacked_gap + word_height
    for name, color in [("logo-stacked", PINE), ("logo-stacked-on-dark", PAPER)]:
        content = f'<g transform="translate({n((stack_w - head_w) / 2)} 0) scale({n(head_h / 100)})">{mark_content()}</g>'
        content += f'<g fill="{color}" transform="translate({n((stack_w - word_width) / 2 - left)} {n(head_h + stacked_gap - top)})">{outlined}</g>'
        write(f"svg/{name}.svg", svg(stack_w, stack_h, content))
        raster(f"svg/{name}.svg", f"png/{name}.png", 1000, round(1000 * stack_h / stack_w))
    woff = base64.b64encode((BRAND / "fonts/Atma-SemiBold.woff2").read_bytes()).decode()
    editable = f'<style>@font-face{{font-family:Atma;src:url(data:font/woff2;base64,{woff}) format("woff2");font-weight:600;}}text{{font-family:Atma;font-weight:600;font-size:100px;letter-spacing:-.015em;fill:{PINE};}}</style><text x="{n(-left)}" y="{n(-top)}">Freebo</text>'
    write("source/wordmark-editable.svg", svg(word_width, word_height, editable))
    editable_logo = f'<g transform="scale({n(head_h / 100)})">{mark_content()}</g><g transform="translate({n(head_w + gap)} {n((head_h - word_height) / 2)})">{editable}</g>'
    write("source/logo-editable.svg", svg(logo_w, logo_h, editable_logo))
    icon_head_h = 680
    icon_head_w = icon_head_h * mark_width / 100
    icon = f'<rect x="64" y="64" width="896" height="896" rx="224" fill="{LIME}"/><g transform="translate({n((1024 - icon_head_w) / 2)} 172) scale(6.8)">{mark_content()}</g>'
    write("icons/app-icon.svg", svg(1024, 1024, icon))
    for size in [16, 24, 32, 48, 64, 128, 256, 512, 1024]:
        raster("icons/app-icon.svg", f"icons/icon-{size}.png", size, size)
    for name in ["mark-color", "mark-pine", "mark-white", "mark-black"]:
        raster(f"svg/{name}.svg", f"png/{name}.png", round(1024 * mark_width / 100), 1024)
    for name in ["wordmark-pine", "wordmark-white", "wordmark-black", "wordmark-lime"]:
        raster(f"svg/{name}.svg", f"png/{name}.png", 1400, round(1400 * word_height / word_width))
    dark_logo = ET.parse(BRAND / "svg/logo-on-dark.svg").getroot()
    dark_inner = "".join(ET.tostring(child, encoding="unicode") for child in dark_logo if not child.tag.endswith("title"))
    ratio = 650 / logo_w
    social = f'<rect width="1280" height="640" fill="{PINE}"/><g transform="translate(72 118) scale({n(ratio)})">{dark_inner}</g><g fill="{PAPER}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif"><text x="76" y="352" font-size="34">Emby videos.</text><text x="76" y="399" font-size="34">Your local player.</text><text x="76" y="548" font-size="19" fill="#DCE8D0">macOS · Windows · Linux</text></g><rect x="1052" y="64" width="148" height="512" rx="74" fill="{LIME}"/>'
    write("social/social.svg", svg(1280, 640, social, "Freebo — Emby videos. Your local player."))
    raster("social/social.svg", "social/social.png", 1280, 640)
    social_wide = f'<rect width="1600" height="900" fill="{PINE}"/><g transform="translate(160 250) scale({n(1100 / logo_w)})">{dark_inner}</g><text x="165" y="635" fill="{PAPER}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="36">Your server. Your player.</text>'
    write("social/cover-16x9.svg", svg(1600, 900, social_wide))
    raster("social/cover-16x9.svg", "social/cover-16x9.png", 1600, 900)
    for name, bg, color in [("pine", PINE, PAPER), ("paper", PAPER, PINE)]:
        content = ET.parse(BRAND / ("svg/logo-on-dark.svg" if name == "pine" else "svg/logo.svg")).getroot()
        inner = "".join(ET.tostring(child, encoding="unicode") for child in content if not child.tag.endswith("title"))
        scale = 1280 / logo_w
        scene = f'<rect width="2560" height="1440" fill="{bg}"/><g transform="translate(640 {n((1440 - logo_h * scale) / 2)}) scale({n(scale)})">{inner}</g>'
        write(f"wallpapers/wallpaper-{name}.svg", svg(2560, 1440, scene))
        raster(f"wallpapers/wallpaper-{name}.svg", f"wallpapers/wallpaper-{name}.png", 2560, 1440)
    config = {
        "brand": "Freebo", "font": {"family": "Atma", "weight": 600, "letterSpacingEm": -0.015, "sha256": hashlib.sha256(FONT_SOURCE.read_bytes()).hexdigest(), "source": "https://github.com/google/fonts/tree/7085eb89a950e85db5b166b7a58d414544b4140c/ofl/atma", "license": "SIL OFL 1.1"},
        "colors": {"pine": PINE, "lime": LIME, "paper": PAPER}, "geometry": {"logoWidth": logo_w, "logoHeight": logo_h, "wordWidth": word_width, "wordHeight": word_height, "headToInkHeight": 1.1, "gapToInkHeight": 0.1, "markAspect": mark_width / 100}, "rasterJobs": JOBS,
    }
    write("brand.json", json.dumps(config, indent=2, ensure_ascii=False) + "\n")
    print(f"Generated vector brand sources and {len(JOBS)} raster jobs.")

if __name__ == "__main__":
    main()
