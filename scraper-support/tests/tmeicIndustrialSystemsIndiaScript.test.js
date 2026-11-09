import assert from 'node:assert/strict'
import test from 'node:test'

const loadTmeicIndustrialSystemsIndiaModule = async () => {
  try {
    return await import('../../scraper/tmeicindustrialsystemsindia/script.js')
  } catch {
    assert.fail('Expected TMEIC Industrial Systems India scraper module at ../../scraper/tmeicindustrialsystemsindia/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Careers</h1>
      <p>Select a region below to join our world-class team.</p>
      <section>
        <h2>Japan</h2>
        <a href="https://www.tmeic.co.jp/recruit/">Click here for career opportunities in Japan</a>
      </section>
      <section>
        <h2>North America</h2>
        <a href="https://apply.workable.com/tmeic">View Career Opportunities in North America</a>
      </section>
      <section>
        <h2>Europe</h2>
        <a href="https://careers.toshiba.eu">Click here for career opportunities in EMEA</a>
      </section>
      <section>
        <h2>India</h2>
        <p>Please check back for career opportunities.</p>
      </section>
      <section>
        <h2>Southeast Asia</h2>
        <p>Please check back for career opportunities.</p>
      </section>
      <section>
        <h2>China</h2>
        <p>Please check back for career opportunities.</p>
      </section>
    </main>
  </body>
</html>
`

const publicIndiaJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Careers</h1>
      <p>Select a region below to join our world-class team.</p>
      <section>
        <h2>Japan</h2>
        <a href="https://www.tmeic.co.jp/recruit/">Click here for career opportunities in Japan</a>
      </section>
      <section>
        <h2>North America</h2>
        <a href="https://apply.workable.com/tmeic">View Career Opportunities in North America</a>
      </section>
      <section>
        <h2>Europe</h2>
        <a href="https://careers.toshiba.eu">Click here for career opportunities in EMEA</a>
      </section>
      <section>
        <h2>India</h2>
        <a href="https://tmeic.com/careers/india/control-systems-engineer/">Control Systems Engineer</a>
      </section>
      <section>
        <h2>Southeast Asia</h2>
        <p>Please check back for career opportunities.</p>
      </section>
      <section>
        <h2>China</h2>
        <p>Please check back for career opportunities.</p>
      </section>
    </main>
  </body>
</html>
`

test('TMEIC Industrial Systems India scraper validates the verified global careers page and India zero-job section', async () => {
  const tmeic = await loadTmeicIndustrialSystemsIndiaModule()

  assert.equal(tmeic.SOURCE, 'tmeicindustrialsystemsindia')
  assert.equal(tmeic.COMPANY, 'TMEIC Industrial Systems India Private Limited')
  assert.equal(tmeic.CAREERS_URL, 'https://tmeic.com/careers/')
  assert.equal(tmeic.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    tmeic.extractIndiaSectionText(officialCareersHtml),
    'Please check back for career opportunities.',
  )
  assert.equal(tmeic.hasIndiaZeroJobsSignal(officialCareersHtml), true)
})

test('TMEIC Industrial Systems India scraper returns no jobs while India only shows the verified no-openings message', async () => {
  const tmeic = await loadTmeicIndustrialSystemsIndiaModule()
  const requestedUrls = []

  const jobs = await tmeic.createTmeicIndustrialSystemsIndiaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://tmeic.com/careers/'])
  assert.deepEqual(jobs, [])
})

test('TMEIC Industrial Systems India scraper fails closed when the verified careers shell changes or India exposes jobs', async () => {
  const tmeic = await loadTmeicIndustrialSystemsIndiaModule()

  await assert.rejects(
    tmeic.createTmeicIndustrialSystemsIndiaScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1><p>Placeholder</p></body></html>',
    }),
    /TMEIC careers page no longer matches the verified official public surface/i,
  )

  await assert.rejects(
    tmeic.createTmeicIndustrialSystemsIndiaScraper().run({
      fetchText: async () => publicIndiaJobsHtml,
    }),
    /TMEIC India careers section no longer matches the verified zero-job state/i,
  )
})
