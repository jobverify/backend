import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import zlib from 'node:zlib'
import * as source from './script.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'
const body = name => zlib.gunzipSync(fs.readFileSync(new URL(`./fixtures/current-${name}.html.gz`,import.meta.url))).toString()
const careers = body('careers'), positions = body('positions'), home = body('home')
const missing = '<title>404 Error: Page Not Found</title><meta name="robots" content="noindex"><script>"404-NotBranded"</script>classic-error-pages-statics'
const reader = transform => async url => ({status:source.MISSING_ROUTE_URLS.includes(url)?404:200,url:source.HOMEPAGE_ALIAS_URLS.includes(url)?source.HOMEPAGE_URL:url,html:transform?.(url) ?? (url===source.CAREERS_URL?careers:url===source.OPEN_POSITIONS_URL?positions:source.MISSING_ROUTE_URLS.includes(url)?missing:home)})
test('Paninian current recruiting email uses the active mailto context, excluding Wix telemetry and inert decoys',()=>{
 assert.equal(source.extractApplyEmail(careers),source.SHARED_APPLY_EMAIL)
 const active='<p>Email us at <a href="mailto:careers_india@paninian.com">careers_india@paninian.com</a></p>'
 assert.equal(source.extractApplyEmail('<script>"wrong@telemetry.invalid"</script>'+active),source.SHARED_APPLY_EMAIL)
 assert.equal(source.extractApplyEmail('<template>'+active+'</template>'),null)
 assert.equal(source.extractApplyEmail('<footer>'+active+'</footer>'),null)
 assert.equal(source.extractApplyEmail(active.replace('mailto:careers_india@paninian.com','mailto:elsewhere@other.invalid')),null)
 assert.equal(source.extractApplyEmail(active+active.replaceAll('careers_india@paninian.com','elsewhere@other.invalid')),null)
})
test('Paninian whole native location labels reject mixed foreign, remote and unknown labels',()=>{
 for(const label of ['Hyderabad / United States','Hyderabad Remote','Remote','Hyderabad / Singapore','Bangalore / Dubai']){
  assert.throws(()=>source.extractPublicJobs(positions.replaceAll('Hyderabad',label)),/location|country|geograph|trusted first-party surface/i)
 }
})
test('Paninian current 18 native role criteria retain originals and a persistent company cleanup hold',async()=>{
 const jobs=await source.run({fetchPage:reader()})
 assert.equal(jobs.length,18)
 for(const job of jobs){assert.ok(job.nativeRoleRecord.qualification);assert.ok(job.nativeRoleRecord.skills.length);assert.ok(job.sourceDescription.includes(job.nativeRoleRecord.qualification));assert.equal(job.sourceScopeComplete,false);assert.equal(job.sourceDetailComplete,true);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.nativeRoleClosingReconciled,true)}
 assert.equal(jobs.nativeCollectionEvidence.companyScopeComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.nativeInventoryCount,18)
 assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('Paninian closing role criteria and active handoff drift fail without false zeros',async()=>{
 for(const target of ['roles','email']){let reads=0;await assert.rejects(source.run({fetchPage:reader(url=>{
  if(target==='roles'&&url===source.OPEN_POSITIONS_URL&&++reads===2)return positions.replaceAll('Gas Turbine Engines','CHANGED ORIGINAL CRITERION')
  if(target==='email'&&url===source.CAREERS_URL&&++reads===2)return careers.replaceAll(source.SHARED_APPLY_EMAIL,'different@paninian.com')
 })}),/closing|reconcil/i)}
})
