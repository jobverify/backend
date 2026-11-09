import assert from 'node:assert/strict'
import test from 'node:test'

const REDIRECT_SHELL_HTML = `
<!DOCTYPE html>
<html>
  <head>
    <script>window.onload=function(){window.location.href="/lander"}</script>
  </head>
</html>
`

const PARKED_LANDER_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <script>window.LANDER_SYSTEM="PW"</script>
    <script>window._trfd=window._trfd||[],window._trfd.push({ap:"parking"})</script>
  </head>
  <body><div id="root"></div></body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/objectfrontiersoftware/script.js')
  } catch {
    assert.fail('Expected Object Frontier Software scraper module at ../../scraper/objectfrontiersoftware/script.js')
  }
}

test('Object Frontier Software sentinel helpers stay pinned to the redirect shell and parked lander', async () => {
  const ofs = await loadModule()

  assert.equal(ofs.isRedirectToLanderShell(REDIRECT_SHELL_HTML), true)
  assert.equal(ofs.isParkedLanderShell(PARKED_LANDER_HTML), true)
  assert.equal(
    ofs.pageExposesPublicJobs('<html><body><a href="/jobs/software-engineer">Software Engineer</a></body></html>'),
    true,
  )
})

test('Object Frontier Software run validates the redirect shell and parked lander before returning []', async () => {
  const ofs = await loadModule()
  const requestedUrls = []

  const jobs = await ofs.createObjectFrontierSoftwareScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === ofs.HOMEPAGE_URL) return { status: 200, url, html: REDIRECT_SHELL_HTML }
      if (url === ofs.CAREERS_URL) return { status: 200, url, html: REDIRECT_SHELL_HTML }
      if (url === ofs.PARKED_LANDER_URL) return { status: 200, url, html: PARKED_LANDER_HTML }
      throw new Error(`Unexpected Object Frontier URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [ofs.HOMEPAGE_URL, ofs.CAREERS_URL, ofs.PARKED_LANDER_URL])
  assert.deepEqual(jobs, [])
})

test('Object Frontier Software fails closed when the exact-name surface stops being parked', async () => {
  const ofs = await loadModule()

  await assert.rejects(
    ofs.createObjectFrontierSoftwareScraper().run({
      fetchPage: async (url) => {
        if (url === ofs.PARKED_LANDER_URL) return { status: 200, url, html: PARKED_LANDER_HTML }
        return { status: 200, url, html: '<html><body><a href="/jobs/software-engineer">Software Engineer</a></body></html>' }
      },
    }),
    /public jobs|trusted exact-name surface/i,
  )
})
