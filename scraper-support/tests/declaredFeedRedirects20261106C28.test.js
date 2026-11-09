import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {fixture,replay} from '../native-sources/declaredJobFeeds/fixtureReplay.js'
import {createDeclaredJobFeedScraper,DECLARED_JOB_FEED_PROFILES as profiles} from '../native-sources/declaredJobFeeds/nativeCareers.js'

globalThis.fetch=async()=>{throw Error('C28 redirect controls prohibit network, applications and remote programs')}
const genuine=JSON.parse(readFileSync(new URL('./fixtures/currentNative20261106C28/dagster-original-redirect.json',import.meta.url)))
const dagsterURL=profiles.dagster.primaryPages[0]
assert.equal(genuine.record.requestedUrl,dagsterURL)
assert.equal(genuine.record.status,308)
assert.equal(genuine.record.bodyUnavailable,true)
assert.equal(genuine.record.location,profiles.dagster.primaryPages[1])
const headersOnly=(url,page)=>{
 const result={...page};delete result.bodyBase64
 return result
}
const run=async(source,mutate)=>{
 const r=replay(mutate),jobs=await createDeclaredJobFeedScraper(profiles[source]).run(r.options)
 assert.equal(r.audits.length,1)
 return{jobs,audit:r.audits[0],requests:r.requests}
}

for(const phase of ['opening','closing'])test('Dagster accepts the genuine '+phase+' 308 headers without fabricating a body',async()=>{
 const wanted=phase==='opening'?1:2
 const result=await run('dagster',(url,page,visit)=>url===dagsterURL&&visit===wanted
  ?{url:genuine.record.finalUrl,status:genuine.record.status,headers:genuine.record.headers}:page)
 assert.equal(result.audit[phase].publisherQualified,true,JSON.stringify(result.audit[phase].issues))
 assert.equal(result.audit.observations.length,fixture.oracle.dagster.records.length)
 assert.ok(result.audit.observations.every(row=>row.company==='Prefect'&&row.jobDescription&&row.sourceCurrentNativePostingIdentityQualified))
 assert.ok(result.audit.rawPages.some(row=>row.url===dagsterURL&&row.bodyBase64===null&&row.status===308))
 assert.equal(result.audit.sourceScopeComplete,false)
 assert.equal(result.audit.lifecycleCleanupAllowed,false)
})

test('Delphix brand handoff accepts original redirect metadata without using a body as identity',async()=>{
 const first=profiles.delphixindia.identityPages[0]
 const result=await run('delphixindia',(url,page)=>url===first?headersOnly(url,page):page)
 assert.equal(result.audit.opening.publisherQualified,true,JSON.stringify(result.audit.opening.issues))
 assert.equal(result.audit.closing.publisherQualified,true,JSON.stringify(result.audit.closing.issues))
 assert.equal(result.audit.observations.length,fixture.oracle.delphixindia.records.length)
 assert.ok(result.audit.observations.every(row=>row.company==='Perforce'&&row.jobDescription&&row.sourceCurrentNativePostingIdentityQualified))
 assert.equal(result.jobs.length,0,'Parent-company posts are not automatically Delphix-owned vacancies')
})

for(const variant of ['missing-location','wrong-location','wrong-final-url'])test('headers-only Dagster '+variant+' stays unqualified',async()=>{
 const result=await run('dagster',(url,page)=>{
  if(url!==dagsterURL)return page
  const value=headersOnly(url,page)
  value.headers={...value.headers}
  if(variant==='missing-location')delete value.headers.location
  if(variant==='wrong-location')value.headers.location='https://other.example/careers'
  if(variant==='wrong-final-url')value.url='https://other.example/'
  return value
 })
 assert.equal(result.audit.opening.publisherQualified,false)
 assert.equal(result.audit.closing.publisherQualified,false)
 assert.equal(result.jobs.length,0)
 assert.ok(result.audit.observations.every(row=>row.sourceCurrentNativePostingIdentityQualified===false))
 assert.ok(result.requests.every(url=>!url.includes('other.example')))
})

test('body-free HTTP 200 final publisher page remains unqualified',async()=>{
 const last=profiles.dagster.primaryPages.at(-1)
 const result=await run('dagster',(url,page)=>url===last?headersOnly(url,page):page)
 assert.equal(result.audit.opening.publisherQualified,false)
 assert.equal(result.audit.closing.publisherQualified,false)
 assert.equal(result.jobs.length,0)
})

for(const status of [200,304,399])test('a body-free '+status+' response is not a redirect authority',async()=>{
 const result=await run('dagster',(url,page)=>url===dagsterURL?{...headersOnly(url,page),status}:page)
 assert.equal(result.audit.opening.publisherQualified,false)
 assert.equal(result.audit.closing.publisherQualified,false)
 assert.equal(result.jobs.length,0)
})
