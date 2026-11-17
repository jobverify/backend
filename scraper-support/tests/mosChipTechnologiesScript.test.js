import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_PAGE_HTML = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="UTF-8">
    <title>Careers - MosChip</title>
  </head>
  <body>
    <main>
      <h1>Join The Fastest-Growing Tech</h1>
      <p>Grow with us. Join now.</p>
      <p>We are looking for Innovation Leaders.</p>
      <a href="https://moschip.com/careers/current-openings/">Current Openings</a>
    </main>
  </body>
</html>
`

const CURRENT_OPENINGS_HTML = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <meta charset="UTF-8">
    <title>Current Job Openings | MosChip</title>
  </head>
  <body>
    <main>
      <h1>Current Job Openings</h1>
      <h2>Drop your CV</h2>
      <p>Don’t find any suitable role? No Problem, Let’s have your profile so that, we can get back to you if a suitable job opens.</p>
      <h2>Find Current Openings on...</h2>
      <a href="https://www.linkedin.com/company/moschip/">LinkedIn</a>
      <p>
        Drop in your resume at <a href="mailto:careers@moschip.com">careers@moschip.com</a> (or)
        fill in your details in the form.
      </p>
      <button>Submit Your Resume</button>
    </main>
  </body>
</html>
`

const NOT_FOUND_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <meta charset="UTF-8">
    <title>Page not found - MosChip</title>
  </head>
  <body>
    <h1>Page not found</h1>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>MosChip Jobs</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"RTL Design Engineer"}
    </script>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://jobs.example.com/rtl-design-engineer">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/moschiptechnologies/script.js')
  } catch {
    assert.fail('Expected MosChip Technologies scraper module at ../../scraper/moschiptechnologies/script.js')
  }
}

test('MosChip retains its historical careers and adjacent-route signal helpers', async () => {
  const moschipTechnologies = await loadModule()

  assert.equal(moschipTechnologies.SOURCE, 'moschiptechnologies')
  assert.equal(moschipTechnologies.COMPANY, 'MosChip Technologies')
  assert.equal(moschipTechnologies.OFFICIAL_BRAND_NAME, 'MosChip Technologies Limited')
  assert.equal(moschipTechnologies.VERIFIED_ON, '2026-10-03')
  assert.equal(moschipTechnologies.HOMEPAGE_URL, 'https://moschip.com/')
  assert.equal(moschipTechnologies.CAREERS_URL, 'https://moschip.com/careers/')
  assert.equal(
    moschipTechnologies.CURRENT_OPENINGS_URL,
    'https://moschip.com/careers/current-openings/',
  )
  assert.equal(
    moschipTechnologies.EMPTY_JOB_ARCHIVE_URL,
    'https://moschip.com/job-type/full-time/',
  )
  assert.equal(moschipTechnologies.APPLICATION_EMAIL, 'careers@moschip.com')
  assert.equal(moschipTechnologies.APPLICATION_URL, 'mailto:careers@moschip.com')
  assert.deepEqual(moschipTechnologies.NO_PUBLIC_CAREER_ROUTE_URLS, [
    'https://moschip.com/jobs/',
    'https://moschip.com/openings/',
  ])
  assert.match(moschipTechnologies.VERIFIED_SURFACE_SUMMARY, /Find Current Openings on/i)
  assert.match(moschipTechnologies.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(moschipTechnologies.hasOfficialCareersPageSignal(CAREERS_PAGE_HTML), true)
  assert.equal(
    moschipTechnologies.extractCurrentOpeningsUrl(CAREERS_PAGE_HTML),
    moschipTechnologies.CURRENT_OPENINGS_URL,
  )
  assert.equal(
    moschipTechnologies.hasCurrentOpeningsNoListingSignal(CURRENT_OPENINGS_HTML),
    true,
  )
  assert.equal(moschipTechnologies.pageExposesPublicJobListings(CURRENT_OPENINGS_HTML), false)
  assert.equal(moschipTechnologies.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.equal(
    moschipTechnologies.isVerifiedMissingRoute({
      status: 404,
      url: moschipTechnologies.EMPTY_JOB_ARCHIVE_URL,
      html: NOT_FOUND_HTML,
    }),
    true,
  )
})

// Historical parser helpers remain below their original verification date.
// Current source-directory tests replay complete original native HTTP inputs.
test('MosChip current acquisition requires original HTTP receipts instead of old missing-route empty proof', async () => {
  const moschip = await loadModule()
  await assert.rejects(moschip.createMosChipTechnologiesScraper().run({ fetchPage: async url => ({ status: 200, url, html: CAREERS_PAGE_HTML }) }), /original HTTP metadata|body-only/i)
})
