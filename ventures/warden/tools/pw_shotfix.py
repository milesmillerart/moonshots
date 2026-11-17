"""Server-side Playwright helper: on this DigitalOcean box, Page.screenshot hangs
once Warden's WebGL is running (SwiftShader readback never finishes). Suites are
launched headed under Xvfb; this module captures the viewport via X11 GetImage
instead. Imported by ~/run_suites.sh before each suite. No-op without $DISPLAY.
"""
import os
from io import BytesIO

def _patch():
    if not os.environ.get("DISPLAY"):
        return
    from playwright.sync_api import Page, Locator, BrowserType
    from PIL import Image
    from Xlib import display, X

    _launch = BrowserType.launch
    _page_shot = Page.screenshot
    _loc_shot = Locator.screenshot

    def launch(self, *args, **kwargs):
        kwargs["headless"] = False
        flags = list(kwargs.get("args") or [])
        for f in ("--no-sandbox", "--disable-dev-shm-usage", "--no-first-run"):
            if f not in flags:
                flags.append(f)
        kwargs["args"] = flags
        return _launch(self, *args, **kwargs)

    def _root_image():
        d = display.Display()
        try:
            root = d.screen().root
            g = root.get_geometry()
            raw = root.get_image(0, 0, g.width, g.height, X.ZPixmap, 0xffffffff)
            return Image.frombytes("RGB", (g.width, g.height), raw.data, "raw", "BGRX")
        finally:
            d.close()

    def _viewport_image(page):
        info = page.evaluate(
            """() => ({ sx: window.screenX, sy: window.screenY, ow: window.outerWidth,
              oh: window.outerHeight, iw: window.innerWidth, ih: window.innerHeight,
              dpr: window.devicePixelRatio || 1 })"""
        )
        im = _root_image()
        iw, ih = int(info["iw"]), int(info["ih"])
        extra_w = max(0, int(info["ow"]) - iw)
        extra_h = max(0, int(info["oh"]) - ih)
        x = int(info["sx"] + extra_w / 2)
        y = int(info["sy"] + extra_h)
        # If device-pixel ratio is realized as larger X11 pixels, scale the box.
        # Emulated mobile dpr is usually composited 1:1 into the window; only
        # scale when the window is clearly larger than outerWidth.
        scale = 1.0
        if im.width >= int(info["ow"]) * 2 and info["dpr"] >= 2:
            scale = float(info["dpr"])
            x, y, iw, ih = int(x * scale), int(y * scale), int(iw * scale), int(ih * scale)
        x = max(0, min(x, im.width - 1))
        y = max(0, min(y, im.height - 1))
        x2 = max(x + 1, min(x + iw, im.width))
        y2 = max(y + 1, min(y + ih, im.height))
        crop = im.crop((x, y, x2, y2))
        if crop.size != (iw, ih):
            crop = crop.resize((max(1, int(info["iw"])), max(1, int(info["ih"]))), Image.BILINEAR)
        return crop

    def _save(im, path=None, typ="png", quality=None):
        typ = (typ or "png").lower()
        if typ == "jpeg":
            typ = "jpeg"
            im = im.convert("RGB")
        buf = BytesIO()
        kw = {}
        if typ in ("jpeg", "jpg") and quality:
            kw["quality"] = int(quality)
        im.save(buf, format="JPEG" if typ in ("jpeg", "jpg") else "PNG", **kw)
        data = buf.getvalue()
        if path:
            Path = __import__("pathlib").Path
            Path(path).write_bytes(data)
        return data

    def page_screenshot(self, **kwargs):
        im = _viewport_image(self)
        clip = kwargs.get("clip")
        if clip:
            x, y, w, h = clip["x"], clip["y"], clip["width"], clip["height"]
            im = im.crop((int(x), int(y), int(x + w), int(y + h)))
        return _save(im, kwargs.get("path"), kwargs.get("type"), kwargs.get("quality"))

    def loc_screenshot(self, **kwargs):
        box = self.bounding_box()
        if not box:
            raise RuntimeError("locator has no bounding box")
        im = _viewport_image(self.page)
        im = im.crop((int(box["x"]), int(box["y"]), int(box["x"] + box["width"]), int(box["y"] + box["height"])))
        return _save(im, kwargs.get("path"), kwargs.get("type"), kwargs.get("quality"))

    BrowserType.launch = launch
    Page.screenshot = page_screenshot
    Locator.screenshot = loc_screenshot

_patch()
