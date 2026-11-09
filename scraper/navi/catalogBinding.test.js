import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
test('Navi current binding keeps one source and no runtime count claim',()=>{
 const catalog=getScraperCatalog();const rows=catalog.filter(p=>p.source==='navi');assert.equal(rows.length,1)
 assert.equal(rows[0].turboHireOrgId,'3e818601-0baa-429c-b6f8-4b21903ae0e6');assert.equal(rows[0].boardIdentityVerified,true)
 assert.equal(rows[0].verifiedPublicJobCount,null);assert.equal(rows[0].verifiedIndiaJobCount,null);assert.equal(rows[0].verifiedInventoryStatus,'unverified')
})
