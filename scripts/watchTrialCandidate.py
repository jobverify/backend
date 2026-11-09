"""Apply the local trial's resource stop to a registered sibling model probe."""
import argparse
import json
import sys
import time
from pathlib import Path

import psutil
from localTrialResourceGuard import atomic_json, exceeded, run_guard, same_process, stop_owned_tree, validate_owner


def validate_candidate(candidate, directory):
    command = candidate.cmdline()
    if Path(command[0]).resolve() == Path(sys.executable).resolve():
        for index, argument in enumerate(command):
            if (Path(candidate.cwd()) / argument).resolve() != directory / 'instruct-model-probe.py':
                continue
            if command[index+1:index+2] in (['base'], ['instruct']) and command[index+2:index+3] in (['development'], ['validation'], ['performance']):
                return
    raise ValueError('Registered candidate must be this trial directory\'s model probe')


def watch(directory, owner_pid, owner_created, candidate_pid, candidate_created, sample=None):
    directory = Path(directory).resolve()
    candidate = psutil.Process(candidate_pid)
    if not same_process(candidate, candidate_created):
        raise ValueError('Candidate process creation time changed')
    validate_candidate(candidate, directory)
    owner = psutil.Process(owner_pid)
    if not same_process(owner, owner_created):
        raise ValueError('Trial process creation time changed')
    validate_owner(owner, directory)
    guard_file = directory / 'resource-guard.json'
    limits = json.loads(guard_file.read_text()) if guard_file.exists() else {}
    metric, limit = limits.get('metric', 'either'), limits.get('limitPercent', 90)
    if metric not in ('ram', 'cpu', 'either') or not 0 < limit <= 100:
        raise ValueError('Invalid resource limit')
    status = {'ownerPid': owner_pid, 'ownerCreated': owner_created, 'candidatePid': candidate_pid,
              'candidateCreated': candidate_created, 'metric': metric, 'limitPercent': limit,
              'status': 'monitoring', 'peakRamPercent': 0, 'peakCpuPercent': 0}
    target = directory / f'candidate-resource-guard-{candidate_pid}.json'
    if sample is None:
        psutil.cpu_percent()
        def sample():
            return {'ram': psutil.virtual_memory().percent, 'cpu': psutil.cpu_percent()}
    while same_process(candidate, candidate_created):
        usage = sample()
        status.update(last=usage, peakRamPercent=max(status['peakRamPercent'],usage['ram']),
                      peakCpuPercent=max(status['peakCpuPercent'],usage['cpu']))
        stop_file = directory / 'resource-stop.json'
        journal = json.loads(stop_file.read_text()) if stop_file.exists() else {}
        parent_stop = journal.get('ownerPid') == owner_pid and journal.get('ownerCreated') == owner_created
        trigger = exceeded(usage, metric, limit)
        if parent_stop or trigger:
            status.update(status='stopping', exceeded=journal.get('exceeded') if parent_stop else trigger)
            atomic_json(target, status)
            try:
                if not parent_stop and same_process(owner, owner_created):
                    run_guard(directory, owner_pid, metric=metric, limit=limit, sample=lambda: usage)
            except psutil.NoSuchProcess:
                pass
            finally:
                status.update(status='stopped_resource_limit', stoppedCandidatePids=stop_owned_tree(candidate,candidate_created))
                atomic_json(target, status)
            return status
        atomic_json(target, status)
        time.sleep(2)
    status['status'] = 'candidate_exited'
    atomic_json(target, status)
    return status


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    parser.add_argument('owner_pid', type=int)
    parser.add_argument('owner_created', type=float)
    parser.add_argument('candidate_pid', type=int)
    parser.add_argument('candidate_created', type=float)
    args = parser.parse_args()
    print(json.dumps(watch(args.directory,args.owner_pid,args.owner_created,args.candidate_pid,args.candidate_created)), flush=True)
