import assert from 'node:assert/strict'
import test from 'node:test'

const officialCurrentOpeningsHtml = `
  <main>
    <h1>WORK WITH US</h1>
    <h2>We are looking for exceptional talent</h2>
    <p>If you are interested in embarking on a career at Sagacious then contact us at careers@sagaciousresearch.com.</p>

    <section>
      <p>Accounts Team</p>
      <h3>Senior Executive- Accounts Receivable</h3>
      <ul>
        <li>Gurugram (India)</li>
        <li>Full-Time from Office</li>
        <li>Experience: 2 -4 years</li>
      </ul>
      <a href="https://sagaciousresearch.com/apply/accounts-receivable">Apply Now</a>
    </section>

    <section>
      <p>Engineering Searching Team</p>
      <h3>Patent Analyst</h3>
      <ul>
        <li>Gurugram, Nagpur (India)</li>
        <li>Full-Time from Office</li>
        <li>Experience: 1 - 2 years</li>
      </ul>
      <a href="https://sagaciousresearch.com/apply/patent-analyst">Apply Now</a>
    </section>

    <section>
      <p>ICT Licensing Team</p>
      <h3>Project Manager</h3>
      <ul>
        <li>Gurugram, Nagpur, Bangalore (India)</li>
        <li>Hybrid/Remote; Full-time/Part-time</li>
        <li>Experience: 2 - 5 years</li>
      </ul>
      <a href="https://sagaciousresearch.com/apply/project-manager">Apply Now</a>
    </section>
  </main>
`

test('Sagacious Research retains historical summary cards as insufficient legacy input, not current native vacancies', async () => {
  const sagaciousResearch = await import('../../scraper/sagaciousresearch/script.js')
  assert.equal(sagaciousResearch.hasOfficialCareersSignal(officialCurrentOpeningsHtml), true)
  await assert.rejects(sagaciousResearch.createSagaciousResearchScraper().run({
    fetchText: async () => officialCurrentOpeningsHtml,
  }), /legacy text-only transport|full native role criteria/i)
})
test('Sagacious Research refuses to scrape when the official careers surface changes', async () => {
  const sagaciousResearch = await import('../../scraper/sagaciousresearch/script.js')

  await assert.rejects(
    sagaciousResearch.createSagaciousResearchScraper().run({
      fetchImpl: async url => { const response = new Response('<html><body>Unrelated site</body></html>'); Object.defineProperty(response, 'url', { value: url }); return response },
    }),
    /official careers surface/i,
  )
})
