"""Attach to a local dry run, cool and resume it, then run both follow-up stages."""
import argparse
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import psutil

sys.path.insert(0, str(Path(__file__).resolve().parent))
from localTrialResourceGuard import atomic_json, exceeded, same_process, stop_owned_tree

BACKEND = Path(__file__).resolve().parents[1]
SCRAPER_SCRIPT = BACKEND / 'scripts/resilientLocalScrape.js'
SOURCE_NAME = re.compile(r'^[a-z0-9][a-z0-9._-]{0,127}$', re.I)
FOLLOWUP_SCRIPTS = {'descriptions': 'evaluateDryRunDescriptions.js',
                    'classification': 'classifyTrialSnapshots.js'}


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def read_json(file, default=None, optional=False):
    for attempt in range(6):
        try:
            return json.loads(Path(file).read_text(encoding='utf-8-sig'))
        except FileNotFoundError:
            return default
        except (PermissionError, json.JSONDecodeError):
            if optional:
                return default
            if attempt == 5:
                raise
            time.sleep(.02 * (attempt + 1))


def complete_capture(state):
    sources = (state or {}).get('catalogSources', [])
    return bool(state and state.get('mode') == 'dry-run'
                and state.get('status') == 'complete'
                and state.get('completedCount') == state.get('totalSources')
                and isinstance(sources, list) and len(sources) == state.get('totalSources')
                and all(isinstance(source, str) and SOURCE_NAME.fullmatch(source)
                        for source in sources) and len(set(sources)) == len(sources))


class Cooldown:
    def __init__(self, stopped_at, delay_seconds=60, healthy_samples=3, resume_below=80):
        self.stopped_at = stopped_at
        self.delay_seconds = delay_seconds
        self.healthy_samples = healthy_samples
        self.resume_below = resume_below
        self.consecutive = 0

    def ready(self, reading, now):
        healthy = all(isinstance(reading.get(name), (int, float))
                      and 0 <= reading[name] <= self.resume_below for name in ('cpu', 'ram'))
        if now - self.stopped_at < self.delay_seconds or not healthy:
            self.consecutive = 0
            return False
        self.consecutive += 1
        return self.consecutive >= self.healthy_samples


def validate_scrape_owner(owner, directory):
    working = Path(owner.cwd())
    command = owner.cmdline()
    for index, argument in enumerate(command):
        if Path(argument).name != SCRAPER_SCRIPT.name:
            continue
        if (working / argument).resolve() != SCRAPER_SCRIPT:
            continue
        arguments = command[index + 1:]
        if '--run-dir' in arguments:
            at = arguments.index('--run-dir')
            if at + 1 < len(arguments) and (working / arguments[at + 1]).resolve() == Path(directory).resolve():
                return
    raise ValueError('Refusing to attach to a process that does not supervise this dry-run directory')


def running_followups(directory, stage=None):
    directory = Path(directory).resolve()
    matches = []
    for owner in psutil.process_iter(['name']):
        if (owner.info['name'] or '').lower() not in ('node', 'node.exe'):
            continue
        try:
            command, working = owner.cmdline(), Path(owner.cwd())
            for name, script in FOLLOWUP_SCRIPTS.items():
                if stage and name != stage:
                    continue
                for index, argument in enumerate(command):
                    if Path(argument).name != script or (working / argument).resolve() != BACKEND / 'scripts' / script:
                        continue
                    arguments = command[index + 1:]
                    if name == 'descriptions':
                        if '--run-dir' not in arguments or '--output' not in arguments:
                            continue
                        run = arguments[arguments.index('--run-dir') + 1]
                        output = arguments[arguments.index('--output') + 1]
                        if (working / output).resolve() != directory / 'descriptions':
                            continue
                    elif arguments:
                        run = arguments[0]
                    else:
                        continue
                    if (working / run).resolve() == directory:
                        owner.create_time()
                        matches.append((name, owner))
                        break
        except (psutil.NoSuchProcess, psutil.AccessDenied, IndexError):
            continue
    return sorted(matches, key=lambda item: item[1].create_time())


def stage_artifact_complete(directory, stage):
    if stage == 'descriptions':
        report = read_json(directory / 'descriptions/summary.json', {}, optional=True)
        state = read_json(directory / 'run-state.json', {})
        return complete_capture(state) and report.get('status') == 'complete' and all(
            report.get('companies', {}).get(source, {}).get('finished')
            and report['companies'][source].get('completedAt') == entry.get('completedAt')
            for source, entry in state.get('completed', {}).items())
    if stage == 'classification':
        report = read_json(directory / 'classification-summary.json', {}, optional=True)
        manifest = read_json(directory / 'corpus-manifest.json', {}, optional=True)
        return ('total' in report and report.get('completedAt') and report.get('failed') == 0
                and report.get('completed', 0) + report.get('skipped', 0) == report['total'] == manifest.get('jobCount')
                and not report.get('stoppedForResourceLimit'))
    return False


def publish(directory, status):
    status['updatedAt'] = timestamp()
    atomic_json(directory / 'watchdog-status.json', status)


def log(directory, event, **details):
    row = {'at': timestamp(), 'event': event, **details}
    line = json.dumps(row)
    with (directory / 'watchdog-events.ndjson').open('a', encoding='utf-8') as output:
        output.write(line + '\n')
    with (directory / 'pipeline.log').open('a', encoding='utf-8') as output:
        output.write('[' + row['at'] + '] [watchdog] ' + line + '\n')
    print(line, flush=True)


def report_source_failures(directory, state):
    failures = [{'source': source, **entry.get('result', {})}
                for source, entry in state.get('completed', {}).items()
                if not entry.get('result', {}).get('success')]
    atomic_json(directory / 'watchdog-source-failures.json', {
        'updatedAt': timestamp(), 'failures': failures})
    return failures


def sample_resources(interval):
    return {'cpu': psutil.cpu_percent(interval=interval), 'ram': psutil.virtual_memory().percent}


def record_resources(directory, status, reading):
    if not all(isinstance(reading.get(name), (int, float)) and 0 <= reading[name] <= 100
               for name in ('cpu', 'ram')):
        raise ValueError('Invalid CPU or memory sample')
    resources = status.setdefault('resources', {'samples': 0, 'peakCpuPercent': 0,
                                               'peakMemoryPercent': 0})
    resources.update(samples=resources['samples'] + 1, current={**reading, 'at': timestamp()},
                     peakCpuPercent=max(resources['peakCpuPercent'], reading['cpu']),
                     peakMemoryPercent=max(resources['peakMemoryPercent'], reading['ram']))
    parallel = read_json(directory / 'classification-monitor/watchdog-status.json', {}, optional=True)
    if parallel.get('parentRunDirectory') == str(Path(directory).resolve()) and status.get('stage') != 'classification':
        phase = {'monitoring': 'running', 'cooling': 'cooling', 'starting': 'starting'}.get(parallel.get('status'))
        if parallel.get('status') == 'complete' and stage_artifact_complete(directory, 'classification'):
            phase = 'complete'
        if phase:
            status.setdefault('stages', {})['classification'] = {
                'status': phase, 'monitor': str(directory / 'classification-monitor'),
                'startedAt': parallel.get('startedAt'), 'finishedAt': parallel.get('finishedAt')}
    with (directory / 'watchdog-resources.ndjson').open('a', encoding='utf-8') as output:
        output.write(json.dumps(resources['current']) + '\n')
    if status.get('stage') == 'scraping' and resources['samples'] % 15 == 1:
        state = read_json(directory / 'run-state.json', {})
        failures = report_source_failures(directory, state)
        status['scrape'] = {'completedSources': state.get('completedCount', 0),
                            'totalSources': state.get('totalSources', 0),
                            'failedSources': [entry['source'] for entry in failures]}
    publish(directory, status)


def monitor_process(owner, directory, stage, status, sample=None, interval=2):
    directory = Path(directory)
    created = owner.create_time()
    status.update(status='monitoring', stage=stage,
                  activeProcess={'pid': owner.pid, 'created': created})
    publish(directory, status)
    try:
        while same_process(owner, created):
            if owner.status() == psutil.STATUS_ZOMBIE:
                break
            if (directory / 'watchdog-stop.json').exists():
                stopped = stop_owned_tree(owner, created)
                raise InterruptedError('User requested watchdog stop; stopped PIDs ' + str(stopped))
            reading = sample() if sample else sample_resources(interval)
            related = [(name, other) for name, other in running_followups(directory)
                       if other.pid != owner.pid]
            for name, other in related:
                if stage == name:
                    stopped = stop_owned_tree(other, other.create_time())
                    log(directory, 'duplicate_stage_stopped', stage=name, stoppedPids=stopped,
                        preservedPid=owner.pid)
            record_resources(directory, status, reading)
            if read_json(directory / 'watchdog-ready.json', {}, optional=True).get('pid') != os.getpid():
                atomic_json(directory / 'watchdog-ready.json', {
                    'pid': os.getpid(), 'stage': stage, 'at': timestamp(), 'reading': reading})
            trigger = exceeded(reading, 'either', 90)
            if trigger and same_process(owner, created):
                outcome = {'status': 'resource_stopped', 'stage': stage, 'reading': reading,
                           'exceeded': trigger, 'at': timestamp(), 'ownerPid': owner.pid}
                atomic_json(directory / 'watchdog-resource-stop.json', outcome)
                stopped = stop_owned_tree(owner, created)
                for name, other in related:
                    try:
                        stopped.extend(stop_owned_tree(other, other.create_time()))
                    except psutil.NoSuchProcess:
                        pass
                outcome['stoppedPids'] = stopped
                atomic_json(directory / 'watchdog-resource-stop.json', outcome)
                status.update(status='cooling', lastResourceStop=outcome,
                              resourceStops=status.get('resourceStops', 0) + 1)
                publish(directory, status)
                log(directory, 'resource_limit_stop', **outcome)
                return outcome
            if sample:
                time.sleep(interval)
    except psutil.NoSuchProcess:
        pass
    except BaseException:
        # Never leave an owned workload running after losing its monitor.
        stop_owned_tree(owner, created)
        raise
    return {'status': 'exited', 'ownerPid': owner.pid}


def wait_for_cooling(directory, status, sample=None, interval=2, delay_seconds=60):
    cooling = Cooldown(time.monotonic(), delay_seconds=delay_seconds)
    status.update(status='cooling', activeProcess=None)
    log(directory, 'cooldown_started', minimumSeconds=delay_seconds,
        resumeAtOrBelowPercent=80, requiredHealthySamples=3)
    while True:
        if (directory / 'watchdog-stop.json').exists():
            raise InterruptedError('User requested watchdog stop during cooldown')
        reading = sample() if sample else sample_resources(interval)
        record_resources(directory, status, reading)
        if cooling.ready(reading, time.monotonic()):
            stop = directory / 'watchdog-resource-stop.json'
            if stop.exists():
                stop.rename(directory / ('watchdog-resource-stop-' + str(time.time_ns()) + '.json'))
            log(directory, 'resources_recovered', reading=reading)
            return
        if sample:
            time.sleep(interval)


def child_environment(directory, metadata):
    env = {**os.environ, **{key: str(value) for key, value in metadata.get('environment', {}).items()
                          if key != 'classificationStage' and value is not None}}
    env.update(MONGO_URI='', TELEGRAM_ENABLED='false', JOB_DESCRIPTION_REWRITE_MODE='off',
               NODE_OPTIONS='--use-system-ca --max-old-space-size=6144',
               SCRAPER_DRY_RUN_OUTPUT_DIRECTORY=str(directory / 'snapshots'),
               SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY=str(directory / 'outbox'),
               SCRAPER_RAW_CAPTURE_DIRECTORY=str(directory / 'raw'),
               SCRAPER_ONLY='', SCRAPER_START_AT='', SCRAPER_START_AFTER='', SCRAPER_FIRST_N='',
               GLICLASS_PYTHON=str(BACKEND / '.cache/gliclass-runtime/Scripts/python.exe'),
               GLICLASS_MODEL_DIRECTORY=str(BACKEND / '.cache/gliclass-model'),
               GLICLASS_CPU_THREADS='1', GLICLASS_BATCH_SIZE='1',
               PYTHONUTF8='1', PYTHONIOENCODING='utf-8')
    return env


def scrape_command(directory):
    return [shutil.which('node') or 'node', '--use-system-ca', str(SCRAPER_SCRIPT),
            '--run-dir', str(directory), '--parallel', '--dry-run',
            '--max-restarts', '8', '--restart-delay-seconds', '60']


def launch_monitored(command, directory, stage, status, env, sample, interval):
    reading = sample() if sample else sample_resources(interval)
    record_resources(directory, status, reading)
    if exceeded(reading, 'either', 90):
        wait_for_cooling(directory, status, sample, interval)
    existing = running_followups(directory, stage)
    if existing:
        owner = existing[0][1]
        log(directory, 'existing_stage_adopted', stage=stage, pid=owner.pid)
        outcome = monitor_process(owner, directory, stage, status, sample, interval)
        code = owner.wait(timeout=10)
        if code is None and stage == 'descriptions' and read_json(
                directory / 'descriptions/summary.json', {}).get('status') == 'budget_exhausted':
            code = 75
        outcome['exitCode'] = code if code is not None else (0 if stage_artifact_complete(directory, stage) else 1)
        return outcome
    with (directory / (stage + '.stdout.log')).open('ab') as stdout, \
            (directory / (stage + '.stderr.log')).open('ab') as stderr:
        child = subprocess.Popen(command, cwd=BACKEND, env=env, stdout=stdout, stderr=stderr,
                                 creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        log(directory, 'stage_process_started', stage=stage, pid=child.pid)
        try:
            outcome = monitor_process(psutil.Process(child.pid), directory, stage, status, sample, interval)
            outcome['exitCode'] = child.wait(timeout=10)
            return outcome
        except BaseException:
            if child.poll() is None:
                stop_owned_tree(psutil.Process(child.pid), psutil.Process(child.pid).create_time())
            child.wait(timeout=10)
            raise


def merge_recovery(directory, retry):
    state = read_json(directory / 'run-state.json')
    original = directory / 'run-state-before-recovery.json'
    if not original.exists():
        atomic_json(original, state)
    recovered = []
    for source, entry in retry.get('completed', {}).items():
        if source in state['completed'] and entry.get('result', {}).get('success'):
            state['completed'][source] = entry
            recovered.append(source)
    state['recoveredSources'] = sorted(set(state.get('recoveredSources', []) + recovered))
    state['updatedAt'] = timestamp()
    atomic_json(directory / 'run-state.json', state)
    report_source_failures(directory, state)
    atomic_json(directory / 'failure-recovery.json', {
        'at': timestamp(), 'recoveredSources': recovered,
        'remainingFailures': [source for source, entry in state['completed'].items()
                              if not entry.get('result', {}).get('success')]})


def run_watchdog(directory, interval=2, sample=None, recovery=True,
                 followups=None, max_failures=3, cooldown_seconds=60):
    directory = Path(directory).resolve()
    metadata = read_json(directory / 'run-metadata.json', {})
    if metadata.get('mode') != 'dry-run':
        raise ValueError('The watchdog only accepts an existing local dry run')
    previous = read_json(directory / 'watchdog-status.json', {})
    previous_pid = previous.get('pid')
    if previous_pid and previous_pid != os.getpid():
        try:
            other = psutil.Process(previous_pid)
            if same_process(other, previous.get('created')):
                raise ValueError('A watchdog already owns this run')
        except psutil.NoSuchProcess:
            pass
    status = {**previous, 'pid': os.getpid(), 'created': psutil.Process().create_time(),
              'status': 'starting', 'stage': 'scraping', 'startedAt': timestamp(),
              'settings': {'limitPercent': 90, 'metrics': ['cpu', 'ram'], 'intervalSeconds': interval,
                           'cooldownSeconds': cooldown_seconds, 'resumeAtOrBelowPercent': 80,
                           'healthySamples': 3, 'automaticResume': True},
              'mongoWrites': 0, 'stages': {
                  'scraping': {'status': 'running'},
                  'descriptions': {'status': 'pending_after_scrape'},
                  'classification': {'status': 'pending_after_descriptions'},
                  **previous.get('stages', {})}}
    if status.get('error'):
        status['lastRecoveredError'] = status.pop('error')
    status['activeProcess'] = None
    publish(directory, status)
    (directory / 'watchdog.pid').write_text(str(os.getpid()) + '\n', encoding='ascii')
    env = child_environment(directory, metadata)
    def cool():
        wait_for_cooling(directory, status, sample, interval, cooldown_seconds)
    try:
        state = read_json(directory / 'run-state.json', {})
        owner = None
        pid_file = directory / 'supervisor.pid'
        if pid_file.exists():
            try:
                owner = psutil.Process(int(pid_file.read_text(encoding='utf-8-sig').strip()))
                validate_scrape_owner(owner, directory)
            except psutil.NoSuchProcess:
                owner = None
        if owner:
            log(directory, 'attached_to_scraper', pid=owner.pid)
            outcome = monitor_process(owner, directory, 'scraping', status, sample, interval)
            if outcome['status'] == 'resource_stopped':
                cool()
        failures = 0
        while not complete_capture(state := read_json(directory / 'run-state.json', {})):
            if failures >= max_failures:
                raise RuntimeError('Scrape remains incomplete after supervised recovery attempts; see scraping.stderr.log')
            outcome = launch_monitored(scrape_command(directory), directory, 'scraping', status, env, sample, interval)
            if outcome['status'] == 'resource_stopped':
                cool()
            elif not complete_capture(read_json(directory / 'run-state.json', {})):
                failures += 1
                cool()
        status['stages']['scraping'] = {'status': 'complete', 'finishedAt': timestamp(),
                                       'completedSources': state['completedCount']}
        failed_sources = [source for source, entry in state.get('completed', {}).items()
                          if not entry.get('result', {}).get('success')]
        retry_state = read_json(directory / 'failure-retry/run-state.json', {})
        recovery_done = ((directory / 'failure-recovery.json').exists()
                         and complete_capture(retry_state)
                         and all(source in retry_state.get('completed', {}) for source in failed_sources))
        if recovery and failed_sources and not recovery_done:
            retry_dir = directory / 'failure-retry'
            retry_dir.mkdir(exist_ok=True)
            retry_env = {**env, 'SCRAPER_ONLY': ','.join(failed_sources),
                         'SCRAPER_CONCURRENCY': '3'}
            while True:
                outcome = launch_monitored(scrape_command(retry_dir), directory,
                                           'failure_recovery', status, retry_env, sample, interval)
                if outcome['status'] != 'resource_stopped':
                    break
                cool()
            merge_recovery(directory, read_json(retry_dir / 'run-state.json', {}))
            state = read_json(directory / 'run-state.json')
        status['scrape'] = {'completedSources': state['completedCount'],
                            'totalSources': state['totalSources'],
                            'failedSources': [source for source, entry in state.get('completed', {}).items()
                                              if not entry.get('result', {}).get('success')]}
        catalog = [{'source': source, 'file': str(directory / 'snapshots' / (source + '.json'))}
                   for source in state['catalogSources']]
        scope = directory / 'post-scrape-scope.json'
        atomic_json(scope, {'catalog': catalog, 'capturedAt': timestamp()})
        original_scope = directory / 'scope.json'
        original_catalog = read_json(original_scope, {}).get('catalog', [])
        expected = {item['source']: Path(item['file']).resolve() for item in catalog}
        if (len(original_catalog) == len(catalog) and all(
                item.get('source') in expected and isinstance(item.get('file'), str)
                and Path(item['file']).resolve() == expected[item['source']]
                for item in original_catalog)
                and len({item['source'] for item in original_catalog}) == len(catalog)):
            scope = original_scope
        if followups is None:
            node = shutil.which('node') or 'node'
            followups = [
                ('descriptions', [node, '--use-system-ca', 'scripts/evaluateDryRunDescriptions.js',
                                  '--run-dir', str(directory), '--catalog', str(scope),
                                  '--output', str(directory / 'descriptions'), '--watch',
                                  '--budget-seconds', '18000']),
                ('classification', [node, '--use-system-ca', 'scripts/classifyTrialSnapshots.js', str(directory)])]
        for stage, command in followups:
            if status['stages'].get(stage, {}).get('status') == 'complete':
                continue
            failures = 0
            attempt = 0
            while True:
                attempt += 1
                status['stages'][stage] = {'status': 'running', 'attempt': attempt,
                                          'startedAt': timestamp()}
                outcome = launch_monitored(command, directory, stage, status, env, sample, interval)
                if outcome['status'] == 'resource_stopped':
                    cool()
                    continue
                if outcome['exitCode'] == 0:
                    status['stages'][stage].update(status='complete', finishedAt=timestamp())
                    break
                if outcome['exitCode'] != 75:
                    failures += 1
                status['stages'][stage].update(status='retrying', lastExitCode=outcome['exitCode'])
                log(directory, 'stage_failed', stage=stage, attempt=attempt, exitCode=outcome['exitCode'])
                if failures >= max_failures:
                    status['stages'][stage].update(status='failed', finishedAt=timestamp())
                    break
                cool()
        status.update(status='completed_with_failures' if status['scrape']['failedSources'] or any(
            entry.get('status') == 'failed' for entry in status['stages'].values()) else 'complete',
            stage='finished', activeProcess=None, finishedAt=timestamp())
        log(directory, 'pipeline_finished', status=status['status'])
    except InterruptedError as error:
        status.update(status='stopped_by_user', error=str(error), finishedAt=timestamp())
    except BaseException as error:
        status.update(status='failed', error=str(error), finishedAt=timestamp())
        log(directory, 'watchdog_failed', error=str(error))
        raise
    finally:
        publish(directory, status)
    return status


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir', required=True, type=Path)
    args = parser.parse_args()
    directory = args.run_dir.resolve()
    def request_stop(signum, frame):
        atomic_json(directory / 'watchdog-stop.json', {'at': timestamp(), 'signal': signum})
    signal.signal(signal.SIGINT, request_stop)
    signal.signal(signal.SIGTERM, request_stop)
    result = run_watchdog(directory)
    raise SystemExit(0 if result['status'] == 'complete' else 1)
