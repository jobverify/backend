"""Run only after explicit root runtime GO; Python never imports source modules."""
from pathlib import Path
import hashlib,json,os,re,subprocess,sys
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[3]
BACKEND=ROOT/'backend'
phase=sys.argv[1] if len(sys.argv)>1 else 'before'
assert re.fullmatch(r'[a-z0-9-]+',phase),phase
manifest_path=Path(sys.argv[2]).resolve() if len(sys.argv)>2 else HERE/'closure.json'
manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
sha=lambda raw:hashlib.sha256(raw).hexdigest()
paths=[BACKEND/row['path'] for row in manifest['modules']+manifest['additional_reads']]
paths += [BACKEND/name for name in manifest['absent_allowed_read_paths']]
paths += [HERE/'proof.mjs',manifest_path]
args=['node','--permission','--disallow-code-generation-from-strings','--unhandled-rejections=strict','--test-reporter=tap']
args += ['--allow-fs-read='+str(p) for p in paths]
args += [str(HERE/'proof.mjs')]
for suffix in ['stdout.txt','stderr.txt','receipt.json']:
 assert not (HERE/(phase+'.'+suffix)).exists(),phase+'.'+suffix
for row in manifest['modules']+manifest['additional_reads']:
 raw=(BACKEND/row['path']).read_bytes();assert sha(raw)==row['sha256'];assert len(raw)==row['bytes']
env={**os.environ,'NODE_OPTIONS':'','HTTP_DISPOSAL_BACKEND':str(BACKEND),'HTTP_DISPOSAL_CLOSURE':str(manifest_path)}
env.pop('NODE_TEST_CONTEXT',None)
try:
 run=subprocess.run(args,cwd=BACKEND,env=env,capture_output=True,timeout=120)
 runtime_setup_failure=None
except subprocess.TimeoutExpired as exc:
 run=subprocess.CompletedProcess(args,124,stdout=exc.stdout or b'',stderr=(exc.stderr or b'')+b'\nParent retained timeout failure after 120 seconds.\n')
 runtime_setup_failure={'kind':'parent_timeout','seconds':120}
for suffix,raw in [('stdout.txt',run.stdout),('stderr.txt',run.stderr)]:
 (HERE/(phase+'.'+suffix)).write_bytes(raw)
text=run.stdout.decode('utf-8',errors='replace')
markers=[line.split('HTTP_DISPOSAL_GROUP_A ',1)[1] for line in text.splitlines() if 'HTTP_DISPOSAL_GROUP_A ' in line]
counts={name:int(m.group(1)) if (m:=re.search(r'^# '+name+r' (\d+)$',text,re.M)) else None for name in ['tests','pass','fail','cancelled','skipped','todo']}
receipt={'arguments':args,'exitCode':run.returncode,'counts':counts,'guard':json.loads(markers[-1]) if markers else None,'stdoutSHA256':sha(run.stdout),'stderrSHA256':sha(run.stderr),'manifestSHA256':sha(manifest_path.read_bytes()),'proofSHA256':sha((HERE/'proof.mjs').read_bytes()),'applicationImportedByPython':False,'sourceOrBackendTestsEdited':False,'runtimeSetupFailure':runtime_setup_failure}
output=HERE/(phase+'.receipt.json');output.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'receipt':str(output),'receiptSHA256':sha(output.read_bytes()),'exitCode':run.returncode,'counts':counts,'guardPresent':bool(markers)}))
