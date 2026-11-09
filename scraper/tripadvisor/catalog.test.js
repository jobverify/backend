import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog,buildScrapers} from '../../scraper-support/providers/index.js'
test('Tripadvisor source-only override wins the old shared bundle without widening employer scope',()=>{
 const provider=getScraperCatalog().find(p=>p.source==='tripadvisor'),scraper=buildScrapers().find(p=>p.name==='tripadvisor')
 assert.equal(provider.companyName,'Tripadvisor');assert.equal(provider.adapter,'script');assert.equal(provider.companyCareerPage,'https://careers.tripadvisor.com/');assert.equal(provider.companyDomain,'careers.tripadvisor.com');assert.equal(provider.boardToken,'tripadvisor');assert.equal(provider.countryFilter,'India');assert.equal(provider.zeroResultPolicy,'evidence-required')
 assert.equal(provider.parser,'bound-current-public-greenhouse-board');assert.match(provider.paginationStrategy,/final-native-feed-after-details/);assert.equal(provider.sourcePublicInventoryProgramReviewedOn,'2026-11-03')
 assert.equal(provider.configuredBoardProofRequiresLiveEvidence,true);assert.equal(provider.verifiedPublicJobCount,null);assert.equal(provider.verifiedIndiaJobCount,null);assert.equal(provider.verifiedAt,null);assert.equal(provider.sourceScopeComplete,false);assert.equal(provider.sourceCompanyWideScopeComplete,false);assert.equal(provider.lifecycleCleanupAllowed,false)
 assert.match(scraper.provider.modulePath,/tripadvisor[\\/]script\.js$/);assert.match(scraper.dryRunFile,/tripadvisor[\\/]jobs\.json$/);assert.equal(typeof scraper.run,'function')
})
