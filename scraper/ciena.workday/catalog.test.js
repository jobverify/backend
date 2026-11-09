import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
test('Ciena retains its registered identity and separates official binding from runtime inventory',()=>{
 const catalog=getScraperCatalog(),provider=catalog.find(p=>p.source==='ciena')
 assert.equal(catalog.filter(row=>row.source==='ciena').length,1);assert.equal(provider.adapter,'script');assert.equal(provider.atsPlatform,'workday')
 assert.equal(provider.verifiedPublicJobCount,null);assert.equal(provider.verifiedIndiaJobCount,null)
 assert.equal(provider.bindingEvidence.verified,true);assert.equal(provider.jobsBoardUrl,'https://ciena.wd5.myworkdayjobs.com/Careers')
})
