import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {gunzipSync} from 'node:zlib'
globalThis.fetch=()=>{throw Error('OFFLINE ESW geography review tripwire before imports')}
const {getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js')
const {readInventoryEvidence}=await import('../../scraper-support/utils/inventoryEvidence.js')
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/registered-native-20261027.json.gz',import.meta.url))))
const USPS_SHA='0ba863b726007dc640f6f25b849830119a80f5d3056e4e5e472ce4793b2f997b'
const USPS_URL='https://pe.usps.com/text/pub28/pub28apb.htm'
async function replay(transform=response=>response){
 const responses=fixture.responses.map(r=>transform({...r})),queues=new Map(),calls=[]
 for(const r of responses){if(!queues.has(r.requestedUrl))queues.set(r.requestedUrl,[]);queues.get(r.requestedUrl).push(r)}
 let audit
 const load=async(url,options)=>{assert.equal(options.method,'GET');assert.equal(options.body,undefined);const next=queues.get(url)?.shift();assert.ok(next,'Unexpected offline URL '+url);calls.push(url);return next.body}
 const jobs=await createCatalogScraper(getScraperCatalog().find(p=>p.source==='esw')).run({fetchPage:load,fetchJson:async(u,o)=>JSON.parse(await load(u,o)),onAudit:a=>{audit=a}})
 return {jobs,audit,calls,queues,responses,evidence:readInventoryEvidence(jobs),role:audit.nativeJobs.find(j=>j.jobId==='8690613002')}
}
test('esw: official retained USPS HTML validates the exact NJ state abbreviation without a new network request',()=>{
 const bytes=fs.readFileSync(new URL('./fixtures/usps-state-abbreviations-20261027.html',import.meta.url))
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),USPS_SHA)
 const plain=bytes.toString().replace(/<[^>]*>/g,' ').replace(/\s+/g,' ')
 assert.match(plain,/New Jersey NJ/);assert.match(plain,/Colorado CO/);assert.match(plain,/Texas TX/)
})
test('esw: assigned Remote - USA preserves its explicit native US country independently of any city inference',async()=>{
 const r=await replay(),office=r.role.sourceLocations.find(l=>l.sourceField==='offices[1]')
 assert.equal(office.label,'Remote - USA');assert.deepEqual(office.countryCodes,['US']);assert.equal(office.country,'United States');assert.equal(office.unresolved,false);assert.equal(office.countryInferred,false);assert.equal(office.countryEvidence,'explicit-country-in-native-work-mode-label');assert.equal(r.role.nativeRecord.offices[1].location,null)
})
test('esw: exact job-owned Jersey City NJ receives a labelled official-reference country inference',async()=>{
 const r=await replay(),office=r.role.sourceLocations.find(l=>l.sourceField==='offices[0]')
 assert.equal(office.label,'Jersey City, NJ');assert.deepEqual(office.countryCodes,['US']);assert.equal(office.country,'United States');assert.equal(office.unresolved,false);assert.equal(office.countryInferred,true);assert.equal(office.countryEvidence,'qualified-job-owned-city-state-with-official-USPS-reference')
 assert.equal(office.countryInference.jobId,'8690613002');assert.equal(office.countryInference.nativeOfficeId,'4006080002');assert.equal(office.countryInference.nativeOfficeName,'Jersey City, NJ');assert.equal(office.countryInference.nativeOfficeLocation,null);assert.equal(office.countryInference.city,'Jersey City');assert.equal(office.countryInference.state,'New Jersey');assert.equal(office.countryInference.postalAbbreviation,'NJ');assert.equal(office.countryInference.reference.url,USPS_URL);assert.equal(office.countryInference.reference.sha256,USPS_SHA);assert.equal(office.countryInference.reference.status,200);assert.equal(r.role.nativeRecord.offices[0].location,null);assert.equal(r.role.nativeRecord.offices[0].country,undefined)
})
test('esw: reviewed geography repair closes the retained full scope after every original response and role validation',async()=>{
 const r=await replay();assert.equal(r.audit.fullContentCount,4);assert.equal(r.audit.healthyNativeCount,3);assert.equal(r.audit.nativeJobs.length,4);assert.equal(r.audit.nativeJobs.filter(j=>j.nativeRoleState==='talent-community').length,1);assert.equal(r.audit.sourceComplete,true);assert.deepEqual(r.audit.reasons,[]);assert.equal(r.evidence.listingComplete,true);assert.equal(r.evidence.reportedTotal,4);assert.equal(r.evidence.indiaFacetCount,0);assert.equal(r.jobs.length,0);assert.deepEqual(r.calls,fixture.responses.map(r=>r.requestedUrl));assert.ok([...r.queues.values()].every(q=>q.length===0));assert.ok(r.calls.includes(r.role.applyUrl),'inferred geography still validates the retained bound role page')
})
for(const label of ['Jersey City','Jersey City, ZZ','Delhi','Delhi, NJ'])test('esw: unsupported or city-only assigned office '+label+' remains unresolved',async()=>{
 const r=await replay(response=>({...response,body:response.body.replaceAll('Jersey City, NJ',label)})),office=r.role.sourceLocations.find(l=>l.sourceField==='offices[0]')
 assert.equal(office.label,label);assert.equal(office.country,null);assert.equal(office.unresolved,true);assert.notEqual(office.countryInferred,true);assert.equal(r.evidence.listingComplete,false);assert.equal(r.evidence.reportedTotal,null);assert.equal(r.audit.healthyNativeCount,2)
})
for(const [from,to]of[['8690613002','8690613999'],['4006080002','4006080999']])test('esw: qualified office inference stays bound to exact native identity '+from,async()=>{
 const r=await replay(response=>({...response,requestedUrl:response.requestedUrl.replaceAll(from,to),body:response.body.replaceAll(from,to)})),role=r.audit.nativeJobs.find(j=>j.jobId===(from==='8690613002'?to:'8690613002')),office=role.sourceLocations.find(l=>l.sourceField==='offices[0]')
 assert.equal(office.country,null);assert.equal(office.unresolved,true);assert.notEqual(office.countryInferred,true);assert.equal(r.evidence.listingComplete,false)
})
test('esw: an explicit foreign country for the qualified office remains a contradiction',async()=>{
 const r=await replay(response=>{if(!response.requestedUrl.startsWith('https://boards-api.greenhouse.io/'))return response;const payload=JSON.parse(response.body);for(const o of payload.offices||payload.jobs?.flatMap(j=>j.offices)||[])if(o.id===4006080002)o.location='Berlin, Germany';return {...response,body:JSON.stringify(payload)}})
 assert.equal(r.evidence.listingComplete,false);assert.equal(r.role.country,null);assert.equal(r.audit.healthyNativeCount,2);assert.match(r.evidence.reason,/qualified-office-city-state-country-contradiction/)
})
test('esw: a typed country field NJ is not promoted to the United States postal-state inference',async()=>{
 const r=await replay(response=>{if(!response.requestedUrl.endsWith('/jobs?content=true'))return response;const payload=JSON.parse(response.body);payload.jobs.find(j=>j.id===8690613002).metadata.push({name:'Country',value:'NJ'});return {...response,body:JSON.stringify(payload)}})
 const typed=r.role.sourceLocations.find(l=>l.kind==='metadata'&&l.label==='NJ');assert.equal(typed.country,null);assert.equal(typed.unresolved,true);assert.equal(r.evidence.listingComplete,false)
})
test('esw: necessary role schema cannot contradict the qualified office country inference',async()=>{
 const r=await replay(response=>{if(response.requestedUrl!=='https://job-boards.greenhouse.io/esw/jobs/8690613002')return response;return {...response,body:response.body+'<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',url:response.requestedUrl,hiringOrganization:{name:'ESW'},jobLocation:{address:{addressLocality:'Jersey City',addressCountry:'DE'}}})+'</script>'}})
 assert.equal(r.role.country,null);assert.equal(r.evidence.listingComplete,false);assert.equal(r.audit.healthyNativeCount,2);assert.match(r.evidence.reason,/schema-feed-worksite-country-contradiction/)
})
