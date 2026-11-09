import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T12:00:00.000Z'

const careersLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Sapphire Foods</title>
  </head>
  <body>
    <h1>Careers</h1>
    <a href="https://www.sapphire.terbiumsolutions.com/careers/store-careers">Store Careers</a>
    <a href="https://www.sapphire.terbiumsolutions.com/careers/corporate-careers">Corporate Careers</a>
    <footer>Sapphire Foods India Ltd.</footer>
  </body>
</html>
`

const storeCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>store careers</title>
  </head>
  <body>
    <h1>store careers</h1>
    <p>Working at a Sapphire Foods store</p>
    <p>send your CV to careers@sapphirefoods.in</p>
    <footer>Sapphire Foods India Ltd.</footer>
  </body>
</html>
`

const corporateCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>corporate careers</title>
  </head>
  <body>
    <h1>corporate careers</h1>
    <p>Restaurant Support Centre</p>
    <footer>Sapphire Foods India Ltd.</footer>
  </body>
</html>
`

const notFoundShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page not found | Sapphire Foods</title>
  </head>
  <body>
    <h1>Page not found</h1>
    <p>We're sorry, but the page you requested cannot be found.</p>
    <a href="https://www.sapphire.terbiumsolutions.com/careers/store-careers">Store Careers</a>
    <a href="https://www.sapphire.terbiumsolutions.com/careers/corporate-careers">Corporate Careers</a>
    <footer>Sapphire Foods India Ltd.</footer>
  </body>
</html>
`

const storeRoleCards = [
  {
    title: 'Assistant Restaurant Manager',
    summary:
      'The Assistant Restaurant Manager has the overall responsibility for directing the daily operations of a restaurant in the absence of Restaurant General Manager.',
    brand: 'Pizza Hut',
    location: 'Mumbai',
    vacancies: '2',
    href: 'https://www.sapphire.terbiumsolutions.com/careers/store-careers/assistant-restaurant-manager',
  },
  {
    title: 'Restaurant General Manager',
    summary:
      'The Restaurant General Manager has the overall responsibility for directing the daily operations of a restaurant.',
    brand: 'KFC',
    location: 'Delhi',
    vacancies: '5',
    href: 'https://www.sapphire.terbiumsolutions.com/careers/store-careers/restaurant-general-manager',
  },
]

const corporateRoleCards = [
  {
    title: 'Manager - Treasury ( Finance & Accounts)',
    summary:
      "Oversee the administration and management of company's Treasury operations including investment, fund disbursements and cash flow management.",
    brand: 'Shared',
    location: 'Mumbai',
    vacancies: '1',
    href: 'https://www.sapphire.terbiumsolutions.com/careers/corporate-careers/manager-treasury-finance-accounts',
  },
  {
    title: 'Operations Manager - Gujarat',
    summary: 'We are looking for Operations Manager to lead our Pizza Hut business in the Gujarat region.',
    brand: 'Pizza Hut',
    location: 'Ahmedabad',
    vacancies: '1',
    href: 'https://www.sapphire.terbiumsolutions.com/careers/corporate-careers/operations-manager-gujarat',
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/sapphirefoods/script.js')
  } catch {
    assert.fail('Expected Sapphire Foods scraper module at ../../scraper/sapphirefoods/script.js')
  }
}

test('Sapphire Foods helpers stay pinned to the verified official careers routes and empty-state shell', async () => {
  const sapphire = await loadModule()

  assert.equal(sapphire.SOURCE, 'sapphirefoods')
  assert.equal(sapphire.COMPANY, 'Sapphire Foods')
  assert.equal(sapphire.OFFICIAL_BRAND_NAME, 'Sapphire Foods India Ltd.')
  assert.equal(sapphire.VERIFIED_ON, '2026-08-04')
  assert.equal(sapphire.HOMEPAGE_URL, 'https://www.sapphirefoods.in/')
  assert.equal(sapphire.CAREERS_LANDING_URL, 'https://www.sapphire.terbiumsolutions.com/careers')
  assert.equal(
    sapphire.STORE_CAREERS_URL,
    'https://www.sapphire.terbiumsolutions.com/careers/store-careers',
  )
  assert.equal(
    sapphire.CORPORATE_CAREERS_URL,
    'https://www.sapphire.terbiumsolutions.com/careers/corporate-careers',
  )
  assert.equal(sapphire.hasCareersLandingSignal(careersLandingHtml), true)
  assert.equal(sapphire.hasCareersLandingSignal('<html><body>Careers</body></html>'), false)
  assert.equal(sapphire.hasStoreCareersSignal(storeCareersHtml), true)
  assert.equal(sapphire.hasCorporateCareersSignal(corporateCareersHtml), true)
  assert.equal(sapphire.hasVerifiedNotFoundShell(notFoundShellHtml), true)
  assert.equal(sapphire.normalizeBrand('shared'), 'Shared')
  assert.equal(sapphire.normalizeLocationToCountry('Mumbai').country, 'India')
  assert.deepEqual(
    sapphire.buildJobsFromRoleCards(storeRoleCards, 'Store Careers'),
    [
      {
        title: 'Assistant Restaurant Manager',
        company: 'Sapphire Foods',
        department: 'Pizza Hut',
        location: 'Mumbai, India',
        city: 'Mumbai',
        state: null,
        country: 'India',
        jobId: 'assistant-restaurant-manager',
        requisitionId: 'assistant-restaurant-manager',
        sourceUrl: 'https://www.sapphire.terbiumsolutions.com/careers/store-careers/assistant-restaurant-manager',
        applyUrl: 'https://www.sapphire.terbiumsolutions.com/careers/store-careers/assistant-restaurant-manager',
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription:
          'The Assistant Restaurant Manager has the overall responsibility for directing the daily operations of a restaurant in the absence of Restaurant General Manager.',
        remoteStatus: 'On-site',
      },
      {
        title: 'Restaurant General Manager',
        company: 'Sapphire Foods',
        department: 'KFC',
        location: 'Delhi, India',
        city: 'Delhi',
        state: null,
        country: 'India',
        jobId: 'restaurant-general-manager',
        requisitionId: 'restaurant-general-manager',
        sourceUrl: 'https://www.sapphire.terbiumsolutions.com/careers/store-careers/restaurant-general-manager',
        applyUrl: 'https://www.sapphire.terbiumsolutions.com/careers/store-careers/restaurant-general-manager',
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription:
          'The Restaurant General Manager has the overall responsibility for directing the daily operations of a restaurant.',
        remoteStatus: 'On-site',
      },
    ],
  )
})

test('Sapphire Foods run validates the official careers surfaces, combines store and corporate role cards, and decorates runner metadata', async () => {
  const sapphire = await loadModule()
  const requestedUrls = []

  const jobs = await sapphire.createSapphireFoodsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === sapphire.CAREERS_LANDING_URL) return { status: 200, url, html: careersLandingHtml }
      if (url === sapphire.STORE_CAREERS_URL) return { status: 200, url, html: storeCareersHtml }
      if (url === sapphire.CORPORATE_CAREERS_URL) return { status: 200, url, html: corporateCareersHtml }
      throw new Error(`Unexpected URL: ${url}`)
    },
    loadRoleCards: async (url) => {
      if (url === sapphire.STORE_CAREERS_URL) return storeRoleCards
      if (url === sapphire.CORPORATE_CAREERS_URL) return corporateRoleCards
      throw new Error(`Unexpected cards URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sapphire.CAREERS_LANDING_URL,
    sapphire.STORE_CAREERS_URL,
    sapphire.CORPORATE_CAREERS_URL,
  ])
  assert.deepEqual(
    jobs.map((job) => [job.title, job.department, job.city, job.source, job.link, job.scrapedAt]),
    [
      [
        'Assistant Restaurant Manager',
        'Pizza Hut',
        'Mumbai',
        'sapphirefoods',
        'https://www.sapphire.terbiumsolutions.com/careers/store-careers/assistant-restaurant-manager',
        FIXED_SCRAPED_AT,
      ],
      [
        'Restaurant General Manager',
        'KFC',
        'Delhi',
        'sapphirefoods',
        'https://www.sapphire.terbiumsolutions.com/careers/store-careers/restaurant-general-manager',
        FIXED_SCRAPED_AT,
      ],
      [
        'Manager - Treasury ( Finance & Accounts)',
        'Shared',
        'Mumbai',
        'sapphirefoods',
        'https://www.sapphire.terbiumsolutions.com/careers/corporate-careers/manager-treasury-finance-accounts',
        FIXED_SCRAPED_AT,
      ],
      [
        'Operations Manager - Gujarat',
        'Pizza Hut',
        'Ahmedabad',
        'sapphirefoods',
        'https://www.sapphire.terbiumsolutions.com/careers/corporate-careers/operations-manager-gujarat',
        FIXED_SCRAPED_AT,
      ],
    ],
  )
  assert.equal(jobs.length, 4)
})

test('Sapphire Foods run returns no jobs when all verified official careers routes resolve to the branded empty-state shell', async () => {
  const sapphire = await loadModule()
  const requestedUrls = []
  const roleCardLoads = []

  const jobs = await sapphire.createSapphireFoodsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return { status: 404, url, html: notFoundShellHtml }
    },
    loadRoleCards: async (url) => {
      roleCardLoads.push(url)
      return []
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedUrls, [
    sapphire.CAREERS_LANDING_URL,
    sapphire.STORE_CAREERS_URL,
    sapphire.CORPORATE_CAREERS_URL,
  ])
  assert.deepEqual(roleCardLoads, [])
})

test('Sapphire Foods browser role loader opens the official role page and returns extracted role cards', async () => {
  const sapphire = await loadModule()
  const interactions = []
  const fakePage = {
    goto: async (url, options) => {
      interactions.push(['goto', url, options.waitUntil])
    },
    waitForSelector: async (selector) => {
      interactions.push(['waitForSelector', selector])
    },
    evaluate: async () => storeRoleCards,
  }

  const loader = sapphire.createBrowserRoleCardsLoader({
    launchBrowserImpl: async () => ({
      close: async () => {
        interactions.push(['close'])
      },
    }),
    createOptimizedPageImpl: async () => fakePage,
  })

  const cards = await loader.load(sapphire.STORE_CAREERS_URL)

  assert.deepEqual(cards, storeRoleCards)
  assert.deepEqual(interactions, [
    ['goto', 'https://www.sapphire.terbiumsolutions.com/careers/store-careers', 'networkidle2'],
    ['waitForSelector', 'a[href]'],
    ['close'],
  ])
})

test('Sapphire Foods fails closed when the verified official surfaces drift materially', async () => {
  const sapphire = await loadModule()

  await assert.rejects(
    sapphire.createSapphireFoodsScraper().run({
      fetchPage: async (url) => {
        if (url === sapphire.CAREERS_LANDING_URL) return { status: 200, url, html: '<html><body>Careers</body></html>' }
        if (url === sapphire.STORE_CAREERS_URL) return { status: 404, url, html: notFoundShellHtml }
        if (url === sapphire.CORPORATE_CAREERS_URL) return { status: 404, url, html: notFoundShellHtml }
        throw new Error(`Unexpected URL: ${url}`)
      },
      loadRoleCards: async () => [],
    }),
    /official Sapphire Foods careers landing page/i,
  )

  await assert.rejects(
    sapphire.createSapphireFoodsScraper().run({
      fetchPage: async (url) => {
        if (url === sapphire.CAREERS_LANDING_URL) return { status: 200, url, html: careersLandingHtml }
        if (url === sapphire.STORE_CAREERS_URL) return { status: 200, url, html: '<html><body>Store Careers</body></html>' }
        if (url === sapphire.CORPORATE_CAREERS_URL) return { status: 200, url, html: corporateCareersHtml }
        throw new Error(`Unexpected URL: ${url}`)
      },
      loadRoleCards: async () => [],
    }),
    /official Sapphire Foods store careers page/i,
  )
})
