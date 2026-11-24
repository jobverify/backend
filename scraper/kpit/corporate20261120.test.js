import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {currentKpitHeaders} from './currentNative20261115.js'
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/corporate-headers-20261120.json.gz',import.meta.url))))
const profile=JSON.parse(fs.readFileSync(new URL('./currentProfile20261115.json',import.meta.url)))
const expected=profile.packets[current.requestedURL].headers
test('actual current corporate Vary repeats retain the same effective request context',()=>assert.deepEqual(currentKpitHeaders(current.headers),currentKpitHeaders(expected)))
test('an additional Origin request context remains a distinct native header contract',()=>assert.notDeepEqual(currentKpitHeaders({...current.headers,vary:current.headers.vary+',Origin'}),currentKpitHeaders(expected)))
test('a wildcard Vary context remains distinct from the reviewed native context',()=>assert.notDeepEqual(currentKpitHeaders({...current.headers,vary:'*'}),currentKpitHeaders(expected)))
