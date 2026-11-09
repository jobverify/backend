import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T12:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html>
  <body>
    <h3>Further your career</h3>
    <a href="https://www.cavisson.com/category/open-position-india/">Open Positions in India</a>
    <p>If you believe in yourself, then Cavisson is the place to boost your career!</p>
  </body>
</html>
`

const openingsPageHtml = `
<!doctype html>
<html>
  <body>
    <article class="entry-box">
      <div class="entry-header">
        <a href="https://www.cavisson.com/sr-software-engineer-for-cavisson-systems-inc/"><h1 class="entry-title">Sr. Software Engineer FOR CAVISSON SYSTEMS, INC</h1></a>
      </div>
      <div class="entry-content">
        <div class="jobs">
          <h3>Job Brief for SAAS:</h3>
          <p>You will be expected to do research and write software in small burst and then integrate, test, monitor and deploy code in short time periods.</p>
        </div>
      </div>
    </article>
    <article class="entry-box">
      <div class="entry-header">
        <a href="https://www.cavisson.com/product-management-professional-for-cavisson-systems-inc/"><h1 class="entry-title">Product Management Professional FOR CAVISSON SYSTEMS, INC</h1></a>
      </div>
      <div class="entry-content">
        <div class="jobs">
          <h3>Job Brief:</h3>
          <p>Product management professional is responsible for guiding the success of a product and leading the cross-functional team that is responsible for improving it.</p>
        </div>
      </div>
    </article>
    <article class="entry-box">
      <div class="entry-header">
        <a href="https://www.cavisson.com/devops-engineer-for-cavisson-systems-inc/"><h1 class="entry-title">DevOps Engineer FOR CAVISSON SYSTEMS, INC</h1></a>
      </div>
      <div class="entry-content">
        <div class="jobs">
          <h3>Job Brief:</h3>
          <p>Individual must be operational experience of handling log monitoring solution like Elasticsearch, Splunk, and large clustered log monitoring solution.</p>
        </div>
      </div>
    </article>
    <article class="entry-box">
      <div class="entry-header">
        <a href="https://www.cavisson.com/unix-c-developer-for-cavisson-systems-inc/"><h1 class="entry-title">Unix C DEVELOPER FOR CAVISSON SYSTEMS, INC.</h1></a>
      </div>
      <div class="entry-content">
        <div class="jobs">
          <h3>Job Brief:</h3>
          <p>Software development in Linux using C and shell programming.</p>
        </div>
      </div>
    </article>
    <article class="entry-box">
      <div class="entry-header">
        <a href="https://www.cavisson.com/java-developer-for-cavisson-systems-inc/"><h1 class="entry-title">JAVA DEVELOPER FOR CAVISSON SYSTEMS, INC</h1></a>
      </div>
      <div class="entry-content">
        <div class="jobs">
          <h3>Job Brief:</h3>
          <p>We at Cavisson are looking for Java developers with experience in building scalable and high-performance Java applications.</p>
        </div>
      </div>
    </article>
  </body>
</html>
`

const buildDetailPageHtml = ({
  jobTitle,
  experience = null,
  location = 'C139/E84 sector-63, Noida. India',
  bodyHtml,
}) => `
<!doctype html>
<html>
  <head>
    <title>${jobTitle} - Cavisson</title>
  </head>
  <body>
    <article>
      <div class="entry-content">
        ${bodyHtml}
        <h4>Job Title: <span>${jobTitle}</span></h4>
        ${experience ? `<h4>Experience: <span>${experience}</span></h4>` : ''}
        <h5>Job location: Cavisson Systems, <span class="add">${location}</span></h5>
        <h5>Contact: Cavisson Systems, Inc. <span class="name">Attn: Kajol Gupta</span></h5>
        <h5>Kindly send your resume to <a href="mailto:hiring@cavisson.com">hiring@cavisson.com</a></h5>
      </div>
    </article>
  </body>
</html>
`

const detailPageHtmlByUrl = {
  'https://www.cavisson.com/sr-software-engineer-for-cavisson-systems-inc/': buildDetailPageHtml({
    jobTitle: 'Sr. Software Engineer',
    experience: '3-7 Years',
    bodyHtml: `
      <h4>Responsibilities:</h4>
      <ul>
        <li>Write clean, stable and safe code in short time frames.</li>
        <li>Collaborate with engineering teams across multiple functions.</li>
      </ul>
    `,
  }),
  'https://www.cavisson.com/product-management-professional-for-cavisson-systems-inc/': buildDetailPageHtml({
    jobTitle: 'Product Manager',
    experience: '5-12 Years',
    bodyHtml: `
      <h4>Responsibilities:</h4>
      <ul>
        <li>Set product strategy and roadmap.</li>
        <li>Align engineering, sales and support teams.</li>
      </ul>
    `,
  }),
  'https://www.cavisson.com/devops-engineer-for-cavisson-systems-inc/': buildDetailPageHtml({
    jobTitle: 'DevOps Engineer',
    bodyHtml: `
      <h4>Responsibilities:</h4>
      <ul>
        <li>Implement and monitor clustered log monitoring solutions.</li>
      </ul>
    `,
  }),
  'https://www.cavisson.com/unix-c-developer-for-cavisson-systems-inc/': buildDetailPageHtml({
    jobTitle: 'Unix C Developer',
    bodyHtml: `
      <h4>Responsibilities:</h4>
      <ul>
        <li>Develop Linux system software using C and shell scripting.</li>
      </ul>
    `,
  }),
  'https://www.cavisson.com/java-developer-for-cavisson-systems-inc/': buildDetailPageHtml({
    jobTitle: 'Java Developer',
    bodyHtml: `
      <h4>Responsibilities:</h4>
      <ul>
        <li>Create scalable and high-performance Java applications.</li>
      </ul>
    `,
  }),
}

const loadModule = async () => {
  try {
    return await import('../../scraper/cavissonsystems/script.js')
  } catch {
    assert.fail('Expected Cavisson Systems scraper module at ../../scraper/cavissonsystems/script.js')
  }
}

test('Cavisson Systems helpers stay pinned to the verified careers page and India archive contract', async () => {
  const cavisson = await loadModule()

  assert.equal(cavisson.hasOfficialCareersSignal(careersPageHtml), true)
  assert.deepEqual(
    cavisson.extractArchiveJobs(openingsPageHtml).map((job) => job.title),
    [
      'Sr. Software Engineer FOR CAVISSON SYSTEMS, INC',
      'Product Management Professional FOR CAVISSON SYSTEMS, INC',
      'DevOps Engineer FOR CAVISSON SYSTEMS, INC',
      'Unix C DEVELOPER FOR CAVISSON SYSTEMS, INC.',
      'JAVA DEVELOPER FOR CAVISSON SYSTEMS, INC',
    ],
  )
})

test('Cavisson Systems run validates the verified pages and returns normalized jobs', async () => {
  const cavisson = await loadModule()
  const requestedUrls = []
  const jobs = await cavisson.createCavissonSystemsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === cavisson.CAREERS_URL) return careersPageHtml
      if (url === cavisson.OPENINGS_URL) return openingsPageHtml
      if (detailPageHtmlByUrl[url]) return detailPageHtmlByUrl[url]
      throw new Error(`Unexpected Cavisson URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    cavisson.CAREERS_URL,
    cavisson.OPENINGS_URL,
    'https://www.cavisson.com/sr-software-engineer-for-cavisson-systems-inc/',
    'https://www.cavisson.com/product-management-professional-for-cavisson-systems-inc/',
    'https://www.cavisson.com/devops-engineer-for-cavisson-systems-inc/',
    'https://www.cavisson.com/unix-c-developer-for-cavisson-systems-inc/',
    'https://www.cavisson.com/java-developer-for-cavisson-systems-inc/',
  ])
  assert.equal(jobs.length, 5)
  assert.deepEqual(
    jobs.map((job) => [
      job.title,
      job.experienceRequired,
      job.publicExperienceChecked,
      job.location,
      job.city,
      job.country,
      job.sourceUrl,
      job.applyUrl,
    ]),
    [
      ['Sr. Software Engineer FOR CAVISSON SYSTEMS, INC', '3-7 years', true, 'Noida, India', 'Noida', 'India', 'https://www.cavisson.com/sr-software-engineer-for-cavisson-systems-inc/', 'https://www.cavisson.com/sr-software-engineer-for-cavisson-systems-inc/'],
      ['Product Management Professional FOR CAVISSON SYSTEMS, INC', '5-12 years', true, 'Noida, India', 'Noida', 'India', 'https://www.cavisson.com/product-management-professional-for-cavisson-systems-inc/', 'https://www.cavisson.com/product-management-professional-for-cavisson-systems-inc/'],
      ['DevOps Engineer FOR CAVISSON SYSTEMS, INC', null, true, 'Noida, India', 'Noida', 'India', 'https://www.cavisson.com/devops-engineer-for-cavisson-systems-inc/', 'https://www.cavisson.com/devops-engineer-for-cavisson-systems-inc/'],
      ['Unix C DEVELOPER FOR CAVISSON SYSTEMS, INC.', null, true, 'Noida, India', 'Noida', 'India', 'https://www.cavisson.com/unix-c-developer-for-cavisson-systems-inc/', 'https://www.cavisson.com/unix-c-developer-for-cavisson-systems-inc/'],
      ['JAVA DEVELOPER FOR CAVISSON SYSTEMS, INC', null, true, 'Noida, India', 'Noida', 'India', 'https://www.cavisson.com/java-developer-for-cavisson-systems-inc/', 'https://www.cavisson.com/java-developer-for-cavisson-systems-inc/'],
    ],
  )
})

test('Cavisson Systems fails closed when the verified careers identity or openings archive drifts', async () => {
  const cavisson = await loadModule()

  await assert.rejects(
    cavisson.createCavissonSystemsScraper().run({
      fetchText: async (url) => {
        if (url === cavisson.CAREERS_URL) return '<html><body>Unexpected</body></html>'
        return openingsPageHtml
      },
    }),
    /verified Cavisson careers page/i,
  )

  await assert.rejects(
    cavisson.createCavissonSystemsScraper().run({
      fetchText: async (url) => {
        if (url === cavisson.CAREERS_URL) return careersPageHtml
        return '<html><body>No openings</body></html>'
      },
    }),
    /verified Cavisson India openings archive/i,
  )
})
