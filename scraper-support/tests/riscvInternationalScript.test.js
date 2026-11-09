import assert from 'node:assert/strict'
import test from 'node:test'

const ABOUT_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>About RISC-V International</h1>
    <p>RISC-V International is the global non-profit home of the open standard RISC-V Instruction Set Architecture (ISA).</p>
    <p>As a non-profit, RISC-V does not maintain any commercial interest in products or services.</p>
  </body>
</html>
`

const JOBS_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Job Board</h1>
    <p>Search for available careers working in RISC-V.</p>
    <button>SUBMIT A JOB</button>
  </body>
</html>
`

const BROKEN_JOBS_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Careers</h1>
    <p>Apply now at RISC-V International.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/riscvinternational/script.js')
  } catch {
    assert.fail('Expected RISC-V International scraper module at ../../scraper/riscvinternational/script.js')
  }
}

test('RISC-V International scraper constants stay pinned to the verified Saturday, July 25, 2026 nonprofit surfaces', async () => {
  const riscvInternational = await loadModule()

  assert.equal(riscvInternational.SOURCE, 'riscvinternational')
  assert.equal(riscvInternational.COMPANY, 'RISC-V International')
  assert.equal(riscvInternational.VERIFIED_ON, '2026-07-25')
  assert.equal(riscvInternational.ABOUT_URL, 'https://riscv.org/about/')
  assert.equal(riscvInternational.JOBS_BOARD_URL, 'https://riscv.org/community/jobs/')
  assert.equal(riscvInternational.hasNonprofitAboutSignal(ABOUT_HTML), true)
  assert.equal(riscvInternational.hasCommunityJobsBoardSignal(JOBS_BOARD_HTML), true)
  assert.equal(riscvInternational.hasCommunityJobsBoardSignal(BROKEN_JOBS_BOARD_HTML), false)
})

test('RISC-V International returns [] while the verified public jobs surface remains a community jobs board', async () => {
  const riscvInternational = await loadModule()
  const requestedUrls = []

  const jobs = await riscvInternational.createRiscVInternationalScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === riscvInternational.ABOUT_URL) return ABOUT_HTML
      if (url === riscvInternational.JOBS_BOARD_URL) return JOBS_BOARD_HTML
      throw new Error(`Unexpected RISC-V International URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    riscvInternational.ABOUT_URL,
    riscvInternational.JOBS_BOARD_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('RISC-V International fails closed when the verified about page or community jobs board changes materially', async () => {
  const riscvInternational = await loadModule()

  await assert.rejects(
    riscvInternational.createRiscVInternationalScraper().run({
      fetchText: async () => JOBS_BOARD_HTML,
    }),
    /about page changed materially/i,
  )

  await assert.rejects(
    riscvInternational.createRiscVInternationalScraper().run({
      fetchText: async (url) => (url === riscvInternational.ABOUT_URL ? ABOUT_HTML : BROKEN_JOBS_BOARD_HTML),
    }),
    /community jobs board changed materially/i,
  )
})
