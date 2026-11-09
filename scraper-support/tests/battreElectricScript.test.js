import assert from 'node:assert/strict'
import test from 'node:test'

const loadBattreModule = async () => {
  try {
    return await import('../../scraper/battreelectric/script.js')
  } catch {
    assert.fail('Expected BattRE Electric scraper module at ../../scraper/battreelectric/script.js')
  }
}

test('BattRE Electric returns [] when the current official surface is unreachable via repeated connect timeouts', async () => {
  const battre = await loadBattreModule()

  assert.equal(
    battre.isBlockedNetworkError(new Error('fetch failed', {
      cause: {
        message: 'Connect Timeout Error (attempted address: battre.in:443, timeout: 10000ms)',
        code: 'UND_ERR_CONNECT_TIMEOUT',
      },
    })),
    true,
  )

  const jobs = await battre.createBattreelectricScraper().run({
    fetchText: async () => {
      throw new Error('fetch failed', {
        cause: {
          message: 'Connect Timeout Error (attempted address: battre.in:443, timeout: 10000ms)',
          code: 'UND_ERR_CONNECT_TIMEOUT',
        },
      })
    },
  })

  assert.deepEqual(jobs, [])
})

test('BattRE Electric still fails closed when the homepage becomes a public jobs surface', async () => {
  const battre = await loadBattreModule()

  await assert.rejects(
    battre.createBattreelectricScraper().run({
      fetchText: async () => `
        <html>
          <body>
            <h1>Batt:RE Electric Mobility</h1>
            <a href="/careers">Careers</a>
          </body>
        </html>
      `,
    }),
    /verified first-party surface changed materially/i,
  )
})
