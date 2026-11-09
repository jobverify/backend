import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import psutil

backend = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend / 'scripts'))
spec = importlib.util.spec_from_file_location('candidate_guard', backend / 'scripts/watchTrialCandidate.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class CandidateGuardTest(unittest.TestCase):
    def test_rejects_unrelated_python_process(self):
        with self.assertRaisesRegex(ValueError, 'candidate'):
            guard.validate_candidate(psutil.Process(), Path(tempfile.gettempdir()))

    def test_cpu_stop_terminates_only_registered_trial_and_candidate_and_retains_saved_results(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary).resolve()
            probe = directory / 'instruct-model-probe.py'
            probe.write_text('# fixture')
            owner = subprocess.Popen(['node', '-e', 'setInterval(()=>{},1000)', str(backend / 'scripts/runPostScrapeTrial.js'), str(directory)])
            candidate = subprocess.Popen([sys.executable, '-c', 'import time;time.sleep(60)', str(probe), 'base', 'performance'])
            unrelated = subprocess.Popen([sys.executable, '-c', 'import time;time.sleep(60)'])
            processes = [owner, candidate, unrelated]
            try:
                owner_created = psutil.Process(owner.pid).create_time()
                candidate_created = psutil.Process(candidate.pid).create_time()
                (directory / 'trial-pipeline.json').write_text(json.dumps({'pid':owner.pid,'stage':'classification'}))
                saved = directory / 'saved-classification.json'
                saved.write_text('{"preserved":true}')
                result = guard.watch(directory, owner.pid, owner_created, candidate.pid, candidate_created,
                                     sample=lambda: {'ram':1,'cpu':91})
                self.assertEqual(result['status'], 'stopped_resource_limit')
                owner.wait(timeout=5)
                candidate.wait(timeout=5)
                self.assertIsNone(unrelated.poll())
                self.assertEqual(saved.read_text(), '{"preserved":true}')
                self.assertEqual(json.loads((directory / 'resource-stop.json').read_text())['exceeded'], ['cpu'])
            finally:
                for process in processes:
                    if process.poll() is None:
                        process.terminate()
                    process.wait(timeout=5)


if __name__ == '__main__':
    unittest.main()
