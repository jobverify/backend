import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog} from '../providers/index.js'
import {FLEETX_CATALOG} from '../../scraper/fleetx/catalog.js'
import * as source from '../../scraper/fleetx/script.js'
test('Fleetx current observation metadata preserves registered identity and does not certify empty scope',()=>{
 const p=getScraperCatalog().find(p=>p.source==='fleetx')
 assert.equal(p.companyName,'Fleetx');assert.equal(p.companyDomain,'fleetx.io');assert.equal(p.adapter,'script');assert.equal(p.countryFilter,'India')
 assert.equal(p.modulePath,FLEETX_CATALOG.modulePath);assert.equal(p.companyCareerPage,'https://fleetx.io/careers')
 assert.equal(p.nativeCareersPage,source.CURRENT_CAREERS_URL);assert.equal(source.PROVIDER_METADATA.nativeCareersPage,p.nativeCareersPage)
 assert.equal(p.atsPlatform,'official-company-native-opening-cards');assert.equal(p.zeroResultPolicy,'evidence-required')
 assert.match(p.verifiedSurfaceSummary,/remain unproven/);assert.match(p.verifiedSurfaceSummary,/never establish an empty inventory/)
})
