import assert from 'node:assert/strict'
import test from 'node:test'

const loadSimplifyHealthcareModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const currentOpeningsHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Current Openings | Simplify Healthcare</title>
    <link rel="canonical" href="https://simplifyhealthcare.com/careers/current-openings/">
  </head>
  <body>
    <main>
      <h1>New Thinking. New Opportunities.</h1>
      <p>Simplify Healthcare is always looking to expand our team with versatile professionals. Become a part of the Simplify team today.</p>
      <p>Flexi Hybrid work model</p>

      <article>
        <h2>Project Manager</h2>
        <p>Jun 22, 2026</p>
        <a href="https://simplifyhealthcare.com/careers/current-openings/india/project-manager-2/">Apply Now</a>
      </article>

      <article>
        <h2>Product Manager</h2>
        <p>Jun 12, 2026</p>
        <a href="/careers/current-openings/india/product-manager/">Apply Now</a>
      </article>

      <article>
        <h2>Product Manager, Provider</h2>
        <p>Jun 12, 2026</p>
        <a href="/careers/current-openings/aurora-u-s/product-manager-provider1/">Apply Now</a>
      </article>
    </main>
  </body>
</html>
`

const indiaArchiveHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Current Openings | Simplify Healthcare</title>
    <link rel="canonical" href="https://simplifyhealthcare.com/careers/current-openings/">
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <p>New Thinking. New Opportunities.</p>

      <article>
        <h2>Product Marketing Lead</h2>
        <p>Apr 10, 2026</p>
        <a href="https://simplifyhealthcare.com/careers/current-openings/india/product-marketing-lead/">Apply Now</a>
      </article>

      <article>
        <h2>Project Manager</h2>
        <p>Jun 22, 2026</p>
        <a href="https://simplifyhealthcare.com/careers/current-openings/india/project-manager-2/">Apply Now</a>
      </article>
    </main>
  </body>
</html>
`

const projectManagerHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Project Manager | Simplify Healthcare</title>
    <link rel="canonical" href="https://simplifyhealthcare.com/careers/current-openings/india/project-manager-2/">
  </head>
  <body>
    <main>
      <nav>Home Careers Current Openings India</nav>
      <h1>Project Manager</h1>
      <p>Jun 22, 2026 Pune, India</p>
      <h2>About Simplify Healthcare</h2>
      <p>Simplify Healthcare is one of the fastest growing healthcare technology solutions providers to the payer market.</p>
      <h2>Role Overview</h2>
      <p>Lead cross-functional delivery for payer platform initiatives.</p>
      <h2>Ideal Candidate Profile</h2>
      <p>8-12 years of experience leading enterprise software programs.</p>
      <p>Based in Pune with hybrid work culture.</p>
      <p>If you have any questions, please direct your inquiries to careers@simplifyhealthcare.com.</p>

      <section>
        <h3>Related Posts</h3>
        <a href="https://simplifyhealthcare.com/careers/current-openings/india/product-marketing-lead/">Product Marketing Lead</a>
      </section>
    </main>
  </body>
</html>
`

const productManagerHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Product Manager | Simplify Healthcare</title>
    <link rel="canonical" href="https://simplifyhealthcare.com/careers/current-openings/india/product-manager/">
  </head>
  <body>
    <main>
      <h1>Product Manager</h1>
      <p>Jun 12, 2026 Pune, India</p>
      <h2>About Simplify Healthcare</h2>
      <p>Simplify Healthcare builds SaaS products for health plans.</p>
      <h2>Role Overview</h2>
      <p>Drive product strategy across provider and member experiences.</p>
      <p>5-8 years of product management experience.</p>
      <p>If you have any questions, please direct your inquiries to careers@simplifyhealthcare.com.</p>
    </main>
  </body>
</html>
`

const productMarketingLeadHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Product Marketing Lead | Simplify Healthcare</title>
    <link rel="canonical" href="https://simplifyhealthcare.com/careers/current-openings/india/product-marketing-lead/">
  </head>
  <body>
    <main>
      <h1>Product Marketing Lead</h1>
      <p>Apr 10, 2026 Pune, India</p>
      <h2>About Simplify Healthcare</h2>
      <p>Join our healthcare product marketing team.</p>
      <h2>Role Overview</h2>
      <p>Shape go-to-market strategy for payer-facing products.</p>
      <p>Remote-first flexibility with periodic Pune collaboration.</p>
      <p>If you have any questions, please direct your inquiries to careers@simplifyhealthcare.com.</p>
    </main>
  </body>
</html>
`

const liveLikeSplitMetaProductManagerHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Current Openings (Pune) - Product Manager</title>
    <link rel="canonical" href="https://simplifyhealthcare.com/careers/current-openings/india/product-manager-3/">
  </head>
  <body>
    <main>
      <div class="blog-single-header-wrapper">
        <h1 class="blog-single-title">Product Manager</h1>
        <div class="entry-meta">
          <span class="published"><span class="far fa-clock"></span>Jun 23, 2026</span>
          <span class="blog-label">
            <span class="far fa-folder-open"></span>
            <a href="https://simplifyhealthcare.com/category/careers/current-openings/india/" rel="category tag">Pune, India</a>
          </span>
        </div>
      </div>
      <div class="wpb_wrapper">
        <p><strong>Role:</strong></p>
        <p>Simplify Healthcare is the leader in healthcare payer Digital Business Transformation and is looking to build a team of sharp, detail-oriented professionals.</p>
        <p>Define the product vision and create a product roadmap aligned with business goals and market opportunities.</p>
        <p><strong>Responsibilities:</strong></p>
        <ul>
          <li>Drive product strategy.</li>
          <li>Partner with engineering and analytics teams.</li>
        </ul>
        <p>5-8 years of product management experience in healthcare payer operations.</p>
        <h6>If you have any questions, please direct your inquiries to <a href="mailto:careers@simplifyhealthcare.com">careers@simplifyhealthcare.com</a></h6>
      </div>
      <footer>
        <h5>About Simplify Healthcare</h5>
        <p>The Connected AI platform for payer operations.</p>
      </footer>
    </main>
  </body>
</html>
`

const genericDetailShellHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Current Openings | Simplify Healthcare</title>
  </head>
  <body>
    <main>
      <h1>New Thinking. New Opportunities.</h1>
      <h2>About Simplify Healthcare</h2>
      <p>Simplify Healthcare is always looking to expand our team with versatile professionals.</p>
      <p>Contact us at info@simplifyhealthcare.com.</p>
    </main>
  </body>
</html>
`

const liveLikeCurrentOpeningsHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Current Openings | Simplify Healthcare</title>
  </head>
  <body>
    <main>
      <h1>New Thinking. New Opportunities.</h1>
      <a href="https://simplifyhealthcare.com/careers/current-openings/india/director-product-management/">Apply Now</a>
      <a href="https://simplifyhealthcare.com/careers/current-openings/india/product-manager-3/">Apply Now</a>
      <a href="https://simplifyhealthcare.com/careers/current-openings/india/project-manager-2/">Apply Now</a>
    </main>
  </body>
</html>
`

const liveLikeIndiaArchiveHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Current Openings | Simplify Healthcare</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <p>New Thinking. New Opportunities.</p>
      <a href="https://simplifyhealthcare.com/careers/current-openings/india/director-product-management/">Apply Now</a>
      <a href="https://simplifyhealthcare.com/careers/current-openings/india/product-manager-3/">Apply Now</a>
      <a href="https://simplifyhealthcare.com/careers/current-openings/india/project-manager-2/">Apply Now</a>
    </main>
  </body>
</html>
`

const directorProductManagementWordPressPayload = [{
  id: 52449,
  date: '2026-06-23T07:19:07',
  slug: 'director-product-management',
  link: 'https://simplifyhealthcare.com/careers/current-openings/india/director-product-management/',
  title: {
    rendered: 'Director – Product Management',
  },
  content: {
    rendered: `
      <div>
        <h2>About Simplify Healthcare</h2>
        <p>Simplify Healthcare, a Simplify Group company, is a leading healthcare technology company focused on transforming how U.S. health plans operate.</p>
        <p>We continue to invest in applied AI, platform modernization, and leadership talent to shape the future of payer technology.</p>
        <h2>About the Role</h2>
        <p>We are looking for a strategic and execution-focused product leader to shape, scale, and modernize our healthcare payer product portfolio.</p>
        <p>If you have any questions, please direct your inquiries to careers@simplifyhealthcare.com.</p>
      </div>
    `,
  },
}]

const projectManagerWordPressPayload = [{
  id: 52426,
  date: '2026-06-22T09:12:32',
  slug: 'project-manager-2',
  link: 'https://simplifyhealthcare.com/careers/current-openings/india/project-manager-2/',
  title: {
    rendered: 'Project Manager',
  },
  content: {
    rendered: `
      <div>
        <h2>About Simplify Healthcare</h2>
        <p>Simplify Healthcare is one of the fastest-growing healthcare technology solutions providers to the US Health Insurance industry.</p>
        <p>Headquartered in Chicago with a Global Delivery Centre in Pune and 800+ FTEs.</p>
        <h2>Role Overview</h2>
        <p>Lead projects across healthcare initiatives and compliance driven data management solutions.</p>
        <p>8-12 years of experience leading enterprise software programs.</p>
        <p>If you have any questions, please direct your inquiries to careers@simplifyhealthcare.com.</p>
      </div>
    `,
  },
}]

const productManagerWordPressPayload = [{
  id: 52442,
  date: '2026-06-23T07:05:23',
  slug: 'product-manager-3',
  link: 'https://simplifyhealthcare.com/careers/current-openings/india/product-manager-3/',
  title: {
    rendered: 'Product Manager',
  },
  content: {
    rendered: `
      <div>
        <p>Role: Simplify Healthcare is looking for a Product Manager to define the product vision and roadmap aligned with business goals.</p>
        <p>Drive product innovation objectives and release content following Agile best practices.</p>
        <p>If you have any questions, please direct your inquiries to careers@simplifyhealthcare.com.</p>
      </div>
    `,
  },
}]

const productMarketingLeadWordPressPayload = [{
  id: 52390,
  date: '2026-04-10T09:00:00',
  slug: 'product-marketing-lead',
  link: 'https://simplifyhealthcare.com/careers/current-openings/india/product-marketing-lead/',
  title: {
    rendered: 'Product Marketing Lead',
  },
  content: {
    rendered: `
      <div>
        <h2>About Simplify Healthcare</h2>
        <p>Join our healthcare product marketing team.</p>
        <h2>Role Overview</h2>
        <p>Shape go-to-market strategy for payer-facing products from our Pune team.</p>
        <p>If you have any questions, please direct your inquiries to careers@simplifyhealthcare.com.</p>
      </div>
    `,
  },
}]

test('Simplify Healthcare validates the verified official careers surfaces and extracts India detail URLs', async () => {
  const simplifyHealthcare = await loadSimplifyHealthcareModule()
  assert.ok(simplifyHealthcare, 'Expected Simplify Healthcare scraper module at ./script.js')

  assert.equal(simplifyHealthcare.SOURCE, 'simplifyhealthcare')
  assert.equal(simplifyHealthcare.COMPANY, 'Simplify Healthcare')
  assert.equal(simplifyHealthcare.CAREERS_URL, 'https://simplifyhealthcare.com/careers/current-openings/')
  assert.equal(
    simplifyHealthcare.INDIA_ARCHIVE_URL,
    'https://simplifyhealthcare.com/category/careers/current-openings/india/',
  )
  assert.equal(simplifyHealthcare.hasOfficialCareersSignal(currentOpeningsHtml), true)
  assert.equal(simplifyHealthcare.hasOfficialCareersSignal(indiaArchiveHtml), true)

  assert.deepEqual(simplifyHealthcare.extractIndiaDetailUrls(currentOpeningsHtml), [
    'https://simplifyhealthcare.com/careers/current-openings/india/project-manager-2/',
    'https://simplifyhealthcare.com/careers/current-openings/india/product-manager/',
  ])

  assert.deepEqual(simplifyHealthcare.extractIndiaDetailUrls(indiaArchiveHtml), [
    'https://simplifyhealthcare.com/careers/current-openings/india/product-marketing-lead/',
    'https://simplifyhealthcare.com/careers/current-openings/india/project-manager-2/',
  ])
})

test('Simplify Healthcare extracts India jobs from official current-opening detail pages', async () => {
  const simplifyHealthcare = await loadSimplifyHealthcareModule()
  assert.ok(simplifyHealthcare, 'Expected Simplify Healthcare scraper module at ./script.js')

  assert.deepEqual(
    simplifyHealthcare.extractJobFromDetailHtml({
      url: 'https://simplifyhealthcare.com/careers/current-openings/india/project-manager-2/',
      html: projectManagerHtml,
    }),
    {
      jobId: 'simplifyhealthcare-project-manager-2',
      requisitionId: 'simplifyhealthcare-project-manager-2',
      title: 'Project Manager',
      company: 'Simplify Healthcare',
      department: null,
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      sourceUrl: 'https://simplifyhealthcare.com/careers/current-openings/india/project-manager-2/',
      applyUrl: 'https://simplifyhealthcare.com/careers/current-openings/india/project-manager-2/',
      employmentType: null,
      experienceRequired: '8-12 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-22',
      closingDate: null,
      jobDescription: 'About Simplify Healthcare Simplify Healthcare is one of the fastest growing healthcare technology solutions providers to the payer market. Role Overview Lead cross-functional delivery for payer platform initiatives. Ideal Candidate Profile 8-12 years of experience leading enterprise software programs. Based in Pune with hybrid work culture.',
      remoteStatus: 'Hybrid',
    },
  )
})

test('Simplify Healthcare extracts live-like detail pages when date and location are split across entry-meta nodes', async () => {
  const simplifyHealthcare = await loadSimplifyHealthcareModule()
  assert.ok(simplifyHealthcare, 'Expected Simplify Healthcare scraper module at ./script.js')

  assert.deepEqual(
    simplifyHealthcare.extractJobFromDetailHtml({
      url: 'https://simplifyhealthcare.com/careers/current-openings/india/product-manager-3/',
      html: liveLikeSplitMetaProductManagerHtml,
    }),
    {
      jobId: 'simplifyhealthcare-product-manager-3',
      requisitionId: 'simplifyhealthcare-product-manager-3',
      title: 'Product Manager',
      company: 'Simplify Healthcare',
      department: null,
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      sourceUrl: 'https://simplifyhealthcare.com/careers/current-openings/india/product-manager-3/',
      applyUrl: 'https://simplifyhealthcare.com/careers/current-openings/india/product-manager-3/',
      employmentType: null,
      experienceRequired: '5-8 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-23',
      closingDate: null,
      jobDescription: 'Role: Simplify Healthcare is the leader in healthcare payer Digital Business Transformation and is looking to build a team of sharp, detail-oriented professionals. Define the product vision and create a product roadmap aligned with business goals and market opportunities. Responsibilities: Drive product strategy. Partner with engineering and analytics teams. 5-8 years of product management experience in healthcare payer operations.',
      remoteStatus: 'On-site',
    },
  )
})

test('Simplify Healthcare can extract an India job from the official WordPress post payload when the rendered detail URL serves a generic shell', async () => {
  const simplifyHealthcare = await loadSimplifyHealthcareModule()
  assert.ok(simplifyHealthcare, 'Expected Simplify Healthcare scraper module at ./script.js')

  const job = simplifyHealthcare.extractJobFromWordPressPostPayload({
    url: 'https://simplifyhealthcare.com/careers/current-openings/india/project-manager-2/',
    payload: projectManagerWordPressPayload,
  })

  assert.equal(job.title, 'Project Manager')
  assert.equal(job.location, 'India')
  assert.equal(job.city, null)
  assert.equal(job.postingDate, '2026-06-22')
  assert.match(job.jobDescription, /lead projects across healthcare initiatives/i)
})

test('Simplify Healthcare run fetches both verified official listing surfaces, crawls same-domain India detail pages, and decorates jobs', async () => {
  const simplifyHealthcare = await loadSimplifyHealthcareModule()
  assert.ok(simplifyHealthcare, 'Expected Simplify Healthcare scraper module at ./script.js')

  const pagesByUrl = new Map([
    [simplifyHealthcare.CAREERS_URL, currentOpeningsHtml],
    [simplifyHealthcare.INDIA_ARCHIVE_URL, indiaArchiveHtml],
    ['https://simplifyhealthcare.com/careers/current-openings/india/project-manager-2/', projectManagerHtml],
    ['https://simplifyhealthcare.com/careers/current-openings/india/product-manager/', productManagerHtml],
    ['https://simplifyhealthcare.com/careers/current-openings/india/product-marketing-lead/', productMarketingLeadHtml],
  ])

  const requestedUrls = []
  const jobs = await simplifyHealthcare.createSimplifyHealthcareScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      const html = pagesByUrl.get(url)
      if (!html) {
        throw new Error(`Unexpected URL: ${url}`)
      }
      return html
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://simplifyhealthcare.com/careers/current-openings/',
    'https://simplifyhealthcare.com/category/careers/current-openings/india/',
    'https://simplifyhealthcare.com/careers/current-openings/india/project-manager-2/',
    'https://simplifyhealthcare.com/careers/current-openings/india/product-manager/',
    'https://simplifyhealthcare.com/careers/current-openings/india/product-marketing-lead/',
  ])

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      postingDate: job.postingDate,
      remoteStatus: job.remoteStatus,
      source: job.source,
      link: job.link,
    })),
    [
      {
        title: 'Project Manager',
        location: 'Pune, India',
        postingDate: '2026-06-22',
        remoteStatus: 'Hybrid',
        source: 'simplifyhealthcare',
        link: 'https://simplifyhealthcare.com/careers/current-openings/india/project-manager-2/',
      },
      {
        title: 'Product Manager',
        location: 'Pune, India',
        postingDate: '2026-06-12',
        remoteStatus: 'On-site',
        source: 'simplifyhealthcare',
        link: 'https://simplifyhealthcare.com/careers/current-openings/india/product-manager/',
      },
      {
        title: 'Product Marketing Lead',
        location: 'Pune, India',
        postingDate: '2026-04-10',
        remoteStatus: 'Remote',
        source: 'simplifyhealthcare',
        link: 'https://simplifyhealthcare.com/careers/current-openings/india/product-marketing-lead/',
      },
    ],
  )
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Simplify Healthcare run falls back to the official WordPress post API when India detail URLs resolve to the generic openings shell', async () => {
  const simplifyHealthcare = await loadSimplifyHealthcareModule()
  assert.ok(simplifyHealthcare, 'Expected Simplify Healthcare scraper module at ./script.js')

  const payloadBySlug = new Map([
    ['director-product-management', directorProductManagementWordPressPayload],
    ['project-manager-2', projectManagerWordPressPayload],
    ['product-manager-3', productManagerWordPressPayload],
  ])

  const jobs = await simplifyHealthcare.createSimplifyHealthcareScraper().run({
    fetchText: async (url) => {
      if (url === simplifyHealthcare.CAREERS_URL) return liveLikeCurrentOpeningsHtml
      if (url === simplifyHealthcare.INDIA_ARCHIVE_URL) return liveLikeIndiaArchiveHtml
      if (
        url === 'https://simplifyhealthcare.com/careers/current-openings/india/director-product-management/'
        || url === 'https://simplifyhealthcare.com/careers/current-openings/india/product-manager-3/'
        || 
        url === 'https://simplifyhealthcare.com/careers/current-openings/india/project-manager-2/'
      ) {
        return genericDetailShellHtml
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async (url) => {
      const slug = new URL(url).searchParams.get('slug')
      const payload = payloadBySlug.get(slug)
      if (!payload) {
        throw new Error(`Unexpected API URL: ${url}`)
      }
      return payload
    },
  })

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      postingDate: job.postingDate,
    })),
    [
      {
        title: 'Director - Product Management',
        location: 'India',
        postingDate: '2026-06-23',
      },
      {
        title: 'Product Manager',
        location: 'India',
        postingDate: '2026-06-23',
      },
      {
        title: 'Project Manager',
        location: 'India',
        postingDate: '2026-06-22',
      },
    ],
  )
})

test('Simplify Healthcare fails closed when the verified official careers surface changes', async () => {
  const simplifyHealthcare = await loadSimplifyHealthcareModule()
  assert.ok(simplifyHealthcare, 'Expected Simplify Healthcare scraper module at ./script.js')

  await assert.rejects(
    simplifyHealthcare.createSimplifyHealthcareScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1><p>No verified board.</p></body></html>',
    }),
    /verified official public careers surface/i,
  )
})
