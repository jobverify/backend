import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'

test('Checkmarx replaces one sentinel without adding a source or verified company-count metadata',()=>{
 const all=getScraperCatalog(),matches=all.filter(p=>p.source==='checkmarx')
 assert.equal(matches.length,1)
 const p=matches[0]
 assert.match(p.modulePath,/checkmarx[\\/]script.js$/)
 assert.equal(p.companyName,'Checkmarx');assert.equal(p.companyDomain,'checkmarx.com')
 assert.equal(p.companyCareerPage,'https://checkmarx.com/company/careers/')
 assert.equal(p.jobsBoardUrl,'https://www.comeet.com/jobs/checkmarx/C0.008')
 assert.equal(p.atsPlatform,'comeet-public-native-preloads')
 assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null)
 assert.equal(p.verifiedOn,null);assert.equal(p.verifiedAt,null);assert.equal(p.verifiedInventoryStatus,'unverified')
})
