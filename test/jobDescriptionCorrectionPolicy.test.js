import test from 'node:test';
import assert from 'node:assert/strict';

const context = { reason: 'source_details_changed', phase: 'fragment', scope: 'neutral', allowSourceFallback: true };
const open = policy => {
  for (let i = 0; i < 3; i++) {
    const ticket = policy.acquire(context);
    assert.equal(ticket.retry, true);
    ticket.finish(false);
  }
};

test('a correction cooldown skips eight matching failures and allows one concurrent probe', async () => {
  const { createCorrectionPolicy } = await import('../rewriting/correctionPolicy.js');
  const policy = createCorrectionPolicy();
  open(policy);
  for (let i = 0; i < 8; i++) assert.equal(policy.acquire(context).retry, false);
  const probe = policy.acquire(context);
  assert.equal(probe.retry, true);
  assert.equal(policy.acquire(context).retry, false);
  probe.finish(true);
  assert.equal(policy.acquire(context).retry, true);
});

test('canceling a probe releases it without creating another factual-failure cooldown', async () => {
  const { createCorrectionPolicy } = await import('../rewriting/correctionPolicy.js');
  const policy = createCorrectionPolicy();
  open(policy);
  for (let i = 0; i < 8; i++) policy.acquire(context);
  const probe = policy.acquire(context);
  probe.finish(null);
  assert.equal(policy.acquire(context).retry, true);
});

test('rejection phases, qualification scopes and strict calls have independent decisions', async () => {
  const { createCorrectionPolicy } = await import('../rewriting/correctionPolicy.js');
  const policy = createCorrectionPolicy();
  open(policy);
  assert.equal(policy.acquire({ ...context, phase: 'assembly' }).retry, true);
  assert.equal(policy.acquire({ ...context, scope: 'preferred' }).retry, true);
  assert.equal(policy.acquire({ ...context, allowSourceFallback: false }).retry, true);
  assert.equal(policy.acquire(context).retry, false);
});

test('a completed correction ticket cannot overwrite a later successful recovery', async () => {
  const { createCorrectionPolicy } = await import('../rewriting/correctionPolicy.js');
  const policy = createCorrectionPolicy();
  open(policy);
  for (let i = 0; i < 8; i++) policy.acquire(context);
  const probe = policy.acquire(context);
  probe.finish(true);
  probe.finish(false);
  for (let i = 0; i < 8; i++) assert.equal(policy.acquire(context).retry, true);
});
