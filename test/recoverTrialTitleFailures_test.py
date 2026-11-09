import json
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace
from datetime import datetime, timezone
from pathlib import Path

import psutil
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from recoverTrialTitleFailures import recover


class TitleRecoverySupervisorTest(unittest.TestCase):
    def fixture(self, directory):
        runner = Path(__file__).resolve().parents[1] / 'scripts/runPostScrapeTrial.js'
        owner = subprocess.Popen(['node', '-e', 'setTimeout(()=>{},300)', str(runner), str(directory)])
        started = datetime.now(timezone.utc).isoformat()
        meta = {'ownerPid': owner.pid, 'ownerCreated': psutil.Process(owner.pid).create_time(),
                'cpuThreads': 1, 'approvedAnswer': 'Resume on one CPU thread', 'startedAt': started}
        (directory / 'trial-pipeline.json').write_text(json.dumps({'pid': owner.pid, 'stage': 'classification_failed'}))
        (directory / 'classification-summary.json').write_text(json.dumps({'total': 1, 'completed': 0, 'skipped': 0, 'failed': 1}))
        (directory / 'title-recovery-source-audit.json').write_text(json.dumps({'jobs': [{'id': 'known'}]}))
        (directory / 'classification-failures.jsonl').write_text(json.dumps({'trialId': 'known', 'error': 'Title or metadata too long', 'attemptedAt': started})+'\n')
        return owner, meta

    def test_only_proven_title_failure_can_start_the_one_thread_retry(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary); owner, meta = self.fixture(directory); calls = []
            try:
                result = recover(directory, meta, launch=lambda: calls.append('started') or 0)
                self.assertEqual(result['stage'], 'retry_started')
                self.assertEqual(calls, ['started'])
            finally:
                if owner.poll() is None: owner.terminate()
                owner.wait(timeout=5)

    def test_resource_stop_never_restarts_inference(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary); owner, meta = self.fixture(directory); calls = []
            (directory / 'resource-stop.json').write_text('{"cpu":91}')
            try:
                result = recover(directory, meta, launch=lambda: calls.append('started') or 0)
                self.assertEqual(result['stage'], 'stopped_resource_limit')
                self.assertEqual(calls, [])
            finally:
                if owner.poll() is None: owner.terminate()
                owner.wait(timeout=5)

    def test_unrelated_failure_is_left_for_investigation(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary); owner, meta = self.fixture(directory); calls = []
            (directory / 'classification-failures.jsonl').write_text(json.dumps({'trialId': 'known', 'error': 'Unexpected model failure', 'attemptedAt': meta['startedAt']})+'\n')
            try:
                result = recover(directory, meta, launch=lambda: calls.append('started') or 0)
                self.assertEqual(result['stage'], 'needs_manual_investigation')
                self.assertEqual(calls, [])
            finally:
                if owner.poll() is None: owner.terminate()
                owner.wait(timeout=5)

    def test_extended_audit_permits_only_its_proven_metadata_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary); owner, meta = self.fixture(directory); calls = []
            (directory / 'extended-title-recovery-source-audit.json').write_text(json.dumps({'jobs': [{'id': 'icims'}]}))
            (directory / 'classification-failures.jsonl').write_text(json.dumps({'trialId': 'icims', 'error': 'Title or metadata too long', 'attemptedAt': meta['startedAt']})+'\n')
            try:
                result = recover(directory, meta, launch=lambda: calls.append('started') or 0,
                                 source_audit='extended-title-recovery-source-audit.json')
                self.assertEqual(result['stage'], 'retry_started')
                self.assertEqual(calls, ['started'])
            finally:
                if owner.poll() is None: owner.terminate()
                owner.wait(timeout=5)

    def test_arbitrary_recovery_manifests_are_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaises(ValueError):
                recover(Path(temporary), source_audit='../other.json')

    def test_disk_full_never_launches_a_retry(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary); owner, meta = self.fixture(directory); calls = []
            try:
                with patch('recoverTrialTitleFailures.psutil.disk_usage', return_value=SimpleNamespace(free=0)):
                    result = recover(directory, meta, launch=lambda: calls.append('started') or 0)
                self.assertEqual(result['stage'], 'needs_manual_investigation')
                self.assertEqual(calls, [])
            finally:
                if owner.poll() is None: owner.terminate()
                owner.wait(timeout=5)


if __name__ == '__main__': unittest.main()
