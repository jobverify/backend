import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const execFileAsync = promisify(execFile)

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Arjuna Research and Financial Services Pvt Ltd scraper module at ./script.js')
  }
}

test('Arjuna Research and Financial Services Pvt Ltd sentinel pins the verified no-first-party-host surface', async () => {
  const arjuna = await loadModule()

  assert.equal(arjuna.SOURCE, 'arjunaresearchandfinancialservicespvtltd')
  assert.equal(arjuna.COMPANY, 'Arjuna Research and Financial Services Pvt Ltd')
  assert.equal(arjuna.VERIFIED_ON, '2026-07-13')
  assert.equal(
    arjuna.VERIFIED_SURFACE_SUMMARY,
    'No trustworthy first-party careers surface was discoverable on July 13, 2026, and the canonical company hostnames did not resolve.',
  )
  assert.equal(arjuna.DNS_LOOKUP_TIMEOUT_MS, 5000)
  assert.deepEqual(arjuna.CAREER_HOSTS, [
    'arjunaresearch.com',
    'www.arjunaresearch.com',
    'arjunaresearch.in',
    'www.arjunaresearch.in',
    'arjunaresearchandfinancialservices.com',
    'www.arjunaresearchandfinancialservices.com',
    'arjunaresearchandfinancialservices.in',
    'www.arjunaresearchandfinancialservices.in',
  ])
  assert.equal(arjuna.hasResolvableFirstPartyHost([]), false)
  assert.equal(arjuna.hasResolvableFirstPartyHost(['104.21.0.1']), true)
})

test('Arjuna Research and Financial Services Pvt Ltd sentinel returns no jobs only while the verified first-party hosts remain unresolved', async () => {
  const arjuna = await loadModule()
  const calls = []

  const jobs = await arjuna.createArjunaResearchAndFinancialServicesScraper().run({
    resolveHosts: async (hosts) => {
      calls.push([...hosts])
      return []
    },
  })

  assert.deepEqual(calls, [arjuna.CAREER_HOSTS])
  assert.deepEqual(jobs, [])
})

test('Arjuna Research and Financial Services Pvt Ltd sentinel treats slow DNS lookups as unresolved instead of hanging the runner', async () => {
  const arjuna = await loadModule()
  const pendingLookup = () => new Promise(() => {})

  const addresses = await arjuna.resolveCanonicalHosts(['arjunaresearch.com'], {
    resolveIpv4: pendingLookup,
    resolveIpv6: pendingLookup,
    lookupTimeoutMs: 1,
  })

  assert.deepEqual(addresses, [])
})

test('Arjuna Research and Financial Services Pvt Ltd sentinel contains later DNS lookup rejections so they cannot crash the process', async () => {
  const script = `
    import { resolveCanonicalHosts } from './script.js'

    const never = async () => new Promise(() => {})
    const failIpv6 = async (host) => {
      const error = new Error(\`queryAaaa ENOTFOUND \${host}\`)
      error.code = 'ENOTFOUND'
      throw error
    }

    const addresses = await resolveCanonicalHosts(['arjunaresearchandfinancialservices.in'], {
      resolveIpv4: never,
      resolveIpv6: failIpv6,
      lookupTimeoutMs: 10,
    })

    console.log(JSON.stringify(addresses))
  `

  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    ['--input-type=module', '-e', script],
    { cwd: currentDir },
  )

  assert.equal(stderr, '')
  assert.equal(stdout.trim(), '[]')
})

test('Arjuna Research and Financial Services Pvt Ltd sentinel fails closed when any canonical first-party hostname starts resolving', async () => {
  const arjuna = await loadModule()

  await assert.rejects(
    arjuna.createArjunaResearchAndFinancialServicesScraper().run({
      resolveHosts: async () => ['104.21.0.1'],
    }),
    /Arjuna Research and Financial Services Pvt Ltd canonical first-party hosts now resolve/i,
  )
})
