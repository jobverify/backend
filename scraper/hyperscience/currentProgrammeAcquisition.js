import {reconcileHyperscienceServerProgramme} from './currentProgrammeData.js';
import {exactFields,plainSnapshot,privateBytes,need} from './currentProgrammeRenderer.js';

function acquiredQuery(record){
  const original=exactFields(record,['body','receipt']);
  const body=privateBytes(original.body,4194304);
  const receipt=plainSnapshot(original.receipt);
  need(receipt!==null&&typeof receipt==='object'&&!Array.isArray(receipt),
    'ownership','Plain original query receipt required');
  need(!Object.hasOwn(receipt,'consumedBodyBytes')||
    (Number.isSafeInteger(receipt.consumedBodyBytes)&&receipt.consumedBodyBytes===body.length),
    'transport','Explicit query body consumption contradicts the complete original entity');
  for(const key of ['discardedOverflowBytes','overflowBytes']){
    need(!Object.hasOwn(receipt,key)||(Number.isSafeInteger(receipt[key])&&receipt[key]===0),
      'transport','Explicit discarded query overflow contradicts complete entity retention');
  }
  return{body,receipt};
}

/** Validate both privately copied acquired Q records before the frozen full
 * reader. Its result remains pure publication facts; acquisition currentness,
 * all-channel closing and zero qualification remain controller obligations. */
export function reconcileHyperscienceAcquiredProgramme(options){
  const value=exactFields(options,['entry','positions','api','roles','intakeShell','intakeClient','intakeOpening','intakeClosing']);
  const intakeOpening=acquiredQuery(value.intakeOpening);
  const intakeClosing=acquiredQuery(value.intakeClosing);
  return reconcileHyperscienceServerProgramme({...value,intakeOpening,intakeClosing});
}
