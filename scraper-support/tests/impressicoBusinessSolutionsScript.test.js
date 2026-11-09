import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-02T12:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Impressico - Career | Current Openings</title>
  </head>
  <body>
    <h2>Current Openings</h2>
    <div class="career-block">
      <h2 class="heading-style3 text-blue">Senior Pre-Sales Consultant</h2>
      <div class="career-detials">
        <p>Location: <strong class="text-blue">Noida</strong></p>
        <p>Experience: <strong class="text-red">12+ Years</strong></p>
        <p>No. Of Openings: <strong>1</strong></p>
      </div>
      <div class="button-wrap">
        <a href="#" class="button-style8 apply-move">Apply Now</a>
        <a href="#ex47390" rel="modal:open" class="button-style8">Details</a>
      </div>
      <div id="ex47390" class="modal career-modal">
        <div class="career-modal-content">
          <h2 class="main-title">Senior Pre-Sales Consultant</h2>
          <div class="scroll-set inner-content">
            <h3>Job Description</h3>
            <ul>
              <li>Lead solution discovery for enterprise deals.</li>
            </ul>
            <h3>Job Specification</h3>
            <ul>
              <li>Strong consultative communication skills.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    <div class="career-block">
      <h2 class="heading-style3 text-blue">Full Stack Developer</h2>
      <div class="career-detials">
        <p>Location: <strong class="text-blue">Noida / Hyderabad </strong></p>
        <p>Experience: <strong class="text-red">4 to 8 Years</strong></p>
        <p>No. Of Openings: <strong>2</strong></p>
      </div>
      <div class="button-wrap">
        <a href="#" class="button-style8 apply-move">Apply Now</a>
        <a href="#ex47450" rel="modal:open" class="button-style8">Details</a>
      </div>
      <div id="ex47450" class="modal career-modal">
        <div class="career-modal-content">
          <h2 class="main-title">Full Stack Developer</h2>
          <div class="scroll-set inner-content">
            <h3>Job Description</h3>
            <ul>
              <li>Build end-to-end product features across frontend and backend systems.</li>
            </ul>
            <h3>Job Specification</h3>
            <ul>
              <li>Hands-on with React, Node.js, and APIs.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
    <select id="wpforms-15259-field_2">
      <option value="47450"> Full Stack Developer</option>
      <option value="47458"> Senior Pre-Sales Consultant</option>
    </select>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/impressicobusinesssolutions/script.js')
  } catch {
    assert.fail('Expected Impressico Business Solutions scraper module at ../../scraper/impressicobusinesssolutions/script.js')
  }
}

test('Impressico Business Solutions validates the first-party openings page and extracts inline cards', async () => {
  const impressico = await loadModule()

  assert.equal(impressico.SOURCE, 'impressicobusinesssolutions')
  assert.equal(impressico.COMPANY, 'Impressico Business Solutions')
  assert.equal(impressico.CAREERS_URL, 'https://www.impressico.com/career/')
  assert.equal(impressico.VERIFIED_ON, '2026-08-02')
  assert.equal(impressico.hasOfficialCareersSignal(careersHtml), true)

  const cards = impressico.extractCareerBlocks(careersHtml)
  assert.equal(cards.length, 2)
  assert.equal(cards[0].title, 'Senior Pre-Sales Consultant')
  assert.equal(cards[1].openings, '2')
})

test('Impressico Business Solutions run returns jobs from inline cards and modal details', async () => {
  const impressico = await loadModule()

  const jobs = await impressico.createImpressicoBusinessSolutionsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async () => careersHtml,
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Senior Pre-Sales Consultant')
  assert.equal(jobs[0].location, 'Noida')
  assert.equal(jobs[0].jobId, '47458')
  assert.match(jobs[0].jobDescription, /solution discovery for enterprise deals/i)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].title, 'Full Stack Developer')
  assert.equal(jobs[1].location, 'Noida / Hyderabad')
  assert.deepEqual(jobs[1].requiredSkills, ['Hands-on with React, Node.js, and APIs.'])
})

test('Impressico Business Solutions fails closed when the verified inline openings contract changes', async () => {
  const impressico = await loadModule()

  await assert.rejects(
    impressico.createImpressicoBusinessSolutionsScraper().run({
      fetchText: async () => '<html><body><h1>Career</h1></body></html>',
    }),
    /verified impressico careers surface/i,
  )
})
