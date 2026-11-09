import assert from 'node:assert/strict'
import test from 'node:test'
import * as workday from '../myworkday/pageAvailability.js'
import {classifyScraperError} from '../utils/failureClassification.js'

for (const [status, html, failureKind] of [
  [200, '<title>Workday is currently unavailable.</title>', 'network_or_timeout'],
  [503, 'Service unavailable', 'network_or_timeout'],
  [403, 'Forbidden', 'blocked_or_access_denied'],
]) {
  test('Workday page availability reports HTTP ' + status + ' as the correct upstream failure', () => {
    assert.throws(() => workday.assertWorkdayPageAvailable({status,html,url:'https://example.wd1.myworkdayjobs.com/jobs'}, {source:'example'}), error => {
      assert.deepEqual(classifyScraperError(error), {softFailure:true,upstreamOutage:true,failureKind})
      return true
    })
  })
}

test('Workday page availability preserves a healthy board for identity validation', () => {
  const page = {status:200,html:'<title>Example Careers</title>',url:'https://example.wd1.myworkdayjobs.com/jobs'}
  assert.equal(workday.assertWorkdayPageAvailable(page, {source:'example'}), page)
})

test('Workday page availability catches maintenance redirects even without maintenance HTML', () => {
  assert.throws(() => workday.assertWorkdayPageAvailable({status:200,html:'',finalUrl:'https://community.workday.com/maintenance-page'}, {source:'example'}), error => error.softFailure === true && error.upstreamOutage === true)
})
