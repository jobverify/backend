# Payment lifecycle integration checks

Run `npm run test:integration` after provisioning the local test MongoDB binary.
`paymentLifecycle.integration.js` starts a disposable MongoDB 8.2.6 replica set
on loopback. It never loads `.env`, connects to an existing database, downloads
a runtime, or initiates real payments/refunds.

The executable suite verifies purchase ownership before provider access, amount
and currency rejection, duplicate capture idempotency, partial and full refund
entitlements, duplicate refund idempotency, and rollback of a preceding user write
when purchase persistence fails. It uses synthetic records and provider events.

Provider signature and malformed webhook handling have separate tests in
`test/paymentProvider.security.test.js` and `test/billingController.test.js`.
This document describes the executable checks; it does not claim all possible
payment races or provider delivery contracts have been tested.
