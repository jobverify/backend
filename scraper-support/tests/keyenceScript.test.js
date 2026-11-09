import assert from 'node:assert/strict'
import test from 'node:test'

const loadKeyenceModule = async () => {
  try {
    return await import('../../scraper/keyence/script.js')
  } catch {
    assert.fail('Expected Keyence scraper module at ../../scraper/keyence/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <title>KEYENCE India – Careers</title>
    <main>
      <h1>KEYENCE India – Careers</h1>
      <p>At KEYENCE, we believe that proactive actions and a customer-centric mindset are the keys to achieving the greatest added-value for our customers.</p>
      <a href="https://forms.office.com/r/NvMRr292Pt" target="_blank">Apply</a>
      <footer>
        <a href="/ss/career/job.jsp">Recruitment</a>
      </footer>
    </main>
  </body>
</html>
`

const currentOfficialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <title>KEYENCE India – Careers</title>
    <main>
      <h1>KEYENCE India – Careers</h1>
      <p>At KEYENCE, we believe that proactive actions and a customer-centric mindset are the keys to achieving the greatest added-value for our customers.</p>
      <footer>
        <a href="/ss/career/job.jsp">Recruitment</a>
      </footer>
    </main>
  </body>
</html>
`

const recruitmentHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>RECRUITMENT</h1>
      <p>At KEYENCE, we are committed to adding value to your career.</p>
      <p>Hiring Process</p>
      <p>Registration / Aptitude Test / Pre-recorded Video Interview / Live interview 1 / Live interview 2 / Offer</p>
      <p>FAQ about our recruitment</p>
      <p>We have 5 offices in India: Chennai, Bangalore, Pune, Gurgaon, Ahmedabad.</p>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>RECRUITMENT</h1>
      <article>
        <h2>Sales Engineer</h2>
        <a href="/ss/career/jobs/sales-engineer">Apply now</a>
      </article>
    </main>
  </body>
</html>
`

test('Keyence scraper validates the verified official careers and apply-only recruitment surfaces', async () => {
  const keyence = await loadKeyenceModule()

  assert.equal(keyence.CAREERS_URL, 'https://www.keyence.co.in/ss/career/')
  assert.equal(keyence.RECRUITMENT_URL, 'https://www.keyence.co.in/ss/career/job.jsp')
  assert.equal(keyence.APPLY_URL, 'https://forms.office.com/r/NvMRr292Pt')
  assert.equal(keyence.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(keyence.extractRecruitmentUrl(officialCareersHtml), 'https://www.keyence.co.in/ss/career/job.jsp')
  assert.equal(keyence.hasApplyOnlyZeroJobsSignal(recruitmentHtml), true)
})

test('Keyence scraper accepts the current careers landing handoff on Friday, August 7, 2026', async () => {
  const keyence = await loadKeyenceModule()

  assert.equal(keyence.hasOfficialCareersSignal(currentOfficialCareersHtml), true)
  assert.equal(keyence.extractRecruitmentUrl(currentOfficialCareersHtml), 'https://www.keyence.co.in/ss/career/job.jsp')
})

// Pure archived parsers remain covered above. Current native HTTP protocol,
// country alternatives and closing proof are covered by darwinboxSecondWaveNative.test.js.
test('Keyence runtime rejects obsolete body-only zero-inventory overrides',async()=>{const keyence=await loadKeyenceModule();await assert.rejects(keyence.run({fetchText:async()=>officialCareersHtml}),/native HTTP metadata required/)})
