import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261118.json.gz', import.meta.url))))
const replay = change => {
  let index = 0
  return { fetchImpl: async (url, init) => {
    const packet = structuredClone(fixture.responses[index++])
    assert.ok(packet, 'read stays within the captured public inventory')
    assert.equal(url, packet.requestedUrl)
    assert.equal(init.method, 'GET')
    change?.(packet, index)
    return Object.defineProperty(new Response(packet.text, { status: packet.status, headers: packet.headers }), 'url', { value: packet.finalUrl })
  }, requestIntervalMs: 0 }
}

const changePosting = (html, id, update) => {
  let found = 0
  const changed = html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,
    (original, start, raw, end) => {
      const value = JSON.parse(raw)
      if (value['@type'] !== 'JobPosting' || value.identifier?.value !== id) return original
      found++
      update(value)
      return start + JSON.stringify(value) + end
    })
  assert.equal(found, 1, 'the same authoritative posting is edited in each listing')
  return changed
}

test('Zeon retains two qualified own roles when a held foreign-employer application has unrelated Flight ordering drift', async () => {
  const jobs = await run(replay())
  assert.deepEqual(jobs.map(job => job.jobId), ['186003', '186004'])
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete === true
    && job.jobDescription === job.nativeJobPosting.description))
  assert.equal(jobs.nativeCollectionEvidence.heldRecords.length, 1)
  assert.match(jobs.nativeCollectionEvidence.heldRecords[0].sourceDescription, /Zeon International/)
  assert.equal(jobs.nativeCollectionEvidence.closingFullNativeModelsMatch, false)
  assert.equal(jobs.nativeCollectionEvidence.qualifiedRoleModelsClosingMatch, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('Zeon holds an individual changed application while preserving the other independently reconciled role', async () => {
  const jobs = await run(replay((packet, index) => {
    if (index > 13 && packet.requestedUrl.endsWith('job_id=186003')) packet.text += '<!-- changed own role context -->'
  }))
  assert.deepEqual(jobs.map(job => job.jobId), ['186004'])
  assert.equal(jobs.nativeCollectionEvidence.heldRecords.length, 2)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('Zeon rejects a changed publisher or listing before treating any role as independently reconciled', async () => {
  for (const target of ['https://zeoncharging.com/', 'https://zeoncharging.com/careers']) {
    await assert.rejects(run(replay((packet, index) => {
      if (index > 13 && packet.requestedUrl === target) packet.text += '<!-- changed publisher context -->'
    })), error => {
      assert.equal(error.nativeCollectionEvidence.sourceScopeComplete, false)
      assert.equal(error.nativeCollectionEvidence.lifecycleCleanupAllowed, false)
      assert.ok(error.nativeCollectionEvidence.observedOriginals.length > 0)
      return true
    })
  }
})

test('Zeon all-held criteria cannot become a verified empty India inventory', async () => {
  const jobs = await run(replay((packet, index) => {
    if (index > 13 && /job_id=18600[34]$/.test(packet.requestedUrl)) packet.text += '<!-- changed role context -->'
  }))
  assert.equal(jobs.length, 0)
  assert.equal(jobs.nativeCollectionEvidence.heldRecords.length, 3)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('Zeon never promotes a foreign employer, foreign country, invalid date or criteria preview', async () => {
  const changes = [
    text => text.replaceAll('"name":"Zeon Charging"', '"name":"Other Employer"'),
    text => text.replaceAll('"addressCountry":"IN"', '"addressCountry":"US"'),
    text => text.replaceAll('"datePosted":"2026-09-11"', '"datePosted":"2026-02-30"'),
    text => text.replaceAll('Requirements', 'Partial Preview'),
  ]
  for (const change of changes) {
    const jobs = await run(replay(packet => {
      if (packet.requestedUrl === 'https://zeoncharging.com/careers') {
        const changed = change(packet.text)
        assert.notEqual(changed, packet.text, 'negative control must alter the captured publisher')
        packet.text = changed
      }
    }))
    assert.ok(!jobs.some(job => job.jobId === '186003'))
    assert.ok(jobs.nativeCollectionEvidence.heldRecords.some(row => row.nativeId === '186003'))
    assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  }
})

test('Zeon employer contradiction survives formatting and entity encoding in the authoritative description', async () => {
  const openingForeignForm = fixture.responses.find(packet => packet.requestedUrl.endsWith('job_id=186001')).text
  for (const employer of ['Zeon <strong>International</strong>', 'Zeon&nbsp;International', 'Zeon Internation&#97;l']) {
    const jobs = await run(replay(packet => {
      if (packet.requestedUrl === 'https://zeoncharging.com/careers') packet.text = changePosting(packet.text, '186001', posting => {
        posting.description = posting.description.replace('Zeon International', employer)
      })
      if (packet.requestedUrl.endsWith('job_id=186001')) packet.text = openingForeignForm
    }))
    assert.deepEqual(jobs.map(job => job.jobId), ['186003', '186004'])
    assert.equal(jobs.nativeCollectionEvidence.heldRecords.length, 1)
    assert.equal(jobs.nativeCollectionEvidence.heldRecords[0].nativeId, '186001')
  }
})

test('Zeon requires the full required-criteria section independently of unrelated and optional lists', async () => {
  for (const replacement of ['<p>Full required criteria available on request.</p>', '<ul><li>Full required criteria available on request.</li></ul>']) {
    const jobs = await run(replay(packet => {
      if (packet.requestedUrl === 'https://zeoncharging.com/careers') packet.text = changePosting(packet.text, '186003', posting => {
        const changed = posting.description.replace(/(<h3>Requirements<\/h3>)<ul>[\s\S]*?<\/ul>/,
          '$1' + replacement)
        assert.notEqual(changed, posting.description)
        posting.description = changed
      })
    }))
    assert.deepEqual(jobs.map(job => job.jobId), ['186004'])
    assert.ok(jobs.nativeCollectionEvidence.heldRecords.some(row => row.nativeId === '186003'))
    assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  }
})
