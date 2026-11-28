import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261128.json.gz',import.meta.url))))
const home='https://coralogix.com/careers/',client='https://coralogix.com/_astro/careers-page.Cx6kwXfg.js',uid='4D.169'
const role='https://coralogix.com/careers/co/remote-india/4D.169/cloud-and-observability-engineer-remote-role-6pm-3am/all/?isComingFromApp=true'
const plain=packet=>Buffer.from(packet.bodyBase64,'base64').toString()
function replay(edit=(_url,body)=>body){const counts=new Map(),reads=[];return{reads,options:{fetchPage:async url=>{reads.push(url);const index=counts.get(url)||0;counts.set(url,index+1);const packet=fixture.responses.filter(row=>row.requestedUrl===url)[index];assert.ok(packet,'Only separately captured current response '+url+' observation '+index);return{status:packet.status,url:packet.url,html:edit(url,plain(packet),index)}}}}}
function replaceOne(body,before,after){assert.equal(body.split(before).length,2,'Mutation targets one actual value');return body.replace(before,after)}
function schema(body,edit){return body.replace(/(<script type="application\/ld\+json" id="job-ld">)([\s\S]*?)(<\/script>)/,(_all,start,raw,end)=>{const value=JSON.parse(raw);edit(value);return start+JSON.stringify(value)+end})}

test('current original fixture is a genuine separate opening and closing sequence',()=>{
 assert.equal(fixture.synthetic,false);assert.equal(fixture.responses.length,33)
 for(const packet of fixture.responses){const body=Buffer.from(packet.bodyBase64,'base64');assert.equal(body.length,packet.bytes);assert.equal(createHash('sha256').update(body).digest('hex'),packet.sha256);assert.equal(packet.status,200)}
 assert.equal(fixture.responses.filter(row=>row.requestedUrl===role).length,2)
})

test('current server-rendered deployment retains complete native India criteria without an obsolete detail client',async()=>{
 const io=replay(),jobs=await run(io.options),job=jobs.find(row=>row.jobId===uid)
 assert.ok(job);assert.equal(job.title,'Cloud and Observability Engineer (Remote Role, 6pm - 3am)');assert.equal(job.country,'India')
 assert.match(job.jobDescription,/2\+ years in Observability/);assert.match(job.jobDescription,/Good communication skills/)
 assert.equal(job.postingDate,null);assert.equal(job.sourcePostingDateUnavailable,true)
 assert.equal(job.sourceRenderedCriteriaComplete,false);assert.equal(job.sourceApplicationQualificationComplete,false)
 assert.equal(job.nativeCriteriaTextComplete,true);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(io.reads.length,33);assert.equal(io.reads.filter(url=>url===role).length,2)
 assert.equal(io.reads.some(url=>url.includes('careers-position-page.')),false)
 assert.equal(io.reads.some(url=>url.startsWith('https://www.comeet.com/')),false)
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.opening.length,59);assert.deepEqual(audit.opening,audit.closing)
 assert.deepEqual(audit.currentPublicRoleOpening.model,audit.currentPublicRoleClosing.model)
 assert.equal(audit.currentPublicRoleOpening.model.identifier.value,uid)
 assert.equal(audit.nativeDetailObservations.length,24)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readSourceObservationEvidence(jobs,'coralogix').observedRecordCount,59)
})

for(const [name,change,expected]of [
 ['changed tenant in client',(url,body)=>url===client?body.replace('/company/06.004/','/company/99.999/'):body,/inventory client contract/],
 ['new executable in client',(url,body)=>url===client?body+';globalThis.unreviewed=true;':body,/inventory client contract/],
 ['foreign client declaration',(url,body)=>url===home?body.replace('/_astro/careers-page.Cx6kwXfg.js','https://foreign.invalid/client.js'):body,/current listing client/],
 ['missing current public model',(url,body)=>url===role?replaceOne(body,'id="job-ld"','id="other-ld"'):body,/current public/],
 ['foreign public employer',(url,body)=>url===role?schema(body,value=>{value.hiringOrganization.name='Other Employer'}):body,/current public/],
 ['foreign public country',(url,body)=>url===role?schema(body,value=>{value.jobLocation.address.addressCountry='US'}):body,/current public/],
 ['contradictory public country alternative',(url,body)=>url===role?schema(body,value=>{value.jobLocation.additionalLocationCountry='US'}):body,/current public/],
 ['conflicting public employment type',(url,body)=>url===role?schema(body,value=>{value.employmentType='PART_TIME'}):body,/current public/],
 ['different public role ID',(url,body)=>url===role?schema(body,value=>{value.identifier.value='99.999'}):body,/current public/],
 ['foreign public canonical',(url,body)=>url===role?replaceOne(body,'rel="canonical" href="https://coralogix.com/','rel="canonical" href="https://foreign.invalid/'):body,/current public/],
 ['added public criteria',(url,body)=>url===role?schema(body,value=>{value.description+='<p>Additional mandatory qualification.</p>'}):body,/current public/],
 ['removed public criteria',(url,body)=>url===role?schema(body,value=>{value.description=value.description.replace('Good communication skills','')}):body,/current public/],
])test('current deployment rejects '+name,async()=>{
 let changed=false;const io=replay((url,body,index)=>{const next=change(url,body,index);changed||=next!==body;return next})
 await assert.rejects(run(io.options),expected);assert.equal(changed,true,'Mutation reached actual current carrier')
})

test('current public closing criteria drift never returns the accepted opening records',async()=>{
 let changed=false;const io=replay((url,body,index)=>{if(url!==role||index!==1)return body;changed=true;return schema(body,value=>{value.description+='<p>Closing requirement.</p>'})})
 await assert.rejects(run(io.options),/current public/);assert.equal(changed,true)
})

test('native complete criteria drift at closing remains held despite stable current employer deployment',async()=>{
 let changed=false;const io=replay((url,body,index)=>{if(!url.includes('/positions/'+uid+'?')||index!==1)return body;const value=JSON.parse(body);value.details.find(section=>section.name==='Requirements').value+='<p>Closing native requirement.</p>';changed=true;return JSON.stringify(value)})
 const jobs=await run(io.options);assert.equal(changed,true);assert.equal(jobs.some(job=>job.jobId===uid),false)
 assert.ok(jobs.nativeCollectionEvidence.failures.some(row=>row.id===uid&&/criteria/.test(row.reason)))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('current full native country contradictions cannot borrow the separate public India model',async()=>{
 let changed=false;const io=replay((url,body)=>{if(!url.includes('/positions/'+uid+'?'))return body;const value=JSON.parse(body);value.location.country='US';changed=true;return JSON.stringify(value)})
 const jobs=await run(io.options);assert.equal(changed,true);assert.equal(jobs.some(job=>job.jobId===uid),false)
 assert.equal(jobs.nativeCollectionEvidence.nativeDetailObservations.filter(row=>row.id===uid&&row.originalRecord.location.country==='US').length,2)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
