Backend API and service tests live in this folder.

- Keep HTTP/controller, middleware, utility, and service tests under `test/`.
- Keep shared scraper engine tests, scraper fixtures, and provider coverage tests under `scraper-support/tests/`.
- Keep company-local scraper tests next to the scraper as `scraper/<company>/script.test.js` when that is easier to maintain.
- Do not reintroduce a top-level `tests/` folder in this repository.

Run commands from the backend root:

- `npm test` runs the JavaScript tests in all three locations.
- `npm run test:api` runs the JavaScript tests under `test/`.
- `npm run test:integration` runs the isolated database integration tests.
- `python -m pip install -r test/requirements.txt`, then `python -m unittest discover -s test -p '*_test.py' -v`, runs the Python watchdog tests. These are separate from the npm suites.

MongoDB tests use a temporary local database. Provision the cached binary with `npm run test:provision-mongo` before the first run.

The native model smoke tests (`test/*.integration.js`) require their documented, predownloaded model/runtime assets and run separately from the isolated database integration suite.

Historical publishing-proof fixtures retain their original evidence bytes and capture times. Their success cases run with the reviewed source in a disposable runtime; current-source checks continue to reject changed or obsolete proofs.
