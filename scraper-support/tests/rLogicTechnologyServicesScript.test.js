import assert from 'node:assert/strict'
import test from 'node:test'

const careersCultureHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &amp; Culture - R-Logic</title>
  </head>
  <body>
    <h5>CAREERS AND CULTURE</h5>
    <h2>Your Curiosity, Your Skills, Your Growth</h2>
    <a href="/careers-culture/">See Life at R-Logic</a>
    <p>Employee Stories</p>
    <h5>A Day in the Life at R-Logic</h5>
    <h2>Passion. Purpose. Possibility.</h2>
    <h5>Join Our Team</h5>
    <h2>Build What Matters. Create What's Next.</h2>
    <p>Bring your curiosity, test your ideas, and shape the next chapter of your career with us.</p>
    <a class="elementor-button elementor-button-link elementor-size-sm" href="/contact-us/">
      <span class="elementor-button-text">Get Started</span>
    </a>
  </body>
</html>
`

const contactHandoffHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Us - R-Logic</title>
  </head>
  <body>
    <h2>Let's Build What's Next Together</h2>
    <h4>Careers at R-Logic</h4>
    <p>Explore roles, growth paths, and what life is like in our teams.</p>
    <a href="https://landbot.pro/example-rlogic-careers">Let's Talk</a>
    <a href="https://wa.link/example-rlogic-careers">WhatsApp</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/rlogictechnologyservices/script.js')
  } catch {
    assert.fail('Expected R-Logic Technology Services scraper module at ../../scraper/rlogictechnologyservices/script.js')
  }
}

test('R-Logic Technology Services validates the first-party careers-culture contact handoff surface', async () => {
  const rlogic = await loadModule()

  assert.equal(rlogic.SOURCE, 'rlogictechnologyservices')
  assert.equal(rlogic.COMPANY, 'R-Logic Technology Services')
  assert.equal(rlogic.CAREERS_CULTURE_URL, 'https://www.r-logic.com/careers-culture/')
  assert.equal(rlogic.CONTACT_URL, 'https://www.r-logic.com/contact-us/')
  assert.equal(rlogic.VERIFIED_ON, '2026-08-04')
  assert.equal(rlogic.hasOfficialCareersCultureSignal(careersCultureHtml), true)
  assert.equal(rlogic.hasOfficialContactHandoffSignal(contactHandoffHtml), true)
})

test('R-Logic Technology Services returns no jobs when the verified page only hands candidates to contact-us', async () => {
  const rlogic = await loadModule()

  const jobs = await rlogic.createRLogicTechnologyServicesScraper().run({
    fetchText: async (url) => {
      if (url === rlogic.CAREERS_CULTURE_URL) return careersCultureHtml
      if (url === rlogic.CONTACT_URL) return contactHandoffHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('R-Logic Technology Services fails closed if the page starts exposing direct openings', async () => {
  const rlogic = await loadModule()

  await assert.rejects(
    rlogic.createRLogicTechnologyServicesScraper().run({
      fetchText: async (url) => {
        if (url === rlogic.CAREERS_CULTURE_URL) {
          return `${careersCultureHtml}<a href="https://www.r-logic.com/careers-culture/senior-engineer">Apply Now</a>`
        }

        if (url === rlogic.CONTACT_URL) return contactHandoffHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )
})
