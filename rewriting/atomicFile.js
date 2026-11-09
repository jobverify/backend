import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

const transientRenameErrors=new Set(['EPERM','EACCES','EBUSY']);

/** Commit a complete file; transient Windows locks must not destroy the prior checkpoint. */
export async function writeFileAtomically(file,text,{fileSystem=fs,wait=delay,maxAttempts=8}={}) {
 if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>20)throw new RangeError('Invalid atomic-write attempt limit');
 const staged=file+'.'+randomUUID()+'.tmp';
 try {
  await fileSystem.writeFile(staged,text,{flag:'wx'});
  for(let attempt=1;attempt<=maxAttempts;attempt++) {
   try {await fileSystem.rename(staged,file);return;}
   catch(error) {
    if(!transientRenameErrors.has(error.code)||attempt===maxAttempts)throw error;
    await wait(Math.min(1000,25*2**(attempt-1)));
   }
  }
 } finally {
  // The staged file may already have been renamed; cleanup cannot invalidate a successful commit.
  await fileSystem.rm(staged,{force:true}).catch(()=>{});
 }
}
