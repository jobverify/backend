"""Render one API-owned job snapshot. No database or social credentials are used."""
import argparse
import asyncio
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys

# The script is also imported from the unit test module.
sys.path.insert(0, str(Path(__file__).parent))
from layout import CARTOON_ASSET, ASSETS, LAYOUT_VERSION, OUTRO_MARK_SIZE, HEADER_MARK_SIZE, HEADER_MARK_X, HEADER_MARK_Y, OUTRO_CENTER_X, OUTRO_CENTER_Y, CARD_BOUNDS, GIRL_HEIGHT, CONTENT_RIGHT, CONTENT_BOTTOM, brand_mark, draw_scene, follow_background, follow_copy, cartoon_girl_layer, scene_content
from reel_fonts import font_path
from captions import caption_cues, display_words, to_ass, to_srt
from branding import load_company_logo
from qr_code import valid_job_url


class RenderFailure(Exception):
    def __init__(self, reason):
        self.reason = reason


def validate_claim(claim):
    plan = claim.get("plan", {})
    expected = {"templateVersion": "jobverify-reel-v6", "voice": "en-IN-NeerjaNeural", "width": 1080, "height": 1920, "fps": 30, "minDuration": 15, "maxDuration": 15, "ctaHold": 3}
    if any(plan.get(key) != value for key, value in expected.items()):
        raise ValueError("Unsupported render plan")
    if not isinstance(plan.get('companyDomain'), str) or len(plan['companyDomain']) > 253:
        raise ValueError('Invalid company branding')
    script = plan.get("script")
    if not isinstance(script, str) or not script.strip() or len(script) > 450 or any(ord(char) < 32 and char not in "\n\t" for char in script):
        raise ValueError("Invalid script")
    facts = claim.get("facts")
    if not isinstance(facts, dict) or not all(isinstance(facts.get(key), str) and 0 < len(facts[key]) <= 1000 for key in ("title", "company")):
        raise ValueError("Invalid source facts")
    if not valid_job_url(plan.get('jobUrl'), facts.get('id')) or not script.endswith('Follow JobVerify.in for more jobs.'):
        raise ValueError('Invalid job QR or follow narration')
    if len(json.dumps(facts)) > 32000:
        raise ValueError("Source facts too large")
    return plan


def video_duration(speech_duration):
    if not math.isfinite(speech_duration) or not 0 < speech_duration <= 14.5:
        raise ValueError('Narration must fit before the final frame')
    return 15


def fit_narration(speech, words, output):
    original_duration = float(probe(speech)['format']['duration'])
    if not math.isfinite(original_duration) or not 0 < original_duration <= 27:
        raise ValueError('Narration exceeds the supported source duration')
    tempo = max(1, original_duration / 14.4)
    if tempo == 1:
        return speech, words, original_duration, tempo
    fitted = output / 'narration-fitted.wav'
    run([tool('ffmpeg'), '-hide_banner', '-loglevel', 'error', '-y', '-i', str(speech),
         '-af', f'atempo={tempo:.10f}', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', str(fitted)], timeout=30)
    timed = [dict(word, offset=float(word['offset']) / tempo, duration=float(word['duration']) / tempo) for word in words]
    return fitted, timed, float(probe(fitted)['format']['duration']), tempo


def scene_lengths(duration, words, body_count=3):
    if not isinstance(body_count, int) or not 1 <= body_count <= 12:
        raise ValueError('Invalid metadata card count')
    normalized = ["".join(char for char in item["text"].casefold() if char.isalnum()) for item in words]
    spoken_cta = next((float(words[index]["offset"]) for index in range(len(words) - 3)
                       if normalized[index:index + 4] == ["scan", "the", "qr", "code"]), duration - 3)
    total_frames = round(duration * 30)
    try:
        follow_at = follow_start(words)
    except ValueError:
        follow_at = duration
    # Start the QR slightly early when needed to preserve its full scan window.
    latest_body_frame = math.floor((follow_at - 3) * 30 + 1e-6) - 1
    body_frames = max(body_count * 15, min(round(spoken_cta * 30), latest_body_frame, total_frames - 90))
    beat_frames, remainder = divmod(body_frames, body_count)
    return [(beat_frames + (1 if index < remainder else 0)) / 30 for index in range(body_count)] + [(total_frames - body_frames) / 30]


def follow_start(words):
    normalized = [''.join(char for char in word['text'].casefold() if char.isalnum()) for word in words]
    matches = [index for index in range(len(words) - 1) if normalized[index] == 'follow' and normalized[index + 1].startswith('jobverify')]
    if not matches:
        raise ValueError('Missing timed follow request')
    return math.floor(float(words[matches[-1]]['offset']) * 30) / 30


def tool(name):
    executable = os.environ.get(f"SOCIAL_VIDEO_{name.upper()}") or shutil.which(name)
    if not executable:
        raise RenderFailure("runner_failed")
    return executable


def run(arguments, cwd=None, timeout=240):
    try:
        return subprocess.run(arguments, cwd=cwd, check=True, capture_output=True, timeout=timeout, text=True)
    except subprocess.TimeoutExpired as error:
        raise RenderFailure("timeout") from error
    except (OSError, subprocess.CalledProcessError) as error:
        raise RenderFailure("render_failed") from error


def probe(path):
    return json.loads(run([tool("ffprobe"), "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)], timeout=20).stdout)


async def narrate(script, output):
    import edge_tts
    words = []
    try:
        spoken_script = script.replace('JobVerify.in', 'JobVerify dot in')
        communicate = edge_tts.Communicate(spoken_script, voice="en-IN-NeerjaNeural", rate="+0%", boundary="WordBoundary", connect_timeout=15, receive_timeout=45)
        with output.open("wb") as audio:
            async for item in communicate.stream():
                if item["type"] == "audio":
                    audio.write(item["data"])
                elif item["type"] == "WordBoundary":
                    words.append({"text": item["text"], "offset": item["offset"] / 10_000_000, "duration": item["duration"] / 10_000_000})
        if output.stat().st_size < 1000 or not words:
            raise ValueError("Missing narration")
        return display_words(words)
    except Exception as error:
        raise RenderFailure("narration_failed") from error


def artifact(path, **properties):
    return {"path": path.name, "hash": hashlib.sha256(path.read_bytes()).hexdigest(), "size": path.stat().st_size, **properties}


def verify_video(path):
    data = probe(path); streams = data["streams"]
    video = next((stream for stream in streams if stream["codec_type"] == "video"), {})
    audio = next((stream for stream in streams if stream["codec_type"] == "audio"), {})
    fps = video.get("avg_frame_rate", "0/1").split("/"); rate = int(fps[0]) / max(1, int(fps[1]))
    duration = float(data["format"]["duration"])
    if (video.get("width"), video.get("height"), video.get("codec_name"), video.get("pix_fmt")) != (1080, 1920, "h264", "yuv420p") or rate != 30 or video.get("field_order") not in ("progressive", "unknown", None):
        raise RenderFailure("invalid_media")
    if audio.get("codec_name") != "aac" or int(audio.get("sample_rate", 0)) != 48000 or not 15 <= duration <= 30 or path.stat().st_size > 16 * 1024 * 1024:
        raise RenderFailure("invalid_media")
    binary = path.read_bytes()
    if binary.find(b"moov") < 0 or binary.find(b"mdat") < binary.find(b"moov"):
        raise RenderFailure("invalid_media")
    return artifact(path, width=1080, height=1920, fps=30, duration=duration, videoCodec="h264", audioCodec="aac", type="video/mp4")


def render(claim, output, fixture_audio=None, fixture_words=None):
    plan = validate_claim(claim); output.mkdir(parents=True, exist_ok=True)
    if bool(fixture_audio) != bool(fixture_words):
        raise ValueError("Both fixture inputs are required")
    if fixture_audio:
        speech = Path(fixture_audio).resolve(); words = json.loads(Path(fixture_words).read_text(encoding="utf-8"))
    else:
        speech = output / "narration.mp3"
        words = asyncio.run(asyncio.wait_for(narrate(plan["script"], speech), timeout=100))
    speech, words, speech_duration, tempo = fit_narration(speech, words, output)
    duration = video_duration(speech_duration)
    scenes = scene_content(claim['facts']); scene_count = len(scenes)
    lengths = scene_lengths(duration, words, body_count=scene_count - 1)
    follow_at = follow_start(words)
    if follow_at < sum(lengths[:-1]) + 3 or follow_at + .85 > speech_duration:
        raise RenderFailure('invalid_media')
    cues = caption_cues(words)
    if cues[-1][1] > speech_duration + 0.25:
        raise RenderFailure("invalid_media")
    (output / "captions.srt").write_text(to_srt(cues), encoding="utf-8")
    (output / "captions.ass").write_text(to_ass([cue for cue in cues if cue[0] < follow_at], words, qr_start=sum(lengths[:-1])), encoding="utf-8")
    (output / 'words.json').write_text(json.dumps(words, indent=2), encoding='utf-8')
    (output / "fonts").mkdir(exist_ok=True)
    for bold in (False, True):
        source = font_path(bold=bold)
        shutil.copyfile(source, output / "fonts" / source.name)
    company_logo, branding = asyncio.run(load_company_logo({'companyDomain': plan['companyDomain']}))
    if company_logo is not None:
        company_logo.save(output / 'company-logo.png')
    girl = cartoon_girl_layer()
    girl.save(output / 'cartoon-girl-overlay.png')
    for index, scene in enumerate(scenes):
        image, _ = draw_scene(scene, company_logo=company_logo, job_url=plan['jobUrl'], header_mark=False); image.save(output / f"scene-{index}.png")
        if index == 0:
            cover, _ = draw_scene(scene, company_logo=company_logo, job_url=plan['jobUrl'])
            cover.paste(girl, (0, 0), girl)
            cover.save(output / "cover.jpg", quality=91, optimize=True)
    follow_background(include_text=False).save(output / 'follow-background.png')
    follow_copy().save(output / 'follow-copy.png')
    brand_mark().save(output / 'brand-mark.png')
    # Align the final card with its spoken CTA and retain at least three seconds.
    arguments = [tool("ffmpeg"), "-hide_banner", "-loglevel", "error", "-y"]
    for index, length in enumerate(lengths):
        arguments += ["-loop", "1", "-framerate", "30", "-t", f"{length:.6f}", "-i", f"scene-{index}.png"]
    arguments += ["-i", str(speech), "-stream_loop", "-1", "-i", str(ASSETS / "instrumental.wav")]
    for filename in ['follow-background.png', 'brand-mark.png', 'follow-copy.png', 'cartoon-girl-overlay.png']:
        arguments += ['-loop', '1', '-framerate', '30', '-i', filename]
    filters = []
    for index, length in enumerate(lengths):
        filters.append(f"[{index}:v]trim=duration={length:.6f},setpts=PTS-STARTPTS,setsar=1,format=yuv420p[v{index}]")
    ease = f'(1-pow(1-clip((t-{follow_at:.6f})/0.85,0,1),3))'
    mark_growth = OUTRO_MARK_SIZE - HEADER_MARK_SIZE
    mark_dx = OUTRO_CENTER_X - OUTRO_MARK_SIZE / 2 - HEADER_MARK_X
    mark_dy = OUTRO_CENTER_Y - OUTRO_MARK_SIZE / 2 - HEADER_MARK_Y
    filters += [''.join(f'[v{index}]' for index in range(scene_count)) + f'concat=n={scene_count}:v=1:a=0[base]',
                f'[{scene_count + 2}:v]format=rgba,fade=t=in:st={follow_at:.6f}:d=0.35:alpha=1[follow]',
                '[base][follow]overlay=0:0:shortest=1[background]',
                f"[{scene_count + 3}:v]format=rgba,scale=w='round({HEADER_MARK_SIZE}+{mark_growth}*{ease})':h='round({HEADER_MARK_SIZE}+{mark_growth}*{ease})':eval=frame:flags=lanczos[mark]",
                f"[background][mark]overlay=x='{HEADER_MARK_X}+{mark_dx}*{ease}':y='{HEADER_MARK_Y}+{mark_dy}*{ease}':eval=frame:shortest=1[withmark]",
                f'[{scene_count + 4}:v]format=rgba,fade=t=in:st={follow_at + .85:.6f}:d=0.2:alpha=1[followcopy]',
                '[withmark][followcopy]overlay=0:0:shortest=1[withcopy]',
                f'[{scene_count + 5}:v]format=rgba,fade=t=in:st=0.25:d=0.25:alpha=1,fade=t=out:st={sum(lengths[:-1]) - .2:.6f}:d=0.2:alpha=1[girl]',
                "[withcopy][girl]overlay=x=0:y='2*sin(t*2)':shortest=1,ass=captions.ass:fontsdir=fonts,fade=t=in:st=0:d=0.3[outv]",
                f"[{scene_count}:a]aresample=48000,loudnorm=I=-16:TP=-1.5:LRA=7,apad,atrim=duration={duration:.6f}[voice]",
                f"[{scene_count + 1}:a]aresample=48000,volume=0.12,afade=t=in:st=0:d=0.8,afade=t=out:st={duration-1.2:.6f}:d=1.2,atrim=duration={duration:.6f}[music]",
                "[voice][music]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95[outa]"]
    arguments += ["-filter_complex_threads", "2", "-filter_complex", ";".join(filters), "-map", "[outv]", "-map", "[outa]", "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-maxrate", "4M", "-bufsize", "8M", "-pix_fmt", "yuv420p", "-r", "30", "-g", "60", "-keyint_min", "60", "-sc_threshold", "0", "-flags", "+cgop", "-threads", "2", "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", "-t", f"{duration:.6f}", "video.mp4"]
    run(arguments, cwd=output, timeout=240)
    manifest = {"artifacts": {"video": verify_video(output / "video.mp4"), "cover": artifact(output / "cover.jpg", type="image/jpeg", width=1080, height=1920), "subtitles": artifact(output / "captions.srt", type="application/x-subrip")},
                "branding": branding,
                'timing': {'qrStart': sum(lengths[:-1]), 'followStart': follow_at, 'logoCenteredAt': follow_at + .85, 'lastSpokenWordEnd': cues[-1][1]},
                'scenes': [{'kind': scene['kind'], 'duration': length} for scene, length in zip(scenes, lengths)],
                'jobUrl': plan['jobUrl'],
                'layout': {'cardBounds': list(CARD_BOUNDS), 'cardFullWidth': True, 'girlHeight': GIRL_HEIGHT, 'contentRight': CONTENT_RIGHT, 'contentBottom': CONTENT_BOTTOM, 'qrCompanyHidden': True, 'girlJobCardsOnly': True, 'outroCenter': [OUTRO_CENTER_X, OUTRO_CENTER_Y]},
                "versions": {"renderer": "jobverify-reel-v6", 'layout': LAYOUT_VERSION, 'headingFont': 'Times New Roman', 'detailFont': 'Georgia', 'captionFont': 'Georgia', 'narrationTempo': f'{tempo:.6f}', 'cartoonGirl': hashlib.sha256(CARTOON_ASSET.read_bytes()).hexdigest(), 'qrcode': importlib.metadata.version('qrcode'), "companyLogo": branding.get('sha256', 'initials'), "python": sys.version.split()[0], "pillow": importlib.metadata.version("Pillow"), "edge-tts": importlib.metadata.version("edge-tts"),
                             "ffmpeg": run([tool("ffmpeg"), "-version"], timeout=10).stdout.splitlines()[0][:160], "fixture": "true" if fixture_audio else "false"}}
    if manifest["artifacts"]["cover"]["size"] > 2 * 1024 * 1024 or manifest["artifacts"]["subtitles"]["size"] > 64 * 1024:
        raise RenderFailure("invalid_media")
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--claim", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--fixture-audio", type=Path, help="Explicit offline test narration; never passed by production runner")
    parser.add_argument("--fixture-words", type=Path)
    args = parser.parse_args()
    try:
        if args.claim.stat().st_size > 65536:
            raise ValueError("Claim too large")
        render(json.loads(args.claim.read_text(encoding="utf-8")), args.output.resolve(), args.fixture_audio, args.fixture_words)
    except Exception as error:
        reason = error.reason if isinstance(error, RenderFailure) else "invalid_media" if isinstance(error, ValueError) else "render_failed"
        print(f"RENDER_FAILURE:{reason}", file=sys.stderr); sys.exit(1)
