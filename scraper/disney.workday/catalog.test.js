import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
test('Disney exact current native identity stays one source with unknown runtime and whole-company counts',()=>{
 const catalog=getScraperCatalog(),rows=catalog.filter(p=>p.source==='disney');assert.equal(rows.length,1)
 const p=rows[0];assert.equal(p.catalogOverride,true);assert.equal(p.adapter,'script');assert.equal(p.atsPlatform,'radancy')
 assert.equal(p.companyCareerPage,'https://join.disneycareers.com/global/en/home');assert.equal(p.jobsBoardUrl,'https://www.disneycareers.com/en/search-jobs')
 assert.equal(p.bindingEvidence.verified,true);assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedInventoryStatus,'unverified')
 assert.equal(p.sourceScopeComplete,false);assert.equal(catalog.filter(r=>r.jobsBoardUrl===p.jobsBoardUrl).length,1)
 const company=catalog.find(r=>r.source==='thewaltdisneycompany')
 assert.equal(company.atsPlatform,'runtime-first-party-recruitment');assert.notEqual(company.modulePath,p.modulePath)
 assert.equal(company.boardIdentityVerified,false);assert.equal(company.sourceScopeComplete,false);assert.equal(company.lifecycleCleanupAllowed,false)
})
