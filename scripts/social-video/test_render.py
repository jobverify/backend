"""Behavioral and real-media checks: python -m unittest discover -s scripts/social-video."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import wave
from PIL import Image

SPEC = importlib.util.spec_from_file_location("reel_render", Path(__file__).with_name("render.py"))
render = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(render)


def fixture():
    return {"postId": "1234567890abcdef12345678", "renderId": "fixture", "factsHash": "a" * 64, "planHash": "b" * 64,
            "facts": {"id": "1234567890abcdef12345678", "company": "Müller & Co", "title": "Graduate Software Engineer — Platform Engineering and Developer Experience", "location": "Bengaluru", "jobType": "Full-time Fresher"},
            "plan": {"templateVersion": "jobverify-reel-v6", "jobUrl": "https://www.jobverify.in/jobs/1234567890abcdef12345678", "companyDomain": "", "voice": "en-IN-NeerjaNeural", "script": "Müller and Company is hiring a Graduate Software Engineer in Bengaluru. Scan the QR code for full details and to apply. Follow JobVerify.in for more jobs.", "width": 1080, "height": 1920, "fps": 30, "minDuration": 15, "maxDuration": 15, "ctaHold": 3}}


class LayoutTests(unittest.TestCase):
    def test_all_available_metadata_is_present_in_labelled_pages(self):
        facts = dict(fixture()['facts'], experience='10-15 years', qualification='B.E. or B.Tech in Computer Science', salary='INR 12-18 lakh per year', closingDate='2026-12-31T00:00:00.000Z')
        scenes = render.scene_content(facts)
        fields = [field for scene in scenes for field in scene.get('fields', [])]
        self.assertEqual({field['key'] for field in fields}, {'location', 'jobType', 'experience', 'qualification', 'salary', 'closingDate'})
        self.assertEqual(len(fields), 6)
        for field in fields:
            self.assertTrue(field['label'])
            self.assertTrue(field['value'])
        self.assertEqual(next(field['value'] for field in fields if field['key'] == 'qualification'), facts['qualification'])
        for scene in scenes:
            _, boxes = render.draw_scene(scene, job_url=fixture()['plan']['jobUrl'])
            self.assertTrue(all(64 <= x0 < x1 <= 904 and 100 <= y0 < y1 <= (432 if scene.get("cta") else 908) for x0, y0, x1, y1 in boxes))

    def test_fitting_shrinks_city_before_breaking_it_across_lines(self):
        from layout import fit_text
        face, lines = fit_text('Bengaluru', 432, 208, 224, 88, 5, bold=True)
        self.assertEqual(lines, ['Bengaluru'])
        self.assertLessEqual(face.getlength(lines[0]), 432)

    def test_metadata_pages_keep_voice_cta_alignment_for_variable_card_counts(self):
        words = [{'text': text, 'offset': offset, 'duration': .3} for text, offset in [('Scan', 13), ('the', 13.4), ('QR', 13.8), ('code', 14.1)]]
        lengths = render.scene_lengths(25, words, body_count=5)
        self.assertEqual(len(lengths), 6)
        self.assertAlmostEqual(sum(lengths), 25)
        self.assertAlmostEqual(sum(lengths[:-1]), 13)
        self.assertTrue(all(length > 0 for length in lengths))

    def test_location_card_shows_only_the_first_location_without_changing_facts(self):
        for location in ['Bengaluru, Karnataka, India', 'Bengaluru [KA] [IN]']:
            facts = dict(fixture()['facts'], location=location)
            scenes = render.scene_content(facts)
            value = next(field['value'] for scene in scenes for field in scene.get('fields', []) if field['key'] == 'location')
            self.assertEqual(value, 'Bengaluru')
            self.assertEqual(facts['location'], location)

    def test_fifteen_second_reel_keeps_qr_visible_before_the_follow_request(self):
        words = [{'text': text, 'offset': offset, 'duration': .2} for text, offset in [('Scan', 8.8), ('the', 9), ('QR', 9.2), ('code', 9.4), ('Follow', 11.2), ('JobVerify.in', 11.5)]]
        lengths = render.scene_lengths(15, words, body_count=4)
        self.assertAlmostEqual(sum(lengths), 15)
        self.assertGreaterEqual(render.follow_start(words) - sum(lengths[:-1]), 3)
        self.assertTrue(all(length > 0 for length in lengths))

    def test_final_card_qr_decodes_to_this_job_page(self):
        try:
            import zxingcpp
        except ImportError:
            self.skipTest('Install requirements-test.txt for independent QR decoding')
        url = 'https://www.jobverify.in/jobs/1234567890abcdef12345678'
        image, _ = render.draw_scene(render.scene_content(fixture()['facts'])[-1], job_url=url)
        barcode = zxingcpp.read_barcode(image)
        self.assertIsNotNone(barcode)
        self.assertEqual(barcode.text, url)

    def test_follow_animation_uses_the_final_spoken_follow_cue(self):
        words = [{'text': text, 'offset': offset, 'duration': 0.3} for text, offset in [('Follow', 2.0), ('the', 2.4), ('instructions', 2.8), ('Follow', 18.35), ('JobVerify.in', 18.8)]]
        self.assertAlmostEqual(render.follow_start(words), 18.35, delta=1/30)
        with self.assertRaises(ValueError):
            render.follow_start(words[:3])

    def test_employer_logo_is_present_above_details_and_omitted_from_qr(self):
        logo = Image.new('RGBA', (200, 100), '#ff00ff')
        for scene in render.scene_content(fixture()['facts']):
            image, _ = render.draw_scene(scene, company_logo=logo, job_url=fixture()['plan']['jobUrl'])
            if scene.get('cta'):
                self.assertNotIn((255, 0, 255), image.getdata(), 'the QR screen must omit company branding')
                continue
            pixels = [(x, y) for y in range(320, 464) for x in range(88, 232) if image.getpixel((x, y)) == (255, 0, 255)]
            self.assertTrue(pixels, 'the hiring company logo must stay above job details')
            width = max(x for x, _ in pixels) - min(x for x, _ in pixels) + 1
            height = max(y for _, y in pixels) - min(y for _, y in pixels) + 1
            self.assertAlmostEqual(width / height, 2, delta=0.05)

    def test_scenes_fit_long_unicode_facts_and_omit_unknown_salary(self):
        scenes = render.scene_content(fixture()["facts"])
        self.assertEqual(len(scenes), 4)
        self.assertIn("Müller", scenes[0]["company"])
        self.assertFalse(any("salary" in json.dumps(scene).lower() for scene in scenes))
        for scene in scenes:
            image, boxes = render.draw_scene(scene, job_url=fixture()['plan']['jobUrl'])
            self.assertEqual(image.size, (1080, 1920))
            self.assertTrue(boxes)
            self.assertTrue(all(64 <= x0 < x1 <= 904 and 100 <= y0 < y1 <= (432 if scene.get("cta") else 908) for x0, y0, x1, y1 in boxes))

    def test_captions_come_from_timed_words_with_readable_groups(self):
        words = [{"text": word, "offset": index * 0.35, "duration": 0.3} for index, word in enumerate(fixture()["plan"]["script"].split())]
        cues = render.caption_cues(words)
        self.assertEqual(" ".join(cue[2].replace("\n", " ") for cue in cues), fixture()["plan"]["script"])
        self.assertTrue(all(start < end for start, end, _ in cues))
        self.assertTrue(all(len(line) <= 42 for _, _, text in cues for line in text.splitlines()))
        self.assertIn("00:00:00,000 -->", render.to_srt(cues))

    def test_cta_scene_starts_with_spoken_call_to_action_and_holds_at_least_three_seconds(self):
        words = [{"text": text, "offset": offset, "duration": 0.3} for text, offset in [("Scan", 11.0), ("the", 11.4), ("QR", 11.8), ("code", 12.1)]]
        lengths = render.scene_lengths(19, words)
        self.assertAlmostEqual(sum(lengths), 19)
        self.assertAlmostEqual(sum(lengths[:3]), 11)
        self.assertGreaterEqual(lengths[3], 3)
        self.assertTrue(all(round(length * 30) == round(length * 30, 5) for length in lengths))

    def test_long_timed_token_is_split_into_at_most_two_caption_lines(self):
        token = "x" * 240
        cues = render.caption_cues([{"text": token, "offset": 1.0, "duration": 6.0}])
        self.assertTrue(all(len(text.splitlines()) <= 2 for _, _, text in cues))
        self.assertEqual("".join(text.replace("\n", "") for _, _, text in cues), token)
        self.assertEqual((cues[0][0], cues[-1][1]), (1.0, 7.0))

    def test_rejects_unbounded_script_or_wrong_plan(self):
        claim = fixture(); claim["plan"]["script"] = "x" * 451
        with self.assertRaises(ValueError): render.validate_claim(claim)
        claim = fixture(); claim["plan"]["width"] = 720
        with self.assertRaises(ValueError): render.validate_claim(claim)

    def test_fixed_fifteen_second_duration_rejects_speech_that_still_needs_fitting(self):
        self.assertEqual(render.video_duration(11), 15)
        self.assertEqual(render.video_duration(14.4), 15)
        with self.assertRaises(ValueError): render.video_duration(23)
        with self.assertRaises(ValueError): render.video_duration(28)


@unittest.skipUnless(os.environ.get("SOCIAL_VIDEO_RENDER_INTEGRATION") == "1", "set SOCIAL_VIDEO_RENDER_INTEGRATION=1 for real FFmpeg render")
class MediaTests(unittest.TestCase):
    def test_fixture_renders_valid_faststart_portrait_with_audio(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            claim = fixture()
            claim['facts'].update(experience='2 years', qualification='B.E. in Computer Science', salary='INR 12-18 lakh', closingDate='2026-12-31')
            (root / "claim.json").write_text(json.dumps(claim), encoding="utf-8")
            with wave.open(str(root / "fixture.wav"), "wb") as audio:
                audio.setparams((1, 2, 48000, 0, "NONE", "not compressed")); audio.writeframes(b"\x00\x00" * 48000 * 16)
            tokens = claim['plan']['script'].split(); scan_index = tokens.index('Scan')
            words = [{'text': word, 'offset': index * 8.2 / scan_index if index < scan_index else 8.2 + (index - scan_index) * .4, 'duration': .35} for index, word in enumerate(tokens)]
            (root / "words.json").write_text(json.dumps(words), encoding="utf-8")
            subprocess.run([os.sys.executable, str(Path(render.__file__)), "--claim", str(root / "claim.json"), "--output", str(root / "out"), "--fixture-audio", str(root / "fixture.wav"), "--fixture-words", str(root / "words.json")], check=True, timeout=300)
            manifest = json.loads((root / "out/manifest.json").read_text())
            self.assertTrue(all(isinstance(value, str) for value in manifest["versions"].values()), "API completion accepts bounded version strings only")
            self.assertEqual(len(manifest["scenes"]), len(render.scene_content(claim["facts"])), "every available metadata field must render")
            video = manifest["artifacts"]["video"]
            self.assertEqual((video["width"], video["height"], video["fps"]), (1080, 1920, 30))
            self.assertEqual((video["videoCodec"], video["audioCodec"]), ("h264", "aac"))
            self.assertLessEqual(video["size"], 16 * 1024 * 1024)
            self.assertAlmostEqual(video["duration"], 15, places=2)
            self.assertGreater(float(manifest["versions"]["narrationTempo"]), 1)
            self.assertGreaterEqual(manifest["timing"]["followStart"] - manifest["timing"]["qrStart"], 3)
            self.assertLess(manifest["timing"]["lastSpokenWordEnd"], 15)
            binary = (root / "out/video.mp4").read_bytes()
            self.assertLess(binary.index(b"moov"), binary.index(b"mdat"))


if __name__ == "__main__":
    unittest.main()
