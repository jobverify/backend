import assert from 'node:assert/strict'
import test from 'node:test'

import { CAREERS_URL, createTwimbitScraper } from '../../scraper/twimbit/script.js'

const careersHtml = `
  <main>
    <a href="/about-careers/cloud-infrastructure-intern-india">Tech Cloud Infrastructure Intern</a>
    <a href="/about-careers/senior-consultant-it-pmo">Tech Senior Consultant, IT PMO</a>
    <a href="/about-careers/research-strategy-consultant-japan">Research &amp; Strategy Consultant</a>
    <a href="https://jobs.example.test/about-careers/external-role">External role</a>
  </main>
`

const detailPages = new Map([
  ['https://twimbit.com/about-careers/cloud-infrastructure-intern-india', `
    <main>
      <h1>Tech Cloud Infrastructure Intern</h1>
      <p>Seniority: Intern</p><p>Location: Bengaluru, India</p><p>On-site</p>
      <h2>Job Description</h2><p>Support the cloud infrastructure team and improve internal tooling.</p>
      <p>Contact: careers@twimbit.com</p>
      <a href="https://docs.google.com/forms/d/e/cloud-intern">Apply Now</a>
    </main>
  `],
  ['https://twimbit.com/about-careers/senior-consultant-it-pmo', `
    <main>
      <h1>Tech Senior Consultant, IT PMO</h1>
      <p>Experience: 5+ years</p><p>Location: India</p><p>Remote</p>
      <h2>Job Description</h2><p>Lead IT PMO engagements for technology transformation clients.</p>
      <a href="https://docs.google.com/forms/d/e/it-pmo">Apply Now</a>
    </main>
  `],
  ['https://twimbit.com/about-careers/research-strategy-consultant-japan', `
    <main>
      <h1>Research &amp; Strategy Consultant</h1>
      <p>Location: Tokyo, Japan</p><p>On-site</p>
      <h2>Job Description</h2><p>Advise financial services clients in Japan.</p>
      <a href="https://docs.google.com/forms/d/e/japan">Apply Now</a>
    </main>
  `],
])

test('Twimbit emits India detail-page roles and preserves verified external apply links', async () => {
  const jobs = await createTwimbitScraper().run({
    fetchHtml: async (url) => url === CAREERS_URL ? careersHtml : detailPages.get(url),
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((job) => ({
    title: job.title,
    location: job.location,
    city: job.city,
    country: job.country,
    sourceUrl: job.sourceUrl,
    applyUrl: job.applyUrl,
    experienceRequired: job.experienceRequired,
    remoteStatus: job.remoteStatus,
  })), [
    {
      title: 'Tech Cloud Infrastructure Intern',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      sourceUrl: 'https://twimbit.com/about-careers/cloud-infrastructure-intern-india',
      applyUrl: 'https://docs.google.com/forms/d/e/cloud-intern',
      experienceRequired: 'Intern',
      remoteStatus: 'On-site',
    },
    {
      title: 'Tech Senior Consultant, IT PMO',
      location: 'India',
      city: null,
      country: 'India',
      sourceUrl: 'https://twimbit.com/about-careers/senior-consultant-it-pmo',
      applyUrl: 'https://docs.google.com/forms/d/e/it-pmo',
      experienceRequired: '5+ years',
      remoteStatus: 'Remote',
    },
  ])
  assert.ok(jobs.every((job) => job.company === 'Twimbit' && job.source === 'twimbit'))
  assert.ok(jobs.every((job) => job.jobDescription?.length > 0))
})

test('Twimbit fails closed when the careers page has no same-origin role detail pages', async () => {
  const jobs = await createTwimbitScraper().run({
    fetchHtml: async () => '<main><a href="/careers">Careers</a></main>',
  })

  assert.deepEqual(jobs, [])
})

test('Twimbit falls back to browser-backed HTML when direct fetches are blocked', async () => {
  const browserHits = []

  const jobs = await createTwimbitScraper().run({
    fetchHtml: async (url) => {
      throw new Error(`HTTP 403 for ${url}`)
    },
    fetchBrowserHtml: async (url) => {
      browserHits.push(url)
      return url === CAREERS_URL ? careersHtml : detailPages.get(url)
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(browserHits, [
    CAREERS_URL,
    'https://twimbit.com/about-careers/cloud-infrastructure-intern-india',
    'https://twimbit.com/about-careers/senior-consultant-it-pmo',
    'https://twimbit.com/about-careers/research-strategy-consultant-japan',
  ])
})

test('Twimbit does not overlap browser-backed detail fetches on a shared session', async () => {
  let activeBrowserFetches = 0

  const jobs = await createTwimbitScraper().run({
    fetchHtml: async () => {
      throw new Error('HTTP 403 for https://twimbit.com/careers')
    },
    fetchBrowserHtml: async (url) => {
      activeBrowserFetches += 1
      assert.equal(activeBrowserFetches, 1, `Expected serialized browser fetches for ${url}`)

      await new Promise((resolve) => setTimeout(resolve, 5))

      activeBrowserFetches -= 1
      return url === CAREERS_URL ? careersHtml : detailPages.get(url)
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(activeBrowserFetches, 0)
})
