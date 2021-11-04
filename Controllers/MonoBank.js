const MonoAPI = require('../Models/MonoAPI');
const Receipt = require('../Models/Receipt');
const currencyCodes = {
  '980': 'UAH',
  '840': 'USD',
  '978': 'EUR',
  '826': 'GBP' 
};

const saveReceipt = data => {
  const receiptObject = {
    amount: data.amount,
    currency: currencyCodes[data.currencyCode],
    description: data.description,
    time: data.time,
    commissionRate: data.commissionRate,
    cashbackAmount: data.cashbackAmount,
    comment: data.comment,
    counterIban: data.counterIban
  };

  const newReceipt = new Receipt(receiptObject);
  
  return newReceipt.save();
}

module.exports.getUserInfo = (req, res) => {
  MonoAPI.fetch('client-info')
    .then(userData => {
      res.status(200).json(userData);
    })
    .catch(error => {
      res.status(500).json(error);
    });
}

module.exports.getCurrency = (req, res) => {
  MonoAPI.fetch('currency')
    .then(currencyData => {
      res.status(200).json(currencyData);
    })
    .catch(error => {
      res.status(500).json(error);
    });
}

module.exports.getReceipt = (req, res) => {
  const options = {
    from: req.query.from,
    to: req.query.to || null
  };

  MonoAPI.fetch('statement', options)
    .then(result => {
      res.status(200).json(result);
    })
    .catch(error => {
      res.status(500).json(error);
    })
}

module.exports.updateDataBase = async (req, res) => {
  console.log('updateDataBase');
  const to = new Date();
  const from = new Date();

  from.setMonth(to.getMonth() - 1);
  from.setDate(11);
  to.setMonth(from.getMonth());
  to.setDate(1);

  console.log(from);
  console.log(to);
  const options = {
    from: from.getTime(),
    to: to.getTime()
  };

  MonoAPI.fetch('statement', options)
  .then(result => {
    const savedReceipts = result.map(saveReceipt);

    console.log(savedReceipts);
    return Promise.all(savedReceipts);
  })
  .then(savedReceipts => {
    res.status(200).json(savedReceipts);
  })
  .catch(error => {
    res.status(500).json(error);
  })
}