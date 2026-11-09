import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const indiaCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at ITILITE India | Join Our Team</title>
    <link rel="canonical" href="https://www.itilite.com/in/careers" />
  </head>
  <body>
    <a href="https://www.itilite.com/careers" id="car-global-btn">Global</a>
    <a href="https://www.itilite.com/in/careers" id="car-india-btn">India</a>
    <h1>Join the #ITILITE Revolution..</h1>
    <p>Explore exciting opportunities - become an Itizen!</p>
    <div class="text-size-regular text-weight-medium">View jobs</div>
    <div class="car_open-wrap">
      <h2>Open positions at ITILITE</h2>
      <div class="car_open-filter">All Customer Success Engineering Marketing Product Sales Support & Resolution Center</div>
      <div class="car_job-card">
        <div class="car_job-location">Remote</div>
        <div class="car_job-title">Account Executive - US Sales</div>
        <a href="https://www.linkedin.com/jobs/view/4110847363" target="_blank" rel="noopener" class="car_job-apply">Apply now</a>
      </div>
      <div class="car_job-card">
        <div class="car_job-location">Bangalore</div>
        <div class="car_job-title">Lead Software Engineer</div>
        <a href="https://www.linkedin.com/jobs/view/3880037975" target="_blank" rel="noopener" class="car_job-apply">Apply now</a>
      </div>
      <div class="car_job-card">
        <div class="car_job-location">Bangalore</div>
        <div class="car_job-title">Associate Travel Support</div>
        <a href="https://www.linkedin.com/jobs/view/4167015288" target="_blank" rel="noopener" class="car_job-apply">Apply now</a>
      </div>
    </div>
  </body>
</html>
`

const careersWithoutJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at ITILITE India | Join Our Team</title>
    <link rel="canonical" href="https://www.itilite.com/in/careers" />
  </head>
  <body>
    <h1>Join the #ITILITE Revolution..</h1>
    <p>Explore exciting opportunities - become an Itizen!</p>
    <h2>Open positions at ITILITE</h2>
    <p>No openings.</p>
  </body>
</html>
`

const loadItiliteModule = async () => {
  try {
    return await import('../../scraper/itilite/script.js')
  } catch {
    assert.fail('Expected Itilite scraper module at ../../scraper/itilite/script.js')
  }
}

test('Itilite extracts the verified first-party India careers cards into conservative job records', async () => {
  const itilite = await loadItiliteModule()
  const jobs = itilite.extractJobsFromCareersPage(indiaCareersHtml)

  assert.equal(itilite.SOURCE, 'itilite')
  assert.equal(itilite.COMPANY, 'Itilite')
  assert.equal(itilite.VERIFIED_ON, '2026-07-16')
  assert.equal(itilite.CAREERS_PAGE_URL, 'https://www.itilite.com/in/careers')
  assert.equal(itilite.pageHasOfficialItiliteSignals(indiaCareersHtml), true)
  assert.equal(
    itilite.extractLinkedInJobId('https://www.linkedin.com/jobs/view/4110847363'),
    '4110847363',
  )

  assert.deepEqual(jobs, [
    {
      title: 'Account Executive - US Sales',
      company: 'Itilite',
      department: 'Sales',
      location: 'Remote, India',
      city: 'Remote',
      country: 'India',
      jobId: '4110847363',
      requisitionId: '4110847363',
      sourceUrl: 'https://www.itilite.com/in/careers',
      applyUrl: 'https://www.linkedin.com/jobs/view/4110847363',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official ITILITE India careers page lists Account Executive - US Sales in Remote, India. Apply via LinkedIn.',
      publicExperienceChecked: true,
    },
    {
      title: 'Lead Software Engineer',
      company: 'Itilite',
      department: 'Engineering',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '3880037975',
      requisitionId: '3880037975',
      sourceUrl: 'https://www.itilite.com/in/careers',
      applyUrl: 'https://www.linkedin.com/jobs/view/3880037975',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official ITILITE India careers page lists Lead Software Engineer in Bangalore, India. Apply via LinkedIn.',
      publicExperienceChecked: true,
    },
    {
      title: 'Associate Travel Support',
      company: 'Itilite',
      department: 'Support & Resolution Center',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '4167015288',
      requisitionId: '4167015288',
      sourceUrl: 'https://www.itilite.com/in/careers',
      applyUrl: 'https://www.linkedin.com/jobs/view/4167015288',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official ITILITE India careers page lists Associate Travel Support in Bangalore, India. Apply via LinkedIn.',
      publicExperienceChecked: true,
    },
  ])
})

test('Itilite run fetches the verified first-party India careers page and decorates extracted jobs', async () => {
  const itilite = await loadItiliteModule()
  const requestedUrls = []
  const scraper = itilite.createItiliteScraper({
    now: () => FIXED_SCRAPED_AT,
    maxJobs: 2,
  })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return indiaCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [itilite.CAREERS_PAGE_URL])
  assert.deepEqual(jobs, [
    {
      title: 'Account Executive - US Sales',
      company: 'Itilite',
      department: 'Sales',
      location: 'Remote, India',
      city: 'Remote',
      country: 'India',
      jobId: '4110847363',
      requisitionId: '4110847363',
      sourceUrl: 'https://www.itilite.com/in/careers',
      applyUrl: 'https://www.linkedin.com/jobs/view/4110847363',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official ITILITE India careers page lists Account Executive - US Sales in Remote, India. Apply via LinkedIn.',
      publicExperienceChecked: true,
      source: 'itilite',
      link: 'https://www.linkedin.com/jobs/view/4110847363',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Lead Software Engineer',
      company: 'Itilite',
      department: 'Engineering',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '3880037975',
      requisitionId: '3880037975',
      sourceUrl: 'https://www.itilite.com/in/careers',
      applyUrl: 'https://www.linkedin.com/jobs/view/3880037975',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official ITILITE India careers page lists Lead Software Engineer in Bangalore, India. Apply via LinkedIn.',
      publicExperienceChecked: true,
      source: 'itilite',
      link: 'https://www.linkedin.com/jobs/view/3880037975',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Itilite fails closed when the verified India careers shell drifts or stops exposing verified job cards', async () => {
  const itilite = await loadItiliteModule()

  await assert.rejects(
    itilite.createItiliteScraper().run({
      fetchText: async () => indiaCareersHtml.replace('Open positions at ITILITE', 'Careers at ITILITE'),
    }),
    /official india careers page no longer matches the verified public surface/i,
  )

  await assert.rejects(
    itilite.createItiliteScraper().run({
      fetchText: async () => careersWithoutJobsHtml,
    }),
    /official india careers page no longer matches the verified public surface/i,
  )
})
