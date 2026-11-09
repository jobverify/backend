import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Micron Technology Inc.</title>
  </head>
  <body>
    <main>
      <h1>Great place to work in India</h1>
      <p>At Micron Hyderabad and Bengaluru, we advance the transformation of information into intelligence.</p>
      <a href="https://careers.micron.com/careers">Search jobs</a>
      <a href="https://micron.eightfold.ai/careers?location=India&domain=micron.com">Search current jobs</a>
    </main>
  </body>
</html>
`

const SEARCH_PAYLOAD = {
  status: 200,
  error: {
    message: '',
    body: '',
  },
  data: {
    positions: [
      {
        id: 42296091,
        displayJobId: 'JR102906',
        name: 'Principal Engineer- HIG HBM Layout',
        locations: ['Hyderabad, Telangana, India'],
        standardizedLocations: ['Hyderabad, TS, IN'],
        postedTs: 1780963200,
        department: 'HIG',
        positionUrl: '/careers/job/42296091',
      },
      {
        id: 42296092,
        displayJobId: 'JR102999',
        name: 'US Role',
        locations: ['Boise, Idaho, United States'],
        standardizedLocations: ['Boise, ID, US'],
        postedTs: 1780963200,
        department: 'Operations',
        positionUrl: '/careers/job/42296092',
      },
    ],
    count: 2,
  },
}

const DETAIL_PAYLOADS = {
  42296091: {
    data: {
      publicUrl: 'https://careers.micron.com/careers/job/42296091',
      postedTs: 1780963200,
      jobDescription: '<p>Required Experience: 6 years in HBM layout design.</p>',
    },
  },
  42296092: {
    data: {
      publicUrl: 'https://careers.micron.com/careers/job/42296092',
      postedTs: 1780963200,
      jobDescription: '<p>Required Experience: 4 years in US manufacturing operations.</p>',
    },
  },
}

const loadModule = async () => {
  try {
    return await import('../../scraper/microntechnologyindia/script.js')
  } catch {
    assert.fail('Expected Micron Technology India scraper module at ../../scraper/microntechnologyindia/script.js')
  }
}

test('Micron Technology India scraper constants stay pinned to the verified first-party careers page and public Eightfold routes from Tuesday, August 4, 2026', async () => {
  const micron = await loadModule()

  assert.equal(micron.SOURCE, 'microntechnologyindia')
  assert.equal(micron.COMPANY, 'Micron Technology India')
  assert.equal(micron.OFFICIAL_BRAND_NAME, 'Micron Technology')
  assert.equal(micron.VERIFIED_ON, '2026-08-04')
  assert.equal(micron.HOMEPAGE_URL, 'https://in.micron.com/')
  assert.equal(micron.OFFICIAL_CAREERS_URL, 'https://in.micron.com/about/careers')
  assert.equal(
    micron.PUBLIC_BOARD_URL,
    'https://micron.eightfold.ai/careers?location=India&domain=micron.com',
  )
  assert.equal(micron.LISTING_API_URL, 'https://careers.micron.com/api/pcsx/search')
  assert.equal(
    micron.buildListingApiUrl(),
    'https://careers.micron.com/api/pcsx/search?domain=micron.com&query=&location=India&start=0&limit=10',
  )
  assert.equal(
    micron.buildListingApiUrl({ start: 10, limit: 5 }),
    'https://careers.micron.com/api/pcsx/search?domain=micron.com&query=&location=India&start=10&limit=5',
  )
  assert.equal(
    micron.buildDetailApiUrl(42296091),
    'https://careers.micron.com/api/pcsx/position_details?position_id=42296091&domain=micron.com&hl=en',
  )
  assert.match(micron.VERIFIED_SURFACE_SUMMARY, /Search current jobs/i)
  assert.match(micron.VERIFIED_SURFACE_SUMMARY, /Search jobs/i)
  assert.match(micron.VERIFIED_SURFACE_SUMMARY, /micron\.eightfold\.ai\/careers\?location=India&domain=micron\.com/i)
  assert.match(micron.VERIFIED_SURFACE_SUMMARY, /288 live India openings/i)
  assert.match(micron.VERIFIED_SURFACE_SUMMARY, /STAFF ENG-HIG-HBM-LAYOUT/i)
  assert.equal(micron.hasOfficialMicronIndiaCareersSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(micron.hasOfficialMicronIndiaCareersSignal('<html><body>unexpected</body></html>'), false)
  assert.equal(micron.isIndiaLocation('Hyderabad, Telangana, India'), true)
  assert.equal(micron.isIndiaLocation('Boise, Idaho, United States'), false)
})

test('Micron Technology India verifies the official handoff and rejects thin original detail identity before queued peer reads', async () => {
  const micron = await loadModule()
  const requestedUrls = []
  const scraper = micron.createMicronTechnologyIndiaScraper()
  const expectedListingUrl = micron.buildListingApiUrl()
  const expectedIndiaDetailUrl = micron.buildDetailApiUrl(42296091)
  const expectedUsDetailUrl = micron.buildDetailApiUrl(42296092)

  // The original thin details have no listing-owned ID, title, workplace or
  // positionURL. Keep those bytes unchanged and require an unavailable result.
  let returnedJobs
  await assert.rejects(async () => {
    returnedJobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === micron.OFFICIAL_CAREERS_URL) {
        return OFFICIAL_CAREERS_HTML
      }

      throw new Error(`Unexpected Micron Technology India text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)

      if (url === expectedListingUrl) {
        return SEARCH_PAYLOAD
      }

      if (url === expectedIndiaDetailUrl) {
        return DETAIL_PAYLOADS[42296091]
      }

      if (url === expectedUsDetailUrl) {
        return DETAIL_PAYLOADS[42296092]
      }

      throw new Error(`Unexpected Micron Technology India JSON URL: ${url}`)
    },
    })
  }, error => error.incompleteScope === true && /identity mismatch/.test(error.message))
  assert.equal(returnedJobs, undefined)

  assert.deepEqual(
    [...requestedUrls].sort(),
    [
      micron.OFFICIAL_CAREERS_URL,
      expectedListingUrl,
      expectedIndiaDetailUrl,
    ].sort(),
  )
  // Original synthetic identity, JD, application and native-date facts remain
  // explicit. Full successful DTO coverage uses the separately captured role.
  assert.deepEqual(SEARCH_PAYLOAD.data.positions.map(row => [row.id, row.displayJobId, row.locations[0], row.postedTs]), [
    [42296091, 'JR102906', 'Hyderabad, Telangana, India', 1780963200],
    [42296092, 'JR102999', 'Boise, Idaho, United States', 1780963200],
  ])
  assert.equal(DETAIL_PAYLOADS[42296091].data.jobDescription, '<p>Required Experience: 6 years in HBM layout design.</p>')
  assert.equal(DETAIL_PAYLOADS[42296091].data.publicUrl, 'https://careers.micron.com/careers/job/42296091')
  assert.equal(DETAIL_PAYLOADS[42296092].data.jobDescription, '<p>Required Experience: 4 years in US manufacturing operations.</p>')
  assert.equal(DETAIL_PAYLOADS[42296092].data.publicUrl, 'https://careers.micron.com/careers/job/42296092')
  assert.equal(new Date(DETAIL_PAYLOADS[42296091].data.postedTs * 1000).toISOString(), '2026-06-09T00:00:00.000Z')
})

test('Micron Technology India fails closed when the verified official careers page no longer matches the public jobs handoff', async () => {
  const micron = await loadModule()

  await assert.rejects(
    micron.createMicronTechnologyIndiaScraper().run({
      fetchText: async () => '<html><body>No verified handoff here</body></html>',
      fetchJson: async () => SEARCH_PAYLOAD,
    }),
    /verified Micron India careers page/i,
  )
})
