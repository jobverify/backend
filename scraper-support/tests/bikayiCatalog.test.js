import assert from'node:assert/strict'
import test from'node:test'
import{generateCompanyCoverageReport}from'../providers/companyCoverage.js'
import{buildScrapers,getScraperCatalog}from'../providers/index.js'
test('current BIK/Keka metadata preserves the historical Bikayi source row and native employer name',()=>{
 const provider=getScraperCatalog().find(item=>item.source==='bikayi')
 assert.ok(provider);assert.equal(provider.companyName,'BIK');assert.equal(provider.legacyCompanyName,'Bikayi')
 assert.equal(provider.atsPlatform,'keka-public-careers');assert.equal(provider.companyCareerPage,'https://bik.ai/careers')
 assert.equal(provider.countryFilter,'India');assert.equal(provider.companyDomain,'bik.ai')
 assert.equal(provider.verifiedPublicJobCount,null);assert.equal(provider.lifecycleCleanupAllowed,false)
})
test('historical Bikayi company coverage and runnable source remain in the original scope',()=>{
 const scraper=buildScrapers().find(item=>item.name==='bikayi');assert.ok(scraper);assert.equal(typeof scraper.run,'function')
 const report=generateCompanyCoverageReport({csvText:'Bikayi,\n',catalog:getScraperCatalog()})
 assert.equal(report.matchedCount,1);assert.equal(report.unmatchedCount,0);assert.equal(report.matched[0].source,'bikayi')
})
