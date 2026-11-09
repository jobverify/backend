import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {nativePageContract,roleContract,PROXY_URL,LIST_URL,jobURL,publicJobURL} from './nativeContract.js'
import {nativeFixture,nativeOptions} from './fixtures/options.js'

globalThis.fetch=()=>{throw Error('OFFLINE_NETWORK_TRIPWIRE')}
const {getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js')
const unpack=url=>JSON.parse(gunzipSync(readFileSync(url)))
const current=unpack(new URL('./test-inputs/remote-india-20261106.json.gz',import.meta.url))
const clients=unpack(new URL('../../scraper-support/tests/fixtures/turboHireBuild20261106/capture.json.gz',import.meta.url))
const actual=()=>structuredClone(current)
const role=value=>roleContract(value.row,value.dto,nativePageContract(value.page,value.row),value.proxy,value.runAt)
const changeSchema=(value,mutate)=>{value.page=value.page.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,(all,start,raw,end)=>{const p=JSON.parse(raw);mutate(p);return start+JSON.stringify(p)+end})}

test('genuine same-role full description and typed schema establish Remote India despite empty native location projection',()=>{
 const value=actual();assert.equal(value.dto.Location,'[{}]')
 const result=role(value)
 assert.equal(result.country,'India');assert.equal(result.job.location,'Remote, India');assert.equal(result.job.city,null)
 assert.equal(result.job.sourceDetailComplete,true)
 assert.match(result.job.jobDescription,/Remote \(India\)/)
 assert.match(result.job.jobDescription,/MBA\/PGDM in Human Resources/)
 assert.equal(result.job.nativeCountryEvidence.method,'same-role-visible-remote-india-and-typed-schema')
 assert.deepEqual(result.job.nativeLocationAddresses,[])
})

for(const [label,mutate]of [
 ['conflicting schema country',v=>changeSchema(v,p=>{p.jobLocation.address.addressCountry='United States'})],
 ['unknown schema country',v=>changeSchema(v,p=>{p.jobLocation.address.addressCountry='Atlantis'})],
 ['schema address introduces locality',v=>changeSchema(v,p=>{p.jobLocation.address.addressLocality='Boston, United States'})],
 ['multiple schema postings',v=>{v.page=v.page.replace('</head>',v.page.match(/<script[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/)[0]+'</head>')}],
 ['schema role title changed',v=>changeSchema(v,p=>{p.title='Another role'})],
 ['conflicting typed DTO country',v=>{v.dto.Country='US'}],
 ['foreign native address',v=>{v.row.Location=v.dto.Location='[{"Address":"Boston, United States","PlaceId":null}]'}],
 ['ambiguous empty native projections',v=>{v.row.Location=v.dto.Location='[{},{}]'}],
 ['remote country removed from all descriptions',v=>{for(const owner of [v.dto,v.proxy])for(const k of ['JobDescription','JobDescriptionV2'])owner[k]=owner[k].replace('Remote (India)','Remote');changeSchema(v,p=>{p.description=p.description.replace('Remote (India)','Remote')})}],
 ['role India location hidden',v=>{for(const k of ['JobDescription','JobDescriptionV2'])v.dto[k]=v.dto[k].replace('Remote (India)','<span hidden>Remote (India)</span>')}],
 ['remote schema country absent',v=>changeSchema(v,p=>{delete p.jobLocation.address.addressCountry})],
])test('empty projection cannot recover with '+label,()=>{const value=actual();mutate(value);assert.throws(()=>role(value))})

test('registered reader retains genuine role full criteria and closing proof without claiming company completeness',async()=>{
 const value=actual(),fixture=nativeFixture();fixture.runAt=value.runAt
 fixture.responses[PROXY_URL].body=JSON.stringify({Total:1,Result:[value.proxy]})
 fixture.responses[LIST_URL].body=JSON.stringify({Total:1,Result:[value.row]})
 fixture.responses[jobURL(value.dto.JobId)]={status:200,contentType:'text/html',body:value.page}
 fixture.responses[publicJobURL(value.dto.JobId)]={status:200,contentType:'application/json',body:JSON.stringify(value.dto)}
 for(const packet of clients.packets)if(packet.requestedUrl.startsWith('https://byteridge.turbohire.co/')&&packet.requestedUrl.endsWith('.js'))fixture.responses[packet.requestedUrl]={status:packet.status,contentType:'application/javascript',body:Buffer.from(packet.bodyBase64,'base64').toString('utf8')}
 const options=nativeOptions(()=>{},fixture),provider=getScraperCatalog().find(value=>value.source==='byteridge')
 assert.ok(provider)
 const jobs=await createCatalogScraper(provider).run(options)
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,value.dto.JobId)
 assert.equal(jobs[0].nativeRoleClosingReconciled,true)
 assert.match(jobs[0].jobDescription,/MBA\/PGDM in Human Resources/)
 assert.equal(jobs[0].nativeCollectionEvidence.unresolvedRecords,0)
 assert.equal(jobs[0].sourceScopeComplete,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(options.calls.filter(c=>c.url===publicJobURL(value.dto.JobId)).length,2)
})
