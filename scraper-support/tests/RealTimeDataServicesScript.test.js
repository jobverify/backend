import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T12:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html>
  <body>
    <h1>Career at RTDS</h1>
    <a href="https://myrealdata.in/careers/apply-online/">Apply Now</a>
    <div class="col opportunities" data-positions="[{&quot;name&quot;:&quot;Senior Software Engineer&quot;,&quot;description&quot;:&quot;&quot;,&quot;mode&quot;:&quot;Work From Office&quot;,&quot;posted_date&quot;:&quot;2024-08-08&quot;,&quot;location&quot;:&quot;Gurugram, Haryana&quot;,&quot;experience&quot;:&quot;2-4&quot;,&quot;open&quot;:&quot;1&quot;,&quot;status&quot;:&quot;active&quot;},{&quot;name&quot;:&quot;Lead Software Development Engineer(React Native)&quot;,&quot;description&quot;:&quot;&quot;,&quot;mode&quot;:&quot;Work From Office&quot;,&quot;posted_date&quot;:&quot;2024-08-08&quot;,&quot;location&quot;:&quot;Gurugram, Haryana&quot;,&quot;experience&quot;:&quot;5&quot;,&quot;open&quot;:&quot;1&quot;,&quot;status&quot;:&quot;active&quot;},{&quot;name&quot;:&quot;Software Developer II&quot;,&quot;description&quot;:&quot;&quot;,&quot;mode&quot;:&quot;Work From Office&quot;,&quot;posted_date&quot;:&quot;2024-08-08&quot;,&quot;location&quot;:&quot;Gurugram, Haryana&quot;,&quot;experience&quot;:&quot;6&quot;,&quot;open&quot;:&quot;1&quot;,&quot;status&quot;:&quot;active&quot;}]">
      <a href="https://myrealdata.in/careers/software-development/" aria-label="Software Development">Software Development</a>
      <span>3 Open Positions</span>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/realtimedataservices/script.js')
  } catch {
    assert.fail('Expected Real Time Data Services scraper module at ../../scraper/realtimedataservices/script.js')
  }
}

test('Real Time Data Services helpers stay pinned to the verified careers page payload contract', async () => {
  const rtds = await loadModule()

  assert.equal(rtds.hasOfficialCareersSignal(careersPageHtml), true)
  assert.deepEqual(
    rtds.extractOpportunityPayloads(careersPageHtml).map((item) => [item.department, item.positions.length]),
    [['Software Development', 3]],
  )
})

test('Real Time Data Services run validates the careers page and returns normalized jobs', async () => {
  const rtds = await loadModule()
  const jobs = await rtds.createRealTimeDataServicesScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, rtds.CAREERS_URL)
      return careersPageHtml
    },
  })

  assert.deepEqual(
    jobs.map((job) => [job.title, job.department, job.location, job.experienceRequired, job.publicExperienceChecked, job.applyUrl]),
    [
      ['Senior Software Engineer', 'Software Development', 'Gurugram, Haryana, India', '2-4 years', true, 'https://myrealdata.in/careers/apply-online/'],
      ['Lead Software Development Engineer(React Native)', 'Software Development', 'Gurugram, Haryana, India', '5 years', true, 'https://myrealdata.in/careers/apply-online/'],
      ['Software Developer II', 'Software Development', 'Gurugram, Haryana, India', '6 years', true, 'https://myrealdata.in/careers/apply-online/'],
    ],
  )
})

test('Real Time Data Services fails closed when the verified careers payload disappears', async () => {
  const rtds = await loadModule()

  await assert.rejects(
    rtds.createRealTimeDataServicesScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified RTDS careers page/i,
  )
})
