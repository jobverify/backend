import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {fileURLToPath} from 'node:url'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const provider=()=>getScraperCatalog().find(row=>row.source==='watchguard')
const fixture=()=>JSON.parse(gunzipSync(readFileSync(new URL('../scraper/watchguard/fixtures/native-http-20261030.json.gz',import.meta.url))))

test('registered WatchGuard reaches the native publication reader and preserves unfinished scope',async()=>{
  const selected=provider()
  assert.equal(selected.adapter,'script','apiPortal still maps native creation time as publication')
  assert.equal(selected.modulePath,fileURLToPath(new URL('../scraper/watchguard/script.js',import.meta.url)))
  assert.equal(selected.sourceScopeComplete,false)
  const archived=fixture(),queues=new Map(),requests=[],audits=[]
  // Reuse both actual historical API receipts and the one actual detail pass.
  // This replay is neither a new HTTP capture nor a second detail cohort.
  for(const index of [archived.openingReceiptIndex,...archived.roleReceiptIndices,archived.closingReceiptIndex]){
    const record=archived.responses[index]
    if(!queues.has(record.url))queues.set(record.url,[])
    queues.get(record.url).push(record)
  }
  const jobs=await createCatalogScraper(selected).run({
    onAudit:audit=>audits.push(audit),
    fetchImpl:async(url,init)=>{
      assert.equal(init.method,'GET')
      const record=queues.get(String(url))?.shift()
      assert.ok(record,'only an exact archived native request may be replayed')
      requests.push(record.filename)
      const response=new Response(Buffer.from(record.bodyBase64,'base64'),{
        status:record.status,headers:{'content-type':record.contentType},
      })
      Object.defineProperty(response,'url',{value:record.finalUrl})
      return response
    },
  })
  assert.equal(requests.length,33)
  assert.ok([...queues.values()].every(queue=>queue.length===0))
  assert.equal(jobs.length,0)
  assert.equal(audits.length,1)
  const audit=audits[0]
  const original=JSON.parse(Buffer.from(archived.responses[archived.openingReceiptIndex].bodyBase64,'base64'))
  assert.deepEqual(audit.originalOpening,original)
  assert.deepEqual(audit.originalClosing,original)
  assert.equal(audit.nativeRecords.length,31)
  assert.equal(audit.roleSchemas.length,31)
  assert.equal(audit.detailPassCount,1)
  assert.equal(audit.noSecondDetailCohortClaimed,true)
  const actual=audit.nativeRecords.find(role=>role.jobId==='163d1d05-113f-47fc-b340-c4bd96c88866')
  assert.equal(actual.postingDate,'2026-10-15')
  assert.equal(actual.sourcePublicationPrecision,'date-only')
  assert.equal(actual.nativeCreatedAt,1792068974364)
  assert.equal(actual.sourceNativeHiringOrganization.name,'WatchGuard Technologies, Inc.')
  assert.deepEqual(actual.sourceNativeRecord,original.find(role=>role.id===actual.jobId))
  assert.equal(audit.currentLiveQualification,false)
  assert.equal(audit.lifecycleCleanupAllowed,false)
  const evidence=readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete,false)
  assert.equal(evidence.reportedTotal,null)
  assert.equal(evidence.indiaFacetCount,null)
})

test('registered WatchGuard rejects body-only injection before transport',async()=>{
  const selected=provider();assert.equal(selected.adapter,'script')
  await assert.rejects(createCatalogScraper(selected).run({
    fetchText:async()=>'',fetchImpl:async()=>assert.fail('invalid override must fail before transport'),
  }),/native HTTP metadata|body-only/)
})
