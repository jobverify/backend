import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - DATAFLOW</title>
  </head>
  <body>
    <h1>Join Our Team</h1>
    <p>Explore exciting career opportunities and join a global community shaping excellence worldwide.</p>
    <p><a href="https://dataflowgroup.com/all-vacancies/">EXPLORE ALL VACANCIES</a></p>
    <iframe src="https://dataflowgroup.darwinbox.in/ms/candidate/careers" style="width:100%; height:100vh; border:none;"></iframe>
  </body>
</html>
`

const allVacanciesHtml = `
<div>
  <iframe src="https://dataflowgroup.darwinbox.in/ms/candidate/careers" style="width:100%; height:100vh; border:none;" sandbox="allow-same-origin allow-scripts allow-forms allow-popups"></iframe>
</div>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/dataflowgroup/script.js')
  } catch {
    assert.fail('Expected Dataflow Group scraper module at ../../scraper/dataflowgroup/script.js')
  }
}

test('Dataflow Group validates the first-party careers handoff pages and expected iframe target', async () => {
  const dataflow = await loadModule()

  assert.equal(dataflow.SOURCE, 'dataflowgroup')
  assert.equal(dataflow.COMPANY, 'Dataflow Group')
  assert.equal(dataflow.CAREERS_URL, 'https://dataflowgroup.com/careers/')
  assert.equal(dataflow.ALL_VACANCIES_URL, 'https://dataflowgroup.com/all-vacancies/')
  assert.equal(dataflow.DARWINBOX_IFRAME_URL, 'https://dataflowgroup.darwinbox.in/ms/candidate/careers')
  assert.equal(dataflow.VERIFIED_ON, '2026-07-18')
  assert.equal(dataflow.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(dataflow.hasOfficialAllVacanciesSignal(allVacanciesHtml), true)
})

test('Dataflow Group returns no jobs when the verified surface remains a blocked Darwinbox handoff', async () => {
  const dataflow = await loadModule()

  const jobs = await dataflow.createDataflowGroupScraper().run({
    fetchText: async (url) => {
      if (url === dataflow.CAREERS_URL) return careersHtml
      if (url === dataflow.ALL_VACANCIES_URL) return allVacanciesHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Dataflow Group fails closed if the first-party pages start exposing direct openings or lose the verified handoff', async () => {
  const dataflow = await loadModule()

  await assert.rejects(
    dataflow.createDataflowGroupScraper().run({
      fetchText: async (url) => {
        if (url === dataflow.CAREERS_URL) {
          return careersHtml.replace('EXPLORE ALL VACANCIES', 'Current Openings')
            + '<a href="https://dataflowgroup.com/career/associate-senior-associate-operations">Associate</a>'
        }
        return allVacanciesHtml
      },
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    dataflow.createDataflowGroupScraper().run({
      fetchText: async (url) => (url === dataflow.CAREERS_URL ? careersHtml : '<html><body>No iframe</body></html>'),
    }),
    /verified dataflow handoff/i,
  )
})
