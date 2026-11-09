import assert from 'node:assert/strict'
import test from 'node:test'

const loadRubrikModule = async () => {
  try {
    return await import('../../scraper/rubrik/script.js')
  } catch {
    assert.fail('Expected Rubrik scraper module at ../../scraper/rubrik/script.js')
  }
}

const careersHtml = `
  <html>
    <head>
      <title>Careers at Rubrik | Discover the Power of You</title>
      <meta name="description" content="Explore cybersecurity and AI careers at Rubrik.">
    </head>
    <body>
      <a href="/company/careers/departments/engineering">Engineering</a>
      <a href="/company/careers/departments/support">Support</a>
      <span>View openings</span>
    </body>
  </html>
`

const departmentHtml = (department, ids) => `
  <html>
    <body>
      ${ids.map((id) => `
        <a href="/company/careers/departments/job.${department}-${id}?reqId=${department}-${id}">
          ${department} role ${id}
        </a>
      `).join('\n')}
    </body>
  </html>
`

const jobHtml = (title) => `
  <html>
    <body>
      <h1>Job Summary</h1>
      <p>${title}</p>
      <p>Location: Bengaluru, India</p>
      <h2>About the Role</h2>
      <p>Build resilient data security systems for customers.</p>
      <h2>Required Skills</h2>
      <p>JavaScript</p>
      <p>Distributed systems</p>
      <h2>Why join us?</h2>
    </body>
  </html>
`

test('run passes the caller signal and fetches Rubrik job detail pages concurrently', async () => {
  const { CAREERS_URL, createRubrikScraper } = await loadRubrikModule()
  const controller = new AbortController()
  const signals = []
  let activeJobFetches = 0
  let maxActiveJobFetches = 0

  const scraper = createRubrikScraper()
  const jobs = await scraper.run({
    signal: controller.signal,
    now: () => '2026-09-10T00:00:00.000Z',
    fetchText: async (url, options = {}) => {
      signals.push(options.signal)

      if (url === CAREERS_URL) return careersHtml
      if (url.endsWith('/company/careers/departments/engineering')) {
        return departmentHtml('engineering', ['1', '2'])
      }
      if (url.endsWith('/company/careers/departments/support')) {
        return departmentHtml('support', ['1', '2'])
      }
      if (url.includes('/company/careers/departments/job.')) {
        activeJobFetches += 1
        maxActiveJobFetches = Math.max(maxActiveJobFetches, activeJobFetches)
        await new Promise((resolve) => setTimeout(resolve, 20))
        activeJobFetches -= 1
        return jobHtml(`Rubrik ${new URL(url).searchParams.get('reqId')}`)
      }

      throw new Error(`Unexpected Rubrik fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 4)
  assert.ok(maxActiveJobFetches > 1)
  assert.ok(signals.length >= 7)
  assert.ok(signals.every((signal) => signal === controller.signal))
  assert.ok(jobs.every((job) => job.company === 'Rubrik'))
  assert.ok(jobs.every((job) => job.city === 'Bengaluru'))
})

test('Rubrik uses the live banner title when Job Summary precedes descriptive paragraphs', async () => {
  const { extractJobFromHtml } = await loadRubrikModule()
  const job = extractJobFromHtml({
    html: `<h1 class="banner_title">Principal Engineer -Dev Platform(Developer Experience)</h1>
      <p>Location: Bangalore, India Office</p><h2>Job Summary</h2>
      <h2><strong>About the role : </strong></h2>
      <p>The Principal Engineer role is a highly strategic position, operating at the same level as an Engineering Director.</p>`,
    jobUrl: 'https://www.rubrik.com/company/careers/departments/job.7270376.1929?reqId=INSW9693',
    department: 'Engineering',
  })
  assert.equal(job.title, 'Principal Engineer -Dev Platform(Developer Experience)')
  assert.equal(job.location, 'Bangalore, India Office')
  assert.match(job.jobDescription, /highly strategic position/)
})
