import test from 'node:test'
import assert from 'node:assert/strict'
import { run } from './script.js'
import { replay, mutateJSON, mutateHTML, fixture } from '../../scraper-support/native-sources/declaredJobFeeds/fixtureReplay.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const profile = fixture.profiles.contrastsecurity
const editText = (p, change) => ({...p,bodyBase64:Buffer.from(change(Buffer.from(p.bodyBase64,'base64').toString('utf8'))).toString('base64')})
globalThis.fetch = async () => { throw Error('Offline original-entity tests prohibit all network') }
test('current company, native board and API empty observations remain discovery-only', async () => {
  const r = replay(), jobs = await run(r.options), audit = r.audits[0]
  assert.equal(jobs.length,0);assert.equal(audit.opening.qualified,true);assert.equal(audit.closing.qualified,true)
  assert.deepEqual(audit.observations,[]);assert.equal(audit.authoritativeSourceTotal,null)
  assert.equal(readInventoryEvidence(jobs).status,'discovery-only');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for (const [name, change] of [
  ['inert corporate',(url,p)=>url===profile.primaryURL?editText(p,html=>'<div inert>'+html+'</div>'):p],
  ['hidden career handoff',(url,p)=>url===profile.primaryPages[1]?editText(p,html=>'<div hidden>'+html+'</div>'):p],
  ['wrong native employer',(url,p)=>url===profile.boardURL?mutateHTML(p,data=>{data.organization.name='Other Company'}):p],
  ['wrong native tenant',(url,p)=>url===profile.boardURL?mutateHTML(p,data=>{data.organization.hostedJobsPageSlug='other'}):p],
  ['inert native preload',(url,p)=>url===profile.boardURL?editText(p,html=>'<template>'+html+'</template>'):p],
  ['conditional native preload',(url,p)=>url===profile.boardURL?editText(p,html=>html.replace('window.__appData =','if(false) window.__appData =')):p],
  ['HTTP202',(url,p)=>url===profile.publicAPIURL?{...p,status:202}:p],
  ['redirected tenant',(url,p)=>url===profile.publicAPIURL?{...p,url:'https://api.ashbyhq.com/posting-api/job-board/other?includeCompensation=true'}:p],
  ['error envelope',(url,p)=>url===profile.publicAPIURL?mutateJSON(p,data=>{data.success=false}):p],
  ['unknown API version',(url,p)=>url===profile.publicAPIURL?mutateJSON(p,data=>{data.apiVersion='2'}):p],
  ['future malformed native identity',(url,p)=>url===profile.publicAPIURL?mutateJSON(p,data=>{data.jobs=[{id:'malformed'}]}):p]
]) test('holds '+name+' without source-zero authority',async()=>{
  const r=replay(change),jobs=await run(r.options),audit=r.audits[0]
  assert.equal(audit.opening.qualified,false);assert.equal(audit.closing.qualified,false)
  assert.equal(jobs.length,0);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.authoritativeSourceTotal,null)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('closing native inventory drift retains the opening original and cannot inherit earlier zero',async()=>{
  const r=replay((url,p,visit)=>url===profile.publicAPIURL&&visit===2?mutateJSON(p,data=>{data.jobs=[{id:'new-role'}]}):p)
  await run(r.options);assert.equal(r.audits[0].opening.qualified,true);assert.equal(r.audits[0].closing.qualified,false)
  assert.deepEqual(r.audits[0].opening.originalNativeFeed.jobs,[])
})
test('zero candidate cap still audits the complete channel; cancellation rejects before GET',async()=>{
  const r=replay();await run({...r.options,maxJobs:0});assert.equal(r.audits[0].closing.qualified,true)
  const c=replay();await assert.rejects(run({...c.options,signal:AbortSignal.abort(Error('cancelled'))}),/cancelled/);assert.equal(c.requests.length,0)
})
