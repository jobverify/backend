import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const loadModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

const sparxCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <div class="accordion">
      <div class="acc-question">
        <span class="que">Profile: Senior Android Developer</span>
        <div class="post-experience">
          <strong class="post-pos">Positions: 01</strong>
          <span class="post-exp">Experience: 5+ Years</span>
          <span class="job-loaction">Location: Noida (Sector 63)</span>
          <span class="certification">Eligibility Criteria (Educational): B.Tech, MCA, BCA</span>
        </div>
      </div>
      <div class="accordion-content">
        <strong class="post-pos">SUMMARY:</strong>
        <p>We are looking for a Senior Android developer responsible for the development of applications aimed at a vast number of diverse Android devices.</p>
        <a href="mailto:talent@sparxitsolutions.com" class="btn-apply">Apply</a>
      </div>
    </div>
    <hr class="bottom-line">
    <div class="accordion">
      <div class="acc-question">
        <span class="que">Profile: Project Consultant</span>
        <div class="post-experience">
          <strong class="post-pos">Positions: 05</strong>
          <span class="post-exp">Experience: 5+ Years</span>
          <span class="job-loaction">Location: Noida (Sector 63)</span>
          <span class="certification">Eligibility Criteria (Educational): B.Tech/MCA/BCA</span>
        </div>
      </div>
      <div class="accordion-content">
        <strong class="post-pos">SUMMARY:</strong>
        <p>We are looking for an experienced technical Project Manager who will join a dynamic and fast-paced environment.</p>
        <a href="mailto:talent@sparxitsolutions.com" class="btn-apply">Apply</a>
      </div>
    </div>
    <hr class="bottom-line">
    <div class="accordion">
      <div class="acc-question">
        <span class="que">Profile: Python Developer</span>
        <div class="post-experience">
          <strong class="post-pos">Position : 01</strong>
          <span class="post-exp">Experience: 3+ Years</span>
          <span class="job-loaction">Location: Noida (Sector 63)</span>
          <span class="certification">Eligibility Criteria (Educational): Any degree</span>
        </div>
      </div>
      <div class="accordion-content">
        <strong>Key Responsibilities:</strong>
        <ul class="key-list">
          <li>Develop back-end components to improve responsiveness and overall performance</li>
          <li>Integrate user-facing elements into applications</li>
        </ul>
        <a href="mailto:talent@sparxitsolutions.com" class="btn-apply">Apply</a>
      </div>
    </div>
  </body>
</html>
`

const perpetuuitiHomepageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <title>Autonomous Resilience Platform | Perpetuuiti</title>
    <nav>
      <a href="/platform">Platform</a>
      <a href="/products">Products</a>
      <a href="/docs">Docs</a>
      <a href="/contact">Contact</a>
    </nav>
    <a href="/book-demo">Book a Resilience Assessment</a>
    <h1>RESILIENCE REDEFINED</h1>
    <p>Autonomous resilience for the AI era.</p>
    <p>Built on 15 years of enterprise resilience expertise.</p>
    <p>Perpetuuiti connects protection, recovery orchestration and continuous validation.</p>
  </body>
</html>
`

const perpetuuitiSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://ptechnosoft.com/</loc></url>
  <url><loc>https://ptechnosoft.com/about/</loc></url>
  <url><loc>https://ptechnosoft.com/contact/</loc></url>
  <url><loc>https://ptechnosoft.com/docs/</loc></url>
</urlset>
`

const perpetuuitiMissingRouteHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>404 Not Found</h1>
  </body>
</html>
`

const cybertechCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Search Jobs at CyberTech</h2>
    <div class="et_pb_column et_pb_column_1_3 job_item">
      <h5><a href="https://cybertech.com/job/lead-public-cloud-devops-automation-specialist/">Lead Public Cloud DevOps Automation Specialist</a></h5>
      <div class="jobmeta"><span>12+ years</span></div>
      <div class="jobmeta"><span>Full Time</span></div>
      <a href="https://cybertech.com/job/lead-public-cloud-devops-automation-specialist/">Apply Now</a>
    </div>
    <div class="et_pb_column et_pb_column_1_3 job_item">
      <h5><a href="https://cybertech.com/job/ui-with-cloud-foundry-developer-2/">Sr.DBA (MSSQL)</a></h5>
      <div class="jobmeta"><span>6+ Years/10+Years</span></div>
      <div class="jobmeta"><span>Full Time</span></div>
      <a href="https://cybertech.com/job/ui-with-cloud-foundry-developer-2/">Apply Now</a>
    </div>
    <div class="et_pb_column et_pb_column_1_3 job_item">
      <h5><a href="https://cybertech.com/job/sap-abap-developer/">SAP ABAP Developer</a></h5>
      <div class="jobmeta"><span>4+ years</span></div>
      <div class="jobmeta"><span>Full Time</span></div>
      <a href="https://cybertech.com/job/sap-abap-developer/">Apply Now</a>
    </div>
  </body>
</html>
`

const zietaCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Career</h2>
    <h4>Experienced professionals</h4>
    <p>Title : LEAD SYSTEMS ANALYST</p>
    <p>Description : LEAD SYSTEMS ANALYST for system design, development, & implementation for business software applications; Ability to troubleshoot issue with implementation and rollout in live business environment; Train and provide technical advice to project staff; Research emerging technologies.</p>
    <p>Require : Master's degree in Computer Science or related field; three years of job-related experience. Experience to include working with SAP (ECC, S/4HANA, Extended Warehouse Management, Radio frequency tools, Warehouse Management). Travel/relocation to various unanticipated locations within U.S. possible.</p>
    <p>Apply with resume to : HR, Zieta Technologies, LLC, 300 Colonial Center Parkway, Suite 100, Roswell, GA 30076. Refer: GAMS21</p>
    <a href="#" data-toggle="modal" data-target="#applynow">Apply here</a>
  </body>
</html>
`

const provabJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Apply For Open Positions.</h1>
    <p>Write to us and our team will get back to you ASAP</p>
    <select name="jobtype">
      <option value="" disabled selected>Applying For</option>
      <option value="Android Developers">Android Developers</option>
      <option value="Angular Developers">Angular Developers</option>
      <option value="Dot Net Developers">Dot Net Developers</option>
      <option value="Full Stack Developers">Full Stack Developers</option>
      <option value="iOS Developers">iOS Developers</option>
      <option value="Java Developers">Java Developers</option>
      <option value="Magento Developers">Magento Developers</option>
      <option value="NodeJS Developers">NodeJS Developers</option>
      <option value="PHP Developers">PHP Developers</option>
      <option value="Python Developers">Python Developers</option>
      <option value="Web Services / API Experts">Web Services / API Experts</option>
      <option value="UI / UX Designer">UI / UX Designer</option>
      <option value="Others">Others</option>
    </select>
    <select name="experience">
      <option value="" disabled selected>Experience</option>
      <option value="0 - 1 Year">0 - 1 Year</option>
      <option value="1 - 3 Years">1 - 3 Years</option>
      <option value="3 - 5 Years">3 - 5 Years</option>
      <option value="5 - 8 Years">5 - 8 Years</option>
    </select>
  </body>
</html>
`

test('SPARX IT Solutions extracts verified India openings from the first-party careers accordion', async () => {
  const sparx = await loadModule('../../scraper/sparxitsolutions/script.js')

  assert.equal(sparx.hasOfficialCareersSignal(sparxCareersHtml), true)
  assert.deepEqual(sparx.extractJobCards(sparxCareersHtml).map((job) => job.title), [
    'Senior Android Developer',
    'Project Consultant',
    'Python Developer',
  ])

  const jobs = await sparx.createSparxItSolutionsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, sparx.CAREERS_URL)
      return sparxCareersHtml
    },
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.experienceRequired, job.applyUrl]),
    [
      [
        'Senior Android Developer',
        'Noida (Sector 63), India',
        '5+ Years',
        'mailto:talent@sparxitsolutions.com',
      ],
      [
        'Project Consultant',
        'Noida (Sector 63), India',
        '5+ Years',
        'mailto:talent@sparxitsolutions.com',
      ],
      [
        'Python Developer',
        'Noida (Sector 63), India',
        '3+ Years',
        'mailto:talent@sparxitsolutions.com',
      ],
    ],
  )
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Perpetuuiti Technosoft Services stays fail-closed while the verified homepage, sitemap, redirects, and missing routes remain unchanged', async () => {
  const perpetuuiti = await loadModule('../../scraper/perpetuuititechnosoftservices/script.js')

  assert.equal(perpetuuiti.hasOfficialHomepageSignal(perpetuuitiHomepageHtml), true)
  assert.equal(
    perpetuuiti.isHomepageRedirectSurface({
      status: 200,
      url: perpetuuiti.HOMEPAGE_URL,
      text: perpetuuitiHomepageHtml,
    }),
    true,
  )
  assert.equal(perpetuuiti.hasExpectedSitemapSurface(perpetuuitiSitemapXml), true)
  assert.equal(perpetuuiti.hasCareersLikeRoute(perpetuuitiSitemapXml), false)
  assert.equal(
    perpetuuiti.isExpectedMissingCareerRoute({
      status: 404,
      url: perpetuuiti.CAREERS_ROUTE_URL,
      text: perpetuuitiMissingRouteHtml,
    }, perpetuuiti.CAREERS_ROUTE_URL),
    true,
  )

  const jobs = await perpetuuiti.createPerpetuuitiTechnosoftServicesScraper().run({
    fetchPage: async (url) => {
      if (url === perpetuuiti.HOMEPAGE_URL) {
        return { status: 200, url, text: perpetuuitiHomepageHtml }
      }
      if (url === perpetuuiti.SITEMAP_URL) {
        return { status: 200, url, text: perpetuuitiSitemapXml }
      }
      if ([perpetuuiti.LEGACY_CAREERS_URL, perpetuuiti.LEGACY_CAREERS_FORM_URL].includes(url)) {
        return {
          status: 200,
          url: perpetuuiti.HOMEPAGE_URL,
          text: perpetuuitiHomepageHtml,
        }
      }
      if (
        [
          perpetuuiti.CAREERS_ROUTE_URL,
          perpetuuiti.CAREER_ROUTE_URL,
          perpetuuiti.JOBS_ROUTE_URL,
        ].includes(url)
      ) {
        return { status: 404, url, text: perpetuuitiMissingRouteHtml }
      }
      throw new Error(`Unexpected Perpetuuiti URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    perpetuuiti.createPerpetuuitiTechnosoftServicesScraper().run({
      fetchPage: async (url) => {
        if (url === perpetuuiti.HOMEPAGE_URL) {
          return { status: 200, url, text: perpetuuitiHomepageHtml }
        }
        if (url === perpetuuiti.SITEMAP_URL) {
          return {
            status: 200,
            url,
            text: `${perpetuuitiSitemapXml}<url><loc>https://ptechnosoft.com/careers</loc></url>`,
          }
        }
        if ([perpetuuiti.LEGACY_CAREERS_URL, perpetuuiti.LEGACY_CAREERS_FORM_URL].includes(url)) {
          return {
            status: 200,
            url: perpetuuiti.HOMEPAGE_URL,
            text: perpetuuitiHomepageHtml,
          }
        }
        if (
          [
            perpetuuiti.CAREERS_ROUTE_URL,
            perpetuuiti.CAREER_ROUTE_URL,
            perpetuuiti.JOBS_ROUTE_URL,
          ].includes(url)
        ) {
          return { status: 404, url, text: perpetuuitiMissingRouteHtml }
        }
        throw new Error(`Unexpected Perpetuuiti URL: ${url}`)
      },
    }),
    /sitemap now exposes a careers-like route/i,
  )
})

test('Cybertech Systems & Software keeps listing-only observations partial when native role replies are unavailable', async () => {
  const cybertech = await loadModule('../../scraper/cybertechsystemsandsoftware/script.js')

  assert.equal(cybertech.hasOfficialCareersSignal(cybertechCareersHtml), true)
  assert.deepEqual(cybertech.extractJobCards(cybertechCareersHtml), [
    {
      title: 'Lead Public Cloud DevOps Automation Specialist',
      sourceUrl: 'https://cybertech.com/job/lead-public-cloud-devops-automation-specialist/',
      applyUrl: 'https://cybertech.com/job/lead-public-cloud-devops-automation-specialist/',
      experienceRequired: null,
      employmentType: null,
    },
    {
      title: 'Sr.DBA (MSSQL)',
      sourceUrl: 'https://cybertech.com/job/ui-with-cloud-foundry-developer-2/',
      applyUrl: 'https://cybertech.com/job/ui-with-cloud-foundry-developer-2/',
      experienceRequired: null,
      employmentType: null,
    },
    {
      title: 'SAP ABAP Developer',
      sourceUrl: 'https://cybertech.com/job/sap-abap-developer/',
      applyUrl: 'https://cybertech.com/job/sap-abap-developer/',
      experienceRequired: null,
      employmentType: null,
    },
  ])

  const jobs = await cybertech.createCybertechSystemsAndSoftwareScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      if (url === cybertech.CAREERS_URL) return cybertechCareersHtml
      throw new Error('No retained native reply in this listing-only fixture')
    },
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.experienceRequired ?? null, job.employmentType ?? null, job.applyUrl]),
    [
      [
        'Lead Public Cloud DevOps Automation Specialist',
        null,
        null,
        'https://cybertech.com/job/lead-public-cloud-devops-automation-specialist/',
      ],
      [
        'Sr.DBA (MSSQL)',
        null,
        null,
        'https://cybertech.com/job/ui-with-cloud-foundry-developer-2/',
      ],
      [
        'SAP ABAP Developer',
        null,
        null,
        'https://cybertech.com/job/sap-abap-developer/',
      ],
    ],
  )
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.ok(jobs.every(job => job.jobId === null && job.requisitionId === null && job.jobDescription === null))
  assert.ok(jobs.every(job => job.country === null && job.sourceDetailComplete === false && job.lifecycleCleanupAllowed === false))
})

test('Zieta Technologies extracts the verified inline careers opening from the first-party page', async () => {
  const zieta = await loadModule('../../scraper/zietatechnologies/script.js')

  assert.equal(zieta.hasOfficialCareersSignal(zietaCareersHtml), true)
  assert.deepEqual(zieta.extractJobs(zietaCareersHtml), [
    {
      title: 'LEAD SYSTEMS ANALYST',
      location: 'Roswell, GA, United States',
      country: 'United States',
      experienceRequired: '3 years',
      sourceUrl: 'https://www.zietatech.com/index.php?page=careers',
      applyUrl: 'https://www.zietatech.com/index.php?page=careers#applynow',
      jobDescription:
        'LEAD SYSTEMS ANALYST for system design, development, & implementation for business software applications; Ability to troubleshoot issue with implementation and rollout in live business environment; Train and provide technical advice to project staff; Research emerging technologies. Master\'s degree in Computer Science or related field; three years of job-related experience. Experience to include working with SAP (ECC, S/4HANA, Extended Warehouse Management, Radio frequency tools, Warehouse Management). Travel/relocation to various unanticipated locations within U.S. possible.',
    },
  ])

  const jobs = await zieta.createZietaTechnologiesScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, zieta.CAREERS_URL)
      return zietaCareersHtml
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'LEAD SYSTEMS ANALYST')
  assert.equal(jobs[0].location, 'Roswell, GA, United States')
  assert.equal(jobs[0].experienceRequired, '3 years')
  assert.equal(jobs[0].applyUrl, 'https://www.zietatech.com/index.php?page=careers#applynow')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Provab Technosoft stays fail-closed while the verified first-party jobs page remains a generic application form', async () => {
  const provab = await loadModule('../../scraper/provabtechnosoft/script.js')

  assert.equal(provab.hasOfficialJobsPageSignal(provabJobsHtml), true)
  assert.deepEqual(provab.extractRoleOptions(provabJobsHtml), [
    'Android Developers',
    'Angular Developers',
    'Dot Net Developers',
    'Full Stack Developers',
    'iOS Developers',
    'Java Developers',
    'Magento Developers',
    'NodeJS Developers',
    'PHP Developers',
    'Python Developers',
    'Web Services / API Experts',
    'UI / UX Designer',
    'Others',
  ])

  const jobs = await provab.createProvabTechnosoftScraper().run({
    fetchText: async (url) => {
      assert.equal(url, provab.CAREERS_URL)
      return provabJobsHtml
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    provab.createProvabTechnosoftScraper().run({
      fetchText: async () => `
        ${provabJobsHtml}
        <a href="https://www.provab.com/jobs/senior-python-developer">Senior Python Developer</a>
      `,
    }),
    /generic application form/i,
  )
})
