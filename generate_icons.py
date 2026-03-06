from PIL import Image, ImageDraw
import math, os

SIZES = [16, 32, 48, 128]

def draw_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Rounded square background (dark navy)
    r = size // 5
    bg_color = (30, 27, 75, 255)  # #1e1b4b
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=bg_color)

    # Gradient-like overlay (purple tint in center)
    cx, cy = size / 2, size / 2
    for i in range(int(size * 0.65), 0, -1):
        alpha = int(50 * (1 - i / (size * 0.65)))
        d.ellipse([cx - i, cy - i, cx + i, cy + i], fill=(139, 92, 246, alpha))

    # Draw sparkle / star (4-pointed) in center
    s = size * 0.38  # half-size of long axis
    t = size * 0.09  # half-size of short axis

    def star_poly(cx, cy, s, t, angle_offset=0):
        pts = []
        for i in range(8):
            angle = math.radians(i * 45 + angle_offset)
            r = s if i % 2 == 0 else t
            pts.append((cx + r * math.sin(angle), cy - r * math.cos(angle)))
        return pts

    # Glow layer (soft, larger, lower opacity)
    glow_pts = star_poly(cx, cy, s * 1.15, t * 1.5)
    d.polygon(glow_pts, fill=(196, 130, 250, 60))

    # Main star (white-purple gradient fake: draw two overlapping)
    star_pts = star_poly(cx, cy, s, t)
    d.polygon(star_pts, fill=(255, 255, 255, 240))

    # Inner bright center dot
    dot_r = size * 0.08
    d.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=(255, 255, 255, 255))

    return img

icons_dir = os.path.join(os.path.dirname(__file__), "icons")
os.makedirs(icons_dir, exist_ok=True)

for size in SIZES:
    icon = draw_icon(size)
    path = os.path.join(icons_dir, f"icon{size}.png")
    icon.save(path, "PNG")
    print(f"Saved icon{size}.png")

print("All icons generated!")
