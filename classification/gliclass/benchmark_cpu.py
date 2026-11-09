"""Compare bounded CPU configurations on identical complete source descriptions."""
import importlib.util
import io
import json
import os
import statistics
import sys
import time
from pathlib import Path

directory = Path(sys.argv[1])
if (directory / 'corpus.jsonl').exists():
    with (directory / 'corpus.jsonl').open(encoding='utf-8') as lines:
        corpus = [json.loads(line) for line in lines if line.strip()]
else:
    corpus = json.loads((directory / 'corpus.json').read_text(encoding='utf-8'))['jobs']
# Deterministic sample across description lengths, independent of predictions.
available = sorted((job for job in corpus if (job.get('sourceDescription') or job.get('jobDescription') or job.get('description'))),
    key=lambda job: (len(job.get('sourceDescription') or job.get('jobDescription') or job.get('description')), job['trialId']))
sample = [available[int((len(available)-1)*q/13)] for q in range(1, 13)]
old_stdin = sys.stdin
sys.stdin = io.StringIO('')
spec = importlib.util.spec_from_file_location('gliclass_worker', Path(__file__).with_name('worker.py'))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
sys.stdin = old_stdin
results = []
for threads, batch in [(2, 4), (1, 1), (2, 1), (1, 4), (1, 4), (2, 1), (1, 1), (2, 4)]:
    worker.torch.set_num_threads(threads)
    os.environ['GLICLASS_BATCH_SIZE'] = str(batch)
    rows = []
    for job in sample:
        item = {'title': job.get('originalTitle') or job['title'],
                'body': job.get('sourceDescription') or job.get('jobDescription') or job.get('description'),
                'sourceEmploymentType': job.get('sourceEmploymentType') or ''}
        item['body'] = item['body'].replace('\r', '')
        prediction = worker.classify(item)
        rows.append({'id': job['trialId'], **prediction})
    results.append({'threads': threads, 'batch': batch, 'rows': rows,
                    'seconds': sum(row['seconds'] for row in rows),
                    'cpuSeconds': sum(row['cpuSeconds'] for row in rows)})
    (directory / 'cpu-benchmark.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    print(json.dumps({'threads': threads, 'batch': batch, 'jobs': len(rows),
        'seconds': results[-1]['seconds'], 'cpuSeconds': results[-1]['cpuSeconds']}), flush=True)
aggregates = []
for threads, batch in [(1, 1), (1, 4), (2, 1), (2, 4)]:
    trials = [trial for trial in results if trial['threads'] == threads and trial['batch'] == batch]
    aggregates.append({'threads': threads, 'batch': batch,
        'meanSecondsPerJob': sum(trial['seconds'] for trial in trials)/(len(sample)*len(trials)),
        'meanCpuSecondsPerJob': sum(trial['cpuSeconds'] for trial in trials)/(len(sample)*len(trials)),
        'jobs': len(sample)*len(trials)})
(directory / 'cpu-benchmark-summary.json').write_text(json.dumps(aggregates, indent=2), encoding='utf-8')
print(json.dumps(aggregates), flush=True)
