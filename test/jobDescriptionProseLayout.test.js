import test from 'node:test';
import assert from 'node:assert/strict';
import { formatProseLayout } from '../rewriting/proseLayout.js';

const dense = 'Build reliable Python services. '.repeat(25);

for (const [name, source] of [
  ['table rows', '| Name | Details |\n| --- | --- |\n| Task | ' + dense + '|'],
  ['tables without leading pipes', 'Name | Details\n--- | ---\nTask | ' + dense],
  ['inline strikethrough', '~~' + dense + '~~'],
  ['fence content beginning with a language marker', '```markdown\n```js\n' + dense + '\n```'],
  ['one-space list continuation', '- Implement customer workflows.\n ' + dense],
  ['two-space list continuation', '- Implement customer workflows.\n  ' + dense],
  ['three-space list continuation', '1. Implement customer workflows.\n   ' + dense],
]) test(`paragraph formatting preserves Markdown ${name}`, () => {
  assert.deepEqual(formatProseLayout(source), { text: source, paragraphBreaks: 0 });
});

test('plain-text formatting resumes only after a complete closing fence', () => {
  const fenced = '```markdown\n```js\n' + dense + '\n```\n';
  const result = formatProseLayout(fenced + dense);
  assert.ok(result.text.startsWith(fenced));
  assert.ok(result.paragraphBreaks > 0);
  assert.equal(result.text.replace(/\s+/g, ' '), (fenced + dense).replace(/\s+/g, ' '));
});

test('collapsed heading recovery cannot rewrite a code fence or table cell', () => {
  for (const source of ['```text\nRequired Qualifications AWS experience\n```', '| Type | Value |\n| --- | --- |\n| Text | Required Qualifications AWS experience |']) {
    assert.deepEqual(formatProseLayout(source), { text: source, paragraphBreaks: 0 });
  }
});
