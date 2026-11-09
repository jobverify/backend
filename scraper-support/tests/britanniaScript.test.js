import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { TURBOHIRE_CURRENT_PUBLIC_CLIENT } from '../utils/turboHirePublicClient.js'

const sdk = JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/turbohire-stage2-public-client.json.gz', import.meta.url))))

const loadBritanniaModule = async () => {
  try {
    return await import('../../scraper/britannia/script.js')
  } catch {
    assert.fail('Expected Britannia scraper module at ../../scraper/britannia/script.js')
  }
}

const careersHtml = `
  <html lang="en">
    <head>
      <title>Explore Britannia Careers: Exciting Job Opportunities Await !</title>
      <link rel="canonical" href="https://www.britannia.co.in/careers">
    </head>
    <body>
      <h1>WE GROW WHEN OUR PEOPLE GROW</h1>
      <a href="https://britannia.turbohire.co/careerpage/c143932d-0df7-4856-9dc5-0a9f1ca26dc5">WE'RE HIRING</a>
    </body>
  </html>
`

const boardHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Britannia Industries</title>
      <meta property="og:title" content="Britannia Industries - Career Page">
      <meta property="og:site_name" content="Britannia Industries">
    </head>
    <body>
      <div id="root"></div>
      <script src="/main.f9eb0b1ea3273f6dfc17.chunk.js"></script>
    </body>
  </html>
`

const sampleTurboHirePayload = {
  Total: 2,
  Result: [
    {
      JobId: '5586ffa0-79df-4465-af1b-0a7cee325095',
      JobIdObfuscated: '183sHo3wsyhNL%2FtZixp4sa3LVdaHQ0KAvtoDNl7VpX4L9wHS1%2FW8B60e7N094U0H',
      JobCode: 'BI-69466',
      JobTitle: 'Production Officer',
      Department: 'Manufacturing',
      PublishedDate: '2026-07-10T11:31:33.925923Z',
      ExpiryDates: {
        CAREERPAGE: '2026-07-31T00:00:00',
      },
      Location: '[{"Address":"Barabanki, Uttar Pradesh, India"}]',
      JobTypeV2: 'Full Time',
      Experience: {
        MinExp: 2,
        MaxExp: 4,
      },
      Skills: [
        'Batch Operations',
        'Quality Systems',
      ],
      JobDescV2: '<p>Lead production batches for packaged foods.</p>',
      OrgDetails: {
        OrgID: 'c143932d-0df7-4856-9dc5-0a9f1ca26dc5',
        OrgName: 'Britannia Industries',
      },
    },
    {
      JobId: 'non-india-role',
      JobIdObfuscated: 'ignored',
      JobCode: 'BI-X',
      JobTitle: 'Global Category Lead',
      Department: 'International',
      PublishedDate: '2026-07-10T11:31:33.925923Z',
      ExpiryDates: {
        CAREERPAGE: '2026-07-31T00:00:00',
      },
      Location: '[{"Address":"Dubai, United Arab Emirates"}]',
      JobTypeV2: 'Full Time',
      Experience: {
        MinExp: 8,
        MaxExp: 10,
      },
      Skills: ['Global Trade'],
      JobDescV2: '<p>Ignore non-India roles.</p>',
      OrgDetails: {
        OrgID: 'c143932d-0df7-4856-9dc5-0a9f1ca26dc5',
        OrgName: 'Britannia Industries',
      },
    },
  ],
}

test('Britannia scraper pins the verified official careers page, TurboHire board, and feed', async () => {
  const britannia = await loadBritanniaModule()

  assert.equal(britannia.OFFICIAL_CAREERS_URL, 'https://www.britannia.co.in/careers')
  assert.equal(
    britannia.BOARD_URL,
    'https://britannia.turbohire.co/careerpage/c143932d-0df7-4856-9dc5-0a9f1ca26dc5',
  )
  assert.equal(britannia.ORIGIN, 'https://britannia.turbohire.co')
  assert.equal(britannia.ORG_ID, 'c143932d-0df7-4856-9dc5-0a9f1ca26dc5')
  assert.equal(britannia.API_BASE_URL, 'https://thapi-stage2.azurewebsites.net')
  assert.equal(britannia.NOAUTH_TOKEN_URL, 'https://thapi-stage2.azurewebsites.net/api/token/noauth')
  assert.equal(
    britannia.FILTERED_JOBS_URL,
    'https://thapi-stage2.azurewebsites.net/api/careerpagev2/filteredjobs?orgId=c143932d-0df7-4856-9dc5-0a9f1ca26dc5&pageType=0',
  )
  assert.equal(britannia.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(britannia.extractTurboHireHandoffUrl(careersHtml), britannia.BOARD_URL)
  assert.equal(britannia.hasOfficialBoardSignal(boardHtml), true)
})

test('extractPublicJobs normalizes India jobs from the Britannia TurboHire feed', async () => {
  const britannia = await loadBritanniaModule()

  assert.deepEqual(britannia.extractPublicJobs(sampleTurboHirePayload), [
    {
      title: 'Production Officer',
      company: 'Britannia Industries',
      department: 'Manufacturing',
      location: 'Barabanki, Uttar Pradesh, India',
      city: 'Barabanki',
      country: 'India',
      jobId: '5586ffa0-79df-4465-af1b-0a7cee325095',
      requisitionId: 'BI-69466',
      sourceUrl: 'https://britannia.turbohire.co/job/publicjobs/183sHo3wsyhNL%2FtZixp4sa3LVdaHQ0KAvtoDNl7VpX4L9wHS1%2FW8B60e7N094U0H',
      applyUrl: 'https://britannia.turbohire.co/job/publicjobs/183sHo3wsyhNL%2FtZixp4sa3LVdaHQ0KAvtoDNl7VpX4L9wHS1%2FW8B60e7N094U0H',
      employmentType: 'Full Time',
      experienceRequired: '2-4 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Batch Operations',
        'Quality Systems',
      ],
      postingDate: '2026-07-10T11:31:33.925923Z',
      closingDate: '2026-07-31T00:00:00',
      jobDescription: 'Lead production batches for packaged foods.',
    },
  ])
})

test('run validates the official handoff and TurboHire board before reading the public feed', async () => {
  const britannia = await loadBritanniaModule()
  const requested = []

  const jobs = await britannia.createBritanniaScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      if (url === britannia.OFFICIAL_CAREERS_URL) return careersHtml
      if (url === britannia.BOARD_URL) return boardHtml
      if (url === britannia.ORIGIN + TURBOHIRE_CURRENT_PUBLIC_CLIENT.path) return sdk.text
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requested.push({ type: 'json', url, method: options.method || 'GET' })

      if (url === britannia.NOAUTH_TOKEN_URL) {
        return { access_token: 'public-token' }
      }

      if (url === britannia.FILTERED_JOBS_URL) {
        return sampleTurboHirePayload
      }

      if (url.includes('/api/publicjobs/')) return {
        ...sampleTurboHirePayload.Result[0], IsPublic: true, IsDraft: false, JobStatus: 'Active',
        PublishedJobBoards: ['CAREERPAGE'], PublishedDates: { CAREERPAGE: sampleTurboHirePayload.Result[0].PublishedDate },
        JobDescriptionV2: '<p>' + 'Lead food production batches, maintain quality systems and supervise safe manufacturing operations. '.repeat(8) + '</p>',
      }
      throw new Error(`Unexpected json URL: ${url}`)
    },
    now: () => '2026-07-14T00:00:00.000Z', requestIntervalMs: 0,
  })

  assert.deepEqual(requested, [
    { type: 'text', url: britannia.OFFICIAL_CAREERS_URL },
    { type: 'text', url: britannia.BOARD_URL },
    { type: 'text', url: britannia.ORIGIN + TURBOHIRE_CURRENT_PUBLIC_CLIENT.path },
    { type: 'json', url: britannia.NOAUTH_TOKEN_URL, method: 'GET' },
    { type: 'json', url: britannia.FILTERED_JOBS_URL, method: 'POST' },
    { type: 'json', url: britannia.API_BASE_URL + '/api/publicjobs/' + sampleTurboHirePayload.Result[0].JobId + '?fieldVisibility=CareerPage', method: 'GET' },
    { type: 'json', url: britannia.FILTERED_JOBS_URL, method: 'POST' },
    { type: 'text', url: britannia.OFFICIAL_CAREERS_URL },
    { type: 'text', url: britannia.BOARD_URL },
    { type: 'text', url: britannia.ORIGIN + TURBOHIRE_CURRENT_PUBLIC_CLIENT.path },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'britannia')
  assert.equal(jobs[0].company, 'Britannia Industries')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-14T00:00:00.000Z')
})

test('run fails closed when the Britannia TurboHire board signal disappears', async () => {
  const britannia = await loadBritanniaModule()

  await assert.rejects(
    britannia.createBritanniaScraper().run({
      fetchText: async (url) => {
        if (url === britannia.OFFICIAL_CAREERS_URL) return careersHtml
        return '<html><body>Unexpected board</body></html>'
      },
      fetchJson: async () => sampleTurboHirePayload,
    }),
    /official Britannia TurboHire board/i,
  )
})
