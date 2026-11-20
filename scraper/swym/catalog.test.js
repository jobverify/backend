import assert from 'node:assert/strict'
import test from 'node:test'
import companyAliases from '../../scraper-support/providers/companyAliases.json' with {type:'json'}
import {generateCompanyCoverageReport} from '../../scraper-support/providers/companyCoverage.js'
import {buildScrapers,getScraperCatalog} from '../../scraper-support/providers/index.js'
import provider from './catalog.js'
import {SOURCE,COMPANY,CAREERS_URL,PROVIDER_METADATA,createSwymScraper} from './script.js'

test('current Swym source metadata truthfully describes configured-board proof and holds company scope',()=>{assert.equal(PROVIDER_METADATA,provider);assert.equal(provider.source,SOURCE);assert.equal(provider.companyName,COMPANY);assert.equal(provider.companyCareerPage,CAREERS_URL);assert.equal(provider.parser,'custom-script');assert.equal(provider.authoritativeCurrentPublication,true);assert.equal(provider.backfillMode,'live-parser');assert.equal(provider.verifiedOn,null);assert.equal(provider.scraperTimeoutMs,120000);assert.match(provider.paginationStrategy,/unfiltered-declared-native-company-board/);assert.match(provider.modulePath,/swym[\\/]script\.js$/);assert.equal(typeof createSwymScraper().run,'function');assert.equal(Object.hasOwn(companyAliases,COMPANY),false)})
test('persistent Swym registration still resolves the exact current own source without employer aliases',()=>{const catalog=getScraperCatalog(),effective=catalog.find(p=>p.source===SOURCE);assert(effective);assert.equal(effective.adapter,'script');assert.equal(effective.companyCareerPage,CAREERS_URL);assert.match(effective.modulePath,/swym[\\/]script\.js$/);const report=generateCompanyCoverageReport({csvText:'Swym,\n',catalog});assert.equal(report.matchedCount,1);assert.equal(report.unmatchedCount,0);const scraper=buildScrapers().find(p=>p.name===SOURCE);assert.equal(typeof scraper.run,'function');assert.equal(scraper.provider.source,SOURCE)})
