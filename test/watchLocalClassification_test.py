import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
spec = importlib.util.spec_from_file_location('classification_guard', ROOT / 'scripts/watchLocalClassification.py')
watch = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watch)


class ClassificationGuardTest(unittest.TestCase):
    def test_classification_cools_and_restarts_without_changing_the_capture(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            state = {'mode': 'dry-run', 'status': 'complete', 'completedCount': 1,
                     'totalSources': 1, 'catalogSources': ['fixture'],
                     'completed': {'fixture': {'result': {'success': True}}}}
            capture = json.dumps(state)
            (directory / 'run-state.json').write_text(capture)
            (directory / 'run-metadata.json').write_text('{"mode":"dry-run"}')
            script = (
                "import json,time\n"
                "from pathlib import Path\n"
                f"d=Path({str(directory)!r})\n"
                "deadline=time.monotonic()+30\n"
                "while not (d/'classification-may-finish').exists():\n"
                "    if time.monotonic() >= deadline: raise SystemExit('Fixture release was not received')\n"
                "    time.sleep(.01)\n"
                "(d/'corpus-manifest.json').write_text(json.dumps({'jobCount':1}))\n"
                "(d/'classification-summary.json').write_text(json.dumps({'total':1,'completed':1,'skipped':0,'failed':0,'completedAt':'2026-10-12'}))\n"
            )
            readings = iter([{'cpu': 20, 'ram': 45}, {'cpu': 95, 'ram': 45}])
            def sample():
                reading = next(readings, None)
                if reading is not None:
                    return reading
                # Release the fixture only after the resource stop enters cooling.
                (directory / 'classification-may-finish').touch()
                return {'cpu': 20, 'ram': 45}
            result = watch.run(directory, interval=.01, cooldown_seconds=.01,
                sample=sample,
                command=[sys.executable, '-c', script])
            self.assertEqual(result['status'], 'complete')
            self.assertEqual(result['resourceStops'], 1)
            self.assertEqual((directory / 'run-state.json').read_text(), capture)
            events = (directory / 'classification-monitor/watchdog-events.ndjson').read_text()
            self.assertIn('resources_recovered', events)
            self.assertEqual(events.count('stage_process_started'), 2)

    def test_an_incomplete_capture_does_not_start_classification(self):
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaisesRegex(ValueError, 'complete local dry-run'):
                watch.run(Path(temporary))


if __name__ == '__main__':
    unittest.main()
