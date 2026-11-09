"""Exercise the local watchdog with real, isolated child processes."""
import importlib.util
import json
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch
from pathlib import Path

import psutil

ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / 'scripts/watchLocalDryRun.py'


class WatchLocalDryRunTest(unittest.TestCase):
    def load_watchdog(self):
        if not MODULE.exists():
            self.fail('The dry-run watchdog has not been implemented')
        spec = importlib.util.spec_from_file_location('watch_local_dry_run', MODULE)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def state(self, complete=True):
        return {'mode': 'dry-run', 'status': 'complete' if complete else 'running',
                'completedCount': 1 if complete else 0, 'totalSources': 1,
                'catalogSources': ['fixture'], 'completed': {
                    'fixture': {'result': {'success': True, 'jobs': 1}}
                } if complete else {}}

    def test_shared_status_read_retries_a_transient_windows_lock(self):
        watch = self.load_watchdog()
        with patch.object(Path, 'read_text', side_effect=[PermissionError('sharing violation'), '{"status":"monitoring"}']), \
                patch.object(watch.time, 'sleep'):
            self.assertEqual(watch.read_json(Path('status.json')), {'status': 'monitoring'})

    def test_unreadable_parallel_status_does_not_stop_a_healthy_workload(self):
        watch = self.load_watchdog()
        original_read = Path.read_text
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            blocked = directory / 'classification-monitor/watchdog-status.json'
            def read(path, *args, **kwargs):
                if path == blocked:
                    raise PermissionError('sharing violation')
                return original_read(path, *args, **kwargs)
            owner = subprocess.Popen(['node', '-e', 'setTimeout(()=>{},300)'], cwd=ROOT)
            try:
                with patch.object(Path, 'read_text', read):
                    outcome = watch.monitor_process(psutil.Process(owner.pid), directory, 'descriptions', {},
                        sample=lambda: {'cpu': 20, 'ram': 45}, interval=.01)
                self.assertEqual(outcome['status'], 'exited')
                self.assertEqual(owner.wait(timeout=5), 0)
                self.assertTrue((directory / 'watchdog-resources.ndjson').exists())
            finally:
                if owner.poll() is None:
                    owner.kill()
                owner.wait(timeout=5)

    def test_followups_require_the_whole_selected_dry_run(self):
        watch = self.load_watchdog()
        self.assertFalse(watch.complete_capture(self.state(False)))
        self.assertTrue(watch.complete_capture(self.state()))
        for changed in ({'mode': 'live'}, {'completedCount': 0},
                        {'totalSources': 2}, {'catalogSources': ['../escape']}):
            self.assertFalse(watch.complete_capture({**self.state(), **changed}))

    def test_cooling_requires_a_delay_and_consecutive_healthy_samples(self):
        watch = self.load_watchdog()
        cooling = watch.Cooldown(stopped_at=100, delay_seconds=60,
                                 healthy_samples=3, resume_below=80)
        self.assertFalse(cooling.ready({'cpu': 20, 'ram': 50}, 159))
        self.assertFalse(cooling.ready({'cpu': 20, 'ram': 50}, 160))
        self.assertFalse(cooling.ready({'cpu': 81, 'ram': 50}, 162))
        self.assertFalse(cooling.ready({'cpu': 20, 'ram': 50}, 164))
        self.assertFalse(cooling.ready({'cpu': 20, 'ram': 50}, 166))
        self.assertTrue(cooling.ready({'cpu': 20, 'ram': 50}, 168))

    def test_stopping_cpu_pressure_kills_only_the_owned_tree(self):
        watch = self.load_watchdog()
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            saved = directory / 'saved-snapshot.json'
            saved.write_text('{"preserved":true}')
            script = "const {spawn}=require('node:child_process');spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});setInterval(()=>{},1000);"
            owner = subprocess.Popen(['node', '-e', script,
                                      str(watch.SCRAPER_SCRIPT), '--run-dir', str(directory)],
                                     cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            unrelated = subprocess.Popen(['node', '-e', 'setInterval(()=>{},1000)'],
                                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            try:
                process = psutil.Process(owner.pid)
                watch.validate_scrape_owner(process, directory)
                for _ in range(100):
                    children = process.children()
                    if children:
                        break
                    time.sleep(.02)
                self.assertTrue(children)
                identities = [(child, child.create_time()) for child in children]
                outcome = watch.monitor_process(process, directory, 'scraping', {},
                                                sample=lambda: {'cpu': 90.1, 'ram': 45},
                                                interval=.01)
                self.assertEqual(outcome['status'], 'resource_stopped')
                owner.wait(timeout=5)
                self.assertIn(owner.pid, outcome['stoppedPids'])
                self.assertTrue(all(not watch.same_process(child, created)
                                    for child, created in identities))
                self.assertEqual(saved.read_text(), '{"preserved":true}')
                self.assertIsNone(unrelated.poll())
                journal = json.loads((directory / 'watchdog-resource-stop.json').read_text())
                self.assertEqual(journal['exceeded'], ['cpu'])
            finally:
                for child in (owner, unrelated):
                    if child.poll() is None:
                        child.terminate()
                    child.wait(timeout=5)

    def test_rejects_unrelated_processes_before_attaching(self):
        watch = self.load_watchdog()
        with self.assertRaises(ValueError):
            watch.validate_scrape_owner(psutil.Process(), ROOT)

    def test_failed_source_recovery_preserves_original_capture_and_other_results(self):
        watch = self.load_watchdog()
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            state = self.state()
            state.update(totalSources=2, completedCount=2,
                         catalogSources=['fixture', 'broken'])
            state['completed']['broken'] = {'result': {'success': False, 'error': 'timeout'}}
            (directory / 'run-state.json').write_text(json.dumps(state))
            retry = {'completed': {'broken': {'result': {'success': True, 'jobs': 2}}}}
            watch.merge_recovery(directory, retry)
            current = json.loads((directory / 'run-state.json').read_text())
            self.assertEqual(current['completed']['fixture'], state['completed']['fixture'])
            self.assertTrue(current['completed']['broken']['result']['success'])
            original = json.loads((directory / 'run-state-before-recovery.json').read_text())
            self.assertFalse(original['completed']['broken']['result']['success'])
            failures = json.loads((directory / 'watchdog-source-failures.json').read_text())
            self.assertEqual(failures['failures'], [])

    def test_followups_run_in_order_only_after_the_attached_scraper_finishes(self):
        watch = self.load_watchdog()
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / 'run-state.json').write_text(json.dumps(self.state(False)))
            (directory / 'run-metadata.json').write_text(json.dumps({'mode': 'dry-run'}))
            complete = json.dumps(self.state())
            script = "const fs=require('node:fs');setTimeout(()=>{fs.writeFileSync(process.argv[1],process.argv[2]);},150);"
            owner = subprocess.Popen(['node', '-e', script, str(directory / 'run-state.json'),
                                      complete, str(watch.SCRAPER_SCRIPT), '--run-dir', str(directory)],
                                     cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            (directory / 'supervisor.pid').write_text(str(owner.pid))
            events = directory / 'events.txt'
            def command(stage):
                return [sys.executable, '-c',
                        "import json;from pathlib import Path;d=Path(" + repr(str(directory)) +
                        ");assert json.loads((d/'run-state.json').read_text())['status']=='complete';"
                        "p=d/'events.txt';p.open('a').write(" + repr(stage + '\n') + ");"]
            try:
                result = watch.run_watchdog(directory, interval=.01,
                    sample=lambda: {'cpu': 20, 'ram': 45}, recovery=False,
                    followups=[('descriptions', command('descriptions')),
                               ('classification', command('classification'))])
                owner.wait(timeout=5)
                self.assertEqual(result['status'], 'complete')
                self.assertEqual(events.read_text().splitlines(), ['descriptions', 'classification'])
                self.assertEqual(result['stages']['descriptions']['status'], 'complete')
                self.assertEqual(result['stages']['classification']['status'], 'complete')
            finally:
                if owner.poll() is None:
                    owner.terminate()
                owner.wait(timeout=5)

    def test_existing_description_process_is_monitored_instead_of_duplicated(self):
        watch = self.load_watchdog()
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / 'run-state.json').write_text(json.dumps(self.state()))
            output = directory / 'descriptions'
            output.mkdir()
            summary = json.dumps({'status': 'complete', 'companies': {
                'fixture': {'finished': True}}})
            script = (
                "const fs=require('node:fs');"
                "const deadline=setTimeout(()=>process.exit(1),30000);"
                "const timer=setInterval(()=>{if(fs.existsSync(process.argv[3])){"
                "fs.writeFileSync(process.argv[1],process.argv[2]);"
                "clearInterval(timer);clearTimeout(deadline)}},10);"
            )
            owner = subprocess.Popen(['node', '-e', script, str(output / 'summary.json'), summary,
                str(directory / 'description-may-finish'),
                str(ROOT / 'scripts/evaluateDryRunDescriptions.js'), '--run-dir', str(directory),
                '--output', str(output)], cwd=ROOT)
            samples = 0
            def sample():
                nonlocal samples
                samples += 1
                if samples > 1:
                    # Discovery has adopted the owner and its monitor is sampling.
                    (directory / 'description-may-finish').touch()
                return {'cpu': 20, 'ram': 45}
            try:
                outcome = watch.launch_monitored([sys.executable, '-c', "raise RuntimeError('duplicate')"],
                    directory, 'descriptions', {'stages': {}}, {}, sample, .01)
                self.assertEqual(outcome['ownerPid'], owner.pid)
                self.assertEqual(outcome['exitCode'], 0)
                self.assertIn('existing_stage_adopted', (directory / 'watchdog-events.ndjson').read_text())
            finally:
                if owner.poll() is None:
                    owner.terminate()
                owner.wait(timeout=5)

    def test_resource_stop_also_stops_a_parallel_classifier_for_the_same_run(self):
        watch = self.load_watchdog()
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            hold = 'setInterval(()=>{},1000)'
            owner = subprocess.Popen(['node', '-e', hold], cwd=ROOT)
            parallel = subprocess.Popen(['node', '-e', hold,
                str(ROOT / 'scripts/classifyTrialSnapshots.js'), str(directory)], cwd=ROOT)
            unrelated = subprocess.Popen(['node', '-e', hold,
                str(ROOT / 'scripts/classifyTrialSnapshots.js'), str(directory / 'other')], cwd=ROOT)
            try:
                outcome = watch.monitor_process(psutil.Process(owner.pid), directory, 'descriptions',
                    {}, sample=lambda: {'cpu': 95, 'ram': 45}, interval=.01)
                self.assertIn(owner.pid, outcome['stoppedPids'])
                self.assertIn(parallel.pid, outcome['stoppedPids'])
                self.assertIsNone(unrelated.poll())
            finally:
                for process in (owner, parallel, unrelated):
                    if process.poll() is None:
                        process.kill()
                    process.wait(timeout=5)

    def test_adopted_description_budget_exit_remains_resumable(self):
        watch = self.load_watchdog()
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / 'descriptions').mkdir()
            (directory / 'descriptions/summary.json').write_text(json.dumps({'status': 'budget_exhausted'}))
            from types import SimpleNamespace
            owner = SimpleNamespace(pid=123, wait=lambda timeout: None)
            with patch.object(watch, 'running_followups', return_value=[('descriptions', owner)]), \
                    patch.object(watch, 'monitor_process', return_value={'status': 'exited', 'ownerPid': 123}):
                result = watch.launch_monitored([], directory, 'descriptions', {}, {},
                    lambda: {'cpu': 20, 'ram': 45}, .01)
            self.assertEqual(result['exitCode'], 75)

    def test_completed_classification_includes_explicitly_skipped_incomplete_inputs(self):
        watch = self.load_watchdog()
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / 'classification-summary.json').write_text(json.dumps({
                'total': 2, 'completed': 1, 'skipped': 1, 'failed': 0, 'completedAt': '2026-10-11T18:00:00Z'}))
            (directory / 'corpus-manifest.json').write_text(json.dumps({'jobCount': 2}))
            self.assertTrue(watch.stage_artifact_complete(directory, 'classification'))

    def test_watchdog_restart_does_not_repeat_a_completed_failure_recovery(self):
        watch = self.load_watchdog()
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            state = self.state()
            state['completed']['fixture']['result'] = {'success': False, 'error': 'unavailable'}
            (directory / 'run-state.json').write_text(json.dumps(state))
            (directory / 'run-metadata.json').write_text(json.dumps({'mode': 'dry-run'}))
            (directory / 'failure-retry').mkdir()
            (directory / 'failure-retry/run-state.json').write_text(json.dumps(state))
            (directory / 'failure-recovery.json').write_text('{}')
            with patch.object(watch, 'launch_monitored', side_effect=AssertionError('Recovery ran twice')):
                result = watch.run_watchdog(directory, interval=.01, followups=[])
            self.assertEqual(result['status'], 'completed_with_failures')

    def test_description_failure_does_not_prevent_classification(self):
        watch = self.load_watchdog()
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / 'run-state.json').write_text(json.dumps(self.state()))
            (directory / 'run-metadata.json').write_text(json.dumps({'mode': 'dry-run'}))
            marker = directory / 'classified'
            followups = [('descriptions', [sys.executable, '-c', 'raise SystemExit(1)']),
                         ('classification', [sys.executable, '-c',
                          'from pathlib import Path;Path(' + repr(str(marker)) + ').write_text("done")'])]
            result = watch.run_watchdog(directory, interval=.01,
                sample=lambda: {'cpu': 20, 'ram': 45}, recovery=False,
                followups=followups, max_failures=1)
            self.assertTrue(marker.exists())
            self.assertEqual(result['status'], 'completed_with_failures')
            self.assertEqual(result['stages']['descriptions']['status'], 'failed')
            self.assertEqual(result['stages']['classification']['status'], 'complete')

    def test_cpu_stop_is_followed_by_cooling_and_checkpoint_resume(self):
        watch = self.load_watchdog()
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / 'run-state.json').write_text(json.dumps(self.state(False)))
            (directory / 'run-metadata.json').write_text(json.dumps({'mode': 'dry-run'}))
            saved = directory / 'already-scraped.json'
            saved.write_text('{"keep":true}')
            owner = subprocess.Popen(['node', '-e', 'setInterval(()=>{},1000)',
                                      str(watch.SCRAPER_SCRIPT), '--run-dir', str(directory)],
                                     cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            (directory / 'supervisor.pid').write_text(str(owner.pid))
            readings = iter([{'cpu': 95, 'ram': 45}])
            sample = lambda: next(readings, {'cpu': 20, 'ram': 45})
            script = "const fs=require('node:fs');fs.writeFileSync(process.argv[1],process.argv[2]);"
            resume = ['node', '-e', script, str(directory / 'run-state.json'), json.dumps(self.state())]
            try:
                with patch.object(watch, 'scrape_command', return_value=resume):
                    result = watch.run_watchdog(directory, interval=.01, sample=sample,
                        recovery=False, followups=[], cooldown_seconds=.01)
                owner.wait(timeout=5)
                self.assertEqual(result['status'], 'complete')
                self.assertEqual(result['resourceStops'], 1)
                self.assertTrue(watch.complete_capture(json.loads((directory / 'run-state.json').read_text())))
                self.assertEqual(saved.read_text(), '{"keep":true}')
                events = [json.loads(line)['event'] for line in
                          (directory / 'watchdog-events.ndjson').read_text().splitlines()]
                self.assertLess(events.index('resource_limit_stop'), events.index('resources_recovered'))
                self.assertLess(events.index('resources_recovered'), events.index('stage_process_started'))
            finally:
                if owner.poll() is None:
                    owner.terminate()
                owner.wait(timeout=5)

    def test_unrecovered_source_failures_are_reported_after_both_followups(self):
        watch = self.load_watchdog()
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            state = self.state()
            state['completed']['fixture'] = {'result': {'success': False, 'error': 'HTTP 503'}}
            (directory / 'run-state.json').write_text(json.dumps(state))
            (directory / 'run-metadata.json').write_text(json.dumps({'mode': 'dry-run'}))
            result = watch.run_watchdog(directory, interval=.01,
                sample=lambda: {'cpu': 20, 'ram': 45}, recovery=False, followups=[])
            self.assertEqual(result['status'], 'completed_with_failures')
            self.assertEqual(result['scrape']['failedSources'], ['fixture'])


if __name__ == '__main__':
    unittest.main()
