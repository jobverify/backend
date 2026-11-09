import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createActaAiScraper} from './script.js'
import {createArms4AiScraper} from '../arms4ai/script.js'
import {inspectNativeProfile,inspectNativeSearch} from './currentPublic.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
globalThis.fetch=async()=>{throw Error('Offline regression cannot access network')}
const fixture=source=>JSON.parse(gunzipSync(fs.readFileSync(new URL('../'+source+'/test-data/current-public-20261103.json.gz',import.meta.url))))
export const original=(source,purpose)=>fixture(source).find(row=>row.purpose===purpose)
for(const [source,create]of [['actaai',createActaAiScraper],['arms4ai',createArms4AiScraper]]){
 test(source+' retains all10 own announcements while unwanted Jobs keyword scope cannot prove a vacancy zero',async()=>{
  let audit;const calls=[]
  const jobs=await create().run({fetchPage:async(url,request)=>{assert.equal(request.method,'GET');calls.push(url);const row=fixture(source).find(row=>row.url===url);assert.ok(row);return{url:row.finalURL,status:row.status,headers:row.headers,html:row.body}},onAudit:value=>{audit=value}})
  assert.equal(jobs.length,0);assert.equal(calls.length,4);assert.equal(audit.nativeAnnouncements.length,10)
  assert.deepEqual(audit.configuredSearch.keywordValues,['Jobs']);assert.equal(audit.configuredSearch.employerFilterBound,true)
  assert.equal(audit.closingReconciled,true);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  assert.equal(readSourceObservationEvidence(jobs,source).observedRecordCount,11)
  assert.ok(audit.nativeAnnouncements.every(row=>row.country===null&&row.jobPostingDate===null&&row.jobDescription===null))
  if(source==='actaai')assert.ok(audit.nativeAnnouncements.some(row=>row.originalText===''),'empty publisher announcement is preserved, not invented content')
  else {const hiring=audit.nativeAnnouncements.filter(row=>row.hiringSignal);assert.equal(hiring.length,1);assert.match(hiring[0].originalText,/Marketing & Business Development Associate/);assert.equal(hiring[0].fullNativeJobDescriptionQualified,false)}
 })
 test(source+' exact native employer/profile/URN and announcement author bind independently of marketing words',()=>{
  const html=original(source,'configured-native-company-profile').body
  assert.equal(inspectNativeProfile(source,html).nativeAnnouncements.length,10)
  assert.throws(()=>inspectNativeProfile(source,html.replaceAll(source==='actaai'?'98814926':'69828325','1234567')),/organization/i)
  assert.throws(()=>inspectNativeProfile(source,html.replaceAll(source==='actaai'?'Acta.ai':'ARMS 4 AI','Other Employer')),/identity/i)
 })
 test(source+' submitted keyword/company/geography state is kept rather than trusting a no-match heading',()=>{
  const result=inspectNativeSearch(source,original(source,'original-configured-native-search').body)
  assert.equal(result.unexpectedKeywordRestriction,true);assert.equal(result.nativeVacancyTotal,null);assert.equal(result.nativeIndiaTotal,null)
  assert.equal(result.employerFilterBound,true);assert.equal(result.geographyFilterBound,true)
 })
 test(source+' changed closing announcement content fails closed with unknown totals',async()=>{
  let profileReads=0
  await assert.rejects(create().run({fetchPage:async url=>{const row=fixture(source).find(row=>row.url===url);let html=row.body;if(row.purpose==='configured-native-company-profile'&&++profileReads===2)html=html.replace('"datePublished":"','"datePublished":"2000-');return{url:row.finalURL,status:row.status,html}}}),/announcement|closing/i)
 })
 test(source+' closing429 retains the successful opening observations and stops the denied host',async()=>{
  const counts=new Map();let audit
  await assert.rejects(create().run({fetchPage:async url=>{const count=(counts.get(url)||0)+1;counts.set(url,count);const row=fixture(source).find(row=>row.url===url);return{url:row.finalURL,status:row.purpose==='original-configured-native-search'&&count===2?429:row.status,headers:{'retry-after':'31'},html:row.body}},onAudit:value=>{audit=value}}),error=>error.status===429&&error.retryDelayMs===31000)
  assert.equal(audit.nativeAnnouncements.length,10);assert.equal(audit.closingReconciled,false)
  assert.equal(audit.nativeSnapshotFailure.status,429);assert.equal(audit.nativeSnapshotFailure.phase,'closing')
  assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false)
  assert.equal([...counts.values()].reduce((a,b)=>a+b),4)
 })
}
