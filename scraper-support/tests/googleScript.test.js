import assert from 'node:assert/strict'
import test from 'node:test'

const loadGoogleModule = async () => {
  try {
    return await import('../../scraper/google/script.js')
  } catch {
    assert.fail('Expected Google scraper module at ../../scraper/google/script.js')
  }
}

const PAGE_ONE_URL = 'https://www.google.com/about/careers/applications/jobs/results?location=India'
const PAGE_TWO_URL = 'https://www.google.com/about/careers/applications/jobs/results?location=India&page=2'
const FIRST_JOB_URL = 'https://www.google.com/about/careers/applications/jobs/results/123456789012345678-software-engineer?location=India'
const SECOND_JOB_URL = 'https://www.google.com/about/careers/applications/jobs/results/234567890123456789-data-engineer?location=India'
const FIRST_CANONICAL_URL = FIRST_JOB_URL.replace('?location=India', '')
const SECOND_CANONICAL_URL = SECOND_JOB_URL.replace('?location=India', '')

const detailHtml = (title, years) => `
  <html>
    <body>
      <h2>About the job</h2>
      <div>${title} builds core systems for India hiring.</div>
      <h3>Minimum qualifications</h3>
      <ul>
        <li>${years} years of software development experience</li>
        <li>Experience with distributed systems</li>
      </ul>
      <h3>Preferred qualifications</h3>
      <ul>
        <li>Experience building public cloud services</li>
      </ul>
    </body>
  </html>
`

const listingCardHtml = ({ title, location, href, minimumQualification }) => `
  <li class="lLd3Je" ssk="1">
    <div class="sMn82b">
      <h3 class="QJPWVe">${title}</h3>
      <div class="op1BBf">
        <span class="RP7SMd">
          <span>Google</span>
        </span>
        <span class="pwO9Dc vo5qdf">
          <span class="r0wTof ">${location}</span>
        </span>
      </div>
      <div class="Xsxa1e">
        <h4>Minimum qualifications</h4>
        <ul>
          <li>${minimumQualification}</li>
          <li>Experience with distributed systems</li>
        </ul>
      </div>
      <div class="VfPpkd-LgbsSe">
        <a class="WpHeLc VfPpkd-mRLv6 VfPpkd-RLmnJb" href="${href}" aria-label="Learn more about ${title}"></a>
      </div>
    </div>
  </li>
`

const listingPageHtml = ({ cards, nextUrl }) => `
  <html>
    <body>
      <ul class="spHGqe">
        ${cards.join('\n')}
      </ul>
      ${nextUrl ? `<a class="WpHeLc VfPpkd-mRLv6" href="${nextUrl.replace(/&/g, '&amp;')}" aria-label="Go to next page" rel="no-follow"></a>` : ''}
    </body>
  </html>
`

test('Google scraper paginates raw HTML listing pages and enriches canonical detail URLs', async () => {
  const google = await loadGoogleModule()
  const pageData = {
    [PAGE_ONE_URL]: listingPageHtml({
      cards: [
        listingCardHtml({
          title: 'Software Engineer',
          location: 'Bengaluru, Karnataka, India',
          href: 'jobs/results/123456789012345678-software-engineer?location=India',
          minimumQualification: '5 years of software development experience',
        }),
      ],
      nextUrl: PAGE_TWO_URL,
    }),
    [PAGE_TWO_URL]: listingPageHtml({
      cards: [
        listingCardHtml({
          title: 'Software Engineer',
          location: 'Bengaluru, Karnataka, India',
          href: 'jobs/results/123456789012345678-software-engineer?location=India',
          minimumQualification: '5 years of software development experience',
        }),
        listingCardHtml({
          title: 'Data Engineer',
          location: 'Hyderabad, Telangana, India',
          href: 'jobs/results/234567890123456789-data-engineer?location=India',
          minimumQualification: '4 years of data engineering experience',
        }),
      ],
      nextUrl: null,
    }),
  }
  const requestedDetails = []

  const jobs = await google.createGoogleScraper().run({
    fetchListingsText: async (url) => pageData[url],
    fetchText: async (url) => {
      requestedDetails.push(url)
      if (url === FIRST_CANONICAL_URL) {
        return detailHtml('Software Engineer', 5)
      }
      if (url === SECOND_CANONICAL_URL) {
        return detailHtml('Data Engineer', 4)
      }
      throw new Error(`Unexpected Google detail URL: ${url}`)
    },
    now: () => '2026-08-01T12:34:56.000Z',
  })

  assert.deepEqual(requestedDetails, [
    FIRST_CANONICAL_URL,
    SECOND_CANONICAL_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({ title: job.title, city: job.city, jobId: job.jobId, sourceUrl: job.sourceUrl })),
    [
      {
        title: 'Software Engineer',
        city: 'Bengaluru',
        jobId: '123456789012345678',
        sourceUrl: FIRST_CANONICAL_URL,
      },
      {
        title: 'Data Engineer',
        city: 'Hyderabad',
        jobId: '234567890123456789',
        sourceUrl: SECOND_CANONICAL_URL,
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /Software Engineer builds core systems/i)
  assert.match(jobs[0].experienceRequired, /5 years/i)
  assert.equal(jobs[0].scrapedAt, '2026-08-01T12:34:56.000Z')
})

test('Google scraper falls back to listing-card qualifications when a detail fetch fails', async () => {
  const google = await loadGoogleModule()

  const jobs = await google.createGoogleScraper().run({
    fetchListingsText: async () => listingPageHtml({
      cards: [
        listingCardHtml({
          title: 'Site Reliability Engineer',
          location: 'Remote, India',
          href: 'jobs/results/345678901234567890-site-reliability-engineer?location=India',
          minimumQualification: '6 years of site reliability engineering experience',
        }),
      ],
      nextUrl: null,
    }),
    fetchText: async () => {
      throw new Error('detail page blocked')
    },
    now: () => '2026-08-02T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].city, 'Remote')
  assert.match(jobs[0].minimumQualification, /6 years of site reliability engineering experience/i)
  assert.match(jobs[0].experienceRequired, /6 years/i)
})

test('Google helpers extract cards and next-page URLs from server-rendered HTML', async () => {
  const google = await loadGoogleModule()
  const html = listingPageHtml({
    cards: [
      listingCardHtml({
        title: 'Network Engineer',
        location: 'Mumbai, Maharashtra, India',
        href: 'jobs/results/456789012345678901-network-engineer?location=India',
        minimumQualification: '3 years of networking experience',
      }),
    ],
    nextUrl: PAGE_TWO_URL,
  })

  const cards = google.extractGoogleListingCards(html, PAGE_ONE_URL)
  assert.equal(cards.length, 1)
  assert.equal(cards[0].title, 'Network Engineer')
  assert.equal(cards[0].link, 'https://www.google.com/about/careers/applications/jobs/results/456789012345678901-network-engineer')
  assert.equal(google.extractGoogleNextPageUrl(html, PAGE_ONE_URL), PAGE_TWO_URL)
})


test('Google stops before requests when the caller has cancelled', async () => {
  const google = await loadGoogleModule()
  const reason = new Error('Google cancelled')
  let requests = 0
  await assert.rejects(google.run({ signal: AbortSignal.abort(reason), fetchListingsText: async () => { requests++; return '' } }), error => error === reason)
  assert.equal(requests, 0)
})

test('Google bounds optional detail work while completing subsequent listing pages', async () => {
  const google = await loadGoogleModule()
  const listingRequests = []
  let detailRequests = 0
  const jobs = await google.createGoogleScraper({ detailConcurrency: 1 }).run({
    detailEnrichmentBudgetMs: 5,
    fetchListingsText: async url => {
      listingRequests.push(url)
      return listingPageHtml({ cards: [listingCardHtml({ title: 'Engineer', location: 'Bengaluru, India', href: url === PAGE_ONE_URL ? FIRST_JOB_URL : SECOND_JOB_URL, minimumQualification: '5 years of experience' })], nextUrl: url === PAGE_ONE_URL ? PAGE_TWO_URL : null })
    },
    fetchText: async (_url, { signal } = {}) => {
      detailRequests++
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Detail exceeded test bound')), 1000)
        signal?.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
      })
    },
  })
  assert.deepEqual(listingRequests, [PAGE_ONE_URL, PAGE_TWO_URL])
  assert.equal(detailRequests, 1)
  assert.equal(jobs.length, 2)
  assert.ok(jobs.every(job => /5 years/.test(job.minimumQualification)))
})

test('Google propagates cancellation during optional detail work without fetching another listing page', async () => {
  const google = await loadGoogleModule()
  const controller = new AbortController()
  const reason = new Error('Stop Google details')
  let listingRequests = 0
  await assert.rejects(google.run({
    signal: controller.signal,
    fetchListingsText: async () => { listingRequests++; return listingPageHtml({ cards: [listingCardHtml({ title: 'Engineer', location: 'Bengaluru, India', href: FIRST_JOB_URL, minimumQualification: '5 years of experience' })], nextUrl: PAGE_TWO_URL }) },
    fetchText: async (_url, { signal } = {}) => { controller.abort(reason); assert.equal(signal?.aborted, true); throw reason },
  }), error => error === reason)
  assert.equal(listingRequests, 1)
})
