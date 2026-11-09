import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  createNovartisScraper,
  extractJobDetailFromHtml,
  extractJobsFromHtml,
  extractPagination,
  hasOfficialCareersSignal,
} from './script.js'

const PAGE_ZERO_HTML = `
<link rel="canonical" href="https://www.novartis.com/careers/career-search/tag/LOC_IN" />
<meta property="og:site_name" content="Novartis" />
<div class='view view-id-career_search view-display-id-page_3'>
  <table class="views-table responsive-enabled table table-striped">
    <tbody>
      <tr class="odd" tabindex="0">
        <td class="views-field views-field-field-job-title"><a href="/careers/career-search/job/details/req-10078668-expert-clinical-programmer">Expert Clinical Programmer</a></td>
        <td class="views-field views-field-field-job-work-location">Hyderabad (Office)</td>
        <td class="views-field views-field-field-job-country">India</td>
        <td class="views-field views-field-field-job-division">Development</td>
        <td class="views-field views-field-field-job-business-unit">Development</td>
        <td class="views-field views-field-field-job-functional-area">Research &amp; Development</td>
        <td class="views-field views-field-field-job-posted-date">Jul 24, 2026</td>
      </tr>
      <tr class="even" tabindex="0">
        <td class="views-field views-field-field-job-title"><a href="/careers/career-search/job/details/req-10084088-senior-expert-ii-data-scientist">Senior Expert II Data Scientist</a></td>
        <td class="views-field views-field-field-job-work-location">Hyderabad (Office)</td>
        <td class="views-field views-field-field-job-country">India</td>
        <td class="views-field views-field-field-job-division">Biomedical Research</td>
        <td class="views-field views-field-field-job-business-unit">Development</td>
        <td class="views-field views-field-field-job-functional-area">Data and Digital</td>
        <td class="views-field views-field-field-job-posted-date">Jul 24, 2026</td>
      </tr>
    </tbody>
  </table>
  <nav aria-label="Pagination">
    <ul class="pagination">
      <li class="page-item"><a href="?page=1" class="page-link" title="page 2 out of 3 pages">2</a></li>
      <li class="page-item"><a href="?page=2" class="page-link" title="page 3 out of 3 pages">3</a></li>
      <li class="page-item pager__item--next"><a href="?page=1" title="Go to next page" rel="next" class="page-link"><span>›</span></a></li>
    </ul>
  </nav>
</div>
`

const PAGE_ONE_HTML = `
<link rel="canonical" href="https://www.novartis.com/careers/career-search/tag/LOC_IN" />
<meta property="og:site_name" content="Novartis" />
<div class='view view-id-career_search view-display-id-page_3'>
  <table class="views-table responsive-enabled table table-striped">
    <tbody>
      <tr class="odd" tabindex="0">
        <td class="views-field views-field-field-job-title"><a href="/careers/career-search/job/details/req-10025263-regional-business-manager">Regional Business Manager</a></td>
        <td class="views-field views-field-field-job-work-location">Kerala</td>
        <td class="views-field views-field-field-job-country">India</td>
        <td class="views-field views-field-field-job-division">International</td>
        <td class="views-field views-field-field-job-business-unit">Marketing</td>
        <td class="views-field views-field-field-job-functional-area">Sales</td>
        <td class="views-field views-field-field-job-posted-date">Jul 23, 2026</td>
      </tr>
    </tbody>
  </table>
</div>
`

const DETAIL_BASE_URL = 'https://www.novartis.com/careers/career-search/job/details/'

const DETAIL_PAGE_HTML = `
<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org',
  '@graph': [{
    '@type': 'JobPosting',
    title: 'Product Owner, Core Compensation & Benefits Enterprise Innovation & Solution',
    employmentType: 'Regular',
    datePosted: '2026-07-31',
    industry: 'Human Resources',
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Hyderabad (Office)',
      },
    },
    description: '#LI-Hybrid Location: Hyderabad, India. About The Role: Own the reward and benefits technology landscape.',
    responsibilities: [
      'Essential Requirements:',
      "Bachelor's degree in engineering or equivalent experience in HR systems or related field.",
      "Minimum 5 years' experience in Workday Reward and Benefit end to end process knowledge.",
      'Desirable Requirements: Experience in Global/MNC organizations.',
    ].join(' '),
  }],
})}</script>
`

test('Novartis parser recognizes the verified first-party careers shell and extracts India rows', () => {
  assert.equal(hasOfficialCareersSignal(PAGE_ZERO_HTML), true)
  assert.equal(extractPagination(PAGE_ZERO_HTML), 2)

  const jobs = extractJobsFromHtml(PAGE_ZERO_HTML, { scrapedAt: '2026-07-25T00:00:00.000Z' })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Expert Clinical Programmer',
    company: 'Novartis',
    location: 'Hyderabad (Office), India',
    city: 'Hyderabad',
    country: 'India',
    department: 'Research & Development',
    team: 'Development',
    source: 'novartis',
    sourceUrl: `${DETAIL_BASE_URL}req-10078668-expert-clinical-programmer`,
    applyUrl: `${DETAIL_BASE_URL}req-10078668-expert-clinical-programmer`,
    link: `${DETAIL_BASE_URL}req-10078668-expert-clinical-programmer`,
    jobId: 'req-10078668-expert-clinical-programmer',
    requisitionId: 'req-10078668-expert-clinical-programmer',
    postingDate: 'Jul 24, 2026',
    employmentType: null,
    remoteStatus: null,
    jobDescription: 'Site: Hyderabad (Office). Division: Development. Business: Development. Functional Area: Research & Development.',
    requiredSkills: [],
    scrapedAt: '2026-07-25T00:00:00.000Z',
  })
})

test('Novartis detail parser extracts experience requirements from JobPosting graph payloads', () => {
  const detail = extractJobDetailFromHtml(DETAIL_PAGE_HTML, {
    title: 'Product Owner, Core Compensation & Benefits Enterprise Innovation & Solution',
    location: 'Hyderabad (Office), India',
    city: 'Hyderabad',
    sourceUrl: `${DETAIL_BASE_URL}req-10082944-product-owner-core-compensation-benefits-enterprise-innovation-solution`,
    applyUrl: `${DETAIL_BASE_URL}req-10082944-product-owner-core-compensation-benefits-enterprise-innovation-solution`,
    jobId: 'req-10082944-product-owner-core-compensation-benefits-enterprise-innovation-solution',
    requisitionId: 'req-10082944-product-owner-core-compensation-benefits-enterprise-innovation-solution',
  })

  assert.equal(detail.location, 'Hyderabad (Office), India')
  assert.equal(detail.city, 'Hyderabad')
  assert.equal(detail.postingDate, '2026-07-31')
  assert.equal(detail.employmentType, 'Regular')
  assert.equal(detail.department, 'Human Resources')
  assert.equal(detail.minimumQualification, 'Bachelor\'s degree in engineering or equivalent experience in HR systems or related field.')
  assert.equal(detail.experienceRequired, '5+ years')
  assert.match(detail.jobDescription, /Own the reward and benefits technology landscape\./)
  assert.match(detail.jobDescription, /Minimum 5 years' experience in Workday Reward and Benefit end to end process knowledge\./)
})

test('Novartis scraper paginates the first-party tag pages and de-duplicates by detail URL', async () => {
  const requestedUrls = []
  const scraper = createNovartisScraper()
  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return PAGE_ZERO_HTML
      if (url === `${CAREERS_URL}?page=1`) return PAGE_ONE_HTML
      if (url === `${CAREERS_URL}?page=2`) return PAGE_ONE_HTML
      if (url.startsWith(DETAIL_BASE_URL)) return '<html><body>No structured detail payload</body></html>'
      throw new Error(`Unexpected URL ${url}`)
    },
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    CAREERS_URL,
    `${CAREERS_URL}?page=1`,
    `${CAREERS_URL}?page=2`,
    `${DETAIL_BASE_URL}req-10078668-expert-clinical-programmer`,
    `${DETAIL_BASE_URL}req-10084088-senior-expert-ii-data-scientist`,
    `${DETAIL_BASE_URL}req-10025263-regional-business-manager`,
  ])
  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.postingDate]),
    [
      ['Expert Clinical Programmer', 'Hyderabad (Office), India', 'Jul 24, 2026'],
      ['Senior Expert II Data Scientist', 'Hyderabad (Office), India', 'Jul 24, 2026'],
      ['Regional Business Manager', 'Kerala, India', 'Jul 23, 2026'],
    ],
  )
})
