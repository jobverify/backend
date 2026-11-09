import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-14T00:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
<head>
  <title>Endurance Technologies Limited.</title>
</head>
<body>
  <nav>
    <a href="https://www.endurancegroup.com/careers/">Careers</a>
    <a href="https://www.endurancegroup.com/careers/job-portal/">Job Portal</a>
  </nav>
  <section>
    <h2>Join the Endurance family</h2>
    <p>Find your fit. Discover your family.</p>
  </section>
</body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
<head>
  <title>Careers - Endurance</title>
</head>
<body>
  <h2>Applying to Endurance</h2>
  <p>
    Endurance is looking for passionate, hardworking, result-oriented, ethical, disciplined and innovative team players.
    To join our team and become an Endurian, please mail your CV at careers@endurance.co.in
  </p>
  <h4>Current Openings</h4>
  <ul>
    <li><a href="https://www.endurancegroup.com/career/technical-architect/">Technical Architect | Embedded Function 14 years experience</a></li>
    <li><a href="https://www.endurancegroup.com/career/technical-lead-hardware/">Technical Lead - Hardware | Embedded Function 7 years experience</a></li>
  </ul>
  <a href="https://www.endurancegroup.com/careers/job-portal/">View All</a>
</body>
</html>
`

const jobPortalHtml = `
<!doctype html>
<html lang="en">
<head>
  <title>Job Portal - Endurance</title>
</head>
<body>
  <h2>Current Opening</h2>
  <p>Drop your CV here</p>
  <p>We will consider your Profile for future Jobs</p>
  <p>Current Opening (2)</p>

  <article class="job-card">
    <h3>Job Opening for Technical Architect</h3>
    <span class="experience">14 Years</span>
    <span class="designation">Assistant Manager</span>
    <span class="location">Pune</span>
    <a href="https://www.endurancegroup.com/career/technical-architect/">Read More</a>
  </article>

  <article class="job-card">
    <h3>Job Opening for Technical Lead - Hardware</h3>
    <span class="experience">7 Years</span>
    <span class="designation">Assistant Manager</span>
    <span class="location">Pune</span>
    <a href="https://www.endurancegroup.com/career/technical-lead-hardware/">Read More</a>
  </article>
</body>
</html>
`

const technicalArchitectDetailHtml = `
<!doctype html>
<html lang="en">
<head>
  <title>Technical Architect - Endurance</title>
</head>
<body>
  <h1>Technical Architect</h1>
  <p class="designation">Assistant Manager</p>
  <p class="experience">14 Years</p>
  <p class="location">Pune</p>
  <button>Apply now</button>
  <ul>
    <li>Job Responsibilities</li>
    <li>Job Qualifications</li>
    <li>He/She will work as the Technical Leader for our Ongoing Embedded Projects.</li>
    <li>Candidate will be responsible for defining and governing overall system architecture for ECUs which Includes HW and SW.</li>
    <li>Additionally he/she will manage the team leaders from SW, HW and V&V divisions.</li>
    <li>B.E/B.Tech (Electronics/Electrical/Computer Science)</li>
    <li>CDAC certification (VLSI or similar) will be considered as an added advantage</li>
  </ul>
  <section>
    <h3>Apply Now</h3>
    <label>Upload Resume*</label>
  </section>
</body>
</html>
`

const blockedChallengePage = {
  status: 403,
  url: 'https://www.endurancegroup.com/',
  headers: {
    server: 'cloudflare',
    'cf-ray': 'a2acec77cb67285b-MAA',
    'cf-mitigated': 'challenge',
  },
  html: `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <noscript>
      <div>Enable JavaScript and cookies to continue</div>
    </noscript>
    <script src="https://challenges.cloudflare.com"></script>
  </body>
</html>
`,
}

const loadEnduranceModule = async () => {
  try {
    return await import('../../scraper/endurance/script.js')
  } catch {
    assert.fail('Expected Endurance scraper module at ../../scraper/endurance/script.js')
  }
}

test('Endurance helpers keep the verified first-party homepage, careers page, and job portal pinned', async () => {
  const endurance = await loadEnduranceModule()

  assert.equal(endurance.SOURCE, 'endurance')
  assert.equal(endurance.COMPANY, 'Endurance')
  assert.equal(endurance.OFFICIAL_BRAND_NAME, 'Endurance Technologies Limited')
  assert.equal(endurance.VERIFIED_ON, '2026-08-14')
  assert.equal(endurance.HOMEPAGE_URL, 'https://www.endurancegroup.com/')
  assert.equal(endurance.CAREERS_URL, 'https://www.endurancegroup.com/careers/')
  assert.equal(endurance.JOB_PORTAL_URL, 'https://www.endurancegroup.com/careers/job-portal/')
  assert.match(endurance.VERIFIED_SURFACE_SUMMARY, /\b403\b/i)
  assert.match(endurance.VERIFIED_SURFACE_SUMMARY, /Just a moment/i)
  assert.equal(
    endurance.normalizeDetailUrl('https://www.endurancegroup.com/career/technical-architect/'),
    'https://www.endurancegroup.com/career/technical-architect/',
  )
  assert.equal(endurance.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(endurance.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(endurance.hasOfficialJobPortalSignal(jobPortalHtml), true)
  assert.equal(endurance.hasOfficialJobDetailSignal(technicalArchitectDetailHtml), true)
  assert.equal(endurance.hasVerifiedCloudflareChallengeSignal(blockedChallengePage), true)
})

test('Endurance extracts verified first-party job cards from the job portal and enriches them from detail pages', async () => {
  const endurance = await loadEnduranceModule()

  const cards = endurance.extractJobCards(jobPortalHtml)
  assert.equal(cards.length, 2)
  assert.deepEqual(cards, [
    {
      title: 'Technical Architect',
      company: 'Endurance',
      department: null,
      location: 'Pune',
      city: 'Pune',
      country: 'India',
      jobId: 'technical-architect',
      requisitionId: 'technical-architect',
      sourceUrl: 'https://www.endurancegroup.com/career/technical-architect/',
      applyUrl: 'https://www.endurancegroup.com/career/technical-architect/',
      employmentType: null,
      experienceRequired: '14 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
    {
      title: 'Technical Lead - Hardware',
      company: 'Endurance',
      department: null,
      location: 'Pune',
      city: 'Pune',
      country: 'India',
      jobId: 'technical-lead-hardware',
      requisitionId: 'technical-lead-hardware',
      sourceUrl: 'https://www.endurancegroup.com/career/technical-lead-hardware/',
      applyUrl: 'https://www.endurancegroup.com/career/technical-lead-hardware/',
      employmentType: null,
      experienceRequired: '7 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
  ])

  const detail = endurance.extractJobDetail(technicalArchitectDetailHtml, cards[0])
  assert.equal(detail.title, 'Technical Architect')
  assert.equal(detail.company, 'Endurance')
  assert.equal(detail.location, 'Pune')
  assert.equal(detail.city, 'Pune')
  assert.equal(detail.country, 'India')
  assert.equal(detail.experienceRequired, '14 Years')
  assert.match(detail.jobDescription, /Ongoing Embedded Projects/i)
  assert.deepEqual(detail.requiredSkills, [
    'He/She will work as the Technical Leader for our Ongoing Embedded Projects.',
    'Candidate will be responsible for defining and governing overall system architecture for ECUs which Includes HW and SW.',
    'Additionally he/she will manage the team leaders from SW, HW and V&V divisions.',
    'B.E/B.Tech (Electronics/Electrical/Computer Science)',
    'CDAC certification (VLSI or similar) will be considered as an added advantage',
  ])
  assert.equal(
    detail.applyUrl,
    'https://www.endurancegroup.com/career/technical-architect/',
  )
  assert.equal(
    detail.sourceUrl,
    'https://www.endurancegroup.com/career/technical-architect/',
  )
})

test('run validates the verified Endurance first-party surfaces and returns job records from the first-party detail pages', async () => {
  const endurance = await loadEnduranceModule()
  const requestedUrls = []

  const jobs = await endurance.createEnduranceScraper({
    maxJobs: 1,
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === endurance.HOMEPAGE_URL) return homepageHtml
      if (url === endurance.CAREERS_URL) return careersHtml
      if (url === endurance.JOB_PORTAL_URL) return jobPortalHtml
      if (url === 'https://www.endurancegroup.com/career/technical-architect/') {
        return technicalArchitectDetailHtml
      }

      throw new Error(`Unexpected Endurance URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.endurancegroup.com/',
    'https://www.endurancegroup.com/careers/',
    'https://www.endurancegroup.com/careers/job-portal/',
    'https://www.endurancegroup.com/career/technical-architect/',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Technical Architect',
      company: 'Endurance',
      department: null,
      location: 'Pune',
      city: 'Pune',
      country: 'India',
      jobId: 'technical-architect',
      requisitionId: 'technical-architect',
      sourceUrl: 'https://www.endurancegroup.com/career/technical-architect/',
      applyUrl: 'https://www.endurancegroup.com/career/technical-architect/',
      employmentType: null,
      experienceRequired: '14 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'He/She will work as the Technical Leader for our Ongoing Embedded Projects.',
        'Candidate will be responsible for defining and governing overall system architecture for ECUs which Includes HW and SW.',
        'Additionally he/she will manage the team leaders from SW, HW and V&V divisions.',
        'B.E/B.Tech (Electronics/Electrical/Computer Science)',
        'CDAC certification (VLSI or similar) will be considered as an added advantage',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'He/She will work as the Technical Leader for our Ongoing Embedded Projects. Candidate will be responsible for defining and governing overall system architecture for ECUs which Includes HW and SW. Additionally he/she will manage the team leaders from SW, HW and V&V divisions. B.E/B.Tech (Electronics/Electrical/Computer Science) CDAC certification (VLSI or similar) will be considered as an added advantage',
      remoteStatus: null,
      source: 'endurance',
      link: 'https://www.endurancegroup.com/career/technical-architect/',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('run returns [] when the verified Endurance homepage is challenge-gated by Cloudflare', async () => {
  const endurance = await loadEnduranceModule()
  const requestedUrls = []

  const jobs = await endurance.createEnduranceScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === endurance.HOMEPAGE_URL) {
        return blockedChallengePage
      }

      throw new Error(`Unexpected Endurance URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [endurance.HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the verified Endurance homepage, careers page, job portal, or detail page drift materially', async () => {
  const endurance = await loadEnduranceModule()

  await assert.rejects(
    endurance.createEnduranceScraper().run({
      fetchText: async (url) => {
        if (url === endurance.HOMEPAGE_URL) {
          return homepageHtml.replace('Join the Endurance family', 'Build with Us')
        }
        return careersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    endurance.createEnduranceScraper().run({
      fetchText: async (url) => {
        if (url === endurance.HOMEPAGE_URL) return homepageHtml
        if (url === endurance.CAREERS_URL) return careersHtml
        return jobPortalHtml.replace('Current Opening', 'Open Roles')
      },
    }),
    /verified job portal/i,
  )

  await assert.rejects(
    endurance.createEnduranceScraper().run({
      fetchText: async (url) => {
        if (url === endurance.HOMEPAGE_URL) return homepageHtml
        if (url === endurance.CAREERS_URL) return careersHtml
        if (url === endurance.JOB_PORTAL_URL) return jobPortalHtml
        return technicalArchitectDetailHtml.replace('Upload Resume*', 'Send Resume')
      },
    }),
    /verified first-party job detail/i,
  )
})
