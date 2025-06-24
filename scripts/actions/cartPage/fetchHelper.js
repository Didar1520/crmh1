// fetchHelper.js или в самом месте, где нужен fetch:
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

module.exports = { fetch };
