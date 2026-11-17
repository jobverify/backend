import test from 'node:test'
import assert from 'node:assert/strict'
import {currentAmeyoTransport} from '../../scraper/ameyo/currentTransport20261117.js'
import {currentGmmcoTransport} from '../../scraper/gmmco/currentTransport20261117.js'
import {currentGenworxTransport} from '../../scraper/genworx/currentTransport20261117.js'
import {currentKaniniTransport} from '../../scraper/kanini/currentTransport20261117.js'
import {currentIgtTransport} from '../../scraper/igtsolutions/currentTransport20261117.js'

const sources = [
  ['Ameyo', currentAmeyoTransport, ['html', 'js', 'json', 'css']],
  ['Gmmco', currentGmmcoTransport, ['html', 'js', 'json', 'css']],
  ['GENWORX', currentGenworxTransport, ['html', 'js', 'json']],
  ['KANINI', currentKaniniTransport, ['html', 'js', 'json']],
  ['IGT', currentIgtTransport, ['html']],
]
const invalid = {
  html: ['xtext/html', 'text/htmlx', 'text/html, application/json'],
  js: ['xapplication/javascript', 'application/javascriptx', 'application/javascript, text/html'],
  json: ['xapplication/json', 'application/json-seq', 'application/json, text/html'],
  css: ['xtext/css', 'text/cssx', 'text/css, text/html'],
}
const valid = {
  html: ['text/html; charset=utf-8', 'APPLICATION/XHTML+XML ; charset=utf-8'],
  js: ['application/javascript; charset=utf-8', 'text/x-javascript ; charset=utf-8'],
  json: ['application/json; charset=utf-8', 'application/vnd.api+json ; charset=utf-8'],
  css: ['text/css; charset=utf-8', 'TEXT/CSS ; charset=utf-8'],
}
const url = 'https://atain.com/'

for (const [source, createReader, kinds] of sources) {
  test(`${source} rejects malformed native media types before consuming a response body`, async () => {
    for (const kind of kinds) for (const mime of invalid[kind]) {
      let bodyReads = 0
      let bodyCancellations = 0
      const io = createReader({
        requestIntervalMs: 0,
        allowedURL: value => value === url,
        allowedRequest: value => value === url,
        fetchImpl: async () => ({
          status: 200, url, headers: new Headers({'content-type': mime}), bodyUsed: false,
          body: {
            locked: false,
            getReader() { bodyReads++; throw Error('Malformed MIME body must remain unread') },
            async cancel() { bodyCancellations++ },
          },
        }),
      })
      try {
        await assert.rejects(io.read(url, kind), /MIME\/body/, `${source} accepted ${mime}`)
        assert.equal(bodyReads, 0)
        assert.equal(bodyCancellations, 1)
        assert.equal(io.receipts.length, 0)
      } finally { io.close() }
    }
  })

  test(`${source} retains complete supported native media types with legal parameters`, async () => {
    for (const kind of kinds) for (const mime of valid[kind]) {
      const body = kind === 'json' ? '{"native":true}' : 'complete native body'
      const io = createReader({
        requestIntervalMs: 0,
        allowedURL: value => value === url,
        allowedRequest: value => value === url,
        fetchImpl: async () => {
          const response = new Response(body, {status: 200, headers: {'content-type': mime}})
          Object.defineProperty(response, 'url', {value: url})
          return response
        },
      })
      try {
        const result = await io.read(url, kind)
        assert.equal(result.text, body)
        if (kind === 'json') assert.deepEqual(result.value, {native: true})
        assert.equal(io.receipts.length, 1)
      } finally { io.close() }
    }
  })
}
