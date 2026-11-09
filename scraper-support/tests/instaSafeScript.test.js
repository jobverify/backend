import assert from 'node:assert/strict'
import test from 'node:test'

const legacyVerifiedCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Instasafe Careers | Instasafe Jobs</title>
    <link rel="canonical" href="https://instasafe.com/careers/" />
    <meta
      name="description"
      content="Discover InstaSafe: a cybersecurity leader offering innovative solutions for secure access to enterprise applications. Explore our offerings and join our team!"
    />
  </head>
  <body>
    <main id="main">
      <h1>Grow with InstaSafe.</h1>
      <p>Working at InstaSafe is more than just a Job.</p>
      <a href="/book-a-demo">Book a demo</a>
      <a href="https://docs.instasafe.com/">Read the docs</a>
      <a href="https://support.instasafe.com/portal/en/home">Contact support</a>
      <a href="https://instasafe.zohorecruit.com/jobs/Careers">Browse current openings</a>
    </main>
  </body>
</html>
`

const verifiedCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Instasafe Careers | Instasafe Jobs</title>
    <link rel="canonical" href="https://instasafe.com/careers/" />
  </head>
  <body>
    <header>
      <h1>Careers</h1>
      <a href="#openings">See open roles</a>
      <a href="/book-a-demo">Book a demo</a>
    </header>
    <main id="openings">
      <h2>Our Openings</h2>
      <p>Loading open roles.</p>
      <a href="https://instasafe.zohorecruit.com/jobs/Careers">View all openings on Zoho Recruit</a>
    </main>
    <footer>
      <a href="https://docs.instasafe.com/">Read the docs</a>
      <a href="https://support.instasafe.com/portal/en/home">Contact support</a>
    </footer>
  </body>
</html>
`

const verifiedCareersPageWithUnexpectedJobsHandoffHtml = `
${verifiedCareersPageHtml.replace(
  'https://instasafe.zohorecruit.com/jobs/Careers',
  'https://instasafe.zohorecruit.com/jobs/OtherPortal',
)}
`

const verifiedPortalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Instasafe Technologies Pvt Ltd</title>
    <meta property="og:url" content="https://instasafe.zohorecruit.com/jobs/Careers">
  </head>
  <body>
    <input type="hidden" id="pageJson" value="{}">
    <input type="hidden" id="moduleMeta" value="[]">
    <input type="hidden" id="jobs" value="[]">
  </body>
</html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      id: '435765000017272887',
      Posting_Title: 'Graduate Engineer Trainee',
      City: 'Bangalore North',
      State: 'Karnataka',
      Country: 'India',
      Job_Type: 'Full time',
      Work_Experience: 'Fresher',
      Required_Skills: 'Java, Linux',
      Date_Opened: '10/30/2025',
      Remote_Job: false,
      Job_Description: 'Build and optimize secure systems.',
      $url: 'https://instasafe.zohorecruit.com/jobs/Careers/435765000017272887/Graduate-Engineer-Trainee?source=CareerSite',
    },
    {
      id: '435765000018685001',
      Posting_Title: 'Junior QA Analyst (Security, Automation & AI-Driven Testing)',
      City: 'Bhubaneswar',
      State: 'Odisha',
      Country: 'India',
      Job_Type: 'Full time',
      Work_Experience: null,
      Required_Skills: 'QA, Automation',
      Date_Opened: '02/22/2026',
      Remote_Job: false,
      Job_Description: 'Test secure access workflows.',
      $url: 'https://instasafe.zohorecruit.com/jobs/Careers/435765000018685001/Junior-QA-Analyst-Security-Automation-AI-Driven-Testing?source=CareerSite',
    },
    {
      id: '435765000018430001',
      Posting_Title: 'Sales Development Representative (SDR)',
      City: '',
      State: '',
      Country: '',
      Job_Type: 'Full time',
      Work_Experience: '4-5 years',
      Required_Skills: 'Prospecting, CRM',
      Date_Opened: '01/20/2026',
      Remote_Job: 'Yes',
      Job_Description: 'Drive outbound pipeline.',
      $url: 'https://instasafe.zohorecruit.com/jobs/Careers/435765000018430001/Sales-Development-Representative-SDR?source=CareerSite',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/instasafe/script.js')
  } catch {
    assert.fail('Expected InstaSafe scraper module at ../../scraper/instasafe/script.js')
  }
}

test('InstaSafe constants stay pinned to the verified first-party careers page and Zoho Recruit portal', async () => {
  const instasafe = await loadModule()

  assert.equal(instasafe.SOURCE, 'instasafe')
  assert.equal(instasafe.COMPANY, 'InstaSafe')
  assert.equal(instasafe.OFFICIAL_BRAND_NAME, 'InstaSafe')
  assert.equal(instasafe.VERIFIED_ON, '2026-09-03')
  assert.equal(instasafe.HOMEPAGE_URL, 'https://instasafe.com/')
  assert.equal(instasafe.CAREERS_PAGE_URL, 'https://instasafe.com/careers/')
  assert.equal(instasafe.CAREERS_PORTAL_URL, 'https://instasafe.zohorecruit.com/jobs/Careers')
  assert.equal(
    instasafe.CAREERS_API_URL,
    'https://instasafe.zohorecruit.com/recruit/v2/public/Job_Openings?source=CareerSite&pagename=Careers&extra_fields=%5B%22Date_Opened%22,%22Job_Description%22,%22Work_Experience%22,%22Job_Type%22,%22Required_Skills%22%5D',
  )
  assert.match(instasafe.VERIFIED_SURFACE_SUMMARY, /September 3, 2026/i)
  assert.match(instasafe.VERIFIED_SURFACE_SUMMARY, /instasafe\.zohorecruit\.com\/jobs\/Careers/i)
  assert.match(instasafe.VERIFIED_SURFACE_SUMMARY, /14 public postings/i)
  assert.match(instasafe.VERIFIED_SURFACE_SUMMARY, /12 India jobs/i)
  assert.equal(instasafe.hasOfficialCareersPageSignal(legacyVerifiedCareersPageHtml), true)
  assert.equal(instasafe.hasOfficialCareersPageSignal(verifiedCareersPageHtml), true)
  assert.equal(instasafe.hasOfficialPortalSignal(verifiedPortalHtml), true)
  assert.equal(
    instasafe.detectPublicJobsSurface(verifiedCareersPageHtml),
    'https://instasafe.zohorecruit.com/jobs/Careers',
  )
})

test('extractIndiaJobs maps official InstaSafe India openings and excludes remote records without an India location contract', async () => {
  const instasafe = await loadModule()

  assert.deepEqual(instasafe.extractIndiaJobs(apiPayload), [
    {
      title: 'Graduate Engineer Trainee',
      company: 'InstaSafe',
      department: null,
      location: 'Bangalore North, Karnataka, India',
      city: 'Bangalore North',
      state: 'Karnataka',
      country: 'India',
      jobId: '435765000017272887',
      requisitionId: '435765000017272887',
      sourceUrl: 'https://instasafe.zohorecruit.com/jobs/Careers/435765000017272887/Graduate-Engineer-Trainee?source=CareerSite',
      applyUrl: 'https://instasafe.zohorecruit.com/jobs/Careers/435765000017272887/Graduate-Engineer-Trainee?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: 'Fresher',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Java', 'Linux'],
      postingDate: '10/30/2025',
      closingDate: null,
      jobDescription: 'Build and optimize secure systems.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Junior QA Analyst (Security, Automation & AI-Driven Testing)',
      company: 'InstaSafe',
      department: null,
      location: 'Bhubaneswar, Odisha, India',
      city: 'Bhubaneswar',
      state: 'Odisha',
      country: 'India',
      jobId: '435765000018685001',
      requisitionId: '435765000018685001',
      sourceUrl: 'https://instasafe.zohorecruit.com/jobs/Careers/435765000018685001/Junior-QA-Analyst-Security-Automation-AI-Driven-Testing?source=CareerSite',
      applyUrl: 'https://instasafe.zohorecruit.com/jobs/Careers/435765000018685001/Junior-QA-Analyst-Security-Automation-AI-Driven-Testing?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['QA', 'Automation'],
      postingDate: '02/22/2026',
      closingDate: null,
      jobDescription: 'Test secure access workflows.',
      remoteStatus: 'On-site',
    },
  ])
})

test('run validates the official InstaSafe careers page, portal, and public jobs API before decorating India jobs', async () => {
  const instasafe = await loadModule()
  const requestedUrls = []

  const jobs = await instasafe.createInstaSafeScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === instasafe.CAREERS_PAGE_URL) return verifiedCareersPageHtml
      if (url === instasafe.CAREERS_PORTAL_URL) return verifiedPortalHtml
      assert.fail(`Unexpected InstaSafe HTML request: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === instasafe.CAREERS_API_URL) return apiPayload
      assert.fail(`Unexpected InstaSafe JSON request: ${url}`)
    },
    now: () => '2026-09-03T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    instasafe.CAREERS_PAGE_URL,
    instasafe.CAREERS_PORTAL_URL,
    instasafe.CAREERS_API_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'instasafe')
  assert.equal(jobs[0].companyDomain, 'instasafe.com')
  assert.equal(jobs[0].atsPlatform, 'zohorecruit')
  assert.equal(jobs[0].companyCareerPage, 'https://instasafe.com/careers/')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-09-03T12:00:00.000Z')
})

test('run preserves an honest empty result when the verified InstaSafe careers page is temporarily timeout-blocked', async () => {
  const instasafe = await loadModule()
  const requestedUrls = []

  const jobs = await instasafe.createInstaSafeScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      throw new Error('fetch failed | Connect Timeout Error (attempted address: instasafe.com:443, timeout: 10000ms)')
    },
  })

  assert.deepEqual(requestedUrls, [instasafe.CAREERS_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the verified first-party InstaSafe careers page markers drift', async () => {
  const instasafe = await loadModule()

  await assert.rejects(
    instasafe.createInstaSafeScraper().run({
      fetchText: async (url) => {
        if (url === instasafe.CAREERS_PAGE_URL) {
          return '<html><body>Broken careers page</body></html>'
        }

        return verifiedPortalHtml
      },
      fetchJson: async () => apiPayload,
    }),
    /official InstaSafe careers page/i,
  )
})

test('run fails closed when the first-party page no longer hands off to the verified InstaSafe Zoho Recruit portal', async () => {
  const instasafe = await loadModule()

  await assert.rejects(
    instasafe.createInstaSafeScraper().run({
      fetchText: async (url) => {
        if (url === instasafe.CAREERS_PAGE_URL) return verifiedCareersPageWithUnexpectedJobsHandoffHtml
        return verifiedPortalHtml
      },
      fetchJson: async () => apiPayload,
    }),
    /public jobs surface changed materially/i,
  )
})

test('run fails closed when the official InstaSafe Zoho Recruit portal signal disappears', async () => {
  const instasafe = await loadModule()

  await assert.rejects(
    instasafe.createInstaSafeScraper().run({
      fetchText: async (url) => {
        if (url === instasafe.CAREERS_PAGE_URL) return verifiedCareersPageHtml
        if (url === instasafe.CAREERS_PORTAL_URL) return '<html><body>Unexpected board</body></html>'
        assert.fail(`Unexpected InstaSafe HTML request: ${url}`)
      },
      fetchJson: async () => apiPayload,
    }),
    /official InstaSafe careers portal/i,
  )
})

test('run fails closed when the official InstaSafe jobs API payload drifts', async () => {
  const instasafe = await loadModule()

  await assert.rejects(
    instasafe.createInstaSafeScraper().run({
      fetchText: async (url) => {
        if (url === instasafe.CAREERS_PAGE_URL) return verifiedCareersPageHtml
        if (url === instasafe.CAREERS_PORTAL_URL) return verifiedPortalHtml
        assert.fail(`Unexpected InstaSafe HTML request: ${url}`)
      },
      fetchJson: async () => ({ code: 'success', data: null }),
    }),
    /public jobs API/i,
  )
})
