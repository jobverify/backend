import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Accelya | The World-leading Aviation Software Company</title>
  </head>
  <body>
    <h1>Careers</h1>
    <a href="https://accelya.wd103.myworkdayjobs.com/Careers">View all jobs</a>
    <blockquote>Raveena Khatri Social Media Manager Mumbai office</blockquote>
  </body>
</html>
`

const workdayApiFailurePayload = {
  errorCode: 'HTTP_500',
  errorCaseId: 'EF4887MRQ0DPAW',
  httpStatus: 500,
  message: '',
  messageParams: {},
}

const workdayApiBadRequestPayload = {
  errorCode: 'HTTP_400',
  errorCaseId: 'E64549MRS7VH0N',
  httpStatus: 400,
  message: '',
  messageParams: {},
}

const loadModule = async () => {
  try {
    return await import('../../scraper/accelyasolutionsindialimited/script.js')
  } catch {
    assert.fail('Expected Accelya Solutions India Limited scraper module at ../../scraper/accelyasolutionsindialimited/script.js')
  }
}

test('Accelya Solutions India Limited helpers stay pinned to the verified careers handoff and Workday API failure payload', async () => {
  const accelya = await loadModule()

  assert.equal(accelya.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    accelya.extractVerifiedWorkdayBoardUrl(careersHtml),
    'https://accelya.wd103.myworkdayjobs.com/Careers',
  )
  assert.equal(accelya.isVerifiedWorkdayApiFailure(workdayApiFailurePayload), true)
  assert.equal(accelya.isVerifiedWorkdayApiFailure(workdayApiBadRequestPayload), true)
})

// The old body-only transport could turn HTTP400/500 into an unexplained [].
// Complete native proof now requires observed HTTP responses, exercised with
// current captured responses in test/accelyaNativeInventory.test.js.
test('Accelya Solutions India Limited rejects body-only overrides before requesting live HTTP', async () => {
  const accelya = await loadModule()
  await assert.rejects(accelya.createAccelyaSolutionsIndiaLimitedScraper().run({
    fetchText: async () => assert.fail('Body-only careers override must not run'),
    fetchJson: async () => assert.fail('Body-only API override must not run'),
  }), /native HTTP response metadata|transport overrides/i)
})
