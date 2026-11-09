import assert from 'node:assert/strict'
import test from 'node:test'
import {IVALUE_CATALOG as c} from '../../scraper/ivalue/catalog.js'
import {generateCompanyCoverageReport} from '../providers/companyCoverage.js'
test('iValue catalog separates current handoff proof, freshness renewal and runtime counts',()=>{
 assert.equal(c.source,'ivalue');assert.equal(c.companyName,'iValue');assert.equal(c.officialBrandName,'iValue Group')
 assert.equal(c.adapter,'script');assert.equal(c.companyDomain,'ivaluegroup.com');assert.equal(c.atsPlatform,'greythr')
 assert.equal(c.companyCareerPage,'https://ivaluegroup.com/en-in/careers/working-at-ivalue/')
 assert.equal(c.jobsApiUrl,'https://ivgroup.greythr.com/hire/api/career/published_jobs/')
 assert.equal(c.paginationStrategy,'native-public-full-feed-and-final-feed-category-reconciliation')
 assert.equal(c.verifiedOn,null);assert.equal(c.verifiedPublicJobCount,null);assert.equal(c.verifiedIndiaJobCount,null)
 assert.match(c.verifiedSurfaceSummary,/not identity proof/);assert.match(c.verifiedSurfaceSummary,/48 hours/)
 assert.equal(c.approvedCorporateBinding.target,c.verifiedPublicJobsPageUrl)
 assert.equal(c.approvedCorporateBinding.officialURL,c.companyCareerPage)
 assert.match(c.approvedCorporateBinding.proofSha256,/^[a-f0-9]{64}$/)
})
test('iValue remains one exact catalog company without alias inflation',()=>{
 const r=generateCompanyCoverageReport({csvText:'iValue\n',catalog:[c],aliasMap:{}})
 assert.equal(r.matchedCount,1);assert.equal(r.unmatchedCount,0);assert.equal(r.matched[0].source,'ivalue')
})
