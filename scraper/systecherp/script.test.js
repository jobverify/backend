import assert from 'node:assert/strict'
import test from 'node:test'

const loadSystechModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>AI-Driven ERP, CRM & HRMS Software India — Systech</title>
  </head>
  <body>
    <main>
      <h1>From New Yarn to New York — Textile ERP Software for Spinning, Weaving, Knitting, Processing, Home Textiles & Apparel</h1>
      <p>The world's most comprehensive textile ERP — purpose-built for Spinning, Weaving, Knitting, Processing, Home Textiles & Apparel.</p>
      <section>
        <h2>Complete ERP Solutions for Every Industry</h2>
        <p>From textile spinning mills to manufacturing plants and wholesale distribution - specialized ERP software designed for your industry's unique workflows.</p>
      </section>
      <section>
        <h2>Why Choose Systech ERP Solutions?</h2>
        <p>Adoptable ERP platform with 30+ years of excellence. Cloud or on-premise deployment, AI-powered insights, and industry-specific features that deliver results from day one.</p>
      </section>
      <footer>
        <a href="/company/careers">Careers</a>
        <p>Enterprise software from India, built for the world. Ultra-modern ERP solutions for manufacturing, distribution, and textile industries across the globe.</p>
        <p>info@systecherp.com</p>
      </footer>
    </main>
  </body>
</html>
`

const careersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers at Systech — ERP Developer & Consulting Jobs in Coimbatore</title>
  </head>
  <body>
    <main>
      <p>We're Hiring</p>
      <h1>Build Software That Runs Real Businesses</h1>
      <p>Join a team of industry veterans and engineers creating ERP solutions for distribution, manufacturing, and textiles.</p>
      <section>
        <h2>Open Positions</h2>
        <p>Find a role that fits your skills and ambitions</p>

        <article class="role-card">
          <h3>Marketing & HR Coordinator</h3>
          <p>Marketing & HR</p>
          <p>Coimbatore Full-time</p>
          <p>Handle marketing, sales follow-ups, and HR support activities. Coordinate with customers, employees, and management — supporting lead generation, recruitment, and internal communication in a friendly, fast-paced environment with exposure to ERP and business operations.</p>
          <ul>
            <li>Good communication skills in English and Tamil (spoken Hindi a plus)</li>
            <li>Marketing & sales: lead generation, follow-up, conversion, and digital campaign support</li>
            <li>HR & admin: recruitment coordination, employee records, attendance, onboarding, office administration</li>
            <li>Positive attitude, ability to multitask and work independently</li>
            <li>Any degree (MBA / BBA / B.Com / BA preferred); freshers welcome, 1–3 years experience a plus</li>
            <li>Female candidates preferred</li>
          </ul>
          <p>Apply Now</p>
          <p>joinus@systecherp.com</p>
        </article>

        <article class="role-card">
          <h3>ERP Implementer — HR & Finance</h3>
          <p>Implementation</p>
          <p>Coimbatore / Client Sites Full-time</p>
          <p>Implement, configure, and support Finance and HR modules of Systech ERP for customers. Conduct user training, run demonstrations, and bridge customer business processes with system configuration. Strong functional knowledge in Finance and/or HR operations with good communication and problem-solving skills.</p>
          <ul>
            <li>Strong knowledge of Finance and/or HR processes — accounting, billing, GST, payroll, attendance, leave</li>
            <li>Configure ERP Finance/HR modules; conduct demos, user training, and onboarding for client teams</li>
            <li>Strong communication, presentation, and analytical thinking</li>
            <li>Willingness to travel to customer sites</li>
            <li>B.Com / M.Com / MBA / BBA / BCA / MCA — knowledge of Tally / HRMS / Payroll software a plus</li>
            <li>1–3 years ERP implementation/support experience preferred; freshers with strong domain knowledge welcome</li>
            <li>Male candidates preferred</li>
          </ul>
          <p>Apply Now</p>
          <p>joinus@systecherp.com</p>
        </article>
      </section>
      <section>
        <h2>Don't See Your Role?</h2>
        <p>We're always looking for talented people. Send us your resume and tell us how you can contribute.</p>
        <p>joinus@systecherp.com</p>
      </section>
    </main>
  </body>
</html>
`

test('Systech ERP scraper verifies the official homepage and extracts the visible first-party jobs', async () => {
  const systech = await loadSystechModule()
  assert.ok(systech, 'Expected Systech ERP scraper module at ./script.js')

  assert.equal(systech.HOMEPAGE_URL, 'https://www.systecherp.com/')
  assert.equal(systech.CAREERS_PAGE_URL, 'https://www.systecherp.com/company/careers')
  assert.equal(systech.JOBS_EMAIL, 'joinus@systecherp.com')
  assert.equal(systech.isOfficialHomepage(homepageHtml), true)
  assert.equal(systech.isOfficialCareersPage(careersHtml), true)

  assert.deepEqual(systech.extractCareerJobs(careersHtml), [
    {
      title: 'Marketing & HR Coordinator',
      company: 'Systech ERP',
      department: 'Marketing & HR',
      location: 'Coimbatore, India',
      city: 'Coimbatore',
      country: 'India',
      jobId: 'marketing-hr-coordinator',
      requisitionId: 'marketing-hr-coordinator',
      sourceUrl: 'https://www.systecherp.com/company/careers#marketing-hr-coordinator',
      applyUrl: 'mailto:joinus@systecherp.com',
      employmentType: 'Full-time',
      experienceRequired: 'Freshers welcome, 1-3 years experience a plus',
      minimumQualification: 'Any degree',
      preferredQualification: 'MBA / BBA / B.Com / BA preferred',
      requiredSkills: [
        'Good communication skills in English and Tamil (spoken Hindi a plus)',
        'Marketing & sales: lead generation, follow-up, conversion, and digital campaign support',
        'HR & admin: recruitment coordination, employee records, attendance, onboarding, office administration',
        'Positive attitude, ability to multitask and work independently',
        'Any degree (MBA / BBA / B.Com / BA preferred); freshers welcome, 1-3 years experience a plus',
        'Female candidates preferred',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Handle marketing, sales follow-ups, and HR support activities. Coordinate with customers, employees, and management — supporting lead generation, recruitment, and internal communication in a friendly, fast-paced environment with exposure to ERP and business operations.\n\nRequirements:\n- Good communication skills in English and Tamil (spoken Hindi a plus)\n- Marketing & sales: lead generation, follow-up, conversion, and digital campaign support\n- HR & admin: recruitment coordination, employee records, attendance, onboarding, office administration\n- Positive attitude, ability to multitask and work independently\n- Any degree (MBA / BBA / B.Com / BA preferred); freshers welcome, 1-3 years experience a plus\n- Female candidates preferred',
      remoteStatus: 'On-site',
    },
    {
      title: 'ERP Implementer — HR & Finance',
      company: 'Systech ERP',
      department: 'Implementation',
      location: 'Coimbatore / Client Sites, India',
      city: 'Coimbatore',
      country: 'India',
      jobId: 'erp-implementer-hr-finance',
      requisitionId: 'erp-implementer-hr-finance',
      sourceUrl: 'https://www.systecherp.com/company/careers#erp-implementer-hr-finance',
      applyUrl: 'mailto:joinus@systecherp.com',
      employmentType: 'Full-time',
      experienceRequired: '1-3 years ERP implementation/support experience preferred; freshers with strong domain knowledge welcome',
      minimumQualification: 'B.Com / M.Com / MBA / BBA / BCA / MCA',
      preferredQualification: 'Knowledge of Tally / HRMS / Payroll software a plus',
      requiredSkills: [
        'Strong knowledge of Finance and/or HR processes — accounting, billing, GST, payroll, attendance, leave',
        'Configure ERP Finance/HR modules; conduct demos, user training, and onboarding for client teams',
        'Strong communication, presentation, and analytical thinking',
        'Willingness to travel to customer sites',
        'B.Com / M.Com / MBA / BBA / BCA / MCA — knowledge of Tally / HRMS / Payroll software a plus',
        '1-3 years ERP implementation/support experience preferred; freshers with strong domain knowledge welcome',
        'Male candidates preferred',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Implement, configure, and support Finance and HR modules of Systech ERP for customers. Conduct user training, run demonstrations, and bridge customer business processes with system configuration. Strong functional knowledge in Finance and/or HR operations with good communication and problem-solving skills.\n\nRequirements:\n- Strong knowledge of Finance and/or HR processes — accounting, billing, GST, payroll, attendance, leave\n- Configure ERP Finance/HR modules; conduct demos, user training, and onboarding for client teams\n- Strong communication, presentation, and analytical thinking\n- Willingness to travel to customer sites\n- B.Com / M.Com / MBA / BBA / BCA / MCA — knowledge of Tally / HRMS / Payroll software a plus\n- 1-3 years ERP implementation/support experience preferred; freshers with strong domain knowledge welcome\n- Male candidates preferred',
      remoteStatus: 'On-site',
    },
  ])
})

test('Systech ERP scraper run fetches the verified official surfaces and adds runner metadata', async () => {
  const systech = await loadSystechModule()
  assert.ok(systech, 'Expected Systech ERP scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await systech.createSystechErpScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === systech.HOMEPAGE_URL) return homepageHtml
      if (url === systech.CAREERS_PAGE_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    systech.HOMEPAGE_URL,
    systech.CAREERS_PAGE_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'systecherp')
  assert.equal(jobs[0].link, 'mailto:joinus@systecherp.com')
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
})

test('Systech ERP scraper fails closed when the verified official surface drifts', async () => {
  const systech = await loadSystechModule()
  assert.ok(systech, 'Expected Systech ERP scraper module at ./script.js')

  await assert.rejects(
    systech.createSystechErpScraper().run({
      fetchText: async (url) => {
        if (url === systech.HOMEPAGE_URL) {
          return '<html><head><title>Placeholder</title></head><body>Coming soon</body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    systech.createSystechErpScraper().run({
      fetchText: async (url) => {
        if (url === systech.HOMEPAGE_URL) return homepageHtml
        if (url === systech.CAREERS_PAGE_URL) {
          return `
            <main>
              <h1>Build Software That Runs Real Businesses</h1>
              <section>
                <h2>Open Positions</h2>
                <article>
                  <h3>Marketing & HR Coordinator</h3>
                  <p>Marketing & HR</p>
                  <p>Coimbatore Full-time</p>
                  <p>Apply via our external ATS.</p>
                </article>
              </section>
            </main>
          `
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official careers page/i,
  )
})
