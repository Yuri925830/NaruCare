"""Extract the supplied 7x3 Naru character sheet into 21 transparent PNG assets.

The script is intentionally deterministic: it keeps the user's original pixels,
removes only near-white pixels connected to each cell border, and rejects small
foreground components that touch a cell edge (the usual source of neighbouring
feet/antennae leaking into a pose).
"""

from __future__ import annotations

from collections import deque
from pathlib import Path
import json

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "naru-ip.png"
OUTPUT_DIR = ROOT / "public" / "naru"
OUTPUT_SIZE = (438, 682)

# Coordinates refer to the 1536 x 1024 source supplied by the user. Row-two
# begins at y=380 specifically so the first row's shoes can never enter it.
POSE_CROPS: tuple[tuple[int, int, int, int], ...] = (
    (35, 32, 315, 370), (315, 35, 515, 370), (515, 34, 720, 370),
    (720, 30, 910, 370), (910, 35, 1110, 370), (1110, 34, 1300, 370),
    (1300, 45, 1520, 370),
    (25, 380, 255, 675), (255, 380, 465, 675), (465, 380, 665, 675),
    (665, 380, 865, 675), (865, 380, 1060, 675), (1060, 380, 1280, 675),
    (1280, 380, 1520, 675),
    (25, 675, 255, 1000), (255, 675, 465, 1000), (465, 675, 665, 1000),
    (665, 675, 845, 1000), (845, 675, 1060, 1000), (1060, 675, 1280, 1000),
    (1280, 675, 1520, 1000),
)


def is_border_background(pixel: tuple[int, int, int]) -> bool:
    red, green, blue = pixel
    return min(red, green, blue) > 229 and max(red, green, blue) - min(red, green, blue) < 22


def border_background_mask(image: Image.Image) -> bytearray:
    width, height = image.size
    pixels = image.load()
    background = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if background[index] or not is_border_background(pixels[x, y]):
            return
        background[index] = 1
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(1, height - 1):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        if x:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)
    return background


def remove_edge_leaks(alpha: bytearray, width: int, height: int) -> tuple[bytearray, int]:
    """Remove small foreground islands touching the source cell boundary."""
    seen = bytearray(width * height)
    components: list[tuple[list[int], bool]] = []
    for start in range(width * height):
        if seen[start] or not alpha[start]:
            continue
        seen[start] = 1
        queue = [start]
        component: list[int] = []
        touches_edge = False
        while queue:
            index = queue.pop()
            component.append(index)
            x = index % width
            y = index // width
            if x == 0 or y == 0 or x == width - 1 or y == height - 1:
                touches_edge = True
            for neighbour in (index - 1 if x else -1, index + 1 if x + 1 < width else -1,
                              index - width if y else -1, index + width if y + 1 < height else -1):
                if neighbour >= 0 and not seen[neighbour] and alpha[neighbour]:
                    seen[neighbour] = 1
                    queue.append(neighbour)
        components.append((component, touches_edge))

    largest = max((len(component) for component, _ in components), default=0)
    removed = 0
    for component, touches_edge in components:
        if touches_edge and len(component) < largest * 0.35:
            removed += len(component)
            for index in component:
                alpha[index] = 0
    return alpha, removed


def extract_pose(source: Image.Image, crop: tuple[int, int, int, int]) -> tuple[Image.Image, dict[str, object]]:
    cell = source.crop(crop).convert("RGB")
    width, height = cell.size
    background = border_background_mask(cell)
    alpha = bytearray(0 if background[index] else 255 for index in range(width * height))
    alpha, removed_edge_pixels = remove_edge_leaks(alpha, width, height)

    rgba = cell.convert("RGBA")
    rgba.putalpha(Image.frombytes("L", cell.size, bytes(alpha)))
    foreground_box = rgba.getbbox()
    if foreground_box is None:
        raise RuntimeError(f"No foreground detected in crop {crop}")

    # Preserve a small transparent buffer around antennae, props and soft shadows.
    left, top, right, bottom = foreground_box
    padding = 5
    foreground_box = (
        max(0, left - padding), max(0, top - padding),
        min(width, right + padding), min(height, bottom + padding),
    )
    trimmed = rgba.crop(foreground_box)
    max_width, max_height = OUTPUT_SIZE[0] - 16, OUTPUT_SIZE[1] - 16
    scale = min(max_width / trimmed.width, max_height / trimmed.height)
    scaled_size = (max(1, round(trimmed.width * scale)), max(1, round(trimmed.height * scale)))
    trimmed = trimmed.resize(scaled_size, Image.Resampling.LANCZOS)
    output = Image.new("RGBA", OUTPUT_SIZE, (0, 0, 0, 0))
    output.alpha_composite(trimmed, ((OUTPUT_SIZE[0] - trimmed.width) // 2, (OUTPUT_SIZE[1] - trimmed.height) // 2))

    output_alpha = output.getchannel("A")
    stats = {
        "sourceCrop": crop,
        "contentBox": foreground_box,
        "outputAlphaBox": output_alpha.getbbox(),
        "transparentCorners": all(output.getpixel(point)[3] == 0 for point in (
            (0, 0), (OUTPUT_SIZE[0] - 1, 0), (0, OUTPUT_SIZE[1] - 1),
            (OUTPUT_SIZE[0] - 1, OUTPUT_SIZE[1] - 1),
        )),
        "removedEdgePixels": removed_edge_pixels,
        "opaqueCoverage": round(sum(value > 0 for value in output_alpha.getdata()) / (OUTPUT_SIZE[0] * OUTPUT_SIZE[1]), 4),
    }
    return output, stats


def make_contact_sheet(poses: list[Image.Image]) -> Image.Image:
    tile_width, tile_height = 220, 330
    sheet = Image.new("RGBA", (tile_width * 7, tile_height * 3), (244, 238, 232, 255))
    draw = ImageDraw.Draw(sheet)
    checker = 14
    for index, pose in enumerate(poses):
        column = index % 7
        row = index // 7
        x0 = column * tile_width
        y0 = row * tile_height
        for y in range(y0, y0 + tile_height, checker):
            for x in range(x0, x0 + tile_width, checker):
                fill = (255, 253, 250, 255) if ((x - x0) // checker + (y - y0) // checker) % 2 == 0 else (228, 218, 209, 255)
                draw.rectangle((x, y, min(x + checker, x0 + tile_width), min(y + checker, y0 + tile_height)), fill=fill)
        preview = pose.copy()
        preview.thumbnail((190, 286), Image.Resampling.LANCZOS)
        sheet.alpha_composite(preview, (x0 + (tile_width - preview.width) // 2, y0 + 24))
        draw.rounded_rectangle((x0 + 8, y0 + 8, x0 + 50, y0 + 32), radius=10, fill=(104, 76, 63, 225))
        draw.text((x0 + 18, y0 + 13), f"{index + 1:02d}", fill=(255, 255, 255, 255))
    return sheet


def main() -> None:
    source = Image.open(SOURCE).convert("RGB")
    if source.size != (1536, 1024):
        raise RuntimeError(f"Expected a 1536x1024 source sheet, got {source.size}")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    poses: list[Image.Image] = []
    manifest: list[dict[str, object]] = []
    for index, crop in enumerate(POSE_CROPS, start=1):
        pose, stats = extract_pose(source, crop)
        filename = f"pose-{index:02d}.png"
        pose.save(OUTPUT_DIR / filename, optimize=True)
        poses.append(pose)
        manifest.append({"pose": index, "file": filename, **stats})
    (OUTPUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    make_contact_sheet(poses).save(OUTPUT_DIR / "naru-poses-contact-sheet.png", optimize=True)
    print(f"Generated {len(poses)} transparent poses in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
