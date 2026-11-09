import { checkCurrentReplay, assertCurrentProvider } from '../../scraper-support/native-sources/declaredJobFeeds/legacyReplayControls.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261024.json.gz', import.meta.url))))
test('affirm: current original-entity complete replay (legacy case 9)', async () => checkCurrentReplay('affirm', 'complete'))
test('affirm: current original-entity primary replay (legacy case 16)', async () => checkCurrentReplay('affirm', 'primary'))
