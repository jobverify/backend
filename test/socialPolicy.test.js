import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import { approvalDigest, dueSocialSlot, parseSocialSlot, socialFacts, factsDigest, defaultSocialCaptions, validateSocialJpeg } from '../src/social/policy.js';

test('India publishing slots accept only 10:00 and 18:00, with a fifteen minute claim window', () => {
  assert.deepEqual(dueSocialSlot(new Date('2026-11-20T04:30:00Z')), { slot: new Date('2026-11-20T04:30:00Z'), claimable: true });
  assert.equal(dueSocialSlot(new Date('2026-11-20T04:44:59Z')).claimable, true);
  assert.equal(dueSocialSlot(new Date('2026-11-20T04:45:00Z')).claimable, false);
  assert.equal(dueSocialSlot(new Date('2026-11-20T12:30:00Z')).slot.toISOString(), '2026-11-20T12:30:00.000Z');
  assert.equal(dueSocialSlot(new Date('2026-11-20T04:29:59Z')).slot.toISOString(), '2026-11-19T12:30:00.000Z');
  assert.equal(parseSocialSlot('2026-11-20T10:00:00+05:30', new Date('2026-11-20T00:00:00Z')).toISOString(), '2026-11-20T04:30:00.000Z');
  for (const slot of ['2026-11-20T04:31:00Z', '2026-11-20T04:30:01Z', 'invalid', '2026-11-19T04:30:00Z']) {
    assert.throws(() => parseSocialSlot(slot, new Date('2026-11-20T00:00:00Z')));
  }
});

test('approval binds every caption, asset, job fact and destination revision', () => {
  const draft = { factsHash: 'facts', captions: { linkedin: 'one', instagram: 'two' }, image: { hash: 'image' } };
  const accounts = [{ platform: 'linkedin', destination: 'urn:li:organization:1', revision: 2 }, { platform: 'instagram', destination: '3', revision: 4 }];
  const original = approvalDigest(draft, accounts);
  assert.equal(approvalDigest(draft, [...accounts].reverse()), original);
  for (const changed of [{ ...draft, factsHash: 'new' }, { ...draft, captions: { ...draft.captions, instagram: 'changed' } }, { ...draft, image: { hash: 'new' } }]) assert.notEqual(approvalDigest(changed, accounts), original);
  assert.notEqual(approvalDigest(draft, [{ ...accounts[0], revision: 3 }, accounts[1]]), original);
});

test('factual snapshots exclude lifecycle timestamps and captions never invent missing salary', () => {
  const job = { _id: '123', title: 'Engineer', company: 'Acme', location: 'Pune', sourceUrl: 'https://careers.example/jobs/1', description: 'Verified role', updatedAt: new Date() };
  const facts = socialFacts(job);
  assert.equal(factsDigest(facts), factsDigest(socialFacts({ ...job, updatedAt: new Date(0) })));
  assert.notEqual(factsDigest(facts), factsDigest(socialFacts({ ...job, title: 'Senior Engineer' })));
  const captions = defaultSocialCaptions(facts, 'https://www.jobverify.in');
  assert.match(captions.linkedin, /https:\/\/www.jobverify.in\/jobs\/123\?utm_source=linkedin/);
  assert.match(captions.instagram, /https:\/\/www.jobverify.in\/jobs\/123\?utm_source=instagram/);
  const instagramLink = new URL(captions.instagram.match(/https:\/\/\S+/)[0]);
  assert.equal(instagramLink.searchParams.get('utm_medium'), 'social');
  assert.equal(instagramLink.searchParams.get('utm_campaign'), 'job_promotion');
  assert.match(defaultSocialCaptions({ ...facts, id: '456' }).instagram, /\/jobs\/456\?/);
  assert.doesNotMatch(captions.instagram, /link in bio/i);
  assert.doesNotMatch(captions.linkedin + captions.instagram, /salary|guaranteed|hiring urgently/i);
});

test('only bounded, complete JPEGs with the exact approved dimensions are accepted', () => {
  const bytes = createCanvas(1080, 1350).toBuffer('image/jpeg');
  const image = validateSocialJpeg(bytes, 'image/jpeg');
  assert.equal(image.width, 1080); assert.equal(image.height, 1350); assert.match(image.hash, /^[a-f0-9]{64}$/);
  assert.throws(() => validateSocialJpeg(bytes, 'image/png'));
  assert.throws(() => validateSocialJpeg(createCanvas(1080, 1080).toBuffer('image/jpeg'), 'image/jpeg'));
  assert.throws(() => validateSocialJpeg(bytes.subarray(0, bytes.length - 2), 'image/jpeg'));
  assert.throws(() => validateSocialJpeg(Buffer.alloc(2 * 1024 * 1024 + 1), 'image/jpeg'));
});
