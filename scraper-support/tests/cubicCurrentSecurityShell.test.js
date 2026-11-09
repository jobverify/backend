import assert from 'node:assert/strict'
import test from 'node:test'
import { hasOfficialCareersBlockSignal, createCubicTransportationSystemsScraper } from '../../scraper/cubictransportationsystems/script.js'
const shell='<html><head><META NAME="robots" CONTENT="noindex,nofollow"><script src="/_Incapsula_Resource?SWJIYLWA=abc"></script><body></body></html>'
test('Cubic identifies the current empty corporate security shell',()=>assert.equal(hasOfficialCareersBlockSignal(shell),true))
test('Cubic still requires independent public Workday identity after the corporate shell',async()=>{let calls=0;await assert.rejects(createCubicTransportationSystemsScraper().run({fetchText:async()=>++calls===1?shell:'<html>Unrelated board</html>'}),/Workday board/);assert.equal(calls,2)})
test('Cubic does not confuse unrelated empty or substantive pages with the security shell',()=>{assert.equal(hasOfficialCareersBlockSignal('<html><body></body></html>'),false);assert.equal(hasOfficialCareersBlockSignal(shell.replace('<body></body>','<body>Unrelated company</body>')),false)})
