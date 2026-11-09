import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  SOURCE,
  createVelocitySoftwareSolutionsScraper,
  extractJobLinks,
  hasOfficialCareersSignal,
} from './script.js'

const careersHtml = `
  <html>
    <head>
      <title>Careers | Velocity Software Solutions</title>
    </head>
    <body>
      <h1>Careers</h1>
      <p>Join our dynamic team to innovate, create, and excel in a supportive environment fostering growth and cutting-edge technology.</p>
      <a class="job-card" href="https://www.velsof.com/jobs/ui-ux-designer/" target="_self">
        UI/UX Designer
        <span>Design</span>
        <span>Noida, India</span>
        <span>2+ years</span>
        <span>Full-time</span>
        <span>Feb 15, 2026</span>
      </a>
      <a class="job-card" href="https://www.velsof.com/jobs/flutter-mobile-app-developer/" target="_self">
        Flutter Mobile App Developer
        <span>Mobile Development</span>
        <span>Noida, India / Remote</span>
        <span>2-3 years</span>
        <span>Full-time</span>
        <span>Feb 15, 2026</span>
      </a>
      <a class="job-card" href="https://www.velsof.com/jobs/senior-laravel-developer/" target="_self">
        Senior Laravel Developer
        <span>Engineering</span>
        <span>Noida, India</span>
        <span>3-5 years</span>
        <span>Full-time</span>
        <span>Feb 15, 2026</span>
      </a>
    </body>
  </html>
`

const detailPages = {
  'https://www.velsof.com/jobs/ui-ux-designer/': `
    <html>
      <head><title>UI/UX Designer | Velocity</title></head>
      <body>
        <h2>About the Role</h2>
        <p>Design intuitive interfaces for web and mobile applications.</p>
        <h2>Requirements</h2>
        <ul>
          <li>2+ years of experience in UI/UX design</li>
          <li>Strong portfolio across web and mobile products</li>
        </ul>
      </body>
    </html>
  `,
  'https://www.velsof.com/jobs/flutter-mobile-app-developer/': `
    <html>
      <head><title>Flutter Mobile App Developer | Velocity</title></head>
      <body>
        <h2>About the Role</h2>
        <p>Build and maintain cross-platform mobile applications.</p>
        <h2>Requirements</h2>
        <ul>
          <li>2-3 years of Flutter experience</li>
          <li>Experience shipping Android and iOS apps</li>
        </ul>
      </body>
    </html>
  `,
  'https://www.velsof.com/jobs/senior-laravel-developer/': `
    <html>
      <head><title>Senior Laravel Developer | Velocity</title></head>
      <body>
        <h2>About the Role</h2>
        <p>Lead backend delivery for Laravel-based systems.</p>
        <h2>Requirements</h2>
        <ul>
          <li>3-5 years of Laravel experience</li>
          <li>Strong API design and database fundamentals</li>
        </ul>
      </body>
    </html>
  `,
}

test('Velocity careers verification and job link extraction support attributed anchor tags', () => {
  assert.equal(SOURCE, 'velocitysoftwaresolutions')
  assert.equal(COMPANY, 'Velocity Software Solutions')
  assert.equal(CAREERS_URL, 'https://www.velsof.com/careers/')
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(extractJobLinks(careersHtml), Object.keys(detailPages))
})

test('Velocity scraper follows the current first-party index and detail pages', async () => {
  const requestedUrls = []
  const jobs = await createVelocitySoftwareSolutionsScraper({
    now: () => '2026-08-06T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return careersHtml
      if (detailPages[url]) return detailPages[url]
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, ...Object.keys(detailPages)])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].company, COMPANY)
  assert.equal(jobs[0].source, SOURCE)
  assert.equal(jobs[0].scrapedAt, '2026-08-06T00:00:00.000Z')
  assert.equal(jobs[0].jobDescription.includes('Requirements:'), true)
  assert.equal(jobs.find((job) => job.title === 'Senior Laravel Developer')?.remoteStatus, 'On-site')
  assert.equal(jobs.find((job) => job.title === 'Flutter Mobile App Developer')?.remoteStatus, 'Hybrid')
})

test('Velocity scraper fails closed when a detail page title no longer matches the trusted card title', async () => {
  await assert.rejects(
    createVelocitySoftwareSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === CAREERS_URL) return careersHtml
        return '<html><head><title>Different Role | Velocity</title></head><body></body></html>'
      },
    }),
    /detail page drifted/i,
  )
})
