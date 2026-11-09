"""Offline CPU inference. One process, bounded batches, full source coverage."""
import os
from runtime import available_cpu_count, choose_cpu_threads, tokenize_full_source, peak_process_rss
os.environ.update(TOKENIZERS_PARALLELISM='false', HF_HUB_OFFLINE='1',
                  TRANSFORMERS_OFFLINE='1', HF_HUB_DISABLE_TELEMETRY='1', USE_TF='0')
available_cpus = available_cpu_count()
threads = choose_cpu_threads(os.environ.get('GLICLASS_CPU_THREADS', 'auto'), available_cpus)
os.environ.update(OMP_NUM_THREADS=str(threads), MKL_NUM_THREADS=str(threads))
import hashlib
import json
import re
import statistics
import sys
import time
from pathlib import Path
import psutil
import torch
from transformers import AutoTokenizer
from gliclass import GLiClassModel, ZeroShotClassificationPipeline

config = json.loads(Path(__file__).with_name('model.json').read_text())
model_path = Path(os.environ['GLICLASS_MODEL_DIRECTORY'])
for name, digest in config['sha256'].items():
    if hashlib.sha256((model_path / name).read_bytes()).hexdigest() != digest:
        raise RuntimeError(f'Checkpoint checksum mismatch: {name}')
torch.set_num_threads(threads)
torch.set_num_interop_threads(1)
process = psutil.Process()
if os.name == 'nt':
    process.nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
begun = time.perf_counter()
model = GLiClassModel.from_pretrained(str(model_path), local_files_only=True).eval()
tokenizer = AutoTokenizer.from_pretrained(str(model_path), add_prefix_space=True,
    clean_up_tokenization_spaces=False, local_files_only=True)
pipeline = ZeroShotClassificationPipeline(model, tokenizer, classification_type='single-label',
    device='cpu', max_length=config['windowTokens'], progress_bar=False).pipe
labels = config['labels']
overhead = len(tokenizer(pipeline.prepare_input('', labels))['input_ids'])
peak_rss = peak_process_rss(process)

def classify(item):
    global peak_rss
    started, cpu_started = time.perf_counter(), time.process_time()
    prefix = f"Job title: {item['title']}\nEmployer employment type: {item.get('sourceEmploymentType', '')}\nJob description:\n"
    window_size = config['windowTokens'] - overhead - len(tokenizer(prefix, add_special_tokens=False)['input_ids']) - 16
    if window_size < 128:
        raise ValueError('Title or metadata too long')
    ids = tokenize_full_source(tokenizer, item['body'])
    if not ids:
        raise ValueError('Description missing')
    texts, position = [], 0
    while position < len(ids):
        chunk = ids[position:position + window_size]
        text = prefix + tokenizer.decode(chunk, skip_special_tokens=True, clean_up_tokenization_spaces=False)
        while len(tokenizer(pipeline.prepare_input(text, labels))['input_ids']) > config['windowTokens']:
            chunk = chunk[:-8]
            text = prefix + tokenizer.decode(chunk, skip_special_tokens=True, clean_up_tokenization_spaces=False)
        if position + len(chunk) < len(ids) and len(chunk) <= config['overlapTokens']:
            raise ValueError('Window cannot advance without dropping source tokens')
        texts.append(text)
        if position + len(chunk) >= len(ids):
            break
        position += len(chunk) - config['overlapTokens']
    batch_size = int(os.environ.get('GLICLASS_BATCH_SIZE', str(config['batchSize'])))
    if not 1 <= batch_size <= 16:
        raise ValueError('Batch size must be between 1 and 16')
    scores = []
    with torch.inference_mode():
        for offset in range(0, len(texts), batch_size):
            if psutil.virtual_memory().percent > 90:
                raise RuntimeError('Host memory exceeded 90%; retry this job later')
            output = model(**pipeline.prepare_inputs(texts[offset:offset+batch_size], labels,
                same_labels=True), max_num_classes=4)
            scores.extend(torch.softmax(output.logits[:, :4], dim=-1).tolist())
            peak_rss = max(peak_rss, peak_process_rss(process))
    means = [statistics.mean(row[i] for row in scores) for i in range(4)]
    weights = [5 if re.search(r'(?:employment|position)\s+type|\b(?:\d+\s*[-–]?\s*\d*\+?\s+years?[^\n]{0,60}experience|freshers?|no prior experience)\b',
               text[len(prefix):], re.I) else 2 if re.search(r'qualifications?|requirements?|what you (?:bring|have)', text[len(prefix):], re.I)
               else 1 for text in texts]
    focused = [sum(row[i]*weight for row, weight in zip(scores, weights))/sum(weights) for i in range(4)]
    return {'modelLabel': labels[max(range(4), key=lambda i: means[i])],
        'scores': dict(zip(labels, means)), 'focusedScores': dict(zip(labels, focused)),
        'windowScores': scores, 'windowWeights': weights, 'seconds': time.perf_counter()-started,
        'cpuSeconds': time.process_time()-cpu_started, 'descriptionTokens': len(ids),
        'windows': len(scores), 'fullDescriptionCovered': True, 'peakRssBytes': peak_rss}

print(json.dumps({'ready': True, 'loadSeconds': time.perf_counter()-begun,
                  'revision': config['revision'], 'cpuThreads': threads,
                  'availableCpus': available_cpus, 'peakRssBytes': peak_rss}), flush=True)
for line in sys.stdin:
    try:
        item = json.loads(line)
        try:
            prediction = classify(item)
        except TypeError as exc:
            # Retry tokenizer/batch edge cases independently without dropping text.
            previous_batch = os.environ.get('GLICLASS_BATCH_SIZE')
            os.environ['GLICLASS_BATCH_SIZE'] = '1'
            try:
                prediction = classify(item)
                prediction['retryReason'] = str(exc)
            finally:
                if previous_batch is None:
                    os.environ.pop('GLICLASS_BATCH_SIZE', None)
                else:
                    os.environ['GLICLASS_BATCH_SIZE'] = previous_batch
        print(json.dumps({'id': item['id'], 'prediction': prediction}), flush=True)
    except Exception as exc:
        print(json.dumps({'id': item.get('id') if isinstance(locals().get('item'), dict) else None,
                          'error': str(exc)}), flush=True)
