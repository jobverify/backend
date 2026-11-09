import assert from 'node:assert/strict'
import test from 'node:test'

const CURRENT_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Cloudphysician | Transforming Healthcare with Cutting-Edge Technology</title>
    <link rel="icon" href="assets/favicon.ico" />
  </head>
  <body>
    <h1>Careers at Cloudphysician</h1>
    <p>You can't care about people without caring about your own.</p>
    <p>Patient care is at the center of what we do.</p>
    <p>We push boundaries with our cutting-edge technology.</p>
    <h2>Open positions</h2>
    <h3>Clinical</h3>
    <h3>Technology</h3>
    <h3>Business</h3>
    <h3>Business Enablers</h3>
    <a href="v;">Decorative Vector Hook</a>
    <a href="/careers">Careers</a>
    <a href="mailto:careers@cloudphysician.net">Apply now</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/cloudphysician/script.js')
  } catch {
    assert.fail('Expected Cloudphysician workbook scraper module at ../../scraper/cloudphysician/script.js')
  }
}

test('Cloudphysician ignores malformed same-page href tokens and self-links when no trustworthy public jobs board exists', async () => {
  const cloudphysician = await loadModule()

  assert.doesNotThrow(() => cloudphysician.assertVerifiedPublicCareersSurface(CURRENT_CAREERS_HTML))
  assert.equal(
    cloudphysician.extractVerifiedApplyNowUrl(CURRENT_CAREERS_HTML),
    'mailto:careers@cloudphysician.net',
  )
  assert.doesNotThrow(() =>
    cloudphysician.assertNoUnexpectedPublicJobsSurface(CURRENT_CAREERS_HTML, cloudphysician.CAREERS_URL),
  )
})
