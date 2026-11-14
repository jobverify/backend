import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {buildScraperAttemptDiagnostics} from '../../scraper-support/runner.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {inventoryCleanupOptions} from '../../scraper-support/utils/scraperOutcome.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url))))
const board=gunzipSync(readFileSync(new URL('./test-data/deployment-20261114/board.gz',import.meta.url))).toString()
const request=change=>async url=>{const row=structuredClone(fixture.find(row=>row.requestedUrl===url));assert.ok(row,'Unexpected URL '+url);if(url==='https://careers.airindia.com/aix')row.body=change?change(board):board;return row}
test('current AIX referrer tracking preserves the independent employer and blank-search initializer',async()=>{
 let audit;const jobs=await run({fetchPage:request(),onAudit:value=>audit=value})
 assert.equal(jobs.length,0);assert.equal(audit.nativeBrand,'aix');assert.equal(audit.closingInventoryMatches,true)
 assert.equal(audit.sourceCompanyWideScopeComplete,false);assert.equal(audit.sourceLifecycleCleanupVerified,false)
})
test('an empty declared AIX board does not authorize retiring vacancies outside the verified source scope',async()=>{
 const provider=getScraperCatalog().find(row=>row.source==='airasiaindia')
 const jobs=await createCatalogScraper(provider).run({fetchPage:request()})
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.status,'verified-empty');assert.equal(evidence.listingComplete,true)
 assert.deepEqual(inventoryCleanupOptions(buildScraperAttemptDiagnostics(jobs,undefined,provider)),{replaceExisting:false})
})
for(const [name,change]of [
 ['replaced namespace',h=>h.replace('window.j2w = window.j2w || {}','window.j2w = {}')],
 ['replaced initializer',h=>h.replace("window.j2w.referrerTracking.status = 'pending'","window.j2w.init = function(){}")],
 ['changed tracking endpoint',h=>h.replace("url: '/services/t/l'","url: '/jobs/alternate'")],
 ['wrong tracking brand',h=>h.replace("var brand = 'aix'","var brand = 'airindia'")]
])test('AIX rejects '+name+' in the reviewed tracking program',async()=>{
 assert.notEqual(change(board),board);await assert.rejects(run({fetchPage:request(change)}),/namespace|tracking|profile/)
})
