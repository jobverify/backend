import assert from 'node:assert/strict'
import test from 'node:test'

const izmoCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers at izmocars | Join Our Global Team | izmocars</title>
  </head>
  <body>
    <h1>Build the Future of Automotive Tech.</h1>
    <h2>Current Openings.</h2>
    <p>Find your dream job. Filter by department, location, or job type.</p>
    <article>
      <h3>Associate Graphic Designer (UK Process)</h3>
      <p>Creative / Design</p>
      <p>Bangalore, India (BTM 2nd Stage)</p>
      <p>Full Time (On-Site)</p>
      <a href="/careers/associate-graphic-designer-uk-process">View Details</a>
    </article>
    <p>Showing 1 position</p>
  </body>
</html>
`

const currentIzmoCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers at izmocars | Join Our Global Team | izmocars</title>
  </head>
  <body>
    <div class="hero">
      <span>Join Our Global Team</span>
      <h1>Build the Future of <br><span>Automotive Tech</span>.</h1>
      <a href="#openings"><button>View Openings</button></a>
    </div>
    <section id="openings">
      <h2>Current Openings.</h2>
      <div class="grid md:grid-cols-3 gap-6">
        <div class="group bg-white rounded-xl p-6">
          <div class="flex flex-col h-full">
            <div class="flex-1">
              <div class="flex items-start justify-between mb-4">
                <div class="flex-1">
                  <h3>Associate Graphic Designer (UK Process)</h3>
                  <div class="inline-flex items-center gap-2">
                    <span class="font-medium">Creative / Design</span>
                  </div>
                </div>
              </div>
              <div class="space-y-2 mb-4">
                <div class="flex items-center gap-2">
                  <span class="text-sm">Bangalore, India (BTM 2nd Stage)</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-sm">Full Time (On-Site)</span>
                </div>
              </div>
              <p class="line-clamp-3">We are seeking a highly creative and detail-oriented Graphic Designer.</p>
            </div>
            <div class="mt-6 pt-6 border-t">
              <a href="/careers/graphic-designer-uk-process"><button>View Openings</button></a>
            </div>
          </div>
        </div>
      </div>
    </section>
  </body>
</html>
`

const cadsysCareersHtml = `
<!doctype html>
<html>
  <body>
    <h1>Careers</h1>
    <p>We’re looking for exceptional people to help us build the next generation work platform.</p>
    <ul>
      <li><a href="/careers/senior-data-scientist">Senior Data Scientist <span>Remote / Hybrid</span></a></li>
      <li><a href="/careers/software-engineer-backend">Software Engineer, Backend <span>Remote / Hybrid</span></a></li>
      <li><a href="/careers/software-engineer-frontend">Software Engineer, Frontend <span>Remote / Hybrid</span></a></li>
    </ul>
    <footer>Cadensys Ltd © 2025</footer>
  </body>
</html>
`

const cadsysOffBrandRedirectHtml = `
<!doctype html>
<html>
  <head>
    <title>Orb | Manage what matters</title>
  </head>
  <body>
    <h1>The most intentional version of you.</h1>
    <p>Orb drafted a reply.</p>
  </body>
</html>
`

const navisiteCareersHtml = `
<!doctype html>
<html>
  <body>
    <h1>Discover Opportunities at Navisite, Part of Accenture</h1>
    <a href="https://www.accenture.com/us-en/careers">Explore Careers at Navisite, Part of Accenture</a>
    <p>Navisite is now a part of Accenture! All open positions at Navisite can be found on the Accenture Careers page.</p>
    <p>Once there, simply search “Navisite” to view all open roles listed under Navisite, Part of Accenture.</p>
  </body>
</html>
`

const navisiteChallengeHtml = `
<!doctype html>
<html>
  <head><title>Just a moment...</title></head>
  <body>
    <span id="challenge-error-text">Enable JavaScript and cookies to continue</span>
  </body>
</html>
`

const scopeBlockedHtml = `
<!doctype html>
<html>
  <head><title>403 Forbidden</title></head>
  <body>403 Forbidden</body>
</html>
`

const satvatCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>Life @ Satvat Infosol | Job Openings Satvat Infosol</title>
  </head>
  <body>
    <section class="job-list">
      <div class="brows-job-list">
        <h3>Technical Support Trainee</h3>
        <p class="tooltiptext">Passed out in 2020/2021 are eligible to apply for Technical Support Trainee.</p>
        <p><i class="flaticon-pin"></i> Chennai</p>
        <a href="apply_frm.php" class="btn btn-default">Apply Now</a>
      </div>
      <div class="brows-job-list">
        <h3>Software Programmer/Developer</h3>
        <p class="tooltiptext">Develop software solutions for enterprise clients.</p>
        <p><i class="flaticon-pin"></i> Chennai</p>
        <a href="apply_frm.php" class="btn btn-default">Apply Now</a>
      </div>
      <div class="brows-job-list">
        <h3>Software Programmer/Developer</h3>
        <p class="tooltiptext">Develop software solutions for enterprise clients.</p>
        <p><i class="flaticon-pin"></i> Chennai</p>
        <a href="apply_frm.php" class="btn btn-default">Apply Now</a>
      </div>
      <div class="brows-job-list">
        <h3>Business Development Manager</h3>
        <p class="tooltiptext">Experience in IT Products Sales/Business Development.</p>
        <p><i class="flaticon-pin"></i> Chennai</p>
        <a href="apply_frm.php" class="btn btn-default">Apply Now</a>
      </div>
      <div class="brows-job-list">
        <h3><a href="apply_frm.php">Flutter Developer</a></h3>
        <p><i class="flaticon-pin"></i>Chennai - India</p>
        <a href="apply_frm.php" class="btn btn-default">Apply Now</a>
      </div>
    </section>
  </body>
</html>
`

const loadScript = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

test('Izmo scraper extracts the verified first-party izmocars opening card', async () => {
  const izmo = await loadScript('../../scraper/izmo/script.js')

  assert.equal(izmo.hasOfficialCareersSignal(izmoCareersHtml), true)
  assert.deepEqual(izmo.extractJobs(izmoCareersHtml), [
    {
      title: 'Associate Graphic Designer (UK Process)',
      company: 'Izmo',
      department: 'Creative / Design',
      location: 'Bangalore, India (BTM 2nd Stage)',
      city: 'Bangalore',
      country: 'India',
      jobId: 'associate-graphic-designer-uk-process',
      requisitionId: 'associate-graphic-designer-uk-process',
      sourceUrl: 'https://www.goizmo.com/careers/associate-graphic-designer-uk-process',
      applyUrl: 'https://www.goizmo.com/careers/associate-graphic-designer-uk-process',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])

  const jobs = await izmo.createIzmoScraper({ maxJobs: 1 }).run({
    fetchText: async () => izmoCareersHtml,
    now: () => '2026-07-18T09:30:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'izmo')
  assert.equal(jobs[0].link, 'https://www.goizmo.com/careers/associate-graphic-designer-uk-process')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T09:30:00.000Z')
})

test('Izmo scraper accepts the current first-party careers card layout', async () => {
  const izmo = await loadScript('../../scraper/izmo/script.js')

  assert.equal(izmo.hasOfficialCareersSignal(currentIzmoCareersHtml), true)
  assert.deepEqual(izmo.extractJobs(currentIzmoCareersHtml), [
    {
      title: 'Associate Graphic Designer (UK Process)',
      company: 'Izmo',
      department: 'Creative / Design',
      location: 'Bangalore, India (BTM 2nd Stage)',
      city: 'Bangalore',
      country: 'India',
      jobId: 'associate-graphic-designer-uk-process',
      requisitionId: 'associate-graphic-designer-uk-process',
      sourceUrl: 'https://www.goizmo.com/careers/graphic-designer-uk-process',
      applyUrl: 'https://www.goizmo.com/careers/graphic-designer-uk-process',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('Cadsys scraper extracts the verified Cadensys role links', async () => {
  const cadsys = await loadScript('../../scraper/cadsys/script.js')

  assert.equal(cadsys.hasOfficialCareersSignal(cadsysCareersHtml), true)
  assert.deepEqual(cadsys.extractJobs(cadsysCareersHtml), [
    {
      title: 'Senior Data Scientist',
      company: 'Cadsys',
      department: null,
      location: 'Remote / Hybrid',
      city: null,
      country: null,
      jobId: 'senior-data-scientist',
      requisitionId: 'senior-data-scientist',
      sourceUrl: 'https://www.cadensys.ai/careers/senior-data-scientist',
      applyUrl: 'https://www.cadensys.ai/careers/senior-data-scientist',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Software Engineer, Backend',
      company: 'Cadsys',
      department: null,
      location: 'Remote / Hybrid',
      city: null,
      country: null,
      jobId: 'software-engineer-backend',
      requisitionId: 'software-engineer-backend',
      sourceUrl: 'https://www.cadensys.ai/careers/software-engineer-backend',
      applyUrl: 'https://www.cadensys.ai/careers/software-engineer-backend',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Software Engineer, Frontend',
      company: 'Cadsys',
      department: null,
      location: 'Remote / Hybrid',
      city: null,
      country: null,
      jobId: 'software-engineer-frontend',
      requisitionId: 'software-engineer-frontend',
      sourceUrl: 'https://www.cadensys.ai/careers/software-engineer-frontend',
      applyUrl: 'https://www.cadensys.ai/careers/software-engineer-frontend',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])

  const jobs = await cadsys.createCadsysScraper({ maxJobs: 2 }).run({
    fetchText: async () => cadsysCareersHtml,
    now: () => '2026-07-18T09:30:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'cadsys')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T09:30:00.000Z')
})

test('Cadsys scraper stays fail-closed when the careers route redirects off-domain to Orb', async () => {
  const cadsys = await loadScript('../../scraper/cadsys/script.js')

  const jobs = await cadsys.createCadsysScraper().run({
    fetchPage: async () => ({
      url: 'https://getorb.ai/careers/',
      html: cadsysOffBrandRedirectHtml,
    }),
  })

  assert.deepEqual(jobs, [])
})

test('NaviSite scraper stays fail-closed on the verified Accenture handoff page', async () => {
  const navisite = await loadScript('../../scraper/navisite/script.js')

  assert.equal(navisite.hasOfficialCareersSignal(navisiteCareersHtml), true)
  assert.equal(navisite.hasBlockedCareersSignal(navisiteChallengeHtml), true)

  const jobs = await navisite.createNaviSiteScraper().run({
    fetchText: async () => navisiteCareersHtml,
  })

  assert.deepEqual(jobs, [])

  const blockedJobs = await navisite.createNaviSiteScraper().run({
    fetchText: async () => navisiteChallengeHtml,
  })

  assert.deepEqual(blockedJobs, [])

  await assert.rejects(
    navisite.createNaviSiteScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /NaviSite verified careers surface changed materially/i,
  )
})

test('Scope eKnowledge Center scraper stays fail-closed while exact-name routes remain blocked', async () => {
  const scope = await loadScript('../../scraper/scopeeknowledgecenter/script.js')

  assert.equal(scope.isBlockedResponse({ status: 403, html: scopeBlockedHtml }), true)
  assert.equal(scope.isBlockedResponse({ status: 200, html: scopeBlockedHtml }), false)

  const jobs = await scope.createScopeEknowledgeCenterScraper().run({
    fetchPage: async (url) => ({
      status: 403,
      url,
      html: scopeBlockedHtml,
    }),
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    scope.createScopeEknowledgeCenterScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body><h1>Unexpected careers content</h1></body></html>',
      }),
    }),
    /Scope eKnowledge Center verified exact-name surface changed materially/i,
  )
})

test('Satvat Infosol scraper extracts and dedupes the verified first-party openings', async () => {
  const satvat = await loadScript('../../scraper/satvatinfosol/script.js')

  assert.equal(satvat.hasOfficialCareersSignal(satvatCareersHtml), true)
  assert.deepEqual(satvat.extractJobs(satvatCareersHtml), [
    {
      title: 'Technical Support Trainee',
      company: 'Satvat Infosol',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'technical-support-trainee',
      requisitionId: 'technical-support-trainee',
      sourceUrl: 'https://satvatinfosol.com/apply_frm.php',
      applyUrl: 'https://satvatinfosol.com/apply_frm.php',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Passed out in 2020/2021 are eligible to apply for Technical Support Trainee.',
      publicExperienceChecked: true,
    },
    {
      title: 'Software Programmer/Developer',
      company: 'Satvat Infosol',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'software-programmer-developer',
      requisitionId: 'software-programmer-developer',
      sourceUrl: 'https://satvatinfosol.com/apply_frm.php',
      applyUrl: 'https://satvatinfosol.com/apply_frm.php',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Develop software solutions for enterprise clients.',
      publicExperienceChecked: true,
    },
    {
      title: 'Business Development Manager',
      company: 'Satvat Infosol',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'business-development-manager',
      requisitionId: 'business-development-manager',
      sourceUrl: 'https://satvatinfosol.com/apply_frm.php',
      applyUrl: 'https://satvatinfosol.com/apply_frm.php',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Experience in IT Products Sales/Business Development.',
      publicExperienceChecked: true,
    },
    {
      title: 'Flutter Developer',
      company: 'Satvat Infosol',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'flutter-developer',
      requisitionId: 'flutter-developer',
      sourceUrl: 'https://satvatinfosol.com/apply_frm.php',
      applyUrl: 'https://satvatinfosol.com/apply_frm.php',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      publicExperienceChecked: true,
    },
  ])

  const jobs = await satvat.createSatvatInfosolScraper({ maxJobs: 3 }).run({
    fetchText: async () => satvatCareersHtml,
    now: () => '2026-07-18T09:30:00.000Z',
  })

  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'satvatinfosol')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T09:30:00.000Z')
})
