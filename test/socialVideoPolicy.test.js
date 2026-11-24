import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import * as policy from '../src/social/videoPolicy.js';
import { approvalDigest, factsDigest, socialFacts } from '../src/social/policy.js';

test('Reel QR links to its own JobVerify job and narration ends with the follow request', () => {
  const facts = { id: '1234567890abcdef12345678', company: 'Acme', title: 'Engineer', sourceUrl: 'https://employer.example/role' };
  const plan = policy.videoPlan(facts);
  assert.equal(plan.jobUrl, 'https://www.jobverify.in/jobs/1234567890abcdef12345678');
  assert.ok(plan.script.endsWith('Follow JobVerify.in for more jobs.'));
  assert.match(plan.script, /scan the QR code/i);
  assert.doesNotMatch(plan.script, /find this (?:role|job)/i);
  assert.throws(() => policy.videoPlan({ ...facts, id: '../other-job' }), /job|QR/i);
});

test('Reel narration speaks the first location and preserves the stored facts', () => {
  for (const [location, first] of [['Bengaluru, Karnataka, India', 'Bengaluru'], ['Bengaluru [KA] [IN]', 'Bengaluru'], ['New Delhi, Delhi, India', 'New Delhi'], ['Remote', 'Remote']]) {
    const facts = { id: '1234567890abcdef12345678', company: 'Acme', title: 'Engineer', location };
    const plan = policy.videoPlan(facts);
    assert.ok(plan.script.includes(` ${first}.`));
    assert.doesNotMatch(plan.script, /Karnataka|\[KA\]|\[IN\]|, Delhi,|, India/);
    assert.equal(facts.location, location);
  }
});

test('Reel narration joins role, location, audience and experience into a natural sentence', () => {
  const facts = { id: '1234567890abcdef12345678', company: 'Microsoft', title: 'Principal Apps AI Consultant', location: 'Bengaluru, Karnataka, India', jobType: 'Full-time Experienced', experience: '10-15 years' };
  assert.equal(policy.videoPlan(facts).script, 'Microsoft is hiring for Principal Apps AI Consultant in Bengaluru for full-time experienced job seekers with 10-15 years of experience. Scan the QR code for full details and to apply. Follow JobVerify.in for more jobs.');
  assert.equal(facts.location, 'Bengaluru, Karnataka, India');
});

test('Reel narration handles missing details and existing experience wording without broken connectors', () => {
  const facts = { id: '1234567890abcdef12345678', company: 'Acme', title: 'Engineer' };
  assert.ok(policy.videoPlan(facts).script.startsWith('Acme is hiring for Engineer. Scan'));
  assert.ok(policy.videoPlan({ ...facts, location: ['Pune, Maharashtra, India'], experience: '2 years of experience' }).script.startsWith('Acme is hiring for Engineer in Pune with 2 years of experience. Scan'));
  assert.ok(policy.videoPlan({ ...facts, jobType: 'Intern' }).script.startsWith('Acme is hiring for Engineer for internship seekers. Scan'));
});

test('verbose job facts retain the location and audience within the 15-second narration budget', () => {
  const plan = policy.videoPlan({ id: '1234567890abcdef12345678', company: 'B'.repeat(1000), title: 'A'.repeat(1000), location: 'L'.repeat(1000), jobType: 'J'.repeat(1000), experience: 'E'.repeat(1000), salary: 'S'.repeat(1000) });
  assert.ok(plan.script.length <= 450);
  assert.ok(plan.script.split(/\s+/).length <= 45);
  assert.match(plan.script, / in L+/);
  assert.match(plan.script, / for j+ job seekers/);
  assert.ok(plan.script.endsWith('Follow JobVerify.in for more jobs.'));
});

test('employer branding is bound to the render plan and preserves legacy post fact digests', () => {
  const job = { _id: '1234567890abcdef12345678', company: 'Microsoft', title: 'Engineer', companyDomain: 'microsoft.com', sourceUrl: 'https://jobs.example-ats.com/role/1' };
  const facts = socialFacts(job);
  const plan = policy.videoPlan(facts, job);
  assert.equal(plan.companyDomain, 'microsoft.com');
  assert.notEqual(factsDigest(plan), factsDigest(policy.videoPlan(facts, { companyDomain: 'example.com' })));
  assert.equal(factsDigest(facts), factsDigest(socialFacts({ ...job, companyDomain: undefined })));
  assert.equal(policy.videoPlan(facts).companyDomain, '');
});

test('draft preferences require explicit all-jobs consent and use public saved-filter semantics', () => {
  assert.throws(() => policy.normalizeVideoPreferences({ enabled: true, filters: {} }), /matchAll|all eligible/i);
  const prefs = policy.normalizeVideoPreferences({ enabled: true, filters: { company: ['Acme'], location: ['Pune'], experienceYear: '2' } });
  assert.equal(policy.matchesVideoPreferences({ company: 'Acme', city: 'Pune', experienceRequired: '2 years', experienceYears: [2], branches: ['Other'], batches: [1990] }, prefs), true);
  assert.equal(policy.matchesVideoPreferences({ company: 'Elsewhere', city: 'Pune', experienceRequired: '2 years', experienceYears: [2] }, prefs), false);
  assert.equal(policy.matchesVideoPreferences({}, policy.normalizeVideoPreferences({ enabled: true, matchAll: true })), true);
});

test('API plans are deterministic, factual, bounded and use the fixed renderer contract', () => {
  const facts = { id: '1234567890abcdef12345678', company: 'Acme', title: 'Engineer', location: 'Pune', jobType: 'Full-time', salary: '₹10 lakh' };
  const plan = policy.videoPlan(facts);
  assert.deepEqual(plan, policy.videoPlan(facts));
  assert.equal(plan.voice, 'en-IN-NeerjaNeural'); assert.equal(plan.templateVersion, 'jobverify-reel-v6');
  assert.equal(plan.minDuration, 15); assert.equal(plan.maxDuration, 15);
  assert.equal(plan.ctaHold, 3); assert.match(plan.script, /Acme|Engineer/); assert.match(plan.script, /scan the QR code/i);
  assert.ok(policy.videoPlan({ ...facts, title: 'A'.repeat(1000), company: 'B'.repeat(1000) }).script.length <= 450);
  assert.doesNotMatch(policy.videoPlan({ id: facts.id, company: 'Acme', title: 'Engineer' }).script, /salary|deadline|guarantee/i);
});

test('binary media validation rejects fabricated/truncated MP4 and enforces portrait cover and UTF-8 timed SRT', () => {
  assert.throws(() => policy.validateVideoArtifact('video', Buffer.from('not a movie'), 'video/mp4'), /MP4|media/i);
  assert.throws(() => policy.validateVideoArtifact('cover', createCanvas(1080, 1350).toBuffer('image/jpeg'), 'image/jpeg'), /1920|portrait/i);
  const cover = policy.validateVideoArtifact('cover', createCanvas(1080, 1920).toBuffer('image/jpeg'), 'image/jpeg');
  assert.equal(cover.height, 1920); assert.equal(cover.width, 1080);
  const srt = Buffer.from('1\n00:00:00,000 --> 00:00:03,000\nAcme is hiring.\n\n2\n00:00:03,000 --> 00:00:08,000\nJob link in the caption.\n');
  assert.equal(policy.validateVideoArtifact('subtitles', srt, 'application/x-subrip').type, 'application/x-subrip');
  for (const bytes of [Buffer.from('1\n00:00:03,000 --> 00:00:01,000\nNo\n'), Buffer.from([0xff]), Buffer.alloc(65537)]) assert.throws(() => policy.validateVideoArtifact('subtitles', bytes, 'application/x-subrip'));
});

test('Reel approval binds both media and plan while legacy image digest remains stable', () => {
  const post = { factsHash: 'facts', captions: { instagram: 'caption' }, image: { hash: 'image' } };
  const accounts = [{ platform: 'instagram', destination: '1', revision: 1 }];
  const imageDigest = approvalDigest(post, accounts);
  const reel = { ...post, instagramMediaType: 'reel', video: { mp4: { hash: 'mp4' }, cover: { hash: 'cover' }, planHash: 'plan', factsHash: 'facts' } };
  assert.notEqual(approvalDigest(reel, accounts), imageDigest);
  assert.notEqual(approvalDigest(reel, accounts), approvalDigest({ ...reel, video: { ...reel.video, cover: { hash: 'changed' } } }, accounts));
  assert.equal(approvalDigest({ ...post, origin: 'manual', instagramMediaType: 'image' }, accounts), imageDigest);
});
import fs from 'node:fs';
const fixtureMovie = fs.readFileSync(new URL('./test-data/social-reel.mp4', import.meta.url));
test('MP4 parser derives the encoding from actual bytes and rejects structural and encoding corruption', () => {
  const video = policy.validateVideoArtifact('video', fixtureMovie, 'video/mp4');
  assert.equal(video.width, 1080); assert.equal(video.height, 1920); assert.equal(video.codec, 'h264'); assert.equal(video.audioSampleRate, 48000); assert.equal(video.fps, 30); assert.ok(video.duration >= 15);
  const mutations = [fixtureMovie.subarray(0, fixtureMovie.length - 1), Buffer.concat([fixtureMovie, Buffer.from('junk')])];
  for (const [tag, offset, value] of [['avc1', 28, 720], ['mp4a', 28, 44100]]) {
    const copy = Buffer.from(fixtureMovie); const index = copy.indexOf(tag, 64); assert.ok(index > 0);
    if (tag === 'avc1') copy.writeUInt16BE(value, index + offset); else copy.writeUInt32BE(value * 65536, index + offset);
    mutations.push(copy);
  }
  const moved = Buffer.from(fixtureMovie); moved.write('free', moved.indexOf('moov')); mutations.push(moved);
  for (const mutation of mutations) assert.throws(() => policy.validateVideoArtifact('video', mutation, 'video/mp4'), /MP4/);
});
test('invalid preferences cannot silently broaden an administrator selection', () => {
  for (const filters of [{ unknown: ['x'] }, { company: 'Acme' }, { company: [1] }, { company: ['x'.repeat(81)] }, { company: Array(21).fill('Acme') }, { jobType: ['Unknown'] }, { workArrangement: ['Teleport'] }, { roleDomain: ['Anything'] }, { datePostedDays: ['nonsense'] }, { experienceYear: {} }, { experienceYear: '16' }, { sortBy: 'other' }]) {
    assert.throws(() => policy.normalizeVideoPreferences({ enabled: true, matchAll: true, filters }), /filter|value|type|year|mode|domain|sort/i);
  }
});
test('portrait JPEG header forgery without quantization, Huffman tables or encoded scans is rejected', () => {
  const forged = Buffer.from('ffd8ffc00011080780043803011100021100031100ffda000c03010002110311003f00ffd9', 'hex');
  assert.throws(() => policy.validateVideoArtifact('cover', forged, 'image/jpeg'), /JPEG|scan|table/i);
});

function mp4AudioSamples(movie) {
  const boxes = (start, end) => {
    const result = [];
    for (let at = start; at < end;) {
      let size = movie.readUInt32BE(at); let header = 8;
      if (size === 1) { size = Number(movie.readBigUInt64BE(at + 8)); header = 16; }
      result.push({ type: movie.toString('ascii', at + 4, at + 8), start: at + header, end: at + size }); at += size;
    }
    return result;
  };
  const moov = boxes(0, movie.length).find(b => b.type === 'moov');
  const audio = boxes(moov.start, moov.end).filter(b => b.type === 'trak').map(track => {
    const mdia = boxes(track.start, track.end).find(b => b.type === 'mdia'); return boxes(mdia.start, mdia.end);
  }).find(media => { const handler = media.find(b => b.type === 'hdlr'); return movie.toString('ascii', handler.start + 8, handler.start + 12) === 'soun'; });
  const minf = audio.find(b => b.type === 'minf'); const stbl = boxes(minf.start, minf.end).find(b => b.type === 'stbl');
  const stsz = boxes(stbl.start, stbl.end).find(b => b.type === 'stsz');
  const mdhd = audio.find(b => b.type === 'mdhd'); const scale = movie.readUInt32BE(mdhd.start + 12); const duration = movie.readUInt32BE(mdhd.start + 16) / scale;
  const count = movie.readUInt32BE(stsz.start + 8);
  const sizes = Array.from({ length: count }, (_, i) => movie.readUInt32BE(stsz.start + 12 + i * 4));
  return { stsz, sizes, duration };
}
test('AAC bitrate is derived from actual bounded sample payload, not the mutable esds average', () => {
  const movie = Buffer.from(fixtureMovie); const { sizes, duration } = mp4AudioSamples(movie);
  const actualBitrate = Math.round(sizes.reduce((sum, size) => sum + size, 0) * 8 / duration);
  assert.equal(policy.validateVideoArtifact('video', movie, 'video/mp4').audioBitrate, actualBitrate);
});
test('AAC sample-size forgery cannot pass using an unchanged 128k esds descriptor', () => {
  const movie = Buffer.from(fixtureMovie); const { stsz, sizes } = mp4AudioSamples(movie);
  for (let i = 0; i < sizes.length; i++) movie.writeUInt32BE(1, stsz.start + 12 + i * 4);
  assert.throws(() => policy.validateVideoArtifact('video', movie, 'video/mp4'), /MP4|bitrate/);
});
test('portrait JPEG requires all MCUs, rejecting a one-byte entropy scan and truncated scans', () => {
  const jpeg = createCanvas(1080, 1920).toBuffer('image/jpeg');
  let at = 2;
  while (at < jpeg.length) { const marker = jpeg[at + 1]; const length = jpeg.readUInt16BE(at + 2); at += 2 + length; if (marker === 0xda) break; }
  const forgeries = [Buffer.concat([jpeg.subarray(0, at), Buffer.from([0x01, 0xff, 0xd9])]), Buffer.concat([jpeg.subarray(0, jpeg.length - 100), Buffer.from([0xff, 0xd9])])];
  for (const forged of forgeries) assert.throws(() => policy.validateVideoArtifact('cover', forged, 'image/jpeg'), /JPEG|scan|decode/i);
});
