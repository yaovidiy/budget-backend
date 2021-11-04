const MonoAPI = require('../Models/MonoAPI');
const Receipt = require('../Models/Receipt');
const currencyCodes = require('../Utils/currencyCodes.json');
const categorysCodes = require('../Utils/mccCodes.json');
const nodemailer = require('nodemailer');

const saveReceipt = data => {
  const receiptObject = {
    operationId: data.id,
    amount: data.amount,
    operationAmount: data.operationAmount,
    currency: data.currencyCode,
    category: data.mcc,
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

const createReadableDate = time => {
  const miliseconds = time * 1000;

  const DateObj = new Date(miliseconds);
  const fullYear = DateObj.getFullYear();
  let month = DateObj.getMonth() + 1;
  let date = DateObj.getDate();


  month = month < 10
    ? `0${month}`
    : `${month}`;
  date = date < 10
    ? `0${date}`
    : `${date}`;
  
  return `${date}.${month}.${fullYear}`;
}

const createReadableTime = time => {
  const miliseconds = time * 1000;

  const DateObj = new Date(miliseconds);
  const hours = DateObj.getHours();
  const minutes = DateObj.getMinutes();

  return `${hours}:${minutes}`;
}

const setCategoryName = categoryCode => {
  return categorysCodes[categoryCode];
}

const setCurrencyName = currencyCode => {
  return currencyCodes[currencyCode].symbol || currencyCodes[currencyCode].code;
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
    console.log(error);
    res.status(500).json(error);
  })
}

module.exports.getReceipts = async (req, res) => {
  try {
    const Receipts = await Receipt.find().lean();
    Receipts.forEach(receipt => {
      receipt.date = createReadableDate(receipt.time);
      receipt.time = createReadableTime(receipt.time);
      receipt.category = categorysCodes[receipt.category];
      receipt.currency = currencyCodes[receipt.currency].symbol || currencyCodes[receipt.currency].code;
      receipt.amount = receipt.amount / 100;
      receipt.operationAmount = receipt.operationAmount / 100;
      receipt.commissionRate = receipt.commissionRate / 100;
      receipt.cashbackAmount = receipt.cashbackAmount / 100;
    });

    const groupedByCategory = Receipts.reduce((groups, receipt) => {
      if (!groups[receipt.category]) {
        groups[receipt.category] = {
          receipts: [],
          total: 0
        };

      }

      if (!groups['Cashback']) {
        groups['Cashback'] = {
          receipts: [],
          total: 0
        };
      }

      if (!groups['Commision']) {
        groups['Commision'] = {
          receipts: [],
          total: 0
        };
      }

      if (receipt.cashbackAmount) {
        groups['Cashback'].receipts.push(receipt);
        groups['Cashback'].total += receipt.cashbackAmount;
      }

      if (receipt.commissionRate) {
        groups['Commision'].receipts.push(receipt);
        groups['Commision'].total += receipt.commissionRate;

        receipt.amount = +(receipt.amount + receipt.commissionRate).toFixed(2); 
      }

      groups[receipt.category].receipts.push(receipt);
      groups[receipt.category].total += receipt.amount;

      return groups;
    }, {});

    const groupedByDescription = Receipts.reduce((groups, receipt) => {
      if (!groups[receipt.description]) {
        groups[receipt.description] = {
          receipts: [],
          total: 0
        }
      }

      groups[receipt.description].receipts.push(receipt);
      groups[receipt.description].total += receipt.amount;

      return groups;
    }, {});

    res.status(200).json({cat: groupedByCategory, des: groupedByDescription});
   } catch (err) {
     console.log(err);
    res.status(500).json(err);
  }
}

module.exports.saveFromWebHook = async (req, res) => {
  try {
    await saveReceipt(req.body.statementItem);
  } catch (err) {
    console.log(err);
  }
}