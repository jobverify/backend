"""Finish local reports after an owned native trial exits; never restart inference."""
import argparse
import json
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import psutil
from localTrialResourceGuard import atomic_json, exceeded, same_process, stop_owned_tree, validate_owner


def finish(directory, owner_pid):
    directory = Path(directory).resolve()
    backend = Path(__file__).resolve().parents[1]
    owner = psutil.Process(owner_pid)
    validate_owner(owner, directory)
    born = owner.create_time()
    status = {'ownerPid': owner_pid, 'ownerCreated': born, 'supervisorPid': os.getpid(),
              'startedAt': datetime.now(timezone.utc).isoformat(), 'stage': 'waiting_for_native_pass'}
    target = directory / 'completion-supervisor.json'
    atomic_json(target, status)
    while same_process(owner, born):
        time.sleep(5)
    pipeline_file = directory / 'trial-pipeline.json'
    pipeline = json.loads(pipeline_file.read_text(encoding='utf-8'))
    if (directory / 'resource-stop.json').exists() or pipeline.get('stage') == 'stopped_resource_limit':
        status.update(stage='stopped_resource_limit', finishedAt=datetime.now(timezone.utc).isoformat())
        atomic_json(target, status)
        return status
    if pipeline.get('pid') != owner_pid or pipeline.get('stage') != 'awaiting_manual_review':
        status.update(stage='native_pass_incomplete', pipelineStage=pipeline.get('stage'))
        atomic_json(target, status)
        return status
    commands = [
        ['node', 'scripts/refreshTrialClassificationPolicy.js', str(directory)],
        ['node', 'scripts/evaluatePostScrapeClassification.js', str(directory), 'development'],
        ['node', 'scripts/evaluatePostScrapeClassification.js', str(directory), 'holdout'],
    ]
    for prefix in ('fresher-audit', 'fresher-confirmation'):
        if (directory / f'{prefix}-manual-review.json').exists():
            commands.append(['node', str(directory / 'evaluate-fresher-packet.mjs'), prefix])
    commands.append(['node', 'scripts/reportLocalClassificationTrial.js', str(directory)])
    guard_file = directory / 'resource-guard.json'
    limits = json.loads(guard_file.read_text(encoding='utf-8')) if guard_file.exists() else {}
    metric, limit = limits.get('metric', 'ram'), limits.get('limitPercent', 90)
    if metric not in ('ram', 'cpu', 'either') or not 0 < limit <= 100:
        raise ValueError('Invalid persisted resource limits')
    status.update(stage='postprocessing', commandsCompleted=0, peakRamPercent=0, peakCpuPercent=0,
                  resourceMetric=metric, limitPercent=limit)
    atomic_json(target, status)
    def sample_resources():
        cpu = psutil.cpu_percent(interval=2)
        usage = {'ram': psutil.virtual_memory().percent, 'cpu': cpu}
        status['peakRamPercent'] = max(status['peakRamPercent'], usage['ram'])
        status['peakCpuPercent'] = max(status['peakCpuPercent'], usage['cpu'])
        return usage, exceeded(usage, metric, limit)

    with (directory / 'completion-postprocessing.log').open('a', encoding='utf-8') as output:
        for command in commands:
            usage, trigger = sample_resources()
            if trigger:
                status.update(stage='stopped_resource_limit', last=usage, exceeded=trigger,
                              finishedAt=datetime.now(timezone.utc).isoformat())
                atomic_json(directory / 'postprocessing-resource-stop.json', status)
                atomic_json(target, status)
                return status
            child = subprocess.Popen(command, cwd=backend, stdout=output, stderr=subprocess.STDOUT)
            process = psutil.Process(child.pid)
            created = process.create_time()
            if os.name == 'nt':
                process.nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
            while child.poll() is None:
                usage, trigger = sample_resources()
                if trigger:
                    status.update(stage='stopped_resource_limit', last=usage, exceeded=trigger,
                                  stoppedPids=stop_owned_tree(process, created),
                                  finishedAt=datetime.now(timezone.utc).isoformat())
                    atomic_json(directory / 'postprocessing-resource-stop.json', status)
                    atomic_json(target, status)
                    return status
            if child.returncode:
                status.update(stage='postprocessing_failed', command=command, exitCode=child.returncode)
                atomic_json(target, status)
                return status
            status['commandsCompleted'] += 1
            atomic_json(target, status)
    status.update(stage='report_complete', finishedAt=datetime.now(timezone.utc).isoformat())
    atomic_json(target, status)
    return status


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('owner_pid', type=int)
    args = parser.parse_args()
    print(json.dumps(finish(args.directory, args.owner_pid)), flush=True)
