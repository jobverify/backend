import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

backend = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend / 'scripts'))
spec = importlib.util.spec_from_file_location('finish_trial', backend / 'scripts/finishLocalClassificationTrial.py')
supervisor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(supervisor)


class CompletionSupervisorTest(unittest.TestCase):
    def owner(self, directory):
        runner = backend / 'scripts/runPostScrapeTrial.js'
        return subprocess.Popen(['node', '-e', 'setTimeout(()=>{},1000)', str(runner), str(directory)],
                                cwd=backend, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    def test_resource_stop_does_not_restart_inference_or_run_reports(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            owner = self.owner(directory)
            try:
                (directory / 'trial-pipeline.json').write_text(json.dumps({'pid': owner.pid, 'stage': 'stopped_resource_limit'}))
                (directory / 'resource-stop.json').write_text('{"ram":91}')
                result = supervisor.finish(directory, owner.pid)
                self.assertEqual(result['stage'], 'stopped_resource_limit')
                self.assertFalse((directory / 'completion-postprocessing.log').exists())
            finally:
                if owner.poll() is None:
                    owner.terminate()
                owner.wait(timeout=5)

    def test_completed_native_pass_refreshes_and_builds_verified_report_offline(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            job = {'trialId': 'valid', 'source': 'fixture', 'title': 'Engineer',
                   'sourceDescription': 'Minimum 3 years of professional experience required.'}
            (directory / 'corpus.jsonl').write_text(json.dumps(job)+'\n')
            (directory / 'classifications').mkdir()
            (directory / 'review-source-packet.json').write_text(json.dumps({'method': 'Test fixture', 'jobs': [{'id': 'valid', 'trialId': 'valid', 'title': 'Engineer', 'source': 'fixture'}]}))
            (directory / 'manual-review.json').write_text(json.dumps({'labels': [{'id': 'valid', 'split': 'development', 'label': 'Full-time Experienced'}]}))
            prepare = """import {postScrapeInput} from './src/services/postScrapeClassification.js';
import {trialNativeInputHash} from './scripts/trialNativePredictionCache.js';
const job = JSON.parse(process.argv[1]); const input=postScrapeInput(job);
console.log(JSON.stringify({inputHash:'previous-policy',nativeInputHash:trialNativeInputHash(input),
prediction:{modelLabel:'Full-time Experienced',fullDescriptionCovered:true,windows:1,
scores:{'Full-time Experienced':.97,'Full-time Fresher':.01,Intern:.01,Contract:.01},seconds:1,cpuSeconds:.9,peakRssBytes:1024}}));"""
            saved = subprocess.run(['node', '--input-type=module', '-e', prepare, json.dumps(job)], cwd=backend,
                                   capture_output=True, text=True, check=True).stdout
            (directory / 'classifications/valid.json').write_text(saved)
            owner = self.owner(directory)
            try:
                (directory / 'trial-pipeline.json').write_text(json.dumps({'pid': owner.pid, 'stage': 'awaiting_manual_review'}))
                result = supervisor.finish(directory, owner.pid)
                self.assertEqual(result['stage'], 'report_complete')
                self.assertEqual(result['commandsCompleted'], 4)
                report = json.loads((directory / 'classification-final-analytics.json').read_text())
                self.assertTrue(report['coverageComplete'])
                self.assertEqual(report['completed'], 1)
                self.assertTrue((directory / 'FINAL-REPORT.md').exists())
            finally:
                if owner.poll() is None:
                    owner.terminate()
                owner.wait(timeout=5)

    def test_either_limit_stops_postprocessing_on_cpu_before_starting_a_command(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            owner = self.owner(directory)
            try:
                (directory / 'trial-pipeline.json').write_text(json.dumps({'pid': owner.pid, 'stage': 'awaiting_manual_review'}))
                (directory / 'resource-guard.json').write_text('{"metric":"either","limitPercent":90}')
                with patch.object(supervisor.psutil, 'cpu_percent', return_value=91) as cpu_sample:
                    result = supervisor.finish(directory, owner.pid)
                self.assertTrue(cpu_sample.call_args_list)
                for call in cpu_sample.call_args_list:
                    self.assertEqual(call.kwargs.get('interval'), 2,
                                     'Every postprocessing CPU sample needs a real two-second window')
                self.assertEqual(result['stage'], 'stopped_resource_limit')
                self.assertIn('cpu', result['exceeded'])
                self.assertEqual(result['commandsCompleted'], 0)
                self.assertFalse((directory / 'classification-final-analytics.json').exists())
            finally:
                if owner.poll() is None:
                    owner.terminate()
                owner.wait(timeout=5)


if __name__ == '__main__':
    unittest.main()
