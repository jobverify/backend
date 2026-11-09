import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'

const FIXED_SCRAPED_AT = '2026-07-25T00:00:00.000Z'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>GitBook Careers</title>
  </head>
  <body>
    <main>
      <h1>Help build the future of docs for technical teams</h1>
      <p>We are 43 people working across 18 countries and we are growing fast.</p>
      <h2>Open roles</h2>
      <section>
        <h3>Data</h3>
        <article>
          <h4>Growth &amp; Data (IC)</h4>
          <p>Europe (+/- 3 hours)</p>
          <p>FullTime</p>
          <p>Remote</p>
          <a href="https://jobs.ashbyhq.com/GitBook">Apply now</a>
        </article>
      </section>
      <section>
        <h3>Product &amp; Engineering</h3>
        <article>
          <h4>Security Engineer</h4>
          <p>Europe (+/- 3 hours)</p>
          <p>FullTime</p>
          <p>Remote</p>
          <a href="https://jobs.ashbyhq.com/GitBook">Apply now</a>
        </article>
      </section>
    </main>
  </body>
</html>
`

const ASHBY_PAYLOAD = {
  jobs: [
    {
      id: '078366b2-ab19-41cd-aaa4-0fa9a7a324ae',
      title: 'Growth & Data (IC)',
      department: 'Data',
      team: 'Data',
      employmentType: 'FullTime',
      location: 'Europe (+/- 3 hours)',
      secondaryLocations: [],
      publishedAt: '2026-07-22T10:00:00.000+00:00',
      isListed: true,
      isRemote: true,
      workplaceType: 'Remote',
      address: {
        postalAddress: {
          addressCountry: 'Remote',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/gitbook/078366b2-ab19-41cd-aaa4-0fa9a7a324ae',
      applyUrl: 'https://jobs.ashbyhq.com/gitbook/078366b2-ab19-41cd-aaa4-0fa9a7a324ae/application',
      descriptionPlain: 'Own growth questions end-to-end using data and user research.',
    },
    {
      id: '734f7bb0-7add-4be8-a38a-74e20dfd5e4a',
      title: 'Security Engineer',
      department: 'Product & Engineering',
      team: 'Security',
      employmentType: 'FullTime',
      location: 'Europe (+/- 3 hours)',
      secondaryLocations: [],
      publishedAt: '2026-07-20T09:30:00.000+00:00',
      isListed: true,
      isRemote: true,
      workplaceType: 'Remote',
      address: {
        postalAddress: {
          addressCountry: 'Remote',
        },
      },
      jobUrl: 'https://jobs.ashbyhq.com/gitbook/734f7bb0-7add-4be8-a38a-74e20dfd5e4a',
      applyUrl: 'https://jobs.ashbyhq.com/gitbook/734f7bb0-7add-4be8-a38a-74e20dfd5e4a/application',
      descriptionPlain: 'Build safeguards and security tooling across GitBook.',
    },
    {
      id: 'ignore-me',
      title: 'Hidden role',
      department: 'Operations',
      employmentType: 'FullTime',
      location: 'Europe',
      secondaryLocations: [],
      publishedAt: '2026-07-21T09:30:00.000+00:00',
      isListed: false,
      jobUrl: 'https://jobs.ashbyhq.com/gitbook/ignore-me',
      applyUrl: 'https://jobs.ashbyhq.com/gitbook/ignore-me/application',
      descriptionPlain: 'Should not surface publicly.',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/gitbook/script.js')
  } catch {
    assert.fail('Expected GitBook scraper module at ../../scraper/gitbook/script.js')
  }
}

test('GitBook pins the verified official careers and Ashby endpoints', async () => {
  const gitbook = await loadModule()

  assert.equal(gitbook.SOURCE, 'gitbook')
  assert.equal(gitbook.COMPANY, 'GitBook')
  assert.equal(gitbook.CAREERS_PAGE_URL, 'https://www.gitbook.com/careers')
  assert.equal(gitbook.ASHBY_PUBLIC_BOARD_URL, 'https://jobs.ashbyhq.com/GitBook')
  assert.equal(
    gitbook.ASHBY_JOB_BOARD_URL,
    'https://api.ashbyhq.com/posting-api/job-board/GitBook',
  )
  assert.equal(gitbook.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(
    gitbook.extractVerifiedAshbyPublicBoardUrl(CAREERS_HTML),
    'https://jobs.ashbyhq.com/GitBook',
  )
  assert.equal(
    gitbook.buildAshbyJobBoardUrl('https://jobs.ashbyhq.com/GitBook'),
    'https://api.ashbyhq.com/posting-api/job-board/GitBook',
  )
})

test('GitBook extracts listed jobs from the verified Ashby payload into shared scraper fields', async () => {
  const gitbook = await loadModule()
  const jobs = gitbook.extractAshbyJobs(ASHBY_PAYLOAD)

  assert.deepEqual(jobs, [
    {
      title: 'Growth & Data (IC)',
      company: 'GitBook',
      department: 'Data',
      location: 'Europe (+/- 3 hours)',
      city: null,
      state: null,
      country: 'Remote',
      jobId: '078366b2-ab19-41cd-aaa4-0fa9a7a324ae',
      requisitionId: '078366b2-ab19-41cd-aaa4-0fa9a7a324ae',
      sourceUrl: 'https://jobs.ashbyhq.com/gitbook/078366b2-ab19-41cd-aaa4-0fa9a7a324ae',
      applyUrl: 'https://jobs.ashbyhq.com/gitbook/078366b2-ab19-41cd-aaa4-0fa9a7a324ae/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-22T10:00:00.000+00:00',
      closingDate: null,
      jobDescription: 'Own growth questions end-to-end using data and user research.',
      remoteStatus: 'Remote',
    },
    {
      title: 'Security Engineer',
      company: 'GitBook',
      department: 'Product & Engineering',
      location: 'Europe (+/- 3 hours)',
      city: null,
      state: null,
      country: 'Remote',
      jobId: '734f7bb0-7add-4be8-a38a-74e20dfd5e4a',
      requisitionId: '734f7bb0-7add-4be8-a38a-74e20dfd5e4a',
      sourceUrl: 'https://jobs.ashbyhq.com/gitbook/734f7bb0-7add-4be8-a38a-74e20dfd5e4a',
      applyUrl: 'https://jobs.ashbyhq.com/gitbook/734f7bb0-7add-4be8-a38a-74e20dfd5e4a/application',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-20T09:30:00.000+00:00',
      closingDate: null,
      jobDescription: 'Build safeguards and security tooling across GitBook.',
      remoteStatus: 'Remote',
    },
  ])
})

test('GitBook rejects a legacy body-only employer response without HTTP identity evidence', async () => {
  const gitbook = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  await assert.rejects(gitbook.createGitBookScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === gitbook.CAREERS_PAGE_URL) return CAREERS_HTML
      throw new Error(`Unexpected GitBook text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      return ASHBY_PAYLOAD
    },
  }),/employer response unavailable/i)

  assert.deepEqual(requestedTexts, [gitbook.CAREERS_PAGE_URL])
  assert.deepEqual(requestedJson, [])
})

test('GitBook fails closed when the verified careers page, Ashby handoff, or payload drift', async () => {
  const gitbook = await loadModule()

  await assert.rejects(
    gitbook.createGitBookScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchJson: async () => ASHBY_PAYLOAD,
    }),
    /employer response unavailable/i,
  )

  await assert.rejects(
    gitbook.createGitBookScraper().run({
      fetchPage: async () => ({status:200,url:gitbook.CAREERS_PAGE_URL,
        html:CAREERS_HTML.replaceAll('jobs.ashbyhq.com/GitBook', 'jobs.ashbyhq.com/Other')}),
      fetchJson: async () => ASHBY_PAYLOAD,
    }),
    /employer.*handoff/i,
  )

  await assert.rejects(
    gitbook.createGitBookScraper().run({
      fetchPage: async () => {
        const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/gitbook/fixtures/current-http-20261030.json.gz',import.meta.url))))
        const row=fixture.responses.find(value=>value.url===gitbook.CAREERS_PAGE_URL)
        return{status:row.status,url:row.finalUrl,html:row.body}
      },
      fetchJson: async () => ({ postings: [] }),
    }),
    /invalid ashby inventory/i,
  )
})

test('GitBook accepts the current role-agnostic careers page while the Ashby handoff remains stable', async () => {
  const gitbook = await loadModule()

  const liveCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>GitBook Careers</title>
    </head>
    <body>
      <a href="#open-roles">See open roles</a>
      <h2 id="open-roles">Open roles</h2>
      <article>
        <h3>Enterprise Migrations Engineer</h3>
        <p>Europe (+/- 3 hours)</p>
        <a href="https://jobs.ashbyhq.com/GitBook">Apply now</a>
      </article>
    </body>
  </html>
  `

  assert.equal(gitbook.hasOfficialCareersSignal(liveCareersHtml), true)
  assert.equal(
    gitbook.extractVerifiedAshbyPublicBoardUrl(liveCareersHtml),
    'https://jobs.ashbyhq.com/GitBook',
  )
})
