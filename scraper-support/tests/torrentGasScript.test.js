import assert from 'node:assert/strict'
import test from 'node:test'

const loadTorrentGasModule = async () => {
  try {
    return await import('../../scraper/torrentgas/script.js')
  } catch {
    assert.fail('Expected Torrent Gas scraper module at ../../scraper/torrentgas/script.js')
  }
}

const officialCareersShellHtml = `
<!doctype html>
<html lang="en-US" class="st-layout ls-top-navbar ls-bottom-footer">
  <head>
    <title>Careers @ Torrent Gas</title>
  </head>
  <body class="survey breakpoint-1024">
    <div class="panel-body">
      <h3><b>Our way of life</b></h3>
      <p>Any Organization's growth depends upon the dedication and synergy of its employees.</p>
      <p>
        <b>
          To apply simply chose your preferred Job Department as well as Post, and "Apply".
          You can view the position details in "View Detail".
        </b>
      </p>
      <p>
        <b>
          To apply for multiple positions, kindly login to your account with valid email ID
          and password and then click "Apply" on your preferred position.
        </b>
      </p>
    </div>
    <!--<div class="col-lg-1 tcolor">
      <label>Location:</label>
    </div>
    <div class="col-lg-1 text-right tcolor">
      <label>Title:</label>
    </div>
    <div class="col-lg-1 tcolor">
      <label>Department:</label>
    </div>-->
    <a href="/index.php/site/login"><i class="fa fa-user"></i> Log In</a>
    <footer>
      <strong>Torrent Gas.</strong> v1.0
    </footer>
  </body>
</html>
`

const officialLoginGateHtml = `
<!doctype html>
<html lang="en-US" class="st-layout ls-top-navbar ls-bottom-footer">
  <head>
    <title>Careers @ Torrent Gas</title>
  </head>
  <body class="login breakpoint-1024">
    <div class="lock-container">
      <h1>Account Access</h1>
      <form id="login-form" action="/index.php/site/login" method="post">
        <input type="text" name="LoginForm[login_username]" placeholder="Email Id" />
        <input type="password" name="LoginForm[login_password]" placeholder="Password" />
        <input type="text" name="LoginForm[captcha]" />
        <a href="/index.php/site/forgotpassword">Forgot Password?</a>
      </form>
    </div>
    <footer>
      <strong>Torrent Gas.</strong> v1.0
    </footer>
  </body>
</html>
`

test('Torrent Gas scraper recognizes the verified careers shell and login gate', async () => {
  const torrentGas = await loadTorrentGasModule()

  assert.equal(torrentGas.CAREERS_URL, 'https://careers.torrentgas.com/')
  assert.equal(torrentGas.LOGIN_URL, 'https://careers.torrentgas.com/index.php/site/login')
  assert.equal(torrentGas.hasOfficialCareersShellSignal(officialCareersShellHtml), true)
  assert.equal(torrentGas.hasNoPublicJobListingsSignal(officialCareersShellHtml), true)
  assert.equal(torrentGas.hasOfficialLoginGateSignal(officialLoginGateHtml), true)
})

test('Torrent Gas scraper returns no jobs when the verified public careers shell only exposes the login gate', async () => {
  const torrentGas = await loadTorrentGasModule()
  const requestedUrls = []

  const jobs = await torrentGas.createTorrentGasScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === torrentGas.CAREERS_URL) return officialCareersShellHtml
      if (url === torrentGas.LOGIN_URL) return officialLoginGateHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    torrentGas.CAREERS_URL,
    torrentGas.LOGIN_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Torrent Gas scraper fails closed when the verified careers shell or login gate changes', async () => {
  const torrentGas = await loadTorrentGasModule()

  await assert.rejects(
    torrentGas.createTorrentGasScraper().run({
      fetchText: async (url) => {
        if (url === torrentGas.CAREERS_URL) {
          return `
            ${officialCareersShellHtml}
            <a href="/index.php/job/detail/42">View Detail</a>
            <button type="button">Apply</button>
          `
        }

        if (url === torrentGas.LOGIN_URL) return officialLoginGateHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public careers surface now exposes openings or changed shape/i,
  )

  await assert.rejects(
    torrentGas.createTorrentGasScraper().run({
      fetchText: async (url) => {
        if (url === torrentGas.CAREERS_URL) return officialCareersShellHtml
        if (url === torrentGas.LOGIN_URL) return '<html><title>Unexpected</title></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /login gate no longer matches the verified public careers access surface/i,
  )
})
