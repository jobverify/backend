import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { hashValue } from '../src/services/autoApplyPolicy.js';
const adapter = await import('../src/services/autoApplyBrowser.js').catch(() => ({}));
for (const [provider, url] of [['lever', 'https://jobs.lever.co/example/12345678-1234-1234-1234-123456789abc/apply'], ['greenhouse', 'https://job-boards.greenhouse.io/example/jobs/1234567']]) {
test(`${provider} browser review discovers real fields and submits only after the durable boundary`, { timeout: 90000 }, async () => {
  assert.equal(typeof adapter.inspect, 'function', 'The supported ATS browser adapter must exist');
  let submitted = 0; let boundary = false; let success = true; let formChanged = false; let postedAnswers; let conditional = false;
  const launch = async () => {
    const browser = await chromium.launch({ headless: true });
    const newContext = browser.newContext.bind(browser);
    browser.newContext = async options => {
      const context = await newContext(options);
      await context.route('**/*', async route => {
        if (route.request().method() === 'POST') {
          assert.equal(boundary, true, 'No submission is allowed before the durable claim');
          postedAnswers = route.request().postDataJSON();
          submitted++; return route.fulfill({ json: { ok: true } });
        }
        if (provider === 'greenhouse' && route.request().url() === url) return route.fulfill({ contentType: 'text/html', body: '<iframe title="Application" src="https://boards.greenhouse.io/embed/job_app?token=1234567"></iframe>' });
        return route.fulfill({ contentType: 'text/html', body: `<html><body><form action="/example/submit" method="post">
          <label>Full name<input name="name" required></label><label>Email<input name="email" type="email" required></label>
          <label>Resume<input name="resume" type="file" accept=".pdf" required></label>
          <label>Future roles<select name="future"><option value="yes" selected>Yes</option><option value="no">No</option></select></label>
          ${formChanged ? '<label>Location<input name="location" required></label>' : ''}
          <button type="submit">Submit application</button></form><script>
          ${conditional ? "document.querySelector('[name=email]').oninput=()=>{ if(!document.querySelector('[name=relocation]')) document.querySelector('form').insertAdjacentHTML('beforeend','<label>Relocation<input name=relocation value=Yes required></label>'); };" : ''}
          document.querySelector('form').onsubmit=async event=>{event.preventDefault(); await fetch('/example/submit',{method:'POST',body:JSON.stringify({future:document.querySelector('select').value})});
          document.body.innerHTML=${JSON.stringify(success ? 'Your application has been submitted.' : 'Processing your application...')};};
          </script></body></html>` });
      });
      return context;
    };
    return browser;
  };
  const review = await adapter.inspect({ url, provider, launch });
  assert.ok(review.manifest, JSON.stringify(review));
  assert.equal(review.manifest.fields.length, 4);
  const answers = Object.fromEntries(review.manifest.fields.filter(field => field.kind !== 'file').map(field => [field.key, field.kind === 'select' ? '' : field.kind === 'email' ? 'candidate@example.test' : 'Test Candidate']));
  const input = { url, provider, launch, manifest: review.manifest, formHash: hashValue(review.manifest), answers, pdf: Buffer.from('%PDF-fixture'),
    beforeSubmit: async () => { boundary = true; }, verificationTimeoutMs: 600 };
  const result = await adapter.submit(input);
  assert.equal(result.status, 'applied'); assert.equal(submitted, 1);
  assert.equal(postedAnswers.future, '', 'An optional employer default must not replace an approved blank answer');
  boundary = false; conditional = true;
  assert.equal((await adapter.submit(input)).status, 'blocked'); assert.equal(submitted, 1); assert.equal(boundary, false);
  conditional = false;
  boundary = false; formChanged = true;
  assert.equal((await adapter.submit(input)).status, 'blocked'); assert.equal(submitted, 1); assert.equal(boundary, false);
  formChanged = false; success = false;
  assert.equal((await adapter.submit(input)).status, 'unconfirmed'); assert.equal(submitted, 2);
});
}
