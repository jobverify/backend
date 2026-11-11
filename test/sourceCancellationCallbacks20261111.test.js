import assert from 'node:assert/strict'
import test from 'node:test'
import {existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import mongoose from 'mongoose'
import {saveDryRunSnapshot} from '../scraper-support/utils/saveToDB.js'
import {createAshbyPairNativeScraper} from '../scraper-support/shared/ashbyPairNative20261027.js'

// Authored callback models; no native inventory, real DB or network is used.
mongoose.connect=()=>assert.fail('No database connection permitted')
mongoose.createConnection=()=>assert.fail('No database connection permitted')
const spec={source:'synthetic-callback-control',company:'Synthetic Employer',domain:'employer.example.test',token:'synthetic-callback-control',careersUrl:'https://employer.example.test/careers'}
const board='https://jobs.ashbyhq.com/'+spec.token,api='https://api.ashbyhq.com/posting-api/job-board/'+spec.token
const corporate=`<html><body>${spec.company}<script>const endpoint="${api}";</script></body></html>`
const boardBody='<html><script>window.__appData = '+JSON.stringify({organization:{name:spec.company,hostedJobsPageSlug:spec.token,publicWebsite:'https://employer.example.test',organizationId:'synthetic-control-org',isDemoOrg:false},jobBoard:{jobPostings:[]}})+'</script></html>'
const ashbyOptions={fetchText:async url=>url===spec.careersUrl?corporate:url===board?boardBody:assert.fail('Unexpected synthetic URL'),fetchJson:async()=>({apiVersion:'1',jobs:[],total:0}),now:()=> '2026-11-11T00:00:00.000Z'}
const roles=[{title:'Cloud Engineer',company:'Synthetic Employer',location:'Bengaluru, India',sourceUrl:'https://employer.example.test/roles/100',applyUrl:'https://employer.example.test/roles/100'}]
for(const [kind,value]of[['null',null],['false',false],['zero',0],['empty',''],['frozen',Object.freeze(Error('Frozen synthetic cancellation'))],['native-default',undefined]]){
  const reason=AbortSignal.abort(value).reason
  for(const status of ['start','error'])test('snapshot '+status+' observer cannot replace caller cancellation: '+kind,async()=>{
    const caller=new AbortController(),replacement=Error('Observer replacement')
    const target=status==='error'?'\0':path.join(tmpdir(),'never-written-callback-'+randomUUID()+'.json')
    let observed=0
    await assert.rejects(saveDryRunSnapshot(roles,target,{enrichPublicExperience:false,signal:caller.signal,onStage:event=>{
      if(event.stage==='snapshot write'&&event.status===status){observed++;caller.abort(reason);throw replacement}
    }}),error=>error===reason)
    assert.equal(observed,1)
    if(status==='start')assert.equal(existsSync(target),false)
  })
  test('Ashby audit observer cannot replace caller cancellation: '+kind,async()=>{
    const caller=new AbortController(),replacement=Error('Audit replacement')
    await assert.rejects(createAshbyPairNativeScraper(spec).run({...ashbyOptions,signal:caller.signal,onNativeAudit:()=>{caller.abort(reason);throw replacement}}),error=>error===reason)
  })
  test('Ashby completion clock cannot replace caller cancellation: '+kind,async()=>{
    const caller=new AbortController(),replacement=Error('Clock replacement')
    await assert.rejects(createAshbyPairNativeScraper(spec).run({...ashbyOptions,signal:caller.signal,now:()=>{caller.abort(reason);throw replacement}}),error=>error===reason)
  })
}
test('snapshot non-cancellation observer errors retain their original identity',async()=>{
  const reason=Object.freeze(Error('Original observer error')),target=path.join(tmpdir(),'never-written-observer-'+randomUUID()+'.json')
  await assert.rejects(saveDryRunSnapshot(roles,target,{enrichPublicExperience:false,onStage:event=>{if(event.stage==='snapshot write'&&event.status==='start')throw reason}}),error=>error===reason)
  assert.equal(existsSync(target),false)
})
test('Ashby non-cancellation audit errors retain their original identity',async()=>{
  const reason=Object.freeze(Error('Original audit error'))
  await assert.rejects(createAshbyPairNativeScraper(spec).run({...ashbyOptions,onNativeAudit:()=>{throw reason}}),error=>error===reason)
})
test('Ashby non-cancellation clock errors retain their original identity',async()=>{
  const reason=Object.freeze(Error('Original clock error'))
  await assert.rejects(createAshbyPairNativeScraper(spec).run({...ashbyOptions,now:()=>{throw reason}}),error=>error===reason)
})
