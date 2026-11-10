import test from 'node:test';
import assert from 'node:assert/strict';
import { resumePdfText } from '../src/services/resumePdfText.js';
import { buildSourceFacts, validateResumeFidelity } from '../src/services/resumeLatexContent.js';

const item = (str, y, hasEOL = false) => ({ str, transform: [11, 0, 0, 11, 50, y], hasEOL });

test('TeX text without hasEOL retains visual rows and joins text on the same baseline', () => {
  assert.equal(resumePdfText([item('Alex Example', 800), item('alex@example.test', 780), item('| +91 98765 43210', 780),
    item('EXPERIENCE', 740), item('Example Systems', 720), item('Software Engineer | Jan 2022 - Present', 700)]),
  'Alex Example\nalex@example.test | +91 98765 43210\nEXPERIENCE\nExample Systems\nSoftware Engineer | Jan 2022 - Present');
});

test('explicit line endings and sub-two-point baseline shifts do not add spurious blank rows', () => {
  assert.equal(resumePdfText([item('First row', 800, true), item('Second', 780), item('row', 779)]), 'First row\nSecond row');
});

test('adjacent PDF fragments preserve words, contact values and punctuation across font changes', () => {
  const run = (str, x, y, width) => ({ str, width, transform: [11, 0, 0, 11, x, y] });
  const source = { text: 'Example Candidate\ncandidate@example.test\nSKILLS\nJavaScript, Python', links: [] };
  const extracted = resumePdfText([
    run('Example', 50, 800, 40), run('Candidate', 93, 800, 45),
    run('candidate', 50, 780, 45), run('@example.test', 95, 780, 65),
    run('SKILLS', 50, 760, 35),
    run('Java', 50, 740, 23), run('Script', 73, 740, 26), run(',', 99, 740, 3), run('Python', 105, 740, 35),
  ]);
  assert.equal(extracted, source.text);
  assert.deepEqual(validateResumeFidelity({ facts: buildSourceFacts(source), text: extracted, links: [] }).issues, []);
});

test('explicit PDF whitespace stays a word separator even when runs touch', () => {
  const run = (str, x, width) => ({ str, width, transform: [11, 0, 0, 11, x, 800] });
  assert.equal(resumePdfText([run('Example ', 50, 45), run('Candidate', 95, 45)]), 'Example Candidate');
  assert.equal(resumePdfText([run('Example', 50, 40), run(' ', 90, 3), run('Candidate', 93, 45)]), 'Example Candidate');
});

test('visual line recovery prevents swapped employer dates from hiding in a flattened PDF', () => {
  const lines = ['Alex Example', 'alex@example.test', 'EXPERIENCE', 'Cedar Systems', 'Software Engineer | Jan 2022 - Present',
    'Built Java services.', 'Maple Labs', 'Developer | Jun 2020 - Dec 2021', 'Developed Python tools.'];
  const facts = buildSourceFacts({ text: lines.join('\n'), links: [] });
  const swapped = [...lines];
  swapped[4] = 'Software Engineer | Jun 2020 - Dec 2021';
  swapped[7] = 'Developer | Jan 2022 - Present';
  const extracted = resumePdfText(swapped.map((line, index) => item(line, 800 - index * 20)));
  const checked = validateResumeFidelity({ facts, text: extracted, links: [], tailored: true });
  assert.equal(checked.valid, false);
  assert.ok(checked.issues.some(issue => /Date no longer associated/.test(issue)));
});
