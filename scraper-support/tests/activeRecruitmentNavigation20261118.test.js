import assert from 'node:assert/strict'
import test from 'node:test'
import { activeRecruitmentNavigationDeclarations } from '../utils/activeNativeHtml.js'

const target = 'https://jobs.lever.co/directi'
// The current Directi careers publisher declares its board through this button
// instead of an anchor. The complete public capture is retained in the report.
const button = (handler = `window.open('${target}')`, changes = '') =>
  `<button ${changes} onclick="${handler}">View job posting</button>`
const declaration = { href: target, label: 'View job posting', carrier: 'onclick' }

test('active recruiting button exposes its literal window.open navigation without executing it', () => {
  assert.deepEqual(activeRecruitmentNavigationDeclarations(button()), [declaration])
})

test('HTML entity decoding keeps a quoted literal navigation destination intact', () => {
  assert.deepEqual(activeRecruitmentNavigationDeclarations(button(`window.open(&quot;${target}&quot;, &quot;_blank&quot;);`)), [declaration])
})

for (const [name, html] of [
  ['template', `<template>${button()}</template>`],
  ['HTML comment', `<!--${button()}-->`],
  ['script string', `<script>const markup = ${JSON.stringify(button())};</script>`],
  ['textarea', `<textarea>${button()}</textarea>`],
  ['object fallback', `<object>${button()}</object>`],
  ['hidden control', button(undefined, 'hidden')],
  ['inert ancestor', `<div inert>${button()}</div>`],
  ['inline hidden ancestor', `<div style="display:none">${button()}</div>`],
  ['aria hidden control', button(undefined, 'aria-hidden="true"')],
  ['disabled control', button(undefined, 'disabled')],
  ['aria disabled control', button(undefined, 'aria-disabled="true"')],
  ['disabled fieldset', `<fieldset disabled>${button()}</fieldset>`],
  ['unrelated label and destination', '<button onclick="window.open(\'https://example.com/about\')">More</button>'],
  ['noninteractive node', `<div onclick="window.open('${target}')">View job posting</div>`],
  ['event delegation script', `<script>window.open('${target}')</script>`],
  ['computed destination', button("window.open('https://jobs.lever.co/' + account)")],
  ['variable destination', button('window.open(boardURL)')],
  ['conditional navigation', button(`if (eligible) window.open('${target}')`)],
  ['preceding side effect', button(`track(); window.open('${target}')`)],
  ['following side effect', button(`window.open('${target}'); track()`)],
  ['computed method', button(`window['open']('${target}')`)],
  ['shadowed window', button(`const window = other; window.open('${target}')`)],
  ['invalid handler escaping the parser wrapper', button(`window.open('${target}');} function unused(){`)],
  ['javascript destination', button("window.open('javascript:run()')")],
  ['credentialed destination', button("window.open('https://user:password@jobs.lever.co/directi')")],
  ['dynamic target', button(`window.open('${target}', targetName)`)],
  ['arbitrary named window', button(`window.open('${target}', 'other-window')`)],
]) test('unqualified recruiting navigation is ignored: ' + name, () => {
  assert.deepEqual(activeRecruitmentNavigationDeclarations(html), [])
})

test('unrelated inline handlers are never evaluated while reading a qualifying button', () => {
  const html = `<button onclick="globalThis.unexpectedNavigationExecution = true">Careers</button>${button()}`
  assert.deepEqual(activeRecruitmentNavigationDeclarations(html), [declaration])
  assert.equal(globalThis.unexpectedNavigationExecution, undefined)
})
