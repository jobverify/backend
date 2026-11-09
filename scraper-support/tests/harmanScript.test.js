import assert from 'node:assert/strict'
import test from 'node:test'

const loadHarmanModule = async () => {
  try {
    return await import('../../scraper/harman/script.js')
  } catch {
    assert.fail('Expected HARMAN scraper module at ../../scraper/harman/script.js')
  }
}

const INDIA_DETAIL_URL = 'https://jobsearch.harman.com/en_US/careers/JobDetail/Advanced-Engineer-Acoustics-Systems/28928'
const NETHERLANDS_DETAIL_URL = 'https://jobsearch.harman.com/en_US/careers/JobDetail/Global-Director-Go-to-Market-Category-Owner/30573'

const searchResultsHtml = `
  <article class="article article--result" id="article--1">
    <div class="article__header">
      <div class="article__header__text">
        <h3 class="article__header__text__title title title--04">
          <a class="link" href="${INDIA_DETAIL_URL}">
            Advanced Engineer, Acoustics Systems
          </a>
        </h3>
        <div class="article__header__text__subtitle">
          <span class="list-item-location"><strong> Location:</strong> Bangalore - Karnataka, India</span>
          <span class="separator" aria-hidden="true">&nbsp;&#8226;&nbsp;</span>
          <span class="list-item-ref"><strong> Ref #</strong> R-48037-2025</span>
          <span class="separator" aria-hidden="true">&nbsp;&#8226;&nbsp;</span>
          <span class="list-item-posted"><strong> Date Posted:</strong> 07-Oct-2025</span>
        </div>
      </div>
    </div>
    <div class="article__footer">
      <a class="button button--secondary" href="https://jobsearch.harman.com/en_US/careers/ApplicationMethods?jobId=28928">
        Apply
      </a>
    </div>
  </article>
  <article class="article article--result" id="article--2">
    <div class="article__header">
      <div class="article__header__text">
        <h3 class="article__header__text__title title title--04">
          <a class="link" href="${NETHERLANDS_DETAIL_URL}">
            Global Director, Go to Market Category Owner
          </a>
        </h3>
        <div class="article__header__text__subtitle">
          <span class="list-item-location"><strong> Location:</strong> Amsterdam - Amsterdam, Netherlands</span>
          <span class="separator" aria-hidden="true">&nbsp;&#8226;&nbsp;</span>
          <span class="list-item-ref"><strong> Ref #</strong> R-51735-2026</span>
          <span class="separator" aria-hidden="true">&nbsp;&#8226;&nbsp;</span>
          <span class="list-item-posted"><strong> Date Posted:</strong> 25-Feb-2026</span>
        </div>
      </div>
    </div>
    <div class="article__footer">
      <a class="button button--secondary" href="https://jobsearch.harman.com/en_US/careers/ApplicationMethods?jobId=30573">
        Apply
      </a>
    </div>
  </article>
`

const feedXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <title>careers</title>
      <item>
        <title><![CDATA[Advanced Engineer, Acoustics Systems]]></title>
        <description><![CDATA[ - R-48037-2025]]></description>
        <guid isPermaLink="true">https://jobsearch.harman.com/careers/JobDetail/Advanced-Engineer-Acoustics-Systems/28928</guid>
        <link>https://jobsearch.harman.com/careers/JobDetail/Advanced-Engineer-Acoustics-Systems/28928</link>
        <pubDate>Tue, 07 Oct 2025 00:00:00 +0000</pubDate>
      </item>
      <item>
        <title><![CDATA[Global Director, Go to Market Category Owner]]></title>
        <description><![CDATA[ - R-51735-2026]]></description>
        <guid isPermaLink="true">https://jobsearch.harman.com/careers/JobDetail/Global-Director-Go-to-Market-Category-Owner/30573</guid>
        <link>https://jobsearch.harman.com/careers/JobDetail/Global-Director-Go-to-Market-Category-Owner/30573</link>
        <pubDate>Wed, 25 Feb 2026 00:00:00 +0000</pubDate>
      </item>
    </channel>
  </rss>
`

const indiaDetailHtml = `
  <meta property="og:title" content="Advanced Engineer, Acoustics Systems" />
  <script type="application/ld+json">
    {"@context":"https://schema.org/","@type":"JobPosting","title":"Advanced Engineer, Acoustics Systems","datePosted":"2025-10-07"}
  </script>
  <div class="article__content__view">
    <div class="article__content__view__field regular-fields-label--inline">
      <div class="article__content__view__field__label">Location:</div>
      <div class="article__content__view__field__value">IN_Bangalore_Sattva Knowledge Court Bdg_HII</div>
    </div>
    <div class="article__content__view__field ">
      <div class="article__content__view__field__label">Job Family:</div>
      <div class="article__content__view__field__value">Engineering</div>
    </div>
    <div class="article__content__view__field ">
      <div class="article__content__view__field__label">Worker Type Reference:</div>
      <div class="article__content__view__field__value">Regular - Permanent</div>
    </div>
    <div class="article__content__view__field ">
      <div class="article__content__view__field__value">
        <p><strong>About the Role</strong></p>
        <p>As an Acoustics Systems Engineer, you will be responsible for developing vehicle audio systems.</p>
        <p><strong>What You Will Do</strong></p>
        <ul>
          <li>Interface with sales and customers to provide technical solutions and support.</li>
          <li>Perform sound tunings for the audio system to meet performance expectations objectively and subjectively.</li>
        </ul>
        <p><strong>What You Need to be Successful</strong></p>
        <ul>
          <li>Bachelor's or master's degree in Electronics or Acoustics.</li>
          <li>Minimum 5 years of engineering experience in consumer electronics or automotive.</li>
        </ul>
      </div>
    </div>
    <div class="article__content__view__field ">
      <div class="article__content__view__field__value">
        <div><strong>About HARMAN</strong></div>
      </div>
    </div>
  </div>
  <a class="button button--primary" href="https://jobsearch.harman.com/en_US/careers/ApplicationMethods?jobId=28928">
    Apply
  </a>
`

const netherlandsDetailHtml = `
  <meta property="og:title" content="Global Director, Go to Market Category Owner" />
  <script type="application/ld+json">
    {"@context":"https://schema.org/","@type":"JobPosting","title":"Global Director, Go to Market Category Owner","datePosted":"2026-02-25"}
  </script>
  <div class="article__content__view">
    <div class="article__content__view__field regular-fields-label--inline">
      <div class="article__content__view__field__label">Location:</div>
      <div class="article__content__view__field__value">Amsterdam - Amsterdam, Netherlands</div>
    </div>
    <div class="article__content__view__field ">
      <div class="article__content__view__field__label">Job Family:</div>
      <div class="article__content__view__field__value">Marketing</div>
    </div>
    <div class="article__content__view__field ">
      <div class="article__content__view__field__label">Worker Type Reference:</div>
      <div class="article__content__view__field__value">Regular - Permanent</div>
    </div>
    <div class="article__content__view__field ">
      <div class="article__content__view__field__value">
        <p>Lead category strategy across global markets.</p>
      </div>
    </div>
  </div>
`

test('HARMAN keeps SearchJobs and feed URLs on the public Avature surfaces', async () => {
  const harman = await loadHarmanModule()

  assert.equal(
    harman.buildSearchUrl(),
    'https://jobsearch.harman.com/en_US/careers/SearchJobs',
  )
  assert.equal(
    harman.buildSearchUrl({ page: 2, pageSize: 20 }),
    'https://jobsearch.harman.com/en_US/careers/SearchJobs/?jobRecordsPerPage=20&jobOffset=20',
  )
  assert.equal(
    harman.buildFeedUrl(),
    'https://jobsearch.harman.com/en_US/careers/SearchJobs/feed/?jobRecordsPerPage=20',
  )
})

test('extractFeedResults normalizes locale-less HARMAN feed detail URLs and requisition IDs', async () => {
  const { extractFeedResults } = await loadHarmanModule()

  const listings = extractFeedResults(feedXml)

  assert.equal(listings.length, 2)
  assert.deepEqual(listings[0], {
    title: 'Advanced Engineer, Acoustics Systems',
    jobId: '28928',
    requisitionId: 'R-48037-2025',
    postingDate: '2025-10-07',
    sourceUrl: INDIA_DETAIL_URL,
  })
})

test('extractSearchResults reads public HARMAN SearchJobs cards without relying on ApplicationMethods', async () => {
  const { extractSearchResults } = await loadHarmanModule()

  const listings = extractSearchResults(searchResultsHtml)

  assert.equal(listings.length, 2)
  assert.deepEqual(listings[0], {
    title: 'Advanced Engineer, Acoustics Systems',
    location: 'Bangalore - Karnataka, India',
    city: 'Bangalore',
    jobId: '28928',
    requisitionId: 'R-48037-2025',
    postingDate: '2025-10-07',
    sourceUrl: INDIA_DETAIL_URL,
  })
  assert.equal(listings[1].sourceUrl, NETHERLANDS_DETAIL_URL)
})

test('extractJobDetail reads HARMAN India detail fields and keeps the public detail page as the apply link', async () => {
  const { extractJobDetail } = await loadHarmanModule()

  const detail = extractJobDetail(indiaDetailHtml, {
    title: 'Advanced Engineer, Acoustics Systems',
    location: 'Bangalore - Karnataka, India',
    city: 'Bangalore',
    jobId: '28928',
    requisitionId: 'R-48037-2025',
    postingDate: '2025-10-07',
    sourceUrl: INDIA_DETAIL_URL,
  })

  assert.equal(detail.title, 'Advanced Engineer, Acoustics Systems')
  assert.equal(detail.department, 'Engineering')
  assert.equal(detail.location, 'IN_Bangalore_Sattva Knowledge Court Bdg_HII')
  assert.equal(detail.city, 'Bangalore')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, '28928')
  assert.equal(detail.requisitionId, 'R-48037-2025')
  assert.equal(detail.employmentType, 'Regular - Permanent')
  assert.equal(detail.postingDate, '2025-10-07')
  assert.equal(detail.closingDate, null)
  assert.equal(detail.applyUrl, INDIA_DETAIL_URL)
  assert.equal(detail.sourceUrl, INDIA_DETAIL_URL)
  assert.deepEqual(detail.requiredSkills, [
    'Interface with sales and customers to provide technical solutions and support.',
    'Perform sound tunings for the audio system to meet performance expectations objectively and subjectively.',
    "Bachelor's or master's degree in Electronics or Acoustics.",
    'Minimum 5 years of engineering experience in consumer electronics or automotive.',
  ])
  assert.match(detail.jobDescription, /About the Role/i)
  assert.match(detail.jobDescription, /What You Need to be Successful/i)
})

test('run stays on public HARMAN SearchJobs and JobDetail pages and emits only India jobs', async () => {
  const harman = await loadHarmanModule()
  const requestedUrls = []

  const jobs = await harman.run({
    maxPages: 1,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === harman.buildSearchUrl()) return searchResultsHtml
      if (url === INDIA_DETAIL_URL) return indiaDetailHtml
      if (url === NETHERLANDS_DETAIL_URL) return netherlandsDetailHtml
      throw new Error(`Unexpected HARMAN fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    harman.buildSearchUrl(),
    INDIA_DETAIL_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual({ ...jobs[0], scrapedAt: undefined }, {
    jobId: '28928',
    requisitionId: 'R-48037-2025',
    title: 'Advanced Engineer, Acoustics Systems',
    company: 'HARMAN',
    department: 'Engineering',
    location: 'IN_Bangalore_Sattva Knowledge Court Bdg_HII',
    city: 'Bangalore',
    country: 'India',
    link: INDIA_DETAIL_URL,
    applyUrl: INDIA_DETAIL_URL,
    sourceUrl: INDIA_DETAIL_URL,
    source: 'harman',
    employmentType: 'Regular - Permanent',
    experienceRequired: null,
    jobDescription: jobs[0].jobDescription,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Interface with sales and customers to provide technical solutions and support.',
      'Perform sound tunings for the audio system to meet performance expectations objectively and subjectively.',
      "Bachelor's or master's degree in Electronics or Acoustics.",
      'Minimum 5 years of engineering experience in consumer electronics or automotive.',
    ],
    postingDate: '2025-10-07',
    closingDate: null,
    scrapedAt: undefined,
  })
  assert.match(jobs[0].jobDescription, /vehicle audio systems/i)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
