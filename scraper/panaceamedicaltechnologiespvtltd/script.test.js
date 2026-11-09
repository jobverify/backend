import assert from 'node:assert/strict'
import test from 'node:test'

const loadPanaceaModule = async () => {
  try {
    return await import('../panaceamedicaltechnologiespvtltd/script.js')
  } catch {
    assert.fail(
      'Expected Panacea Medical Technologies scraper module at ../panaceamedicaltechnologiespvtltd/script.js',
    )
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>Panacea</title>
    </head>
    <body>
      <nav>
        <a href="https://www.panaceamedical.in/join-us/">Join Us</a>
      </nav>
      <main>
        <h1>Since 1999... Defeating Cancer</h1>
        <p>
          Panacea Medical Technologies Pvt. Ltd. is a technology centric company which manufactures top
          notch medical equipment to meet the needs of today's radiotherapy and radiology centres.
        </p>
        <p>Copyright 2026 Panacea Medical Technologies Pvt. Ltd. All Rights Reserved.</p>
      </main>
    </body>
  </html>
`

const joinUsHtml = `
  <html>
    <head>
      <title>Join Us | Panacea Medical Technologies Careers</title>
    </head>
    <body>
      <h1>Engineering Medicine. Changing Lives.</h1>
      <p>Work on technologies that help clinicians fight cancer and improve patient outcomes across the world.</p>
      <a href="https://www.panaceamedical.in/careers/">Browse All Open Positions</a>
    </body>
  </html>
`

const currentJoinUsHtml = `
  <html>
    <head><title>Join Us &#8211; Panacea</title></head>
    <body>
      <h1>Engineering Medicine.</h1><p>Changing Lives.</p>
      <a href="https://www.panaceamedical.in/careers/">Browse All Open Positions</a>
      <p>Current Openings</p>
    </body>
  </html>
`

const jobsPageOneHtml = `
  <html>
    <head>
      <title>Jobs - Panacea Careers</title>
    </head>
    <body>
      <label>Job title or keywords</label>
      <p>2 open positions found</p>
      <p>Sort by: Newest</p>
      <article class="pmt-job-card" id="job-43" itemscope itemtype="https://schema.org/JobPosting">
        <div class="pmt-job-card__body">
          <a href="https://www.panaceamedical.in/careers/jobs/electrical-testing-engineer/" class="pmt-job-card__title">Electrical testing Engineer</a>
          <p class="pmt-job-card__company"><span itemprop="name">Panacea Medical Technologies</span></p>
          <div class="pmt-job-card__badges">
            <span class="pmt-badge pmt-badge--blue">Full Time</span>
            <span class="pmt-badge pmt-badge--grey">On-site</span>
          </div>
          <div class="pmt-job-card__meta">
            <span class="pmt-job-card__meta-item">Malur (Kolar District) 25 Km from Bangalore</span>
            <span class="pmt-job-card__meta-item">Engineering</span>
            <span class="pmt-job-card__meta-item">0 to 3 years</span>
          </div>
        </div>
        <div class="pmt-job-card__actions">
          <span class="pmt-job-card__days">1 week ago</span>
          <a href="https://www.panaceamedical.in/apply/?position=Electrical+testing+Engineer&#038;job_id=43" aria-label="Apply for Electrical testing Engineer">Apply</a>
        </div>
        <meta itemprop="datePosted" content="2026-07-30">
        <meta itemprop="validThrough" content="2026-09-28">
        <meta itemprop="employmentType" content="FULL_TIME">
      </article>
      <nav class="pmt-pagination">
        <a class="page-numbers" href="https://www.panaceamedical.in/careers/page/2/">2</a>
      </nav>
    </body>
  </html>
`

const jobsPageTwoHtml = `
  <html>
    <head>
      <title>Jobs - Panacea Careers</title>
    </head>
    <body>
      <label>Job title or keywords</label>
      <p>2 open positions found</p>
      <p>Sort by: Newest</p>
      <article class="pmt-job-card" id="job-44" itemscope itemtype="https://schema.org/JobPosting">
        <div class="pmt-job-card__body">
          <a class="pmt-job-card__title" href="https://www.panaceamedical.in/careers/jobs/area-sales-manager/">Area Sales Manager</a>
          <p class="pmt-job-card__company"><span itemprop="name">Panacea Medical Technologies</span></p>
          <div class="pmt-job-card__badges">
            <span class="pmt-badge pmt-badge--blue">Full Time</span>
            <span class="pmt-badge pmt-badge--grey">Hybrid</span>
          </div>
          <div class="pmt-job-card__meta">
            <span class="pmt-job-card__meta-item">All Over India</span>
            <span class="pmt-job-card__meta-item">Sales &amp; Marketing</span>
            <span class="pmt-job-card__meta-item">6 to 9 years</span>
          </div>
        </div>
        <div class="pmt-job-card__actions">
          <span class="pmt-job-card__days">1 week ago</span>
          <a href="https://www.panaceamedical.in/apply/?position=Area+Sales+Manager&#038;job_id=44" aria-label="Apply for Area Sales Manager">Apply</a>
        </div>
        <meta itemprop="datePosted" content="2026-07-30">
        <meta itemprop="validThrough" content="2026-09-28">
        <meta itemprop="employmentType" content="FULL_TIME">
      </article>
    </body>
  </html>
`

const electricalTestingDetailHtml = `
  <html>
    <head>
      <title>Electrical testing Engineer - Panacea Careers</title>
    </head>
    <body>
      <h1>Electrical testing Engineer</h1>
      <h2>About the Role</h2>
      <p>Responsible for PCB assembly, quality verification, and final testing of UPS systems.</p>
      <h2>Key Responsibilities</h2>
      <ul>
        <li>PCB assembly and component verification.</li>
        <li>Quality verification and incoming inspection of components.</li>
      </ul>
      <h2>Qualifications &amp; Requirements</h2>
      <ul>
        <li>BE / B Tech / M Tech in Electrical &amp; Electronics Engineering / Electrical Engineering.</li>
        <li>0 to 3 years of hands-on experience in electrical testing.</li>
      </ul>
      <h2>Benefits &amp; Perks</h2>
      <p>Competitive compensation and health insurance.</p>
      <h3>Job Overview</h3>
      <p>Job Code / Ref</p>
      <p>PMT_2026-27-001</p>
      <p>Open Positions</p>
      <p>5</p>
      <p>Posted</p>
      <p>1 week ago</p>
      <p>Deadline</p>
      <p>Open until filled</p>
      <p>Employment Type</p>
      <p>Full Time</p>
      <p>Department</p>
      <p>Engineering</p>
      <p>Location</p>
      <p>Malur (Kolar District) 25 Km from Bangalore</p>
      <p>Experience</p>
      <p>0 to 3 years</p>
      <p>Education</p>
      <p>BE / B Tech / M Tech in Electrical &amp; Electronics Engineering / Electrical Engineering</p>
      <p>Work Mode</p>
      <p>On-site</p>
      <p>Need Help?</p>
    </body>
  </html>
`

const areaSalesManagerDetailHtml = `
  <html>
    <head>
      <title>Area Sales Manager - Panacea Careers</title>
    </head>
    <body>
      <h1>Area Sales Manager</h1>
      <h2>About the Role</h2>
      <p>Drive regional growth and account expansion across India.</p>
      <h2>Key Responsibilities</h2>
      <ul>
        <li>Develop channel sales plans.</li>
        <li>Manage customer relationships.</li>
      </ul>
      <h2>Qualifications &amp; Requirements</h2>
      <ul>
        <li>MBA or equivalent business qualification.</li>
        <li>6 to 9 years of B2B medical device sales experience.</li>
      </ul>
      <h2>Job Overview</h2>
      <p>Job Code / Ref</p>
      <p>PMT_2026-27-002</p>
      <p>Posted</p>
      <p>1 week ago</p>
      <p>Employment Type</p>
      <p>Full Time</p>
      <p>Department</p>
      <p>Sales &amp; Marketing</p>
      <p>Location</p>
      <p>All Over India</p>
      <p>Experience</p>
      <p>6 to 9 years</p>
      <p>Education</p>
      <p>MBA or equivalent business qualification</p>
      <p>Work Mode</p>
      <p>Hybrid</p>
      <p>Need Help?</p>
    </body>
  </html>
`

const mismatchedListingHtml = `
  <html>
    <head>
      <title>Jobs - Panacea Careers</title>
    </head>
    <body>
      <p>1 open positions found</p>
      <p>Sort by: Newest</p>
      <article class="pmt-job-card" id="job-32" itemscope itemtype="https://schema.org/JobPosting">
        <div class="pmt-job-card__body">
          <a href="https://www.panaceamedical.in/careers/jobs/regulatory-affairs-associate/" class="pmt-job-card__title">PCB Layout Engineer</a>
          <div class="pmt-job-card__badges">
            <span class="pmt-badge pmt-badge--blue">Full Time</span>
            <span class="pmt-badge pmt-badge--grey">On-site</span>
          </div>
          <div class="pmt-job-card__meta">
            <span class="pmt-job-card__meta-item">Bengaluru</span>
            <span class="pmt-job-card__meta-item">Regulatory Affairs</span>
            <span class="pmt-job-card__meta-item">1-3 Years</span>
          </div>
        </div>
        <div class="pmt-job-card__actions">
          <span class="pmt-job-card__days">3 weeks ago</span>
          <a href="https://www.panaceamedical.in/apply/?position=PCB+Layout+Engineer&#038;job_id=32" aria-label="Apply for PCB Layout Engineer">Apply</a>
        </div>
        <meta itemprop="datePosted" content="2026-07-20">
        <meta itemprop="validThrough" content="2026-09-18">
        <meta itemprop="employmentType" content="FULL_TIME">
      </article>
    </body>
  </html>
`

const mismatchedDetailHtml = `
  <html>
    <head>
      <title>Regulatory Affairs Associate - Panacea Careers</title>
    </head>
    <body>
      <h2>Job Overview</h2>
      <p>Job Code / Ref</p>
      <p>PMT_2026-27-099</p>
      <p>Need Help?</p>
    </body>
  </html>
`

test('Panacea scraper validates the verified homepage, Join Us handoff, and paginated careers board', async () => {
  const panacea = await loadPanaceaModule()

  assert.equal(panacea.SOURCE, 'panaceamedicaltechnologiespvtltd')
  assert.equal(panacea.COMPANY, 'Panacea Medical Technologies Pvt. Ltd.')
  assert.equal(panacea.VERIFIED_ON, '2026-08-07')
  assert.equal(panacea.HOMEPAGE_URL, 'https://www.panaceamedical.in/')
  assert.equal(panacea.JOIN_US_URL, 'https://www.panaceamedical.in/join-us/')
  assert.equal(panacea.CAREERS_URL, 'https://www.panaceamedical.in/careers/')
  assert.equal(panacea.APPLY_BASE_URL, 'https://www.panaceamedical.in/apply/')
  assert.equal(panacea.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(panacea.hasOfficialJoinUsSignal(joinUsHtml), true)
  assert.equal(panacea.hasOfficialJoinUsSignal(currentJoinUsHtml), true)
  assert.equal(panacea.hasOfficialJobsBoardSignal(jobsPageOneHtml), true)
  assert.deepEqual(
    panacea.extractJobsListPageUrls(jobsPageOneHtml),
    [
      'https://www.panaceamedical.in/careers/',
      'https://www.panaceamedical.in/careers/page/2/',
    ],
  )
})

test('Panacea scraper extracts paginated job summaries and detail enrichment from the new careers portal', async () => {
  const panacea = await loadPanaceaModule()
  const summaries = panacea.extractJobSummaries(jobsPageOneHtml)
  const detail = panacea.extractJobDetail(electricalTestingDetailHtml)

  assert.equal(summaries.length, 1)
  assert.deepEqual(summaries[0], {
    listingJobId: '43',
    title: 'Electrical testing Engineer',
    detailUrl: 'https://www.panaceamedical.in/careers/jobs/electrical-testing-engineer/',
    applyUrl: 'https://www.panaceamedical.in/apply/?position=Electrical+testing+Engineer&job_id=43',
    employmentType: 'Full Time',
    workMode: 'On-site',
    location: 'Malur (Kolar District) 25 Km from Bangalore',
    department: 'Engineering',
    experienceRequired: '0 to 3 years',
    postingRelative: '1 week ago',
    postingDate: '2026-07-30',
    closingDate: '2026-09-28',
  })

  assert.deepEqual(detail, {
    detailTitle: 'Electrical testing Engineer',
    jobId: 'PMT_2026-27-001',
    openPositions: '5',
    postingRelative: '1 week ago',
    closingStatus: 'Open until filled',
    employmentType: 'Full Time',
    department: 'Engineering',
    location: 'Malur (Kolar District) 25 Km from Bangalore',
    experienceRequired: '0 to 3 years',
    minimumQualification: 'BE / B Tech / M Tech in Electrical & Electronics Engineering / Electrical Engineering',
    workMode: 'On-site',
    requiredSkills: [
      'BE / B Tech / M Tech in Electrical & Electronics Engineering / Electrical Engineering.',
      '0 to 3 years of hands-on experience in electrical testing.',
    ],
    jobDescription: 'Responsible for PCB assembly, quality verification, and final testing of UPS systems. PCB assembly and component verification. Quality verification and incoming inspection of components. BE / B Tech / M Tech in Electrical & Electronics Engineering / Electrical Engineering. 0 to 3 years of hands-on experience in electrical testing.',
  })
})

test('run fetches homepage, Join Us, paginated listings, and detail pages to build live Panacea jobs', async () => {
  const panacea = await loadPanaceaModule()
  const requestedUrls = []

  const jobs = await panacea.createPanaceaMedicalTechnologiesScraper({
    now: () => '2026-08-07T12:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === panacea.HOMEPAGE_URL) return homepageHtml
      if (url === panacea.JOIN_US_URL) return joinUsHtml
      if (url === panacea.CAREERS_URL) return jobsPageOneHtml
      if (url === 'https://www.panaceamedical.in/careers/page/2/') return jobsPageTwoHtml
      if (url === 'https://www.panaceamedical.in/careers/jobs/electrical-testing-engineer/') return electricalTestingDetailHtml
      if (url === 'https://www.panaceamedical.in/careers/jobs/area-sales-manager/') return areaSalesManagerDetailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    panacea.HOMEPAGE_URL,
    panacea.JOIN_US_URL,
    panacea.CAREERS_URL,
    'https://www.panaceamedical.in/careers/page/2/',
    'https://www.panaceamedical.in/careers/jobs/electrical-testing-engineer/',
    'https://www.panaceamedical.in/careers/jobs/area-sales-manager/',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Electrical testing Engineer',
    company: 'Panacea Medical Technologies Pvt. Ltd.',
    department: 'Engineering',
    location: 'Malur (Kolar District) 25 Km from Bangalore',
    locations: ['Malur (Kolar District) 25 Km from Bangalore'],
    city: 'Malur',
    state: 'Karnataka',
    country: 'India',
    jobId: '43',
    requisitionId: 'PMT_2026-27-001',
    sourceUrl: 'https://www.panaceamedical.in/careers/jobs/electrical-testing-engineer/',
    applyUrl: 'https://www.panaceamedical.in/apply/?position=Electrical+testing+Engineer&job_id=43',
    employmentType: 'Full Time',
    experienceRequired: '0 to 3 years',
    minimumQualification: 'BE / B Tech / M Tech in Electrical & Electronics Engineering / Electrical Engineering',
    preferredQualification: null,
    requiredSkills: [
      'BE / B Tech / M Tech in Electrical & Electronics Engineering / Electrical Engineering.',
      '0 to 3 years of hands-on experience in electrical testing.',
    ],
    postingDate: '2026-07-30',
    closingDate: '2026-09-28',
    jobDescription: 'Responsible for PCB assembly, quality verification, and final testing of UPS systems. PCB assembly and component verification. Quality verification and incoming inspection of components. BE / B Tech / M Tech in Electrical & Electronics Engineering / Electrical Engineering. 0 to 3 years of hands-on experience in electrical testing.',
    source: 'panaceamedicaltechnologiespvtltd',
    link: 'https://www.panaceamedical.in/apply/?position=Electrical+testing+Engineer&job_id=43',
    scrapedAt: '2026-08-07T12:00:00.000Z',
    companyCareerPage: 'https://www.panaceamedical.in/careers/',
    companyDomain: 'panaceamedical.in',
    atsPlatform: 'official-first-party-careers-portal',
  })
  assert.equal(jobs[1].jobId, '44')
  assert.equal(jobs[1].department, 'Sales & Marketing')
  assert.equal(jobs[1].city, null)
  assert.equal(jobs[1].employmentType, 'Full Time')
  assert.equal(jobs[1].atsPlatform, 'official-first-party-careers-portal')

  await assert.rejects(
    panacea.createPanaceaMedicalTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === panacea.HOMEPAGE_URL) {
          return '<html><body><h1>Unexpected homepage</h1></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    panacea.createPanaceaMedicalTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === panacea.HOMEPAGE_URL) return homepageHtml
        if (url === panacea.JOIN_US_URL) return joinUsHtml
        if (url === panacea.CAREERS_URL) {
          return '<html><body><h1>No structured careers board here anymore.</h1></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers board/i,
  )
})

test('Panacea rejects mismatched details instead of returning a complete corrupted listing', async () => {
  const panacea = await loadPanaceaModule()
  await assert.rejects(panacea.run({fetchText: async url => {
    if (url === panacea.HOMEPAGE_URL) return homepageHtml
    if (url === panacea.JOIN_US_URL) return joinUsHtml
    if (url === panacea.CAREERS_URL) return mismatchedListingHtml
    return mismatchedDetailHtml
  }}), /detail|mismatch/i)
})

test('Panacea rejects an incomplete counted snapshot before visiting details', async () => {
  const panacea = await loadPanaceaModule()
  await assert.rejects(panacea.run({fetchText: async url => {
    if (url === panacea.HOMEPAGE_URL) return homepageHtml
    if (url === panacea.JOIN_US_URL) return joinUsHtml
    if (url === panacea.CAREERS_URL) return jobsPageOneHtml.replace('2 open positions found','3 open positions found')
    if (url.includes('/page/2/')) return jobsPageTwoHtml.replace('2 open positions found','3 open positions found')
    return electricalTestingDetailHtml
  }}), /incomplete|count/i)
})

test('Panacea retains separate listing IDs when published reference codes collide', async () => {
  const panacea = await loadPanaceaModule()
  const jobs = await panacea.run({fetchText:async url=>{
    if(url===panacea.HOMEPAGE_URL)return homepageHtml
    if(url===panacea.JOIN_US_URL)return joinUsHtml
    if(url===panacea.CAREERS_URL)return jobsPageOneHtml
    if(url.includes('/page/2/'))return jobsPageTwoHtml
    if(url.includes('electrical-testing'))return electricalTestingDetailHtml
    return areaSalesManagerDetailHtml.replace('PMT_2026-27-002','PMT_2026-27-001')
  }})
  assert.deepEqual(jobs.map(job=>job.jobId),['43','44'])
  assert.deepEqual(jobs.map(job=>job.requisitionId),['PMT_2026-27-001','PMT_2026-27-001'])
})

const runPanaceaLocation = async location => {
  const panacea = await loadPanaceaModule()
  return panacea.run({fetchText:async url=>{
    if(url===panacea.HOMEPAGE_URL)return homepageHtml
    if(url===panacea.JOIN_US_URL)return currentJoinUsHtml
    if(url===panacea.CAREERS_URL)return jobsPageOneHtml
    if(url.includes('/page/2/'))return jobsPageTwoHtml
    if(url.includes('electrical-testing'))return electricalTestingDetailHtml.replaceAll('Malur (Kolar District) 25 Km from Bangalore',location)
    return areaSalesManagerDetailHtml
  }})
}

test('Panacea rejects entire snapshots with mixed foreign or unknown location labels',async()=>{
  for(const location of ['Pune, Canada','Bangalore US','Bangalore, United States','Malur / Canada','India, Canada','London, India','Remote','Remote, India','Hyderabad / Jaipur / Toronto']){
    await assert.rejects(runPanaceaLocation(location),/unverified India job location scope/i,location)
  }
})

test('Panacea accepts the observed complete India location labels and explicit country suffix',async()=>{
  for(const location of ['Malur','Whitefield, Bangalore','Bangalore','Malur/ Bangalore','Malur (Kolar District) 25 Km from Bangalore','Hyderabad / Jaipur','Whitefield - Bangalore / Malur (Kolar District) 25 Km from Bangalore','Punjab, Himachal Pradesh, Jammu & Kashmir','Bengaluru','All Over India','Bangalore, India','India']){
    const jobs=await runPanaceaLocation(location)
    assert.equal(jobs[0].country,'India',location)
    assert.equal(jobs.length,2,location)
  }
})
