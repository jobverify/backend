import test from 'node:test'
import assert from 'node:assert/strict'
import {readNativeDocument,activeHead,extractActiveDescription,activeScripts} from '../utils/activeNativeHtml.js'

const visible=html=>{const doc=readNativeDocument(html);return doc.text(doc.nodes(n=>n.tag==='root')[0])}
test('a self-closing SVG icon title cannot swallow the following live recruitment content',()=>{
 const html='<html><head><title>Careers</title></head><body><svg><title/><g><path d="x"/></g></svg><main><h2>Engineer</h2><p>Build reliable production services and test their behavior.</p></main></body></html>'
 assert.match(visible(html),/Engineer Build reliable/)
 assert.deepEqual(activeHead(html).titles,['Careers'])
})
test('a nonempty SVG title remains visible icon text and is not a document title',()=>{
 const html='<html><head><title>Careers</title></head><body><svg><title>Career icon</title><path/></svg><p>Full responsibilities follow.</p></body></html>'
 assert.match(visible(html),/Career icon Full responsibilities follow/)
 assert.deepEqual(activeHead(html).titles,['Careers'])
})
test('ordinary HTML title raw text still requires its real closing tag',()=>{
 const html='<title/><h2>This is title text</h2></title><p>Actual body text.</p>'
 assert.deepEqual(activeHead(html).titles,['<h2>This is title text</h2>'])
 assert.equal(visible(html),'Actual body text.')
})
test('self-closing syntax on an HTML hidden non-void container does not make its contents active',()=>{
 assert.equal(visible('<div hidden/><p>Hidden role</p></div><p>Visible role</p>'),'Visible role')
})
test('SVG foreignObject restores HTML self-closing and hidden-content behavior',()=>{
 assert.equal(visible('<svg><foreignObject><div hidden/><p>Hidden</p></div></foreignObject></svg><p>Visible</p>'),'Visible')
})
test('a title-shaped token in an unquoted SVG attribute is not a self-closing flag',()=>{
 const html='<svg><g id=icon/><title>Nested icon</title></g></svg><p>Actual role criteria.</p>'
 assert.match(visible(html),/Nested icon Actual role criteria/)
})
test('SVG title handling preserves hidden, template, script and object evidence boundaries',()=>{
 const html='<template><svg><title/></svg><p>Template role</p></template><object><svg><title/></svg><p>Object role</p></object><svg hidden><title>Hidden icon</title></svg><svg><title/></svg><script>const secret="Script role";</script><p>Published role criteria for public applicants.</p>'
 assert.equal(visible(html),'Published role criteria for public applicants.')
 assert.equal(activeScripts(html).length,1)
 assert.equal(extractActiveDescription(html),'Published role criteria for public applicants.')
})
