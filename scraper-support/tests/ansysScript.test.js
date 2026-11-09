import assert from 'node:assert/strict'
import test from 'node:test'

const loadAnsysModule = async () => {
  try {
    return await import('../../scraper/ansys/script.js')
  } catch {
    assert.fail('Expected Ansys scraper module at ../../scraper/ansys/script.js')
  }
}

const officialCareersHtml = `
  <html>
    <head><title>Careers | Ansys</title></head>
    <body>
      <h1>Careers at Ansys</h1>
      <p>Ansys, part of Synopsys, builds engineering simulation software.</p>
      <a href="https://careers.synopsys.com/search-jobs/ansys/44408/1">Search for Jobs</a>
    </body>
  </html>
`

const searchPageOneHtml = `
  <html>
    <body data-current-page="1" data-total-pages="2" data-total-job-results="3">
      <ul>
        <li class="search-results-list__list-item">
          <a class="sr-job-link" href="/job/pune/technical-support-engineer-optics-photonics-zemax/44408/96200212480">
            <h2>Technical Support Engineer - Optics, Photonics, Zemax</h2>
          </a>
          <span class="job-location">Pune, India</span>
          <span class="category">Category: Customer Support</span>
          <span class="job-date-posted">Posted: 07/13/2026</span>
          <span class="jobId">Job ID: 1001</span>
        </li>
        <li class="search-results-list__list-item">
          <a class="sr-job-link" href="/job/munich/test-role/44408/111">
            <h2>Test Role Germany</h2>
          </a>
          <span class="job-location">Munich, Germany</span>
          <span class="category">Category: Engineering</span>
          <span class="job-date-posted">Posted: 07/10/2026</span>
          <span class="jobId">Job ID: 2002</span>
        </li>
      </ul>
      <a class="next" href="https://careers.synopsys.com/search-jobs/ansys/44408/1&amp;p=2">Next</a>
    </body>
  </html>
`

const searchPageTwoHtml = `
  <html>
    <body data-current-page="2" data-total-pages="2" data-total-job-results="3">
      <ul>
        <li class="search-results-list__list-item">
          <a class="sr-job-link" href="/job/bengaluru/application-engineer/44408/96200212481">
            <h2>Application Engineer</h2>
          </a>
          <span class="job-location">Bengaluru, India</span>
          <span class="category">Category: Engineering</span>
          <span class="job-date-posted">Posted: 07/12/2026</span>
          <span class="jobId">Job ID: 1002</span>
        </li>
      </ul>
    </body>
  </html>
`

test('Ansys scraper pins the verified first-party careers handoff to the Synopsys search route', async () => {
  const ansys = await loadAnsysModule()

  assert.equal(ansys.SOURCE, 'ansys')
  assert.equal(ansys.COMPANY, 'Ansys')
  assert.equal(ansys.CAREERS_PAGE_URL, 'https://www.ansys.com/careers')
  assert.equal(ansys.SEARCH_PAGE_URL, 'https://careers.synopsys.com/search-jobs/ansys/44408/1')
  assert.equal(ansys.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    ansys.extractVerifiedSearchUrl(officialCareersHtml),
    'https://careers.synopsys.com/search-jobs/ansys/44408/1',
  )
  assert.equal(
    ansys.extractNextPageUrl(searchPageOneHtml),
    'https://careers.synopsys.com/search-jobs/ansys/44408/1?p=2',
  )
})

test('Ansys scraper validates the official careers handoff and keeps only India jobs from the Synopsys search pages', async () => {
  const ansys = await loadAnsysModule()
  const requestedUrls = []
  const details = {
    'https://careers.synopsys.com/job/pune/technical-support-engineer-optics-photonics-zemax/44408/96200212480': {
      id: '1001', title: 'Technical Support Engineer - Optics, Photonics, Zemax', city: 'Pune', date: '2026-07-13',
      description: '<p>Design reliable optical simulation tools and help customers resolve engineering problems.</p>',
    },
    'https://careers.synopsys.com/job/bengaluru/application-engineer/44408/96200212481': {
      id: '1002', title: 'Application Engineer', city: 'Bengaluru', date: '2026-07-12',
      description: '<p>Develop engineering applications and deliver reliable systems for customers.</p>',
    },
  }

  const jobs = await ansys.createAnsysScraper({
    maxJobs: 5,
    now: () => '2026-07-14T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === ansys.CAREERS_PAGE_URL) return officialCareersHtml
      if (url === ansys.SEARCH_PAGE_URL) return searchPageOneHtml
      if (url === 'https://careers.synopsys.com/search-jobs/ansys/44408/1?p=2') return searchPageTwoHtml
      if (details[url]) {
        const detail = details[url]
        return '<script type="application/ld+json">' + JSON.stringify({ '@type': 'JobPosting',
          url, title: detail.title, identifier: { value: detail.id }, description: detail.description,
          datePosted: detail.date, hiringOrganization: { name: 'Synopsys' },
          jobLocation: [{ address: { addressLocality: detail.city, addressCountry: 'IN' } }],
        }) + '</script>'
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ansys.CAREERS_PAGE_URL,
    ansys.SEARCH_PAGE_URL,
    'https://careers.synopsys.com/search-jobs/ansys/44408/1?p=2',
    'https://careers.synopsys.com/job/pune/technical-support-engineer-optics-photonics-zemax/44408/96200212480',
    'https://careers.synopsys.com/job/bengaluru/application-engineer/44408/96200212481',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map(job => [job.title, job.jobId, job.location, job.company, job.nativeEmployer, job.country, job.postingDate]), [
    ['Technical Support Engineer - Optics, Photonics, Zemax', '1001', 'Pune, India', 'Ansys', 'Synopsys', 'India', '2026-07-13'],
    ['Application Engineer', '1002', 'Bengaluru, India', 'Ansys', 'Synopsys', 'India', '2026-07-12'],
  ])
  assert.deepEqual(jobs.map(job => job.jobDescription), [
    '<p>Design reliable optical simulation tools and help customers resolve engineering problems.</p>',
    '<p>Develop engineering applications and deliver reliable systems for customers.</p>',
  ])
  assert.ok(jobs.every(job => job.sourceDetailComplete === true && job.sourceListingComplete === false
    && job.source === 'ansys' && job.link === job.applyUrl && job.scrapedAt === '2026-07-14T00:00:00.000Z'))
})

test('Ansys scraper fails closed when the first-party careers handoff changes', async () => {
  const ansys = await loadAnsysModule()

  await assert.rejects(
    ansys.createAnsysScraper().run({
      fetchText: async () => '<html><body><h1>Careers at Ansys</h1><p>No verified handoff.</p></body></html>',
    }),
    /verified synopsys search handoff/i,
  )
})
