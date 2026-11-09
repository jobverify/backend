import assert from 'node:assert/strict'
import test from 'node:test'

const tricogModule = await import('../../scraper/tricog/script.js').catch(() => ({}))

const {
  CAREERS_URL,
  COMPANY,
  SOURCE,
  VERIFIED_RESUME_INTAKE_CONTRACT,
  createTricogScraper,
  run,
} = tricogModule

const verifiedResumeIntakeHtml = `
  <main>
    <h1>Careers</h1>
    <section>
      <h2>Share your resume!</h2>
      <p>
        If you don't see a role that matches your interests, feel free to share
        your details
      </p>
      <form aria-label="Job Application Form">
        <h3>Job Application Form</h3>
        <label>Name <input type="text" name="name" /></label>
        <label>Email <input type="email" name="email" /></label>
        <label>Phone Number <input type="tel" name="phone" /></label>
        <label>
          Position Interested In
          <input type="text" name="position" />
        </label>
        <label>
          Upload Your Resume
          <input type="file" name="resume" />
        </label>
      </form>
    </section>
  </main>
`

test('batch 05 Tricog verified resume-intake surface remains fail-closed', async () => {
  assert.equal(SOURCE, 'tricog')
  assert.equal(COMPANY, 'Tricog')
  assert.equal(CAREERS_URL, 'https://tricog.com/careers/')
  assert.match(VERIFIED_RESUME_INTAKE_CONTRACT, /resume-intake-only/i)

  const scraper = createTricogScraper()
  const jobs = await scraper.run({
    fetchHtml: async (url) => {
      assert.equal(url, CAREERS_URL)
      return verifiedResumeIntakeHtml
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(
    await run({
      fetchHtml: async () => verifiedResumeIntakeHtml,
    }),
    [],
  )
})

test('batch 05 Tricog rejects when the verified resume-intake contract is missing', async () => {
  const scraper = createTricogScraper()

  await assert.rejects(
    async () =>
      scraper.run({
        fetchHtml: async () => `
          <main>
            <h1>Careers</h1>
            <form>
              <h2>Job Application Form</h2>
              <label>Name <input /></label>
            </form>
          </main>
        `,
      }),
    /verified resume-intake-only contract/i,
  )
})

test('batch 05 Tricog rejects when a public first-party jobs surface appears', async () => {
  const scraper = createTricogScraper()

  await assert.rejects(
    async () =>
      scraper.run({
        fetchHtml: async () => `
          ${verifiedResumeIntakeHtml}
          <section>
            <h2>Current Openings</h2>
            <a href="/careers/senior-backend-engineer">Senior Backend Engineer</a>
          </section>
        `,
      }),
    /public first-party job listings/i,
  )
})
