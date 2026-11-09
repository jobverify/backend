import assert from 'node:assert/strict'
import test from 'node:test'
import { formatFinalSummaryTable } from '../finalSummaryFormatter.js'

test('run report distinguishes throttling and challenge gates from uncategorized failures', () => {
  const report = formatFinalSummaryTable({
    medtronic: { success: false, softFailure: true, error: 'Workday jobs API returned HTTP_429 at https://example.com/jobs' },
    directory: { success: false, softFailure: true, error: 'Wellfound directory is challenge-gated' },
    unavailable: { success: false, softFailure: true, error: 'Workday jobs API returned HTTP_503 at https://example.com/jobs' },
  })
  assert.match(report, /Rate limit[^\n]*1[^\n]*medtronic/)
  assert.match(report, /Access challenge[^\n]*1[^\n]*directory/)
  assert.match(report, /HTTP 5xx[^\n]*1[^\n]*unavailable/)
  assert.doesNotMatch(report, /\| Other\s+\|/)
})

test('run report counts code-only connection timeouts', () => {
  const report = formatFinalSummaryTable({ aeon: { success: false, softFailure: true, error: 'fetch failed | ETIMEDOUT' } })
  assert.match(report, /Timed-out sources[^\n]*1/)
  assert.match(report, /Timeout[^\n]*1[^\n]*aeon/)
})

test('run report includes unsuccessful retries in the recovery denominator', () => {
  const report = formatFinalSummaryTable({
    recovered: { success: true, jobs: 1, retry: { attemptsUsed: 2, retries: 1, retryDelayMs: 2000 } },
    failed: { success: false, error: 'fetch failed', retry: { attemptsUsed: 4, retries: 3, retryDelayMs: 14000 } },
  })
  assert.match(report, /Sources retried[^\n]*2/)
  assert.match(report, /Total retry attempts[^\n]*4/)
  assert.match(report, /Retry recovery rate[^\n]*50\.0%/)
  assert.match(report, /Time spent retrying[^\n]*16\.0s/)
})
