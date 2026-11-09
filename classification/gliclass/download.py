"""Download a public immutable checkpoint; verify each runtime file."""
import hashlib
import json
import sys
from pathlib import Path
from huggingface_hub import hf_hub_download

def ensure_checkpoint_file(config, name, digest, destination):
    for force in (False, True):
        downloaded = Path(hf_hub_download(config['model'], name, revision=config['revision'],
                                         local_dir=destination, force_download=force))
        if hashlib.sha256(downloaded.read_bytes()).hexdigest() == digest:
            return downloaded
    raise RuntimeError(f'Checkpoint checksum mismatch after redownload: {name}')


if __name__ == '__main__':
    config = json.loads(Path(__file__).with_name('model.json').read_text())
    destination = Path(sys.argv[1])
    for name, digest in config['sha256'].items():
        ensure_checkpoint_file(config, name, digest, destination)
    print(json.dumps({'model': config['model'], 'revision': config['revision'], 'verified': True}))
