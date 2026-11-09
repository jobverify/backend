import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultConfiguration, validateConfiguration, createStages, directConfiguration, stageOutcome, describeStageCompletion } from '../src/pipeline/policy.js';
import { selectClassificationDescription } from '../src/services/classificationDescription.js';
import { buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';

test('all permutations and enabled subsets preserve configured order', () => {
  const permutations = a => a.length ? a.flatMap((v,i) => permutations(a.filter((_,j)=>j!==i)).map(rest=>[v,...rest])) : [[]];
  for (const order of permutations(['scraper','rewrite','classification'])) for (let mask=1;mask<8;mask++) {
    const stages=order.map((key,i)=>({key,enabled:Boolean(mask & (1<<i))}));
    assert.deepEqual(createStages(validateConfiguration({stages})).map(s=>s.key),order);
    assert.deepEqual(createStages({stages}).filter(s=>s.status==='waiting').map(s=>s.key),stages.filter(s=>s.enabled).map(s=>s.key));
  }
  for (const stages of [[], [{key:'scraper',enabled:true}], defaultConfiguration().stages.map(s=>({...s,enabled:false})), [{key:'scraper',enabled:true},{key:'scraper',enabled:true},{key:'rewrite',enabled:true}]]) assert.throws(()=>validateConfiguration({stages}));
});
test('direct GitHub starts use the fixed suffix and ignore admin configuration', () => {
  assert.deepEqual(directConfiguration('rewrite').stages.filter(s=>s.enabled).map(s=>s.key),['rewrite','classification']);
  assert.equal(createStages(defaultConfiguration()).filter(s=>s.status==='waiting').length,3);
});

test('a rewrite budget handoff is explicitly reported as unfinished processing', () => {
  const summary = describeStageCompletion('rewrite', { queued: 24877, attempted: 451, published: 19,
    failed: 431, skipped: 30, pendingEstimate: 24397, interrupted: true, budgetExhausted: true,
    stopReason: 'budget_exhausted' }, 'completed');
  assert.equal(summary.handoffReady, true);
  assert.equal(summary.processingComplete, false);
  assert.equal(summary.unpublishedEstimate, 24858);
  assert.equal(summary.pendingEstimate, 24397);
  for (const stop of [{ stopReason: 'budget_exhausted' }, { reason: 'workflow_budget_exhausted' }]) {
    assert.equal(describeStageCompletion('rewrite', stop, stageOutcome('rewrite', stop, 0)).processingComplete, false);
  }
});
test('outcomes stop execution errors or unfinished work and accept individual rewrite failures', () => {
  assert.equal(stageOutcome('rewrite',{queued:0,reason:'empty_queue'},0),'completed');
  assert.equal(stageOutcome('rewrite',{skipped:5},0),'completed');
  assert.equal(stageOutcome('rewrite',{failed:1},0),'completed');
  assert.equal(stageOutcome('rewrite',{pendingEstimate:1},0),'incomplete');
  assert.equal(stageOutcome('classification',{budgetExhausted:true},1),'incomplete');
  assert.equal(stageOutcome('scraper',{},1),'failed');
  assert.equal(stageOutcome('rewrite',{reason:'interrupted'},0),'incomplete');
});

test('scraper and rewrite item failures do not hide failed execution', () => {
  assert.equal(stageOutcome('scraper',{failed:2,warnings:315},0),'completed');
  assert.equal(stageOutcome('scraper',{failed:4654,warnings:4654},0),'completed');
  assert.equal(stageOutcome('scraper',{failed:2,warnings:315},1),'failed');
  assert.equal(stageOutcome('scraper',{failed:2,pendingEstimate:1},0),'incomplete');
  assert.equal(stageOutcome('scraper',{failed:2,interrupted:true},0),'incomplete');
  assert.equal(stageOutcome('scraper',{reason:'worker_error'},0),'failed');
  assert.equal(stageOutcome('rewrite',{failed:1,warnings:1},0),'completed');
  assert.equal(stageOutcome('classification',{failed:1,warnings:1},0),'failed');
});

test('a scraper code failure overrides simultaneous pending operational work', () => {
  assert.equal(stageOutcome('scraper', { pendingEstimate: 1 }, 1), 'failed');
  assert.equal(stageOutcome('scraper', { pendingEstimate: 1 }, 0), 'incomplete');
  const summary = describeStageCompletion('scraper', { pendingEstimate: 1 }, 'incomplete');
  assert.equal(summary.handoffReady, false);
  assert.equal(summary.processingComplete, false);
});

test('rewrite item failures and source races are non-blocking while execution errors stop the stage', () => {
  for (const summary of [{ failed: 3103 }, { staleSources: 2 }, { concurrentChanges: 1 }]) {
    assert.equal(stageOutcome('rewrite', { ...summary, pendingEstimate: 0 }, 0), 'completed');
  }
  assert.equal(stageOutcome('rewrite', { failed: 1 }, 1), 'failed');
  assert.equal(stageOutcome('rewrite', { failed: 1, reason: 'worker_error' }, 0), 'failed');
  assert.equal(stageOutcome('rewrite', { reason: 'worker_error', pendingEstimate: 2 }, 1), 'failed');
  assert.equal(stageOutcome('rewrite', { failed: 1, pendingEstimate: 2 }, 0), 'incomplete');
});

test('a normal rewrite budget stop hands off pending work without hiding real errors or cancellation', () => {
  const summary = { interrupted: true, budgetExhausted: true, stopReason: 'budget_exhausted',
    pendingEstimate: 19446, failed: 34, published: 2 };
  assert.equal(stageOutcome('rewrite', summary, 0), 'completed');
  assert.equal(stageOutcome('rewrite', { reason: 'workflow_budget_exhausted' }, 0), 'completed');
  assert.equal(stageOutcome('rewrite', summary, 1), 'failed');
  assert.equal(stageOutcome('rewrite', { ...summary, errorType: 'MongoServerError' }, 0), 'failed');
  assert.equal(stageOutcome('rewrite', { ...summary, reason: 'worker_error' }, 0), 'failed');
  assert.equal(stageOutcome('rewrite', { ...summary, cancelled: true, stopReason: 'cancelled' }, 0), 'incomplete');
  assert.equal(stageOutcome('classification', summary, 0), 'incomplete');
});
test('classification uses only a current published rewrite with original fallback and identity', () => {
  const original={sourceDescription:'Employer original',description:'Validated rewrite'};
  original.sourceContentHash=buildRewriteInput(original).inputHash;
  original.descriptionRewrite={status:'published',inputHash:original.sourceContentHash,policyVersion:'v1'};
  const selected=selectClassificationDescription(original);
  assert.equal(selected.text,'Validated rewrite'); assert.equal(selected.origin,'rewrite');
  assert.equal(selectClassificationDescription({...original,sourceContentHash:'changed'}).text,'Employer original');
  assert.equal(selectClassificationDescription({...original,sourceDescription:'Edited employer original'}).text,'Edited employer original');
  assert.equal(selectClassificationDescription({...original,description:'  '}).text,'Employer original');
  assert.equal(selectClassificationDescription({...original,descriptionRewrite:{status:'skipped'}}).origin,'source');
  assert.equal(selectClassificationDescription({...original,descriptionRewrite:{status:'failed'}}).text,'Employer original');
});
