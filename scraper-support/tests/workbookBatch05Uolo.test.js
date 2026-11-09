import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_SURFACE_HTML = `
  <html>
    <body>
      <main>
        <h1>Set up your students</h1>
        <h1>for success!</h1>
        <p>Help build essential skills with our scholastic programs</p>
        <h2>Uolo revolutionises the school system with learning programs</h2>
        <p>Largest edtech company of India &amp; South-East Asia, partnering with private schools to drive impactful learning programs</p>
        <p>Get in touch with us</p>
      </main>
      <footer>
        <a href="https://www.linkedin.com/company/uolo/jobs/">Careers</a>
        <p>All rights reserved with Uolo EdTech Private Limited</p>
      </footer>
    </body>
  </html>
`

const loadUoloModule = async () => {
  try {
    return await import('../../scraper/uolo/script.js')
  } catch {
    assert.fail('Expected Uolo scraper module at ../../scraper/uolo/script.js')
  }
}

test('Uolo validates the verified exact-name public surface and LinkedIn careers handoff before returning []', async () => {
  const uolo = await loadUoloModule()
  let requestedUrl = null

  const jobs = await uolo.run({
    fetchHtml: async (url) => {
      requestedUrl = url
      return VERIFIED_SURFACE_HTML
    },
  })

  assert.equal(requestedUrl, uolo.CAREERS_URL)
  assert.deepEqual(jobs, [])
  assert.equal(uolo.SOURCE, 'uolo')
  assert.equal(uolo.COMPANY, 'Uolo')
  assert.equal(uolo.CAREERS_URL, 'https://www.uolo.com/')
  assert.equal(
    uolo.LINKEDIN_COMPANY_URL,
    'https://www.linkedin.com/company/uolo/jobs/',
  )
  assert.equal(
    uolo.DISPOSITION,
    'verified-exact-name-public-company-surface-with-linkedin-handoff',
  )
})

test('Uolo rejects when the verified exact-name public company surface disappears', async () => {
  const uolo = await loadUoloModule()

  await assert.rejects(
    uolo.run({
      fetchHtml: async () => `
        <html>
          <body>
            <main>
              <h1>Careers</h1>
              <p>Explore opportunities with us.</p>
            </main>
          </body>
        </html>
      `,
    }),
    /verified exact-name public company surface/i,
  )
})

test('Uolo rejects when the verified LinkedIn careers handoff changes', async () => {
  const uolo = await loadUoloModule()

  await assert.rejects(
    uolo.run({
      fetchHtml: async () => `
        <html>
          <body>
            <main>
              <h1>Set up your students</h1>
              <h1>for success!</h1>
              <h2>Uolo revolutionises the school system with learning programs</h2>
              <p>Get in touch with us</p>
            </main>
            <footer>
              <a href="https://www.linkedin.com/company/other-company/jobs/">Careers</a>
              <p>All rights reserved with Uolo EdTech Private Limited</p>
            </footer>
          </body>
        </html>
      `,
    }),
    /linkedin careers handoff/i,
  )
})

test('Uolo rejects when the public company surface starts exposing a public jobs surface', async () => {
  const uolo = await loadUoloModule()

  await assert.rejects(
    uolo.run({
      fetchHtml: async () => `
        ${VERIFIED_SURFACE_HTML}
        <a href="/jobs/founding-engineer">Founding Engineer</a>
      `,
    }),
    /public jobs surface/i,
  )
})
