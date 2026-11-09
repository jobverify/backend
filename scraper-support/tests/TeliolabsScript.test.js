import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T08:00:00.000Z'

const openingsHtml = `
<!doctype html>
<html>
  <head>
    <title>Jobs | Career Opportunities - Teliolabs Communications Inc.</title>
  </head>
  <body>
    <div class="awsm-job-wrap">
      <div class="awsm-job-listings awsm-row awsm-grid-col-4" data-listings="10">
        <div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-24496">
          <a href="https://teliolabs.com/career/cloud-native-engineer/" class="awsm-job-item">
            <h2 class="awsm-job-post-title">Cloud Native Engineer</h2>
            <div class="awsm-job-specification-wrapper">
              <div class="awsm-job-specification-item awsm-job-specification-job-category"><span class="awsm-job-specification-term">Information Technology</span></div>
              <div class="awsm-job-specification-item awsm-job-specification-job-type"><span class="awsm-job-specification-term">Full Time</span></div>
              <div class="awsm-job-specification-item awsm-job-specification-job-location"><span class="awsm-job-specification-term">Remote</span></div>
              <div class="awsm-job-specification-item awsm-job-specification-languages"><span class="awsm-job-specification-term">English</span></div>
              <div class="awsm-job-specification-item awsm-job-specification-experience"><span class="awsm-job-specification-term">5 to 10 Years</span></div>
            </div>
            <span class="awsm-job-more">More Details</span>
          </a>
        </div>
        <div class="awsm-job-listing-item awsm-grid-item" id="awsm-grid-item-24460">
          <a href="https://teliolabs.com/career/junior-perl-developer/" class="awsm-job-item">
            <h2 class="awsm-job-post-title">Junior Perl Developer</h2>
            <div class="awsm-job-specification-wrapper">
              <div class="awsm-job-specification-item awsm-job-specification-job-category"><span class="awsm-job-specification-term">Information Technology</span></div>
              <div class="awsm-job-specification-item awsm-job-specification-job-type"><span class="awsm-job-specification-term">Full Time</span></div>
              <div class="awsm-job-specification-item awsm-job-specification-job-location"><span class="awsm-job-specification-term">Remote Location</span></div>
              <div class="awsm-job-specification-item awsm-job-specification-languages"><span class="awsm-job-specification-term">English</span></div>
              <div class="awsm-job-specification-item awsm-job-specification-experience"><span class="awsm-job-specification-term">3 Year</span></div>
            </div>
            <span class="awsm-job-more">More Details</span>
          </a>
        </div>
      </div>
    </div>
  </body>
</html>
`

const cloudNativeHtml = `
<!doctype html>
<html>
  <head>
    <title>Cloud Native Engineer - Teliolabs Communications Inc.</title>
  </head>
  <body>
    <h1 class="entry-title">Cloud Native Engineer</h1>
    <div class="awsm-job-specification-wrapper">
      <div class="awsm-job-specification-item awsm-job-specification-job-category"><span class="awsm-job-specification-label"><strong>Job Category: </strong></span><span class="awsm-job-specification-term">Information Technology</span></div>
      <div class="awsm-job-specification-item awsm-job-specification-job-type"><span class="awsm-job-specification-label"><strong>Job Type: </strong></span><span class="awsm-job-specification-term">Full Time</span></div>
      <div class="awsm-job-specification-item awsm-job-specification-job-location"><span class="awsm-job-specification-label"><strong>Job Location: </strong></span><span class="awsm-job-specification-term">Remote</span></div>
      <div class="awsm-job-specification-item awsm-job-specification-languages"><span class="awsm-job-specification-label"><strong>Languages: </strong></span><span class="awsm-job-specification-term">English</span></div>
      <div class="awsm-job-specification-item awsm-job-specification-experience"><span class="awsm-job-specification-label"><strong>Experience: </strong></span><span class="awsm-job-specification-term">5 to 10 Years</span></div>
    </div>
    <div class="awsm-job-entry-content entry-content">
      <h2>Cloud Native Engineer (Kubernetes /OCCNE)</h2>
      <h3>Experience: 5-10 Years</h3>
      <ul>
        <li>Hands-on experience in deploying and managing production-grade Kubernetes clusters (mandatory).</li>
        <li>Strong expertise in Kubernetes cluster setup, configuration, scaling, and upgrades in live environments.</li>
        <li>Experience working with Oracle Cloud Native Environment (OCNE) or similar Kubernetes platforms.</li>
      </ul>
    </div>
    <div class="awsm-job-form">
      <label>Upload CV/Resume</label>
    </div>
  </body>
</html>
`

const juniorPerlHtml = `
<!doctype html>
<html>
  <head>
    <title>Junior Perl Developer - Teliolabs Communications Inc.</title>
  </head>
  <body>
    <h1 class="entry-title">Junior Perl Developer</h1>
    <div class="awsm-job-specification-wrapper">
      <div class="awsm-job-specification-item awsm-job-specification-job-category"><span class="awsm-job-specification-label"><strong>Job Category: </strong></span><span class="awsm-job-specification-term">Information Technology</span></div>
      <div class="awsm-job-specification-item awsm-job-specification-job-type"><span class="awsm-job-specification-label"><strong>Job Type: </strong></span><span class="awsm-job-specification-term">Full Time</span></div>
      <div class="awsm-job-specification-item awsm-job-specification-job-location"><span class="awsm-job-specification-label"><strong>Job Location: </strong></span><span class="awsm-job-specification-term">Remote Location</span></div>
      <div class="awsm-job-specification-item awsm-job-specification-languages"><span class="awsm-job-specification-label"><strong>Languages: </strong></span><span class="awsm-job-specification-term">English</span></div>
      <div class="awsm-job-specification-item awsm-job-specification-experience"><span class="awsm-job-specification-label"><strong>Experience: </strong></span><span class="awsm-job-specification-term">3 Year</span></div>
    </div>
    <div class="awsm-job-entry-content entry-content">
      <h2>Job Description:</h2>
      <p>The ideal candidate will have 2-3 years of hands-on experience with Perl programming, MySQL databases, and a basic understanding of Linux command-line operations.</p>
      <h2>Required Skills and Qualifications:</h2>
      <ul>
        <li>Strong knowledge of MySQL database design, query optimization, and performance tuning.</li>
        <li>Solid understanding of Linux command-line environment.</li>
      </ul>
      <p><strong>Note:</strong> Need immediate joiners</p>
    </div>
    <div class="awsm-job-form">
      <label>Upload CV/Resume</label>
    </div>
  </body>
</html>
`

const loadTeliolabsModule = async () => {
  try {
    return await import('../../scraper/teliolabs/script.js')
  } catch {
    assert.fail('Expected Teliolabs scraper module at ../../scraper/teliolabs/script.js')
  }
}

test('Teliolabs pins the verified first-party jobs archive and live cards', async () => {
  const teliolabs = await loadTeliolabsModule()

  assert.equal(teliolabs.SOURCE, 'teliolabs')
  assert.equal(teliolabs.COMPANY, 'Teliolabs')
  assert.equal(teliolabs.COMPANY_DOMAIN, 'teliolabs.com')
  assert.equal(teliolabs.CAREERS_URL, 'https://teliolabs.com/job-openings/')
  assert.equal(teliolabs.VERIFIED_ON, '2026-07-18')
  assert.equal(teliolabs.hasOfficialJobsArchiveSignal(openingsHtml), true)
  assert.deepEqual(teliolabs.extractJobCards(openingsHtml), [
    {
      title: 'Cloud Native Engineer',
      sourceUrl: 'https://teliolabs.com/career/cloud-native-engineer/',
      applyUrl: 'https://teliolabs.com/career/cloud-native-engineer/',
      department: 'Information Technology',
      location: 'Remote, India',
      city: null,
      country: 'India',
      employmentType: 'Full Time',
      experienceRequired: '5 to 10 Years',
      jobId: 'cloud-native-engineer',
      requisitionId: 'cloud-native-engineer',
      languages: ['English'],
    },
    {
      title: 'Junior Perl Developer',
      sourceUrl: 'https://teliolabs.com/career/junior-perl-developer/',
      applyUrl: 'https://teliolabs.com/career/junior-perl-developer/',
      department: 'Information Technology',
      location: 'Remote Location, India',
      city: null,
      country: 'India',
      employmentType: 'Full Time',
      experienceRequired: '3 Year',
      jobId: 'junior-perl-developer',
      requisitionId: 'junior-perl-developer',
      languages: ['English'],
    },
  ])
})

test('Teliolabs detail parsing keeps the structured job specs and first-party descriptions', async () => {
  const teliolabs = await loadTeliolabsModule()

  const cloudNative = teliolabs.extractJobDetail(cloudNativeHtml, {
    title: 'Cloud Native Engineer',
    sourceUrl: 'https://teliolabs.com/career/cloud-native-engineer/',
    applyUrl: 'https://teliolabs.com/career/cloud-native-engineer/',
    department: 'Information Technology',
    location: 'Remote, India',
    city: null,
    country: 'India',
    employmentType: 'Full Time',
    experienceRequired: '5 to 10 Years',
    jobId: 'cloud-native-engineer',
    requisitionId: 'cloud-native-engineer',
    languages: ['English'],
  })
  assert.equal(cloudNative.title, 'Cloud Native Engineer')
  assert.equal(cloudNative.employmentType, 'Full Time')
  assert.equal(cloudNative.experienceRequired, '5 to 10 Years')
  assert.ok(
    cloudNative.requiredSkills.some((skill) => /production-grade Kubernetes clusters/i.test(skill)),
  )

  const juniorPerl = teliolabs.extractJobDetail(juniorPerlHtml, {
    title: 'Junior Perl Developer',
    sourceUrl: 'https://teliolabs.com/career/junior-perl-developer/',
    applyUrl: 'https://teliolabs.com/career/junior-perl-developer/',
    department: 'Information Technology',
    location: 'Remote Location, India',
    city: null,
    country: 'India',
    employmentType: 'Full Time',
    experienceRequired: '3 Year',
    jobId: 'junior-perl-developer',
    requisitionId: 'junior-perl-developer',
    languages: ['English'],
  })
  assert.equal(juniorPerl.title, 'Junior Perl Developer')
  assert.match(juniorPerl.jobDescription, /Perl programming/i)
  assert.ok(
    juniorPerl.requiredSkills.some((skill) => /MySQL database design/i.test(skill)),
  )
})

test('Teliolabs run validates the archive and decorates the first-party role pages', async () => {
  const teliolabs = await loadTeliolabsModule()
  const requestedUrls = []

  const jobs = await teliolabs.createTeliolabsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === teliolabs.CAREERS_URL) return openingsHtml
      if (url === 'https://teliolabs.com/career/cloud-native-engineer/') return cloudNativeHtml
      if (url === 'https://teliolabs.com/career/junior-perl-developer/') return juniorPerlHtml
      throw new Error(`Unexpected Teliolabs URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    teliolabs.CAREERS_URL,
    'https://teliolabs.com/career/cloud-native-engineer/',
    'https://teliolabs.com/career/junior-perl-developer/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'teliolabs')
  assert.equal(jobs[0].company, 'Teliolabs')
  assert.equal(jobs[0].companyCareerPage, teliolabs.CAREERS_URL)
  assert.equal(jobs[0].companyDomain, 'teliolabs.com')
  assert.equal(jobs[0].atsPlatform, 'wp-job-openings')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Teliolabs fails closed when the verified jobs archive drifts materially', async () => {
  const teliolabs = await loadTeliolabsModule()

  await assert.rejects(
    teliolabs.createTeliolabsScraper().run({
      fetchText: async () => '<html><title>Unexpected</title></html>',
    }),
    /verified Teliolabs jobs archive/i,
  )
})
