import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parseExpressionAt} from 'acorn'
import * as clientProof from './publicClient.js'
import {qualifyCurrentBritanniaService} from './currentService20261128.js'
import {createBritanniaScraper,OFFICIAL_CAREERS_URL,BOARD_URL,NOAUTH_TOKEN_URL,FILTERED_JOBS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261128.json.gz',import.meta.url))))
const employerCapture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-employer-20261128.json.gz',import.meta.url))))
const currentURL='https://britannia.turbohire.co/main.4ca2a916b28913f44dec.chunk.js'
const sha256=body=>createHash('sha256').update(body).digest('hex')
const change=(body,before,after)=>{assert.ok(body.includes(before),'mutation must alter the genuine current input');assert.notEqual(before,after);return body.replace(before,after)}
const qualify=body=>clientProof.verifyBritanniaPublicClient({boardHTML:capture.board.body,fetchScript:async url=>{assert.equal(url,currentURL);return body}})
const publicMethods=body=>{
 const matches=[...body.matchAll(/class\s+[A-Za-z_$][\w$]*\{constructor\(\)\{this\.API_SERVER_BASE_URL="https:\/\/thapi-stage2\.azurewebsites\.net"/g)]
 assert.equal(matches.length,1)
 const service=parseExpressionAt(body,matches[0].index,{ecmaVersion:'latest'})
 return service.body.body.filter(method=>['constructor','getUnAuthenticatedAccessToken','getPublicOrgInfo','getPublicJobRefsForOrgFiltered','getJobInfoPublic'].includes(method.key.name)).map(method=>({name:method.key.name,source:body.slice(method.start,method.end)}))
}
const changeMethod=(name,before,after)=>{
 const method=publicMethods(capture.client.body).find(row=>row.name===name)
 assert.ok(method,'mutation requires the actual native method')
 return change(capture.client.body,method.source,change(method.source,before,after))
}
const exercise=async(mutate=(body)=>body)=>{
 const reads=[],stop=Object.assign(Error('bounded public-token endpoint sentinel'),{status:403})
 let error
 try{await createBritanniaScraper().run({requestIntervalMs:0,
  fetchText:async url=>{reads.push(url);const body=url===OFFICIAL_CAREERS_URL?capture.corporate.body:url===BOARD_URL?capture.board.body:url===currentURL?capture.client.body:null;assert.equal(typeof body,'string','only the actual current publisher handoff/client may be read');return mutate(body,url)},
  fetchJson:async url=>{reads.push(url);assert.equal(url,NOAUTH_TOKEN_URL);throw stop},
 })}catch(failure){error=failure}
 return{reads,error,stop}
}
const replayNative=async(mutate=(detail)=>detail)=>{
 const reads=[],payload=JSON.parse(employerCapture.listing.body)
 const jobs=await createBritanniaScraper().run({requestIntervalMs:0,maxJobs:3,now:()=>employerCapture.observedAt,
  fetchText:async url=>{reads.push(url);const body=url===OFFICIAL_CAREERS_URL?capture.corporate.body:url===BOARD_URL?capture.board.body:url===currentURL?capture.client.body:null;assert.equal(typeof body,'string','native replay must retain genuine first-party publisher binding');return body},
  fetchJson:async url=>{
   reads.push(url)
   if(url===NOAUTH_TOKEN_URL)return{access_token:'fixture-public-anonymous-session'}
   if(url===FILTERED_JOBS_URL)return structuredClone(payload)
   const packet=employerCapture.details.find(packet=>packet.url===url)
   assert.ok(packet,'only genuinely captured selected public detail routes may be read')
   const detail=JSON.parse(packet.body)
   return detail.JobId==='75f21b6d-272c-4a46-b00c-b9890f015f85'?mutate(detail):detail
  },
 })
 return{jobs,reads}
}

test('current Britannia advertised client has the unchanged native anonymous/listing/organization/full-role methods',()=>{
 assert.equal(capture.client.url,currentURL)
 assert.equal(Buffer.byteLength(capture.client.body),10394315)
 assert.equal(sha256(capture.client.body),'c6e9e2c42c3c58be844502081294c78a9be4285803322e2b3b432e94f3629000')
 const prior=gunzipSync(readFileSync(new URL('./test-data/deployment-20261113/main.gz',import.meta.url))).toString('utf8')
 const actual=publicMethods(capture.client.body)
 assert.equal(actual.length,5)
 assert.deepEqual(actual,publicMethods(prior))
})

test('current Britannia exact declared deployment is qualified before any public API reads',async()=>{
 const result=await qualify(capture.client.body)
 assert.deepEqual(result,{url:currentURL,sha256:capture.client.sha256,apiBaseURL:'https://thapi-stage2.azurewebsites.net'})
 const run=await exercise()
 assert.equal(run.error,run.stop)
 assert.deepEqual(run.reads,[OFFICIAL_CAREERS_URL,BOARD_URL,currentURL,NOAUTH_TOKEN_URL])
})

for(const [name,method,before,after] of [
 ['API origin','constructor','this.API_SERVER_BASE_URL="https://thapi-stage2.azurewebsites.net"','this.API_SERVER_BASE_URL="https://unreviewed.invalid"'],
 ['anonymous session JSON','getUnAuthenticatedAccessToken','return e.json()','return {access_token:"dummy"}'],
 ['listing organization and page scope','getPublicJobRefsForOrgFiltered','/api/careerpagev2/filteredjobs?orgId=${e}&pageType=${t}','/api/careerpagev2/filteredjobs?orgId=fixed&pageType=1'],
 ['listing criteria membership','getPublicJobRefsForOrgFiltered','return r()(n).then(e=>e.data.Result)','return r()(n).then(e=>[])'],
 ['full-role identity and visibility','getJobInfoPublic','/api/publicjobs?jobId=${e}&fieldVisibility=${t}','/api/publicjobs?jobId=replaced&fieldVisibility=None'],
])test('current Britannia rejects changed '+name+' before token/listing reads',async()=>{
 const changed=changeMethod(method,before,after)
 assert.throws(()=>qualifyCurrentBritanniaService(changed),/service declarations changed|binding changed/)
 await assert.rejects(qualify(changed),/current public client bytes changed/)
 const run=await exercise((body,url)=>url===currentURL?changed:body)
 assert.match(run.error.message,/current public client bytes changed/)
 assert.ok(!run.reads.includes(NOAUTH_TOKEN_URL))
})

test('current Britannia independently binds each complete native method and rejects duplicate declarations',()=>{
 assert.deepEqual(qualifyCurrentBritanniaService(capture.client.body),{
  apiBaseURL:'https://thapi-stage2.azurewebsites.net',
  publicMethods:['constructor','getUnAuthenticatedAccessToken','getPublicOrgInfo','getPublicJobRefsForOrgFiltered','getJobInfoPublic'],
 })
 const method=publicMethods(capture.client.body).find(row=>row.name==='getPublicJobRefsForOrgFiltered').source
 assert.throws(()=>qualifyCurrentBritanniaService(change(capture.client.body,method,method+method)),/service structure changed/)
 const disconnected=changeMethod('getPublicJobRefsForOrgFiltered','return r()(n).then(e=>e.data.Result)','return []/* return r()(n).then(e=>e.data.Result) */')
 assert.throws(()=>qualifyCurrentBritanniaService(disconnected),/binding changed/)
})

for(const [name,mutate] of [
 ['unreviewed declared client',body=>change(body,'main.4ca2a916b28913f44dec.chunk.js','main.00000000000000000000.chunk.js')],
 ['inert declared client',body=>change(body,'src="/main.4ca2a916b28913f44dec.chunk.js"','type="application/json" src="/main.4ca2a916b28913f44dec.chunk.js"')],
 ['duplicate declared client',body=>change(body,'</body>','<script src="/main.4ca2a916b28913f44dec.chunk.js"></script></body>')],
])test('current Britannia refuses '+name+' without fetching code',async()=>{
 let reads=0
 await assert.rejects(clientProof.verifyBritanniaPublicClient({boardHTML:mutate(capture.board.body),fetchScript:async()=>{reads++;return capture.client.body}}),/unreviewed current public client URL|missing, ambiguous or inert/)
 assert.equal(reads,0)
})

for(const [name,which,before,after] of [
 ['official employer title',BOARD_URL,'<title>Britannia Industries</title>','<title>Other Employer</title>'],
 ['corporate canonical',OFFICIAL_CAREERS_URL,'rel="canonical" href="https://www.britannia.co.in/careers"','rel="canonical" href="https://other.invalid/careers"'],
 ['corporate native organization handoff',OFFICIAL_CAREERS_URL,BOARD_URL,'https://britannia.turbohire.co/careerpage/00000000-0000-0000-0000-000000000000'],
])test('current Britannia retains '+name+' binding before API access',async()=>{
 const run=await exercise((body,url)=>url===which?change(body,before,after):body)
 assert.notEqual(run.error,run.stop)
 assert.ok(!run.reads.includes(NOAUTH_TOKEN_URL))
})

test('current Britannia same-organization legal employer alias preserves both raw names and every source-scope hold',async()=>{
 const {jobs,reads}=await replayNative()
 assert.equal(jobs.length,2,'the genuine Offered role remains withheld')
 const alias=jobs.find(job=>job.jobId==='75f21b6d-272c-4a46-b00c-b9890f015f85')
 assert.ok(alias)
 assert.equal(alias.company,'Britannia Industries')
 assert.equal(alias.nativeSourceRecord.nativeListing.OrgDetails.OrgName,'Britannia Industries')
 assert.equal(alias.nativeSourceRecord.nativeDetail.OrgDetails.OrgName,'Britannia Industries Limited')
 assert.equal(alias.nativeEmployerBinding.legalEmployer,'Britannia Industries Limited')
 assert.equal(alias.sourceDetailComplete,true)
 assert.equal(alias.country,'India')
 assert.equal(alias.nativeRoleClosingReconciled,true)
 assert.equal(alias.sourceScopeComplete,false)
 assert.equal(alias.sourceListingComplete,false)
 assert.equal(alias.lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(reads.filter(url=>url===FILTERED_JOBS_URL).length,2)
 assert.equal(reads.filter(url=>url===OFFICIAL_CAREERS_URL).length,2)
})

for(const [name,mutate,error] of [
 ['different legal employer',d=>{d.OrgDetails.OrgName='Another Employer Limited';return d},/detail role, title or employer/],
 ['different organization',d=>{d.OrgDetails.OrgID='00000000-0000-0000-0000-000000000000';return d},/detail role, title or employer/],
 ['different official corporate URL',d=>{d.OrgDetails.OrgURL='https://other.invalid/';return d},/detail role, title or employer/],
 ['different native employer subdomain',d=>{d.OrgDetails.CareerPageSubdomain='another-employer';return d},/detail role, title or employer/],
 ['different native role',d=>{d.JobId='00000000-0000-0000-0000-000000000000';return d},/detail role, title or employer/],
 ['different native application identity',d=>{d.JobIdObfuscated='different-public-application';return d},/detail role, title or employer/],
 ['different full-detail title',d=>{d.JobTitle+=' changed';return d},/detail role, title or employer/],
 ['country unavailable in native detail',d=>{d.Location='[{"Address":"Rudrapur, Uttarakhand"}]';return d},/detail workplaces contradict the listing/],
 ['publication mismatch',d=>{d.PublishedDates.CAREERPAGE='2026-01-01T00:00:00Z';return d},/publication or closing date contradicts/],
 ['closing mismatch',d=>{d.ExpiryDates.CAREERPAGE='2026-01-01T00:00:00Z';return d},/publication or closing date contradicts/],
])test('Britannia legal alias cannot admit '+name,async()=>{
 await assert.rejects(replayNative(detail=>{const before=JSON.stringify(detail),after=mutate(detail);assert.notEqual(JSON.stringify(after),before,'negative control must change actual captured detail');return after}),error)
})

for(const [name,mutate,failure] of [
 ['missing full criteria',d=>{d.JobDescription='';d.JobDescriptionV2='';return d},'missing-content'],
 ['closed native role',d=>{d.JobStatus='Closed';return d},'native-public-vacancy-status-unqualified'],
])test('Britannia legal alias retains the '+name+' hold',async()=>{
 const {jobs}=await replayNative(detail=>{const before=JSON.stringify(detail),after=mutate(detail);assert.notEqual(JSON.stringify(after),before);return after})
 assert.equal(jobs.length,1)
 assert.ok(!jobs.some(job=>job.jobId==='75f21b6d-272c-4a46-b00c-b9890f015f85'))
 assert.ok(jobs[0].nativeCollectionEvidence.failures.some(row=>row.nativeJobId==='75f21b6d-272c-4a46-b00c-b9890f015f85'&&row.failureKind===failure))
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
