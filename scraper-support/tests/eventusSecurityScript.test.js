import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>SOC as a Service Provider- Eventus Security</title>
  </head>
  <body>
    <nav>
      <a href="https://eventussecurity.com/">Home</a>
      <a href="https://eventussecurity.com/about-us/">About Us</a>
      <a href="https://eventussecurity.com/careers/">Careers</a>
      <a href="https://eventussecurity.com/contact-us/">Contact Us</a>
    </nav>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Cybersecurity Careers at Eventus - Join Our Mission</title>
    <link rel="canonical" href="https://eventussecurity.com/careers/" />
    <meta property="og:title" content="Cybersecurity Careers at Eventus - Join Our Mission" />
  </head>
  <body>
    <section>
      <h1>Want to build the future in cyber security? Join Our Team.</h1>
      <h2>Current Openings</h2>
      <div class="oxy-dynamic-list">
        <div class="ct-div-block">
          <div class="ct-text-block"><span>Senior Security Engineer</span></div>
          <div class="ct-text-block">Location: <span>Sanpada Office - on site/ Navi Mumbai</span></div>
          <div class="ct-text-block">Experience:&nbsp;<span>3-5 years</span></div>
          <a class="ct-link-text" href="https://eventussecurity.com/careers/senior-security-engineer/">Learn More</a>
        </div>
        <div class="ct-div-block">
          <div class="ct-text-block"><span>Strategic Account Manager</span></div>
          <div class="ct-text-block">Location: <span>Navi Mumbai</span></div>
          <div class="ct-text-block">Experience:&nbsp;<span>7+ years</span></div>
          <a class="ct-link-text" href="https://eventussecurity.com/careers/strategic-account-manager/">Learn More</a>
        </div>
        <div class="ct-div-block">
          <div class="ct-text-block"><span>Solution Engineer (MDR)</span></div>
          <div class="ct-text-block">Location: <span>Dubai, UAE</span></div>
          <div class="ct-text-block">Experience:&nbsp;<span>4-6 Years</span></div>
          <a class="ct-link-text" href="https://eventussecurity.com/careers/solution-engineer-mdr/">Learn More</a>
        </div>
      </div>
    </section>
  </body>
</html>
`

const strategicAccountManagerDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Strategic Account Manager - Eventus Security</title>
    <link rel="canonical" href="https://eventussecurity.com/careers/strategic-account-manager/" />
  </head>
  <body>
    <section>
      <h3><span>Strategic Account Manager</span></h3>
      <div class="career-side-head">Location</div>
      <div class="career-side-details"><span>Navi Mumbai</span></div>
      <div class="career-side-head">Experience</div>
      <div class="career-side-details"><span>7+ years</span></div>
      <div class="ct-text-block">Job Description</div>
      <div class="ct-text-block">
        <span class="oxy-stock-content-styles">
          <p>Location:Navi Mumbai</p>
          <p>Department: Sales</p>
          <p><strong>Requirements </strong></p>
          <ul>
            <li>Manage and grow assigned strategic enterprise accounts.</li>
            <li>Build long-term relationships with CISOs, CIOs, and IT leadership.</li>
          </ul>
        </span>
      </div>
      <a
        class="ct-link carrer-button-style career-modal-trigger"
        href="https://eventustechsol.zohorecruit.in/forms/234cd2dce76f704db02335da982b9fcfc73ec6fc2a1397622b31133ec570d8a3"
      >
        <div class="ct-text-block">Apply Now</div>
      </a>
    </section>
  </body>
</html>
`

const seniorSecurityEngineerDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Senior Security Engineer - Eventus Security</title>
    <link rel="canonical" href="https://eventussecurity.com/careers/senior-security-engineer/" />
  </head>
  <body>
    <section>
      <h3><span>Senior Security Engineer</span></h3>
      <div class="career-side-head">Location</div>
      <div class="career-side-details"><span>Sanpada Office - on site/ Navi Mumbai</span></div>
      <div class="career-side-head">Experience</div>
      <div class="career-side-details"><span>3-5 years</span></div>
      <div class="ct-text-block">Job Description</div>
      <div class="ct-text-block">
        <span class="oxy-stock-content-styles">
          <p>Location: Sanpada Office - on site/ Navi Mumbai</p>
          <p>Department: Security Engineering</p>
          <ul>
            <li>Support enterprise security operations for managed accounts.</li>
            <li>Coordinate incident triage with the SOC team.</li>
          </ul>
        </span>
      </div>
      <a
        class="ct-link carrer-button-style career-modal-trigger"
        href="https://eventustechsol.zohorecruit.in/forms/93dc68b9d52afc87e53ea8908b07abf5e7c8267ff0ce16ed99696fe2b09dfeef"
      >
        <div class="ct-text-block">Apply Now</div>
      </a>
    </section>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/eventussecurity/script.js')
  } catch {
    assert.fail('Expected Eventus Security scraper module at ../../scraper/eventussecurity/script.js')
  }
}

test('Eventus Security helpers stay pinned to the verified homepage, careers page, and detail page contract', async () => {
  const eventus = await loadModule()

  assert.equal(eventus.SOURCE, 'eventussecurity')
  assert.equal(eventus.COMPANY, 'Eventus Security')
  assert.equal(eventus.OFFICIAL_BRAND_NAME, 'Eventus Security')
  assert.equal(eventus.HOMEPAGE_URL, 'https://eventussecurity.com/')
  assert.equal(eventus.CAREERS_URL, 'https://eventussecurity.com/careers/')
  assert.equal(eventus.CANONICAL_CAREERS_URL, 'https://eventussecurity.com/careers/')
  assert.equal(eventus.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(eventus.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(eventus.hasOfficialJobDetailSignal(strategicAccountManagerDetailHtml), true)
})

test('Eventus Security extracts only India listings from the verified current openings page', async () => {
  const eventus = await loadModule()

  assert.deepEqual(eventus.extractListings(careersHtml), [
    {
      title: 'Senior Security Engineer',
      company: 'Eventus Security',
      department: null,
      location: 'Sanpada Office - on site/ Navi Mumbai, India',
      city: 'Sanpada',
      country: 'India',
      jobId: 'senior-security-engineer',
      requisitionId: 'senior-security-engineer',
      sourceUrl: 'https://eventussecurity.com/careers/senior-security-engineer/',
      applyUrl: 'https://eventussecurity.com/careers/senior-security-engineer/',
      employmentType: null,
      experienceRequired: '3-5 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Strategic Account Manager',
      company: 'Eventus Security',
      department: null,
      location: 'Navi Mumbai, India',
      city: 'Navi Mumbai',
      country: 'India',
      jobId: 'strategic-account-manager',
      requisitionId: 'strategic-account-manager',
      sourceUrl: 'https://eventussecurity.com/careers/strategic-account-manager/',
      applyUrl: 'https://eventussecurity.com/careers/strategic-account-manager/',
      employmentType: null,
      experienceRequired: '7+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])
})

test('Eventus Security extracts detail-page apply handoff and job description from first-party role pages', async () => {
  const eventus = await loadModule()
  const listing = eventus.extractListings(careersHtml)[1]

  assert.deepEqual(eventus.extractJobDetail(strategicAccountManagerDetailHtml, listing), {
    title: 'Strategic Account Manager',
    company: 'Eventus Security',
    department: 'Sales',
    location: 'Navi Mumbai, India',
    city: 'Navi Mumbai',
    country: 'India',
    jobId: 'strategic-account-manager',
    requisitionId: 'strategic-account-manager',
    sourceUrl: 'https://eventussecurity.com/careers/strategic-account-manager/',
    applyUrl: 'https://eventustechsol.zohorecruit.in/forms/234cd2dce76f704db02335da982b9fcfc73ec6fc2a1397622b31133ec570d8a3',
    employmentType: null,
    experienceRequired: '7+ years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Location: Navi Mumbai Department: Sales Requirements Manage and grow assigned strategic enterprise accounts. Build long-term relationships with CISOs, CIOs, and IT leadership.',
    remoteStatus: 'On-site',
  })
})

test('run verifies the first-party homepage, current openings page, and job detail pages before returning India jobs', async () => {
  const eventus = await loadModule()
  const requestedUrls = []

  const jobs = await eventus.createEventusSecurityScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === eventus.HOMEPAGE_URL) return homepageHtml
      if (url === eventus.CAREERS_URL) return careersHtml
      if (url === 'https://eventussecurity.com/careers/senior-security-engineer/') {
        return seniorSecurityEngineerDetailHtml
      }
      if (url === 'https://eventussecurity.com/careers/strategic-account-manager/') {
        return strategicAccountManagerDetailHtml
      }

      throw new Error(`Unexpected Eventus Security URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://eventussecurity.com/',
    'https://eventussecurity.com/careers/',
    'https://eventussecurity.com/careers/senior-security-engineer/',
    'https://eventussecurity.com/careers/strategic-account-manager/',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Senior Security Engineer',
      company: 'Eventus Security',
      department: 'Security Engineering',
      location: 'Sanpada Office - on site/ Navi Mumbai, India',
      city: 'Sanpada',
      country: 'India',
      jobId: 'senior-security-engineer',
      requisitionId: 'senior-security-engineer',
      sourceUrl: 'https://eventussecurity.com/careers/senior-security-engineer/',
      applyUrl: 'https://eventustechsol.zohorecruit.in/forms/93dc68b9d52afc87e53ea8908b07abf5e7c8267ff0ce16ed99696fe2b09dfeef',
      employmentType: null,
      experienceRequired: '3-5 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Location: Sanpada Office - on site/ Navi Mumbai Department: Security Engineering Support enterprise security operations for managed accounts. Coordinate incident triage with the SOC team.',
      remoteStatus: 'On-site',
      source: 'eventussecurity',
      link: 'https://eventustechsol.zohorecruit.in/forms/93dc68b9d52afc87e53ea8908b07abf5e7c8267ff0ce16ed99696fe2b09dfeef',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Strategic Account Manager',
      company: 'Eventus Security',
      department: 'Sales',
      location: 'Navi Mumbai, India',
      city: 'Navi Mumbai',
      country: 'India',
      jobId: 'strategic-account-manager',
      requisitionId: 'strategic-account-manager',
      sourceUrl: 'https://eventussecurity.com/careers/strategic-account-manager/',
      applyUrl: 'https://eventustechsol.zohorecruit.in/forms/234cd2dce76f704db02335da982b9fcfc73ec6fc2a1397622b31133ec570d8a3',
      employmentType: null,
      experienceRequired: '7+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Location: Navi Mumbai Department: Sales Requirements Manage and grow assigned strategic enterprise accounts. Build long-term relationships with CISOs, CIOs, and IT leadership.',
      remoteStatus: 'On-site',
      source: 'eventussecurity',
      link: 'https://eventustechsol.zohorecruit.in/forms/234cd2dce76f704db02335da982b9fcfc73ec6fc2a1397622b31133ec570d8a3',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Eventus Security fails closed when the verified careers or detail-page contract drifts', async () => {
  const eventus = await loadModule()

  await assert.rejects(
    eventus.createEventusSecurityScraper().run({
      fetchText: async (url) => {
        if (url === eventus.HOMEPAGE_URL) return homepageHtml
        return careersHtml.replace('Current Openings', 'Open Roles')
      },
    }),
    /verified first-party careers surface/i,
  )

  await assert.rejects(
    eventus.createEventusSecurityScraper().run({
      fetchText: async (url) => {
        if (url === eventus.HOMEPAGE_URL) return homepageHtml
        if (url === eventus.CAREERS_URL) return careersHtml
        return '<html><body><h1>Unexpected page</h1></body></html>'
      },
    }),
    /verified first-party job detail surface/i,
  )
})
