import assert from 'node:assert/strict'
import test from 'node:test'

const techvedCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>Techved Careers | Shape Your Future In Digital Transformation Company</title>
  </head>
  <body>
    <div class="career-category-main">
      <a class="job-cat-list-item" data-job-cat="all-jobs">All Jobs</a>
    </div>
    <div class="career-opening-box" data-opening="Experienced" data-job-category="Marketing">
      <div class="career-opening-head"><h3>Sr Marketing Associate</h3></div>
      <div class="career-opening-info">
        <p>Marketing role for demand generation.</p>
        <ul>
          <li><span><img src="/me/resources/images/career-location.png" /></span> Goregaon(E),Mumbai.</li>
          <li><span><img src="/me/resources/images/career-experience.png" /></span> 2 - 3 Years</li>
          <li><span><img src="/me/resources/images/career-role.png" /></span>Marketing</li>
        </ul>
        <div class="view-more"><a href="JavaScript:;" data-target="JId31"><span>Know More</span></a></div>
        <div class="exp-type-tag"><p>Experienced</p></div>
      </div>
    </div>
    <div class="career-opening-box" data-opening="Experienced" data-job-category="User Experience Design">
      <div class="career-opening-head"><h3>UX Designer</h3></div>
      <div class="career-opening-info">
        <p>Must have a clear understanding of business goals and user behavior.</p>
        <ul>
          <li><span><img src="/me/resources/images/career-location.png" /></span> Goregaon(E),Mumbai.</li>
          <li><span><img src="/me/resources/images/career-experience.png" /></span> 01-03 years</li>
          <li><span><img src="/me/resources/images/career-role.png" /></span>UX / Wire</li>
        </ul>
        <div class="view-more"><a href="JavaScript:;" data-target="JId6"><span>Know More</span></a></div>
        <div class="exp-type-tag"><p>Experienced</p></div>
      </div>
    </div>
    <div id="JId31" class="div-description">
      <div class="career-jd-main">
        <h3>Roles & Responsibilities</h3>
        <ul><li>Identify opportunities and produce leads.</li><li>Develop creative pitches.</li></ul>
      </div>
      <a class="btn common-btn apply-now-btn" href="JavaScript:;">Apply Now</a>
    </div>
    <div id="JId6" class="div-description">
      <div class="career-jd-main">
        <h3>Roles & Responsibilities</h3>
        <ul><li>Create user flows.</li><li>Translate business goals into experiences.</li></ul>
      </div>
      <a class="btn common-btn apply-now-btn" href="JavaScript:;">Apply Now</a>
    </div>
  </body>
</html>
`

const nxtgenCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers | NxtGen Datacenter Solutions and Cloud Technologies</title>
  </head>
  <body>
    <div class="search-job-title">Search Jobs</div>
    <div class="featured">
      <div class="featured-title">Featured Jobs</div>
      <div class="featured-box pull-left">
        <div class="featured-box-text1 download-bg-color4">
          <div class="featured-box-head">Customer Life Cycle Manager</div>
          <span class="featured-box-head2">Bengaluru</span>
        </div>
        <div class="featured-box-text2 success-bg-color4">
          <div class="careers-ul">
            <b>You will be responsible for: </b>
            <ul>
              <li>Developing creative pitches.</li>
              <li>Identifying opportunities and producing quality leads.</li>
            </ul>
          </div>
        </div>
        <div class="ourbtnmain download-bg-color2">
          <div class="our-readmore-btn download-bg-color4">
            <a href="images/PDF/Customer_Life_Cycle_Manager.pdf" download>Read More</a>
          </div>
          <div class="our-readmore-btn purpal-shade">
            <a href="" data-toggle="modal" data-target="#myModal8">Apply</a>
          </div>
        </div>
      </div>
      <div class="featured-box pull-left">
        <div class="featured-box-text1 download-bg-color4">
          <div class="featured-box-head">Network Architect</div>
          <span class="featured-box-head2">Bengaluru</span>
        </div>
        <div class="featured-box-text2 success-bg-color4">
          <div class="careers-ul">
            <b>You will be responsible for: </b>
            <ul>
              <li>Architect enterprise-grade networking.</li>
              <li>Lead customer escalations.</li>
            </ul>
          </div>
        </div>
        <div class="ourbtnmain download-bg-color2">
          <div class="our-readmore-btn download-bg-color4">
            <a href="images/PDF/Network_Architect.pdf" download>Read More</a>
          </div>
          <div class="our-readmore-btn purpal-shade">
            <a href="" data-toggle="modal" data-target="#myModal11">Apply</a>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

const technosoftHomepageHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>Technosoft is now Apexon</title>
    <meta http-equiv="refresh" content="5;url=https://www.apexon.com/" />
  </head>
  <body>
    <table>
      <tr><td><img src="tslogo.jpg" alt="Technosoft corp"></td></tr>
      <tr><td><i>Technosoft</i> is now Apexon</td></tr>
      <tr><td><a href="https://www.apexon.com">click here</a></td></tr>
    </table>
  </body>
</html>
`

const infrabeatCareersHtml = `
<!doctype html>
<html>
  <head>
    <title>Careers at InfraBeat: Join Our Global Digital Transformation Team</title>
  </head>
  <body>
    <h1>Join our innovative team</h1>
    <h2>Open Positions</h2>
    <div class="accordion-item">
      <div class="modal fade career-modal" id="lead-sap-mm-consultant">
        <div class="career-apply-modal">
          <p>Roles &amp; Responsibilities: Drive discovery sessions. Lead SAP MM implementation topics.</p>
        </div>
        <h3 class="job_title">Lead SAP MM Consultant</h3>
        <h6>Location</h6>
        <p>Pune</p>
        <h6>Experience</h6>
        <p>8+ years of experience in SAP development in client environments of similar scope and size</p>
        <a href="#lead-sap-mm-consultant">Apply Now</a>
      </div>
    </div>
    <div class="accordion-item">
      <div class="modal fade career-modal" id="senior-sap-fico-consultant">
        <div class="career-apply-modal">
          <p>Roles &amp; Responsibilities: Configure SAP FICO. Collaborate across modules.</p>
        </div>
        <h3 class="job_title">SAP FICO Senior Consultant</h3>
        <h6>Location</h6>
        <p>Pune</p>
        <h6>Experience</h6>
        <p>5+ years of SAP FICO consulting experience</p>
        <a href="#senior-sap-fico-consultant">Apply Now</a>
      </div>
    </div>
  </body>
</html>
`

const techilaListingHtml = `
<!doctype html>
<html>
  <body>
    <a href="#open-roles">View Open Roles</a>
    <h2>Current openings.</h2>
    <div id="job-list">
      <a href="/careers/6a5a2e30e82b6002f9cf351d">
        <button title="Copy job code JB001432"><span>JB001432</span></button>
        <span>Data Scientist</span>
        <span>Pune · Onsite</span>
        <span>Full-time</span>
      </a>
      <a href="/careers/6a5a2e30e82b6002f9cf351e">
        <button title="Copy job code JB001433"><span>JB001433</span></button>
        <span>Nordic Account Executive</span>
        <span>Norway · Remote</span>
        <span>Full-time</span>
      </a>
    </div>
  </body>
</html>
`

const techilaIndiaDetailHtml = `
<!doctype html>
<html>
  <head>
    <title>Data Scientist at Techila Global Services | in Pune</title>
  </head>
  <body>
    <script type="application/ld+json">
      [{
        "@context":"https://schema.org",
        "@type":"JobPosting",
        "title":"Data Scientist",
        "description":"Build machine learning models for analytics programs.",
        "identifier":{"@type":"PropertyValue","name":"Techila Global Services","value":"6a5a2e30e82b6002f9cf351d"},
        "datePosted":"2026-07-18",
        "validThrough":"2026-08-15",
        "employmentType":"FULL_TIME",
        "hiringOrganization":{"@type":"Organization","name":"Techila Global Services","sameAs":"https://techilaservices.com"},
        "jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Pune"}},
        "skills":"Data Science",
        "url":"https://techilaservices.com/careers/6a5a2e30e82b6002f9cf351d"
      }]
    </script>
  </body>
</html>
`

const techilaGlobalDetailHtml = `
<!doctype html>
<html>
  <body>
    <script type="application/ld+json">
      [{
        "@context":"https://schema.org",
        "@type":"JobPosting",
        "title":"Nordic Account Executive",
        "description":"Lead strategic growth in the Nordics.",
        "identifier":{"@type":"PropertyValue","name":"Techila Global Services","value":"6a5a2e30e82b6002f9cf351e"},
        "datePosted":"2026-07-18",
        "validThrough":"2026-09-01",
        "employmentType":"FULL_TIME",
        "hiringOrganization":{"@type":"Organization","name":"Techila Global Services","sameAs":"https://techilaservices.com"},
        "jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Oslo"}},
        "skills":"Sales",
        "url":"https://techilaservices.com/careers/6a5a2e30e82b6002f9cf351e"
      }]
    </script>
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

test('Techved Consulting scraper stays pinned to the verified same-page careers contract', async () => {
  const techved = await loadScript('../../scraper/techvedconsulting/script.js')

  assert.equal(techved.SOURCE, 'techvedconsulting')
  assert.equal(techved.COMPANY, 'Techved Consulting')
  assert.equal(techved.CAREERS_URL, 'https://www.techved.com/me/career')
  assert.equal(techved.VERIFIED_ON, '2026-07-18')
  assert.equal(techved.hasOfficialCareersSignal(techvedCareersHtml), true)
  assert.equal(techved.hasOfficialCareersSignal('<html><body><h1>Unexpected</h1></body></html>'), false)
  assert.deepEqual(techved.extractJobs(techvedCareersHtml), [
    {
      title: 'Sr Marketing Associate',
      company: 'Techved Consulting',
      department: 'Marketing',
      location: 'Goregaon(E), Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: 'JId31',
      requisitionId: 'JId31',
      sourceUrl: 'https://www.techved.com/me/career#JId31',
      applyUrl: 'https://www.techved.com/me/career#JId31',
      employmentType: null,
      experienceRequired: '2 - 3 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Marketing'],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Marketing role for demand generation. Roles & Responsibilities Identify opportunities and produce leads. Develop creative pitches.',
    },
    {
      title: 'UX Designer',
      company: 'Techved Consulting',
      department: 'User Experience Design',
      location: 'Goregaon(E), Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: 'JId6',
      requisitionId: 'JId6',
      sourceUrl: 'https://www.techved.com/me/career#JId6',
      applyUrl: 'https://www.techved.com/me/career#JId6',
      employmentType: null,
      experienceRequired: '01-03 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['UX / Wire'],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Must have a clear understanding of business goals and user behavior. Roles & Responsibilities Create user flows. Translate business goals into experiences.',
    },
  ])

  const jobs = await techved.createTechvedConsultingScraper({ maxJobs: 1 }).run({
    fetchText: async () => techvedCareersHtml,
    now: () => '2026-07-18T08:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'techvedconsulting')
  assert.equal(jobs[0].link, 'https://www.techved.com/me/career#JId31')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T08:00:00.000Z')

  await assert.rejects(
    techved.createTechvedConsultingScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified techved consulting careers page/i,
  )
})

test('Nxtgen Datacenter Cloud Technologies scraper pins the visible first-party featured job cards', async () => {
  const nxtgen = await loadScript('../../scraper/nxtgendatacentercloudtechnologies/script.js')

  assert.equal(nxtgen.SOURCE, 'nxtgendatacentercloudtechnologies')
  assert.equal(nxtgen.COMPANY, 'Nxtgen Datacenter Cloud Technologies')
  assert.equal(nxtgen.CAREERS_URL, 'https://nxtgen.co.in/careers')
  assert.equal(nxtgen.VERIFIED_ON, '2026-08-04')
  assert.equal(nxtgen.hasOfficialCareersSignal(nxtgenCareersHtml), true)
  assert.equal(nxtgen.hasOfficialCareersSignal('<html><body>No jobs</body></html>'), false)
  assert.deepEqual(nxtgen.extractJobs(nxtgenCareersHtml), [
    {
      title: 'Customer Life Cycle Manager',
      company: 'Nxtgen Datacenter Cloud Technologies',
      department: null,
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'myModal8',
      requisitionId: 'myModal8',
      sourceUrl: 'https://nxtgen.co.in/images/PDF/Customer_Life_Cycle_Manager.pdf',
      applyUrl: 'https://nxtgen.co.in/careers#myModal8',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'You will be responsible for: Developing creative pitches. Identifying opportunities and producing quality leads.',
    },
    {
      title: 'Network Architect',
      company: 'Nxtgen Datacenter Cloud Technologies',
      department: null,
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'myModal11',
      requisitionId: 'myModal11',
      sourceUrl: 'https://nxtgen.co.in/images/PDF/Network_Architect.pdf',
      applyUrl: 'https://nxtgen.co.in/careers#myModal11',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'You will be responsible for: Architect enterprise-grade networking. Lead customer escalations.',
    },
  ])

  const jobs = await nxtgen.createNxtgenDatacenterCloudTechnologiesScraper({ maxJobs: 1 }).run({
    fetchText: async () => nxtgenCareersHtml,
    now: () => '2026-07-18T08:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'nxtgendatacentercloudtechnologies')
  assert.equal(jobs[0].link, 'https://nxtgen.co.in/careers#myModal8')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T08:00:00.000Z')

  await assert.rejects(
    nxtgen.createNxtgenDatacenterCloudTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified nxtgen datacenter cloud technologies careers page/i,
  )
})

test('Technosoft Corporation scraper fails closed on the verified legacy redirect and empty careers routes', async () => {
  const technosoft = await loadScript('../../scraper/technosoftcorporation/script.js')

  assert.equal(technosoft.SOURCE, 'technosoftcorporation')
  assert.equal(technosoft.COMPANY, 'Technosoft Corporation')
  assert.equal(technosoft.HOMEPAGE_URL, 'http://www.technosoftcorp.com/')
  assert.equal(technosoft.LEGACY_REDIRECT_URL, 'https://www.apexon.com/')
  assert.equal(technosoft.VERIFIED_ON, '2026-09-13')
  assert.equal(technosoft.hasLegacyHomepageSignal(technosoftHomepageHtml), true)
  assert.equal(technosoft.hasLegacyHomepageSignal('<html><body>Unexpected</body></html>'), false)
  assert.equal(
    technosoft.isVerifiedBlockedHomepage({
      status: 403,
      html: '<html><head><title>403 Forbidden</title></head><body><center><h1>403 Forbidden</h1></center><hr><center>nginx</center></body></html>',
    }),
    true,
  )
  assert.equal(technosoft.isVerifiedMissingCareerRoute({ status: 404, html: '' }), true)
  assert.equal(technosoft.isVerifiedMissingCareerRoute({ status: 403, html: '403 Forbidden' }), false)
  assert.equal(technosoft.isVerifiedMissingCareerRoute({ status: 200, html: '' }), false)

  const jobs = await technosoft.createTechnosoftCorporationScraper().run({
    fetchPage: async (url) => {
      if (url === technosoft.HOMEPAGE_URL) {
        return { status: 200, url, html: technosoftHomepageHtml }
      }
      return { status: 404, url, html: '' }
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    technosoft.createTechnosoftCorporationScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body><h1>Unexpected Careers</h1></body></html>',
      }),
    }),
    /verified technosoft corporation exact-name surface changed/i,
  )

  const transportError = Object.assign(new Error('DNS unavailable'), { code: 'ENOTFOUND' })
  await assert.rejects(technosoft.createTechnosoftCorporationScraper().run({
    fetchPage: async () => { throw transportError },
  }), error => error === transportError)

})

test('Infrabeat Technologies scraper stays pinned to the first-party WordPress careers archive', async () => {
  const infrabeat = await loadScript('../../scraper/infrabeattechnologies/script.js')

  assert.equal(infrabeat.SOURCE, 'infrabeattechnologies')
  assert.equal(infrabeat.COMPANY, 'Infrabeat Technologies')
  assert.equal(infrabeat.CAREERS_URL, 'https://infrabeat.com/careers/')
  assert.equal(infrabeat.VERIFIED_ON, '2026-08-02')
  assert.equal(infrabeat.hasOfficialCareersSignal(infrabeatCareersHtml), true)
  assert.equal(infrabeat.hasOfficialCareersSignal('<html><body>No archive</body></html>'), false)
  assert.deepEqual(infrabeat.extractJobs(infrabeatCareersHtml), [
    {
      title: 'Lead SAP MM Consultant',
      company: 'Infrabeat Technologies',
      department: null,
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      jobId: 'lead-sap-mm-consultant',
      requisitionId: 'lead-sap-mm-consultant',
      sourceUrl: 'https://infrabeat.com/careers/#lead-sap-mm-consultant',
      applyUrl: 'https://infrabeat.com/careers/#lead-sap-mm-consultant',
      employmentType: null,
      experienceRequired: '8+ years of experience in SAP development in client environments of similar scope and size',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Roles & Responsibilities: Drive discovery sessions. Lead SAP MM implementation topics.',
    },
    {
      title: 'SAP FICO Senior Consultant',
      company: 'Infrabeat Technologies',
      department: null,
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      jobId: 'senior-sap-fico-consultant',
      requisitionId: 'senior-sap-fico-consultant',
      sourceUrl: 'https://infrabeat.com/careers/#senior-sap-fico-consultant',
      applyUrl: 'https://infrabeat.com/careers/#senior-sap-fico-consultant',
      employmentType: null,
      experienceRequired: '5+ years of SAP FICO consulting experience',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Roles & Responsibilities: Configure SAP FICO. Collaborate across modules.',
    },
  ])

  const jobs = await infrabeat.createInfrabeatTechnologiesScraper({ maxJobs: 1 }).run({
    fetchText: async () => infrabeatCareersHtml,
    now: () => '2026-07-18T08:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'infrabeattechnologies')
  assert.equal(jobs[0].link, 'https://infrabeat.com/careers/#lead-sap-mm-consultant')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T08:00:00.000Z')

  await assert.rejects(
    infrabeat.createInfrabeatTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified infrabeat technologies careers page/i,
  )
})

test('Techila Global Services scraper uses first-party detail pages and filters to India roles', async () => {
  const techila = await loadScript('../../scraper/techilaglobalservices/script.js')

  assert.equal(techila.SOURCE, 'techilaglobalservices')
  assert.equal(techila.COMPANY, 'Techila Global Services')
  assert.equal(techila.CAREERS_URL, 'https://techilaservices.com/careers')
  assert.equal(techila.VERIFIED_ON, '2026-07-18')
  assert.equal(techila.hasOfficialCareersSignal(techilaListingHtml), true)
  assert.equal(techila.hasOfficialCareersSignal('<html><body>No roles</body></html>'), false)
  assert.deepEqual(techila.extractJobCards(techilaListingHtml), [
    {
      jobId: '6a5a2e30e82b6002f9cf351d',
      jobCode: 'JB001432',
      title: 'Data Scientist',
      locationLabel: 'Pune · Onsite',
      employmentTypeLabel: 'Full-time',
      detailUrl: 'https://techilaservices.com/careers/6a5a2e30e82b6002f9cf351d',
    },
    {
      jobId: '6a5a2e30e82b6002f9cf351e',
      jobCode: 'JB001433',
      title: 'Nordic Account Executive',
      locationLabel: 'Norway · Remote',
      employmentTypeLabel: 'Full-time',
      detailUrl: 'https://techilaservices.com/careers/6a5a2e30e82b6002f9cf351e',
    },
  ])

  const indiaPosting = techila.extractJobPostingJsonLd(techilaIndiaDetailHtml)
  assert.equal(indiaPosting.title, 'Data Scientist')
  assert.equal(indiaPosting.jobLocation.address.addressLocality, 'Pune')

  const jobs = await techila.createTechilaGlobalServicesScraper().run({
    fetchText: async (url) => {
      if (url === techila.CAREERS_URL) return techilaListingHtml
      if (url === 'https://techilaservices.com/careers/6a5a2e30e82b6002f9cf351d') {
        return techilaIndiaDetailHtml
      }
      if (url === 'https://techilaservices.com/careers/6a5a2e30e82b6002f9cf351e') {
        return techilaGlobalDetailHtml
      }
      throw new Error(`Unexpected Techila URL: ${url}`)
    },
    now: () => '2026-07-18T08:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Data Scientist',
      company: 'Techila Global Services',
      department: null,
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      jobId: '6a5a2e30e82b6002f9cf351d',
      requisitionId: 'JB001432',
      sourceUrl: 'https://techilaservices.com/careers/6a5a2e30e82b6002f9cf351d',
      applyUrl: 'https://techilaservices.com/careers/6a5a2e30e82b6002f9cf351d',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Data Science'],
      postingDate: '2026-07-18',
      closingDate: '2026-08-15',
      jobDescription: 'Build machine learning models for analytics programs.',
      source: 'techilaglobalservices',
      link: 'https://techilaservices.com/careers/6a5a2e30e82b6002f9cf351d',
      scrapedAt: '2026-07-18T08:00:00.000Z',
      companyCareerPage: 'https://techilaservices.com/careers',
      companyDomain: 'techilaservices.com',
      atsPlatform: 'nextjs-jobposting-detail-pages',
    },
  ])

  await assert.rejects(
    techila.createTechilaGlobalServicesScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified techila global services careers page/i,
  )
})
