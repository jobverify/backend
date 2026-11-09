"""Run local classification now, with resource monitoring and resumable retries."""
import argparse
import os
import shutil
import time
from pathlib import Path

import psutil
import watchLocalDryRun as guard


def run(directory, interval=2, cooldown_seconds=60, sample=None, command=None):
    directory = Path(directory).resolve()
    if not guard.complete_capture(guard.read_json(directory / 'run-state.json', {})):
        raise ValueError('Classification requires a complete local dry-run capture')
    logs = directory / 'classification-monitor'
    logs.mkdir(exist_ok=True)
    previous = guard.read_json(logs / 'watchdog-status.json', {})
    if previous.get('pid') and previous['pid'] != os.getpid():
        try:
            if guard.same_process(psutil.Process(previous['pid']), previous.get('created')):
                raise ValueError('A classification monitor already owns this run')
        except psutil.NoSuchProcess:
            pass
    status = {'pid': os.getpid(), 'created': psutil.Process().create_time(),
              'status': 'starting', 'stage': 'classification', 'parentRunDirectory': str(directory),
              'startedAt': guard.timestamp(), 'mongoWrites': 0}
    guard.publish(logs, status)
    guard.log(directory, 'classification_monitor_started', pid=os.getpid(),
              parallelTo='descriptions', monitorDirectory=str(logs))
    env = guard.child_environment(directory, guard.read_json(directory / 'run-metadata.json', {}))
    command = command or [shutil.which('node') or 'node', '--use-system-ca',
                          str(guard.BACKEND / 'scripts/classifyTrialSnapshots.js'), str(directory)]
    psutil.cpu_percent(interval=None)
    def reading():
        if (directory / 'watchdog-stop.json').exists():
            raise InterruptedError('User requested this pipeline to stop')
        return sample() if sample else {'cpu': psutil.cpu_percent(interval=None),
                                       'ram': psutil.virtual_memory().percent}
    failures = 0
    try:
        while True:
            if guard.stage_artifact_complete(directory, 'classification'):
                status.update(status='complete', activeProcess=None, finishedAt=guard.timestamp())
                break
            existing = guard.running_followups(directory, 'classification')
            if existing:
                owner = existing[0][1]
                guard.log(logs, 'existing_stage_adopted', stage='classification', pid=owner.pid)
                outcome = guard.monitor_process(owner, logs, 'classification', status, reading, interval)
                code = owner.wait(timeout=10)
                outcome['exitCode'] = code if code is not None else 1
            else:
                outcome = guard.launch_monitored(command, logs, 'classification', status, env, reading, interval)
            if guard.stage_artifact_complete(directory, 'classification'):
                status.update(status='complete', activeProcess=None, finishedAt=guard.timestamp())
                break
            stopped = guard.read_json(directory / 'watchdog-status.json', {}, optional=True).get('lastResourceStop', {})
            stop_time = stopped.get('at', '')
            from datetime import datetime
            parent_stopped = (outcome.get('ownerPid') in stopped.get('stoppedPids', [])
                              and stop_time and datetime.fromisoformat(stop_time).timestamp()
                              >= status.get('activeProcess', {}).get('created', time.time()))
            if outcome['status'] != 'resource_stopped' and not parent_stopped:
                failures += 1
                guard.log(logs, 'classification_retry', exitCode=outcome.get('exitCode'), attempt=failures)
                if failures >= 3:
                    raise RuntimeError('Classification failed after three supervised attempts; see classification.stderr.log')
            guard.wait_for_cooling(logs, status, reading, interval, cooldown_seconds)
    except InterruptedError as error:
        status.update(status='stopped_by_user', error=str(error), activeProcess=None)
    except BaseException as error:
        status.update(status='failed', error=str(error))
        raise
    finally:
        guard.publish(logs, status)
    return status


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir', required=True, type=Path)
    args = parser.parse_args()
    result = run(args.run_dir)
    raise SystemExit(0 if result['status'] == 'complete' else 1)
