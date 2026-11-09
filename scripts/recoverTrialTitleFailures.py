"""Retry only the known malformed-title failures after the owned pass ends."""
import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import psutil
from localTrialResourceGuard import atomic_json, same_process, validate_owner


def recover(directory, meta=None, launch=None, source_audit='title-recovery-source-audit.json'):
    directory = Path(directory).resolve()
    if source_audit not in ('title-recovery-source-audit.json', 'extended-title-recovery-source-audit.json'):
        raise ValueError('Only an audited title recovery manifest is allowed')
    meta = meta or json.loads((directory / 'approved-resume.json').read_text(encoding='utf-8'))
    if meta.get('approvedAnswer') != 'Resume on one CPU thread' or meta.get('cpuThreads') != 1:
        raise ValueError('The recorded one-thread resume approval is required')
    owner = psutil.Process(meta['ownerPid'])
    validate_owner(owner, directory)
    if owner.create_time() != meta['ownerCreated']:
        raise ValueError('Owner identity changed')
    status = {'ownerPid': owner.pid, 'ownerCreated': meta['ownerCreated'],
              'watcherPid': psutil.Process().pid, 'stage': 'waiting_for_current_pass',
              'startedAt': datetime.now(timezone.utc).isoformat()}
    target = directory / 'title-recovery-supervisor.json'
    atomic_json(target, status)
    def finish(stage, **details):
        status.update(stage=stage, finishedAt=datetime.now(timezone.utc).isoformat(), **details)
        atomic_json(target, status)
        return status
    helpers = []
    for key in ('guardPid', 'supervisorPid', 'monitorPid', 'keepAwakePid'):
        try:
            process = psutil.Process(meta[key])
            helpers.append((process, process.create_time()))
        except (KeyError, psutil.NoSuchProcess):
            pass
    while same_process(owner, meta['ownerCreated']):
        if (directory / 'resource-stop.json').exists():
            return finish('stopped_resource_limit')
        time.sleep(1)
    if (directory / 'resource-stop.json').exists():
        return finish('stopped_resource_limit')
    pipeline = json.loads((directory / 'trial-pipeline.json').read_text(encoding='utf-8'))
    if pipeline.get('pid') != owner.pid or pipeline.get('stage') != 'classification_failed':
        return finish('no_retry', pipelineStage=pipeline.get('stage'))
    summary = json.loads((directory / 'classification-summary.json').read_text(encoding='utf-8'))
    if not summary.get('failed') or sum(summary.get(key, 0) for key in ('completed', 'skipped', 'failed')) != summary.get('total'):
        return finish('needs_manual_investigation', reason='Input accounting is incomplete')
    allowed = {row['id'] for row in json.loads((directory / source_audit).read_text(encoding='utf-8'))['jobs']}
    started = datetime.fromisoformat(meta['startedAt'].replace('Z', '+00:00'))
    failures = [json.loads(line) for line in (directory / 'classification-failures.jsonl').read_text(encoding='utf-8').splitlines() if line]
    failures = [row for row in failures if datetime.fromisoformat(row['attemptedAt'].replace('Z', '+00:00')) >= started]
    if len(failures) != summary['failed'] or any(row['error'] != 'Title or metadata too long' or row['trialId'] not in allowed for row in failures):
        return finish('needs_manual_investigation', reason='Failure is outside the proven title recovery')
    # Let the old bound helpers finish before replacing their status files.
    deadline = time.monotonic() + 15
    while any(same_process(process, created) for process, created in helpers):
        if time.monotonic() >= deadline:
            return finish('needs_manual_investigation', reason='Previous helpers have not exited')
        time.sleep(.2)
    if (directory / 'resource-stop.json').exists():
        return finish('stopped_resource_limit')
    if psutil.disk_usage(str(directory)).free < 64 * 1024 * 1024:
        return finish('needs_manual_investigation', reason='Insufficient free disk space for the retry')
    status.update(stage='starting_known_title_retry', failedIds=[row['trialId'] for row in failures])
    atomic_json(target, status)
    if launch is None:
        def launch():
            with (directory / 'title-retry-launch.log').open('w', encoding='utf-8') as output:
                return subprocess.run([sys.executable, str(directory / 'resume-approved-one-thread.py')],
                                      stdout=output, stderr=subprocess.STDOUT,
                                      creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0)).returncode
    code = launch()
    return finish('retry_started' if code == 0 else 'retry_startup_failed', exitCode=code)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('--source-audit', default='title-recovery-source-audit.json',
                        choices=('title-recovery-source-audit.json', 'extended-title-recovery-source-audit.json'))
    args = parser.parse_args()
    print(json.dumps(recover(args.directory, source_audit=args.source_audit)), flush=True)
