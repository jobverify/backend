import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  INDIA_FILTER_OPTION_ID,
  buildIndiaSearchPageUrl,
  createEgisScraper,
  extractJobDetail,
  extractSearchResults,
  extractTotalPages,
} from './script.js'

const indiaSearchPageHtml = `
  <html>
    <head><title>Job results | Egis</title></head>
    <body>
      <div class="attrax-vacancy-tile attrax-vacancy-tile--bengaluru attrax-vacancy-tile--india" data-jobid="6727">
        <a class="attrax-vacancy-tile__title attrax-vacancy-tile__item attrax-button" href="/job/bim-designer-wet-utility-in-bengaluru-jid-6727">BIM Designer- Wet Utility</a>
        <div class="attrax-vacancy-tile__option-experience-level attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-experience-level-label attrax-vacancy-tile__item-label">Experience level</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Mid-Senior Level</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-location attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-location-label attrax-vacancy-tile__item-label">Location</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Bengaluru</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-job-family attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-job-family-label attrax-vacancy-tile__item-label">Job Family</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Technical Engineering</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-type-of-contract attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-type-of-contract-label attrax-vacancy-tile__item-label">Type of Contract</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Permanent Contract</p></div>
        </div>
        <div class="attrax-vacancy-tile__description attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__description-label attrax-vacancy-tile__item-label">Description</p>
          <p class="attrax-vacancy-tile__description-value attrax-vacancy-tile__item-value">
            We are seeking a skilled BIM Designer (Wet Utilities/Drainage) specializing in Infrastructure to join our team.
          </p>
        </div>
        <div class="attrax-vacancy-tile__reference attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__reference-label attrax-vacancy-tile__item-label">Reference</p>
          <p class="attrax-vacancy-tile__reference-value attrax-vacancy-tile__item-value">a53a99b6-3a62-43b4-a50f-b96b6cc3aa1f</p>
        </div>
        <div class="attrax-vacancy-tile__expiry attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__expiry-label attrax-vacancy-tile__item-label">Expiry Date</p>
          <p class="attrax-vacancy-tile__expiry-value attrax-vacancy-tile__item-value">01/01/0001</p>
        </div>
      </div>
      <div class="attrax-vacancy-tile attrax-vacancy-tile--dubai" data-jobid="9999">
        <a class="attrax-vacancy-tile__title attrax-vacancy-tile__item attrax-button" href="/job/structural-inspector-site-in-dubai-jid-9999">Structural Inspector - Site</a>
        <div class="attrax-vacancy-tile__option-location attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-location-label attrax-vacancy-tile__item-label">Location</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Dubai</p></div>
        </div>
      </div>
      <div class="attrax-pagination__container">
        <a href="javascript:pagination(1)">1</a>
        <a href="javascript:pagination(2)">2</a>
        <a href="javascript:pagination(12)">Last</a>
      </div>
    </body>
  </html>
`

const secondIndiaSearchPageHtml = `
  <html>
    <head><title>Job results | Egis</title></head>
    <body>
      <div class="attrax-vacancy-tile attrax-vacancy-tile--gurugram attrax-vacancy-tile--india" data-jobid="8001">
        <a class="attrax-vacancy-tile__title attrax-vacancy-tile__item attrax-button" href="/job/design-manager-in-gurugram-jid-8001">Design Manager</a>
        <div class="attrax-vacancy-tile__option-location attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-location-label attrax-vacancy-tile__item-label">Location</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Gurugram</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-job-family attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-job-family-label attrax-vacancy-tile__item-label">Job Family</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Project Management - Engineering</p></div>
        </div>
        <div class="attrax-vacancy-tile__option-type-of-contract attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__option-type-of-contract-label attrax-vacancy-tile__item-label">Type of Contract</p>
          <div class="attrax-vacancy-tile__item-valueset"><p class="attrax-vacancy-tile__item-value">Permanent Contract</p></div>
        </div>
        <div class="attrax-vacancy-tile__description attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__description-value attrax-vacancy-tile__item-value">
            Lead multidisciplinary engineering coordination for major transport projects.
          </p>
        </div>
        <div class="attrax-vacancy-tile__reference attrax-vacancy-tile__item">
          <p class="attrax-vacancy-tile__reference-value attrax-vacancy-tile__item-value">8b0f4f9d-3d4d-4f7c-b5bf-123456789abc</p>
        </div>
      </div>
      <div class="attrax-pagination__container">
        <a href="javascript:pagination(1)">1</a>
        <a href="javascript:pagination(2)">2</a>
      </div>
    </body>
  </html>
`

const detailPageHtml = `
  <html>
    <head>
      <title>BIM Designer- Wet Utility job in Bengaluru | Egis</title>
      <meta name="description" content="We are seeking a skilled BIM Designer (Wet Utilities/Drainage) specializing in Infrastructure to join our team. In this role, you will be responsible for..."/>
    </head>
    <body>
      <div class="vacancy-buttons-widget">
        <a class="jobApplyBtn btn btn-default" href="https://jobs.smartrecruiters.com/EgisGroup/744000135651473-bim-designer-wet-utility?oga=true&amp;sid=d794acbf-3913-43f7-8f43-28df264a001d" rel="nofollow">
          Apply
        </a>
      </div>
      <div class="description-widget">
        <div aria-label="Job description">
          <div class='jobad-companydescription'>About Us</div>
          <p>Egis is an international player active in architecture, consulting, construction engineering and mobility services.</p>
          <div class='jobad-jobdescription'>About the Role</div>
          <p>We are seeking a skilled BIM Designer (Wet Utilities/Drainage) specializing in Infrastructure to join our team.</p>
          <ul>
            <li>Develop and maintain detailed 3D BIM models for infrastructure projects.</li>
            <li>Collaborate with multidisciplinary teams to integrate design elements into cohesive BIM models.</li>
          </ul>
          <div class='jobad-qualifications'>What do we need from you</div>
          <ul>
            <li>Bachelor's or Diploma degree in Civil Engineering, or a related field.</li>
            <li>5+ years of experience in BIM for wet utilities and drainage projects.</li>
          </ul>
        </div>
      </div>
    </body>
  </html>
`

test('Egis scraper constants point to the official India-filtered Attrax jobs pages', () => {
  assert.equal(CAREERS_URL, 'https://jobs.egis-group.com/jobs')
  assert.equal(INDIA_FILTER_OPTION_ID, '837')
  assert.equal(
    buildIndiaSearchPageUrl(),
    'https://jobs.egis-group.com/jobs?options=837&page=1',
  )
  assert.equal(
    buildIndiaSearchPageUrl(2),
    'https://jobs.egis-group.com/jobs?options=837&page=2',
  )
})

test('extractSearchResults keeps India vacancy tiles and normalizes shared scraper fields', () => {
  const jobs = extractSearchResults(indiaSearchPageHtml)

  assert.equal(extractTotalPages(indiaSearchPageHtml), 12)
  assert.deepEqual(jobs, [{
    title: 'BIM Designer- Wet Utility',
    company: 'Egis Group',
    department: 'Technical Engineering',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '6727',
    requisitionId: 'a53a99b6-3a62-43b4-a50f-b96b6cc3aa1f',
    sourceUrl: 'https://jobs.egis-group.com/job/bim-designer-wet-utility-in-bengaluru-jid-6727',
    applyUrl: 'https://jobs.egis-group.com/job/bim-designer-wet-utility-in-bengaluru-jid-6727',
    employmentType: 'Permanent Contract',
    experienceRequired: 'Mid-Senior Level',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'We are seeking a skilled BIM Designer (Wet Utilities/Drainage) specializing in Infrastructure to join our team.',
  }])
})

test('extractJobDetail enriches the official detail page with apply URL and full description', () => {
  const [listing] = extractSearchResults(indiaSearchPageHtml)
  const job = extractJobDetail(detailPageHtml, listing)

  assert.deepEqual(job, {
    ...listing,
    applyUrl: 'https://jobs.smartrecruiters.com/EgisGroup/744000135651473-bim-designer-wet-utility?oga=true&sid=d794acbf-3913-43f7-8f43-28df264a001d',
    minimumQualification: "Bachelor's or Diploma degree in Civil Engineering, or a related field.",
    jobDescription: 'About Us Egis is an international player active in architecture, consulting, construction engineering and mobility services. About the Role We are seeking a skilled BIM Designer (Wet Utilities/Drainage) specializing in Infrastructure to join our team. Develop and maintain detailed 3D BIM models for infrastructure projects. Collaborate with multidisciplinary teams to integrate design elements into cohesive BIM models. What do we need from you Bachelor\'s or Diploma degree in Civil Engineering, or a related field. 5+ years of experience in BIM for wet utilities and drainage projects.',
  })
})

test('run crawls the official India-filtered pages and enriches detail pages', async () => {
  const requests = []
  const scraper = createEgisScraper({
    maxPages: 2,
    fetchText: async (url) => {
      requests.push(url)

      if (url === 'https://jobs.egis-group.com/jobs?options=837&page=1') {
        return indiaSearchPageHtml
      }

      if (url === 'https://jobs.egis-group.com/jobs?options=837&page=2') {
        return secondIndiaSearchPageHtml
      }

      if (url === 'https://jobs.egis-group.com/job/bim-designer-wet-utility-in-bengaluru-jid-6727') {
        return detailPageHtml
      }

      if (url === 'https://jobs.egis-group.com/job/design-manager-in-gurugram-jid-8001') {
        return detailPageHtml.replace(
          /BIM Designer- Wet Utility/g,
          'Design Manager',
        ).replace(
          /744000135651473-bim-designer-wet-utility/g,
          '744000135699999-design-manager',
        )
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-08T00:00:00.000Z',
  })

  const jobs = await scraper.run()

  assert.deepEqual(requests, [
    'https://jobs.egis-group.com/jobs?options=837&page=1',
    'https://jobs.egis-group.com/job/bim-designer-wet-utility-in-bengaluru-jid-6727',
    'https://jobs.egis-group.com/jobs?options=837&page=2',
    'https://jobs.egis-group.com/job/design-manager-in-gurugram-jid-8001',
  ])

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'egis')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-08T00:00:00.000Z')
  assert.equal(jobs[1].city, 'Gurugram')
  assert.equal(
    jobs[1].applyUrl,
    'https://jobs.smartrecruiters.com/EgisGroup/744000135699999-design-manager?oga=true&sid=d794acbf-3913-43f7-8f43-28df264a001d',
  )
})
