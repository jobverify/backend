import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COMPANY,
  OPEN_POSITIONS_URL,
  SOURCE,
  createSmarterAIScraper,
} from '../../scraper/smarterai/script.js'

const nonIndiaOpeningsHtml = `
  <main>
    <h2>Open Positions</h2>
    <p>Explore opportunities across our platform teams.</p>
    <article>
      <h3>Web Application Developer</h3>
      <p>Atlanta, Dubai</p>
      <a href="/careers/web-application-developer">Learn more</a>
    </article>
    <article>
      <h3>BSP Engineer</h3>
      <p>Atlanta, Dubai</p>
      <a href="/careers/bsp-engineer">Learn more</a>
    </article>
    <footer><h4>About Smarter AI</h4></footer>
  </main>
`

const indiaOpeningsHtml = `
  <main>
    <h2>Open Positions</h2>
    <article>
      <h3>Computer Vision Engineer</h3>
      <p>Bengaluru, India</p>
      <a href="/careers/computer-vision-engineer">Learn more</a>
    </article>
    <article>
      <h3>Embedded Camera Software Engineer</h3>
      <p>Atlanta, Dubai</p>
      <a href="/careers/embedded-camera-software-engineer">Learn more</a>
    </article>
    <footer><h4>About Smarter AI</h4></footer>
  </main>
`

const detailPages = new Map([
  ['https://smarterai.com/careers/web-application-developer', `
    <main>
      <h2>Web Application Developer</h2>
      <p>We are growing our team in Atlanta and Dubai.</p>
      <p>Build enterprise web applications for intelligent camera fleets.</p>
      <a href="https://docs.google.com/forms/d/e/web-app-role">Apply</a>
    </main>
  `],
  ['https://smarterai.com/careers/bsp-engineer', `
    <main>
      <h2>BSP Engineer</h2>
      <p>We are growing our team in Atlanta and Dubai.</p>
      <p>Develop board support packages for camera platforms.</p>
      <a href="https://docs.google.com/forms/d/e/bsp-role">Apply</a>
    </main>
  `],
  ['https://smarterai.com/careers/computer-vision-engineer', `
    <main>
      <h2>Computer Vision Engineer</h2>
      <p>Location: Bengaluru, India</p>
      <p>Experience: 4+ years</p>
      <p>Hybrid</p>
      <p>Design and optimize real-time perception models for commercial transportation systems.</p>
      <a href="https://jobs.example.test/computer-vision-engineer">Apply</a>
    </main>
  `],
  ['https://smarterai.com/careers/embedded-camera-software-engineer', `
    <main>
      <h2>Embedded Camera Software Engineer</h2>
      <p>We are growing our team in Atlanta and Dubai.</p>
      <a href="https://jobs.example.test/embedded-camera-software-engineer">Apply</a>
    </main>
  `],
])

test('SmarterAI filters out non-India openings from the verified public roles surface', async () => {
  const jobs = await createSmarterAIScraper().run({
    fetchHtml: async (url) => url === OPEN_POSITIONS_URL ? nonIndiaOpeningsHtml : detailPages.get(url),
  })

  assert.deepEqual(jobs, [])
})

test('SmarterAI emits India jobs when the verified openings contract exposes them', async () => {
  const jobs = await createSmarterAIScraper({
    now: () => '2026-07-25T00:00:00.000Z',
  }).run({
    fetchHtml: async (url) => url === OPEN_POSITIONS_URL ? indiaOpeningsHtml : detailPages.get(url),
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Computer Vision Engineer',
    company: COMPANY,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://smarterai.com/careers/computer-vision-engineer',
    sourceUrl: 'https://smarterai.com/careers/computer-vision-engineer',
    applyUrl: 'https://jobs.example.test/computer-vision-engineer',
    source: SOURCE,
    employmentType: null,
    experienceRequired: '4+ years',
    seniority: '4+ years',
    jobDescription: 'Hybrid Design and optimize real-time perception models for commercial transportation systems.',
    requiredSkills: [],
    remoteStatus: 'Hybrid',
    scrapedAt: '2026-07-25T00:00:00.000Z',
  })
})

test('SmarterAI fails closed when the verified Open Positions contract is absent', async () => {
  const jobs = await createSmarterAIScraper().run({
    fetchHtml: async () => `
      <main>
        <h2>Careers</h2>
        <article>
          <h3>Computer Vision Engineer</h3>
          <p>Bengaluru, India</p>
          <a href="/careers/computer-vision-engineer">Learn more</a>
        </article>
      </main>
    `,
  })

  assert.deepEqual(jobs, [])
})
