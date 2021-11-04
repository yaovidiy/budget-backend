const fetch = require('node-fetch');

const apiKey = process.env.MONOBANK_TOKEN;
const apiURL = 'https://api.monobank.ua/';
const endpoints = {
  currency: 'bank/currency',
  'client-info': 'personal/client-info',
  statement: 'personal/statement/0/'
};
let isSended = false;
let secondsLeft = 60;

const timer = () => {
  const counter = setInterval(() => {
    secondsLeft--;

    if (secondsLeft <= 0) {
      clearInterval(counter);
      secondsLeft = 60;
    }
  }, 1000);
}

module.exports.fetch = (endpoint, options = {}) => {
  if (isSended) {
    return Promise.resolve(`to many requests next request in ${secondsLeft} seconds`);
  } else {
    isSended = true;
    timer()

    setTimeout(() => {
      isSended = false;
    }, 60000);
  }

  let endpointURL = `${apiURL}${endpoints[endpoint]}`;

  if (endpoint === 'statement') {
    if (!('from' in options)) {
      throw new Error('Statement enpoint must contain from property in the options array')
    }

    const from = Math.floor(options.from / 1000);
    const to = options.to ? Math.floor(options.to / 1000) : null;

    endpointURL = `${apiURL}${endpoints[endpoint]}${from}${!to ? '' : `/${to}`}`
  }

  if (!options.headers) {
    options.headers = {
      'X-Token': apiKey
    };
  } else {
    options.headers['X-Token'] = apiKey;
  }

  return fetch(endpointURL, options)
    .then(response => {
      return response.json()
    });
  }
