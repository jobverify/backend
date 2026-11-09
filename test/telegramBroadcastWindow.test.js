import assert from 'node:assert/strict';
import test from 'node:test';
import { nextChannelPostAt } from '../src/services/telegramChannelService.js';
import { validateBroadcastSettings } from '../src/services/telegramBroadcastSettingsService.js';
import { DEFAULT_BROADCAST_TEMPLATE } from '../src/services/telegramBroadcastTemplate.js';

const window = { startTime: '09:00', endTime: '21:00', minIntervalMinutes: 20, maxIntervalMinutes: 30 };
const next = (date, config = window) => nextChannelPostAt(new Date(date), min => min, config).toISOString();

test('multiple unsorted slots defer intervals through gaps and roll over after the last slot', () => {
  const config = { ...window, postingWindows: [
    { startTime: '16:00', endTime: '18:00' }, { startTime: '09:00', endTime: '10:00' },
  ] };
  assert.equal(next('2026-11-04T04:10:00Z', config), '2026-11-04T10:30:00.000Z');
  assert.equal(next('2026-11-04T10:30:00Z', config), '2026-11-04T10:50:00.000Z');
  assert.equal(next('2026-11-04T12:10:00Z', config), '2026-11-05T03:30:00.000Z');
});

test('overlapping and overnight slots use their union without resetting the interval', () => {
  const config = { ...window, postingWindows: [
    { startTime: '22:00', endTime: '06:00' }, { startTime: '05:00', endTime: '08:00' },
  ] };
  assert.equal(next('2026-11-04T00:20:00Z', config), '2026-11-04T00:40:00.000Z');
  assert.equal(next('2026-11-04T02:10:00Z', config), '2026-11-04T16:30:00.000Z');
});

test('deleting every explicit slot disables scheduling rather than allowing all-day posts', () => {
  assert.equal(nextChannelPostAt(new Date('2026-11-04T03:30:00Z'), min => min, { ...window, postingWindows: [] }), null);
});

test('midnight scrapes wait until 09:00 IST', () => {
  assert.equal(next('2026-11-03T18:30:00Z'), '2026-11-04T03:30:00.000Z');
});
test('intervals stay paced inside the window and roll over at the exclusive end', () => {
  assert.equal(next('2026-11-04T03:30:00Z'), '2026-11-04T03:50:00.000Z');
  assert.equal(next('2026-11-04T15:10:00Z'), '2026-11-05T03:30:00.000Z');
  assert.equal(next('2026-11-04T16:00:00Z'), '2026-11-05T03:30:00.000Z');
});
test('overnight windows allow both sides of midnight and defer daytime posts', () => {
  const config = { ...window, startTime: '22:00', endTime: '06:00' };
  assert.equal(next('2026-11-03T18:30:00Z', config), '2026-11-03T18:50:00.000Z');
  assert.equal(next('2026-11-04T00:10:00Z', config), '2026-11-04T16:30:00.000Z');
  assert.equal(next('2026-11-04T06:00:00Z', config), '2026-11-04T16:30:00.000Z');
});
test('legacy settings keep unrestricted posting', () => {
  assert.equal(next('2026-11-03T18:30:00Z', {}), '2026-11-03T18:50:00.000Z');
});
for (const id of ['channel', 'group']) {
  const body = { enabled: true, chatId: `@example${id}`, minIntervalMinutes: 20, maxIntervalMinutes: 30,
    matchAll: true, filters: {}, template: DEFAULT_BROADCAST_TEMPLATE, revision: 0 };
  test(`${id} accepts and returns a posting window or a legacy empty pair`, () => {
    const saved = validateBroadcastSettings(id, { ...body, ...window });
    assert.equal(saved.startTime, '09:00'); assert.equal(saved.endTime, '21:00');
    assert.equal(validateBroadcastSettings(id, body).startTime, '');
    assert.equal(validateBroadcastSettings(id, body).endTime, '');
  });
  test(`${id} rejects malformed, incomplete and zero-length windows`, () => {
    for (const times of [{ startTime: '9:00', endTime: '21:00' }, { startTime: '24:00', endTime: '21:00' },
      { startTime: '09:00' }, { endTime: '21:00' }, { startTime: null, endTime: '' },
      { startTime: '09:00', endTime: '09:00' }]) {
      assert.throws(() => validateBroadcastSettings(id, { ...body, ...times }), { status: 400 });
    }
  });
  test(`${id} validates dynamic slot arrays and preserves their order`, () => {
    const postingWindows = [{ startTime: '16:00', endTime: '18:00' }, { startTime: '09:00', endTime: '10:00' }];
    assert.deepEqual(validateBroadcastSettings(id, { ...body, postingWindows }).postingWindows, postingWindows);
    assert.deepEqual(validateBroadcastSettings(id, { ...body, postingWindows: [] }).postingWindows, []);
    for (const invalid of [null, {}, [null], [{ startTime: '09:00' }], [{ startTime: '', endTime: '' }],
      [{ startTime: '09:00', endTime: '09:00' }], [{ startTime: '09:00\n', endTime: '10:00' }]]) {
      assert.throws(() => validateBroadcastSettings(id, { ...body, postingWindows: invalid }), { status: 400 });
    }
  });
}
