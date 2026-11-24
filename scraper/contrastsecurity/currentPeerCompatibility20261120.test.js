import test from 'node:test'
import {own,held,qualified} from './currentPeerBoundary20261120.test.js'
import {HOME,close,exact} from './currentConfiguredBoard20261120.test.js'

test('Contrast peer compatibility: current WebPage fragment identifier remains qualified',async()=>{await qualified(own(model=>model['@id']=HOME+'#webpage'))})
test('Contrast peer compatibility: current nested Article WebPage remains qualified',async()=>{await qualified(own(model=>{model['@type']='Article';model.mainEntityOfPage={'@type':'WebPage','@id':HOME}}))})
test('Contrast peer compatibility: current Article positive publication remains qualified',async()=>{await qualified(own(model=>{model['@type']='Article';model.isPublished=true}))})
test('Contrast peer compatibility: SVG title may independently contain the same publisher brand',async()=>{await qualified(close(HOME,html=>exact(html,'</body>','<svg role="img"><title>Contrast Security careers illustration</title><path d="M0 0"></path></svg></body>')))})
test('Contrast peer compatibility: foreignObject HTML title retains HTML ambiguity',async()=>{await held(close(HOME,html=>exact(html,'</body>','<svg><foreignObject><title>Current secondary HTML title</title></foreignObject></svg></body>')))})
