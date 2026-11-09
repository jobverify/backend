import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head><title>Bhash Softwares</title></head>
  <body>
    <span>Contact Us</span>
    <span>info@bhashsoftware.com</span>
  </body>
</html>
`

const careers404Html = `
<!doctype html>
<html>
  <head><title>Page not found &#8211; Bhash Softwares</title></head>
  <body>
    <h2>404</h2>
    <h3>Oops! Page Not Found</h3>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/bhashsoftwarelabs/script.js')
  } catch {
    assert.fail('Expected Bhash Software Labs scraper module at ../../scraper/bhashsoftwarelabs/script.js')
  }
}

test('Bhash Software Labs validators stay pinned to the verified homepage and careers 404 from Friday, July 17, 2026', async () => {
  const bhash = await loadModule()
  assert.equal(bhash.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(bhash.hasMissingCareersRouteSignal(careers404Html), true)
})

test('Bhash Software Labs run validates the homepage and careers 404 and stays fail-closed', async () => {
  const bhash = await loadModule()
  const jobs = await bhash.createBhashSoftwareLabsScraper().run({
    fetchPage: async (url) => ({
      status: url === bhash.HOMEPAGE_URL ? 200 : 404,
      url,
      html: url === bhash.HOMEPAGE_URL ? homepageHtml : careers404Html,
    }),
  })

  assert.deepEqual(jobs, [])
})
