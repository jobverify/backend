import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/stackpath/script.js')
  } catch {
    assert.fail('Expected StackPath scraper module at ../../scraper/stackpath/script.js')
  }
}

const VERIFIED_ROOT_HTML = `<!DOCTYPE html>
<html>
<body style="background-color:#0a0100;">
<h1 style="text-align:center;" id="isPasted"><span style="color: rgb(255, 255, 255);"><strong><span style="font-size: 96px;"></span></strong></span></h1>
<h2 style="text-align:center;"><strong><span style="font-size: 32px; color: rgb(255, 255, 255);"></span></strong></h2>
</body>
</html>`

const VERIFIED_404_HTML = `<!DOCTYPE html>
<html>
<body style="background-color:#0a0100;">
<h1 style="text-align:center;" id="isPasted"><span style="color: rgb(255, 255, 255);"><strong><span style="font-size: 96px;">404 ERROR</span></strong></span></h1>
<h2 style="text-align:center;"><strong><span style="font-size: 32px; color: rgb(255, 255, 255);">Sorry the page you are looking is no longer here.</span></strong></h2>
</body>
</html>`

test('StackPath helper predicates recognize the verified sentinel surfaces', async () => {
  const stackPath = await loadModule()

  assert.equal(stackPath.hasVerifiedRootShell(VERIFIED_ROOT_HTML), true)
  assert.equal(
    stackPath.isVerifiedMissingJobRoute({ status: 404, html: VERIFIED_404_HTML }),
    true,
  )
  assert.equal(
    stackPath.isUnexpectedReachableSurface({ status: 200, html: '<html><body>Jobs</body></html>' }),
    true,
  )
})

test('StackPath run verifies the exact-name root and common careers routes before returning []', async () => {
  const stackPath = await loadModule()
  const requestedUrls = []

  const jobs = await stackPath.createStackPathScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)

      if (url === stackPath.FIRST_PARTY_ROOT_URL) {
        return {
          url,
          finalUrl: url,
          status: 200,
          html: VERIFIED_ROOT_HTML,
          errorKind: null,
        }
      }

      return {
        url,
        finalUrl: url,
        status: 404,
        html: VERIFIED_404_HTML,
        errorKind: null,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.stackpath.com/',
    'https://www.stackpath.com/careers',
    'https://www.stackpath.com/jobs',
    'https://www.stackpath.com/about/careers',
  ])
  assert.deepEqual(jobs, [])
})

test('StackPath fails closed when a common careers route becomes reachable', async () => {
  const stackPath = await loadModule()

  await assert.rejects(
    stackPath.createStackPathScraper().run({
      probeUrl: async (url) => {
        if (url === stackPath.FIRST_PARTY_ROOT_URL) {
          return {
            url,
            finalUrl: url,
            status: 200,
            html: VERIFIED_ROOT_HTML,
            errorKind: null,
          }
        }

        return {
          url,
          finalUrl: url,
          status: 200,
          html: '<html><body><a href="/careers/software-engineer">Software Engineer</a></body></html>',
          errorKind: null,
        }
      },
    }),
    /public jobs surface/i,
  )
})
