import assert from 'node:assert/strict'
import test from 'node:test'

const loadAnnalectModule = async () => {
  try {
    return await import('../../scraper/annalect/script.js')
  } catch {
    assert.fail('Expected Annalect scraper module at ../../scraper/scraper/annalect/script.js')
  }
}

const sampleCompanyHtml = `
<html>
  <head><title>Omnicom Global Solutions | LinkedIn</title></head>
  <body>
    <link rel="canonical" href="https://in.linkedin.com/company/omnicomglobalsolutions">
  </body>
</html>
`

const sampleSearchHtmlPage1 = `
<div class="base-card base-card--link job-search-card" data-entity-urn="urn:li:jobPosting:4428029637">
  <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/presentation-designer-specialist-at-omnicom-global-solutions-4428029637?position=1&amp;pageNum=0">
    <h3 class="base-search-card__title">Presentation Designer - Specialist</h3>
  </a>
  <h4 class="base-search-card__subtitle">
    <a>Omnicom Global Solutions</a>
  </h4>
  <span class="job-search-card__location">Bengaluru, Karnataka, India</span>
  <time class="job-search-card__listdate" datetime="2026-06-16"></time>
</div>
<div class="base-card base-card--link job-search-card" data-entity-urn="urn:li:jobPosting:4430560517">
  <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/media-planning-analyst-at-omnicom-global-solutions-4430560517?position=2&amp;pageNum=0">
    <h3 class="base-search-card__title">Media Planning Analyst</h3>
  </a>
  <h4 class="base-search-card__subtitle">
    <a>Omnicom Global Solutions</a>
  </h4>
  <span class="job-search-card__location">Hyderabad, Telangana, India</span>
  <time class="job-search-card__listdate" datetime="2026-06-22"></time>
</div>
`

const sampleSearchHtmlPage2 = `
<div class="base-card base-card--link job-search-card" data-entity-urn="urn:li:jobPosting:4430560517">
  <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/media-planning-analyst-at-omnicom-global-solutions-4430560517?position=1&amp;pageNum=1">
    <h3 class="base-search-card__title">Media Planning Analyst</h3>
  </a>
  <h4 class="base-search-card__subtitle">
    <a>Omnicom Global Solutions</a>
  </h4>
  <span class="job-search-card__location">Hyderabad, Telangana, India</span>
  <time class="job-search-card__listdate" datetime="2026-06-22"></time>
</div>
`

test('extractSearchResults reads newly posted LinkedIn cards with the new date class', async () => {
  const annalect = await loadAnnalectModule()
  const html = sampleSearchHtmlPage2.replace(
    'class="job-search-card__listdate"',
    'class="job-search-card__listdate--new"',
  )

  const listings = annalect.extractSearchResults(html)
  assert.equal(listings.length, 1)
  assert.equal(listings[0].jobId, '4430560517')
  assert.equal(listings[0].postingDate, '2026-06-22')
})

test('extractSearchResults does not borrow fields from the next card when one card is incomplete', async () => {
  const annalect = await loadAnnalectModule()
  const incompleteCard = sampleSearchHtmlPage2.replace(
    '<time class="job-search-card__listdate" datetime="2026-06-22"></time>',
    '',
  )

  const listings = annalect.extractSearchResults(incompleteCard + sampleSearchHtmlPage1)
  assert.deepEqual(listings.map((job) => job.jobId), ['4428029637', '4430560517'])
})

const sampleDetailHtml = `
<section class="top-card-layout">
  <a class="topcard__link"><h2 class="top-card-layout__title">Presentation Designer - Specialist</h2></a>
  <a class="topcard__org-name-link">Omnicom Global Solutions</a>
  <span class="topcard__flavor topcard__flavor--bullet">Bengaluru, Karnataka, India</span>
</section>
<div class="description__text description__text--rich">
  <section class="show-more-less-html" data-max-lines="5">
    <div class="show-more-less-html__markup show-more-less-html__markup--clamp-after-5 relative overflow-hidden">
      <p><strong>Join us at OGS</strong></p>
      <p>Build adaptive, future-ready solutions.</p>
    </div>
    <button class="show-more-less-html__button show-more-less-button">Show more</button>
  </section>
</div>
<ul class="description__job-criteria-list">
  <li class="description__job-criteria-item">
    <h3 class="description__job-criteria-subheader">Seniority level</h3>
    <span class="description__job-criteria-text description__job-criteria-text--criteria">Mid-Senior level</span>
  </li>
  <li class="description__job-criteria-item">
    <h3 class="description__job-criteria-subheader">Employment type</h3>
    <span class="description__job-criteria-text description__job-criteria-text--criteria">Full-time</span>
  </li>
  <li class="description__job-criteria-item">
    <h3 class="description__job-criteria-subheader">Job function</h3>
    <span class="description__job-criteria-text description__job-criteria-text--criteria">Advertising and Design</span>
  </li>
  <li class="description__job-criteria-item">
    <h3 class="description__job-criteria-subheader">Industries</h3>
    <span class="description__job-criteria-text description__job-criteria-text--criteria">Advertising Services</span>
  </li>
</ul>
`

test('extractSearchResults maps Annalect guest listings and extractJobDetail enriches from DOM criteria', async () => {
  const annalect = await loadAnnalectModule()
  const listings = annalect.extractSearchResults(sampleSearchHtmlPage1)
  const detail = annalect.extractJobDetail(sampleDetailHtml)

  assert.equal(annalect.pageIndicatesOgsCompany(sampleCompanyHtml), true)
  assert.equal(listings.length, 2)
  assert.deepEqual(
    {
      ...listings[0],
      ...Object.fromEntries(Object.entries(detail).filter(([, value]) => value != null)),
    },
    {
      title: 'Presentation Designer - Specialist',
      company: 'Omnicom Global Solutions',
      department: 'Advertising and Design',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '4428029637',
      requisitionId: '4428029637',
      sourceUrl: 'https://in.linkedin.com/jobs/view/presentation-designer-specialist-at-omnicom-global-solutions-4428029637?position=1&pageNum=0',
      applyUrl: 'https://in.linkedin.com/jobs/view/presentation-designer-specialist-at-omnicom-global-solutions-4428029637?position=1&pageNum=0',
      employmentType: 'Full-time',
      experienceRequired: 'Mid-Senior level',
      minimumQualification: null,
      preferredQualification: 'Advertising Services',
      requiredSkills: [],
      postingDate: '2026-06-16',
      closingDate: null,
      jobDescription: 'Join us at OGS Build adaptive, future-ready solutions.',
    },
  )
})

test('run dedupes Annalect guest listing pages and enriches details by job id', async () => {
  const annalect = await loadAnnalectModule()
  const requestedUrls = []
  const scraper = annalect.createAnnalectScraper({ maxPages: 3 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === annalect.LINKEDIN_COMPANY_PAGE_URL) return sampleCompanyHtml
      if (url === annalect.buildSearchUrl({ start: 0 })) return sampleSearchHtmlPage1
      if (url === annalect.buildSearchUrl({ start: 10 })) return sampleSearchHtmlPage2
      if (url === annalect.buildSearchUrl({ start: 20 })) return ''
      if (url === 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4428029637') return sampleDetailHtml
      if (url === 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4430560517') return sampleDetailHtml.replace(/Presentation Designer - Specialist/g, 'Media Planning Analyst').replace(/Bengaluru/g, 'Hyderabad')
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(
    requestedUrls,
    [
      annalect.LINKEDIN_COMPANY_PAGE_URL,
      annalect.buildSearchUrl({ start: 0 }),
      annalect.buildSearchUrl({ start: 10 }),
      'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4428029637',
      'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4430560517',
    ],
  )
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'annalect')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[1].jobId, '4430560517')
})
