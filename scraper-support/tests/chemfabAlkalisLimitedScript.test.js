import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  createChemfabAlkalisLimitedScraper,
  hasGenericResumeFormSignal,
  hasOfficialCareersSignal,
  pageExposesPublicJobListings,
} from '../../scraper/chemfabalkalislimited/script.js'

const officialCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers &#8211; Chemfab Alkalis Limited</title>
    </head>
    <body>
      <main>
        <p>Chemfab Alkalis Limited welcomes driven people to build a career with us.</p>
        <section>
          <h2>Submit Your Resume</h2>
          <div class="wpcf7 no-js" id="wpcf7-f87-p321-o1"></div>
        </section>
      </main>
    </body>
  </html>
`

test('Chemfab Alkalis Limited validates the official careers resume-form surface before returning no verified listings', async () => {
  const requestedUrls = []

  assert.equal(CAREERS_URL, 'https://chemfabalkalis.com/careers/')
  assert.equal(hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(hasGenericResumeFormSignal(officialCareersHtml), true)
  assert.equal(pageExposesPublicJobListings(officialCareersHtml), false)

  const jobs = await createChemfabAlkalisLimitedScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Chemfab Alkalis Limited fails closed when the official careers surface changes', async () => {
  await assert.rejects(
    createChemfabAlkalisLimitedScraper().run({
      fetchText: async () => '<html><body><h1>Open Roles</h1></body></html>',
    }),
    /Chemfab Alkalis Limited official careers surface changed/i,
  )
})

test('Chemfab Alkalis Limited fails closed when the verified generic resume form disappears or public job listings appear', async () => {
  await assert.rejects(
    createChemfabAlkalisLimitedScraper().run({
      fetchText: async () => `
        <html>
          <head><title>Careers - Chemfab Alkalis Limited</title></head>
          <body>
            <h1>Careers</h1>
            <p>Chemfab Alkalis Limited welcomes driven people to build a career with us.</p>
            <p>Email your profile to careers@chemfab.example</p>
          </body>
        </html>
      `,
    }),
    /Chemfab Alkalis Limited generic resume form changed/i,
  )

  await assert.rejects(
    createChemfabAlkalisLimitedScraper().run({
      fetchText: async () => `
        ${officialCareersHtml}
        <section class="job-board">
          <article class="job-card">
            <h3>Production Engineer</h3>
            <a href="/careers/production-engineer">View Job</a>
          </article>
        </section>
      `,
    }),
    /Chemfab Alkalis Limited careers page now exposes public job listings/i,
  )
})
