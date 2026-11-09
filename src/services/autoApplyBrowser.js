import { chromium } from 'playwright';
import { hashValue, submissionOutcome, supportedTarget } from './autoApplyPolicy.js';

const portalHosts = new Set(['jobs.lever.co', 'jobs.eu.lever.co', 'boards.greenhouse.io', 'job-boards.greenhouse.io', 'job-boards.eu.greenhouse.io']);
const resourceHosts = new Set([...portalHosts, 'api.lever.co', 'api.eu.lever.co', 'jobs.cdn.lever.co', 'cdn.lever.co',
  'boards-api.greenhouse.io', 'boards.cdn.greenhouse.io', 'job-boards.cdn.greenhouse.io', 'recruiting.cdn.greenhouse.io', 'recruiting2.cdn.greenhouse.io',
  'fonts.googleapis.com', 'fonts.gstatic.com', 'www.google.com', 'www.gstatic.com', 'www.recaptcha.net']);
const blocked = reason => ({ status: 'blocked', reason });

function publicResource(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port && resourceHosts.has(url.hostname); }
  catch { return false; }
}

async function withPage(options, submitMode, action) {
  const target = supportedTarget(options.url);
  if (!target || target.provider !== options.provider) return blocked('This employer form is not supported. Use the employer website.');
  const browser = await (options.launch || (() => chromium.launch({ headless: true, chromiumSandbox: true,
    ...(process.env.AUTO_APPLY_CHROMIUM_EXECUTABLE ? { executablePath: process.env.AUTO_APPLY_CHROMIUM_EXECUTABLE } : {}),
  })))();
  const deadline = setTimeout(() => { void browser.close().catch(() => {}); }, 90000);
  try {
    const context = await browser.newContext({ acceptDownloads: false, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(30000);
    let submissionStarted = false;
    await context.route('**/*', async route => {
      const request = route.request();
      if (!publicResource(request.url())) return route.abort();
      if (!submitMode && !['GET', 'HEAD'].includes(request.method())) return route.abort();
      if (request.isNavigationRequest() && request.frame() === page.mainFrame() && !submissionStarted
        && supportedTarget(request.url())?.url !== target.url) return route.abort();
      return route.fallback();
    });
    context.on('page', popup => { if (popup !== page) void popup.close().catch(() => {}); });
    await page.goto(target.url, { waitUntil: 'domcontentloaded' });
    return await action(page, () => { submissionStarted = true; });
  } finally { clearTimeout(deadline); await browser.close(); }
}

async function readForm(page) {
  for (let attempt = 0; attempt < 20; attempt++) {
    for (const frame of page.frames()) {
      try {
        if (!portalHosts.has(new URL(frame.url()).hostname)) continue;
        const result = await frame.evaluate(() => {
          const forms = [...document.forms].filter(form => form.querySelector('input[type="email"],input[name="email"],input[name="email_address"]'));
          const form = forms.find(item => item.querySelector('input[type="file"]')) || forms[0];
          if (!form) return null;
          const visible = el => { const style = getComputedStyle(el); return style.display !== 'none' && style.visibility !== 'hidden' && Boolean(el.getClientRects().length); };
          if ([...document.querySelectorAll('iframe[src*="recaptcha"],iframe[src*="hcaptcha"],.g-recaptcha')].some(visible)) return { reason: 'This form requires a CAPTCHA. Complete it on the employer website.' };
          if ([...form.querySelectorAll('[role="combobox"], [contenteditable="true"]')].some(visible)) return { reason: 'This form has controls that need manual completion. Use the employer website.' };
          const fields = []; const groups = new Map();
          for (const element of form.querySelectorAll('input,select,textarea')) {
            const type = (element.getAttribute('type') || 'text').toLowerCase();
            if (element.disabled || ['hidden', 'submit', 'button', 'reset'].includes(type)) continue;
            if (type !== 'file' && !visible(element)) {
              if (element.required) return { reason: 'A required field is hidden or unsupported. Use the employer website.' };
              continue;
            }
            let kind = element.tagName === 'SELECT' ? 'select' : element.tagName === 'TEXTAREA' ? 'textarea' : type;
            if (!['text', 'email', 'tel', 'url', 'number', 'textarea', 'select', 'checkbox', 'radio', 'file'].includes(kind) || element.multiple) return { reason: 'This form includes an unsupported input. Use the employer website.' };
            const label = ([...(element.labels || [])].map(item => item.textContent).join(' ') || element.getAttribute('aria-label') || element.name || element.id || '').replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').trim().slice(0, 400);
            if (!label) return { reason: 'A form field has no readable label. Use the employer website.' };
            if (kind === 'file' && (!/resume|\bcv\b|curriculum/i.test(`${label} ${element.name} ${element.id}`)
              || (element.accept && !/pdf|\*|\.doc/i.test(element.accept)))) return { reason: 'This form requires an additional document. Upload it on the employer website.' };
            if (kind === 'text' && /^e-?mail(?: address)?$/i.test(label)) kind = 'email';
            const required = element.required || element.getAttribute('aria-required') === 'true'
              || Boolean(element.closest('[data-required="true"],.required')) || /\*\s*$/.test(element.labels?.[0]?.textContent || '');
            if (kind === 'radio' && element.name && groups.has(element.name)) {
              const group = groups.get(element.name); group.required ||= required;
              group.options.push({ label, value: element.value }); element.dataset.jvApply = group.key; continue;
            }
            const field = { key: `field_${fields.length}`, label, kind, required, name: element.name || '', inputId: element.id || '',
              maxLength: element.maxLength > 0 ? element.maxLength : 5000, options: [] };
            if (kind === 'select') field.options = [...element.options].filter(option => !option.disabled).map(option => ({ label: option.text.trim().slice(0, 400), value: option.value }));
            if (kind === 'radio') {
              field.options = [{ label, value: element.value }];
              field.label = element.closest('fieldset')?.querySelector('legend')?.textContent.trim().slice(0, 400) || element.name || label;
              if (element.name) groups.set(element.name, field);
            }
            if (field.options.length > 300 || fields.length >= 80) return { reason: 'This form is too complex for automatic completion. Use the employer website.' };
            element.dataset.jvApply = field.key; fields.push(field);
          }
          if (!fields.some(field => field.kind === 'file')) return { reason: 'No supported resume upload was found. Use the employer website.' };
          const submit = [...form.querySelectorAll('button,input[type="submit"]')].find(button => !button.disabled && visible(button)
            && (button.type === 'submit' || /^(?:submit(?: application)?|apply(?: now)?)$/i.test((button.textContent || button.value).trim())));
          if (!submit) return { reason: 'No supported submit button was found. Use the employer website.' };
          submit.dataset.jvSubmit = 'true'; form.dataset.jvForm = 'true';
          return { manifest: { fields, action: form.action, method: form.method.toLowerCase() } };
        });
        if (result) {
          if (result.manifest && (!publicResource(result.manifest.action) || !portalHosts.has(new URL(result.manifest.action).hostname))) return { reason: 'The form sends to an unsupported destination. Use the employer website.' };
          return { ...result, frame };
        }
      } catch (error) { if (page.isClosed()) throw error; }
    }
    await page.waitForTimeout(250);
  }
  return { reason: 'No supported public application form was found. Use the employer website.' };
}

export async function inspect(options) {
  return withPage(options, false, async page => {
    const result = await readForm(page);
    return result.manifest ? { manifest: result.manifest } : blocked(result.reason);
  });
}

export async function submit(options) {
  return withPage(options, true, async (page, started) => {
    const result = await readForm(page);
    if (!result.manifest) return blocked(result.reason);
    if (hashValue(result.manifest) !== options.formHash) return blocked('The employer form changed. Prepare and review the application again.');
    const { frame, manifest } = result;
    for (const field of manifest.fields) {
      const control = frame.locator(`[data-jv-apply="${field.key}"]`);
      const answer = options.answers[field.key];
      if (field.kind === 'file') await control.setInputFiles({ name: 'resume.pdf', mimeType: 'application/pdf', buffer: options.pdf });
      else if (field.kind === 'checkbox') await control.setChecked(answer === true);
      else if (field.kind === 'select') await control.selectOption(answer || []);
      else if (field.kind === 'radio') {
        if (answer) await control.nth(field.options.findIndex(item => item.value === answer)).check();
        else if (await control.evaluateAll(elements => elements.some(element => element.checked))) return blocked(`The employer preselected an answer for ${field.label}. Choose your answer explicitly before submitting.`);
      }
      else await control.fill(answer || '');
    }
    // Answers can reveal conditional questions. A changed form requires a fresh
    // review, even when its newly introduced controls happen to be optional.
    const filled = await readForm(page);
    if (!filled.manifest || hashValue(filled.manifest) !== options.formHash) return blocked('The form changed after filling your answers. Complete the additional questions on the employer website.');
    for (const field of manifest.fields) {
      if (field.kind === 'file') continue;
      const value = await frame.locator(`[data-jv-apply="${field.key}"]`).evaluateAll(elements => {
        const element = elements[0];
        return element.type === 'radio' ? elements.find(item => item.checked)?.value || '' : element.type === 'checkbox' ? element.checked : element.value;
      });
      if (value !== (options.answers[field.key] ?? (field.kind === 'checkbox' ? false : ''))) return blocked(`The employer changed the answer for ${field.label}. Review it on the employer website.`);
    }
    const valid = await frame.locator('[data-jv-form="true"]').evaluate(form => form.checkValidity());
    if (!valid) return blocked('The employer form needs corrected or additional answers. Review it on the employer website.');
    const before = await frame.locator('body').innerText();
    await options.beforeSubmit(); started();
    try {
      await frame.locator('[data-jv-submit="true"]').click({ noWaitAfter: true });
      const deadline = Date.now() + (options.verificationTimeoutMs ?? 15000);
      while (Date.now() < deadline) {
        let text = await page.locator('body').innerText();
        if (frame !== page.mainFrame() && !frame.isDetached()) text += '\n' + await frame.locator('body').innerText();
        const outcome = submissionOutcome(text, before);
        if (outcome.status !== 'unconfirmed') return outcome;
        await page.waitForTimeout(250);
      }
      return submissionOutcome('', before);
    } catch { return submissionOutcome('', before); }
  });
}
