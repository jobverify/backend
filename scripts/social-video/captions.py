"""Timed captions generated from the narration's word-boundary metadata."""
import html
import math
import re
from pathlib import Path
from PIL import ImageFont
from reel_fonts import font_path

CAPTION_SIZE = 144
CAPTION_WIDTH = 740
CAPTION_FACE = ImageFont.truetype(str(font_path(bold=True)), CAPTION_SIZE)


def caption_cues(words):
    cues = []; group = []; previous = -1
    for word in words:
        text = html.unescape(str(word["text"])).strip()
        offset = float(word["offset"]); duration = float(word["duration"])
        if not text or len(text) > 300 or not math.isfinite(offset + duration) or offset < previous or duration <= 0 or offset < 0:
            raise ValueError("Invalid narration timing")
        previous = offset
        if group and (len(group) >= 2 or CAPTION_FACE.getlength((" ".join(item["text"] for item in group) + " " + text).upper()) > CAPTION_WIDTH):
            cues.append(_cue(group)); group = []
        group.append({"text": text, "offset": offset, "duration": duration})
        if text.endswith((".", "!", "?")):
            cues.append(_cue(group)); group = []
    if group:
        cues.append(_cue(group))
    if not cues:
        raise ValueError("Narration has no timed captions")
    # Do not overlap cues even when boundary durations slightly overlap.
    bounded = []
    for index, (start, end, text) in enumerate(cues):
        end = min(end, cues[index + 1][0]) if index + 1 < len(cues) else end
        lines = text.splitlines()
        parts = ["\n".join(lines[offset:offset + 2]) for offset in range(0, len(lines), 2)]
        for part_index, part in enumerate(parts):
            part_start = start + (end - start) * part_index / len(parts)
            part_end = end if part_index == len(parts) - 1 else start + (end - start) * (part_index + 1) / len(parts)
            bounded.append((part_start, part_end, part))
    return bounded


def _cue(group):
    lines = []; current = ''
    for word in ' '.join(item['text'] for item in group).split():
        candidate = f'{current} {word}'.strip()
        if CAPTION_FACE.getlength(candidate.upper()) <= CAPTION_WIDTH:
            current = candidate
            continue
        if current:
            lines.append(current); current = ''
        # Keep ordinary words intact; their rendered font size fits the safe column.
        if len(word) <= 42:
            lines.append(word)
            continue
        for character in word:
            if current and CAPTION_FACE.getlength((current + character).upper()) > CAPTION_WIDTH:
                lines.append(current); current = character
            else:
                current += character
    if current:
        lines.append(current)
    return (group[0]['offset'], group[-1]['offset'] + group[-1]['duration'], '\n'.join(lines))


def display_words(words):
    """TTS pronounces the domain explicitly; captions retain the actual handle."""
    result = []; index = 0
    while index < len(words):
        group = words[index:index + 3]
        if len(group) == 3 and [re.sub(r'\W', '', item['text']).casefold() for item in group] == ['jobverify', 'dot', 'in']:
            result.append({'text': 'JobVerify.in', 'offset': group[0]['offset'], 'duration': group[-1]['offset'] + group[-1]['duration'] - group[0]['offset']})
            index += 3
        else:
            result.append(dict(words[index])); index += 1
    return result


def stamp(seconds, ass=False):
    total = round(seconds * (100 if ass else 1000)); unit = 100 if ass else 1000
    hours, remainder = divmod(total, 3600 * unit); minutes, remainder = divmod(remainder, 60 * unit); whole, fraction = divmod(remainder, unit)
    return f"{hours:d}:{minutes:02d}:{whole:02d}.{fraction:02d}" if ass else f"{hours:02d}:{minutes:02d}:{whole:02d},{fraction:03d}"


def to_srt(cues):
    return "\n\n".join(f"{index}\n{stamp(start)} --> {stamp(end)}\n{text}" for index, (start, end, text) in enumerate(cues, 1)) + "\n"


def to_ass(cues, words=None, qr_start=None):
    header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Georgia,144,&H006BFFD7,&H00FFFFFF,&H003C1A20,&H803C1A20,-1,0,0,0,100,100,0,0,1,5,3,2,448,176,700,1
Style: QR,Georgia,144,&H006BFFD7,&H00FFFFFF,&H003C1A20,&H803C1A20,-1,0,0,0,100,100,0,0,1,5,3,2,64,176,520,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    rows = []
    for start, end, text in cues:
        # Emit karaoke tags ourselves; source strings cannot insert ASS commands.
        timed = [word for word in (words or []) if start - .015 <= word['offset'] < end]
        tokens = re.split(r'(\s+)', text); token_index = 0; pieces = []
        for token in tokens:
            if not token or token.isspace():
                pieces.append(token.replace('\n', r'\N')); continue
            safe = token.upper().replace('\\', '\\\\').replace('{', r'\{').replace('}', r'\}')
            if timed and token_index < len(timed):
                word_start = timed[token_index]['offset']
                word_end = timed[token_index + 1]['offset'] if token_index + 1 < len(timed) else end
                pieces.append('{\\kf' + str(max(1, round((word_end - word_start) * 100))) + '}' + safe)
            else:
                pieces.append(safe)
            token_index += 1
        style = "QR" if qr_start is not None and end > qr_start else "Default"
        width = 820 if style == 'QR' else 436
        measured = max(CAPTION_FACE.getlength(line.upper()) for line in text.splitlines())
        size = min(CAPTION_SIZE, max(1, int(CAPTION_SIZE * width / max(1, measured))))
        pop = '{\\fs' + str(size) + r'\fad(40,70)\fscx94\fscy94\t(0,120,\fscx100\fscy100)}'
        rows.append(f"Dialogue: 0,{stamp(start, True)},{stamp(end, True)},{style},,0,0,0,,{pop}{''.join(pieces)}")
    return header + "\n".join(rows) + "\n"
