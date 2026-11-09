import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { remainingBudget, withinResumeBudget } from './resumeBudget.js';
import { resumeFailure } from './resumeDiagnostics.js';
import { resumePdfText } from '../src/services/resumePdfText.js';

const context = fileURLToPath(new URL('./compiler/', import.meta.url));
const cache = fileURLToPath(new URL('../.cache/resume-compiler/', import.meta.url));
let preparedImage;
export function compilerFailure({ stderr = '', code, aborted = false } = {}) {
  if (aborted || code === 137) return resumeFailure('compiler_resource_limit');
  if (String(stderr).split(/\r?\n/).includes('RESUME_COMPILER_DEPENDENCY_MISSING')) return resumeFailure('compiler_dependency_missing');
  if (String(stderr).split(/\r?\n/).includes('RESUME_COMPILER_RESOURCE_LIMIT')) return resumeFailure('compiler_resource_limit');
  return resumeFailure('compiler_failed');
}
const dockerEnv = () => Object.fromEntries(['PATH', 'SystemRoot', 'SYSTEMROOT', 'TEMP', 'TMP', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG', 'HOME', 'USERPROFILE'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
async function docker(args, { deadline, input, signal: parentSignal, limit = 8 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const timeout = AbortSignal.timeout(remainingBudget(deadline ?? Date.now() + 90000, 600000));
    const signal = parentSignal ? AbortSignal.any([parentSignal, timeout]) : timeout;
    const child = spawn('docker', args, { windowsHide: true, env: dockerEnv(), stdio: ['pipe', 'pipe', 'pipe'], signal });
    let size = 0; const chunks = [];
    let stderr = '';
    child.stderr.on('data', chunk => { if (stderr.length < 65536) stderr += chunk.toString().slice(0, 65536 - stderr.length); });
    child.stdout.on('data', chunk => { size += chunk.length; if (size > limit) child.kill('SIGKILL'); else chunks.push(chunk); });
    child.stdin.on('error', () => {});
    child.once('error', () => reject(compilerFailure({ stderr, aborted: signal.aborted })));
    child.once('close', code => code === 0 && size <= limit ? resolve(Buffer.concat(chunks)) : reject(compilerFailure({ stderr, code, aborted: signal.aborted })));
    child.stdin.end(input);
  });
}
export function compilerArguments({ name, image }) {
  return ['run', '--rm', '--interactive', '--name', name, '--network', 'none', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges',
    '--memory=512m', '--memory-swap=512m', '--cpus=1', '--pids-limit=64', '--log-driver=none', '--ulimit', 'nofile=128:128',
    '--tmpfs', '/tmp:rw,noexec,nosuid,size=128m,uid=10001,gid=10001,mode=700',
    '--tmpfs', '/work:rw,noexec,nosuid,size=32m,uid=10001,gid=10001,mode=700', image, '--untrusted', '--only-cached', '--chatter', 'minimal'];
}
export async function prepareResumeCompiler({ deadline = Date.now() + 600000 } = {}) {
  const hash = createHash('sha256');
  for (const name of ['Dockerfile', 'compiler.json', 'warmup.tex', 'compile.sh']) hash.update(await fs.readFile(path.join(context, name)));
  const tag = `jobverify-resume-compiler:${hash.digest('hex').slice(0, 24)}`;
  const archive = path.join(cache, 'image.tar');
  try { await docker(['load', '--input', archive], { deadline, limit: 1024 * 1024 }); } catch { /* cache miss; trusted build only */ }
  try { preparedImage = (await docker(['image', 'inspect', '--format', '{{.Id}}', tag], { deadline })).toString().trim(); }
  catch {
    await docker(['build', '--quiet', '--tag', tag, context], { deadline, limit: 1024 * 1024 });
    preparedImage = (await docker(['image', 'inspect', '--format', '{{.Id}}', tag], { deadline })).toString().trim();
    await fs.mkdir(cache, { recursive: true });
    const temporary = `${archive}.${randomUUID()}.download`;
    try {
      await docker(['save', '--output', temporary, tag], { deadline });
      await fs.rename(temporary, archive);
    } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(preparedImage)) throw new Error('The compiler image identity is invalid.');
  return preparedImage;
}
export async function inspectResumePdf(pdf, { deadline = Date.now() + 60000, signal } = {}) {
  return withinResumeBudget(deadline, budgetSignal => inspectPdfWithinBudget(pdf, {
    deadline, signal: signal ? AbortSignal.any([signal, budgetSignal]) : budgetSignal,
  }));
}
async function inspectPdfWithinBudget(pdf, { deadline, signal }) {
  signal.throwIfAborted();
  if (!Buffer.isBuffer(pdf) || pdf.length > 5 * 1024 * 1024 || !pdf.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('The generated PDF is missing, invalid, or larger than 5 MB.');
  const { getDocument, Util, OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createCanvas } = await import('@napi-rs/canvas');
  const task = getDocument({ data: new Uint8Array(pdf), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, stopAtErrors: true, verbosity: 0,
    standardFontDataUrl: fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url)).replaceAll('\\', '/') });
  let document;
  let renderingTask;
  const cancel = () => { renderingTask?.cancel(); void task.destroy().catch(() => {}); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    signal.throwIfAborted();
    document = await task.promise;
    if (!document.numPages || document.numPages > 30) throw new Error('The generated PDF has an invalid page count.');
    const texts = [], links = [], issues = [];
    for (let number = 1; number <= document.numPages; number++) {
      remainingBudget(deadline, 60000);
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });
      if (viewport.width < 300 || viewport.height < 300 || viewport.width > 2000 || viewport.height > 2000) throw new Error('The PDF page dimensions are unsupported. Use standard A4 or letter pages.');
      // ATS resume text uses opaque dark fill on white paper. Audit actual PDF
      // drawing state as well as raster contrast: a decorative underline must
      // never make invisible white text pass as a readable candidate fact.
      const operators = await page.getOperatorList();
      let drawing = { color: '#000000', alpha: 1, mode: 0, mask: false, blend: 'source-over', transfer: false };
      const stack = [];
      for (let index = 0; index < operators.fnArray.length; index++) {
        const operation = operators.fnArray[index], args = operators.argsArray[index];
        if (operation === OPS.save || operation === OPS.paintFormXObjectBegin) stack.push({ ...drawing });
        else if (operation === OPS.restore || operation === OPS.paintFormXObjectEnd) drawing = stack.pop() || drawing;
        else if (operation === OPS.setFillRGBColor) drawing.color = args[0];
        else if (operation === OPS.setFillColorN || operation === OPS.setFillTransparent) drawing.color = null;
        else if (operation === OPS.setTextRenderingMode) drawing.mode = args[0];
        else if (operation === OPS.setGState) for (const [key, value] of args[0]) {
          if (key === 'ca') drawing.alpha = value;
          if (key === 'SMask') drawing.mask = Boolean(value);
          if (key === 'BM') drawing.blend = value;
          if (key === 'TR') drawing.transfer = Boolean(value);
        }
        else if ([OPS.showText, OPS.showSpacedText, OPS.nextLineShowText, OPS.nextLineSetSpacingShowText].includes(operation)) {
          const color = typeof drawing.color === 'string' && /^#[a-f0-9]{6}$/i.test(drawing.color) ? drawing.color.slice(1).match(/../g).map(value => Number.parseInt(value, 16)) : null;
          const luminance = color ? 0.2126 * color[0] + 0.7152 * color[1] + 0.0722 * color[2] : 255;
          if (luminance > 90 || drawing.alpha < 0.99 || drawing.mode !== 0 || drawing.mask || drawing.transfer || drawing.blend !== 'source-over') {
            issues.push(`Page ${number} has text that is not visibly readable. Use opaque dark text on white paper.`);
          }
        }
      }
      for (const item of content.items) {
        if (typeof item.str !== 'string' || !item.str.trim()) continue;
        const [a, b, c, d, x, y] = item.transform;
        const size = Math.hypot(c, d) || Math.hypot(a, b);
        if (size < 9.9) issues.push(`Page ${number} contains text smaller than 10 pt.`);
        if (x < -1 || y < -1 || x + item.width > viewport.width + 2 || y > viewport.height + 2) issues.push(`Page ${number} contains text outside the page boundary.`);
      }
      const text = resumePdfText(content.items);
      if (text.trim().length < 10) issues.push(`Page ${number} has insufficient readable text.`);
      // Text extraction alone can accept white text or text hidden by a clipping
      // path. Render every page before publication to check actual visibility.
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const renderingContext = canvas.getContext('2d');
      renderingTask = page.render({ canvasContext: renderingContext, viewport, background: 'white' });
      await renderingTask.promise;
      renderingTask = undefined;
      remainingBudget(deadline, 60000);
      const pixels = renderingContext.getImageData(0, 0, canvas.width, canvas.height).data;
      let ink = 0, edgeInk = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        if (!x && y % 128 === 0) remainingBudget(deadline, 60000);
        const index = (y * canvas.width + x) * 4;
        if (pixels[index + 3] && Math.min(pixels[index], pixels[index + 1], pixels[index + 2]) < 210) {
          ink++;
          if (x < 2 || y < 2 || x >= canvas.width - 2 || y >= canvas.height - 2) edgeInk++;
        }
      }
      if (ink < Math.max(20, text.trim().length * 2)) issues.push(`Page ${number} has insufficient visible text.`);
      if (edgeInk) issues.push(`Page ${number} has visible content clipped at its boundary.`);
      // Do not credit a visible heading or decoration for an invisible body.
      // Every text run needs local foreground/background contrast, in bounded
      // horizontal regions so a partially hidden long run cannot borrow ink.
      for (const item of content.items) {
        if (typeof item.str !== 'string' || !item.str.trim() || !item.width) continue;
        const transform = Util.transform(viewport.transform, item.transform);
        if (Math.abs(transform[1]) > 0.1 || Math.abs(transform[2]) > 0.1) { issues.push(`Page ${number} contains unsupported rotated text.`); continue; }
        const size = Math.abs(transform[3]);
        const style = content.styles[item.fontName] || {};
        const top = Math.max(0, Math.floor(transform[5] - size * (style.ascent || 0.9)));
        const bottom = Math.min(canvas.height, Math.ceil(transform[5] - size * (style.descent || -0.25)));
        const startX = Math.max(0, Math.floor(transform[4]));
        const endX = Math.min(canvas.width, Math.ceil(transform[4] + item.width));
        const regions = Math.max(1, Math.floor((endX - startX) / 48));
        for (let region = 0; region < regions; region++) {
          const left = Math.floor(startX + (endX - startX) * region / regions);
          const right = Math.ceil(startX + (endX - startX) * (region + 1) / regions);
          let minimum = 255, maximum = 0;
          for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
            const index = (y * canvas.width + x) * 4;
            const value = (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
            minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
          }
          if (maximum - minimum < 40) { issues.push(`Page ${number} has text that is not visibly readable.`); break; }
        }
      }
      texts.push(text);
      for (const annotation of await page.getAnnotations()) if (typeof annotation.url === 'string') links.push(annotation.url);
      page.cleanup();
    }
    if (issues.length) throw new Error([...new Set(issues)].join(' '));
    return { pdf, pageCount: document.numPages, text: texts.join('\n'), links: [...new Set(links)] };
  } catch (error) {
    if (signal.aborted || Date.now() >= deadline) throw resumeFailure('time_limit', { statusCode: 504 });
    throw error;
  } finally { signal.removeEventListener('abort', cancel); await task.destroy().catch(() => {}); }
}
export async function compileResumeLatex(latex, { deadline = Date.now() + 90000, signal, image = preparedImage } = {}) {
  if (!image) throw new Error('The isolated PDF compiler has not been prepared.');
  const name = `resume-${randomUUID()}`;
  try {
    const pdf = await docker(compilerArguments({ name, image }), { input: latex, signal, deadline: Math.min(deadline, Date.now() + 90000), limit: 5 * 1024 * 1024 });
    try { return await inspectResumePdf(pdf, { deadline, signal }); }
    catch (error) { if (error.code === 'time_limit') throw error; throw Object.assign(error, { code: 'pdf_invalid' }); }
  } catch (error) {
    if (signal?.aborted || Date.now() >= deadline) throw resumeFailure('time_limit', { statusCode: 504 });
    throw error;
  } finally {
    // Aborting the CLI alone can leave a running container. Remove it explicitly.
    await docker(['rm', '--force', name], { deadline: Date.now() + 10000 }).catch(() => {});
  }
}
