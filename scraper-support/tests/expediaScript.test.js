import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const detailDescriptionHtml = `
<p>At Expedia Group, we help travelers explore the world, one journey at a time.</p>
<p><b>In this role, you will:</b></p>
<ul>
  <li><p>Design, develop, test, and maintain scalable machine learning services.</p></li>
  <li><p>Collaborate with product managers and data scientists on ML system design.</p></li>
</ul>
<p><b>Minimum Qualifications:</b></p>
<ul>
  <li><p>Bachelor's degree in Computer Science or a related technical field; or equivalent related professional experience.</p></li>
  <li><p>2+ years of relevant professional experience.</p></li>
</ul>
<p><b>Preferred Qualifications:</b></p>
<ul>
  <li><p>Experience designing and implementing scalable, fault-tolerant, and high-throughput ML services.</p></li>
  <li><p>Ability to influence ML system designs within a team or product area.</p></li>
</ul>
`

const careersHomeHtml = `
<!doctype html>
<html lang="en-US">
<head>
  <title>Home - Expedia Group | Careers</title>
</head>
<body>
  <section class="Hero-search">
    <form action="https://careers.expediagroup.com/jobs" method="GET" class="Hero-search__form">
      <input type="text" name="keyword" placeholder="Enter keyword/title">
      <a href="https://careers.expediagroup.com/jobs">Search Jobs</a>
    </form>
    <h2>Search Expedia Group Jobs</h2>
    <p>We currently have 165 openings in 15 countries.</p>
    <p>Explore careers in Gurgaon, India.</p>
  </section>
</body>
</html>
`

const jobsPageZeroHtml = `
<!doctype html>
<html lang="en-US">
<head>
  <title>Jobs | Expedia Group | Careers</title>
  <link rel="canonical" href="https://careers.expediagroup.com/jobs/" />
  <link rel='next' href="https://careers.expediagroup.com/jobs/?&mypage=1">
</head>
<body>
  <div class="Results">
    <ul class="Results__list" id="results-list">
      <li class="Results__list__item">
        <div class="Results__list__header">
          <div class="Results__list__content">
            <a href="/job/machine-learning-engineer-ii/gurgaon-hary-na/R-108134/" class="view-job-button">
              <h3 class="Results__list__title h4 text-blue-2">Machine Learning Engineer II</h3>
              <h4 class="Results__list__location h5">India - Haryāna - Gurgaon</h4>
              <p>Technology</p>
            </a>
          </div>
          <a href="/job/machine-learning-engineer-ii/gurgaon-hary-na/R-108134/" class="Results__list__button view-job-button">
            View Job
          </a>
        </div>
      </li>
      <li class="Results__list__item">
        <div class="Results__list__header">
          <div class="Results__list__content">
            <a href="/job/associate-account-manager/prague-prague/R-102433/" class="view-job-button">
              <h3 class="Results__list__title h4 text-blue-2">Associate Account Manager</h3>
              <h4 class="Results__list__location h5">Czechia - Prague</h4>
              <p>Commercial</p>
            </a>
          </div>
          <a href="/job/associate-account-manager/prague-prague/R-102433/" class="Results__list__button view-job-button">
            View Job
          </a>
        </div>
      </li>
    </ul>
  </div>
</body>
</html>
`

const jobsPageOneHtml = `
<!doctype html>
<html lang="en-US">
<head>
  <title>Jobs | Expedia Group | Careers</title>
  <link rel="canonical" href="https://careers.expediagroup.com/jobs/" />
  <link rel='next' href="https://careers.expediagroup.com/jobs/?&mypage=2"><link rel='prev' href="https://careers.expediagroup.com/jobs/?&mypage=0">
</head>
<body>
  <div class="Results">
    <ul class="Results__list" id="results-list">
      <li class="Results__list__item">
        <div class="Results__list__header">
          <div class="Results__list__content">
            <a href="/job/network-engineer-i/prague-prague/R-105186/" class="view-job-button">
              <h3 class="Results__list__title h4 text-blue-2">Network Engineer I</h3>
              <h4 class="Results__list__location h5">Czechia - Prague</h4>
              <p>Technology</p>
            </a>
          </div>
          <a href="/job/network-engineer-i/prague-prague/R-105186/" class="Results__list__button view-job-button">
            View Job
          </a>
        </div>
      </li>
    </ul>
  </div>
</body>
</html>
`

const detailPageHtml = `
<!doctype html>
<html lang="en-US">
<head>
  <title>Machine Learning Engineer II in Gurgaon, Haryāna | Expedia Group | Careers</title>
  <link rel="canonical" href="https://careers.expediagroup.com/job/machine-learning-engineer-ii/gurgaon-hary-na/R-108134/" />
</head>
<body>
  <section class="Hero--apply">
    <a href="https://expedia.wd108.myworkdayjobs.com/search/job/India---Gurgaon/Machine-Learning-Engineer-II_R-108134/apply?" class="Hero__button button button--primary page_apply_link hero">
      Apply Now
    </a>
  </section>
  <section class="Desc">
    <h1 class="Desc__title text-blue-2">Machine Learning Engineer II</h1>
    <div class="Desc__copy text-body">
      ${detailDescriptionHtml}
    </div>
  </section>
  <div class="Sidenav">
    <ul class="Info__list">
      <li class="Info__list__item"><p><a href="https://careers.expediagroup.com/jobs/location/HARYANA/Gurgaon/" class="underline">India - Haryāna - Gurgaon</a></p></li>
      <li class="Info__list__item"><p><a href="https://careers.expediagroup.com/jobs/category/Technology/" class="underline">Technology</a></p></li>
      <li class="Info__list__item"><p>Full-Time Regular</p></li>
      <li class="Info__list__item"><p>07/24/2026</p></li>
      <li class="Info__list__item"><p>ID # R-108134</p></li>
    </ul>
  </div>
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'http://schema.org',
    '@type': 'JobPosting',
    datePosted: '2026-07-24',
    title: 'Machine Learning Engineer II',
    description: detailDescriptionHtml,
    identifier: 'R-108134',
    hiringOrganization: {
      '@type': 'Organization',
      name: 'Expedia Group',
      sameAs: 'https://careers.expediagroup.com',
    },
  })}</script>
</body>
</html>
`

const loadExpediaModule = async () => {
  try {
    return await import('../../scraper/expedia/script.js')
  } catch {
    assert.fail('Expected Expedia scraper module at ../../scraper/expedia/script.js')
  }
}

test('Expedia helpers stay pinned to the verified first-party careers, jobs, pagination, and detail page contracts', async () => {
  const expedia = await loadExpediaModule()

  assert.equal(expedia.SOURCE, 'expedia')
  assert.equal(expedia.COMPANY, 'Expedia')
  assert.equal(expedia.OFFICIAL_BRAND_NAME, 'Expedia Group')
  assert.equal(expedia.VERIFIED_ON, '2026-09-13')
  assert.equal(expedia.HOMEPAGE_URL, 'https://careers.expediagroup.com/')
  assert.equal(expedia.CAREERS_URL, 'https://careers.expediagroup.com/')
  assert.equal(expedia.JOBS_URL, 'https://careers.expediagroup.com/jobs/')
  assert.equal(expedia.WORKDAY_HOST, 'expedia.wd108.myworkdayjobs.com')
  assert.equal(expedia.hasOfficialCareersPageSignal(careersHomeHtml), true)
  assert.equal(
    expedia.extractJobsPageUrl(careersHomeHtml),
    'https://careers.expediagroup.com/jobs',
  )
  assert.equal(expedia.hasOfficialJobsPageSignal(jobsPageZeroHtml), true)
  assert.equal(
    expedia.extractNextPageUrl(jobsPageZeroHtml),
    'https://careers.expediagroup.com/jobs/?&mypage=1',
  )
  assert.equal(
    expedia.extractNextPageUrl(jobsPageOneHtml),
    'https://careers.expediagroup.com/jobs/?&mypage=2',
  )
  assert.equal(
    expedia.hasOfficialJobDetailSignal(
      detailPageHtml,
      'https://careers.expediagroup.com/job/machine-learning-engineer-ii/gurgaon-hary-na/R-108134/',
    ),
    true,
  )
})

test('Expedia extracts only India job cards from the verified first-party jobs page', async () => {
  const expedia = await loadExpediaModule()

  assert.deepEqual(expedia.extractJobCards(jobsPageZeroHtml), [
    {
      title: 'Machine Learning Engineer II',
      company: 'Expedia',
      department: 'Technology',
      location: 'India - Haryāna - Gurgaon',
      city: 'Gurgaon',
      country: 'India',
      jobId: 'R-108134',
      requisitionId: 'R-108134',
      sourceUrl: 'https://careers.expediagroup.com/job/machine-learning-engineer-ii/gurgaon-hary-na/R-108134/',
      applyUrl: 'https://careers.expediagroup.com/job/machine-learning-engineer-ii/gurgaon-hary-na/R-108134/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
  ])
})

test('Expedia detail extraction lifts the first-party detail fields and Workday apply handoff', async () => {
  const expedia = await loadExpediaModule()
  const listing = expedia.extractJobCards(jobsPageZeroHtml)[0]
  const job = expedia.extractJobDetail(detailPageHtml, listing)

  assert.equal(job.title, 'Machine Learning Engineer II')
  assert.equal(job.department, 'Technology')
  assert.equal(job.location, 'India - Haryāna - Gurgaon')
  assert.equal(job.city, 'Gurgaon')
  assert.equal(job.country, 'India')
  assert.equal(
    job.applyUrl,
    'https://expedia.wd108.myworkdayjobs.com/search/job/India---Gurgaon/Machine-Learning-Engineer-II_R-108134/apply?',
  )
  assert.equal(job.employmentType, 'Full-Time Regular')
  assert.equal(job.postingDate, '2026-07-24')
  assert.equal(job.requisitionId, 'R-108134')
  assert.match(job.jobDescription, /At Expedia Group, we help travelers explore the world/i)
  assert.match(job.jobDescription, /In this role, you will:/i)
  assert.match(job.jobDescription, /Minimum Qualifications:/i)
  assert.match(job.jobDescription, /Preferred Qualifications:/i)
  assert.equal(
    job.minimumQualification,
    "Bachelor's degree in Computer Science or a related technical field; or equivalent related professional experience.",
  )
  assert.equal(
    job.preferredQualification,
    'Experience designing and implementing scalable, fault-tolerant, and high-throughput ML services.',
  )
  assert.deepEqual(job.requiredSkills, [
    "Bachelor's degree in Computer Science or a related technical field; or equivalent related professional experience.",
    '2+ years of relevant professional experience.',
    'Experience designing and implementing scalable, fault-tolerant, and high-throughput ML services.',
    'Ability to influence ML system designs within a team or product area.',
  ])
})

