import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog,buildScrapers} from '../../scraper-support/providers/index.js'
for(const source of['skyscanner','canva','atherenergy','bnpparibas'])test(source+' source-only boundary metadata wins without stale counts or employer changes',()=>{
 const provider=getScraperCatalog().find(p=>p.source===source),scraper=buildScrapers().find(p=>p.name===source)
 assert.equal(provider.adapter,'script');assert.equal(provider.countryFilter,'India');assert.equal(provider.sourceBoundaryReviewedOn,'2026-11-03');assert.equal(provider.verifiedOn,null);assert.equal(provider.verifiedAt,null);assert.equal(provider.verifiedPublicJobCount,null);assert.equal(provider.verifiedIndiaJobCount,null);assert.equal(provider.verifiedInventoryStatus,'unverified');assert.equal(provider.sourceScopeComplete,false);assert.equal(provider.sourceCompanyWideScopeComplete,false);assert.equal(provider.lifecycleCleanupAllowed,false);assert.equal(provider.zeroResultPolicy,'evidence-required');assert.equal(provider.scraperTimeoutMs,90000)
 assert.ok(provider.modulePath.endsWith(source+'/script.js')||provider.modulePath.endsWith(source+'\\script.js'));assert.equal(typeof scraper.run,'function');assert.ok(scraper.dryRunFile.endsWith(source+'/jobs.json')||scraper.dryRunFile.endsWith(source+'\\jobs.json'))
})
