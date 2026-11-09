import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected UAW Technologies India Private Limited (UANDWE) scraper module at ./script.js')
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>UANDWE</title>
    </head>
    <body>
      <nav>
        <a href="/">Home</a>
        <a href="/services.html">Services</a>
        <a href="/careers.html">Careers</a>
        <a href="/contact.html">Contact</a>
      </nav>

      <section>
        <h2>Find Out More About Our Company</h2>
        <ul>
          <li>Headquartered in Bay area CA , with its India subsidiary as UANDWE Technologies India Pvt Ltd, Bangalore</li>
          <li>UANDWE is a Product and Service based company. Customer centricity and satisfaction is our primary goal</li>
          <li>We are experts in NPI Design, DFx, Cloud Computing, Software Development and Staffing.</li>
        </ul>
      </section>

      <section>
        <h3>Contact Us</h3>
        <p>UANDWE Technologies India Pvt Limited</p>
        <p>Ground floor, Novel MSR Building, Marathahalli, Bengaluru, Karnataka-560037</p>
        <p>contact@uandwe.com</p>
      </section>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head>
      <title>UANDWE</title>
      <meta property="og:title" content="UANDWE Careers" />
    </head>
    <body>
      <section>
        <h1>Current Job Openings</h1>

        <article class="job-opening">
          <h5>Memory Layout Design Engineer</h5>
          <p>Bangalore, India</p>
          <p>Full Time</p>
          <p>Apply Now Job Description</p>
          <div>Application Form</div>
          <p>Clicking on the 'Next' button will open your default mail app. Kindly attach your resume before sending the mail.</p>
          <p>In case of absence of / faulty mail app please mail 'recruit@uandwe.com' with the necessary details and enclosed resume.</p>
          <p>Next</p>
          <h2>Job Description</h2>
          <h3>Location: Bangalore, India</h3>
          <h3>Job Responsibilities:</h3>
          <ul>
            <li>Layout Design of SRAM/CAM/RF compiler memories in 5/3FF technology.</li>
            <li>Development of key building blocks of memory architecture such as Row Decoder, IO, Control.</li>
          </ul>
          <h3>Qualifications:</h3>
          <ul>
            <li>Bachelor's degree or higher in Computer Science or a related field.</li>
            <li>3 - 10 years of experience.</li>
          </ul>
        </article>

        <article class="job-opening">
          <h5>Tech Writer</h5>
          <p>Bangalore/Chennai/Hyderabad, India</p>
          <p>Full Time</p>
          <p>Apply Now Job Description</p>
          <div>Application Form</div>
          <p>Clicking on the 'Next' button will open your default mail app. Kindly attach your resume before sending the mail.</p>
          <p>In case of absence of / faulty mail app please mail 'recruit@uandwe.com' with the necessary details and enclosed resume.</p>
          <p>Next</p>
          <h2>Job Description</h2>
          <h3>Location: Bangalore/Chennai/Hyderabad, India</h3>
          <h3>Key Skills:</h3>
          <ul>
            <li>Strong ability to read and understand legal and technical documents.</li>
            <li>Basic knowledge of scripting or automation tools to help with data tasks.</li>
          </ul>
          <h3>Qualification:</h3>
          <ul>
            <li>Bachelors or Masters in Electronics Engineering</li>
          </ul>
        </article>

        <article class="job-opening">
          <h5>Design Verification (DV) Engineer - Mixed-Signal SoC</h5>
          <p>Bangalore, India</p>
          <p>Full Time</p>
          <p>Experience: 5-12 years</p>
          <p>Apply Now Job Description</p>
          <div>Application Form</div>
          <p>Clicking on the 'Next' button will open your default mail app. Kindly attach your resume before sending the mail.</p>
          <p>In case of absence of / faulty mail app please mail 'recruit@uandwe.com' with the necessary details and enclosed resume.</p>
          <p>Next</p>
          <h2>Job Description</h2>
          <h3>Location: Bangalore, India</h3>
          <h3>Experience: 5-12 years</h3>
          <h3>Role Overview</h3>
          <p>Skyworks is seeking a Design Verification Engineer to ensure functional correctness and robustness of mixed-signal SoC subsystems.</p>
          <h3>Required Qualifications</h3>
          <ul>
            <li>5-12 years of DV experience in SoC/subsystem verification</li>
            <li>Strong expertise in System Verilog and UVM</li>
          </ul>
        </article>
      </section>
    </body>
  </html>
`

test('UANDWE scraper recognizes the verified official homepage and careers surfaces', async () => {
  const uandwe = await loadModule()

  assert.equal(uandwe.SOURCE, 'uawtechnologiesindiaprivatelimiteduandwe')
  assert.equal(uandwe.COMPANY, 'UAW Technologies India Private Limited (UANDWE)')
  assert.equal(uandwe.HOMEPAGE_URL, 'https://uandwe.com/')
  assert.equal(uandwe.CAREERS_URL, 'https://uandwe.com/careers.html')
  assert.equal(uandwe.APPLY_EMAIL, 'recruit@uandwe.com')
  assert.equal(uandwe.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(uandwe.hasOfficialCareersSignal(careersHtml), true)
})

test('UANDWE scraper extracts verified public openings from the first-party careers page', async () => {
  const uandwe = await loadModule()

  const jobs = uandwe.extractPublicJobs(careersHtml)

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Memory Layout Design Engineer',
    company: 'UAW Technologies India Private Limited (UANDWE)',
    department: null,
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'uawtechnologiesindiaprivatelimiteduandwe-memory-layout-design-engineer',
    requisitionId: null,
    sourceUrl: 'https://uandwe.com/careers.html#uawtechnologiesindiaprivatelimiteduandwe-memory-layout-design-engineer',
    applyUrl: 'mailto:recruit@uandwe.com',
    employmentType: 'Full Time',
    experienceRequired: '3 - 10 years of experience.',
    minimumQualification: "Bachelor's degree or higher in Computer Science or a related field.",
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Layout Design of SRAM/CAM/RF compiler memories in 5/3FF technology. Development of key building blocks of memory architecture such as Row Decoder, IO, Control.',
    remoteStatus: null,
  })

  assert.deepEqual(
    jobs.map((job) => [job.title, job.city, job.employmentType]),
    [
      ['Memory Layout Design Engineer', 'Bangalore', 'Full Time'],
      ['Tech Writer', 'Bangalore', 'Full Time'],
      ['Design Verification (DV) Engineer - Mixed-Signal SoC', 'Bangalore', 'Full Time'],
    ],
  )

  assert.equal(jobs[1].location, 'Bangalore/Chennai/Hyderabad, India')
  assert.equal(jobs[1].minimumQualification, 'Bachelors or Masters in Electronics Engineering')
  assert.match(jobs[1].jobDescription, /Strong ability to read and understand legal and technical documents/i)
  assert.equal(jobs[2].experienceRequired, '5-12 years')
  assert.match(jobs[2].jobDescription, /Skyworks is seeking a Design Verification Engineer/i)
  assert.equal(jobs[2].applyUrl, 'mailto:recruit@uandwe.com')
})

test('UANDWE scraper ignores decorative region headings from the current careers page', async () => {
  const uandwe = await loadModule()
  const careersHtmlWithRegionHeading = careersHtml.replace(
    '<h1>Current Job Openings</h1>',
    `<h1>Current Job Openings</h1>
        <h5><span><span style="color: orange;">India </span>Region</span> <span><img src="https://images.emojiterra.com/twitter/v14.0/128px/1f1ee-1f1f3.png" class="flag" alt="India Flag"></span></h5>
        <h5><span><span style="color: orange;">USA </span>Region</span> <span><img src="https://images.emojiterra.com/twitter/v14.0/128px/1f1fa-1f1f8.png" class="flag" alt="USA Flag"></span></h5>`,
  )

  const jobs = uandwe.extractPublicJobs(careersHtmlWithRegionHeading)

  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Memory Layout Design Engineer',
      'Tech Writer',
      'Design Verification (DV) Engineer - Mixed-Signal SoC',
    ],
  )
})

test('UANDWE scraper skips non-India openings before validating India job details', async () => {
  const uandwe = await loadModule()
  const careersHtmlWithChinaRole = careersHtml.replace(
    '<article class="job-opening">',
    `<article class="job-opening">
          <h5>Post-silicon Validation Engineer</h5>
          <p>Shanghai, China</p>
          <p>Full Time</p>
          <p>Apply Now Job Description</p>
          <div>Application Form</div>
          <p>Clicking on the 'Next' button will open your default mail app. Kindly attach your resume before sending the mail.</p>
          <p>In case of absence of / faulty mail app please mail 'recruit@uandwe.com' with the necessary details and enclosed resume.</p>
          <p>Next</p>
          <h2>Job Description</h2>
          <h3>Location: Shanghai, China</h3>
          <h3>Job Responsibilities:</h3>
          <ul>
            <li>Support post-silicon bring up and validation.</li>
          </ul>
        </article>

        <article class="job-opening">`,
  )

  const jobs = uandwe.extractPublicJobs(careersHtmlWithChinaRole)

  assert.equal(jobs.length, 3)
  assert.equal(jobs.some((job) => /Post-silicon/i.test(job.title)), false)
})

test('UANDWE scraper runs end to end and fails closed on surface drift', async () => {
  const uandwe = await loadModule()
  const requestedUrls = []

  const jobs = await uandwe.createUawTechnologiesIndiaPrivateLimitedUandweScraper({
    now: () => '2026-07-13T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === uandwe.HOMEPAGE_URL) return homepageHtml
      if (url === uandwe.CAREERS_URL) return careersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [uandwe.HOMEPAGE_URL, uandwe.CAREERS_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, uandwe.SOURCE)
  assert.equal(jobs[0].link, 'mailto:recruit@uandwe.com')
  assert.equal(jobs[0].companyCareerPage, uandwe.CAREERS_URL)
  assert.equal(jobs[0].companyDomain, 'uandwe.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].scrapedAt, '2026-07-13T00:00:00.000Z')

  await assert.rejects(
    uandwe.createUawTechnologiesIndiaPrivateLimitedUandweScraper().run({
      fetchText: async (url) => {
        if (url === uandwe.HOMEPAGE_URL) {
          return '<html><body><h1>Placeholder</h1></body></html>'
        }

        return careersHtml
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    uandwe.createUawTechnologiesIndiaPrivateLimitedUandweScraper().run({
      fetchText: async (url) => {
        if (url === uandwe.HOMEPAGE_URL) return homepageHtml
        if (url === uandwe.CAREERS_URL) {
          return careersHtml.replace('Current Job Openings', 'Join Us')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page|public openings/i,
  )
})
