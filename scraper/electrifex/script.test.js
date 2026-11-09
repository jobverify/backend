import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {extractJobs, createElectrifexScraper, CAREERS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=name=>readFileSync(new URL('./fixtures/'+name,import.meta.url),'utf8')
const board=fixture('current-board.html'), capture=JSON.parse(fixture('current-capture.json'))
const fake=(overrides={})=>{
  const calls=[],seen=new Map()
  return {calls,fetchText:async url=>{
    calls.push(url);const n=(seen.get(url)||0)+1;seen.set(url,n)
    const receipt=capture.receipts.find(row=>row.url===url)
    assert.ok(receipt,'Unadvertised GET '+url)
    const value=receipt.name==='board.html'?board:fixture(receipt.name==='home.html'?'current-home.html':receipt.name)
    return overrides[url]?overrides[url](value,n):value
  }}
}
test('native POST forms bind exactly three full roles, registration keys, and unknown work country',()=>{
  const jobs=extractJobs(board)
  assert.deepEqual(jobs.map(j=>j.jobId),['60','59','56'])
  assert.equal(jobs[0].title,'Fresher Embedded Software Engineer (C/C++) JAIN Pool Drive')
  for(const job of jobs){
    assert.equal(job.country,null);assert.equal(job.location,null);assert.equal(job.requisitionId,null)
    assert.equal(job.jobIdType,'native-registration-id');assert.equal(job.postingDate,null);assert.equal(job.remoteStatus,null)
    assert.equal(job.applicationMethod,'POST');assert.equal(job.applicationContextUrl,CAREERS_URL)
    assert.ok(job.descriptionSections.Description.length>350);assert.ok(job.descriptionSections.Requirements.length>350)
    assert.match(job.descriptionSections['Application Process'],/Kochi/);assert.ok(job.requiredSkills.length>=5)
    assert.ok(job.jobDescription.includes(job.descriptionSections.Requirements))
  }
  assert.match(jobs[2].jobDescription,/KV caching/);assert.match(jobs[2].preferredQualification,/llama\.cpp/)
})
test('reconciles every current role and client before returning unknown India scope',async()=>{
  const transport=fake();let evidence
  const jobs=await createElectrifexScraper().run({...transport,minimumIntervalMs:0,maxJobs:0,onEvidence:value=>{evidence=value}})
  assert.equal(jobs.length,0);assert.equal(evidence.candidateRecords,3);assert.equal(evidence.fullHealthyGlobalRecords,3)
  assert.equal(evidence.confirmedIndiaRecords,0);assert.equal(evidence.unknownCountryRecords,3);assert.equal(evidence.globalRoles.length,3)
  assert.equal(evidence.closingReconciled,true);assert.equal(evidence.lifecycleCleanupAllowed,false)
  assert.equal(transport.calls.filter(url=>url===CAREERS_URL).length,2)
  assert.ok(transport.calls.every(url=>!url.includes('/registration_form/')))
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('ordinary hidden clients still execute while template and raw fallback clients stay inert',async()=>{
  for(const wrapper of ['hidden','inert','style="display:none"']){
    const transport=fake({[CAREERS_URL]:html=>html.replace('</body>',`<div ${wrapper}><script src="/unreviewed.js"></script></div></body>`)});let evidence
    await createElectrifexScraper().run({...transport,minimumIntervalMs:0,onEvidence:value=>{evidence=value}})
    assert.ok(evidence.reasons.some(reason=>reason.includes('client')));assert.equal(evidence.lifecycleCleanupAllowed,false)
  }
  const transport=fake({[CAREERS_URL]:html=>html.replace('</body>','<template><script src="/unreviewed.js"></script></template><noscript><script src="/unreviewed.js"></script></noscript><textarea><script src="/unreviewed.js"></script></textarea></body>')});let evidence
  await createElectrifexScraper().run({...transport,minimumIntervalMs:0,onEvidence:value=>{evidence=value}})
  assert.equal(evidence.fullHealthyGlobalRecords,3);assert.ok(!evidence.reasons.some(reason=>reason.includes('client')))
})
test('hidden cards and fake raw fallback cards cannot supply native roles',()=>{
  for(const attr of ['hidden','inert','style="display:none"','style="visibility:hidden"']) assert.equal(extractJobs(board.replace('<div class="accordion-item">',`<div class="accordion-item" ${attr}>`)).length,2)
  assert.equal(extractJobs(board.replace('<div class="accordion-item">','<div class="accordion-item" data-archive="yes">').replace('</head>','<style>[data-archive="yes"]{display:none}</style></head>')).length,2)
  const wrapped=board.replace('<div class="accordion" id="accordionExample">','<template><div class="accordion" id="accordionExample">').replace('<!-- END JOB OPENINGS -->','</template><!-- END JOB OPENINGS -->')
  assert.equal(extractJobs(wrapped).length,0)
})
test('missing tabs, mismatched registration IDs, disabled and expired rows exclude uncertain roles',()=>{
  for(const [from,to]of[
    ['id="bordered-justified-requirements-60"','id="missing-requirements-60"'],
    ['name="job_id" value="60"','name="job_id" value="61"'],
    ['type="submit" class="btn','type="submit" disabled class="btn'],
    ['We are looking','Application deadline: 2020-01-01\nWe are looking'],
  ])assert.equal(extractJobs(board.replace(from,to)).length,2)
})
test('country never comes from interview office, campaign, dropdown or custom country attributes',()=>{
  const modified=board.replace('<div class="accordion-item">','<div class="accordion-item" data-country="India">').replace('</body>','<select name="country"><option>India</option></select></body>')
  assert.ok(extractJobs(modified).every(job=>job.country===null))
})
test('closing role changes exclude that role, and unknown pagination retains partial evidence',async()=>{
  const transport=fake({[CAREERS_URL]:(html,n)=>html.replace('</body>','<a href="/?page=2" rel="next">Next jobs</a></body>').replace(n===2?'KV caching':'NO_MATCH','different caching')});let evidence
  await createElectrifexScraper().run({...transport,minimumIntervalMs:0,onEvidence:value=>{evidence=value}})
  assert.equal(evidence.fullHealthyGlobalRecords,2)
  assert.ok(evidence.reasons.some(reason=>/pagination|hiring-link/.test(reason)))
  assert.ok(evidence.reasons.some(reason=>/role-changed.*56/.test(reason)))
})
test('the first public denial stops without retries or subsequent origin requests',async()=>{
  let calls=0
  await assert.rejects(createElectrifexScraper().run({minimumIntervalMs:0,fetchImpl:async()=>{calls++;return new Response('Denied',{status:403})}}),/403/)
  assert.equal(calls,1)
})
test('changed public clients retain native data but cannot make the source complete',async()=>{
  const client=CAREERS_URL+'static/assets/js/main.js'
  const transport=fake({[client]:value=>value+'\nfetch("/unreviewed-jobs")'});let evidence
  const jobs=await createElectrifexScraper().run({...transport,minimumIntervalMs:0,onEvidence:value=>{evidence=value}})
  assert.equal(jobs.length,0);assert.equal(evidence.globalRoles.length,3)
  assert.equal(evidence.nativeClientContractVerified,false);assert.equal(evidence.fullHealthyGlobalRecords,0)
  assert.ok(evidence.reasons.some(reason=>reason.startsWith('changed-client-or-style:')))
})
test('duplicate IDs and role-owned employer conflicts exclude ambiguous records',()=>{
  assert.equal(extractJobs(board.replaceAll('59','60')).length,1)
  assert.equal(extractJobs(board.replace('We are looking','Employer: Other Company\nWe are looking')).length,2)
})
test('extra role country controls and source counters remain unresolved contracts',async()=>{
  assert.equal(extractJobs(board.replace('<input type="hidden" name="job_id" value="60">','<input type="hidden" name="job_id" value="60"><input name="country" value="India">')).length,2)
  const transport=fake({[CAREERS_URL]:value=>value.replace('</body>','<p>Total jobs: 4</p><select name="country"><option>India</option></select></body>')});let evidence
  await createElectrifexScraper().run({...transport,minimumIntervalMs:0,onEvidence:value=>{evidence=value}})
  assert.ok(evidence.reasons.some(reason=>/counter/.test(reason)))
  assert.ok(evidence.reasons.some(reason=>/inventory-control/.test(reason)))
})
test('nomodule and reordered execution attributes invalidate reviewed Bootstrap accessibility',async()=>{
  for(const attribute of ['nomodule','type="module"','async']){
    const transport=fake({[CAREERS_URL]:value=>value.replace('<script src="/static/assets/vendor/bootstrap/js/bootstrap.bundle.min.js"',`<script ${attribute} src="/static/assets/vendor/bootstrap/js/bootstrap.bundle.min.js"`)});let evidence
    await createElectrifexScraper().run({...transport,minimumIntervalMs:0,onEvidence:value=>{evidence=value}})
    assert.equal(evidence.nativeClientContractVerified,false)
    assert.equal(evidence.fullHealthyGlobalRecords,0)
    assert.ok(evidence.reasons.some(reason=>/client/.test(reason)))
  }
})
test('Bootstrap hidden cards and changed inline visibility rules cannot count as healthy native facts',async()=>{
  const stylesheets=capture.receipts.filter(row=>row.name.endsWith('.css')).map(row=>({url:row.url,body:fixture(row.name)}))
  assert.equal(extractJobs(board.replace('<div class="accordion-item">','<div class="accordion-item d-none">'),{stylesheets,revealBootstrap:true}).length,2)
  const transport=fake({[CAREERS_URL]:value=>value.replace('</head>','<style>.accordion-item:nth-child(1){display:none}</style></head>')});let evidence
  await createElectrifexScraper().run({...transport,minimumIntervalMs:0,onEvidence:value=>{evidence=value}})
  assert.equal(evidence.nativeClientContractVerified,false)
  assert.equal(evidence.fullHealthyGlobalRecords,0)
  assert.ok(evidence.reasons.some(reason=>/inline-style/.test(reason)))
})
test('fetched Bootstrap hiding declarations exclude a card while preserving the other full descriptions',async()=>{
  const transport=fake({[CAREERS_URL]:value=>value.replace('<div class="accordion-item">','<div class="accordion-item invalid-feedback">')});let evidence
  await createElectrifexScraper().run({...transport,minimumIntervalMs:0,onEvidence:value=>{evidence=value}})
  assert.equal(evidence.fullHealthyGlobalRecords,2)
  assert.deepEqual(evidence.globalRoles.map(role=>role.jobId),['59','56'])
  assert.ok(evidence.reasons.some(reason=>/hidden-native-candidate/.test(reason)))
})
test('fetched CSS ancestor selectors and cascade govern role visibility',async()=>{
  for(const [modify,ids]of[
    [value=>value.replace('<div class="accordion-item">','<div class="accordion-item error-message">').replace('<div class="accordion" id="accordionExample">','<div class="contact"><div class="php-email-form"><div class="accordion" id="accordionExample">').replace('<!-- END JOB OPENINGS -->','</div></div><!-- END JOB OPENINGS -->'),['59','56']],
    [value=>value.replace('<div class="accordion-item">','<div class="accordion-item invalid-feedback" style="display:block">'),['60','59','56']],
  ]){
    let evidence;await createElectrifexScraper().run({...fake({[CAREERS_URL]:modify}),minimumIntervalMs:0,onEvidence:value=>{evidence=value}})
    assert.deepEqual(evidence.globalRoles.map(role=>role.jobId),ids)
  }
})
test('submit overrides cannot change native registration identity or POST semantics',()=>{
  for(const attributes of ['formaction="https://other.example/apply"','formmethod="get"','form="another-form"']){
    assert.deepEqual(extractJobs(board.replace('type="submit" class="btn',`type="submit" ${attributes} class="btn`)).map(role=>role.jobId),['59','56'])
  }
  assert.equal(extractJobs(board.replace('type="submit" class="btn','type="submit" formaction="/registration_form/60" formmethod="POST" class="btn')).length,3)
})
test('visible role panel closing notices outside tabs exclude the role while hidden notices supply no status',()=>{
  const insert=value=>board.replace('<form action="/registration_form/60"',value+'<form action="/registration_form/60"')
  assert.deepEqual(extractJobs(insert('<p>Applications are closed.</p>')).map(role=>role.jobId),['59','56'])
  assert.equal(extractJobs(insert('<p hidden>Applications are closed.</p>')).length,3)
})
test('caller cancellation during the last response prevents final callbacks and preserves its exact reason',async()=>{
  const controller=new AbortController(),reason=Error('caller cancelled final Electrifex response'),transport=fake()
  let calls=0,evidenceCalls=0,responseCalls=0
  await assert.rejects(createElectrifexScraper().run({minimumIntervalMs:0,signal:controller.signal,fetchText:async url=>{
    const body=await transport.fetchText(url)
    if(++calls===48)controller.abort(reason)
    return body
  },onResponse:()=>{responseCalls++},onEvidence:()=>{evidenceCalls++}}),error=>error===reason)
  assert.equal(calls,48);assert.equal(responseCalls,47);assert.equal(evidenceCalls,0)
})
test('caller cancellation wins over an in-flight transport that ignores its signal',{timeout:2000},async()=>{
  const controller=new AbortController(),reason=Error('cancel uncooperative Electrifex transport')
  const started=Promise.withResolvers(),operation=Promise.withResolvers();let evidenceCalls=0,responseCalls=0
  const pending=createElectrifexScraper().run({minimumIntervalMs:0,signal:controller.signal,fetchText:()=>{started.resolve();return operation.promise},onEvidence:()=>{evidenceCalls++},onResponse:()=>{responseCalls++}})
  await started.promise;controller.abort(reason)
  await assert.rejects(pending,error=>error===reason)
  operation.reject(Error('late rejection must be observed'))
  await new Promise(resolve=>setImmediate(resolve))
  assert.equal(responseCalls,0);assert.equal(evidenceCalls,0)
})
