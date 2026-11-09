"""Pure configuration/token-count checks; no model or third-party imports."""
import importlib.util
from pathlib import Path
import unittest
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('classification_runtime', Path(__file__).with_name('runtime.py'))
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


class RuntimeTests(unittest.TestCase):
    def test_threads_respect_requested_count_available_cpus_and_four_core_cap(self):
        self.assertEqual(runtime.choose_cpu_threads('auto', 16), 4)
        self.assertEqual(runtime.choose_cpu_threads('4', 2), 2)
        self.assertEqual(runtime.choose_cpu_threads('1', 4), 1)
        self.assertEqual(runtime.choose_cpu_threads('99', 8), 4)

    def test_invalid_thread_settings_are_code_configuration_errors(self):
        for value in ('0', '-2', 'abc', '2.5'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                runtime.choose_cpu_threads(value, 4)

    def test_cpu_detection_respects_process_affinity(self):
        with patch.object(runtime.os, 'cpu_count', return_value=16), patch.object(
                runtime.os, 'sched_getaffinity', return_value={0, 1}, create=True):
            self.assertEqual(runtime.available_cpu_count(), 2)

    def test_whole_source_counting_is_quiet_without_truncating_any_tokens(self):
        calls = []
        def tokenizer(text, **kwargs):
            calls.append((text, kwargs))
            return {'input_ids': list(range(28000))}
        ids = runtime.tokenize_full_source(tokenizer, 'Complete employer source')
        self.assertEqual(len(ids), 28000)
        self.assertEqual(calls, [('Complete employer source', {
            'add_special_tokens': False, 'truncation': False, 'verbose': False})])

    def test_windows_peak_rss_uses_peak_working_set_instead_of_current_rss(self):
        process = SimpleNamespace(memory_info=lambda: SimpleNamespace(rss=100, peak_wset=300))
        self.assertEqual(runtime.peak_process_rss(process, 'win32'), 300)

    def test_rss_falls_back_to_current_observation_when_peak_is_unavailable(self):
        process = SimpleNamespace(memory_info=lambda: SimpleNamespace(rss=100))
        self.assertEqual(runtime.peak_process_rss(process, 'other'), 100)

    def test_linux_peak_rss_converts_os_kib_to_bytes(self):
        process = SimpleNamespace(memory_info=lambda: SimpleNamespace(rss=100))
        resource = SimpleNamespace(RUSAGE_SELF=0, getrusage=lambda who: SimpleNamespace(ru_maxrss=3))
        with patch.dict('sys.modules', {'resource': resource}):
            self.assertEqual(runtime.peak_process_rss(process, 'linux'), 3072)


if __name__ == '__main__':
    unittest.main()
