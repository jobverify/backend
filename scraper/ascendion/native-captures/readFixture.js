import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
const manifest = JSON.parse(readFileSync(new URL('./manifest.json', import.meta.url)))
const compressed = readFileSync(new URL(manifest.archiveFile, import.meta.url))
if (createHash('sha256').update(compressed).digest('hex') !== manifest.archiveSHA256) throw Error('Native capture archive hash mismatch')
const bytes = gunzipSync(compressed)
if (bytes.length !== manifest.decodedArchiveBytes) throw Error('Native capture archive byte mismatch')
const archive = JSON.parse(bytes)
export const readCaptureManifest = collection => archive.collections[collection].manifest
export const readCaptureBody = (collection, name) => Buffer.from(archive.bodies[`${collection}/${name}`], 'base64')
