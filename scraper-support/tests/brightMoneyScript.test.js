import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-14T00:00:00.000Z'
const PUBLIC_TOKEN =
  'eyJhbGciOiJFZERTQSJ9.example-public-token.signature'

const officialOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Bright Money | Openings</title>
  </head>
  <body>
    <section id="open-roles-section">
      <h2>Current Openings</h2>
      <div id="openingsGrid"></div>
      <div id="openingsPagination"></div>
      <select class="open-roles-select"></select>
    </section>
    <script>
      (function() {
        const KULA_PUBLIC_TOKEN = "${PUBLIC_TOKEN}";
        const API_BASE = "https://api.kula.ai/v1/job-boards/job-posts";
      })();
    </script>
  </body>
</html>
`

const kulaPayload = {
  data: [
    {
      id: 11994,
      job_id: 25592,
      job_board_url: 'https://careers.kula.ai/brightmoney/11994',
      title: 'SDE III - Backend',
      workplace: 'office',
      employment_type: 'full_time',
      department: {
        id: 3160,
        name: 'Backend',
      },
      offices: [
        {
          id: 630,
          name: 'India',
          location: 'Bengaluru Urban, Karnataka, India',
          country: 'India',
          state: 'Karnataka',
          city: 'Bangalore Division',
        },
      ],
    },
    {
      id: 14001,
      job_id: 30001,
      job_board_url: 'https://careers.kula.ai/brightmoney/14001',
      title: 'Product Designer',
      workplace: 'office',
      employment_type: 'full_time',
      department: {
        id: 4100,
        name: 'Design',
      },
      offices: [
        {
          id: 998,
          name: 'United States',
          location: 'San Francisco, California, USA',
          country: 'USA',
          state: 'California',
          city: 'San Francisco',
        },
      ],
    },
  ],
  meta: {
    total_pages: 1,
  },
}

const loadBrightMoneyModule = async () => {
  try {
    return await import('../../scraper/brightmoney/script.js')
  } catch {
    assert.fail('Expected Bright Money scraper module at ../../scraper/brightmoney/script.js')
  }
}

test('Bright Money scraper pins the verified official openings page and inline public Kula API contract', async () => {
  const brightMoney = await loadBrightMoneyModule()

  assert.equal(brightMoney.SOURCE, 'brightmoney')
  assert.equal(brightMoney.COMPANY, 'Bright Money')
  assert.equal(brightMoney.OFFICIAL_CAREERS_URL, 'https://www.brightmoney.co/openings')
  assert.equal(brightMoney.KULA_API_URL, 'https://api.kula.ai/v1/job-boards/job-posts')
  assert.equal(brightMoney.extractKulaPublicToken(officialOpeningsHtml), PUBLIC_TOKEN)
  assert.equal(brightMoney.hasOfficialCareersSignal(officialOpeningsHtml), true)
  assert.equal(
    brightMoney.buildApiUrl({ page: 1, limit: 100 }),
    'https://api.kula.ai/v1/job-boards/job-posts?page=1&limit=100',
  )
})

test('extractIndiaJobsFromKulaPayload keeps only India jobs from the verified Bright Money board payload', async () => {
  const brightMoney = await loadBrightMoneyModule()

  const jobs = brightMoney.extractIndiaJobsFromKulaPayload(kulaPayload, {
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs, [
    {
      title: 'SDE III - Backend',
      company: 'Bright Money',
      department: 'Backend',
      location: 'Bengaluru Urban, Karnataka, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '11994',
      requisitionId: '25592',
      sourceUrl: 'https://careers.kula.ai/brightmoney/11994',
      applyUrl: 'https://careers.kula.ai/brightmoney/11994',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
      source: 'brightmoney',
      link: 'https://careers.kula.ai/brightmoney/11994',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Bright Money run validates the first-party openings page before fetching the public Kula jobs API', async () => {
  const brightMoney = await loadBrightMoneyModule()
  const requested = []

  const jobs = await brightMoney.createBrightMoneyScraper({ now: () => FIXED_SCRAPED_AT }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      return officialOpeningsHtml
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, options })
      return kulaPayload
    },
  })

  assert.deepEqual(requested, [
    {
      type: 'text',
      url: 'https://www.brightmoney.co/openings',
    },
    {
      type: 'json',
      url: 'https://api.kula.ai/v1/job-boards/job-posts?page=1&limit=100',
      options: {
        headers: {
          Authorization: `Bearer ${PUBLIC_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'brightmoney')
})

test('Bright Money fails closed when the verified openings page or inline public token changes', async () => {
  const brightMoney = await loadBrightMoneyModule()

  await assert.rejects(
    brightMoney.createBrightMoneyScraper().run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
      fetchJson: async () => kulaPayload,
    }),
    /verified official bright money openings surface/i,
  )

  await assert.rejects(
    brightMoney.createBrightMoneyScraper().run({
      fetchText: async () =>
        officialOpeningsHtml.replace(PUBLIC_TOKEN, ''),
      fetchJson: async () => kulaPayload,
    }),
    /verified inline kula public token/i,
  )
})
