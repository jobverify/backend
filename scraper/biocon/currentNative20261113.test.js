import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {extractDwrSearchResults,extractJobDetail,run,CAREERS_PAGE_URL} from './script.js'

const fixture=JSON.parse(gunzipSync(await fs.readFile(new URL('./fixtures/native-20261113.json.gz',import.meta.url))))
const body=packet=>Buffer.from(packet.bodyBase64,'base64').toString()
const listings=fixture.packets.filter(packet=>packet.method==='POST').flatMap(packet=>extractDwrSearchResults(body(packet)))
const listing=listings.find(row=>row.requisitionId==='6834')
const original=body(fixture.packets.find(packet=>packet.requestedUrl===listing.sourceUrl))

test('Biocon retained6834 preserves every originally authored qualification section',()=>{
  assert.match(original,/Educational Qualifications/)
  assert.match(original,/B\.Pharma/)
  const job=extractJobDetail(original,listing)
  assert.match(job.jobDescription,/Educational Qualifications/)
  assert.match(job.jobDescription,/Required Education Qualification:\s*B\.Pharma/)
  assert.match(job.jobDescription,/Required Experience:\s*4\s*-\s*10 years/)
})

test('Biocon retained6834 uses the native date epoch behind its authored date formatter',()=>{
  assert.match(original,/id="postedOnFastDate" value="1770909533000"/)
  assert.match(original,/id="pattern" value="MM\/dd\/yyyy"/)
  assert.equal(listing.postingDate,'2026-12-02') // the existing ambiguous search parser
  assert.equal(extractJobDetail(original,listing).postingDate,'2026-02-12')
})

const originalPages=fixture.packets.filter(packet=>packet.method==='POST').map(body)
const replay=async(change=html=>html)=>{
  let audit
  const jobs=await run({reviewedCurrent:true,
    fetchText:async url=>{
      const packet=fixture.packets.find(packet=>packet.requestedUrl===url)
      assert.ok(packet,'only retained original public URLs may be read: '+url)
      return change(body(packet),url)
    },getSearchPages:async()=>originalPages,onAudit:value=>{audit=value}})
  return {jobs,audit}
}

test('Biocon retains original criteria and Apply proofs while unreviewed stylesheet bytes hold publication',async()=>{
  const {jobs,audit}=await replay()
  assert.equal(jobs.length,0)
  const proof=audit.details.find(row=>row.requisitionId==='6834')
  assert.equal(proof.detail.country,'India')
  assert.equal(proof.detail.postingDate,'2026-02-12')
  assert.equal(proof.originalCriteriaContentReconciled,true)
  assert.equal(proof.nativeApplyProgramReconciled,true)
  assert.deepEqual(proof.intrinsicIssues,[])
  assert.match(proof.detail.jobDescription,/B\.Pharma/)
  assert.equal(audit.stylesheetBytesReviewed,false)
  assert.ok(audit.withheldDetails.every(row=>row.issues.some(reason=>reason.includes('stylesheet-bytes-unreviewed'))))
  assert.equal(audit.originalPostings.length,17)
  assert.ok(audit.withheldDetails.some(row=>row.requisitionId==='103'))
})

test('Biocon original educational body text cannot disappear under offscreen or invisible styling',async()=>{
  for(const style of ['opacity:0','position:fixed;left:-9999px']){
    const {jobs,audit}=await replay((html,url)=>url===listing.sourceUrl?html.replace('B.Pharma',`<span style="${style}">B.Pharma</span>`):html)
    assert.equal(jobs.some(row=>row.requisitionId==='6834'),false)
    assert.ok(audit.details.find(row=>row.requisitionId==='6834').intrinsicIssues.includes('native-original-criteria-tree-or-visibility-changed'))
    assert.deepEqual(audit.details.find(row=>row.requisitionId==='6908').intrinsicIssues,[])
  }
})

test('Biocon a disabled original Apply control cannot qualify its own role',async()=>{
  const {jobs,audit}=await replay((html,url)=>url===listing.sourceUrl?html.replaceAll('<button id="applyButton_','<button disabled id="applyButton_'):html)
  assert.equal(jobs.some(row=>row.requisitionId==='6834'),false)
  assert.ok(audit.details.find(row=>row.requisitionId==='6834').intrinsicIssues.includes('native-active-same-role-Apply-control-unqualified'))
})

test('Biocon native reader rejects promptly with the exact caller reason when a public read ignores abort',async()=>{
  const controller=new AbortController(),reason=Object.assign(Error('caller-owned cancellation'),{owner:'test'})
  const operation=run({reviewedCurrent:true,signal:controller.signal,fetchText:()=>new Promise(()=>{})})
  controller.abort(reason)
  await assert.rejects(operation,error=>error===reason)
})

test('Biocon complete raw-text criteria cannot be lost behind a script node',async()=>{
  const {audit}=await replay((html,url)=>url===listing.sourceUrl?html.replace('B.Pharma','<script type="application/json">B.Pharma</script>'):html)
  assert.ok(audit.details.find(row=>row.requisitionId==='6834').intrinsicIssues.includes('native-original-criteria-tree-or-visibility-changed'))
})

test('Biocon keeps full closing detail disagreement outside publication',async()=>{
  let reads=0
  const {jobs,audit}=await replay((html,url)=>url===listing.sourceUrl&&++reads===2?html.replace('B.Pharma','M.Pharma'):html)
  assert.equal(jobs.length,0)
  assert.ok(audit.closingDetails.find(row=>row.requisitionId==='6834').intrinsicIssues.includes('native-original-criteria-tree-or-visibility-changed'))
  assert.ok(audit.withheldDetails.find(row=>row.requisitionId==='6834').issues.includes('native-full-closing-identity-country-or-criteria-changed'))
})

test('Biocon corporate authority cannot be supplied by offscreen ancestors',async()=>{
  await assert.rejects(replay((html,url)=>url===CAREERS_PAGE_URL?html.replace(/<body\b/i,'<body style="position:fixed;left:-9999px"'):html),/authority|visibility|styling/i)
})
