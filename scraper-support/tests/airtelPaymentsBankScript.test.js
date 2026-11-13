import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html>
  <head>
    <title>Airtel Payments Bank: The Safe Second Account for Daily Transactions</title>
  </head>
  <body>
    <h1>Keep Your Main Account Safe</h1>
    <p>Open a Safe Second Account with Airtel Payments Bank</p>
    <p>Empowering Indians, Everywhere.</p>
    <a href="/static/about-us">About Us</a>
    <span>News, Blogs & Awards</span>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html>
  <head>
    <title>About Us | Airtel Payments Bank</title>
  </head>
  <body>
    <h1>About Airtel Payments Bank</h1>
    <p>the parent company's Banking Venture</p>
    <p>As India's first Payments Bank, we aim to give every Indian access to an equal, effective, and trustworthy banking experience.</p>
    <p>Airtel Payments Bank was launched in January 2017, by the parent company, India's largest telecom provider, to support the cashless revolution promised by the Government of India.</p>
    <h2>Meet our board of directors</h2>
  </body>
</html>
`

const careersShellHtml = `
<!doctype html>
<html>
  <head>
    <title>Airtel Careers</title>
    <meta name="description" content="Airtel Careers">
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script src="/static/js/main.123456.js"></script>
  </body>
</html>
`

const bundleText = `
window.__CAREERS_CONFIG__ = {
  "brand":"Airtel Payments Bank",
  "darwinboxURL":"https://airtel.darwinbox.in/ms/candidatev2/main/careers/allJobs",
  "apiUrl":"https://careersapi.airtel.com/"
};
`

const darwinboxShellHtml = `
<!doctype html>
<html>
  <head>
    <base href="/ms/candidatev2/">
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"></script>
    <script type="module" src="db-components.esm.js"></script>
  </head>
  <body></body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/airtelpaymentsbank/script.js')
  } catch {
    assert.fail('Expected Airtel Payments Bank scraper module at ../../scraper/airtelpaymentsbank/script.js')
  }
}

test('Airtel Payments Bank validators accept the verified homepage and the current about-page wording from Saturday, July 25, 2026', async () => {
  const airtel = await loadModule()

  assert.equal(airtel.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(airtel.hasOfficialAboutPageSignal(aboutHtml), true)
  assert.equal(airtel.hasSharedAirtelCareersShellSignal(careersShellHtml), true)
  assert.equal(airtel.hasVerifiedSharedBundleSignal(bundleText), true)
  assert.equal(airtel.hasSharedDarwinboxShellSignal(darwinboxShellHtml), true)
})
