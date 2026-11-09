import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {evaluateLocalJobs,archiveJobSnapshot} from '../rewriting/localEvaluation.js';
import {buildRewriteInput} from '../src/services/jobDescriptionPolicy.js';import {buildSourceFacts} from '../rewriting/factPlan.js';
const job={title:'Engineer',company:'Example',description:'Responsibilities: Build reliable Python applications for customer services. Required qualifications: At least 2 years of software development experience is required. Preferred qualifications: AWS knowledge is nice to have.'};
const setup=async t=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'description-evaluation-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;};
const client=()=>({format:'fact-plan',generate:async input=>({value:{categories:buildSourceFacts(input).map(f=>f.section??9),overview:null},finishReason:'stop'})});
test('unchanged local sources reuse stored output and changed sources invoke generation',async t=>{const outputDir=await setup(t);const first=await evaluateLocalJobs([job],{outputDir,policyIdentity:'policy-a',client:client(),deadline:Date.now()+10000});assert.equal(first.generated,1);assert.equal(first.accepted,1);const noGenerate={generate:async()=>{throw Error('unchanged input must not generate');}};const second=await evaluateLocalJobs([job],{outputDir,policyIdentity:'policy-a',client:noGenerate,deadline:Date.now()+10000});assert.equal(second.cached,1);const changed=await evaluateLocalJobs([{...job,description:job.description.replace('2 years','3 years')}],{outputDir,policyIdentity:'policy-a',client:client(),deadline:Date.now()+10000});assert.equal(changed.generated,1);});
test('policy changes cannot reuse an older model judgment',async t=>{const outputDir=await setup(t);await evaluateLocalJobs([job],{outputDir,policyIdentity:'old',client:client(),deadline:Date.now()+10000});const result=await evaluateLocalJobs([job],{outputDir,policyIdentity:'new',client:client(),deadline:Date.now()+10000});assert.equal(result.cached,0);assert.equal(result.generated,1);});
test('interruption leaves the in-flight source uncached for the next run',async t=>{const outputDir=await setup(t),controller=new AbortController();const result=await evaluateLocalJobs([job],{outputDir,policyIdentity:'a',signal:controller.signal,deadline:Date.now()+10000,client:{generate:async()=>{controller.abort();throw new DOMException('stop','AbortError');}}});assert.equal(result.interrupted,true);assert.equal((await fs.readdir(outputDir)).filter(n=>n.endsWith('.json')).length,0);const resumed=await evaluateLocalJobs([job],{outputDir,policyIdentity:'a',client:client(),deadline:Date.now()+10000});assert.equal(resumed.generated,1);});

test('corrupted interrupted snapshot is rebuilt atomically from the completed source file',async t=>{const dir=await setup(t),source=path.join(dir,'source.json'),snapshot=path.join(dir,'snapshot.json');await fs.writeFile(source,JSON.stringify([job]));await fs.writeFile(snapshot,'[{"title":');const jobs=await archiveJobSnapshot(source,snapshot);assert.equal(jobs[0].title,'Engineer');assert.deepEqual(JSON.parse(await fs.readFile(snapshot,'utf8')),jobs);assert.equal((await fs.readdir(dir)).filter(n=>n.endsWith('.tmp')).length,0);});

test('local prose reports preserve the actual validation failure and completion preview', async t => {
 const outputDir = await setup(t);
 let row;
 await evaluateLocalJobs([job], { outputDir, policyIdentity: 'prose-failure', deadline: Date.now() + 10000,
  client: { format: 'prose', generate: async () => ({ format: 'prose', value: null, finishReason: 'stop',
   rawText: '{"text":"At least 10 years."}', validationFailure: { ok: false, reason: 'numeric_relationship_changed' } }) },
  onResult: result => { row = result; } });
 assert.equal(row.reason, 'numeric_relationship_changed');
 assert.match(row.completionPreview, /10 years/);
 assert.equal(row.accepted, false);
});

test('local reports preserve partial stream previews from thrown generation errors', async t => {
 const outputDir=await setup(t); let row;
 await evaluateLocalJobs([job], {outputDir,policyIdentity:'broken-stream',deadline:Date.now()+10000,
  client:{generate:async()=>{throw Object.assign(new Error('incomplete stream'),{rawText:'{"text":"partial output',usage:{completion_tokens:4}});}},
  onResult:result=>{row=result;}});
 assert.equal(row.completionPreview,'{"text":"partial output');
 assert.equal(row.usage.completion_tokens,4);
});
