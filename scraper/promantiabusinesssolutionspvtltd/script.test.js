import assert from 'node:assert/strict'
import test from 'node:test'

const loadPromantiaModule = async () => import('./script.js')

const careersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Career - Promantia Business Solutions Pvt. Ltd.</title>
    <link rel="canonical" href="https://promantia.in/career/" />
  </head>
  <body>
    <main>
      <p>
        Do you enjoy working outside your comfort zone ? Are you passionate about quality ?
        Do you enjoy working in a consulting environment ? If you do, please get in touch with us at
        <a href="mailto:careers@promantia.com">careers@promantia.com</a>
      </p>
      <p>The following are the positions for which we are currently recruiting.</p>
      <div class="career-box">
        <p><strong>ERP Implementation Manager</strong></p>
        <p>We are looking for an ERP Implementation Manager with about 5+ years experience to analyse, plan and drive ERP implementations.</p>
        <p style="text-align: right;"><a href="https://promantia.in/erp-implementation-manager/">For more details</a></p>
      </div>
      <div class="career-box">
        <p><strong>Functional Consultant</strong></p>
        <p>Functional Consultant understands and communicates the functional aspects of client projects, providing expert guidance on product and system implementation.</p>
        <p style="text-align: right;"><a href="https://promantia.in/functional-consultant-2026/">For more details</a></p>
      </div>
      <div class="career-box">
        <p><strong>ERP Coordinator</strong></p>
        <p>We are looking for a skilled and proactive ERP Coordinator to front-end our engagement for a manufacturing customer. This role will be based in NCR and will require coordinating with technical and business stakeholders and managing delivery.</p>
        <p style="text-align: right;"><a href="https://promantia.in/erp-coordinator">For more details</a></p>
      </div>
      <div class="career-box">
        <p><strong>Senior Business Development Executive</strong></p>
        <p>Responsible for lead generation, lead development, conversion, and overall pipeline management for a target customer profile.</p>
        <p style="text-align: right;"><a href="https://promantia.in/senior-business-development-executive/">For more details</a></p>
      </div>
      <div class="sgpb-main-popup-data-container-1251">
        <form action="/career/#wpcf7-f1254-o1" class="wpcf7-form">
          <input type="hidden" name="page-title" value="Career" />
          <input type="file" name="resume" />
          <input type="submit" value="SUBMIT" />
        </form>
      </div>
    </main>
  </body>
</html>
`

const erpImplementationManagerHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>ERPImplementation Manager - Promantia Business Solutions Pvt. Ltd.</title>
    <link rel="canonical" href="https://promantia.in/erp-implementation-manager/" />
  </head>
  <body>
    <article>
      <h1 class="entry-title">ERPImplementation Manager</h1>
      <div class="entry-content">
        <p><strong><span style="font-size: xx-large;">ERP Implementation Manager</span></strong></p>
        <p><strong>Location:</strong> Work from office at Bangalore and may entail travel to other locations in India.</p>
        <p><strong>Job Overview:</strong></p>
        <p>We are looking for an ERP Implementation Manager with about 5+ years experience to analyse, plan and drive the implementation of the Enterprise Resource Planning (ERP) solution using Open Source products like Etendo/OpenBravo/ERP Next/etc or Microsoft Dynamics.</p>
        <p><strong>Responsibilities:</strong></p>
        <ul>
          <li>Manage the project plan and delivery metrics.</li>
          <li>Coordinate scope, execution, control, and closure.</li>
        </ul>
        <p><b>How to Apply:</b></p>
        <p>Interested candidates can send their resume to <a href="careers@promantia.com">careers@promantia.com</a></p>
        <p><a class="maxbutton-1 maxbutton maxbutton-apply sg-popup-id-1251" href="javascript:void(0);"><span class='mb-text'>APPLY NOW</span></a></p>
      </div>
    </article>
    <div class="sgpb-main-popup-data-container-1251">
      <form class="wpcf7-form">
        <input type="hidden" name="page-title" value="ERP Implementation Manager" />
      </form>
    </div>
  </body>
</html>
`

const functionalConsultantHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Functional Consultant-2026 - Promantia Business Solutions Pvt. Ltd.</title>
    <link rel="canonical" href="https://promantia.in/functional-consultant-2026/" />
  </head>
  <body>
    <article>
      <h1 class="entry-title">Functional Consultant-2026</h1>
      <div class="entry-content">
        <p><span style="font-size: xx-large;"><b>Functional Consultant</b></span></p>
        <p><b>Job Title:</b> Functional Consultant<br /><b>Location:</b> Bangalore</p>
        <p><b>Job Overview:</b></p>
        <p>Functional Consultant understands and communicates the functional aspects of client projects, providing expert guidance on product and system implementation.</p>
        <p><b>Key responsibilities:</b></p>
        <ul>
          <li>Collaborate with business users and technical teams.</li>
        </ul>
        <p><a class="maxbutton-1 maxbutton maxbutton-apply sg-popup-id-1251" href="javascript:void(0);"><span class='mb-text'>APPLY NOW</span></a></p>
      </div>
    </article>
    <div class="sgpb-main-popup-data-container-1251">
      <form class="wpcf7-form">
        <input type="hidden" name="page-title" value="Functional Consultant-2026" />
      </form>
    </div>
  </body>
</html>
`

const seniorBusinessDevelopmentExecutiveHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Senior Business Development Executive - Promantia Business Solutions Pvt. Ltd.</title>
    <link rel="canonical" href="https://promantia.in/senior-business-development-executive/" />
  </head>
  <body>
    <article>
      <h1 class="entry-title">Senior Business Development Executive</h1>
      <div class="entry-content">
        <p><span style="font-size: xx-large;"><b>Senior Business Development Executive</b></span></p>
        <p><b>Job Title:</b> Senior Business Development Executive - ERP Sales<br /><b>Location:</b> Bangalore</p>
        <p><b>Job Summary:</b></p>
        <p>Responsible for lead generation, lead development, conversion, and overall pipeline management for a target customer profile.</p>
        <p><b>Experience:</b> 2-4 years of experience in B2B Enterprise Software Sales (preferably ERP)</p>
        <p><a class="maxbutton-1 maxbutton maxbutton-apply sg-popup-id-1251" href="javascript:void(0);"><span class='mb-text'>APPLY NOW</span></a></p>
      </div>
    </article>
    <div class="sgpb-main-popup-data-container-1251">
      <form class="wpcf7-form">
        <input type="hidden" name="page-title" value="Senior Business Development Executive" />
      </form>
    </div>
  </body>
</html>
`

test('extractListings reads Promantia public role blocks from the verified careers page', async () => {
  const promantia = await loadPromantiaModule()

  assert.equal(promantia.SOURCE, 'promantiabusinesssolutionspvtltd')
  assert.equal(promantia.COMPANY, 'PROMANTIA Business Solutions Pvt. Ltd.')
  assert.equal(promantia.CAREERS_URL, 'https://promantia.in/career/')
  assert.equal(promantia.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(promantia.extractListings(careersHtml), [
    {
      title: 'ERP Implementation Manager',
      summary: 'We are looking for an ERP Implementation Manager with about 5+ years experience to analyse, plan and drive ERP implementations.',
      sourceUrl: 'https://promantia.in/erp-implementation-manager/',
      applyUrl: 'https://promantia.in/erp-implementation-manager/',
      jobId: 'promantiabusinesssolutionspvtltd-erp-implementation-manager',
      requisitionId: 'promantiabusinesssolutionspvtltd-erp-implementation-manager',
    },
    {
      title: 'Functional Consultant',
      summary: 'Functional Consultant understands and communicates the functional aspects of client projects, providing expert guidance on product and system implementation.',
      sourceUrl: 'https://promantia.in/functional-consultant-2026/',
      applyUrl: 'https://promantia.in/functional-consultant-2026/',
      jobId: 'promantiabusinesssolutionspvtltd-functional-consultant-2026',
      requisitionId: 'promantiabusinesssolutionspvtltd-functional-consultant-2026',
    },
    {
      title: 'ERP Coordinator',
      summary: 'We are looking for a skilled and proactive ERP Coordinator to front-end our engagement for a manufacturing customer. This role will be based in NCR and will require coordinating with technical and business stakeholders and managing delivery.',
      sourceUrl: 'https://promantia.in/erp-coordinator',
      applyUrl: 'https://promantia.in/erp-coordinator',
      jobId: 'promantiabusinesssolutionspvtltd-erp-coordinator',
      requisitionId: 'promantiabusinesssolutionspvtltd-erp-coordinator',
    },
    {
      title: 'Senior Business Development Executive',
      summary: 'Responsible for lead generation, lead development, conversion, and overall pipeline management for a target customer profile.',
      sourceUrl: 'https://promantia.in/senior-business-development-executive/',
      applyUrl: 'https://promantia.in/senior-business-development-executive/',
      jobId: 'promantiabusinesssolutionspvtltd-senior-business-development-executive',
      requisitionId: 'promantiabusinesssolutionspvtltd-senior-business-development-executive',
    },
  ])
})

test('extractJobDetail keeps the verified Promantia ERP Implementation detail page anchored to the public apply surface', async () => {
  const promantia = await loadPromantiaModule()
  const listing = promantia.extractListings(careersHtml)[0]
  const detail = promantia.extractJobDetail(erpImplementationManagerHtml, listing)

  assert.equal(detail.title, 'ERP Implementation Manager')
  assert.equal(detail.location, 'Bangalore, India')
  assert.equal(detail.city, 'Bangalore')
  assert.equal(detail.experienceRequired, '5+ years')
  assert.equal(detail.applyUrl, listing.sourceUrl)
  assert.match(detail.jobDescription, /Enterprise Resource Planning/i)
  assert.match(detail.jobDescription, /Responsibilities:/i)
})

test('extractJobDetail falls back to the listing summary when a Promantia detail URL resolves to the wrong role page', async () => {
  const promantia = await loadPromantiaModule()
  const listing = promantia.extractListings(careersHtml)[2]
  const detail = promantia.extractJobDetail(functionalConsultantHtml, listing)

  assert.equal(detail.title, 'ERP Coordinator')
  assert.equal(detail.location, 'NCR, India')
  assert.equal(detail.city, null)
  assert.equal(detail.experienceRequired, null)
  assert.equal(detail.applyUrl, listing.sourceUrl)
  assert.match(detail.jobDescription, /manufacturing customer/i)
})

test('run fetches the Promantia careers page and enriches each public role with the best matching first-party detail page', async () => {
  const promantia = await loadPromantiaModule()
  const requestedUrls = []

  const jobs = await promantia.createPromantiaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === promantia.CAREERS_URL) return careersHtml
      if (url === 'https://promantia.in/erp-implementation-manager/') return erpImplementationManagerHtml
      if (url === 'https://promantia.in/functional-consultant-2026/') return functionalConsultantHtml
      if (url === 'https://promantia.in/erp-coordinator') return functionalConsultantHtml
      if (url === 'https://promantia.in/senior-business-development-executive/') {
        return seniorBusinessDevelopmentExecutiveHtml
      }
      throw new Error(`Unexpected Promantia fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    promantia.CAREERS_URL,
    'https://promantia.in/erp-implementation-manager/',
    'https://promantia.in/functional-consultant-2026/',
    'https://promantia.in/erp-coordinator',
    'https://promantia.in/senior-business-development-executive/',
  ])
  assert.equal(jobs.length, 4)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      company: job.company,
      source: job.source,
      link: job.link,
      location: job.location,
    })),
    [
      {
        title: 'ERP Implementation Manager',
        company: 'PROMANTIA Business Solutions Pvt. Ltd.',
        source: 'promantiabusinesssolutionspvtltd',
        link: 'https://promantia.in/erp-implementation-manager/',
        location: 'Bangalore, India',
      },
      {
        title: 'Functional Consultant',
        company: 'PROMANTIA Business Solutions Pvt. Ltd.',
        source: 'promantiabusinesssolutionspvtltd',
        link: 'https://promantia.in/functional-consultant-2026/',
        location: 'Bangalore, India',
      },
      {
        title: 'ERP Coordinator',
        company: 'PROMANTIA Business Solutions Pvt. Ltd.',
        source: 'promantiabusinesssolutionspvtltd',
        link: 'https://promantia.in/erp-coordinator',
        location: 'NCR, India',
      },
      {
        title: 'Senior Business Development Executive',
        company: 'PROMANTIA Business Solutions Pvt. Ltd.',
        source: 'promantiabusinesssolutionspvtltd',
        link: 'https://promantia.in/senior-business-development-executive/',
        location: 'Bangalore, India',
      },
    ],
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('run keeps the ERP Coordinator listing when its first-party detail URL returns 404', async () => {
  const promantia = await loadPromantiaModule()

  const jobs = await promantia.createPromantiaScraper().run({
    fetchText: async (url) => {
      if (url === promantia.CAREERS_URL) return careersHtml
      if (url === 'https://promantia.in/erp-implementation-manager/') return erpImplementationManagerHtml
      if (url === 'https://promantia.in/functional-consultant-2026/') return functionalConsultantHtml
      if (url === 'https://promantia.in/erp-coordinator') {
        throw new Error('HTTP 404 for https://promantia.in/erp-coordinator')
      }
      if (url === 'https://promantia.in/senior-business-development-executive/') {
        return seniorBusinessDevelopmentExecutiveHtml
      }
      throw new Error(`Unexpected Promantia fixture URL: ${url}`)
    },
  })

  const erpCoordinator = jobs.find((job) => job.title === 'ERP Coordinator')
  assert.ok(erpCoordinator)
  assert.equal(erpCoordinator.location, 'NCR, India')
  assert.equal(erpCoordinator.link, 'https://promantia.in/erp-coordinator')
  assert.match(erpCoordinator.jobDescription, /manufacturing customer/i)
})
