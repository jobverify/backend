import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDescriptionSourceUpdate, buildRewriteInput } from '../src/services/jobDescriptionPolicy.js';
import { hasSourceDescription } from '../src/utils/jobSourceContent.js';

test('native description display preserves source headings, paragraphs and list boundaries', () => {
  const sourceDescription = '<h2>About the role</h2><p>Build reliable services for customers.</p>'
    + '<p>Work with the product team.</p><h3>Responsibilities</h3>'
    + '<ul><li>Design APIs.</li><li>Test changes.</li></ul>'
    + '<h3>Preferred qualifications</h3><p>Python is preferred, not required.</p>';
  const update = buildDescriptionSourceUpdate({ title: 'Engineer', sourceDescription }, null);
  assert.equal(update.sourceDescription, sourceDescription);
  assert.equal(update.descriptionFormat, 'markdown');
  assert.equal(update.description, '## About the role\n\nBuild reliable services for customers.\n\nWork with the product team.\n\n## Responsibilities\n\n- Design APIs.\n- Test changes.\n\n## Preferred qualifications\n\nPython is preferred, not required.');
});

test('ordered instructions and wrapped eligibility exceptions retain their complete wording', () => {
  const sourceDescription = '<h2>Application steps</h2><ol start="3"><li>Submit your CV.</li>'
    + '<li>Complete the assessment <strong>only if invited</strong>.</li></ol>'
    + '<h2>Requirements</h2><ul><li>At least 2 years of experience.<p>This requirement is waived if you complete our apprenticeship.</p></li></ul>';
  const update = buildDescriptionSourceUpdate({ sourceDescription }, null);
  assert.match(update.description, /3\. Submit your CV\.\n4\. Complete the assessment only if invited\./);
  assert.match(update.description, /- At least 2 years of experience\. This requirement is waived if you complete our apprenticeship\./);
});

test('website controls and inert content do not become employer display paragraphs', () => {
  const sourceDescription = '<nav>Home All jobs</nav><h2>Responsibilities</h2><p>Build customer applications.</p>'
    + '<p hidden>Private draft</p><div aria-hidden="true">Template</div><script>bad()</script>'
    + '<footer>Privacy Cookie settings</footer><form>Upload your CV</form>';
  const update = buildDescriptionSourceUpdate({ sourceDescription }, null);
  assert.equal(update.description, '## Responsibilities\n\nBuild customer applications.');
  assert.equal(update.sourceDescription, sourceDescription);
});

test('source display decodes text once and preserves technical comparisons', () => {
  const sourceDescription = '<p>Use List&lt;T&gt; &amp; C++ with x &lt; 5 and y &gt; 2.</p>';
  const update = buildDescriptionSourceUpdate({ sourceDescription }, null);
  assert.equal(update.description, 'Use List<T> & C++ with x < 5 and y > 2.');
});

test('inert-only and encoded inert documents cannot become visible employer descriptions', () => {
  const draft = 'Internal draft candidates must have five years of experience and complete all assessments before applying to this role with our engineering team and support customers across the company on every working day.';
  for (const sourceDescription of [`<template>${draft}</template>`, `&lt;template&gt;${draft}&lt;/template&gt;`, `<aside>${draft}</aside>`, `<main hidden>${draft}</main>`]) {
    const input = { sourceDescription };
    const update = buildDescriptionSourceUpdate(input, null);
    assert.equal(Object.hasOwn(update, 'description'), false, sourceDescription);
    assert.equal(Object.hasOwn(update, 'descriptionFormat'), false, sourceDescription);
    assert.equal(update.sourceDescription, null, sourceDescription);
    assert.equal(update.descriptionRewrite.status, 'skipped');
    assert.equal(update.descriptionRewrite.reason, 'insufficient_source');
    const stored = { ...input, ...update };
    assert.equal(update.sourceContentHash, buildRewriteInput(stored).inputHash);
    assert.equal(hasSourceDescription(stored), false, sourceDescription);
  }
});

test('nested alternatives and explicit instruction numbers survive HTML display serialization', () => {
  const sourceDescription = '<h2>Qualifications</h2><ul><li>One of the following:<ul><li>Degree A</li><li>Degree B</li></ul></li><li>Python is preferred.</li></ul>'
    + '<h2>Application steps</h2><ol><li>Complete the assessment.</li><li value="5">Wait for an invitation.</li><li>Complete the assessment.</li></ol>';
  const update = buildDescriptionSourceUpdate({ sourceDescription }, null);
  assert.match(update.description, /- One of the following:\n {2}- Degree A\n {2}- Degree B\n- Python is preferred\./);
  assert.match(update.description, /1\. Complete the assessment\.\n5\. Wait for an invitation\.\n6\. Complete the assessment\./);
});

test('double HTML breaks preserve actual paragraph boundaries and single breaks remain readable', () => {
  const sourceDescription = '<p>First employer paragraph<br>continued on the next line.<br><br>Second employer paragraph.<br><br>Third employer paragraph.</p>';
  assert.equal(buildDescriptionSourceUpdate({ sourceDescription }, null).description, 'First employer paragraph continued on the next line.\n\nSecond employer paragraph.\n\nThird employer paragraph.');
});
