import importlib.util
import json
import subprocess
import tempfile
import unittest
import errno
import time
from unittest.mock import patch
from pathlib import Path

import psutil

spec = importlib.util.spec_from_file_location('guard', Path(__file__).resolve().parents[1] / 'scripts/localTrialResourceGuard.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class ResourceGuardTest(unittest.TestCase):
    def test_default_cpu_sampler_uses_a_real_interval_from_its_first_reading(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary).resolve()
            runner = Path(guard.__file__).resolve().with_name('runPostScrapeTrial.js')
            owner = subprocess.Popen(['node', '-e', 'setTimeout(()=>{},150)', str(runner), str(directory)])
            (directory / 'trial-pipeline.json').write_text(json.dumps({'pid': owner.pid, 'stage': 'classification'}))
            intervals = []
            def cpu_percent(interval=None):
                intervals.append(interval)
                if interval is None: return 100.0
                time.sleep(.02)
                return 20.0
            try:
                with patch.object(guard.psutil, 'cpu_percent', side_effect=cpu_percent):
                    result = guard.run_guard(directory, owner.pid, metric='either', interval=.2)
                self.assertEqual(result['status'], 'owner_exited')
                self.assertTrue(intervals)
                self.assertTrue(all(interval == .2 for interval in intervals))
                self.assertFalse((directory / 'resource-stop.json').exists())
                owner.wait(timeout=5)
            finally:
                if owner.poll() is None: owner.terminate()
                owner.wait(timeout=5)

    def test_disk_full_watchdog_failure_kills_owner_even_if_no_stop_journal_can_be_written(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary).resolve()
            runner = Path(guard.__file__).resolve().with_name('runPostScrapeTrial.js')
            owner = subprocess.Popen(['node', '-e', 'setInterval(()=>{},1000)', str(runner), str(directory)])
            saved = directory / 'saved-prediction.json'
            saved.write_text('{"alreadySaved":true}')
            try:
                failure = OSError(errno.ENOSPC, 'Simulated full volume')
                with patch.object(guard, 'atomic_json', side_effect=failure), patch.object(Path, 'write_text', side_effect=failure):
                    result = guard.run_guard(directory, owner.pid, metric='either', sample=lambda: {'ram': 50, 'cpu': 20})
                self.assertEqual(result['status'], 'stopped_watchdog_failure')
                self.assertIn(owner.pid, result['stoppedPids'])
                owner.wait(timeout=5)
                self.assertEqual(saved.read_text(), '{"alreadySaved":true}')
                self.assertFalse((directory / 'resource-stop.json').exists())
            finally:
                if owner.poll() is None: owner.terminate()
                owner.wait(timeout=5)

    def test_atomic_status_write_retries_transient_windows_denial(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / 'status.json'
            target.write_text('{"previous":true}')
            real_replace = guard.os.replace
            calls = []
            def replace(source, destination):
                calls.append(1)
                if len(calls) < 3:
                    self.assertEqual(json.loads(target.read_text()), {'previous': True})
                    raise PermissionError('Temporary Windows replacement denial')
                return real_replace(source, destination)
            with patch.object(guard.os, 'replace', side_effect=replace), patch.object(guard.time, 'sleep'):
                guard.atomic_json(target, {'current': True})
            self.assertEqual(len(calls), 3)
            self.assertEqual(json.loads(target.read_text()), {'current': True})

    def test_persistent_status_write_failure_stops_owned_launcher(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary).resolve()
            runner = Path(guard.__file__).resolve().with_name('runPostScrapeTrial.js')
            owner = subprocess.Popen(['node', '-e', 'setInterval(()=>{},1000)', str(runner), str(directory)])
            try:
                (directory / 'trial-pipeline.json').write_text(json.dumps({'pid': owner.pid, 'stage': 'classification'}))
                with patch.object(guard, 'atomic_json', side_effect=PermissionError('Persistent replacement denial')):
                    result = guard.run_guard(directory, owner.pid, metric='either', sample=lambda: {'ram': 50, 'cpu': 20})
                self.assertEqual(result['status'], 'stopped_watchdog_failure')
                self.assertIn(owner.pid, result['stoppedPids'])
                self.assertTrue((directory / 'resource-stop.json').exists())
                self.assertEqual(json.loads((directory / 'resource-stop.json').read_text())['status'], 'stopped_watchdog_failure')
                owner.wait(timeout=5)
            finally:
                if owner.poll() is None:
                    owner.terminate()
                owner.wait(timeout=5)

    def test_suspend_denial_still_kills_owner_before_children(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary).resolve()
            runner = Path(guard.__file__).resolve().with_name('runPostScrapeTrial.js')
            script = "const {spawn}=require('node:child_process'); spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});setInterval(()=>{},1000);"
            owner = subprocess.Popen(['node','-e',script,str(runner),str(directory)])
            process = psutil.Process(owner.pid)
            try:
                import time
                for _ in range(100):
                    children = process.children()
                    if children:
                        break
                    time.sleep(.02)
                self.assertTrue(children)
                identities = [(child,child.create_time()) for child in children]
                killed = []
                original_kill = psutil.Process.kill
                def record_kill(target):
                    killed.append(target.pid)
                    return original_kill(target)
                with patch.object(psutil.Process,'suspend',side_effect=psutil.AccessDenied(owner.pid)), patch.object(psutil.Process,'kill',new=record_kill):
                    stopped = guard.stop_owned_tree(process,process.create_time())
                self.assertEqual(killed[0],owner.pid)
                self.assertIn(owner.pid,stopped)
                self.assertTrue(all(not guard.same_process(child,created) for child,created in identities))
                owner.wait(timeout=5)
            finally:
                if owner.poll() is None:
                    owner.terminate()
                owner.wait(timeout=5)

    def test_limit_is_strict_and_cpu_is_normalized_host_usage(self):
        self.assertEqual(guard.exceeded({'ram': 90, 'cpu': 99}, 'ram', 90), [])
        self.assertEqual(guard.exceeded({'ram': 90.1, 'cpu': 1}, 'ram', 90), ['ram'])
        self.assertEqual(guard.exceeded({'ram': 99, 'cpu': 90}, 'cpu', 90), [])
        self.assertEqual(guard.exceeded({'ram': 91, 'cpu': 95}, 'either', 90), ['ram', 'cpu'])

    def test_rejects_unrelated_process(self):
        with self.assertRaisesRegex(ValueError, 'Owner must'):
            guard.validate_owner(psutil.Process(), Path(tempfile.gettempdir()).resolve())

    def test_stops_owned_tree_and_retains_saved_predictions(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary).resolve()
            runner = Path(guard.__file__).resolve().with_name('runPostScrapeTrial.js')
            script = "const {spawn}=require('node:child_process'); spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); setInterval(()=>{},1000);"
            owner = subprocess.Popen(['node', '-e', script, str(runner), str(directory)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            unrelated = subprocess.Popen(['node', '-e', 'setInterval(()=>{},1000)'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            process = psutil.Process(owner.pid)
            try:
                (directory / 'trial-pipeline.json').write_text(json.dumps({'pid': owner.pid, 'stage': 'classification'}))
                saved = directory / 'saved-prediction.json'
                saved.write_text('{"alreadySaved":true}')
                import time
                for _ in range(100):
                    children = process.children()
                    if children:
                        break
                    time.sleep(.02)
                self.assertTrue(children)
                identities = [(child, child.create_time()) for child in children]
                status = guard.run_guard(directory, owner.pid, sample=lambda: {'ram': 91, 'cpu': 1})
                self.assertEqual(status['status'], 'stopped_resource_limit')
                self.assertEqual(status['exceeded'], ['ram'])
                self.assertEqual(saved.read_text(), '{"alreadySaved":true}')
                self.assertEqual(json.loads((directory / 'trial-pipeline.json').read_text())['stage'], 'stopped_resource_limit')
                self.assertTrue(all(not guard.same_process(child, created) for child, created in identities))
                owner.wait(timeout=5)
                self.assertIsNone(unrelated.poll())
            finally:
                if owner.poll() is None:
                    process.kill()
                    owner.wait(timeout=5)
                unrelated.terminate()
                unrelated.wait(timeout=5)


if __name__ == '__main__':
    unittest.main()
