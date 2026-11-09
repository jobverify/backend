import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import * as runtime from '../rewriting/worker.js';

const exec = promisify(execFile);

const requireNativeTools = async (t, commands) => {
  const available = await Promise.all(commands.map(command => exec(command, ['--version'], { timeout: 3000 }).then(() => true, () => false)));
  if (available.every(Boolean)) return true;
  const missing = commands.filter((_command, index) => !available[index]);
  assert.notEqual(process.env.JOB_DESCRIPTION_REWRITE_REQUIRE_NATIVE_TESTS, '1', 'Required native test tools unavailable: ' + missing.join(', '));
  t.skip('Native test tools unavailable: ' + missing.join(', '));
  return false;
};

test('runtime diagnostics fingerprint the executable and record CPU and debugger availability', async () => {
  assert.equal(typeof runtime.collectRewriteRuntimeDiagnostics, 'function', 'runtime identity collection must be available to the runner');
  const details = await runtime.collectRewriteRuntimeDiagnostics({ binary: process.execPath, nativeBacktrace: false });
  assert.equal(details.platform, process.platform);
  assert.equal(details.arch, process.arch);
  assert.equal(details.binary.sha256, createHash('sha256').update(await fs.readFile(process.execPath)).digest('hex'));
  assert.match(details.binary.version, /^v24\./);
  assert.equal(typeof details.cpu.model, 'string');
  assert.ok(Array.isArray(details.cpu.flags));
  assert.equal(details.nativeBacktrace.enabled, false);
  assert.equal(details.nativeBacktrace.reason, 'not_requested');
  assert.equal(details.environment, undefined);
});

test('an installed debugger is disabled when its actual launch preflight fails', async () => {
  const details = await runtime.collectRewriteRuntimeDiagnostics({ binary: process.execPath, nativeBacktrace: true, platform: 'linux',
    execute: async (command, args, options) => {
      if (command !== 'gdb') return exec(command, args, options);
      if (args[0] === '--version') return { stdout: 'GNU gdb fixture\n', stderr: '' };
      throw Object.assign(new Error('ptrace unavailable'), { code: 'EPERM' });
    } });
  assert.equal(details.nativeBacktrace.enabled, false);
  assert.equal(details.nativeBacktrace.reason, 'debugger_preflight_failed');
  assert.equal(details.nativeBacktrace.error.code, 'EPERM');
});

test('debugger exit success without a running-state marker cannot enable crash capture', async () => {
  const details = await runtime.collectRewriteRuntimeDiagnostics({ binary: process.execPath, nativeBacktrace: true, platform: 'linux',
    execute: async (command, args, options) => command === 'gdb' ? { stdout: 'GNU gdb fixture\n', stderr: '' } : exec(command, args, options) });
  assert.equal(details.nativeBacktrace.enabled, false);
  assert.equal(details.nativeBacktrace.reason, 'debugger_preflight_failed');
});

test('debugger capture enables only after its helper observes the inferior running', async () => {
  const details = await runtime.collectRewriteRuntimeDiagnostics({ binary: process.execPath, nativeBacktrace: true, platform: 'linux',
    execute: async (command, args, options) => {
      if (command !== 'gdb') return exec(command, args, options);
      if (args[0] !== '--version') await fs.writeFile(options.env.JOB_DESCRIPTION_NATIVE_DIAGNOSTIC_FILE,
        JSON.stringify({ pid: 123, debugger: 'gdb', state: 'running' }));
      return { stdout: 'GNU gdb fixture\n', stderr: '' };
    } });
  assert.equal(details.nativeBacktrace.enabled, true);
  assert.equal(details.nativeBacktrace.reason, 'available');
});

test('debugger preflight exercises JSON and paths with spaces before enabling capture', async () => {
  let forwarded;
  const details = await runtime.collectRewriteRuntimeDiagnostics({ binary: process.execPath, nativeBacktrace: true, platform: 'linux',
    execute: async (command, args, options) => {
      if (command !== 'gdb') return exec(command, args, options);
      if (args[0] === '--version') return { stdout: 'GNU gdb fixture\n', stderr: '' };
      forwarded = args.slice(args.indexOf('--args') + 2);
      await fs.writeFile(options.env.JOB_DESCRIPTION_NATIVE_DIAGNOSTIC_FILE,
        JSON.stringify({ pid: 123, debugger: 'gdb', state: 'running' }));
      return exec(process.execPath, forwarded, options);
    } });
  assert.equal(details.nativeBacktrace.enabled, true);
  assert.ok(forwarded.includes('{"enable_thinking":false}'));
  assert.ok(forwarded.includes('model path with spaces.gguf'));
});

test('debugger preflight disables capture if the launcher corrupts its JSON argument', async () => {
  const details = await runtime.collectRewriteRuntimeDiagnostics({ binary: process.execPath, nativeBacktrace: true, platform: 'linux',
    execute: async (command, args, options) => {
      if (command !== 'gdb') return exec(command, args, options);
      if (args[0] === '--version') return { stdout: 'GNU gdb fixture\n', stderr: '' };
      const forwarded = args.slice(args.indexOf('--args') + 2);
      const json = forwarded.indexOf('{"enable_thinking":false}');
      if (json >= 0) forwarded[json] = '\\' + forwarded[json];
      await fs.writeFile(options.env.JOB_DESCRIPTION_NATIVE_DIAGNOSTIC_FILE,
        JSON.stringify({ pid: 123, debugger: 'gdb', state: 'running' }));
      return exec(process.execPath, forwarded, options);
    } });
  assert.equal(details.nativeBacktrace.enabled, false);
  assert.equal(details.nativeBacktrace.reason, 'debugger_preflight_failed');
});

test('Linux debugger preserves JSON, spaces, empty arguments, and shell metacharacters', { skip: process.platform !== 'linux', timeout: 20000 }, async t => {
  if (!await requireNativeTools(t, ['gdb'])) return;
  const expected = ['{"enable_thinking":false}', 'model path with spaces.gguf', '\'"\\$HOME;$(false)`false`*[x]', ''];
  let observed;
  const details = await runtime.collectRewriteRuntimeDiagnostics({ binary: process.execPath, nativeBacktrace: true,
    execute: async (command, args, options) => {
      if (command !== 'gdb' || args[0] === '--version') return exec(command, args, options);
      const script = 'console.log("ARGV:" + JSON.stringify(process.argv.slice(1)))';
      const result = await exec(command, [...args.slice(0, args.indexOf('--args') + 2), '-e', script, '--', ...expected], options);
      observed = JSON.parse(result.stdout.split('\n').find(line => line.startsWith('ARGV:')).slice(5));
      return result;
    } });
  assert.equal(details.nativeBacktrace.enabled, true, JSON.stringify(details.nativeBacktrace));
  assert.deepEqual(observed, expected);
});

test('native capture handler writes bounded argument-free frames and preserves fatal status', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rewrite-native-handler-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'native.json');
  const helper = new URL('../rewriting/nativeBacktrace.py', import.meta.url);
  const script = `
import os, runpy, sys, types
from pathlib import Path
os.environ['JOB_DESCRIPTION_NATIVE_DIAGNOSTIC_FILE'] = sys.argv[1]
commands = []
class Hook:
    def connect(self, callback): self.callback = callback
class SignalEvent:
    stop_signal = 'SIGSEGV'
class Thread:
    global_num = 3
    def switch(self): pass
class Inferior:
    pid = 321
    def threads(self): return [Thread()]
def execute(command, to_string=False):
    commands.append(command)
    if command.startswith('bt '): return '#0 native_crash () at worker.cpp:42\\n' + 'frame\\n' * 20000
    if command.startswith('quit '): raise SystemExit(int(command.split()[1]))
    return ''
gdb = types.SimpleNamespace(SignalEvent=SignalEvent, execute=execute,
    events=types.SimpleNamespace(stop=Hook(), cont=Hook()),
    selected_inferior=lambda: Inferior(), selected_thread=lambda: Thread())
sys.modules['gdb'] = gdb
namespace = runpy.run_path(sys.argv[2])
gdb.events.cont.callback(None)
gdb.events.stop.callback(SignalEvent())
try: namespace['finish_rewrite_debugging']()
except SystemExit as error: status = error.code
assert status == 139, status
assert 'kill' in commands, commands
assert 'set print frame-arguments none' in commands, commands
assert 'set print entry-values no' in commands, commands
assert not any('full' in command for command in commands), commands
print(status)
`;
  const { stdout } = await exec(process.platform === 'win32' ? 'python' : 'python3', ['-c', script, file, fileURLToPath(helper)],
    { windowsHide: true, timeout: 10000 });
  assert.equal(stdout.trim(), '139');
  const details = JSON.parse(await fs.readFile(file, 'utf8'));
  assert.equal(details.signal, 'SIGSEGV');
  assert.equal(details.pid, 321);
  assert.match(details.backtrace, /native_crash/);
  assert.ok(details.backtrace.length <= 32768);
});

test('Linux debugger captures a real native crash and reports SIGSEGV as failure', { skip: process.platform !== 'linux', timeout: 20000 }, async t => {
  if (!await requireNativeTools(t, ['gdb', 'cc'])) return;
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rewrite-native-smoke-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'crash.c'), binary = path.join(directory, 'crash');
  await fs.writeFile(source, '#include <signal.h>\nint main(void) { raise(SIGSEGV); return 0; }\n');
  await exec('cc', ['-g', '-o', binary, source]);
  const logFile = path.join(directory, 'worker.log');
  await assert.rejects(runtime.startRewriteWorker({ binary, modelFile: 'fixture.gguf', nativeBacktrace: true,
    logFile, deadline: Date.now() + 10000 }), error => error.workerSignal === 'SIGSEGV'
      && error.workerFailure === 'process_exit' && error.workerDiagnostics?.native?.backtrace.includes('main'));
  const details = JSON.parse(await fs.readFile(logFile + '.native.json', 'utf8'));
  assert.equal(details.signal, 'SIGSEGV');
});
