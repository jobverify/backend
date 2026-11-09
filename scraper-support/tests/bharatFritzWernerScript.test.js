import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>CNC Machining Centers - Vertical &amp; Horizontal Machining Centres</title>
    <link rel="canonical" href="https://bfwindia.com/" />
    <meta name="description" content="BFW is a CNC machine manufacturing company which manufactures Machining Centres, Turning Centres, Five Axis Machines, Turn Mill Machines and Engineered Solutions." />
  </head>
  <body>
    <nav>
      <a href="https://bfwindia.com/about-us/">About Us</a>
      <a href="https://bfwindia.com/services/">Services</a>
      <a href="https://bfwindia.com/careers/">Career</a>
      <a href="https://bfwindia.com/contact-us/">Contact us</a>
    </nav>
    <main>
      <h2>Make a difference</h2>
      <p>Our mission is to contribute to the advancement of humanity through technology. But we can’t achieve that without you.</p>
      <a href="https://bfwindia.com/careers/">Visit career section</a>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - BFW</title>
    <link rel="canonical" href="https://bfwindia.com/careers/" />
  </head>
  <body>
    <main>
      <h1>Careers in BFW</h1>
      <h2>Notice to Applicants: BFW's Commitment to a No Recruitment Fees Policy</h2>
      <p>Career opportunities with BFW are posted on our official website, and any communication regarding our recruitment process will always come directly from BFW or its authorized representatives.</p>
      <h3>Join our team</h3>
      <h4>Positions open</h4>

      <section class="job-card">
        <h5 class="elementor-heading-title elementor-size-default">Head of Application Engineering</h5>
        <a class="elementor-button elementor-button-link elementor-size-sm" href="https://bfwindia.com/careers/head-of-application-engineering-1/">
          <span class="elementor-button-text">More details</span>
        </a>
        <ul class="elementor-icon-list-items elementor-inline-items">
          <li><span class="elementor-icon-list-text">Department : Application Engineering</span></li>
          <li><span class="elementor-icon-list-text">Location : Thally</span></li>
        </ul>
      </section>

      <section class="job-card">
        <h5 class="elementor-heading-title elementor-size-default">Head /Dept Lead</h5>
        <a class="elementor-button elementor-button-link elementor-size-sm" href="https://bfwindia.com/careers/head-dept/">
          <span class="elementor-button-text">More details</span>
        </a>
        <ul class="elementor-icon-list-items elementor-inline-items">
          <li><span class="elementor-icon-list-text">Department : Manufacturing &amp; Methods Engineering</span></li>
          <li><span class="elementor-icon-list-text">Location : Thally</span></li>
        </ul>
      </section>

      <section class="job-card">
        <h5 class="elementor-heading-title elementor-size-default">Production Planning and Control (PPC)</h5>
        <a class="elementor-button elementor-button-link elementor-size-sm" href="https://bfwindia.com/careers/production-planning-and-control/">
          <span class="elementor-button-text">More details</span>
        </a>
        <ul class="elementor-icon-list-items elementor-inline-items">
          <li><span class="elementor-icon-list-text">Department : PPC</span></li>
          <li><span class="elementor-icon-list-text">Location : Thally</span></li>
        </ul>
      </section>

      <section class="job-card">
        <h5 class="elementor-heading-title elementor-size-default">Supply Chain Management (SCM)</h5>
        <a class="elementor-button elementor-button-link elementor-size-sm" href="https://bfwindia.com/careers/supply-chain-management">
          <span class="elementor-button-text">More details</span>
        </a>
        <ul class="elementor-icon-list-items elementor-inline-items">
          <li><span class="elementor-icon-list-text">Department : SCM</span></li>
          <li><span class="elementor-icon-list-text">Location : Thally</span></li>
        </ul>
      </section>

      <section class="job-card">
        <h5 class="elementor-heading-title elementor-size-default">Head of Quality</h5>
        <a class="elementor-button elementor-button-link elementor-size-sm" href="https://bfwindia.com/careers/head-of-quality">
          <span class="elementor-button-text">More details</span>
        </a>
        <ul class="elementor-icon-list-items elementor-inline-items">
          <li><span class="elementor-icon-list-text">Department : QA &amp; QC</span></li>
          <li><span class="elementor-icon-list-text">Location : Thally</span></li>
        </ul>
      </section>
    </main>
  </body>
</html>
`

const missingJobRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page not found - BFW</title>
  </head>
  <body>
    <h1>Page not found</h1>
    <a href="https://bfwindia.com/careers/">Career</a>
  </body>
</html>
`

const headDeptDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Head / Dept Lead - Bharat Fritz Werner (BFW) India</title>
    <link rel="canonical" href="https://bfwindia.com/careers/head-dept/" />
    <meta property="og:title" content="Head / Dept Lead" />
    <meta property="og:description" content="Department: Manufacturing &amp; Methods Engineering" />
  </head>
  <body>
    <main>
      <h1>Head / Dept Lead</h1>
      <h2>Manufacturing &amp; Methods Engineering</h2>
      <h3>Job responsibilities/description:</h3>
      <ul>
        <li>Process development and optimization: Lead the development and implementation of improved manufacturing methods to increase efficiency and reduce waste.</li>
        <li>Team leadership and management: Supervise, mentor, and motivate a team of manufacturing professionals, fostering a culture of safety and continuous improvement.</li>
      </ul>
      <h3>Job prerequisites:</h3>
      <h3>Education:</h3>
      <ul>
        <li>Bachelor’s or master’s degree in mechanical engineering, Manufacturing/Production/Mechanical Engineering, or a related field.</li>
      </ul>
      <h3>Experience:</h3>
      <ul>
        <li>20+ years of experience with at least 5 years in a leadership role within the machine tools industry.</li>
        <li>Significant experience in manufacturing, with several years in a leadership role.</li>
      </ul>
      <h3>Key skill required:</h3>
      <ul>
        <li>Expertise in manufacturing methods engineering, process optimization, lean manufacturing principles, and quality management systems.</li>
        <li>Excellent leadership, communication, and problem-solving skills.</li>
      </ul>
      <h3>Didn't you find your position?</h3>
      <a href="https://bfwindia.com/careers/#career">Contact us</a>
      <section id="apply">
        <h2>Apply for this position</h2>
        <p>Thank you for considering BFW as your future workplace!</p>
        <form class="elementor-form" method="post" name="Career in BFW">
          <input type="hidden" name="referer_title" value="Head / Dept Lead - Bharat Fritz Werner (BFW) India" />
          <input type="text" name="form_fields[name]" />
          <input type="file" name="form_fields[field_e221f58][]" />
          <button type="submit">Apply now</button>
        </form>
      </section>
    </main>
  </body>
</html>
`

const buildDetailHtml = ({
  title,
  subtitle = title,
  responsibilities = [],
  education = [],
  experience = [],
  skills = [],
}) => `
<!doctype html>
<html lang="en">
  <head>
    <title>${title} - Bharat Fritz Werner (BFW) India</title>
    <link rel="canonical" href="https://bfwindia.com/careers/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}/" />
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <h2>${subtitle}</h2>
      <h3>Primary objective:</h3>
      <p>Lead the function with measurable impact.</p>
      <h3>Job responsibilities/description:</h3>
      <ul>${responsibilities.map((item) => `<li>${item}</li>`).join('')}</ul>
      <h3>Education:</h3>
      <ul>${education.map((item) => `<li>${item}</li>`).join('')}</ul>
      <h3>Experience:</h3>
      <ul>${experience.map((item) => `<li>${item}</li>`).join('')}</ul>
      <h3>Key skill required:</h3>
      <ul>${skills.map((item) => `<li>${item}</li>`).join('')}</ul>
      <section id="apply">
        <h2>Apply for this position</h2>
        <form class="elementor-form" method="post" name="Career in BFW">
          <input type="file" name="form_fields[field_e221f58][]" />
          <button type="submit">Apply now</button>
        </form>
      </section>
    </main>
  </body>
</html>
`

const detailPageByUrl = {
  'https://bfwindia.com/careers/head-of-application-engineering-1/': buildDetailHtml({
    title: 'Head of Application Engineering',
    responsibilities: [
      'Drive customer engagement and technical pre-sales solutioning.',
      'Lead application engineering teams across machine tool programs.',
    ],
    education: [
      'Bachelor’s degree in mechanical engineering or a related discipline.',
    ],
    experience: [
      '15+ years of experience in application engineering and machine tools.',
    ],
    skills: [
      'Strong customer engagement and solution development skills.',
    ],
  }),
  'https://bfwindia.com/careers/head-dept/': headDeptDetailHtml,
  'https://bfwindia.com/careers/production-planning-and-control/': buildDetailHtml({
    title: 'Production Planning and Control (PPC)',
    responsibilities: [
      'Own production planning, scheduling, and coordination.',
      'Drive inventory and material management improvements.',
    ],
    education: [
      'Bachelor’s degree in industrial engineering, production engineering, or related field.',
    ],
    experience: [
      '12+ years in production planning and control, including leadership exposure.',
    ],
    skills: [
      'Strong planning discipline and ERP-driven execution.',
    ],
  }),
  'https://bfwindia.com/careers/supply-chain-management/': buildDetailHtml({
    title: 'Supply Chain Management (SCM)',
    responsibilities: [
      'Lead strategic planning, procurement, and logistics execution.',
      'Improve vendor management and warehouse performance.',
    ],
    education: [
      'Bachelor’s degree in supply chain, operations, or mechanical engineering.',
    ],
    experience: [
      '12+ years of supply chain leadership in manufacturing environments.',
    ],
    skills: [
      'Supplier development, analytics, and process improvement expertise.',
    ],
  }),
  'https://bfwindia.com/careers/head-of-quality/': buildDetailHtml({
    title: 'Head of Quality',
    responsibilities: [
      'Lead QMS, product quality assurance, and supplier quality management.',
      'Drive cross-functional continuous improvement initiatives.',
    ],
    education: [
      'Bachelor’s degree in engineering with strong quality systems exposure.',
    ],
    experience: [
      '15+ years in quality leadership for industrial manufacturing.',
    ],
    skills: [
      'QMS, compliance, and team leadership capability.',
    ],
  }),
}

const loadBharatFritzWernerModule = async () => {
  try {
    return await import('../../scraper/bharatfritzwerner/script.js')
  } catch {
    assert.fail('Expected Bharat Fritz Werner scraper module at ../../scraper/bharatfritzwerner/script.js')
  }
}

test('Bharat Fritz Werner scraper constants and helpers stay pinned to the verified first-party careers surface', async () => {
  const bfw = await loadBharatFritzWernerModule()

  assert.equal(bfw.SOURCE, 'bharatfritzwerner')
  assert.equal(bfw.COMPANY, 'Bharat Fritz Werner')
  assert.equal(bfw.OFFICIAL_BRAND_NAME, 'BFW')
  assert.equal(bfw.VERIFIED_ON, '2026-07-15')
  assert.equal(bfw.HOMEPAGE_URL, 'https://bfwindia.com/')
  assert.equal(bfw.CAREERS_URL, 'https://bfwindia.com/careers/')
  assert.equal(bfw.CAREER_ALIAS_URL, 'https://bfwindia.com/career/')
  assert.deepEqual(bfw.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://bfwindia.com/jobs/',
    'https://bfwindia.com/join-us/',
    'https://bfwindia.com/work-with-us/',
  ])
  assert.match(bfw.VERIFIED_SURFACE_SUMMARY, /visible Positions open block/i)
  assert.equal(bfw.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(bfw.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(
    bfw.isMissingNoPublicJobRoute({
      status: 404,
      url: 'https://bfwindia.com/jobs/',
      html: missingJobRouteHtml,
    }),
    true,
  )
  assert.deepEqual(
    bfw.extractVisibleListings(careersHtml),
    [
      {
        title: 'Head of Application Engineering',
        department: 'Application Engineering',
        location: 'Thally, India',
        city: 'Thally',
        sourceUrl: 'https://bfwindia.com/careers/head-of-application-engineering-1/',
      },
      {
        title: 'Head /Dept Lead',
        department: 'Manufacturing & Methods Engineering',
        location: 'Thally, India',
        city: 'Thally',
        sourceUrl: 'https://bfwindia.com/careers/head-dept/',
      },
      {
        title: 'Production Planning and Control (PPC)',
        department: 'PPC',
        location: 'Thally, India',
        city: 'Thally',
        sourceUrl: 'https://bfwindia.com/careers/production-planning-and-control/',
      },
      {
        title: 'Supply Chain Management (SCM)',
        department: 'SCM',
        location: 'Thally, India',
        city: 'Thally',
        sourceUrl: 'https://bfwindia.com/careers/supply-chain-management/',
      },
      {
        title: 'Head of Quality',
        department: 'QA & QC',
        location: 'Thally, India',
        city: 'Thally',
        sourceUrl: 'https://bfwindia.com/careers/head-of-quality/',
      },
    ],
  )
  assert.equal(bfw.hasOfficialDetailPageSignal(headDeptDetailHtml), true)
})

test('extractJobDetail returns normalized Bharat Fritz Werner data from the verified first-party detail page', async () => {
  const bfw = await loadBharatFritzWernerModule()
  const listing = {
    title: 'Head /Dept Lead',
    department: 'Manufacturing & Methods Engineering',
    location: 'Thally, India',
    city: 'Thally',
    sourceUrl: 'https://bfwindia.com/careers/head-dept/',
  }

  const job = bfw.extractJobDetail(headDeptDetailHtml, listing)

  assert.deepEqual(job, {
    title: 'Head / Dept Lead',
    company: 'Bharat Fritz Werner',
    department: 'Manufacturing & Methods Engineering',
    location: 'Thally, India',
    city: 'Thally',
    country: 'India',
    jobId: 'bharatfritzwerner-head-dept',
    requisitionId: 'bharatfritzwerner-head-dept',
    sourceUrl: 'https://bfwindia.com/careers/head-dept/',
    applyUrl: 'https://bfwindia.com/careers/head-dept/#apply',
    employmentType: null,
    experienceRequired: '20+ years of experience with at least 5 years in a leadership role within the machine tools industry. | Significant experience in manufacturing, with several years in a leadership role.',
    minimumQualification: 'Bachelor’s or master’s degree in mechanical engineering, Manufacturing/Production/Mechanical Engineering, or a related field.',
    preferredQualification: null,
    requiredSkills: [
      'Expertise in manufacturing methods engineering, process optimization, lean manufacturing principles, and quality management systems.',
      'Excellent leadership, communication, and problem-solving skills.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'Head / Dept Lead',
      'Manufacturing & Methods Engineering',
      'Job responsibilities/description:',
      '- Process development and optimization: Lead the development and implementation of improved manufacturing methods to increase efficiency and reduce waste.',
      '- Team leadership and management: Supervise, mentor, and motivate a team of manufacturing professionals, fostering a culture of safety and continuous improvement.',
      'Job prerequisites:',
      'Education:',
      '- Bachelor’s or master’s degree in mechanical engineering, Manufacturing/Production/Mechanical Engineering, or a related field.',
      'Experience:',
      '- 20+ years of experience with at least 5 years in a leadership role within the machine tools industry.',
      '- Significant experience in manufacturing, with several years in a leadership role.',
      'Key skill required:',
      '- Expertise in manufacturing methods engineering, process optimization, lean manufacturing principles, and quality management systems.',
      '- Excellent leadership, communication, and problem-solving skills.',
    ].join('\n'),
  })
})

test('run validates the verified first-party Bharat Fritz Werner careers flow and returns visible current openings only', async () => {
  const bfw = await loadBharatFritzWernerModule()
  const requestedUrls = []

  const jobs = await bfw.createBharatFritzWernerScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === bfw.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === bfw.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (bfw.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingJobRouteHtml }
      }

      if (detailPageByUrl[url]) {
        return { status: 200, url, html: detailPageByUrl[url] }
      }

      throw new Error(`Unexpected Bharat Fritz Werner URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    bfw.HOMEPAGE_URL,
    bfw.CAREERS_URL,
    ...bfw.NO_PUBLIC_JOB_ROUTE_URLS,
    'https://bfwindia.com/careers/head-of-application-engineering-1/',
    'https://bfwindia.com/careers/head-dept/',
    'https://bfwindia.com/careers/production-planning-and-control/',
    'https://bfwindia.com/careers/supply-chain-management/',
    'https://bfwindia.com/careers/head-of-quality/',
  ])

  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Head / Dept Lead',
      'Head of Application Engineering',
      'Head of Quality',
      'Production Planning and Control (PPC)',
      'Supply Chain Management (SCM)',
    ],
  )

  const supplyChain = jobs.find((job) => job.jobId === 'bharatfritzwerner-supply-chain-management')
  const headDept = jobs.find((job) => job.jobId === 'bharatfritzwerner-head-dept')

  assert.equal(headDept.company, 'Bharat Fritz Werner')
  assert.equal(headDept.location, 'Thally, India')
  assert.equal(headDept.city, 'Thally')
  assert.equal(headDept.country, 'India')
  assert.equal(headDept.source, 'bharatfritzwerner')
  assert.equal(headDept.companyDomain, 'bfwindia.com')
  assert.equal(headDept.atsPlatform, 'official-company-careers')
  assert.equal(headDept.link, 'https://bfwindia.com/careers/head-dept/#apply')
  assert.equal(headDept.scrapedAt, FIXED_SCRAPED_AT)

  assert.equal(supplyChain.department, 'SCM')
  assert.equal(supplyChain.location, 'Thally, India')
  assert.equal(supplyChain.applyUrl, 'https://bfwindia.com/careers/supply-chain-management/#apply')
  assert.equal(supplyChain.scrapedAt, FIXED_SCRAPED_AT)
})

test('Bharat Fritz Werner fails closed when the verified homepage, careers page, missing-route contract, or detail pages drift', async () => {
  const bfw = await loadBharatFritzWernerModule()

  await assert.rejects(
    bfw.createBharatFritzWernerScraper().run({
      fetchPage: async (url) => {
        if (url === bfw.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected Bharat Fritz Werner URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    bfw.createBharatFritzWernerScraper().run({
      fetchPage: async (url) => {
        if (url === bfw.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === bfw.CAREERS_URL) {
          return { status: 200, url, html: careersHtml.replace('Positions open', 'Career stories') }
        }

        throw new Error(`Unexpected Bharat Fritz Werner URL: ${url}`)
      },
    }),
    /careers page/i,
  )

  await assert.rejects(
    bfw.createBharatFritzWernerScraper().run({
      fetchPage: async (url) => {
        if (url === bfw.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === bfw.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === bfw.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: careersHtml }
        }

        if (bfw.NO_PUBLIC_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: missingJobRouteHtml }
        }

        throw new Error(`Unexpected Bharat Fritz Werner URL: ${url}`)
      },
    }),
    /no-public job route/i,
  )

  await assert.rejects(
    bfw.createBharatFritzWernerScraper().run({
      fetchPage: async (url) => {
        if (url === bfw.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === bfw.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (bfw.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingJobRouteHtml }
        }

        if (url === 'https://bfwindia.com/careers/head-of-application-engineering-1/') {
          return { status: 200, url, html: '<html><body><h1>Broken</h1></body></html>' }
        }

        if (detailPageByUrl[url]) {
          return { status: 200, url, html: detailPageByUrl[url] }
        }

        throw new Error(`Unexpected Bharat Fritz Werner URL: ${url}`)
      },
    }),
    /detail page/i,
  )
})
