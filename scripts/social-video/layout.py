"""Large, colourful job cards. Source text remains data, never executable markup."""
from pathlib import Path
from datetime import datetime
import re
from PIL import Image, ImageDraw, ImageFont, ImageOps
from qr_code import job_qr
from reel_fonts import font_path

ASSETS = Path(__file__).with_name("assets")
INK = "#201a3c"
MUTED = "#6b6480"
WHITE = "#ffffff"
PALETTES = [('#6633db', '#30237f', '#d7ff6b'), ('#087f92', '#064e70', '#8bffe3'),
            ('#e85e70', '#a43173', '#fff095'), ('#4659df', '#412379', '#a6ffe5')]
LAYOUT_VERSION = 'full-width-serif-gold-v1'
CARTOON_ASSET = ASSETS / 'cartoon-girl-gold.png'
TEXT_SCALE = .5
TAGLINE = 'Authentic Jobs/Internships in India'
OUTRO_MARK_SIZE = 728
HEADER_MARK_SIZE = 96
HEADER_MARK_X = 64
HEADER_MARK_Y = 104
OUTRO_CENTER_X = 480
OUTRO_CENTER_Y = 760
CARD_BOUNDS = (0, 288, 1079, 908)
GIRL_HEIGHT = 960
GIRL_TOP = 520
QR_TOP = 448
QR_TARGET_SIZE = 840
CONTENT_RIGHT = 904
CONTENT_BOTTOM = 1490


def clean(value, limit=180):
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


def scene_content(facts):
    company = clean(facts.get("company"), 100)
    title = clean(facts.get("title"), 240)
    details = []
    for key, label in [('location', 'Location'), ('jobType', 'Employment type'),
                       ('workArrangement', 'Work arrangement'), ('experience', 'Experience'),
                       ('qualification', 'Qualification'), ('salary', 'Salary'), ('closingDate', 'Apply by')]:
        raw = facts.get(key)
        if isinstance(raw, list):
            raw = raw[0] if key == 'location' and raw else ', '.join(str(item) for item in raw)
        value = clean(raw, 600)
        if value and value.casefold() not in {"not specified", "unspecified", "not disclosed", "n/a", "na", "-"}:
            if key == 'location':
                value = re.sub(r'\s*\[[A-Z]{2}\].*$', '', value.split(',')[0], flags=re.I).strip()
            elif key == 'closingDate':
                try:
                    value = datetime.fromisoformat(value.replace('Z', '+00:00')).strftime('%d %b %Y')
                except ValueError:
                    pass
            if value:
                details.append({'key': key, 'label': label, 'value': value})
    # The employer strip stays above the divider on every card.
    scenes = [{'kind': 'role', 'eyebrow': 'JOB ROLE', 'headline': title}]
    scenes += [{'kind': 'metadata', 'fields': [field]} for field in details]
    scenes.append({'kind': 'cta', 'eyebrow': 'SCAN TO APPLY', 'headline': 'Scan to apply', 'cta': True})
    return [dict(scene, company=company, number=f'{index + 1:02d}') for index, scene in enumerate(scenes)]


def font(size, bold=False, condensed=False):
    return ImageFont.truetype(str(font_path(heading=condensed, bold=bold)), max(1, round(size * TEXT_SCALE)))


def wrap(text, face, width):
    """Break long tokens as well as words; source strings cannot insert markup."""
    lines = []; current = ''
    for word in clean(text, 600).split():
        candidate = f'{current} {word}'.strip()
        if face.getlength(candidate) <= width:
            current = candidate
            continue
        if current:
            lines.append(current); current = ''
        for character in word:
            if current and face.getlength(current + character) > width:
                lines.append(current); current = character
            else:
                current += character
    if current:
        lines.append(current)
    return lines


def line_height(face, lines):
    return max(round(face.size * 1.12), max((face.getbbox(line)[3] - face.getbbox(line)[1] for line in lines), default=0) + round(face.size * .06))


def fit_text(text, width, height, initial=196, minimum=88, max_lines=5, bold=False, condensed=False, xscale=1):
    smallest = font(minimum, bold, condensed)
    intact = [word for word in clean(text, 600).split() if smallest.getlength(word) * xscale <= width]
    for size in range(initial, minimum - 1, -2):
        face = font(size, bold, condensed)
        if any(face.getlength(word) * xscale > width for word in intact):
            continue
        lines = wrap(text, face, width / xscale)
        if len(lines) <= max_lines and len(lines) * line_height(face, lines) <= height:
            return face, lines
    face = font(minimum, bold, condensed); wrapped = wrap(text, face, width / xscale)
    allowed = max(1, min(max_lines, int(height // line_height(face, wrapped))))
    lines = wrapped[:allowed]
    if len(wrapped) > allowed:
        while face.getlength(lines[-1] + '\u2026') * xscale > width:
            lines[-1] = lines[-1][:-1]
        lines[-1] += '\u2026'
    return face, lines


def brand_mark(size=OUTRO_MARK_SIZE):
    mark = Image.new('RGBA', (size, size))
    ImageDraw.Draw(mark).rounded_rectangle((0, 0, size - 1, size - 1), radius=round(size * .28), fill=WHITE)
    brand = Image.open(ASSETS / 'jobverify-logo.png').convert('RGBA')
    brand.thumbnail((round(size * .86), round(size * .86)), Image.Resampling.LANCZOS)
    mark.alpha_composite(brand, ((size - brand.width) // 2, (size - brand.height) // 2))
    return mark


def text_layer(text, face, fill, xscale=1):
    """Fit condensed headlines horizontally while retaining their full cap height."""
    left, top, right, bottom = face.getbbox(text)
    layer = Image.new('RGBA', (max(1, right - left), max(1, bottom - top)))
    ImageDraw.Draw(layer).text((-left, -top), text, font=face, fill=fill)
    if xscale != 1:
        layer = layer.resize((max(1, round(layer.width * xscale)), layer.height), Image.Resampling.LANCZOS)
    return layer


def cartoon_girl_layer():
    layer = Image.new('RGBA', (1080, 1920))
    girl = Image.open(CARTOON_ASSET).convert('RGBA')
    girl = girl.crop(girl.getchannel('A').getbbox())
    girl = ImageOps.contain(girl, (640, GIRL_HEIGHT), Image.Resampling.LANCZOS)
    layer.alpha_composite(girl, (-40, GIRL_TOP))
    # The original soft halo may extend farther than the character; keep text clear.
    ImageDraw.Draw(layer).rectangle((448, 0, 1079, 1919), fill=(0, 0, 0, 0))
    return layer


def follow_background(include_text=True):
    image = ImageOps.colorize(Image.linear_gradient('L').resize((1080, 1920)), '#4659df', '#412379').convert('RGB')
    draw = ImageDraw.Draw(image)
    draw.ellipse((824, -165, 1260, 271), fill='#a6ffe5')
    draw.ellipse((-285, 1280, 300, 1865), fill='#9670f2')
    draw.ellipse((-195, 1370, 211, 1776), outline='#c9b8ff', width=3)
    return follow_copy(image) if include_text else image


def follow_copy(image=None):
    image = image if image is not None else Image.new('RGBA', (1080, 1920))
    for text, y, size, fill, condensed in [('Follow', 228, 136, '#a6ffe5', True),
            ('For more jobs', 320, 128, WHITE, False), ('JobVerify.in', 1180, 168, WHITE, True)]:
        layer = text_layer(text, font(size, True, condensed), fill)
        image.paste(layer, (OUTRO_CENTER_X - layer.width // 2, y), layer)
    face, lines = fit_text(TAGLINE, 840, 128, 128, 104, 2, bold=True)
    for index, line in enumerate(lines):
        layer = text_layer(line, face, WHITE)
        image.paste(layer, (OUTRO_CENTER_X - layer.width // 2, 1340 + index * line_height(face, lines)), layer)
    return image


def draw_scene(scene, company_logo=None, job_url=None, header_mark=True):
    top, bottom, accent = PALETTES[(int(scene['number']) - 1) % len(PALETTES)]
    image = ImageOps.colorize(Image.linear_gradient('L').resize((1080, 1920)), top, bottom).convert('RGB')
    draw = ImageDraw.Draw(image); boxes = []
    draw.ellipse((824, -165, 1260, 271), fill=accent)
    draw.ellipse((-285, 1280, 300, 1865), fill='#9670f2')
    draw.ellipse((-195, 1370, 211, 1776), outline='#c9b8ff', width=3)
    draw.line((760, 1510, 1110, 1160), fill=accent, width=36)
    if header_mark:
        mark = brand_mark(HEADER_MARK_SIZE)
        image.paste(mark, (HEADER_MARK_X, HEADER_MARK_Y), mark)
    draw.text((184, 128), 'Jobverify.in', font=font(84, True, True), fill=WHITE, anchor='lt')
    tagline_face = font(80)
    for index, line in enumerate(wrap(TAGLINE.upper(), tagline_face, 840)):
        draw.text((64, 224 + index * 48), line, font=tagline_face, fill=WHITE, anchor='lt')

    def text_block(text, x, y, width, height, initial, minimum, max_lines, fill=INK, bold=False, condensed=False, xscale=1, center=False):
        face, lines = fit_text(text, width, height, initial, minimum, max_lines, bold, condensed, xscale)
        leading = line_height(face, lines)
        for index, line in enumerate(lines):
            layer = text_layer(line, face, fill, xscale)
            left = round(x + (width - layer.width) / 2) if center else x
            baseline = y + index * leading
            image.paste(layer, (left, baseline), layer)
            boxes.append((left, baseline, left + layer.width, baseline + layer.height))
        return y + len(lines) * leading

    # The QR screen uses the full safe width and deliberately omits the employer.
    if scene.get('cta'):
        text_block('Scan to apply', 64, 288, 840, 86, 152, 120, 1, WHITE, True, True)
        text_block('Full details & application', 64, 376, 840, 56, 96, 80, 1, WHITE)
        code = job_qr(job_url)
        image.paste(code, (64 + (840 - code.width) // 2, QR_TOP))
        return image, boxes

    draw.rounded_rectangle((0, 302, 1079, 922), radius=44, fill=bottom)
    draw.rectangle((0, 346, 1079, 878), fill=bottom)
    draw.rounded_rectangle(CARD_BOUNDS, radius=44, fill='#fdfcff')
    draw.rectangle((0, 332, 1079, 864), fill='#fdfcff')
    # A fixed employer strip stays above the divider on each compact job card.
    bounds = (88, 320, 232, 464)
    draw.rounded_rectangle(bounds, radius=28, fill=WHITE, outline='#e7e1f2', width=2)
    if company_logo is not None:
        logo = ImageOps.contain(company_logo.convert('RGBA'), (115, 115), Image.Resampling.LANCZOS)
        image.paste(logo, (160 - logo.width // 2, 392 - logo.height // 2), logo)
    else:
        initials = ''.join(word[0] for word in scene['company'].split()[:2]).upper() or '?'
        face = font(108, True)
        layer = text_layer(initials, face, top, xscale=min(1, 115 / max(1, face.getlength(initials))))
        image.paste(layer, (160 - layer.width // 2, 392 - layer.height // 2), layer)
    text_block('HIRING COMPANY', 272, 320, 600, 64, 88, 88, 1, MUTED, True)
    text_block(scene['company'], 272, 370, 600, 144, 256, 104, 2, bold=True, condensed=True)
    draw.line((88, 520, 880, 520), fill='#e7e1f2', width=2)
    # Content sits to the character's right, above Instagram's lower controls.
    if scene['kind'] == 'metadata':
        field = scene['fields'][0]
        text_block(field['label'].upper(), 448, 548, 432, 100, 88, 72, 2, top, True)
        text_block(field['value'], 448, 672, 432, 208, 224, 88, 5, bold=True)
    else:
        text_block(scene['eyebrow'], 448, 548, 432, 72, 88, 72, 1, top, True)
        text_block(scene['headline'], 448, 606, 432, 274, 264, 104, 5, bold=True, condensed=True)
    return image, boxes
