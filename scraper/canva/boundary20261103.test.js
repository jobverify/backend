import test from 'node:test'
import assert from 'node:assert/strict'
import {createCanvaScraper} from './script.js'
test('Canva supplied ignored reader respects caller cancellation',{timeout:500},async()=>{
 const controller=new AbortController(),reason={caller:true};const pending=createCanvaScraper().run({signal:controller.signal,fetchPage:()=>new Promise(()=>{})});setTimeout(()=>controller.abort(reason),5);await assert.rejects(pending,error=>error===reason)
})
