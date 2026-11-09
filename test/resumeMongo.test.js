import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import Resume from '../src/models/Resume.js';
import User from '../src/models/User.js';
import ResumeArtifact from '../src/models/ResumeArtifact.js';
import { requestResumePreparation, drainResumePreparations } from '../src/services/resumePreparationService.js';
import { MAX_RESUME_BYTES } from '../src/utils/resumeFile.js';
import { mutateCandidateEvidence } from '../src/services/candidateEvidenceService.js';

test('private resumes round-trip through HTTP and MongoDB without changing document bytes', { timeout: 90000 }, async t => {
  process.env.MONGOMS_RUNTIME_DOWNLOAD = 'false';
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'resume-storage-integration-test-secret-only';
  process.env.CORS_ORIGIN = 'http://localhost:5173';
  // Storage/history fixtures drain generated output explicitly below; automatic
  // external workflow dispatch is unrelated to these HTTP/Mongo assertions.
  const actionsEnabledBefore = process.env.TAILORED_RESUME_ACTIONS_ENABLED;
  process.env.TAILORED_RESUME_ACTIONS_ENABLED = 'false';
  t.after(() => {
    if (actionsEnabledBefore === undefined) delete process.env.TAILORED_RESUME_ACTIONS_ENABLED;
    else process.env.TAILORED_RESUME_ACTIONS_ENABLED = actionsEnabledBefore;
  });
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '8.2.6', downloadDir: fileURLToPath(new URL('../.cache/mongodb-binaries/', import.meta.url)) } });
  let server;
  t.after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); });
  await mongoose.connect(mongo.getUri(), { dbName: 'resume_storage_test' });
  const user = new mongoose.Types.ObjectId();
  const other = new mongoose.Types.ObjectId();
  await User.collection.insertMany([{ _id: user, email: 'resume@example.test', role: 'user', sessionVersion: 0 }, { _id: other, email: 'other@example.test', role: 'user', sessionVersion: 0 }]);
  const { createApp } = await import('../src/app.js');
  server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const csrfResponse = await fetch(`${base}/api/auth/csrf-token`, { headers: { Origin: process.env.CORS_ORIGIN } });
  const { token: csrf } = await csrfResponse.json();
  const csrfCookie = csrfResponse.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  function request(path = '/api/user/resume', { method = 'GET', owner = user, body, filename, withCsrf = true, type = 'application/octet-stream' } = {}) {
    const token = owner ? `jobverify_token=${jwt.sign({ id: owner.toString(), sessionVersion: 0 }, process.env.JWT_SECRET)}` : '';
    return fetch(`${base}${path}`, { method, body, headers: {
      Origin: process.env.CORS_ORIGIN, Cookie: `${token}; ${csrfCookie}`, 'Content-Type': type,
      ...(filename ? { 'X-Resume-Filename': encodeURIComponent(filename) } : {}), ...(withCsrf ? { 'X-CSRF-Token': csrf } : {}),
    } });
  }
  assert.equal((await request(undefined, { owner: null })).status, 401);
  assert.equal((await (await request()).json()).data, null);
  const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(65536, 32), Buffer.from('\n%%EOF')]);
  assert.equal((await request(undefined, { method: 'PUT', body: pdf, filename: 'Résumé.pdf', withCsrf: false })).status, 403);
  assert.equal((await request(undefined, { method: 'PUT', body: pdf, filename: 'Résumé.pdf', owner: null })).status, 401);
  const upload = await request(undefined, { method: 'PUT', body: pdf, filename: 'Résumé.pdf' });
  assert.equal(upload.status, 200, await upload.clone().text());
  const metadata = (await upload.json()).data;
  assert.equal(metadata.filename, 'Résumé.pdf');
  assert.equal(metadata.size, pdf.length);
  assert.equal(metadata.data, undefined);
  assert.equal(metadata.preparation.sourceHash, metadata.sha256);
  assert.equal(typeof metadata.preparation.attempts, 'number');
  assert.equal(typeof metadata.preparation.retryable, 'boolean');
  assert.equal((await Resume.findById(user).lean()).data, undefined, 'binary content is excluded from ordinary queries');
  assert.equal((await (await request()).json()).data.filename, 'Résumé.pdf');
  const download = await request('/api/user/resume/download');
  assert.equal(download.headers.get('content-type'), 'application/pdf');
  assert.match(download.headers.get('content-disposition'), /^attachment;/);
  assert.equal(download.headers.get('cache-control'), 'no-store');
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdf);
  assert.equal((await request('/api/user/resume/download', { owner: other })).status, 404);
  await request(undefined, { method: 'DELETE', owner: other });
  assert.equal(await Resume.countDocuments({ user }), 1);

  for (const [filename, body] of [['wrong.pdf', Buffer.from('not a PDF')], ['resume.exe', pdf], ['resume.pdf', Buffer.alloc(MAX_RESUME_BYTES + 1)]]) {
    const rejected = await request(undefined, { method: 'PUT', body, filename });
    if (body.length > MAX_RESUME_BYTES) {
      assert.equal(rejected.status, 413);
      assert.equal((await rejected.json()).message, 'Your resume must be 500 KB or smaller.');
    } else assert.ok([400, 415].includes(rejected.status));
    assert.equal((await (await request()).json()).data.sha256, metadata.sha256, 'failed replacement keeps the current resume');
  }
  assert.equal((await request('/api/user/profile', { method: 'PUT', body: pdf })).status, 415, 'binary uploads cannot bypass JSON validation on other endpoints');
  const latex = Buffer.from('\\documentclass{article}\n\\begin{document}Asha Rao. Built a React task manager in 2025. BSc Computer Science, 2026.\\end{document}');
  const replacement = await request(undefined, { method: 'PUT', body: latex, filename: 'resume.tex' });
  assert.equal(replacement.status, 200);
  assert.equal(await Resume.countDocuments({ user }), 1);
  assert.deepEqual(Buffer.from(await (await request('/api/user/resume/download')).arrayBuffer()), latex);
  const generatedPdf = Buffer.from('%PDF-1.7\nAsha Rao prepared resume\n%%EOF');
  await requestResumePreparation({ _id: user }, { dispatch: async () => {} });
  assert.deepEqual(await drainResumePreparations({ generate: async () => ({ latex: latex.toString(), pdf: generatedPdf, pageCount: 1 }) }), { attempted: 1, completed: 1, failed: 0 });
  const prepared = await request('/api/user/resume/prepare', { method: 'POST', type: 'application/json', body: '{}' });
  assert.equal(prepared.status, 200);
  const preparedMetadata = (await prepared.json()).data;
  assert.equal(preparedMetadata.preparation.hasPdf, true);
  assert.equal(preparedMetadata.preparation.status, 'completed');
  assert.equal(preparedMetadata.filename, 'resume.tex');
  assert.equal(preparedMetadata.pdf, undefined); assert.equal(preparedMetadata.preparation.facts, undefined);
  assert.equal((await request('/api/user/resume/prepare', { method: 'POST', type: 'application/json', body: '{}', withCsrf: false })).status, 403);
  assert.equal((await request('/api/user/resume/prepare', { method: 'POST', type: 'application/json', body: '{"regenerate":"yes"}' })).status, 400);
  const inline = await request('/api/user/resume/base');
  assert.equal(inline.status, 200); assert.equal(inline.headers.get('content-type'), 'application/pdf');
  assert.equal(inline.headers.get('cache-control'), 'no-store'); assert.match(inline.headers.get('content-disposition'), /inline/);
  assert.deepEqual(Buffer.from(await inline.arrayBuffer()), generatedPdf);
  const generatedTex = await request('/api/user/resume/base/download?format=tex');
  assert.equal(generatedTex.status, 200); assert.match(generatedTex.headers.get('content-disposition'), /attachment/);
  assert.deepEqual(Buffer.from(await generatedTex.arrayBuffer()), latex);
  assert.equal((await request('/api/user/resume/base?format=json')).status, 400);
  assert.equal((await request('/api/user/resume/base', { owner: other })).status, 404);
  assert.equal((await request('/api/user/resume/base', { owner: null })).status, 401);
  await requestResumePreparation({ _id: user }, { regenerate: true, dispatch: async () => {} });
  await drainResumePreparations({ generate: async () => ({ latex: `${latex}\n% second revision`, pdf: generatedPdf, pageCount: 1 }) });
  const historyResponse = await request('/api/user/resume/revisions');
  assert.equal(historyResponse.status, 200); assert.equal(historyResponse.headers.get('cache-control'), 'no-store');
  const history = (await historyResponse.json()).data;
  assert.equal(history.items.length, 2);
  assert.equal(history.items[0].sourceSnapshot, undefined, 'listing metadata does not include document content');
  const earlierId = history.items[1].id;
  assert.equal((await request('/api/user/resume/revisions?limit=999')).status, 400);
  assert.equal((await request(`/api/user/resume/revisions/${earlierId}/download`, { owner: other })).status, 404);
  assert.equal((await request(`/api/user/resume/revisions/${earlierId}/download`, { owner: null })).status, 401);
  assert.deepEqual(Buffer.from(await (await request(`/api/user/resume/revisions/${earlierId}/download`)).arrayBuffer()), generatedPdf);
  const comparison = await request(`/api/user/resume/revisions/compare?from=${earlierId}&to=${history.currentRevisionId}`);
  assert.equal(comparison.status, 200);
  assert.ok((await comparison.json()).data.changes.some(change => change.field === 'latex'));
  const restore = { method: 'POST', type: 'application/json', body: JSON.stringify({ expectedCurrentRevisionId: history.currentRevisionId }) };
  assert.equal((await request(`/api/user/resume/revisions/${earlierId}/restore`, { ...restore, withCsrf: false })).status, 403);
  const restored = await request(`/api/user/resume/revisions/${earlierId}/restore`, restore);
  assert.equal(restored.status, 200);
  assert.notEqual((await restored.json()).data.id, earlierId);
  assert.equal((await request(`/api/user/resume/revisions/${earlierId}/restore`, restore)).status, 409, 'stale pointer cannot overwrite a restore');
  assert.equal((await (await request('/api/user/resume/revisions')).json()).data.items.length, 3);
  await mutateCandidateEvidence(user, { collection: 'achievements', action: 'create', body: { version: 0, claim: 'Improved an application with Redis', skills: ['Redis'] } });
  const identicalAfterEdit = await request(undefined, { method: 'PUT', body: latex, filename: 'resume.tex' });
  assert.equal(identicalAfterEdit.status, 200);
  assert.equal((await identicalAfterEdit.json()).data.preparation.stale, true, 'identical upload cannot hide changed candidate evidence');
  const replacementAfterHistory = Buffer.from('\\documentclass{article}\n\\begin{document}Asha Rao. A different uploaded source with confirmed React experience.\\end{document}');
  assert.equal((await request(undefined, { method: 'PUT', body: replacementAfterHistory, filename: 'new-source.tex' })).status, 200);
  assert.deepEqual(Buffer.from(await (await request(`/api/user/resume/revisions/${earlierId}/download`)).arrayBuffer()), generatedPdf, 'source replacement retains historical documents');
  assert.equal((await (await request('/api/user/resume/revisions')).json()).data.items.length, 3);
  assert.equal((await request(undefined, { method: 'DELETE' })).status, 200);
  assert.equal((await (await request()).json()).data, null);
  assert.equal((await request('/api/user/resume/download')).status, 404);
  assert.equal(await ResumeArtifact.countDocuments({ user }), 0);
});
