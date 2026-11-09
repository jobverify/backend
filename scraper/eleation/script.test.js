import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  HOMEPAGE_URL,
  PLACEMENT_PROCEDURE_URL,
  createEleationScraper,
  hasApplicationOnlyCareersSignal,
  hasOfficialHomepageSignal,
  hasPlacementProcedureSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <h1>ELEATION</h1>
      <p>CAD-CAE Training &amp; CAE Services</p>
      <a href="https://www.eleation.com/career/">Career</a>
    </body>
  </html>
`

const homepageWithoutTrailingSlashHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <h1>ELEATION</h1>
      <p>CAD-CAE Training &amp; CAE Services</p>
      <a href="https://eleation.com/career">Career</a>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <h1>Career at ELEATION</h1>
      <p>Internship &amp; Placement Opportunities</p>
      <p>Submit your career enquiry</p>
      <section>Internship Enquiry Form</section>
      <section>Placement Enquiry Form</section>
      <label>Interested Job Role</label>
    </body>
  </html>
`

const placementProcedureHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <h1>Placement Procedure</h1>
      <p>Submit your placement enquiry from the career page.</p>
      <p>Candidates may be considered for suitable roles based on current requirements.</p>
    </body>
  </html>
`

const updatedPlacementProcedureHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <h1>Placement Procedure | ELEATION Career</h1>
      <p>Submit your placement enquiry from the career page.</p>
      <p>Based on current requirements, shortlisted candidates may be considered for suitable roles related to technical training and engineering projects.</p>
    </body>
  </html>
`

test('validates the verified official ELEATION public surfaces and returns no structured jobs', async () => {
  const requestedUrls = []

  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialHomepageSignal(homepageWithoutTrailingSlashHtml), true)
  assert.equal(hasApplicationOnlyCareersSignal(careersHtml), true)
  assert.equal(hasPlacementProcedureSignal(placementProcedureHtml), true)
  assert.equal(hasPlacementProcedureSignal(updatedPlacementProcedureHtml), true)

  const jobs = await createEleationScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_URL) return careersHtml
      if (url === PLACEMENT_PROCEDURE_URL) return placementProcedureHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL, PLACEMENT_PROCEDURE_URL])
  assert.deepEqual(jobs, [])
})

test('fails closed when the ELEATION homepage signal changes', async () => {
  await assert.rejects(
    createEleationScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return '<html><body>No official career link</body></html>'
        if (url === CAREERS_URL) return careersHtml
        return placementProcedureHtml
      },
    }),
    /verified official public site/i,
  )
})

test('fails closed when the ELEATION careers surface changes', async () => {
  await assert.rejects(
    createEleationScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === CAREERS_URL) return '<html><body>Current openings with job description cards</body></html>'
        if (url === PLACEMENT_PROCEDURE_URL) return placementProcedureHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified application-only enquiry surface/i,
  )
})

test('fails closed when the ELEATION placement flow signal changes', async () => {
  await assert.rejects(
    createEleationScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === CAREERS_URL) return careersHtml
        if (url === PLACEMENT_PROCEDURE_URL) return '<html><body>No placement guidance</body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official public flow/i,
  )
})
