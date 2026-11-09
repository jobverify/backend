import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Times Internet | Explore Jobs with Times of India, Economic Times, Times Prime & More</title>
  </head>
  <body>
    <h1>TAKE US TO THE NEXT LEVEL</h1>
    <div>JOB CATEGORY</div>
    <div>All Categories</div>
    <div>LOCATION</div>
    <div>All Locations</div>
    <div>JOB TYPE</div>
    <div>All Types</div>
    <div>Hello, I'm your Talent Assistant at Times Internet.</div>
    <section>Meet our people</section>
    <a href="/careers/job-detail/6a60f01a58a30d19cf8ee9b4">
      Manager - New Business Development_Agency Relations
      LOCATION: Gurgaon
      BUSINESS: Ad Sales
      EXPERIENCE: 5 - 8 Years
    </a>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Manager- New Business Development Job at Times Internet | Agency Relations Jobs in Gurgaon Apply Now</title>
  </head>
  <body>
    <h1>Manager- New Business Development</h1>
    <div>Job Description</div>
    <div>About Times Internet</div>
    <div>Location: Gurgaon</div>
    <div>Experience: 5 - 8 Years</div>
    <a href="/careers/job-apply/6a60f01a58a30d19cf8ee9b4">Apply now</a>
  </body>
</html>
`

const companyDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Enterprise Sales Manager Job at Times Internet | Times Mobile Jobs in Mumbai Apply Now</title>
  </head>
  <body>
    <h1>Enterprise Sales Manager</h1>
    <div>Job Description</div>
    <div>About the company:</div>
    <a href="/careers/job-apply/66a0e68e58a30d19cf24a9b0">Apply now</a>
  </body>
</html>
`

const alternateDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Senior Executive-Client Success-ET B2B Job at Times Internet | Ad Sales Jobs in Bengaluru Apply Now</title>
  </head>
  <body>
    <h1>Senior Executive-Client Success-ET B2B</h1>
    <div>Job Description</div>
    <div>About Times Limited</div>
    <div>Experience: 6 - 8 Years</div>
    <a href="/careers/job-apply/6a59072b58a30d19cf3927c2">Apply now</a>
  </body>
</html>
`

test('Times Internet recognizes the current careers page shell and extracts same-domain detail links', async () => {
  const timesInternet = await loadModule()

  assert.equal(timesInternet.hasOfficialCareersSignal(careersHtml), true)

  const cards = timesInternet.extractJobCards(careersHtml)
  assert.equal(cards.length, 1)
  assert.deepEqual(cards[0], {
    title: 'Manager - New Business Development_Agency Relations',
    location: 'Gurgaon',
    business: 'Ad Sales',
    experience: '5 - 8 Years',
    detailUrl: 'https://timesinternet.in/careers/job-detail/6a60f01a58a30d19cf8ee9b4',
  })
})

test('Times Internet normalizes a live-shape detail page into a job record', async () => {
  const timesInternet = await loadModule()

  const cards = timesInternet.extractJobCards(careersHtml)
  assert.equal(timesInternet.hasOfficialJobDetailSignal(detailHtml), true)

  assert.deepEqual(
    timesInternet.extractJobFromDetailHtml(detailHtml, cards[0], {
      scrapedAt: '2026-08-05T00:00:00.000Z',
    }),
    {
      title: 'Manager- New Business Development',
      company: 'Times Internet',
      department: 'Ad Sales',
      location: 'Gurgaon, India',
      city: 'Gurgaon',
      country: 'India',
      jobId: '6a60f01a58a30d19cf8ee9b4',
      requisitionId: '6a60f01a58a30d19cf8ee9b4',
      sourceUrl: 'https://timesinternet.in/careers/job-detail/6a60f01a58a30d19cf8ee9b4',
      applyUrl: 'https://timesinternet.in/careers/job-apply/6a60f01a58a30d19cf8ee9b4',
      employmentType: null,
      experienceRequired: '5 - 8 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
      source: 'timesinternet',
      link: 'https://timesinternet.in/careers/job-detail/6a60f01a58a30d19cf8ee9b4',
      scrapedAt: '2026-08-05T00:00:00.000Z',
    },
  )
})

test('Times Internet accepts the current detail-page variant that uses About Times Limited copy', async () => {
  const timesInternet = await loadModule()

  assert.equal(timesInternet.hasOfficialJobDetailSignal(alternateDetailHtml), true)
})

test('Times Internet accepts the current detail-page variant that uses About the company copy', async () => {
  const timesInternet = await loadModule()

  assert.equal(timesInternet.hasOfficialJobDetailSignal(companyDetailHtml), true)
})
