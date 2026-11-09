Shared scraper regression tests and reusable fixtures live here.

- Put company-specific scraper tests next to the scraper as `scraper/<company>/script.test.js`.
- Put cross-scraper engine tests, provider tests, and shared fixtures under `scraper/tests/`.
- Keep temporary captures out of version control by using ignored `scraper/tests/fixtures/tmp*` paths.
