import hashlib
import importlib.util
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock

sys.modules.setdefault('huggingface_hub', types.SimpleNamespace(hf_hub_download=Mock()))
spec = importlib.util.spec_from_file_location('checkpoint_download', Path(__file__).with_name('download.py'))
download = importlib.util.module_from_spec(spec)
spec.loader.exec_module(download)


class CheckpointCacheTests(unittest.TestCase):
    def test_healthy_cache_is_reused_and_corrupt_cache_is_redownloaded(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'model'
            target.write_bytes(b'valid')
            digest = hashlib.sha256(b'valid').hexdigest()
            config = {'model': 'public/model', 'revision': 'immutable'}
            download.hf_hub_download = Mock(return_value=str(target))
            download.ensure_checkpoint_file(config, 'model', digest, directory)
            self.assertEqual(download.hf_hub_download.call_count, 1)
            target.write_bytes(b'corrupt')

            def fetch(*args, **kwargs):
                if kwargs['force_download']:
                    target.write_bytes(b'valid')
                return str(target)

            download.hf_hub_download = Mock(side_effect=fetch)
            download.ensure_checkpoint_file(config, 'model', digest, directory)
            self.assertEqual(download.hf_hub_download.call_count, 2)

    def test_invalid_download_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'model'
            target.write_bytes(b'corrupt')
            download.hf_hub_download = Mock(return_value=str(target))
            with self.assertRaises(RuntimeError):
                download.ensure_checkpoint_file({'model': 'public/model', 'revision': 'immutable'}, 'model', 'bad', directory)


if __name__ == '__main__':
    unittest.main()
