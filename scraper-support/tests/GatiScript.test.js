import assert from 'node:assert/strict'
import test from 'node:test'
import {gatiFixtureTransport} from '../../test/helpers/gatiFixture.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

const verifiedHomepageHtml = `
  <html>
    <head>
      <title>Allcargo Logistics</title>
      <link rel="canonical" href="https://www.allcargologistics.com/" />
    </head>
    <body>
      <h1>AllcargoGATI: India's Premier Express Distribution and Supply Chain Solutions</h1>
      <p>Driven by Precision and Experience</p>
      <a href="https://www.allcargologistics.com/about-us/careers">Careers</a>
    </body>
  </html>
`

const verifiedCareersHtml = `
  <html>
    <head>
      <title>Careers At Allcargo Logistics</title>
      <link rel="canonical" href="https://www.allcargologistics.com/about-us/careers" />
    </head>
    <body>
      <div>AllCargo Gati</div>
      <h1>Spotting future logistics leaders, now</h1>
      <a href="https://allcargologistics.darwinbox.in/ms/candidatev2/main/careers/home">Join Our Team</a>
      <a href="https://allcargologistics.darwinbox.in/ms/candidatev2/main/careers/home">Explore job openings today!</a>
    </body>
  </html>
`

const brokenTenantResponse = {
  status: 500,
  body: '{"status":"error","data":{"message":"Internal Server Error - Invalid subdomain: gatikwe"}}',
}

const loadGatiModule = async () => {
  try {
    return await import('../../scraper/gati/script.js')
  } catch {
    assert.fail('Expected Gati scraper module at ../../scraper/gati/script.js')
  }
}

test('Gati scraper pins the verified redirecting homepage, parent careers page, and broken Darwinbox tenant', async () => {
  const gati = await loadGatiModule()

  assert.equal(gati.SOURCE, 'gati')
  assert.equal(gati.COMPANY_NAME, 'Gati')
  assert.equal(gati.HOMEPAGE_URL, 'https://www.gati.com/')
  assert.equal(gati.REDIRECT_HOMEPAGE_URL, 'https://www.allcargologistics.com/')
  assert.equal(gati.CAREERS_PAGE_URL, 'https://www.allcargologistics.com/about-us/careers')
  assert.equal(gati.DARWINBOX_HANDOFF_URL, 'https://allcargologistics.darwinbox.in/ms/candidatev2/main/careers/home')
  assert.equal(
    gati.LISTING_API_URL,
    'https://gatikwe.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )

  assert.equal(gati.extractCareersPageUrl(verifiedHomepageHtml), gati.CAREERS_PAGE_URL)
  assert.equal(
    gati.hasOfficialHomepageSignal({
      status: 200,
      url: gati.REDIRECT_HOMEPAGE_URL,
      html: verifiedHomepageHtml,
    }),
    true,
  )
  assert.equal(gati.extractOfficialDarwinboxUrl(verifiedCareersHtml), gati.DARWINBOX_HANDOFF_URL)
  assert.equal(gati.hasOfficialCareersSignal(verifiedCareersHtml), true)
  assert.equal(gati.hasBrokenDarwinboxTenantSignal(brokenTenantResponse), true)
})

// Runtime now requires observed current HTTP metadata; historical pure helpers
// above continue to describe the old public sentinel without certifying it.
test('Gati runtime reconciles the explicit current alias and current native GET inventory', async () => {
  const gati = await loadGatiModule()
  const {fetchImpl,calls}=gatiFixtureTransport()
  const jobs=await gati.createGatiScraper().run({fetchImpl})
  assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
  assert.equal(readInventoryEvidence(jobs).reportedTotal,0)
  assert.ok(calls.some(row=>row.url==='https://www.gati.com/'))
  assert.ok(calls.some(row=>row.url.includes('job?page=1&companyId=main')))
  assert.ok(!calls.some(row=>row.url.includes('gatikwe')))
})

test('Gati fails closed for current ownership, handoff and native identity drift', async () => {
  const gati=await loadGatiModule()
  await assert.rejects(gati.run({fetchPage:async()=>({status:200,html:verifiedHomepageHtml})}),/HTTP metadata/i)
  for(const target of ['https://www.allcargologistics.com/','https://www.allcargologistics.com/about-us/careers','https://allcargologistics.darwinbox.in/ms/candidateapi/getCompanyConfig?is_preview=false&companyId=main']){
    const {fetchImpl}=gatiFixtureTransport(row=>{if(row.url===target)row.body=row.body.replaceAll('Allcargo','Other Employer')})
    const jobs=await gati.run({fetchImpl})
    assert.equal(readInventoryEvidence(jobs).listingComplete,false)
    assert.equal(jobs.sourceAudit.lifecycleCleanupAllowed,false)
  }
})
