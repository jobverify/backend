import test from 'node:test'
import {positive,negative,append} from './currentGlobalStateBoundary20261120.test.js'
import './currentGlobalStateNeighbor20261120.test.js'

test('Independent sparse boundary: unrelated spread arguments preserve original native state',async()=>{await positive(append('Math.max(...[,1]);'))})
test('Independent sparse boundary: unrelated apply arguments preserve original native state',async()=>{await positive(append('Math.max.apply(null,[,1]);'))})
test('Independent sparse boundary: sparse critical Object.assign arguments cannot prove original state',async()=>{await negative(append('Object.assign(...[window,,{__appData:{}}]);'))})
