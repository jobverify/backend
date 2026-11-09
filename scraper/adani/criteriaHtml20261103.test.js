import test from 'node:test'
import assert from 'node:assert/strict'
import { projectNativeCriteria, normalizeNativeCriteriaStyles } from './nativeCriteriaHtml.js'

test('style normalization preserves literal visible prose and non-style attribute content', () => {
  const prose = 'Use style="font-family: Arial" when building the layout.'
  assert.deepEqual(projectNativeCriteria('<p>' + prose + '</p>'), { text: prose, complete: true })
  assert.deepEqual(projectNativeCriteria('<p data-example=\'style="font-family: Arial"\'>' + prose + '</p>'), { text: prose, complete: true })
  assert.deepEqual(projectNativeCriteria('<!-- style="font-family: Arial" --><p>' + prose + '</p>'), { text: prose, complete: true })
})

test('only real parsed style attributes change while prose, comments and other attributes retain exact markup', () => {
  const prefix = '<!-- style="font-family: Arial" --><script>const sample = \'style="font-family: Arial"\'</script>'
  const paragraph = '<p data-example=\'style="font-family: Arial"\' style="font-family:Arial;color:red">Use style="font-family: Arial".</p>'
  assert.equal(normalizeNativeCriteriaStyles(prefix + paragraph).html, prefix + paragraph.replace('style="font-family:Arial;color:red"', 'style="color:red"'))
})

test('retains native role criteria with decorative table-edge styles', () => {
  const content = '<table><tr><td style="border-top-style:none;border-left-style:solid">Lead the complete engineering programme and review delivery criteria.</td></tr></table>'
  const result = projectNativeCriteria(content)
  assert.equal(result.complete, true)
  assert.ok(result.text.includes('complete engineering programme'))
})

test('handles the native encoded font-family delimiter without losing adjacent criteria', () => {
  const content = '<p style="color:rgb(0,0,0);font-family:&quot;;Times New Roman&quot;font-size:medium;">A recognised engineering qualification and relevant delivery experience are required.</p>'
  const result = projectNativeCriteria(content)
  assert.equal(result.complete, true)
  assert.ok(result.text.includes('engineering qualification'))
})

test('a semicolon inside a font name cannot consume a real hidden style', () => {
  const result = projectNativeCriteria('<p style="font-family:&quot;family;display:block&quot;;display:none">Hidden internal criteria</p><p>Visible public criteria.</p>')
  assert.equal(result.complete, true)
  assert.equal(result.text, 'Visible public criteria.')
})

test('decorative style handling preserves native opacity and unknown placement checks', () => {
  assert.equal(projectNativeCriteria('<p style="border-right-style:none;opacity:0">Hidden text</p><p>Visible text</p>').text, 'Visible text')
  assert.equal(projectNativeCriteria('<p style="border-right-style:none;position:absolute;top:-99999px">Unresolved text</p>').complete, false)
  assert.equal(projectNativeCriteria('<style>.hidden{display:none}</style><p class="hidden">Hidden criteria</p>').complete, false)
})
