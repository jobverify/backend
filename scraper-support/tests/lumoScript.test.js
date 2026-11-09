import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  HOMEPAGE_URL,
  createLumoScraper,
  extractIndiaJobsFromGreenhousePayload,
  run,
} from '../../scraper/lumo/script.js'

const homepageHtml = `
  <html>
    <head><title>Lumo: Privacy-first AI assistant where chats stay confidential</title></head>
    <body>
      <h1>Hey, I'm Lumo</h1>
      <p>The AI that respects your privacy</p>
      <p>Built by the team that knows privacy</p>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head><title>Career opportunities | Proton</title></head>
    <body>
      <h1>Working at Proton</h1>
      <astro-island component-url="/_astro/JobsListSection.js"></astro-island>
      <script>
        fetch("https://boards-api.greenhouse.io/v1/boards/proton/jobs?content=true")
      </script>
    </body>
  </html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 101,
      title: 'Senior Product Designer',
      absolute_url: 'https://job-boards.greenhouse.io/proton/jobs/101',
      location: { name: 'Geneva, Switzerland' },
      offices: [{ location: 'Geneva, Switzerland' }],
      departments: [{ name: 'Design' }],
      metadata: [{ name: 'Job group', value: 'Product' }],
      first_published: '2026-07-18T08:00:00Z',
      content: '<p>Design private products.</p>',
    },
  ],
}

const indiaGreenhousePayload = {
  jobs: [
    {
      id: 202,
      title: 'Lumo ML Engineer',
      absolute_url: 'https://job-boards.greenhouse.io/proton/jobs/202',
      location: { name: 'Bengaluru, India' },
      offices: [{ location: 'Bengaluru, India' }],
      departments: [{ name: 'Engineering' }],
      metadata: [{ name: 'Job group', value: 'AI' }],
      first_published: '2026-07-18T08:00:00Z',
      content: '<p>Build privacy-first AI.</p>',
    },
  ],
}

test('Lumo scraper validates the verified first-party homepage and Proton Greenhouse surface', async () => {
  const seenUrls = []
  const scraper = createLumoScraper()

  const fetchPage = async (url) => {
    seenUrls.push(url)

    if (url === HOMEPAGE_URL) {
      return { status: 200, url, html: homepageHtml }
    }

    if (url === CAREERS_URL) {
      return { status: 200, url, html: careersHtml }
    }

    throw new Error(`Unexpected URL requested during test: ${url}`)
  }

  await assert.deepEqual(
    await scraper.run({ fetchPage, fetchJson: async () => greenhousePayload }),
    [],
  )
  await assert.deepEqual(
    await run({ fetchPage, fetchJson: async () => greenhousePayload }),
    [],
  )
  assert.deepEqual(seenUrls, [HOMEPAGE_URL, CAREERS_URL, HOMEPAGE_URL, CAREERS_URL])
})

test('Lumo Greenhouse mapper keeps India roles under the shared scraper contract', async () => {
  assert.deepEqual(extractIndiaJobsFromGreenhousePayload(greenhousePayload), [])

  const jobs = extractIndiaJobsFromGreenhousePayload(indiaGreenhousePayload)

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Lumo ML Engineer')
  assert.equal(jobs[0].company, 'Lumo')
  assert.equal(jobs[0].department, 'AI')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceUrl, 'https://job-boards.greenhouse.io/proton/jobs/202')
})


test('Lumo follows fingerprinted Proton careers module and verifies its exact Greenhouse tenant', async () => {
  const moduleUrl = 'https://proton.me/_astro/JobsListSection.DNLPAYuG.js'
  const currentCareersHtml = '<title>Career opportunities | Proton</title><h2>Open positions</h2><astro-island component-url="/_astro/JobsListSection.DNLPAYuG.js"></astro-island>'
  const seen = []
  const fetchPage = async (url) => {
    seen.push(url)
    return { status: 200, url, html: url === HOMEPAGE_URL ? homepageHtml : url === CAREERS_URL ? currentCareersHtml : 'const endpoint="https://boards-api.greenhouse.io/v1/boards/proton/jobs";' }
  }
  assert.deepEqual(await run({ fetchPage, fetchJson: async () => greenhousePayload }), [])
  assert.ok(seen.includes(moduleUrl))
  await assert.rejects(run({ fetchPage: async (url) => {
    const page = await fetchPage(url)
    return url === moduleUrl ? { ...page, html: 'const endpoint="https://boards-api.greenhouse.io/v1/boards/unrelated/jobs";' } : page
  }, fetchJson: async () => assert.fail('Must not fetch an unverified board') }), /Greenhouse handoff/i)
})

test('Lumo rejects malformed India jobs instead of accepting a partial snapshot', () => {
  const payload = structuredClone(indiaGreenhousePayload)
  payload.jobs[0].absolute_url = 'https://job-boards.greenhouse.io/unrelated/jobs/202'
  assert.throws(() => extractIndiaJobsFromGreenhousePayload(payload), /invalid|incomplete/i)
  payload.jobs[0].absolute_url = indiaGreenhousePayload.jobs[0].absolute_url
  payload.jobs[0].title = ''
  assert.throws(() => extractIndiaJobsFromGreenhousePayload(payload), /invalid|incomplete/i)
})
