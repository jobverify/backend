"""Stop only an owned local trial when host resource usage exceeds its limit."""
import argparse
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import psutil


def exceeded(sample, metric, limit):
    names = ('ram', 'cpu') if metric == 'either' else (metric,)
    return [name for name in names if sample[name] > limit]


def atomic_json(target, value):
    temporary = target.with_name(target.name + f'.{os.getpid()}.guard.tmp')
    temporary.write_text(json.dumps(value, indent=2), encoding='utf-8')
    for attempt in range(8):
        try:
            os.replace(temporary, target)
            return
        except PermissionError:
            if attempt == 7:
                raise
            time.sleep(.025 * (attempt + 1))


def same_process(process, created):
    try:
        return process.is_running() and process.create_time() == created
    except psutil.NoSuchProcess:
        return False


def validate_owner(owner, directory):
    command = owner.cmdline()
    working = Path(owner.cwd())
    runner = Path(__file__).resolve().with_name('runPostScrapeTrial.js')
    for index, argument in enumerate(command[:-1]):
        if Path(argument).name != runner.name:
            continue
        if (working / argument).resolve() == runner and (working / command[index + 1]).resolve() == directory:
            return
    raise ValueError('Owner must be this repository\'s runPostScrapeTrial.js for this trial directory')


def stop_owned_tree(owner, created):
    # Suspend the launcher before collecting descendants so it cannot spawn a
    # replacement worker. Verify creation times again before every termination.
    if not same_process(owner, created):
        return []
    suspended = False
    try:
        owner.suspend()
        suspended = True
    except psutil.AccessDenied:
        # Windows can allow termination while denying suspension. Capture
        # descendants, then terminate the owner first to prevent replacements.
        pass
    except psutil.NoSuchProcess:
        return []
    owned = []
    stopped = []
    try:
        for child in owner.children(recursive=True):
            try:
                if child.pid != os.getpid() and child.is_running():
                    owned.append((child, child.create_time()))
            except psutil.NoSuchProcess:
                pass
        owned.append((owner, created))
        if same_process(owner, created):
            owner.kill()
            stopped.append(owner.pid)
        for process, born in reversed(owned[:-1]):
            try:
                if same_process(process, born):
                    process.kill()
                    stopped.append(process.pid)
            except psutil.NoSuchProcess:
                pass
        psutil.wait_procs([process for process, _ in owned], timeout=5)
    finally:
        if suspended and same_process(owner, created):
            owner.resume()
    return stopped


def run_guard(directory, owner_pid, metric='ram', limit=90, interval=2, sample=None):
    directory = Path(directory).resolve()
    owner = psutil.Process(owner_pid)
    validate_owner(owner, directory)
    created = owner.create_time()
    status = {'ownerPid': owner_pid, 'ownerCreated': created, 'guardPid': os.getpid(),
              'metric': metric, 'limitPercent': limit, 'intervalSeconds': interval,
              'startedAt': datetime.now(timezone.utc).isoformat(), 'samples': 0,
              'peakRamPercent': 0, 'peakCpuPercent': 0, 'status': 'monitoring'}
    status_file = directory / 'resource-guard.json'
    interval_sample = sample is None
    if sample is None:
        def sample():
            # A nonblocking reset followed immediately by a nonblocking read
            # has no useful measurement window and can report a false spike.
            cpu = psutil.cpu_percent(interval=interval)
            return {'ram': psutil.virtual_memory().percent, 'cpu': cpu}
    try:
        while same_process(owner, created):
            usage = sample()
            status.update(samples=status['samples'] + 1, last=usage,
                          updatedAt=datetime.now(timezone.utc).isoformat(),
                          peakRamPercent=max(status['peakRamPercent'], usage['ram']),
                          peakCpuPercent=max(status['peakCpuPercent'], usage['cpu']))
            trigger = exceeded(usage, metric, limit)
            if trigger:
                status.update(status='stopping', exceeded=trigger)
                # Persist the stop reason before touching processes. Classification
                # records are already saved atomically; only in-flight work is lost.
                atomic_json(directory / 'resource-stop.json', status)
                atomic_json(status_file, status)
                stopped = stop_owned_tree(owner, created)
                status.update(status='stopped_resource_limit', stoppedPids=stopped,
                              finishedAt=datetime.now(timezone.utc).isoformat())
                atomic_json(directory / 'resource-stop.json', status)
                pipeline_file = directory / 'trial-pipeline.json'
                pipeline = json.loads(pipeline_file.read_text(encoding='utf-8'))
                if pipeline.get('pid') == owner_pid:
                    pipeline.update(stage='stopped_resource_limit', updatedAt=status['finishedAt'], resourceStop=status)
                    atomic_json(pipeline_file, pipeline)
                atomic_json(status_file, status)
                return status
            atomic_json(status_file, status)
            if not interval_sample:
                time.sleep(interval)
        status.update(status='owner_exited', finishedAt=datetime.now(timezone.utc).isoformat())
        atomic_json(status_file, status)
        return status
    except OSError as error:
        # A failed watchdog must not leave native inference running unmonitored.
        stopped = stop_owned_tree(owner, created)
        status.update(status='stopped_watchdog_failure', error=str(error), stoppedPids=stopped,
                      finishedAt=datetime.now(timezone.utc).isoformat())
        for target in (directory / 'resource-stop.json', status_file):
            try:
                atomic_json(target, status)
            except OSError:
                # If replacement remains denied, create the absent restart latch
                # directly. Keep an existing stop reason intact.
                if not target.exists():
                    try:
                        target.write_text(json.dumps(status, indent=2), encoding='utf-8')
                    except OSError:
                        pass
        return status


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('owner_pid', type=int)
    parser.add_argument('--metric', choices=('ram', 'cpu', 'either'), default='ram')
    parser.add_argument('--limit', type=float, default=90)
    args = parser.parse_args()
    if not 0 < args.limit <= 100:
        parser.error('--limit must be greater than zero and at most 100')
    print(json.dumps(run_guard(args.directory, args.owner_pid, args.metric, args.limit)), flush=True)
