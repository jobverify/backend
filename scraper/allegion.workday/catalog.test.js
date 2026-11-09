import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
test('Allegion catalog keeps verified official identity and unknown runtime counts without adding an alias',()=>{
 const catalog=getScraperCatalog(),rows=catalog.filter(p=>p.source==='allegion')
 assert.equal(rows.length,1)
 const p=rows[0];assert.equal(p.atsPlatform,'workday');assert.equal(p.catalogOverride,true)
 assert.equal(p.companyDomain,'allegion.com');assert.equal(p.companyCareerPage,'https://www.allegion.com/corp/en/careers.html')
 assert.equal(p.bindingEvidence.verified,true);assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null)
 assert.equal(p.verifiedInventoryStatus,'unverified');assert.equal(p.remediationStatus,'implemented-awaiting-runtime-qualification')
})
