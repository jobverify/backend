import assert from 'node:assert/strict'
import test from 'node:test'

const kfinBrandCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - KFin Technologies Private Limited | KFintech</title>
  </head>
  <body>
    <h1>Be the first to see new opportunities.</h1>
    <p>Join the Talent Network</p>
    <button type="button">Domestic Fund Services</button>
    <a href="https://www.kfintech.com/jobs/associate-global-business-services/">
      Associate - Global Business Services
    </a>
    <button type="button">IT</button>
    <button type="button">Non-Domestic Fund Services</button>
    <p class="empty-filter-message">No Jobs Available</p>
  </body>
</html>
`

const loadKFinTechnologiesModule = async () => {
  try {
    return await import('../../scraper/kfintechnologies/script.js')
  } catch {
    assert.fail('Expected KFin Technologies scraper module at ../../scraper/kfintechnologies/script.js')
  }
}

test('KFin alias audit stays pinned to the shared KFin Technologies first-party careers parser', async () => {
  const kfinTechnologies = await loadKFinTechnologiesModule()

  assert.equal(kfinTechnologies.COMPANY_NAME, 'KFin Technologies')
  assert.equal(kfinTechnologies.OFFICIAL_BRAND_NAME, 'KFintech')
  assert.equal(kfinTechnologies.CAREERS_URL, 'https://www.kfintech.com/career/')
  assert.equal(kfinTechnologies.JOBS_ARCHIVE_URL, 'https://www.kfintech.com/jobs/')
  assert.equal(kfinTechnologies.hasOfficialCareersPageSignal(kfinBrandCareersHtml), true)
  assert.deepEqual(kfinTechnologies.extractJobLinks(kfinBrandCareersHtml), [
    'https://www.kfintech.com/jobs/associate-global-business-services/',
  ])
})
