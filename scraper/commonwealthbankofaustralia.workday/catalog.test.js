import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
test('Commonwealth Bank of Australia keeps its registered source and verified official binding separate from unknown runtime totals',()=>{
 const catalog=getScraperCatalog(),p=catalog.find(p=>p.source==='commonwealthbankofaustralia')
 assert.equal(catalog.filter(row=>row.source==='commonwealthbankofaustralia').length,1);assert.equal(p.companyName,'Commonwealth Bank of Australia');assert.equal(p.adapter,'script');assert.equal(p.atsPlatform,'workday')
 assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null);assert.equal(p.verifiedOn,null)
 assert.equal(p.bindingEvidence.verified,true);assert.equal(p.jobsBoardUrl,'https://cba.wd3.myworkdayjobs.com/CommBank_Careers?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e')
 assert.equal(p.remediationStatus,'implemented-runtime-partial')
})
