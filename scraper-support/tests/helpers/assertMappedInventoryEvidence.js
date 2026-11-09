import assert from 'node:assert/strict'
import { attachInventoryEvidence, readInventoryEvidence } from '../../utils/inventoryEvidence.js'

// Removing evidence preservation from a company wrapper must fail these
// boundary checks, including the empty and explicitly incomplete cases.
export async function assertMappedInventoryEvidence(t, run, { surface, job }) {
  const complete = {
    status: 'complete-inventory', surface, firstParty: true, listingComplete: true,
    pagesFetched: 2, reportedTotal: 8, indiaFacetCount: 1,
    verifiedAt: '2026-11-08T00:00:00.000Z', reason: 'native-pages-and-countries-reconciled',
  }
  const partial = {
    ...complete, status: 'discovery-only', listingComplete: false,
    reportedTotal: null, indiaFacetCount: null, reason: 'native-scope-unresolved',
  }
  const empty = {
    ...complete, status: 'verified-empty', reportedTotal: 0, indiaFacetCount: 0,
    reason: 'native-empty-verified',
  }
  for (const scenario of [
    { name: 'complete inventory survives job decoration', rows: [job], evidence: complete, want: complete },
    { name: 'incomplete inventory stays incomplete', rows: [job], evidence: partial, want: partial },
    { name: 'verified empty inventory survives an empty map', rows: [], evidence: empty, want: empty },
    { name: 'missing inventory stays missing', rows: [job], want: null },
    { name: 'empty output cannot manufacture inventory proof', rows: [], want: null },
    { name: 'limited rows cannot retain complete inventory authority',
      rows: [{ ...job, sourceListingComplete: false }], evidence: complete,
      want: { ...complete, status: 'discovery-only', listingComplete: false,
        reason: 'company-wrapper-limited-inventory' } },
  ]) {
    await t.test(scenario.name, async () => {
      const input = scenario.rows.map(row => ({ ...row }))
      if (scenario.evidence) attachInventoryEvidence(input, scenario.evidence)
      const jobs = await run(input)
      assert.equal(jobs.length, input.length)
      assert.deepEqual(readInventoryEvidence(jobs), scenario.want)
      assert.deepEqual(readInventoryEvidence(input), scenario.evidence || null)
    })
  }
}
