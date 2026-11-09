import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T11:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Endurance</title>
  </head>
  <body>
    <nav>
      <a href="https://www.endurancegroup.com/careers/job-portal/">Job Portal</a>
    </nav>
    <main>
      <h1>Unleash your potential</h1>
      <p>I am interested in</p>
      <p>Life At Endurance</p>
      <p>Equal opportunities, equal dignity without discrimination</p>
    </main>
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
    <main>
      <h2>Current Opening</h2>
      <p>Drop your CV here</p>
      <p>Current Opening (6)</p>
      <ul>
        <li class="job-card">
          <h3>Job Opening for Technical Architect</h3>
          <p>14 Years</p>
          <p>Assistant Manager</p>
          <p>Pune</p>
          <a href="https://www.endurancegroup.com/career/technical-architect/">Read More</a>
        </li>
        <li class="job-card">
          <h3>Job Opening for Technical Lead â€“ Hardware</h3>
          <p>7 Years</p>
          <p>Assistant Manager</p>
          <p>Pune</p>
          <a href="https://www.endurancegroup.com/career/technical-lead-hardware/">Read More</a>
        </li>
        <li class="job-card">
          <h3>Job Opening for Technical Member â€“ Hardware</h3>
          <p>4 Years</p>
          <p>Assistant Manager</p>
          <p>Pune</p>
          <a href="https://www.endurancegroup.com/career/technical-member-hardware/">Read More</a>
        </li>
        <li class="job-card">
          <h3>Job Opening for Technical Lead â€“ Software</h3>
          <p>7 Years</p>
          <p>Assistant Manager</p>
          <p>Pune</p>
          <a href="https://www.endurancegroup.com/career/technical-lead-software/">Read More</a>
        </li>
        <li class="job-card">
          <h3>Job Opening for Technical Member â€“ Software</h3>
          <p>4 Years</p>
          <p>Assistant Manager</p>
          <p>Pune</p>
          <a href="https://www.endurancegroup.com/career/technical-member-software/">Read More</a>
        </li>
        <li class="job-card">
          <h3>Job Opening for Technical Member (Verification &amp; Validation)</h3>
          <p>4 Years</p>
          <p>Assistant Manager</p>
          <p>Pune</p>
          <a href="https://www.endurancegroup.com/career/technical-member-verification-validation/">Read More</a>
        </li>
      </ul>
      <h3>Apply Now</h3>
    </main>
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
    <main>
      <h1>Technical Architect</h1>
      <div class="job-meta">
        <p>Assistant Manager</p>
        <p>14 Years</p>
        <p>Pune</p>
      </div>
      <a href="#apply">Apply now</a>
      <h2>Technical Architect</h2>
      <h3>Job Responsibilities</h3>
      <ul>
        <li>He/She will work as the Technical Leader for our Ongoing Embedded Projects.</li>
        <li>Candidate will be responsible for defining and governing overall system architecture for ECUs which Includes HW and SW.</li>
        <li>Additionally he/she will manage the team leaders from SW, HW and V&amp;V divisions.</li>
      </ul>
      <a href="#responsibilities">Read More</a>
      <h3>Job Qualifications</h3>
      <ul>
        <li>B.E/B.Tech (Electronics/Electrical/Computer Science)</li>
        <li>CDAC certification (VLSI or similar) will be considered as an added advantage</li>
      </ul>
      <a href="#qualifications">Read More</a>
    </main>
  </body>
</html>
`

const technicalLeadHardwareDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Technical Lead - Hardware - Endurance</title>
  </head>
  <body>
    <main>
      <h1>Technical Lead â€“ Hardware</h1>
      <div class="job-meta">
        <p>Assistant Manager</p>
        <p>7 Years</p>
        <p>Pune</p>
      </div>
      <a href="#apply">Apply now</a>
      <h2>Technical Lead â€“ Hardware</h2>
      <h3>Job Responsibilities</h3>
      <ul>
        <li>He/She will work as the Hardware Lead for our Ongoing Embedded Project.</li>
        <li>Candidate will be responsible to Design &amp; Develop end to end electronic Circuits, create Prototypes and sample hardware and taking it till production.</li>
        <li>Additionally he/she will be leading a hardware team.</li>
      </ul>
      <a href="#responsibilities">Read More</a>
      <h3>Job Qualifications</h3>
      <ul>
        <li>B.E/B.Tech (Electronics/Electrical/Computer Science)</li>
        <li>CDAC certification (VLSI or similar) will be considered as an added advantage</li>
      </ul>
      <a href="#qualifications">Read More</a>
    </main>
  </body>
</html>
`

const blockedChallengePage = {
  status: 403,
  url: 'https://www.endurancegroup.com/careers/',
  headers: {
    server: 'cloudflare',
    'cf-ray': 'a2acbab51999cbcd-MAA',
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

const loadModule = async () => {
  try {
    return await import('../../scraper/endurancetechnologies/script.js')
  } catch {
    assert.fail('Expected Endurance Technologies scraper module at ../../scraper/endurancetechnologies/script.js')
  }
}

test('Endurance Technologies helpers keep the verified first-party careers, job portal, and detail contracts explicit', async () => {
  const enduranceTechnologies = await loadModule()

  assert.equal(enduranceTechnologies.COMPANY, 'Endurance Technologies')
  assert.equal(enduranceTechnologies.OFFICIAL_BRAND_NAME, 'Endurance Technologies Limited')
  assert.equal(enduranceTechnologies.SOURCE, 'endurancetechnologies')
  assert.equal(enduranceTechnologies.HOMEPAGE_URL, 'https://www.endurancegroup.com/')
  assert.equal(enduranceTechnologies.CAREERS_URL, 'https://www.endurancegroup.com/careers/')
  assert.equal(enduranceTechnologies.JOB_PORTAL_URL, 'https://www.endurancegroup.com/careers/job-portal/')
  assert.deepEqual(enduranceTechnologies.VERIFIED_JOB_URLS, [
    'https://www.endurancegroup.com/career/technical-architect/',
    'https://www.endurancegroup.com/career/technical-lead-hardware/',
    'https://www.endurancegroup.com/career/technical-member-hardware/',
    'https://www.endurancegroup.com/career/technical-lead-software/',
    'https://www.endurancegroup.com/career/technical-member-software/',
    'https://www.endurancegroup.com/career/technical-member-verification-validation/',
  ])
  assert.equal(enduranceTechnologies.VERIFIED_ON, '2026-07-15')
  assert.match(enduranceTechnologies.VERIFIED_SURFACE_SUMMARY, /\b403\b/i)
  assert.match(enduranceTechnologies.VERIFIED_SURFACE_SUMMARY, /Just a moment/i)
  assert.equal(enduranceTechnologies.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(
    enduranceTechnologies.extractJobPortalUrl(careersHtml),
    enduranceTechnologies.JOB_PORTAL_URL,
  )
  assert.equal(enduranceTechnologies.hasOfficialJobPortalSignal(jobPortalHtml), true)
  assert.deepEqual(
    enduranceTechnologies.collectListingCandidates(jobPortalHtml).slice(0, 2),
    [
      {
        title: 'Job Opening for Technical Architect',
        experience: '14 Years',
        designation: 'Assistant Manager',
        location: 'Pune',
        sourceUrl: 'https://www.endurancegroup.com/career/technical-architect/',
      },
      {
        title: 'Job Opening for Technical Lead â€“ Hardware',
        experience: '7 Years',
        designation: 'Assistant Manager',
        location: 'Pune',
        sourceUrl: 'https://www.endurancegroup.com/career/technical-lead-hardware/',
      },
    ],
  )

  assert.deepEqual(
    enduranceTechnologies.normalizeListingCandidate({
      title: 'Job Opening for Technical Architect',
      experience: '14 Years',
      designation: 'Assistant Manager',
      location: 'Pune',
      sourceUrl: 'https://www.endurancegroup.com/career/technical-architect/',
    }),
    {
      title: 'Technical Architect',
      company: 'Endurance Technologies',
      designation: 'Assistant Manager',
      experienceRequired: '14 Years',
      location: 'Pune, Maharashtra, India',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      jobId: 'endurancetechnologies-technical-architect',
      requisitionId: 'endurancetechnologies-technical-architect',
      sourceUrl: 'https://www.endurancegroup.com/career/technical-architect/',
      applyUrl: 'https://www.endurancegroup.com/career/technical-architect/',
      department: null,
      employmentType: null,
      jobDescription: null,
    },
  )

  assert.equal(
    enduranceTechnologies.hasOfficialJobDetailSignal(
      technicalArchitectDetailHtml,
      enduranceTechnologies.normalizeListingCandidate({
        title: 'Job Opening for Technical Architect',
        experience: '14 Years',
        designation: 'Assistant Manager',
        location: 'Pune',
        sourceUrl: 'https://www.endurancegroup.com/career/technical-architect/',
      }),
    ),
    true,
  )

  assert.deepEqual(
    enduranceTechnologies.extractJobDetail(
      technicalArchitectDetailHtml,
      enduranceTechnologies.normalizeListingCandidate({
        title: 'Job Opening for Technical Architect',
        experience: '14 Years',
        designation: 'Assistant Manager',
        location: 'Pune',
        sourceUrl: 'https://www.endurancegroup.com/career/technical-architect/',
      }),
    ),
    {
      title: 'Technical Architect',
      company: 'Endurance Technologies',
      designation: 'Assistant Manager',
      department: null,
      location: 'Pune, Maharashtra, India',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      jobId: 'endurancetechnologies-technical-architect',
      requisitionId: 'endurancetechnologies-technical-architect',
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
      jobDescription: [
        'Job Responsibilities',
        '- He/She will work as the Technical Leader for our Ongoing Embedded Projects.',
        '- Candidate will be responsible for defining and governing overall system architecture for ECUs which Includes HW and SW.',
        '- Additionally he/she will manage the team leaders from SW, HW and V&V divisions.',
        '',
        'Job Qualifications',
        '- B.E/B.Tech (Electronics/Electrical/Computer Science)',
        '- CDAC certification (VLSI or similar) will be considered as an added advantage',
      ].join('\n'),
      companyCareerPage: 'https://www.endurancegroup.com/careers/',
      companyDomain: 'endurancegroup.com',
      atsPlatform: 'official-company-careers',
    },
  )
})

test('Endurance Technologies run validates the first-party careers page, browser-rendered portal, and same-domain detail pages', async () => {
  const enduranceTechnologies = await loadModule()
  const requestedUrls = []

  const htmlByUrl = new Map([
    [enduranceTechnologies.CAREERS_URL, careersHtml],
    [enduranceTechnologies.JOB_PORTAL_URL, jobPortalHtml],
    ['https://www.endurancegroup.com/career/technical-architect/', technicalArchitectDetailHtml],
    ['https://www.endurancegroup.com/career/technical-lead-hardware/', technicalLeadHardwareDetailHtml],
  ])

  const jobs = await enduranceTechnologies.createEnduranceTechnologiesScraper({
    now: () => FIXED_SCRAPED_AT,
    maxJobs: 2,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      const html = htmlByUrl.get(url)
      if (!html) {
        throw new Error(`Unexpected Endurance Technologies URL: ${url}`)
      }
      return html
    },
  })

  assert.deepEqual(requestedUrls, [
    enduranceTechnologies.CAREERS_URL,
    enduranceTechnologies.JOB_PORTAL_URL,
    'https://www.endurancegroup.com/career/technical-architect/',
    'https://www.endurancegroup.com/career/technical-lead-hardware/',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => job.title),
    ['Technical Architect', 'Technical Lead â€“ Hardware'],
  )

  assert.deepEqual(jobs[0], {
    title: 'Technical Architect',
    company: 'Endurance Technologies',
    designation: 'Assistant Manager',
    department: null,
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    state: 'Maharashtra',
    country: 'India',
    jobId: 'endurancetechnologies-technical-architect',
    requisitionId: 'endurancetechnologies-technical-architect',
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
    jobDescription: [
      'Job Responsibilities',
      '- He/She will work as the Technical Leader for our Ongoing Embedded Projects.',
      '- Candidate will be responsible for defining and governing overall system architecture for ECUs which Includes HW and SW.',
      '- Additionally he/she will manage the team leaders from SW, HW and V&V divisions.',
      '',
      'Job Qualifications',
      '- B.E/B.Tech (Electronics/Electrical/Computer Science)',
      '- CDAC certification (VLSI or similar) will be considered as an added advantage',
    ].join('\n'),
    companyCareerPage: 'https://www.endurancegroup.com/careers/',
    companyDomain: 'endurancegroup.com',
    atsPlatform: 'official-company-careers',
    source: 'endurancetechnologies',
    link: 'https://www.endurancegroup.com/career/technical-architect/',
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.equal(jobs[1].company, 'Endurance Technologies')
  assert.equal(jobs[1].designation, 'Assistant Manager')
  assert.equal(jobs[1].experienceRequired, '7 Years')
  assert.equal(jobs[1].location, 'Pune, Maharashtra, India')
  assert.equal(jobs[1].source, 'endurancetechnologies')
  assert.equal(jobs[1].scrapedAt, FIXED_SCRAPED_AT)
  assert.match(jobs[1].jobDescription, /Hardware Lead/i)
  assert.match(jobs[1].jobDescription, /CDAC certification/i)
})

test('Endurance Technologies fails closed when the careers landing page, job portal, or detail contract drifts', async () => {
  const enduranceTechnologies = await loadModule()

  await assert.rejects(
    enduranceTechnologies.createEnduranceTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /careers page no longer matches/i,
  )

  await assert.rejects(
    enduranceTechnologies.createEnduranceTechnologiesScraper().run({
      fetchText: async (url) => (
        url === enduranceTechnologies.CAREERS_URL
          ? careersHtml
          : '<html><body><h2>Current Opening</h2><p>Drop your CV here</p></body></html>'
      ),
    }),
    /job portal no longer matches/i,
  )

  await assert.rejects(
    enduranceTechnologies.createEnduranceTechnologiesScraper({
      maxJobs: 1,
    }).run({
      fetchText: async (url) => {
        if (url === enduranceTechnologies.CAREERS_URL) return careersHtml
        if (url === enduranceTechnologies.JOB_PORTAL_URL) return jobPortalHtml
        return technicalArchitectDetailHtml.replace('Job Qualifications', 'Qualifications')
      },
    }),
    /job detail no longer matches/i,
  )
})

test('Endurance Technologies returns [] when the verified careers page is challenge-gated by Cloudflare', async () => {
  const enduranceTechnologies = await loadModule()

  assert.equal(
    enduranceTechnologies.hasVerifiedCloudflareChallengeSignal(blockedChallengePage),
    true,
  )

  const requestedUrls = []
  const jobs = await enduranceTechnologies.createEnduranceTechnologiesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === enduranceTechnologies.CAREERS_URL) {
        return blockedChallengePage
      }

      throw new Error(`Unexpected Endurance Technologies URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [enduranceTechnologies.CAREERS_URL])
  assert.deepEqual(jobs, [])
})
