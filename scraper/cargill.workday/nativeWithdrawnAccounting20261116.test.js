import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {parseCargillPage,parseCargillOfficialRole,parseCargillRmkDetail,CargillNativeWithdrawnRole} from './nativeContract.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-withdrawn-accounting-20261116.json.gz',import.meta.url))))
const text=p=>Buffer.from(p.bodyBase64,'base64').toString(),row=parseCargillPage(JSON.parse(text(fixture.listing)),2,80).jobs.find(r=>r.publicJobId==='102773845824')
const official=()=>parseCargillOfficialRole(text(fixture.public),row,{now:fixture.capturedAt,deferIncompletePublicOffice:true})
const native=html=>parseCargillRmkDetail(html,fixture.native.finalUrl,official(),{now:fixture.capturedAt})

test('the original identity-bound accounting filled notice remains unpublished with no country/criteria/scope claim',()=>{
 assert.equal(official().requisitionId,'336637')
 assert.equal(official().title,'Analyst Accounting Ag&Trading NA Oilseeds United States')
 assert.throws(()=>native(text(fixture.native)),error=>{
  assert.ok(error instanceof CargillNativeWithdrawnRole)
  assert.equal(error.withdrawalProof.requisitionId,'336637');assert.equal(error.withdrawalProof.nativeRmkPublicId,'1376461257')
  assert.equal(error.withdrawalProof.nativeStatus,'filled')
  for(const key of ['countryQualified','criteriaQualified','publicationDateQualified','sourceScopeComplete','lifecycleCleanupAllowed'])assert.equal(error.withdrawalProof[key],false)
  return true
 })
})

for(const[label,change]of[
 ['native requisition',s=>s.replaceAll('336637-en_US','999999-en_US')],
 ['native employer',s=>s.replaceAll('urn:li:organization:2678','urn:li:organization:9999')],
 ['native title',s=>s.replaceAll('Analyst Accounting Ag&amp;Trading','Different Accounting Ag&amp;Trading')],
 ['missing filled notice',s=>s.replaceAll('Sorry, this position has been filled.','Status is unavailable.')],
 ['hidden filled notice',s=>s.replace('<strong>Sorry,','<strong hidden>Sorry,')],
 ['contradictory active country',s=>s.replace('</head>','<meta itemprop="addressCountry" content="IN"></head>')],
 ['contradictory full role',s=>s.replace('</head>','<script type="application/ld+json">{"@type":"JobPosting"}</script></head>')],
 ['unreviewed activation program',s=>s.replace('self === top','self == top')],
 ['active application',s=>s.replace('</body>','<a href="/talentcommunity/apply/1376461257/">Apply now</a></body>')],
])test('accounting withdrawal does not swallow changed '+label,()=>{
 const original=text(fixture.native),changed=change(original);assert.notEqual(changed,original)
 assert.throws(()=>native(changed),error=>!(error instanceof CargillNativeWithdrawnRole))
})
