"""Pure input selection shared by execution and post-run reconciliation."""
import hashlib

NATIVE_DIRECTORIES = ('2070health', 'aible', 'astrasecurity', 'asus.workday', 'attackiq',
                      'axa.workday', 'base64ai', 'doximity', 'sigmasolve',
                      'finolexindustrieslimited', 'goodnotes', 'dentalkart', 'dhan')


def collect_inputs(repo, evidence_paths):
    paths = [repo / 'package.json', repo / 'package-lock.json']
    paths.extend(repo / name for name in evidence_paths)
    for directory in ['src', 'scraper', 'scraper-support', 'test']:
        paths.extend(path for path in (repo / directory).rglob('*')
                     if path.is_file() and path.suffix.lower() in {'.js', '.mjs', '.cjs', '.py', '.json', '.gz'})
    return {path.relative_to(repo).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in paths}


def is_relevant(name, tests, evidence_paths):
    return (name in tests or name in {'package.json', 'package-lock.json'}
            or name in evidence_paths
            or name.startswith(('src/', 'test/helpers/', 'test/test-data/'))
            or name.startswith('scraper-support/') and not name.startswith('scraper-support/tests/')
            or any(name.startswith('scraper/' + directory + '/') for directory in NATIVE_DIRECTORIES))


def changed_relevant_inputs(expected, current, tests, evidence_paths):
    return sorted(name for name in set(expected) | set(current)
                  if is_relevant(name, tests, evidence_paths) and expected.get(name) != current.get(name))
