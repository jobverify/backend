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
