import assert from 'node:assert/strict'

// Validate the additive clock contract against captured CXS records before
// projecting those additions out of an otherwise unchanged historical snapshot.
export const projectNativeWorkdayClocks = (jobs, originals, packets, stable, { listingLabel = false } = {}) => {
  assert.equal(jobs.length, originals.length)
  const details = packets.filter(packet => packet.method === 'GET' && packet.url.includes('/wday/cxs/'))
    .map(packet => JSON.parse(packet.body).jobPostingInfo).filter(Boolean)
  return jobs.map((job, index) => {
    const original = originals[index]
    assert.equal(job.jobId, original.jobId)
    const matches = details.filter(info => info.jobReqId === original.jobId)
    assert.ok(matches.length, 'Captured native requisition must bind every replayed role: ' + original.jobId)
    const native = matches[0]
    for (const info of matches) {
      assert.equal(info.jobReqId, original.requisitionId)
      assert.equal(info.title, original.title)
      assert.equal(info.startDate, native.startDate)
      assert.equal(info.endDate, native.endDate)
    }
    assert.match(native.startDate, /^\d{4}-\d{2}-\d{2}$/)
    if (native.endDate != null) assert.match(native.endDate, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(job.postingDate, native.startDate)
    assert.equal(native.startDate + 'T00:00:00.000Z', original.postedAt)
    assert.equal(job.postedAt, original.postedAt, 'Original publication instant must remain unchanged')
    assert.equal(job.closingDate, original.closingDate, 'Original closing instant must remain unchanged')
    assert.equal(job.closingDate, native.endDate == null ? null : native.endDate + 'T00:00:00.000Z')
    assert.equal(job.sourceClosingDateIsExact, false)
    const metadata = {
      sourceDateProvenance: 'workday-cxs-jobPostingInfo',
      sourceRawDates: { startDate: native.startDate, endDate: native.endDate ?? null },
      postingDatePrecision: 'calendar-date', closingDatePrecision: native.endDate == null ? null : 'calendar-date',
      sourcePostingDateIsExact: false,
      ...(listingLabel ? { sourceListingPostedOn: native.postedOn } : {}),
    }
    for (const [field, expected] of Object.entries(metadata)) assert.deepEqual(job[field], expected, field)
    if (!listingLabel) assert.equal(job.sourceListingPostedOn, original.sourceListingPostedOn)
    const projected = stable(job)
    for (const field of Object.keys(metadata)) if (!Object.hasOwn(original, field)) delete projected[field]
    if (!Object.hasOwn(original, 'postingDate')) delete projected.postingDate
    else if (original.postingDate === null) projected.postingDate = null
    return projected
  })
}
