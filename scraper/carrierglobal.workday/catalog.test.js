import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
test('CarrierGlobal preserves registration but delegates inventory to the one Carrier source',()=>{
 const all=getScraperCatalog(),p=all.find(p=>p.source==='carrierglobal');assert.equal(all.filter(row=>row.source==='carrierglobal').length,1);assert.equal(p.companyName,'Carrier Global');assert.deepEqual(p.inventoryDelegation.sources,['carrier']);assert.equal(p.inventoryDelegation.preservesChildSourceAndCompany,true);assert.equal(p.inventoryDelegation.verified,true)
 assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedOn,null);assert.equal(p.aliasOfSource,undefined)
})
