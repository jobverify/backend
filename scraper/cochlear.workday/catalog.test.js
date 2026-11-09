import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
test('Cochlear keeps its original source identity and unknown company counts separate from the verified official board',()=>{
 const catalog=getScraperCatalog(),p=catalog.find(p=>p.source==='cochlear')
 assert.equal(catalog.filter(row=>row.source==='cochlear').length,1);assert.equal(p.companyName,'Cochlear');assert.equal(p.adapter,'script');assert.equal(p.atsPlatform,'workday')
 assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedOn,null)
 assert.equal(p.bindingEvidence.verified,true);assert.equal(p.jobsBoardUrl,'https://cochlear.wd3.myworkdayjobs.com/Cochlear_Careers')
 assert.equal(p.remediationStatus,'implemented-runtime-partial')
})
