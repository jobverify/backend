import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {gunzipSync} from 'node:zlib'
import {createCatalogScraper,getScraperCatalog} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const registered=()=>getScraperCatalog().find(row=>row.source==='baseten')
const retained=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('../scraper/baseten/fixtures/current-native-20261030.json.gz',import.meta.url))))

test('registered Baseten executes the source reader and preserves the actual unfinished native and publisher evidence',async()=>{
 const provider=registered()
 assert.equal(provider.adapter,'script','the registered publicAts factory does not execute the source-local reader')
 assert.equal(path.resolve(provider.modulePath),fileURLToPath(new URL('../scraper/baseten/script.js',import.meta.url)))
 assert.equal(provider.sourceScopeComplete,false)
 const {responses}=retained(),audits=[]
 // Replay actual retained HTTP metadata/bodies; this is not a current HTTP run.
 const jobs=await createCatalogScraper(provider).run({onAudit:audit=>audits.push(audit),fetchImpl:async(input,init)=>{
  const url=String(input),record=responses[url]
  assert.ok(record,'only actual retained source endpoints may be replayed')
  assert.equal(init.method,'GET')
  const response=new Response(Buffer.from(record.bodyBase64,'base64'),{status:record.status,headers:{'content-type':record.contentType}})
  Object.defineProperty(response,'url',{value:record.finalUrl})
  return response
 }})
 assert.equal(jobs.length,0)
 assert.equal(audits.length,1)
 assert.equal(audits[0].opening.payload.jobs.length,104)
 assert.equal(audits[0].opening.cms.length,105)
 assert.equal(audits[0].fullNativeCriteriaCopies,104)
 assert.equal(audits[0].fullNativeDetails,101)
 assert.equal(audits[0].nativeCountryScopeUnresolvedRoleIds.length,3)
 assert.equal(audits[0].lifecycleCleanupAllowed,false)
 assert.equal(audits[0].originalNativePayloadPreserved,true)
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.indiaFacetCount,null)
 assert.match(evidence.reason,/unreviewed-declared-asset:/)
 assert.match(evidence.reason,/role-owned-description-geography-unresolved:/)
})

test('registered Baseten body-only injection cannot bypass the source metadata and scope checks',async()=>{
 const provider=registered();assert.equal(provider.adapter,'script')
 await assert.rejects(createCatalogScraper(provider).run({fetchText:async()=>'',fetchImpl:async()=>assert.fail('invalid overrides must fail before transport')}),/native HTTP metadata|body-only/)
})
