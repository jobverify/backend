import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run,extractActiveJobNotifications,JOB_NOTIFICATIONS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {pdfTextWorkerCoreResourceState} from '../../scraper-support/shared/pdfTextWorkerCore.js'

const fixture=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/native-20261113.json.gz',import.meta.url))))
const bytes=packet=>Buffer.from(packet.bodyBase64,'base64'),text=packet=>bytes(packet).toString()
const packet=url=>fixture.packets.find(row=>row.requestedUrl===url)
const NOW='2026-11-13T12:00:00.000Z'
const replay=async(change=value=>value)=>{
  let audit
  const jobs=await run({reviewedCurrent:true,now:()=>NOW,
    fetchText:async url=>{assert.ok(packet(url),'retained first-party URL required');return change(text(packet(url)),url)},
    fetchImpl:async url=>{
      const row=packet(url)
      if(!row)throw Object.assign(Error('Retained current application continuation has no public HTTP response: WinError10060'),{code:'ETIMEDOUT'})
      const body=change(bytes(row),url),response=new Response(body,{status:row.status})
      Object.defineProperty(response,'url',{value:row.url});return response
    },onAudit:value=>{audit=value}})
  return{jobs,audit}
}

test('BEL retained BEEI discovery cannot fabricate original criteria or infer a role country from the employer',()=>{
  const rows=extractActiveJobNotifications(text(packet(JOB_NOTIFICATIONS_URL)),{now:()=>NOW})
  assert.equal(rows.length,1)
  assert.equal(rows[0].jobDescription,null)
  assert.equal(rows[0].country,null)
  assert.equal(rows[0].sourceDetailComplete,false)
})

test('BEL retains all38 original PDF pages and holds unknown country/application scope outside publication',async()=>{
  const {jobs,audit}=await replay()
  assert.equal(jobs.length,0)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(audit.originalNotices.length,8)
  assert.equal(audit.currentDetails.length,4)
  assert.equal(audit.documents.reduce((sum,row)=>sum+row.originalPageTexts.length,0),38)
  const teacher=audit.currentDetails.find(row=>row.advertisementId==='BEEI/TS/2026-2027/02')
  assert.equal(teacher.country,null)
  assert.match(teacher.originalCriteria,/POSTS AND QUALIFICATIONS/)
  assert.match(teacher.originalCriteria,/DUTIES AND RESPONSIBILITIES OF TEACHERS/)
  const engineer=audit.currentDetails.find(row=>row.advertisementId==='17556/HR/All-India/2026')
  assert.equal(engineer.country,'India')
  assert.equal(engineer.closingDate,'2026-11-18')
  assert.match(engineer.originalCriteria,/40,000-3%/)
  assert.match(engineer.originalCriteria,/SERVICE AGREEMENT/)
  assert.equal(engineer.activeApplicationQualified,false)
  const mit=audit.currentDetails.find(row=>row.advertisementId==='12930/64/HRD/GAD/01')
  assert.equal(mit.closingDate,'2026-11-20')
  assert.match(mit.originalCriteria,/CORRIGENDUM/)
  assert.match(mit.originalCriteria,/20\s*th\s*November 2026/)
})

test('BEL changed PDF bytes cannot carry reviewed criteria or a country assignment',async()=>{
  const url='https://bel-india.in/wp-content/uploads/2026/10/External-Ad-2026-English-1.pdf'
  const {jobs,audit}=await replay((body,target)=>target===url?Buffer.concat([body,Buffer.from('\n%unreviewed-native-revision\n')]):body)
  assert.equal(jobs.length,0)
  const detail=audit.currentDetails.find(row=>row.pdfUrl===url)
  assert.equal(detail.country,null)
  assert.equal(detail.originalCriteria,'')
  assert.ok(detail.issues.includes('full-original-visible-PDF-unqualified'))
  assert.equal(audit.documents.find(row=>row.url===url).qualified,false)
})

test('BEL rereads the complete original PDF body at closing',async()=>{
  const url='https://bel-india.in/wp-content/uploads/2026/10/External-Ad-2026-English-1.pdf';let reads=0
  const {audit}=await replay((body,target)=>target===url&&++reads===2?Buffer.concat([body,Buffer.from('\n%changed-closing-revision\n')]):body)
  assert.equal(audit.closingDocuments.find(row=>row.url===url).matchesOpening,false)
  assert.ok(audit.failures.some(row=>row.url===url&&row.reason==='native-full-original-PDF-changed-during-closing'))
})

test('BEL preserves caller abort while a public read ignores its signal',async()=>{
  const controller=new AbortController(),reason=Error('BEL caller-owned cancellation')
  const operation=run({reviewedCurrent:true,signal:controller.signal,fetchText:()=>new Promise(()=>{})})
  controller.abort(reason)
  await assert.rejects(operation,error=>error===reason)
})

test('BEL completes bounded PDF parser cleanup for all original documents',()=>{
  assert.deepEqual(pdfTextWorkerCoreResourceState(),{documents:0,ports:0,listeners:0,pendingOperations:0})
})
