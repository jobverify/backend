import {createCurrentReader,need} from './currentRead20261117.js'
const HOME='https://akersbio.com/'
export async function runCurrentAkers(options={}){
 const io=createCurrentReader(options,[[HOME,'html']],{maxReads:1})
 try{
  await io.read(HOME)
  io.check();need(false,'configured employer root is newly accessible but its current recruitment authority, native role inventory and criteria have not been verified')
 }finally{io.close()}
}
