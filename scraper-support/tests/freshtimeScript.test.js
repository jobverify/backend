import assert from 'node:assert/strict'
import test from 'node:test'

const CURRENT_INFO_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Freshtime - Greencore</title>
  </head>
  <body>
    <h1>Freshtime</h1>
    <p>Greencore</p>
    <p>meal salads</p>
    <p>chilled snacking</p>
    <p>Boston, Lincolnshire</p>
    <a href="https://www.greencore.com/careers/">Careers</a>
    <a href="https://www.greencore.com/careers/work-with-greencore/">Work With Greencore</a>
    <a href="https://www.careers.greencore.com/?source=greencore.com">Our Vacancies</a>
    <a href="https://earlycareers.greencore.com/">Early Careers</a>
    <a href="https://jobs.bakkavor.com/">Former Bakkavor sites</a>
  </body>
</html>
`

const CURRENT_NOT_FOUND_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page not found - Greencore</title>
  </head>
  <body>
    <h1>Page not found</h1>
    <a href="https://www.greencore.com/careers/">Careers</a>
    <a href="https://www.greencore.com/careers/work-with-greencore/">Work With Greencore</a>
    <p>Greencore</p>
  </body>
</html>
`

const ACTUAL_PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Freshtime - Greencore</title>
  </head>
  <body>
    <p>Freshtime</p>
    <p>Greencore</p>
    <p>meal salads</p>
    <p>chilled snacking</p>
    <p>Boston, Lincolnshire</p>
    <a href="https://boards.greenhouse.io/freshtime">Freshtime Careers</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/freshtime/script.js')
  } catch {
    assert.fail('Expected Freshtime workbook scraper module at ../../scraper/freshtime/script.js')
  }
}

test('Freshtime stays fail-closed on the informational Greencore surface even when it links to parent-company careers pages', async () => {
  const freshtime = await loadModule()

  assert.doesNotThrow(() => freshtime.assertVerifiedOfficialPublicSurface(CURRENT_INFO_PAGE_HTML))
  assert.doesNotThrow(() =>
    freshtime.assertNoPublicJobsSurface(CURRENT_INFO_PAGE_HTML, freshtime.CAREERS_URL),
  )
})

test('Freshtime keeps the historical not-found helper and reports current HTTP 404 as a coverage failure', async () => {
  const freshtime = await loadModule()

  assert.doesNotThrow(() => freshtime.assertVerifiedOfficialPublicSurface(CURRENT_NOT_FOUND_PAGE_HTML))
  assert.doesNotThrow(() =>
    freshtime.assertNoPublicJobsSurface(CURRENT_NOT_FOUND_PAGE_HTML, freshtime.CAREERS_URL),
  )
  await assert.rejects(
    freshtime.createFreshtimeScraper().run({
      fetchPage: async url => ({ status: 404, url, html: CURRENT_NOT_FOUND_PAGE_HTML }),
    }),
    error => error.failureKind === 'coverage_gap' && error.recruitmentObservations.receipts.every(row => row.status === 404),
  )
})

test('Freshtime still fails closed when an exact-company public ATS board appears', async () => {
  const freshtime = await loadModule()

  assert.throws(
    () => freshtime.assertNoPublicJobsSurface(ACTUAL_PUBLIC_JOBS_HTML, freshtime.CAREERS_URL),
    /public jobs surface/i,
  )
})
