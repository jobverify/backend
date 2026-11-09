import { checkCurrentReplay, assertCurrentProvider } from '../native-sources/declaredJobFeeds/legacyReplayControls.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const loadTailscaleModule = async () => import('../../scraper/tailscale/script.js')

test('tailscale: current original-entity complete replay (legacy case 6)', async () => checkCurrentReplay('tailscale', 'complete'))

test('tailscale: current original-entity primary replay (legacy case 91)', async () => checkCurrentReplay('tailscale', 'primary'))
