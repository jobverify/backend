import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
test('CME Group keeps its registered source and verified official binding separate from unknown runtime totals',()=>{
 const catalog=getScraperCatalog(),p=catalog.find(p=>p.source==='cmegroup')
 assert.equal(catalog.filter(row=>row.source==='cmegroup').length,1);assert.equal(p.companyName,'CME Group');assert.equal(p.adapter,'script');assert.equal(p.atsPlatform,'workday')
 assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedOn,null)
 assert.equal(p.bindingEvidence.verified,true);assert.equal(p.jobsBoardUrl,'https://cmegroup.wd1.myworkdayjobs.com/en-US/cme_careers')
 assert.equal(p.remediationStatus,'implemented-runtime-partial')
})
