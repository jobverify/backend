import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readCurrentNoBrokerPage,readCurrentNoBrokerFeed,CAREERS_URL,JOB_FEED_URL,SEARCH_URL} from './currentNative20261117.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261125/declaration.json.gz',import.meta.url))))
const retained=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261117.json.gz',import.meta.url))))
const raw=packet=>Buffer.from(packet.bodyBase64,'base64').toString()
const native=url=>{const packet=current.responses.find(p=>p.requestedURL===url);assert.ok(packet);assert.equal(createHash('sha256').update(Buffer.from(packet.bodyBase64,'base64')).digest('hex'),packet.sha256);return raw(packet)}
const career=native(CAREERS_URL)
const expectedBoot=[
 'https://assets.nobroker.in/nb-new/696.65b7354fa5791c7344a5.js',
 'https://assets.nobroker.in/nb-new/main.3b6819ec1d18969ada7e.js',
 'https://assets.nobroker.in/nb-new/6/6.9690ffb2fe29a9c0eb8e.chunk.js',
 'https://assets.nobroker.in/nb-new/22/22.147545c74d4076bec3a9.chunk.js',
 'https://assets.nobroker.in/nb-new/42/42.6ae35ef0ad3d17b3c0e5.chunk.js',
 'https://assets.nobroker.in/nb-new/careers/careers.dc8c55c51eb197d34140.chunk.js',
]

test('NoBroker current genuine corporate declaration selects only its complete exact six-programme tuple',()=>{
 const model=readCurrentNoBrokerPage(career,CAREERS_URL)
 assert.equal(current.synthetic,false);assert.equal(model.programmeProfileId,'current-20261125')
 assert.deepEqual(model.bootURLs,expectedBoot);assert.equal(model.wholeOriginalHTML,career)
 assert.ok(model.careerText.includes('Join an amazing team'))
})

test('NoBroker current declared component still binds the same native public tenant collection and retains its whole six-record metadata feed',()=>{
 const component=native(expectedBoot[5]),config=native(expectedBoot[4]),feed=readCurrentNoBrokerFeed(native(JOB_FEED_URL))
 assert.ok(component.includes('1024(e,t,a)'));assert.ok(component.includes('3320(e,t,a)'));assert.ok(component.includes('m=a(1313)'))
 assert.ok(component.includes('initializeApp(m.firebaseConfig)'));assert.ok(component.includes('database().ref("jobOpeningSheet").once("value"'))
 assert.ok(config.includes('1313(e,t,n)'));assert.ok(config.includes('databaseURL:"https://no-broker-cbaa4.firebaseio.com"'))
 assert.equal(feed.filter(Boolean).length,6);assert.ok(feed.filter(Boolean).every(row=>row.Location.endsWith(', India')))
 assert.ok(feed.filter(Boolean).every(row=>!Object.hasOwn(row,'Description')&&!Object.hasOwn(row,'Qualifications')))
})

test('NoBroker current declaration cannot mix reviewed releases, replace employer scripts, add boot carriers or change activation attributes',()=>{
 for(const mode of['mixed','foreign','extra','attribute']){
  let html=career
  if(mode==='mixed')html=html.replace(expectedBoot[4],'https://assets.nobroker.in/nb-new/41/41.07a9d48911ae6b02e436.chunk.js')
  if(mode==='foreign')html=html.replace(expectedBoot[4],expectedBoot[4].replace('assets.nobroker.in','another-employer.invalid'))
  if(mode==='extra')html=html.replace('</body>','<script async data-chunk="careers" crossorigin="anonymous" src="https://assets.nobroker.in/nb-new/extra.js"></script></body>')
  if(mode==='attribute')html=html.replace('src="'+expectedBoot[2]+'"','src="'+expectedBoot[2]+'" onload="unreviewed()"')
  assert.notEqual(html,career,mode);assert.throws(()=>readCurrentNoBrokerPage(html,CAREERS_URL),/boot programme/,mode)
 }
})

function baselineDenial(foreign=false,denialOccurrence=1){
 const reads=[];let searches=0
 return{reads,options:{fetchImpl:async(url,init)=>{
  assert.equal(init.method,'GET');reads.push(url)
  const packet=retained.responses.find(p=>(p.url??p.finalUrl??p.requestedUrl??p.requestedURL)===url)
  assert.ok(packet,'Only genuine retained baseline native response '+url)
  const denied=url===SEARCH_URL&&++searches===denialOccurrence
  return Object.defineProperty(new Response(denied?'Controlled native search denial':packet.status===301?null:raw(packet),{status:denied?403:packet.status,headers:packet.headers}),'url',{value:denied&&foreign?'https://www.linkedin.com/another-employer':packet.url??packet.finalUrl??url})
 }}}
}

test('NoBroker a controlled search403 against the genuine retained deployment preserves native feed observations and stops every later denied-host read',async()=>{
 const{reads,options}=baselineDenial(),jobs=await run(options),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(audit.observedRecordCount,6);assert.equal(audit.observations.length,6)
 assert.equal(audit.nativeObservedFeedClosingReconciled,true);assert.equal(audit.nativeHandoffDenial.httpStatus,403)
 assert.equal(audit.nativeOpening.search.qualification,'native-search-denied-no-company-or-India-inventory')
 assert.ok(audit.nativeOpening.details.every(value=>value.qualification==='unobserved-after-native-host-denial'))
 assert.ok(audit.nativeClosing.details.every(value=>value.qualification==='unobserved-after-native-host-denial'))
 assert.equal(reads.filter(url=>url.startsWith('https://www.linkedin.com/')).length,1);assert.equal(reads.length,19)
 assert.ok(audit.observations.every(value=>value.criteria===null&&value.activeApplyVerified===false&&value.publicExperienceChecked===false))
 assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.sourceScopeComplete,false)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('NoBroker search denial never hides an employer identity mismatch',async()=>{
 const{reads,options}=baselineDenial(true)
 await assert.rejects(run(options),error=>error.httpStatus===403&&error.failureKind==='parser_or_contract_error'&&error.responseUrl==='https://www.linkedin.com/another-employer')
 assert.equal(reads.length,10)
})

test('NoBroker a closing search denial retains the observed opening redirect metadata and issues no later LinkedIn request',async()=>{
 const{reads,options}=baselineDenial(false,2),jobs=await run(options),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(audit.observedVacancyCount,6);assert.equal(audit.nativeObservedFeedClosingReconciled,true)
 assert.ok(audit.nativeOpening.details.every(value=>value.httpStatus===301&&value.activeApplyVerified===false))
 assert.ok(audit.nativeClosing.details.every(value=>value.qualification==='unobserved-after-native-host-denial'))
 assert.equal(reads.length,26);assert.equal(reads.at(-1),SEARCH_URL);assert.equal(audit.lifecycleCleanupAllowed,false)
})
