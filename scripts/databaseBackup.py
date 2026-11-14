"""Encrypted logical MongoDB backups and a deliberately loopback-only restore drill.

No application environment file is loaded. Backup credentials must be supplied
explicitly as BACKUP_MONGO_URI; restore never reads that setting or MONGO_URI.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import struct
import subprocess
import tarfile
import tempfile
from urllib.parse import unquote, urlsplit
from uuid import uuid4

MAX_EXTRACT_BYTES = 8 * 1024 ** 3


def source_database(uri):
    parsed = urlsplit(uri)
    name = unquote(parsed.path.lstrip('/'))
    if parsed.scheme not in ('mongodb', 'mongodb+srv') or not parsed.netloc:
        raise ValueError('A MongoDB source URI is required.')
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,63}', name) or name in ('admin', 'local', 'config'):
        raise ValueError('Select one explicit application database, not a system database.')
    return name


def count_bson(file):
    size = file.stat().st_size
    offset = count = 0
    with file.open('rb') as stream:
        while offset < size:
            header = stream.read(4)
            if len(header) != 4:
                raise ValueError('Truncated BSON document header.')
            length = struct.unpack('<i', header)[0]
            if length < 5 or length > 16 * 1024 ** 2 or offset + length > size:
                raise ValueError('Invalid BSON document size.')
            stream.seek(length - 5, 1)
            if stream.read(1) != b'\0':
                raise ValueError('Invalid BSON document terminator.')
            offset += length
            count += 1
    return count


def validate_member(member):
    name = member.name
    if (not name or name.startswith('/') or '\\' in name or ':' in name
            or any(part in ('.', '..') for part in name.split('/'))
            or not (name == 'manifest.json' or name == 'dump' or name.startswith('dump/'))
            or not (member.isfile() or member.isdir())
            or member.size < 0 or member.size > MAX_EXTRACT_BYTES):
        raise ValueError('Unsafe backup archive member.')


def restore_target(port):
    if not isinstance(port, int) or not 1 <= port <= 65535:
        raise ValueError('Invalid loopback restore port.')
    database = 'jobverify_restore_' + uuid4().hex
    return f'mongodb://127.0.0.1:{port}/{database}', database


def run_tool(arguments, *, input_bytes=None, scratch=None):
    # Tool diagnostics may contain connection strings. Never echo stdout/stderr
    # on failure; only the explicitly parsed verification summary is retained.
    if os.environ.get('BACKUP_TOOLS_CONTAINER') == 'true' and arguments[0] in ('mongodump', 'mongorestore', 'mongosh'):
        if os.name != 'posix' or scratch is None:
            raise ValueError('Container tooling requires a Linux worker and private scratch directory.')
        arguments = ['docker', 'run', '--rm', '--network', 'host', '--read-only',
                     '--user', f'{os.getuid()}:{os.getgid()}', '--cap-drop', 'ALL',
                     '--security-opt', 'no-new-privileges', '--pids-limit', '64',
                     '--memory', '512m', '--cpus', '1',
                     '--tmpfs', '/tmp:rw,nosuid,nodev,size=128m', '--env', 'HOME=/tmp',
                     '--mount', f'type=bind,src={scratch},dst={scratch}',
                     '--entrypoint', arguments[0], 'mongo:8.2.6', *arguments[1:]]
    completed = subprocess.run(arguments, input=input_bytes, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, timeout=3600, check=False)
    if completed.returncode:
        raise RuntimeError('Database backup or restore tool failed; inspect privately.')
    return completed.stdout


def passphrase():
    value = os.environ.get('BACKUP_ENCRYPTION_PASSPHRASE', '')
    if len(value.encode('utf-8')) < 32 or '\n' in value or '\r' in value:
        raise ValueError('Use a separate single-line backup passphrase of at least 32 bytes.')
    return (value + '\n').encode('utf-8')


def digest(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def encrypt_backup(output, scratch):
    uri = os.environ.get('BACKUP_MONGO_URI', '')
    database = source_database(uri)
    password = passphrase()
    config = scratch / 'mongo-config.yml'
    config.write_text('uri: ' + json.dumps(uri) + '\n', encoding='utf-8')
    config.chmod(0o600)
    dump = scratch / 'dump'
    run_tool(['mongodump', '--config=' + str(config), '--db=' + database,
              '--out=' + str(dump), '--quiet'], scratch=scratch)
    records = []
    for file in sorted((dump / database).glob('*.bson')):
        records.append({'collection': file.name[:-5], 'documents': count_bson(file),
                        'path': file.relative_to(scratch).as_posix(), 'sha256': digest(file)})
    if not records:
        raise ValueError('Refusing to certify a backup with no collections.')
    manifest = {'formatVersion': 1, 'database': database,
                'createdAt': datetime.now(timezone.utc).isoformat(), 'collections': records}
    (scratch / 'manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
    plain = scratch / 'backup.tar'
    with tarfile.open(plain, 'w') as archive:
        archive.add(scratch / 'manifest.json', arcname='manifest.json', recursive=False)
        for file in sorted(dump.rglob('*')):
            if file.is_symlink() or not (file.is_file() or file.is_dir()):
                raise ValueError('Unexpected dump file type.')
            if file.is_file():
                archive.add(file, arcname=file.relative_to(scratch).as_posix(), recursive=False)
    encrypted = output / ('jobverify-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
                          + '-' + uuid4().hex[:8] + '.tar.gpg')
    gpg_home = scratch / 'gnupg'
    gpg_home.mkdir(mode=0o700)
    run_tool(['gpg', '--homedir', str(gpg_home), '--batch', '--pinentry-mode', 'loopback',
              '--no-symkey-cache', '--passphrase-fd', '0', '--cipher-algo', 'AES256',
              '--symmetric', '--output', str(encrypted), str(plain)], input_bytes=password)
    checksum = digest(encrypted)
    encrypted.with_suffix(encrypted.suffix + '.sha256').write_text(
        checksum + '  ' + encrypted.name + '\n', encoding='utf-8')
    return {'status': 'encrypted', 'archive': str(encrypted), 'sha256': checksum,
            'collections': len(records), 'documents': sum(item['documents'] for item in records)}


def restore_backup(encrypted, scratch, port):
    uri, database = restore_target(port)
    plain = scratch / 'backup.tar'
    gpg_home = scratch / 'gnupg'
    gpg_home.mkdir(mode=0o700)
    run_tool(['gpg', '--homedir', str(gpg_home), '--batch', '--pinentry-mode', 'loopback',
              '--no-symkey-cache', '--passphrase-fd', '0', '--decrypt', '--output', str(plain),
              str(encrypted)], input_bytes=passphrase())
    total = 0
    seen = set()
    with tarfile.open(plain, 'r:') as archive:
        for member in archive:
            validate_member(member)
            if member.name in seen:
                raise ValueError('Duplicate backup archive member.')
            seen.add(member.name)
            total += member.size
            if total > MAX_EXTRACT_BYTES:
                raise ValueError('Restore archive exceeds the 8 GiB safety limit.')
            target = scratch.joinpath(*PurePosixPath(member.name).parts)
            if not target.resolve().is_relative_to(scratch.resolve()):
                raise ValueError('Restore path escapes its temporary directory.')
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with archive.extractfile(member) as source, target.open('xb') as destination:
                    shutil.copyfileobj(source, destination)
    manifest = json.loads((scratch / 'manifest.json').read_text(encoding='utf-8'))
    source_name = manifest.get('database', '')
    if manifest.get('formatVersion') != 1 or source_database('mongodb://127.0.0.1/' + source_name) != source_name:
        raise ValueError('Unsupported backup manifest.')
    records = manifest.get('collections', [])
    if not records or not isinstance(records, list):
        raise ValueError('Backup manifest has no collections.')
    for record in records:
        expected_path = 'dump/' + source_name + '/' + record['collection'] + '.bson'
        file = scratch / expected_path
        if (record['path'] != expected_path or not file.resolve().is_relative_to(scratch.resolve())
                or not file.is_file() or digest(file) != record['sha256']
                or count_bson(file) != record['documents']):
            raise ValueError('Backup collection integrity verification failed.')
    check = scratch / 'check.js'
    prefix = 'const target = new Mongo(' + json.dumps(uri) + ').getDB(' + json.dumps(database) + ');\n'
    check.write_text(prefix + "if(target.getCollectionNames().length) throw new Error('Restore target is not empty');\n", encoding='utf-8')
    run_tool(['mongosh', '--nodb', '--quiet', '--file', str(check)], scratch=scratch)
    run_tool(['mongorestore', '--uri=' + uri, '--dir=' + str(scratch / 'dump'),
              '--nsInclude=' + source_name + '.*', '--nsFrom=' + source_name + '.*',
              '--nsTo=' + database + '.*', '--stopOnError', '--quiet'], scratch=scratch)
    expected = {record['collection']: record['documents'] for record in records}
    check.write_text(prefix + 'const expected = ' + json.dumps(expected) + ';\n'
                     + 'for(const [name,count] of Object.entries(expected)) { '
                     + "if(Number(target.getCollection(name).countDocuments({})) !== count) throw new Error('Restored count differs'); }\n"
                     + 'print(JSON.stringify({status:"restore_verified",database:' + json.dumps(database)
                     + ',collections:Object.keys(expected).length,documents:Object.values(expected).reduce((a,b)=>a+b,0)}));\n', encoding='utf-8')
    return json.loads(run_tool(['mongosh', '--nodb', '--quiet', '--file', str(check)], scratch=scratch))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    commands.add_parser('backup').add_argument('--output', type=Path, required=True)
    restore = commands.add_parser('restore')
    restore.add_argument('--archive', type=Path, required=True)
    restore.add_argument('--port', type=int, default=27017)
    arguments = parser.parse_args()
    output = arguments.output.resolve() if arguments.command == 'backup' else arguments.archive.resolve().parent
    output.mkdir(parents=True, exist_ok=True, mode=0o700)
    scratch = Path(tempfile.mkdtemp(prefix='jobverify-backup-', dir=output)).resolve()
    if scratch.parent != output.resolve():
        raise ValueError('Unexpected backup scratch location.')
    try:
        result = (encrypt_backup(output, scratch) if arguments.command == 'backup'
                  else restore_backup(arguments.archive.resolve(strict=True), scratch, arguments.port))
        print(json.dumps(result))
    finally:
        # Validate the resolved target before every recursive cleanup, including Windows.
        if scratch.parent == output.resolve() and scratch.name.startswith('jobverify-backup-'):
            shutil.rmtree(scratch)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, RuntimeError, subprocess.SubprocessError, KeyError, TypeError, tarfile.TarError):
        print(json.dumps({'status': 'failed', 'reason': 'Backup configuration, integrity, or tool verification failed; credentials and tool output withheld.'}))
        raise SystemExit(2)
