import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  HOMEPAGE_URL,
  createEramScraper,
  validateCareerHomepage,
  validateNoOpeningsPage,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Eram Holdings</title>
    </head>
    <body>
      <header>
        <nav>
          <a href="index.php">Home</a>
          <a href="aboutus.php">Profile</a>
          <a href="career.php">Careers</a>
        </nav>
      </header>
      <main>
        <h1>Construction &amp; Industrial Solutions</h1>
        <p>Eram Holdings has its global headquarters in Al Khobar, Saudi Arabia.</p>
      </main>
    </body>
  </html>
`

const careerPageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Eram Holdings</title>
    </head>
    <body>
      <header>
        <nav>
          <a href="career.php">Careers</a>
        </nav>
      </header>
      <section class="career-intro">
        <h3>Reason To Join Eram Holdings</h3>
        <p>Guaranteed career progress</p>
        <h3>We Work Together</h3>
        <p>Foster a spirit of responsibility, teamwork and excellence in the organization.</p>
      </section>
      <form id="career-form">
        <input id="Name" name="Name" />
        <input id="Email" name="Email" />
        <input id="Phone" name="Phone" />
        <input id="captcha" name="captcha" />
        <button type="submit" onClick="ajax_contact(event);">Submit</button>
      </form>
      <script>
        $.ajax({
          url:'php_functionCarrier.php',
          type: 'POST'
        });
      </script>
    </body>
  </html>
`

test('validates the official ERAM homepage and application-only career page', async () => {
  const requestedUrls = []
  const scraper = createEramScraper()

  assert.equal(HOMEPAGE_URL, 'https://eramholdings.com/')
  assert.equal(CAREER_PAGE_URL, 'https://eramholdings.com/career.php')
  assert.equal(validateCareerHomepage(homepageHtml), true)
  assert.equal(validateNoOpeningsPage(careerPageHtml), true)

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREER_PAGE_URL) return careerPageHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})

test('fails closed when the official ERAM homepage signal changes', async () => {
  await assert.rejects(
    createEramScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) {
          return '<html><head><title>Placeholder</title></head><body>No careers link</body></html>'
        }

        return careerPageHtml
      },
    }),
    /ERAM homepage no longer matches the verified official careers surface/i,
  )
})

test('fails closed when the ERAM application-only career page shape changes', async () => {
  await assert.rejects(
    createEramScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === CAREER_PAGE_URL) return '<html><body><h1>Open Positions</h1></body></html>'

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /ERAM careers page no longer exposes the expected no-openings page shape/i,
  )
})
