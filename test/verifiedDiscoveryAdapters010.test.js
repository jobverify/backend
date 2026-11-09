import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog} from '../scraper-support/providers/index.js'
test('InfoEdge repair retains one source and separates current official binding from failed runtime',()=>{
 const catalog=getScraperCatalog(),rows=catalog.filter(p=>p.source==='infoedge')
 assert.equal(rows.length,1)
 const p=rows[0];assert.equal(p.adapter,'script');assert.equal(p.atsPlatform,'zwayam')
 assert.equal(p.companyCareerPage,'https://careers.infoedge.com/infoedge/jobslist');assert.equal(p.boardIdentityVerified,true)
 for(const key of ['verifiedPublicJobCount','verifiedIndiaJobCount','verifiedPublicListingRowCount','verifiedIndiaListingRowCount'])assert.equal(p[key],null)
 assert.equal(p.verifiedInventoryStatus,'unverified');assert.equal(p.bindingEvidence.matchedLinks[0],'http://careers.infoedge.com/')
})
