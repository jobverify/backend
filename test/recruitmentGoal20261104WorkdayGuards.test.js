import assert from 'node:assert/strict'
import test from 'node:test'
import {runZebraNativeRecruitment} from '../scraper/zebratechnologies.workday/nativeRun.js'
import {runRocketNativeRecruitment} from '../scraper/rocketsoftware/nativeRun.js'
import {run as runRocket} from '../scraper/rocketsoftware/script.js'
import {run as runZebra} from '../scraper/zebratechnologies.workday/script.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {RECRUITMENT_OBSERVATIONS} from '../scraper-support/utils/verifiedRecruitment.js'

const description='<p>Design, develop and maintain reliable software, review technical designs, investigate production incidents, write documentation and collaborate with engineers to improve service performance.</p>'
const fixtures={zebra:{run:runZebraNativeRecruitment,company:'Zebra Technologies',employer:'Symbol Technologies India Private Limited',
 home:'https://www.zebra.com/',careers:'https://www.zebra.com/us/en/about-zebra/careers.html',board:'https://zebra.wd501.myworkdayjobs.com/Zebra_careers',prefix:'https://zebra.wd501.myworkdayjobs.com/wday/cxs/zebra/Zebra_careers'},
 rocket:{run:runRocketNativeRecruitment,company:'Rocket Software',employer:'Rocket Software',home:'https://www.rocketsoftware.com/',careers:'https://www.rocketsoftware.com/en-us/careers',
 board:'https://rocket.wd5.myworkdayjobs.com/rocket_careers',prefix:'https://rocket.wd5.myworkdayjobs.com/wday/cxs/rocket/rocket_careers'}}
const run=async(source,mutate=()=>{},changes={})=>{
 const f=fixtures[source],native={hiringOrganization:{name:f.employer},jobPostingInfo:{jobReqId:'R1',title:'Engineer',jobDescription:description,
  location:'Bengaluru, India',externalUrl:f.board+'/job/India/Engineer_R1',country:{descriptor:'India'},jobRequisitionLocation:{country:{descriptor:'India',alpha2Code:'IN'}},startDate:'2026-11-01'}}
 mutate(native)
 const calls=[],jobs=await f.run({now:()=> '2026-11-05T00:00:00Z',...changes,
  fetchPage:async url=>{calls.push(url);assert.ok([f.home,f.careers].includes(url));return {url,status:200,html:'<title>'+f.company+' Careers</title><h1>'+f.company+'</h1><a href="'+f.board+'">Search jobs</a>'}},
  fetchJson:async(url,init)=>{calls.push(url);if(url===f.prefix+'/jobs'){assert.equal(init.method,'POST');return {total:1,jobPostings:[{title:'Engineer',externalPath:'/job/India/Engineer_R1',locationsText:'Bengaluru, India',bulletFields:['R1']}],facets:[]}}
   assert.equal(url,f.prefix+'/job/India/Engineer_R1');return structuredClone(native)},
 })
 return {jobs,native,calls}
}

for(const source of Object.keys(fixtures)){
 test(source+': default native reader preserves full original role, employer, country and native dates without complete company scope',async()=>{
  const {jobs,native}=await run(source)
  assert.equal(jobs.length,1)
  assert.deepEqual(jobs[0].nativeSourceRecord,native)
  assert.deepEqual(jobs[0].nativeHiringOrganization,native.hiringOrganization)
  assert.equal(jobs[0].sourceDescription,description)
  assert.equal(jobs[0].postingDate,'2026-11-01')
  assert.equal(jobs[0].nativePostingDate,'2026-11-01')
  assert.equal(jobs[0].country,'India')
  assert.equal(jobs[0].sourceScopeComplete,false)
  assert.equal(jobs[0].lifecycleCleanupAllowed,false)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 })
 for(const [label,mutate]of [
  ['conflicting primary/requisition countries',n=>{n.jobPostingInfo.country={descriptor:'United States of America'}}],
  ['conflicting country descriptor/code',n=>{n.jobPostingInfo.country={descriptor:'India',alpha2Code:'US'}}],
  ['missing native country',n=>{delete n.jobPostingInfo.country;delete n.jobPostingInfo.jobRequisitionLocation.country}],
  ['foreign native country despite an India location label',n=>{n.jobPostingInfo.country={descriptor:'United States of America'};n.jobPostingInfo.jobRequisitionLocation.country={descriptor:'United States of America',alpha2Code:'US'}}],
  ['unrelated native employer',n=>{n.hiringOrganization.name='Other Employer'}],
  ['changed native requisition',n=>{n.jobPostingInfo.jobReqId='R2'}],
  ['missing full criteria',n=>{n.jobPostingInfo.jobDescription='<p>Apply today.</p>'}],
 ])test(source+': holds '+label,async()=>{
  const {jobs}=await run(source,mutate)
  assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].sourceScopeComplete,false)
 })
}

for(const [label,fetchText]of [
 ['HTTP 403',async()=>{throw Error('HTTP 403 corporate publisher denied')}],
 ['HTTP 200 challenge',async()=>'<title>Just a moment</title><p>Cloudflare Checking your browser</p>'],
])test('Rocket '+label+' cannot authorize the stored native account',async()=>{
 let calls=0
 await assert.rejects(runRocket({fetchText,runWorkday:async()=>{calls++;return []}}),/403|handoff is unavailable/)
 assert.equal(calls,0)
})

test('Zebra caller cancellation stops before its corporate and native requests',async()=>{
 const controller=new AbortController(),reason=Error('cancelled native collection');controller.abort(reason)
 let calls=0
 await assert.rejects(runZebra({signal:controller.signal,fetchText:async()=>{calls++;return ''},workdayRunner:async()=>{calls++;return []}}),error=>error===reason)
 assert.equal(calls,0)
})
