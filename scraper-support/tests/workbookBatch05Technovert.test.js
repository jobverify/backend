import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  SOURCE,
  TEZO_ABOUT_URL,
  TEZO_CAREERS_URL,
  TRUSTED_JOB_HOST,
  createTechnovertScraper,
  run,
} from '../../scraper/technovert/script.js'

const VERIFIED_EXACT_NAME_CAREERS_HTML = `
  <html>
    <body>
      <section>
        <h1>Build what matters. Grow where it counts.</h1>
        <h2>Why Tezo ?</h2>
        <p>Current Openings</p>
        <a href="https://www.tezo.com/tezo-about-us">About Us</a>
      </section>
    </body>
  </html>
`

const VERIFIED_TEZO_ABOUT_HTML = `
  <html>
    <body>
      <h1>About us</h1>
      <h2>We are Tezo</h2>
      <p>Get ready for a new chapter with Tezo doing business as Technovert.</p>
    </body>
  </html>
`

const VERIFIED_TEZO_CAREERS_HTML = `
  <html>
    <body>
      <h1>Careers</h1>
      <h2>Life is too short to do mediocre work</h2>
      <p>Skills matter some. Attitude matters most.</p>
      <h3>Current Openings</h3>
      <a href="https://tezo.kekahire.com/jobdetails/132790">Marketing Intern</a>
      <a href="https://tezo.kekahire.com/jobdetails/130765">Lead Data Scientist</a>
    </body>
  </html>
`

const createVerifiedFetcher = () => async (url) => {
  if (url === CAREERS_URL) return VERIFIED_EXACT_NAME_CAREERS_HTML
  if (url === TEZO_ABOUT_URL) return VERIFIED_TEZO_ABOUT_HTML
  if (url === TEZO_CAREERS_URL) return VERIFIED_TEZO_CAREERS_HTML
  throw new Error(`Unexpected URL: ${url}`)
}

const createVerifiedBrowserContract = ({
  careersHtml = VERIFIED_EXACT_NAME_CAREERS_HTML,
  aboutHtml = VERIFIED_TEZO_ABOUT_HTML,
  tezoCareersHtml = VERIFIED_TEZO_CAREERS_HTML,
} = {}) => async () => ({
  careersHtml,
  aboutHtml,
  tezoCareersHtml,
})

test('Technovert validates the verified Tezo rebrand handoff and stays fail-closed', async () => {
  const requestedUrls = []

  const jobs = await run({
    fetchHtml: async (url) => {
      requestedUrls.push(url)
      return createVerifiedFetcher()(url)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREERS_URL,
    TEZO_ABOUT_URL,
    TEZO_CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
  assert.equal(SOURCE, 'technovert')
  assert.equal(COMPANY, 'Technovert')
  assert.equal(TRUSTED_JOB_HOST, 'tezo.kekahire.com')
  assert.equal(DISPOSITION, 'verified-tezo-rebrand-keka-handoff-fail-closed')
})

test('Technovert throws when the exact-name careers handoff loses the verified Tezo copy', async () => {
  await assert.rejects(
    createTechnovertScraper().run({
      fetchHtml: async (url) => {
        const brokenCareersHtml = `
          <html>
            <body>
              <h1>Careers</h1>
              <p>Explore opportunities.</p>
            </body>
          </html>
        `

        if (url === CAREERS_URL) {
          return brokenCareersHtml
        }

        return createVerifiedFetcher()(url)
      },
      loadBrowserContract: createVerifiedBrowserContract({
        careersHtml: `
          <html>
            <body>
              <h1>Careers</h1>
              <p>Explore opportunities.</p>
            </body>
          </html>
        `,
      }),
    }),
    /verified exact-name careers handoff/i,
  )
})

test('Technovert throws when the exact-name surface starts exposing first-party public jobs', async () => {
  await assert.rejects(
    run({
      fetchHtml: async (url) => {
        const firstPartyJobsHtml = `
          <html>
            <body>
              <h1>Build what matters. Grow where it counts.</h1>
              <h2>Why Tezo ?</h2>
              <p>Current Openings</p>
              <a href="https://www.tezo.com/tezo-about-us">About Us</a>
              <a href="/careers/backend-engineer">Backend Engineer</a>
            </body>
          </html>
        `

        if (url === CAREERS_URL) {
          return firstPartyJobsHtml
        }

        return createVerifiedFetcher()(url)
      },
      loadBrowserContract: createVerifiedBrowserContract({
        careersHtml: `
          <html>
            <body>
              <h1>Build what matters. Grow where it counts.</h1>
              <h2>Why Tezo ?</h2>
              <p>Current Openings</p>
              <a href="https://www.tezo.com/tezo-about-us">About Us</a>
              <a href="/careers/backend-engineer">Backend Engineer</a>
            </body>
          </html>
        `,
      }),
    }),
    /first-party public jobs/i,
  )
})

test('Technovert throws when the Tezo rebrand proof disappears', async () => {
  await assert.rejects(
    run({
      fetchHtml: async (url) => {
        const missingRebrandHtml = `
          <html>
            <body>
              <h1>About us</h1>
              <h2>We are Tezo</h2>
            </body>
          </html>
        `

        if (url === TEZO_ABOUT_URL) {
          return missingRebrandHtml
        }

        return createVerifiedFetcher()(url)
      },
      loadBrowserContract: createVerifiedBrowserContract({
        aboutHtml: `
          <html>
            <body>
              <h1>About us</h1>
              <h2>We are Tezo</h2>
            </body>
          </html>
        `,
      }),
    }),
    /rebrand proof/i,
  )
})

test('Technovert throws when the Tezo careers handoff stops exposing the trusted Keka host', async () => {
  await assert.rejects(
    run({
      fetchHtml: async (url) => {
        const untrustedHostHtml = `
          <html>
            <body>
              <h1>Careers</h1>
              <h2>Life is too short to do mediocre work</h2>
              <p>Skills matter some. Attitude matters most.</p>
              <h3>Current Openings</h3>
              <a href="https://jobs.example.com/marketing-intern">Marketing Intern</a>
            </body>
          </html>
        `

        if (url === TEZO_CAREERS_URL) {
          return untrustedHostHtml
        }

        return createVerifiedFetcher()(url)
      },
      loadBrowserContract: createVerifiedBrowserContract({
        tezoCareersHtml: `
          <html>
            <body>
              <h1>Careers</h1>
              <h2>Life is too short to do mediocre work</h2>
              <p>Skills matter some. Attitude matters most.</p>
              <h3>Current Openings</h3>
              <a href="https://jobs.example.com/marketing-intern">Marketing Intern</a>
            </body>
          </html>
        `,
      }),
    }),
    /trusted Keka job host/i,
  )
})
