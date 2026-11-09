import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities at Titan Company</title>
  </head>
  <body>
    <h1>Career Opportunities at Titan Company</h1>
    <section>
      <a href="https://careers.titan.in/in/en/search-results">Current vacancies</a>
      <div>Life at Titan</div>
      <div>Working at Titan Company <strong>Limited</strong></div>
    </section>
  </body>
</html>
`

const zeroJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Search results | Find available job openings at Titan</title>
  </head>
  <body>
    <h1>SEARCH RESULTS</h1>
    <p>We couldn’t find any open positions for "\${pageStateData.searchKeyword}"</p>
    <p>Sorry... no active job openings, please come back later.</p>
  </body>
</html>
`

test('Titan recognizes the current careers page even when trusted copy is split across tags', async () => {
  const titan = await loadModule()

  assert.equal(titan.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    titan.extractCurrentVacanciesUrl(careersHtml),
    'https://careers.titan.in/in/en/search-results',
  )
})

test('Titan recognizes the zero-openings search results shell', async () => {
  const titan = await loadModule()

  assert.equal(titan.hasZeroJobsSignal(zeroJobsHtml), true)
})
