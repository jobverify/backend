import assert from 'node:assert/strict'
import test from 'node:test'

const loadDirectShiftsModule = async () => {
  try {
    return await import('../../scraper/directshifts/script.js')
  } catch {
    assert.fail('Expected DirectShifts scraper module at ../../scraper/directshifts/script.js')
  }
}

const LISTING_PAGE_1 = {
  jobs: [
    {
      title: 'Remote Collaborating Physician Opportunity – Indiana (Family Medicine / Primary Care)',
      specialty_names: 'Family Medicine, Internal Medicine',
      city: 'Remote',
      state_code: 'ANY',
      practice_type: 'Telemedicine',
      slug: 'remote-collaborating-physician-opportunity-indiana-family-medicine-primary-care-14172',
      link: 'https://app.directshifts.com/jobs/p/remote-collaborating-physician-opportunity-indiana-family-medicine-primary-care-14172?utm_campaign=20260709&utm_medium=ds_website&utm_source=ds_landing',
      hours_per_shift: '1.0',
      shift_type: 'day',
      hot: true,
      category: 'permanent',
    },
    {
      title: 'Actively Hiring |Clinical Nurse Manager (RN) – Brooklyn, NY',
      specialty_names: 'Administrator',
      city: 'Brooklyn',
      state_code: 'NY',
      practice_type: 'Inpatient',
      slug: 'actively-hiring-clinical-nurse-manager-rn-brooklyn-ny-14166',
      link: 'https://app.directshifts.com/jobs/p/actively-hiring-clinical-nurse-manager-rn-brooklyn-ny-14166?utm_campaign=20260709&utm_medium=ds_website&utm_source=ds_landing',
      hours_per_shift: '8.0',
      shift_type: 'day',
      hot: true,
      category: 'locum',
    },
    {
      title: ' ',
      specialty_names: '',
      city: '',
      state_code: '',
      practice_type: '',
      slug: 'invalid-record',
      link: 'https://app.directshifts.com/jobs/p/invalid-record',
      hours_per_shift: '',
      shift_type: '',
      hot: false,
      category: '',
    },
  ],
  current_page: 1,
  next_page: 2,
  total_pages: 3,
}

const LISTING_PAGE_2 = {
  jobs: [
    {
      title: 'California Independently Licensed Therapists – Remote Opportunity + $1,000 Bonus',
      specialty_names: 'Licensed Mental Health Counselor (LMHC), Licensed Clinical Social Worker (LCSW), Marriage & Family Therapist (LMFT)',
      city: 'California',
      state_code: 'CA',
      practice_type: 'Telemedicine',
      slug: 'california-independently-licensed-therapists-remote-opportunity-1-000-bonus-14170',
      link: 'https://app.directshifts.com/jobs/p/california-independently-licensed-therapists-remote-opportunity-1-000-bonus-14170?utm_campaign=20260709&utm_medium=ds_website&utm_source=ds_landing',
      hours_per_shift: '10.0',
      shift_type: 'day',
      hot: true,
      category: 'locum',
    },
  ],
  current_page: 2,
  next_page: 3,
  total_pages: 3,
}

const DETAIL_HTML = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <script type="application/ld+json">{
      "@context":"https://schema.org/",
      "@type":"JobPosting",
      "directApply":true,
      "title":"Remote Telemedicine Physician (MD/DO) | 100% Remote | 1099/W2",
      "description":"<p><strong>Overview</strong>:</p><p>Seeking Board-Certified Physician to provide virtual primary and urgent care services.</p><p><strong>Qualifications</strong></p><ul><li>MD or DO, Board Certified</li><li>5+ years post-residency experience</li><li>Telehealth experience preferred</li></ul>",
      "datePosted":"2026-07-31",
      "validThrough":"2026-10-29",
      "employmentType":"FULL_TIME",
      "hiringOrganization":{"@type":"Organization","name":"DirectShifts"},
      "jobLocationType":"TELECOMMUTE",
      "applicantLocationRequirements":{"@type":"Country","name":"USA"}
    }</script>
  </head>
  <body>
    <div class="description">
      <p><strong>Overview</strong>:</p>
      <p>Seeking Board-Certified Physician to provide virtual primary and urgent care services.</p>
      <p><strong>Qualifications</strong></p>
      <ul>
        <li>MD or DO, Board Certified</li>
        <li>5+ years post-residency experience</li>
        <li>Telehealth experience preferred</li>
      </ul>
    </div>
  </body>
</html>
`

test('DirectShifts URL builders stay on the public feed and clean detail pages', async () => {
  const {
    CAREERS_PAGE_URL,
    FEED_URL,
    OPEN_JOBS_URL,
    buildDetailUrl,
    buildFeedUrl,
  } = await loadDirectShiftsModule()

  assert.equal(CAREERS_PAGE_URL, 'https://www.directshifts.com/careers')
  assert.equal(OPEN_JOBS_URL, 'https://www.directshifts.com/open-jobs')
  assert.equal(FEED_URL, 'https://app.directshifts.com/jobs/p/list.json')
  assert.equal(buildFeedUrl(), FEED_URL)
  assert.equal(buildFeedUrl({ page: 2 }), 'https://app.directshifts.com/jobs/p/list.json?page=2')
  assert.equal(
    buildDetailUrl('remote-collaborating-physician-opportunity-indiana-family-medicine-primary-care-14172'),
    'https://app.directshifts.com/jobs/p/remote-collaborating-physician-opportunity-indiana-family-medicine-primary-care-14172',
  )
})

test('extractSearchResults maps the DirectShifts public listing feed into normalized jobs with detail-page apply fallbacks', async () => {
  const {
    extractPaginationSummary,
    extractSearchResults,
  } = await loadDirectShiftsModule()

  const jobs = extractSearchResults(LISTING_PAGE_1)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Remote Collaborating Physician Opportunity – Indiana (Family Medicine / Primary Care)',
    company: 'DirectShifts',
    department: 'Telemedicine',
    location: 'Remote, United States',
    city: 'Remote',
    state: null,
    country: 'United States',
    jobId: '14172',
    requisitionId: '14172',
    sourceUrl: 'https://app.directshifts.com/jobs/p/remote-collaborating-physician-opportunity-indiana-family-medicine-primary-care-14172',
    applyUrl: 'https://app.directshifts.com/jobs/p/remote-collaborating-physician-opportunity-indiana-family-medicine-primary-care-14172',
    employmentType: 'Permanent',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Family Medicine', 'Internal Medicine'],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Specialties: Family Medicine, Internal Medicine. Practice type: Telemedicine. Shift: Day. Hours per shift: 1.0. Hot job.',
  })
  assert.deepEqual(jobs[1], {
    title: 'Actively Hiring |Clinical Nurse Manager (RN) – Brooklyn, NY',
    company: 'DirectShifts',
    department: 'Inpatient',
    location: 'Brooklyn, NY, United States',
    city: 'Brooklyn',
    state: 'NY',
    country: 'United States',
    jobId: '14166',
    requisitionId: '14166',
    sourceUrl: 'https://app.directshifts.com/jobs/p/actively-hiring-clinical-nurse-manager-rn-brooklyn-ny-14166',
    applyUrl: 'https://app.directshifts.com/jobs/p/actively-hiring-clinical-nurse-manager-rn-brooklyn-ny-14166',
    employmentType: 'Locum',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Administrator'],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Specialties: Administrator. Practice type: Inpatient. Shift: Day. Hours per shift: 8.0. Hot job.',
  })

  assert.deepEqual(extractPaginationSummary(LISTING_PAGE_1), {
    currentPage: 1,
    nextPage: 2,
    totalPages: 3,
    pageSize: 3,
    hasNext: true,
  })
})

test('extractJobDetail reads DirectShifts public job detail experience from the official detail page', async () => {
  const { extractJobDetail } = await loadDirectShiftsModule()

  const detail = extractJobDetail(DETAIL_HTML, {
    title: 'Remote Telemedicine Physician (MD/DO) | 100% Remote | 1099/W2',
    company: 'DirectShifts',
    department: 'Telemedicine',
    location: 'Remote, United States',
    city: 'Remote',
    state: null,
    country: 'United States',
    jobId: '14409',
    requisitionId: '14409',
    sourceUrl: 'https://app.directshifts.com/jobs/p/remote-telemedicine-physician-md-do-100-remote-1099-w2-14409',
    applyUrl: 'https://app.directshifts.com/jobs/p/remote-telemedicine-physician-md-do-100-remote-1099-w2-14409',
    employmentType: 'Permanent',
    requiredSkills: ['Family Medicine', 'Internal Medicine'],
    jobDescription: 'Specialties: Family Medicine, Internal Medicine. Practice type: Telemedicine. Shift: Night. Hours per shift: 1.0. Hot job.',
  })

  assert.equal(detail.experienceRequired, '5+ years')
  assert.equal(detail.postingDate, '2026-07-31')
  assert.equal(detail.closingDate, '2026-10-29')
  assert.match(detail.jobDescription, /5\+ years post-residency experience/i)
})

test('run paginates the DirectShifts feed and decorates shared runner fields', async () => {
  const {
    buildFeedUrl,
    buildDetailUrl,
    createDirectShiftsScraper,
  } = await loadDirectShiftsModule()

  const requests = []
  const scraper = createDirectShiftsScraper({ maxPages: 2, maxJobs: 3 })

  const jobs = await scraper.run({
    fetchJson: async (url) => {
      requests.push(url)

      if (url === buildFeedUrl({ page: 1 })) return LISTING_PAGE_1
      if (url === buildFeedUrl({ page: 2 })) return LISTING_PAGE_2

      throw new Error(`Unexpected DirectShifts URL: ${url}`)
    },
    fetchText: async (url) => {
      requests.push(url)

      if (url === buildDetailUrl('remote-collaborating-physician-opportunity-indiana-family-medicine-primary-care-14172')) {
        return DETAIL_HTML
      }
      if (url === buildDetailUrl('actively-hiring-clinical-nurse-manager-rn-brooklyn-ny-14166')) {
        return DETAIL_HTML
      }
      if (url === buildDetailUrl('california-independently-licensed-therapists-remote-opportunity-1-000-bonus-14170')) {
        return DETAIL_HTML
      }

      throw new Error(`Unexpected DirectShifts detail URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    buildFeedUrl({ page: 1 }),
    buildDetailUrl('remote-collaborating-physician-opportunity-indiana-family-medicine-primary-care-14172'),
    buildDetailUrl('actively-hiring-clinical-nurse-manager-rn-brooklyn-ny-14166'),
    buildFeedUrl({ page: 2 }),
    buildDetailUrl('california-independently-licensed-therapists-remote-opportunity-1-000-bonus-14170'),
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'directshifts')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].experienceRequired, '5+ years')
  assert.equal(jobs[1].employmentType, 'Locum')
  assert.equal(jobs[2].location, 'California, United States')
  assert.deepEqual(jobs[2].requiredSkills, [
    'Licensed Mental Health Counselor (LMHC)',
    'Licensed Clinical Social Worker (LCSW)',
    'Marriage & Family Therapist (LMFT)',
  ])
  assert.ok(jobs.every((job) => typeof job.scrapedAt === 'string' && job.scrapedAt.length > 0))
})
