import assert from 'node:assert/strict'
import test from 'node:test'

import { CAREERS_URL, createSumUpIndiaScraper } from '../../scraper/sumupindia/script.js'

const nonIndiaCareersHtml = `
  <main>
    <h1>Explore open positions at SumUp</h1>
    <section aria-label="Location filter">
      <ul>
        <li>Austria</li>
        <li>Belgium</li>
        <li>Brazil</li>
        <li>Bulgaria</li>
        <li>Germany</li>
        <li>United Kingdom</li>
        <li>United States</li>
      </ul>
    </section>
    <section aria-label="Open positions">
      <a href="/careers/positions/berlin-germany/engineering/android-engineer-engagement-mission/8529499002/">
        <h2>Android Engineer - Engagement Mission</h2>
        <p>Berlin, Germany</p>
        <p>Engineering</p>
      </a>
      <a href="/careers/positions/sofia-bulgaria/engineering/backend-engineer-payments/8535553002/">
        <h2>Backend Engineer - Payments</h2>
        <p>Sofia, Bulgaria</p>
        <p>Engineering</p>
      </a>
      <a href="/careers/positions/london-england-united-kingdom/engineering/engineering-manager/8544440002/">
        <h2>Engineering Manager</h2>
        <p>London, England, United Kingdom</p>
        <p>Engineering</p>
      </a>
    </section>
  </main>
`

const indiaCareersHtml = `
  <main>
    <h1>Explore open positions at SumUp</h1>
    <section aria-label="Location filter">
      <ul>
        <li>Germany</li>
        <li>India</li>
        <li>United Kingdom</li>
      </ul>
    </section>
    <section aria-label="Open positions">
      <a href="/careers/positions/bengaluru-karnataka-india/engineering/senior-software-engineer/9001002003/">
        <h2>Senior Software Engineer</h2>
        <p>Bengaluru, Karnataka, India</p>
        <p>Engineering</p>
      </a>
      <a href="/careers/positions/berlin-germany/engineering/backend-engineer-pos/8529499002/">
        <h2>Backend Engineer - POS</h2>
        <p>Berlin, Germany</p>
        <p>Engineering</p>
      </a>
    </section>
  </main>
`

test('SumUp India filters the verified public positions page down to India roles only', async () => {
  const jobs = await createSumUpIndiaScraper().run({
    fetchHtml: async (url) => {
      assert.equal(url, CAREERS_URL)
      return nonIndiaCareersHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('SumUp India emits normalized India roles when the verified positions contract exposes them', async () => {
  const jobs = await createSumUpIndiaScraper({
    now: () => '2026-07-25T12:00:00.000Z',
  }).run({
    fetchHtml: async () => indiaCareersHtml,
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Software Engineer',
    company: 'SumUp India',
    source: 'sumupindia',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    department: 'Engineering',
    link: 'https://www.sumup.com/careers/positions/bengaluru-karnataka-india/engineering/senior-software-engineer/9001002003/',
    sourceUrl: 'https://www.sumup.com/careers/positions/bengaluru-karnataka-india/engineering/senior-software-engineer/9001002003/',
    applyUrl: 'https://www.sumup.com/careers/positions/bengaluru-karnataka-india/engineering/senior-software-engineer/9001002003/',
    jobId: '9001002003',
    requisitionId: '9001002003',
    scrapedAt: '2026-07-25T12:00:00.000Z',
  })
})

test('SumUp India fails closed when the verified positions-page contract is absent', async () => {
  const jobs = await createSumUpIndiaScraper().run({
    fetchHtml: async () => `
      <main>
        <h1>Careers</h1>
        <a href="/careers/positions/bengaluru-karnataka-india/engineering/senior-software-engineer/9001002003/">
          <h2>Senior Software Engineer</h2>
          <p>Bengaluru, Karnataka, India</p>
        </a>
      </main>
    `,
  })

  assert.deepEqual(jobs, [])
})
