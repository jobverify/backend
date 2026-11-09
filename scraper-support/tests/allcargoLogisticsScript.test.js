import assert from 'node:assert/strict'
import test from 'node:test'

const loadAllcargoModule = async () => {
  try {
    return await import('../../scraper/allcargologistics/script.js')
  } catch {
    assert.fail('Expected Allcargo Logistics scraper module at ../../scraper/allcargologistics/script.js')
  }
}

const careersPageHtml = `
  <html>
    <head><title>Careers At Allcargo Logistics</title></head>
    <body>
      <h1>Spotting future logistics leaders, now</h1>
      <h1>Work Culture</h1>
      <p>Allcargo Logistics is just the place for you.</p>
      <p>Join a team that values your insights and supports your growth.</p>
      <p>Explore job openings today!</p>
      <a href="https://allcargologistics.darwinbox.in/ms/candidatev2/main/careers/home">Join Our Team</a>
    </body>
  </html>
`

test('Allcargo Logistics scraper pins the verified official careers page and Darwinbox handoff', async () => {
  const allcargo = await loadAllcargoModule()

  assert.equal(allcargo.CAREERS_PAGE_URL, 'https://www.allcargologistics.com/about-us/careers')
  assert.equal(
    allcargo.DARWINBOX_HANDOFF_URL,
    'https://allcargologistics.darwinbox.in/ms/candidatev2/main/careers/home',
  )
  assert.equal(
    allcargo.LISTING_API_URL,
    'https://gatikwe.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main',
  )
  assert.equal(allcargo.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(
    allcargo.extractOfficialDarwinboxUrl(careersPageHtml),
    'https://allcargologistics.darwinbox.in/ms/candidatev2/main/careers/home',
  )
})

test('Allcargo Logistics run returns no jobs when the verified Darwinbox tenant remains broken', async () => {
  const allcargo = await loadAllcargoModule()
  const requestedUrls = []
  const probedUrls = []

  const jobs = await allcargo.createAllcargoLogisticsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersPageHtml
    },
    probeListingApi: async (url) => {
      probedUrls.push(url)
      return {
        status: 500,
        body: '{"message":"Internal Server Error - Invalid subdomain: gatikwe"}',
      }
    },
  })

  assert.deepEqual(requestedUrls, [allcargo.CAREERS_PAGE_URL])
  assert.deepEqual(probedUrls, [allcargo.LISTING_API_URL])
  assert.deepEqual(jobs, [])
})

test('Allcargo Logistics run fails closed when the official careers surface drifts or the Darwinbox tenant recovers', async () => {
  const allcargo = await loadAllcargoModule()

  await assert.rejects(
    allcargo.createAllcargoLogisticsScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
      probeListingApi: async () => ({ status: 500, body: '{"message":"Internal Server Error - Invalid subdomain: gatikwe"}' }),
    }),
    /verified darwinbox handoff/i,
  )

  await assert.rejects(
    allcargo.createAllcargoLogisticsScraper().run({
      fetchText: async () => careersPageHtml,
      probeListingApi: async () => ({
        status: 200,
        body: '{"data":[]}',
      }),
    }),
    /broken darwinbox tenant/i,
  )
})
