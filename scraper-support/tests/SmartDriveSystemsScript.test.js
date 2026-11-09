import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>CAREERS</h1>
    <h2>CAREERS AT SMARTDRIVE</h2>
    <p>WE'RE HIRING</p>
    <h2>VIEW ALL OPEN POSITIONS</h2>
    <p>FIND YOUR JOB</p>
    <p>SmartDrive Systems, Inc. endeavors to make SmartDrive.net accessible to any and all users.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/smartdrivesystems/script.js')
  } catch {
    assert.fail('Expected Smart Drive Systems scraper module at ../../scraper/smartdrivesystems/script.js')
  }
}

test('Smart Drive Systems validates the verified legacy careers shell state', async () => {
  const smartdrive = await loadModule()

  assert.equal(smartdrive.SOURCE, 'smartdrivesystems')
  assert.equal(smartdrive.COMPANY, 'Smart Drive Systems')
  assert.equal(smartdrive.CAREERS_PAGE_URL, 'https://www.smartdrive.net/careers/')
  assert.equal(smartdrive.VERIFIED_ON, '2026-07-18')
  assert.equal(smartdrive.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(smartdrive.pageExposesTrustworthyPublicJobs(careersHtml), false)
})

test('Smart Drive Systems run verifies the exact first-party careers shell before returning []', async () => {
  const smartdrive = await loadModule()
  const requestedUrls = []

  const jobs = await smartdrive.createSmartDriveSystemsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 200,
        url,
        html: careersHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, ['https://www.smartdrive.net/careers/'])
  assert.deepEqual(jobs, [])
})

test('Smart Drive Systems fails closed when the legacy shell starts exposing public job links', async () => {
  const smartdrive = await loadModule()

  await assert.rejects(
    smartdrive.createSmartDriveSystemsScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: `${careersHtml}<a href="https://www.smartdrive.net/careers/software-engineer/">Software Engineer</a>`,
      }),
    }),
    /public jobs surface/i,
  )
})
