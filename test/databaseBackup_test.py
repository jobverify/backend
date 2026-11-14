import importlib.util
import io
from pathlib import Path
import struct
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('database_backup', Path(__file__).parents[1] / 'scripts' / 'databaseBackup.py')
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupSafetyTests(unittest.TestCase):
    def test_source_database_must_be_explicit_and_not_a_system_database(self):
        self.assertEqual(backup.source_database('mongodb://localhost:27017/jobverify'), 'jobverify')
        for uri in ['mongodb://localhost', 'mongodb://localhost/admin', 'mongodb://localhost/local',
                    'mongodb://localhost/config', 'mongodb://localhost/a%2Fb', 'https://example.test/data']:
            with self.subTest(uri=uri), self.assertRaises(ValueError):
                backup.source_database(uri)

    def test_bson_count_rejects_truncation_instead_of_certifying_an_incomplete_dump(self):
        with tempfile.TemporaryDirectory(prefix='jobverify-backup-test-') as directory:
            file = Path(directory) / 'collection.bson'
            file.write_bytes(struct.pack('<i', 5) + b'\0' + struct.pack('<i', 5) + b'\0')
            self.assertEqual(backup.count_bson(file), 2)
            for data in [b'\x10\0', struct.pack('<i', 20) + b'\0', struct.pack('<i', -1)]:
                file.write_bytes(data)
                with self.assertRaises(ValueError):
                    backup.count_bson(file)

    def test_restore_rejects_paths_and_links_that_escape_the_disposable_directory(self):
        for name, kind in [('../outside', tarfile.REGTYPE), ('/absolute', tarfile.REGTYPE),
                           ('dump/../outside', tarfile.REGTYPE), ('dump/link', tarfile.SYMTYPE),
                           ('dump/hardlink', tarfile.LNKTYPE)]:
            member = tarfile.TarInfo(name)
            member.type = kind
            with self.subTest(name=name), self.assertRaises(ValueError):
                backup.validate_member(member)

    def test_restore_destination_is_new_loopback_database(self):
        uri, database = backup.restore_target(27018)
        self.assertTrue(uri.startswith('mongodb://127.0.0.1:27018/jobverify_restore_'))
        self.assertTrue(database.startswith('jobverify_restore_'))
        self.assertNotIn('production', uri)
        with self.assertRaises(ValueError):
            backup.restore_target(0)


if __name__ == '__main__':
    unittest.main()
