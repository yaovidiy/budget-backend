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
  const options = {
    from: req.query.from,
    to: req.query.to || null
  };

  MonoAPI.fetch('statement', options)
  .then(result => {
    const savedReceipts = result.map(saveReceipt);

    return Promise.all(savedReceipts);
  })
  .then(savedReceipts => {
    res.status(200).json(savedReceipts);
  })
  .catch(error => {
    res.status(500).json(error);
  })
}

module.exports.getReceipts = async (req, res) => {
  try {
    const Receipts = await Receipt.find();
    const procesedReceipts = Receipts.map(receipt => {
      const Date = new Date(receipt.time * 1000);
      const date = Date.getDate() < 10 ? `0${Date.getDate()}` : `${Date.getDate()}`;
      let month = Date.getMonth() + 1;
      month = month < 10 ? `0${month}` : `${month}`;
      const readableDate = `${date}.${month}.${Date.getFullYear()}`;

      receipt.date = readableDate;
      receipt
    })

   } catch (err) {
    
  }
}