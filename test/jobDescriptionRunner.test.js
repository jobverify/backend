import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRewriteClient as createProductionRewriteClient, rewriteCandidates, rewriteDeadline } from '../rewriting/runner.js';
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
// Preserve explicit compact-protocol coverage; Qwen sections have their own integration coverage.
const createRewriteClient = options => createProductionRewriteClient({ format: 'fact-plan', ...options });

const source = 'Role overview: Build Python services for customer applications. Responsibilities: Design reliable APIs and maintain Python services. Required qualifications: At least 2 years of software development experience is required. Preferred qualifications: AWS experience is nice to have.';
const job = { _id: 'job1', title: 'Software Engineer', company: 'Example', sourceDescription: source, status: 'active', descriptionRewrite: { status: 'pending', attempts: 0 } };
job.descriptionRewrite.inputHash = buildRewriteInput(job).inputHash;
const valid = { sections: [['overview', 'Build Python services for customer applications.'], ['responsibilities', 'Design reliable APIs and maintain Python services.'], ['required_qualifications', 'At least 2 years of software development experience is required.'], ['preferred', 'AWS experience is nice to have.']].map(([key, text]) => ({ key, items: [{ text, evidence: text, style: 'paragraph' }] })) };

test('local generation uses structured output and detects truncated HTTP completions', async t => {
  let request;
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part;
    request = JSON.parse(body);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: JSON.stringify(valid) } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const client = createRewriteClient({ endpoint: 'http://127.0.0.1:' + server.address().port, model: 'test-model' });
  const output = await client.generate(buildRewriteInput(job));
  assert.equal(output.finishReason, 'length');
  assert.equal(request.response_format.type, 'json_schema');
  assert.equal(request.model, 'test-model');
  assert.equal(request.stream, true);
  assert.equal(request.response_format.json_schema.schema.properties.categories.maxItems, 0);
  assert.doesNotMatch(JSON.stringify(request.messages), /API_KEY/);
});

test('generation client rejects non-local endpoints', () => {
  assert.throws(() => createRewriteClient({ endpoint: 'https://example.com' }), /127\.0\.0\.1/);
});

test('the explicit legacy LFM client uses compact decisions and preserves source facts when publishing', async t => {
  let requestedModel;
  let request;
  const server = http.createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part;
    request = JSON.parse(body);
    requestedModel = request.model;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ categories: [], overviewFactId: 0 }) } }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  let saved;
  const client = createProductionRewriteClient({ endpoint: 'http://127.0.0.1:' + server.address().port, format: 'fact-plan' });
  const stats = await rewriteCandidates([{ ...job, sourceContentHash: job.descriptionRewrite.inputHash }], {
    client, deadline: Date.now() + 10000,
    update: async (_filter, values) => { saved = values; return { matchedCount: 1 }; },
  });
  assert.equal(requestedModel, 'job-description-lfm');
  assert.equal(client.format, 'fact-plan');
  assert.equal(request.max_tokens, 768);
  assert.equal(request.response_format.json_schema.schema.properties.categories.maxItems, 0);
  assert.equal(stats.published, 1);
  assert.match(saved.$set.description, /At least 2 years of software development experience is required/);
  assert.match(saved.$set.description, /AWS experience is nice to have/);
  assert.equal(saved.$set.sourceDescription, undefined);
});

test('run budget respects the workflow deadline and cleanup reserve', () => {
  assert.equal(rewriteDeadline({ now: 100000, budgetSeconds: 1200, workflowStartedAt: new Date(0).toISOString(), workflowSeconds: 150, cleanupSeconds: 20 }), 130000);
  assert.equal(rewriteDeadline({ now: 100000, budgetSeconds: 0 }), 100000);
});

test('publishing is guarded by current source hash and never modifies source or filter fields', async () => {
  const input = buildRewriteInput(job), stored = { ...job, sourceContentHash: input.inputHash };
  let update;
  const stats = await rewriteCandidates([stored], {
    client: { generate: async () => ({ value: valid, finishReason: 'stop' }) },
    update: async (filter, values) => { update = { filter, values }; return { matchedCount: 1 }; }, deadline: Date.now() + 10000,
  });
  assert.equal(stats.published, 1);
  assert.equal(update.filter.sourceContentHash, input.inputHash);
  assert.equal(update.filter.status, 'active');
  assert.equal(update.values.$set.descriptionFormat, 'markdown');
  assert.match(update.values.$set.description, /## Role overview/);
  assert.equal(update.values.$set.sourceDescription, undefined);
  assert.equal(update.values.$set.experienceYears, undefined);
});

test('a concurrent source change skips publication', async () => {
  const stored = { ...job, sourceContentHash: buildRewriteInput(job).inputHash };
  const results = [];
  const stats = await rewriteCandidates([stored], { client: { generate: async () => ({ value: valid, finishReason: 'stop' }) }, update: async () => ({ matchedCount: 0 }), deadline: Date.now() + 10000,
    onResult: result => results.push(result) });
  assert.equal(stats.published, 0);
  assert.equal(stats.concurrentChanges, 1);
  assert.equal(results[0].published, false);
});

test('failed or truncated generation retains the visible source description and records failure', async () => {
  const stored = { ...job, sourceContentHash: buildRewriteInput(job).inputHash };
  let update;
  const stats = await rewriteCandidates([stored], { client: { generate: async () => ({ value: valid, finishReason: 'length' }) }, update: async (filter, values) => { update = values; return { matchedCount: 1 }; }, deadline: Date.now() + 10000 });
  assert.equal(stats.failed, 1);
  assert.equal(update.$set['descriptionRewrite.reason'], 'truncated');
  assert.equal(update.$set.description, undefined);
});

test('exhausted budget and cancellation leave unprocessed jobs pending', async () => {
  const stored = { ...job, sourceContentHash: buildRewriteInput(job).inputHash };
  const update = async () => { throw new Error('must not update'); };
  const client = { generate: async () => { throw new Error('must not generate'); } };
  assert.equal((await rewriteCandidates([stored], { client, update, deadline: Date.now() - 1 })).attempted, 0);
  const controller = new AbortController(); controller.abort();
  assert.equal((await rewriteCandidates([stored], { client, update, deadline: Date.now() + 10000, signal: controller.signal })).attempted, 0);
});


test('local HTTP timeout never produces a completion eligible for publication', async t => {
  const server = http.createServer((req, res) => { req.resume(); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const client = createRewriteClient({ endpoint: 'http://127.0.0.1:' + server.address().port, requestMs: 25 });
  await assert.rejects(client.generate(buildRewriteInput(job)), error => error.name === 'TimeoutError');
});

test('interruption during generation leaves the current candidate pending', async () => {
  const controller = new AbortController();
  const candidate = { ...job, sourceContentHash: buildRewriteInput(job).inputHash };
  const stats = await rewriteCandidates([candidate], { signal: controller.signal, deadline: Date.now() + 10000,
    client: { generate: async () => { controller.abort(); throw new DOMException('Interrupted', 'AbortError'); } },
    update: async () => { throw new Error('must not update'); },
  });
  assert.equal(stats.interrupted, true);
  assert.equal(stats.published + stats.failed, 0);
});

test('streamed completion handles split UTF-8 chunks and spaced DONE without losing finish status', async t => {
  const server=http.createServer(async(req,res)=>{
    let body='';for await(const part of req)body+=part;
    // Always respond so a wrong request fails at the client boundary.
    res.setHeader('Content-Type','text/event-stream');
    const frames=['data: '+JSON.stringify({choices:[{delta:{content:'{"categories":['},finish_reason:null}]}),'data: '+JSON.stringify({choices:[{delta:{content:'7,1]}'},finish_reason:null}]}),'data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}],usage:{completion_tokens:9}}),'data:   [DONE]'];
    const payload=frames.join('\r\n\r\n')+'\r\n\r\n';
    for(let n=0;n<payload.length;n+=7)res.write(payload.slice(n,n+7));res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const output=await createRewriteClient({endpoint:'http://127.0.0.1:'+server.address().port}).generate(buildRewriteInput(job));
  assert.deepEqual(output.rawValue,{categories:[7,1]});assert.equal(output.finishReason,'stop');assert.equal(output.usage.completion_tokens,9);
});
test('closed partial stream never invents a successful stop completion',async t=>{
 const server=http.createServer((req,res)=>{req.resume();res.setHeader('Content-Type','text/event-stream');res.end('data: '+JSON.stringify({choices:[{delta:{content:'{"categories":['},finish_reason:null}]})+'\n\n');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 await assert.rejects(createRewriteClient({endpoint:'http://127.0.0.1:'+server.address().port}).generate(buildRewriteInput(job)),/incomplete|Malformed/);
});

test('already structured source is skipped before inference and is never retried as a model failure',async()=>{
 const source='<h2>Responsibilities</h2><ul><li>Build reliable Python services and collaborate with developers to deliver software applications.</li></ul><h2>Requirements</h2><ul><li>At least 2 years of software development experience is required for this engineering role.</li></ul>';
 const x={...job,sourceDescription:source,descriptionRewrite:{status:'pending',attempts:0}};x.sourceContentHash=buildRewriteInput(x).inputHash;x.descriptionRewrite.inputHash=x.sourceContentHash;let saved;
 const stats=await rewriteCandidates([x],{client:{format:'fact-plan',generate:async()=>{throw Error('must not generate');}},update:async(filter,values)=>{saved=values;return {matchedCount:1};},deadline:Date.now()+10000});assert.equal(stats.attempted,0);assert.equal(stats.skipped,1);assert.equal(saved.$set['descriptionRewrite.status'],'skipped');assert.equal(saved.$set['descriptionRewrite.reason'],'already_structured');assert.equal(saved.$set.description,undefined);
});

test('identical compact requests reuse inference but reconstruct changed salary from its own source',async t=>{
 let requests=0;const server=http.createServer(async(req,res)=>{for await(const part of req){}requests++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({categories:[],overviewFactId:0})}}]}));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const client=createRewriteClient({endpoint:'http://127.0.0.1:'+server.address().port});const a=buildRewriteInput({...job,sourceDescription:source+' Employment details: Salary: INR 321,000 per year.'}),b=buildRewriteInput({...job,sourceDescription:source+' Employment details: Salary: INR 999,000 per year.'});const first=await client.generate(a),second=await client.generate(b);const {validateFactPlan}=await import('../rewriting/factPlan.js');assert.equal(requests,1);assert.equal(second.cachedModelPlan,true);assert.match(validateFactPlan(first.value,a,first.finishReason).description,/321,000/);const changed=validateFactPlan(second.value,b,second.finishReason);assert.match(changed.description,/999,000/);assert.doesNotMatch(changed.description,/321,000/);
});

test('stale source hashes remain pending and are reported separately from persisted skips',async()=>{const {buildRewriteInput}=await import('../src/services/jobDescriptionPolicy.js');const job={_id:'stale',status:'active',title:'Engineer',company:'Example',sourceDescription:'Responsibilities: Build and maintain reliable applications for customers and collaborate with engineering teams on software delivery. Requirements: A Computer Science degree or equivalent experience is required.'};const input=buildRewriteInput(job);job.sourceContentHash='older-source-hash';job.descriptionRewrite={status:'pending',inputHash:input.inputHash,attempts:0};let updates=0;const stats=await rewriteCandidates([job],{client:{generate:async()=>{throw Error('must not generate');}},update:async()=>{updates++;return {matchedCount:1};},deadline:Date.now()+10000});assert.equal(updates,0);assert.equal(stats.staleSources,1);assert.equal(stats.skipped,0);});

test('compact disk plans survive client restart and reconstruct changed source salary',async t=>{const fs=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path');const dir=await fs.mkdtemp(path.join(os.tmpdir(),'job-description-plan-cache-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));let calls=0;const server=http.createServer((req,res)=>{calls++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({categories:[],overviewFactId:0})}}]}));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const options={endpoint:'http://127.0.0.1:'+server.address().port,model:'test',planCacheDir:dir};const a=buildRewriteInput({...job,salary:'INR 321,000 per year'}),b=buildRewriteInput({...job,salary:'INR 400,000 per year'});await createRewriteClient(options).generate(a);const second=await createRewriteClient(options).generate(b);assert.equal(calls,1);assert.equal(second.cachedModelPlan,true);assert.equal(second.cacheSource,'disk');const {validateFactPlan}=await import('../rewriting/factPlan.js');const result=validateFactPlan(second.value,b,'stop');assert.equal(result.ok,true);assert.match(result.description,/INR 400,000/);assert.doesNotMatch(result.description,/INR 321,000/);const files=await fs.readdir(dir);assert.equal(files.length,1);const content=await fs.readFile(path.join(dir,files[0]),'utf8');assert.doesNotMatch(content,/Build Python|321,000|400,000/);const value=JSON.parse(content);value.requestHash='wrong';await fs.writeFile(path.join(dir,files[0]),JSON.stringify(value));await createRewriteClient(options).generate(b);assert.equal(calls,2);});
