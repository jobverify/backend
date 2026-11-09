import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';

const id='00000000-0000-0000-0000-000000000091';
const keys=['scraper','rewrite','classification'];
const readBundle=async bundle=>{
  const chunks=[];
  for await(const chunk of bundle.stream)chunks.push(chunk);
  return JSZip.loadAsync(Buffer.concat(chunks));
};

for(const stage of keys){
  test(`${stage} combined download excludes every other stage`,async t=>{
    const {createPipelineBundle}=await import('../src/pipeline/download.js');
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'pipeline-stage-test-'));
    t.after(()=>fs.rm(root,{recursive:true,force:true}));
    await fs.mkdir(path.join(root,'.cache/pipeline/logs'),{recursive:true});
    for(const key of keys){
      await fs.writeFile(path.join(root,'.cache/pipeline/logs',`${id}-${key}.log`),`${key} log`);
      await fs.writeFile(path.join(root,'.cache/pipeline',`${id}-${key}.json`),'{}');
    }
    const bundle=await createPipelineBundle({_id:id,target:'local',status:'running',stages:keys.map(key=>({key,status:'completed',summary:{completed:7}}))},{root,stage});
    t.after(bundle.cleanup);
    const zip=await readBundle(bundle);
    assert.ok(zip.file(`${stage}/logs.txt`));
    assert.ok(zip.file(`${stage}/artifacts/summary.json`));
    assert.ok(zip.file(`${stage}/stage-summary.json`));
    assert.ok(Object.keys(zip.files).every(name=>name.startsWith(`${stage}/`)||['manifest.json','README.txt'].includes(name)));
    const manifest=JSON.parse(await zip.file('manifest.json').async('string'));
    assert.deepEqual(manifest.stages.map(entry=>entry.key),[stage]);
    assert.equal(manifest.kind,'all');
    assert.equal(manifest.snapshot,true);
    assert.equal(bundle.filename,`${stage==='classification'?'classify':stage}-${manifest.createdAt.replace(/[:.]/g,'-')}.zip`);
  });
}

test('unsupported stage filters are rejected',async()=>{
  const {createPipelineBundle}=await import('../src/pipeline/download.js');
  for(const stage of ['invalid','../scraper','', ['scraper','rewrite']]){
    await assert.rejects(createPipelineBundle({_id:id,target:'local',stages:[]},{stage}),{status:400});
  }
});

for(const kind of ['logs','artifacts']){
  test(`${kind} download includes only the requested local resources`,async t=>{
    const {createPipelineBundle}=await import('../src/pipeline/download.js');
    const root=await fs.mkdtemp(path.join(os.tmpdir(),'pipeline-selective-test-'));
    t.after(()=>fs.rm(root,{recursive:true,force:true}));
    await fs.mkdir(path.join(root,'.cache/pipeline/logs'),{recursive:true});
    for(const key of keys){
      await fs.writeFile(path.join(root,'.cache/pipeline/logs',`${id}-${key}.log`),'saved log');
      await fs.writeFile(path.join(root,'.cache/pipeline',`${id}-${key}.json`),'{}');
    }
    const bundle=await createPipelineBundle({_id:id,target:'local',status:'completed',stages:keys.map(key=>({key,status:'completed',summary:{completed:7}}))},{root,kind});
    t.after(bundle.cleanup);
    const zip=await readBundle(bundle);
    for(const key of keys){
      assert.equal(Boolean(zip.file(`${key}/logs.txt`)),kind==='logs');
      assert.equal(Boolean(zip.file(`${key}/artifacts/summary.json`)),kind==='artifacts');
      assert.equal(Boolean(zip.file(`${key}/stage-summary.json`)),kind==='artifacts');
    }
    const manifest=JSON.parse(await zip.file('manifest.json').async('string'));
    assert.equal(manifest.kind,kind);
    assert.equal(bundle.filename,`pipeline-${kind}-${manifest.createdAt.replace(/[:.]/g,'-')}.zip`);
    assert.ok(manifest.stages.every(stage=>stage.unavailable.length===0));
  });

  test(`${kind} GitHub download skips requests for the other resource type`,async t=>{
    const {createPipelineBundle}=await import('../src/pipeline/download.js');
    const inner=await new JSZip().file('output.txt','workflow output').generateAsync({type:'nodebuffer'});
    t.mock.method(globalThis,'fetch',async url=>{
      const parsed=new URL(url);
      if(parsed.pathname.endsWith('/logs')){
        assert.equal(kind,'logs','artifacts download must not request logs');
        return new Response(inner);
      }
      assert.equal(kind,'artifacts','logs download must not request artifacts');
      if(parsed.pathname.endsWith('/artifacts'))return Response.json({artifacts:[{id:901,name:'result',expired:false}]});
      assert.ok(parsed.pathname.endsWith('/artifacts/901/zip'));
      return new Response(inner);
    });
    const bundle=await createPipelineBundle({_id:id,target:'github',repo:'owner/repo',status:'completed',stages:[{key:'scraper',status:'completed',githubRunId:71}]},{kind,token:'test-pat'});
    t.after(bundle.cleanup);
    const zip=await readBundle(bundle);
    assert.equal(Boolean(zip.file('scraper/logs.zip')),kind==='logs');
    assert.equal(Boolean(zip.file('scraper/artifacts/901-result.zip')),kind==='artifacts');
    const manifest=JSON.parse(await zip.file('manifest.json').async('string'));
    assert.deepEqual(manifest.stages[0].unavailable,[]);
  });
}

test('unsupported archive kinds are rejected',async()=>{
  const {createPipelineBundle}=await import('../src/pipeline/download.js');
  await assert.rejects(createPipelineBundle({_id:id,target:'local',stages:[]},{kind:'invalid'}),{status:400});
});

test('local download contains complete redacted logs and only this run’s summaries',async t=>{
  const {createPipelineBundle}=await import('../src/pipeline/download.js');
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'pipeline-download-test-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,'.cache/pipeline/logs'),{recursive:true});
  const originalMkdtemp=fs.mkdtemp;
  let archiveDirectory;
  t.mock.method(fs,'mkdtemp',async prefix=>{archiveDirectory=await originalMkdtemp(prefix);return archiveDirectory;});
  for(const key of keys){
    await fs.writeFile(path.join(root,'.cache/pipeline/logs',`${id}-${key}.log`),'FIRST LINE\n'+'x'.repeat(70000)+'\nghp_secret123\nLAST LINE');
    await fs.writeFile(path.join(root,'.cache/pipeline',`${id}-${key}.json`),JSON.stringify({completed:7}));
  }
  await fs.writeFile(path.join(root,'.cache/pipeline/other-run.json'),'OTHER RUN SECRET');
  const bundle=await createPipelineBundle({_id:id,target:'local',status:'completed',stages:keys.map(key=>({key,status:'completed',summary:{completed:7}}))},{root});
  t.after(bundle.cleanup);
  const zip=await readBundle(bundle);
  for(const key of keys){
    const log=await zip.file(`${key}/logs.txt`).async('string');
    assert.ok(log.startsWith('FIRST LINE'));assert.ok(log.endsWith('LAST LINE'));assert.ok(log.length>70000);assert.ok(!log.includes('ghp_secret123'));
    assert.deepEqual(JSON.parse(await zip.file(`${key}/artifacts/summary.json`).async('string')),{completed:7});
  }
  assert.ok(!Object.keys(zip.files).some(name=>name.includes('other-run')));
  const manifest=JSON.parse(await zip.file('manifest.json').async('string'));
  assert.equal(manifest.pipelineId,id);assert.equal(manifest.stages.length,3);assert.equal(manifest.stages[0].files.length,2);
  await bundle.cleanup();await bundle.cleanup();
  await assert.rejects(fs.stat(archiveDirectory),{code:'ENOENT'});
});

test('local streaming preserves UTF-8 and redacts secrets split across read chunks',async t=>{
  const {createPipelineBundle}=await import('../src/pipeline/download.js');
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'pipeline-download-stream-test-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,'.cache/pipeline/logs'),{recursive:true});
  const text='a'.repeat(65533)+'ghp_crossChunkSecret123\n'+'Processed âœ“\r\n'.repeat(10000)+'END';
  await fs.writeFile(path.join(root,'.cache/pipeline/logs',`${id}-scraper.log`),text);
  const bundle=await createPipelineBundle({_id:id,target:'local',status:'completed',stages:[{key:'scraper',status:'completed'}]},{root});
  t.after(bundle.cleanup);
  const zip=await readBundle(bundle);
  assert.equal(await zip.file('scraper/logs.txt').async('string'),text.replace('ghp_crossChunkSecret123','[token redacted]'));
});

test('an aborted collection removes its temporary directory',async t=>{
  const {createPipelineBundle}=await import('../src/pipeline/download.js');
  const originalMkdtemp=fs.mkdtemp;
  let directory;
  t.mock.method(fs,'mkdtemp',async prefix=>{directory=await originalMkdtemp(prefix);return directory;});
  const controller=new AbortController();controller.abort();
  await assert.rejects(createPipelineBundle({_id:id,target:'local',stages:[]},{signal:controller.signal}),{name:'AbortError'});
  await assert.rejects(fs.stat(directory),{code:'ENOENT'});
});

test('GitHub download uses exact stage runs, paginates artifacts and never sends PAT to storage',async t=>{
  const {createPipelineBundle}=await import('../src/pipeline/download.js');
  const inner=await new JSZip().file('output.txt','workflow output').generateAsync({type:'nodebuffer'});
  const calls=[];
  t.mock.method(globalThis,'fetch',async(url,options={})=>{
    calls.push({url:String(url),options});const parsed=new URL(url);
    if(parsed.hostname==='storage.example'){
      assert.equal(options.headers?.Authorization,undefined);
      return new Response(inner);
    }
    assert.equal(options.headers.Authorization,'Bearer test-pat');
    const match=parsed.pathname.match(/\/runs\/(\d+)\/artifacts$/);
    if(match){
      const page=parsed.searchParams.get('page');
      const artifacts=page==='1'?Array.from({length:100},(_,i)=>({id:Number(match[1])*1000+i,name:i===0?'../../unsafe':'diagnostics',expired:i!==0})):[{id:Number(match[1])*1000+100,name:'last-page',expired:false}];
      return Response.json({total_count:101,artifacts});
    }
    return new Response(null,{status:302,headers:{Location:'https://storage.example/signed.zip'}});
  });
  const bundle=await createPipelineBundle({_id:id,target:'github',repo:'owner/repo',status:'completed',stages:keys.map((key,i)=>({key,status:'completed',githubRunId:i+71}))},{token:'test-pat'});
  t.after(bundle.cleanup);
  const zip=await readBundle(bundle);
  for(const key of keys){
    assert.ok(zip.file(`${key}/logs.zip`));
    assert.equal(Object.keys(zip.files).filter(name=>name.startsWith(`${key}/artifacts/`)&&name.endsWith('.zip')).length,2);
  }
  assert.ok(!Object.keys(zip.files).some(name=>name.includes('..')));
  for(const runId of [71,72,73]){
    assert.ok(calls.some(call=>call.url.endsWith(`/runs/${runId}/logs`)));
    assert.ok(calls.some(call=>call.url.includes(`/runs/${runId}/artifacts?per_page=100&page=2`)));
  }
  const manifest=await zip.file('manifest.json').async('string');
  assert.match(manifest,/expired/i);assert.ok(!manifest.includes('test-pat'));assert.ok(!manifest.includes('signed.zip'));
});

test('missing logs, failed GitHub downloads and unstarted stages are recorded without losing available data',async t=>{
  const {createPipelineBundle}=await import('../src/pipeline/download.js');
  t.mock.method(globalThis,'fetch',async()=>new Response(null,{status:410}));
  const bundle=await createPipelineBundle({_id:id,target:'github',repo:'owner/repo',status:'running',stages:[{key:'scraper',status:'completed',githubRunId:71},{key:'rewrite',status:'running',githubRunId:72},{key:'classification',status:'waiting'}]},{token:'test-pat'});
  t.after(bundle.cleanup);
  const zip=await readBundle(bundle);
  const manifest=JSON.parse(await zip.file('manifest.json').async('string'));
  assert.equal(manifest.snapshot,true);
  assert.ok(manifest.stages.every(stage=>stage.unavailable.length>0));
  assert.match(await zip.file('README.txt').async('string'),/manifest/i);
});
