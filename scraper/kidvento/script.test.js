import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {kidventoFixtureTransport} from '../../test/helpers/kidventoFixture.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import { fileURLToPath } from 'node:url'

const loadKidventoModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Kidvento scraper module at ./script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const homepageHtml = fs.readFileSync(path.join(currentDir, 'fixtures/homepage.html'), 'utf8')
const careersHtml = fs.readFileSync(path.join(currentDir, 'fixtures/careers.html'), 'utf8')
const currentCareersHtml = `
  <html>
    <head>
      <title>Careers</title>
      <meta property="og:url" content="https://www.kidvento.com/careers">
    </head>
    <body>
      <nav>
        <a aria-selected="true" href="/careers">Careers</a>
      </nav>
      <main>
        <h1>Kidvento Careers</h1>
        <p>Dubai</p>
        <p>Bengaluru</p>
        <p>Mysuru</p>
      </main>
    </body>
  </html>
`

test('Kidvento scraper validates the verified first-party homepage and careers zero-job surface', async () => {
  const kidvento = await loadKidventoModule()

  assert.equal(kidvento.SOURCE, 'kidvento')
  assert.equal(kidvento.COMPANY, 'Kidvento Education and Research Private Limited')
  assert.equal(kidvento.HOMEPAGE_URL, 'https://www.kidvento.com/')
  assert.equal(kidvento.CAREERS_URL, 'https://www.kidvento.com/careers')
  assert.equal(kidvento.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(kidvento.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(kidvento.hasOfficialCareersSignal(currentCareersHtml), true)
  assert.deepEqual(kidvento.extractSuspiciousPublicJobLinks(careersHtml), [])
})

test('registered Kidvento runtime preserves current native roles and honest partial coverage', async () => {
  const row=getScraperCatalog().find(row=>row.source==='kidvento')
  assert.equal(row.atsPlatform,'keka')
  assert.match(row.modulePath,/kidvento[\\/]script\.js$/)
  const {fetchImpl,calls}=kidventoFixtureTransport()
  const jobs=await createCatalogScraper(row).run({fetchImpl})
  assert.equal(jobs.length,29)
  assert.equal(jobs.filter(job=>job.sourceDetailComplete).length,17)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  assert.ok(jobs.every(job=>job.atsPlatform==='keka'&&job.lifecycleCleanupAllowed===false))
  assert.equal(calls.filter(url=>url.includes('/jobdetails/')).length,70)
})

test('Kidvento runtime fails closed for metadata/owner errors and retains criteria drift as partial', async () => {
  const kidvento=await loadKidventoModule()
  await assert.rejects(kidvento.run({fetchPage:async()=>({status:200,html:careersHtml})}),/HTTP metadata transport/)
  const foreign=kidventoFixtureTransport(row=>{if(row.url.includes('/api/jobs/'))row.responseUrl='https://other.keka.com/careers/api/jobs/default/active'})
  await assert.rejects(kidvento.run({fetchImpl:foreign.fetchImpl}),/HTTP status or response identity/)
  const drift=kidventoFixtureTransport((row,n)=>{if(row.url.endsWith('/jobdetails/167753')&&n===2)row.body=row.body.replace('Key Responsibilities','New required certification')})
  const jobs=await kidvento.run({fetchImpl:drift.fetchImpl})
  assert.equal(jobs.find(job=>job.jobId==='167753').sourceDetailComplete,false)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(jobs.find(job=>job.jobId==='167753').lifecycleCleanupAllowed,false)
})
