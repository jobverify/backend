import assert from 'node:assert/strict'
import test from 'node:test'
import {buildScrapers,getScraperCatalog} from '../providers/index.js'
import catalog from '../../scraper/amberstudent/catalog.js'
test('Amber shared registry uses the verified current Keka handoff and scope metadata',()=>{
 const provider=getScraperCatalog().find(p=>p.source==='amberstudent')
 for(const field of ['companyName','companyCareerPage','officialJobsBoardUrl','atsPlatform','paginationStrategy','extractionStrategy','verifiedOn','kekaIdentifier','kekaJobsApiUrl'])assert.equal(provider[field],catalog[field],field)
 assert.equal(provider.smartRecruitersListingApiUrl,undefined)
 assert.ok(buildScrapers().some(s=>s.name==='amberstudent'))
})
