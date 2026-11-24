"""Resolve the requested serif families from installed or supplied fonts."""
from functools import lru_cache
import os
from pathlib import Path


@lru_cache(maxsize=4)
def font_path(heading=False, bold=False):
    names = (("timesbd.ttf", "Times_New_Roman_Bold.ttf") if bold else ("times.ttf", "Times_New_Roman.ttf")) if heading else (("georgiab.ttf", "Georgia_Bold.ttf") if bold else ("georgia.ttf", "Georgia.ttf"))
    directories = []
    supplied = os.environ.get("SOCIAL_VIDEO_FONT_DIR")
    if supplied:
        directories.append(Path(supplied))
    directories += [Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts",
                    Path("/usr/share/fonts/truetype/msttcorefonts"),
                    Path("/Library/Fonts"), Path("/System/Library/Fonts/Supplemental")]
    for directory in directories:
        for name in names:
            candidate = directory / name
            if candidate.is_file():
                return candidate
    family = "Times New Roman" if heading else "Georgia"
    raise RuntimeError(f"Install {family} or set SOCIAL_VIDEO_FONT_DIR to its font directory")
