import assert from 'node:assert/strict';
import test from 'node:test';
import User from '../src/models/User.js';
import PendingUser from '../src/models/PendingUser.js';
import { register, resendVerification } from '../src/controllers/authController.js';

for (const action of [register, resendVerification]) {
  test(`${action.name} reports verification delivery failures instead of success`, async t => {
    for (const [key, value] of Object.entries({ EMAIL_RELAY_URL: 'https://relay.example', EMAIL_RELAY_SECRET: 'a'.repeat(32), FRONTEND_ORIGIN: 'https://www.jobverify.in' })) {
      const before = process.env[key]; process.env[key] = value;
      t.after(() => { if (before === undefined) delete process.env[key]; else process.env[key] = before; });
    }
    t.mock.method(User, 'findOne', async () => null);
    t.mock.method(PendingUser, 'findOne', async () => null);
    t.mock.method(PendingUser.prototype, 'save', async function () { return this; });
    t.mock.method(PendingUser, 'findOneAndUpdate', async () => ({}));
    t.mock.method(globalThis, 'fetch', async () => Response.json({ success: false }, { status: 503 }));
    t.mock.method(console, 'error', () => {});
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await action({ body: { name: 'Fixture', email: 'fixture@gmail.com' } }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, 'Unable to send the verification email. Please try again in a minute.');
  });

  test(`${action.name} keeps the request alive until verification delivery settles`, async t => {
    for (const [key,value] of Object.entries({EMAIL_RELAY_URL:'https://relay.example',EMAIL_RELAY_SECRET:'a'.repeat(32),FRONTEND_ORIGIN:'https://www.jobverify.in'})) {
      const before=process.env[key]; process.env[key]=value;
      t.after(()=>{if(before===undefined) delete process.env[key];else process.env[key]=before;});
    }
    t.mock.method(User,'findOne',async()=>null);
    t.mock.method(PendingUser,'findOne',async()=>null);
    t.mock.method(PendingUser.prototype,'save',async function(){return this;});
    t.mock.method(PendingUser,'findOneAndUpdate',async()=>({}));
    let release, started;
    const began=new Promise(resolve=>{started=resolve;});
    const delivery=new Promise(resolve=>{release=resolve;});
    t.mock.method(globalThis,'fetch',async()=>{started();await delivery;return Response.json({success:true});});
    let responded=false;
    const res={status(){return this;},json(){responded=true;return this;}};
    const running=action({body:{name:'Fixture',email:'fixture@gmail.com'}},res);
    await began;
    await new Promise(resolve=>setImmediate(resolve));
    try {assert.equal(responded,false,'response must wait for email delivery');}
    finally {release();await running;}
    assert.equal(responded,true);
  });
}
