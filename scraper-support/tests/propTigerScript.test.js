import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Proptiger.com</title>
  </head>
  <body>
    <main id="career-page">
      <section class="hero">
        <h1>Build your Career at PropTiger</h1>
        <p>Explore career opportunities at PropTiger and be part of a dynamic team transforming real estate with innovative solutions.</p>
      </section>
      <section id="roles" class="roles">
        <h2>Open Roles</h2>
        <p class="sub">Find your next career oppurtunity with PropTiger</p>
        <div class="jobs"></div>
        <div class="roles-empty-state roles-empty-state--all js-no-open-roles">
          <h3>There are currently no jobs available</h3>
          <a href="#career-form" class="btn outline no-ajaxy">Reach out to us</a>
        </div>
      </section>
      <section id="career-form" class="form">
        <h2>Didn’t Find the Right Opportunity?</h2>
        <form
          method="post"
          action="/responsive/jhr/careers/right-opportunity"
          enctype="multipart/form-data"
          class="grid"
        >
          <label>Resume * (Max 2MB size)</label>
        </form>
      </section>
      <footer>
        <span>© PropTiger Marketing Services Private Limited.</span>
      </footer>
    </main>
  </body>
</html>
`

const loadPropTigerModule = async () => {
  try {
    return await import('../../scraper/proptiger/script.js')
  } catch {
    assert.fail('Expected PropTiger scraper module at ../../scraper/proptiger/script.js')
  }
}

test('PropTiger pins the verified first-party empty-board careers page contract', async () => {
  const propTiger = await loadPropTigerModule()

  assert.equal(propTiger.SOURCE, 'proptiger')
  assert.equal(propTiger.COMPANY, 'PropTiger')
  assert.equal(propTiger.OFFICIAL_BRAND_NAME, 'PropTiger')
  assert.equal(propTiger.VERIFIED_ON, '2026-07-17')
  assert.equal(propTiger.HOMEPAGE_URL, 'https://www.proptiger.com/')
  assert.equal(propTiger.CAREERS_URL, 'https://www.proptiger.com/careers')
  assert.equal(
    propTiger.RIGHT_OPPORTUNITY_URL,
    'https://www.proptiger.com/responsive/jhr/careers/right-opportunity',
  )
  assert.equal(typeof propTiger.hasVerifiedCareersSignal, 'function')
  assert.equal(typeof propTiger.hasEmptyRolesSignal, 'function')
  assert.equal(typeof propTiger.extractReachOutFormAction, 'function')
  assert.equal(typeof propTiger.createPropTigerScraper, 'function')

  assert.equal(propTiger.hasVerifiedCareersSignal(officialCareersHtml), true)
  assert.equal(propTiger.hasEmptyRolesSignal(officialCareersHtml), true)
  assert.equal(
    propTiger.hasVerifiedCareersSignal('<html><body><h1>Unexpected</h1></body></html>'),
    false,
  )
  assert.equal(
    propTiger.extractReachOutFormAction(officialCareersHtml),
    'https://www.proptiger.com/responsive/jhr/careers/right-opportunity',
  )
})

test('PropTiger returns an honest zero-job result while the official careers page remains in the verified empty state', async () => {
  const propTiger = await loadPropTigerModule()
  const requests = []

  const jobs = await propTiger.createPropTigerScraper().run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === propTiger.CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected URL ${url}`)
    },
  })

  assert.deepEqual(requests, ['https://www.proptiger.com/careers'])
  assert.deepEqual(jobs, [])
})

test('PropTiger fails closed when the verified careers page or empty-board signal drifts', async () => {
  const propTiger = await loadPropTigerModule()

  await assert.rejects(
    propTiger.createPropTigerScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    propTiger.createPropTigerScraper().run({
      fetchText: async () =>
        officialCareersHtml
          .replace('There are currently no jobs available', 'Browse our open roles')
          .replace('<div class="jobs"></div>', '<div class="jobs"><article>Relationship Manager</article></div>'),
    }),
    /empty open roles state/i,
  )
})
