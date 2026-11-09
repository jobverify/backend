"""Small CPU and tokenization helpers without model initialization."""
import os
import sys


def available_cpu_count():
    count = os.cpu_count() or 1
    if hasattr(os, 'sched_getaffinity'):
        try:
            count = min(count, len(os.sched_getaffinity(0)))
        except OSError:
            pass
    return max(1, count)


def choose_cpu_threads(requested='auto', available=None):
    available = available_cpu_count() if available is None else max(1, available)
    threads = min(4, available) if requested == 'auto' else int(requested)
    if threads < 1:
        raise ValueError('GLICLASS_CPU_THREADS must be auto or a positive integer')
    return min(threads, available, 4)


def tokenize_full_source(tokenizer, text):
    # This counts a full document before overlapping inference windows are built.
    # Quiet only this expected length warning; never discard source tokens.
    return tokenizer(text, add_special_tokens=False, truncation=False, verbose=False)['input_ids']


def peak_process_rss(process, system=None):
    memory = process.memory_info()
    peak = max(memory.rss, getattr(memory, 'peak_wset', 0))
    if (system or sys.platform).startswith('linux'):
        # Linux ru_maxrss is KiB and includes transient peaks within a batch.
        import resource
        peak = max(peak, resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * 1024)
    return peak
