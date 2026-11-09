import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <nav>
      <a href="/Index.html">Home</a>
      <a href="/Solutions.html">Solutions</a>
      <a href="/About.html">About</a>
      <a href="/Contact-Us.html">Contact Us</a>
    </nav>
    <h1>Transforming Healthcare with AI-Powered Solutions</h1>
    <p>Bringing automation, efficiency, and patient-centered care across the healthcare continuum.</p>
    <p>Operations Team</p>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>About Vistec Partners</h1>
    <p>At Vistec Partners, we are reimagining the future of healthcare.</p>
    <p>Schedule a Consultation</p>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Contact Us</h1>
    <p>Vistec Partners</p>
    <p>Noida, India</p>
    <p>contact@vistecpartners.com</p>
    <nav>
      <a href="/Solutions.html">Solutions</a>
      <a href="/About.html">About</a>
      <a href="/Contact-Us.html">Contact Us</a>
    </nav>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/ivistecpartnersindiaprivatelimited/script.js')
  } catch {
    assert.fail(
      'Expected iVistec Partners India Private Limited scraper module at ../../scraper/ivistecpartnersindiaprivatelimited/script.js',
    )
  }
}

test('iVistec Partners India Private Limited keeps the verified no-careers sentinel checks pinned', async () => {
  const ivistec = await loadModule()

  assert.equal(ivistec.HOMEPAGE_URL, 'https://vistecpartners.com/Index.html')
  assert.equal(ivistec.ABOUT_URL, 'https://vistecpartners.com/About.html')
  assert.equal(ivistec.CONTACT_URL, 'https://vistecpartners.com/Contact-Us.html')
  assert.equal(ivistec.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(ivistec.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(ivistec.hasOfficialContactSignal(contactHtml), true)
  assert.equal(ivistec.hasNoPublicCareersSignal(homepageHtml), true)
  assert.equal(ivistec.hasNoPublicCareersSignal(contactHtml), true)
})

test('iVistec Partners India Private Limited run stays fail-closed while the official site exposes no careers surface', async () => {
  const ivistec = await loadModule()
  const requestedUrls = []

  const jobs = await ivistec.createIvistecPartnersIndiaPrivateLimitedScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === ivistec.HOMEPAGE_URL) return homepageHtml
      if (url === ivistec.ABOUT_URL) return aboutHtml
      if (url === ivistec.CONTACT_URL) return contactHtml
      throw new Error(`Unexpected iVistec URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [ivistec.HOMEPAGE_URL, ivistec.ABOUT_URL, ivistec.CONTACT_URL])
  assert.deepEqual(jobs, [])
})

test('iVistec Partners India Private Limited fails closed when a public careers route appears', async () => {
  const ivistec = await loadModule()

  await assert.rejects(
    ivistec.createIvistecPartnersIndiaPrivateLimitedScraper().run({
      fetchText: async (url) => {
        if (url === ivistec.HOMEPAGE_URL) {
          return homepageHtml.replace(
            '</nav>',
            '<a href="/Careers.html">Careers</a></nav>',
          )
        }
        if (url === ivistec.ABOUT_URL) return aboutHtml
        return contactHtml
      },
    }),
    /public careers surface/i,
  )
})
