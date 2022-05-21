const MonoAPI = require('../Models/MonoAPI');
const Receipt = require('../Models/Receipt');
const currencyCodes = require('../Utils/currencyCodes.json');
const categorysCodes = require('../Utils/mccCodes.json');
const Wallet = require('../Models/Wallet');
const Budget = require('../Models/Budget');
const { v4: uuidv4 } = require('uuid');

const saveReceipt = (data) => {
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
    counterIban: data.counterIban,
    walletId: data.walletId,
    sortDate: createReadableDate(data.time, true)
  };

  const newReceipt = new Receipt(receiptObject);
  
  return newReceipt.save();
}

const saveBudgetSingle = (data) => {
  const options = {
    new: true,
    upsert: true
  }
  const filter = {
    category: data.category,
    month: data.month
  }
  const update = {
    amount: data.amount,
  }

  return Budget.findOneAndUpdate(filter, update, options)
};

const transformReceipts = (receipts) => {
  return receipts.map((receipt) => {
    receipt.date = createReadableDate(receipt.time);
    receipt.time = createReadableTime(receipt.time);
    receipt.category = categorysCodes[receipt.category];
    receipt.currency = currencyCodes[receipt.currency].symbol || currencyCodes[receipt.currency].code;
    receipt.amount = receipt.amount / 100;
    receipt.operationAmount = receipt.operationAmount / 100;
    receipt.commissionRate = receipt.commissionRate / 100;
    receipt.cashbackAmount = receipt.cashbackAmount / 100;

    return receipt;
  });
}

const createReadableDate = (time, isForSorting = false) => {
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
  if (!isForSorting) {
    return `${date}.${month}.${fullYear}`;
  }

  return `${fullYear}-${month}-${date}`;
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

const getDaysAgo = (days) => {
  const date = new Date();

  date.setDate(date.getDate() - days);
  
  return date.getTime();
}

module.exports.dropReceipts = async (req, res) => {
  try {
    const droped = await Receipt.remove({});

    res.status(200).json(droped)
  } catch (err) {
    console.log(err);

    res.status(500).json(err);
  }
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

module.exports.globalUpdate = async (req, res) => {
  const reqDays = req.query.days || 30;
  const dayAgo = getDaysAgo(reqDays);
  
  const options = {
    from: dayAgo,
    to: null
  };

  try {
    const userData = await MonoAPI.fetch('client-info');

    let sendResult = false;
    let savedWallets = [];
    let round = 0;
    userData.accounts.forEach((account, index, array) => {
      setTimeout(async () => {
        const walletData = {
          wallet_id: account.id,
          name: `Mono-${account.type}`,
          balance: account.balance,
          creditLimit: account.creditLimit
        }
        
        options['account'] = `${account.id}/`;

        Wallet.updateOne({wallet_id: account.id}, walletData, {upsert: true, setDefaultsOnInsert: true}, async (err, document) => {
          if (err) {
            console.log(err, 'From wallet save error!');
            throw new Error(err);
          }
          const walletReceipts = await MonoAPI.fetch('statement', options);
          let savedRecipts = [];
          if (walletReceipts.length) {
            savedRecipts = await Promise.allSettled(walletReceipts.map(receipt => saveReceipt({...receipt, walletId: account.id})));
          }
          
          sendResult = array.length === (index + 1);
          savedWallets.push({wallet: document, receipts: savedRecipts});
        });

        
      }, 60000 * round);
      round += 1;
    });

    const response = setInterval(() => {
      if (sendResult) {
        res.status(200).json(savedWallets);

        clearInterval(response);
      }
    }, 5000);
  } catch(err) {
    console.log(err+' catch');
    res.status(500).json(err);
  }
}

module.exports.dropWallets = async (req, res) => {
  try {
    const RemovedWallets = await Wallet.remove()

    res.status(200).json(RemovedWallets);
  } catch (err) {
    console.log(err);

    res.status(500).json(err);
  }
}

module.exports.getWallet = async (req, res) => {
  try {
    const Wallets = await Wallet.find().lean();
    
    Wallets.forEach(wallet => {
      wallet.balance /= 100;
      wallet.creditLimit /= 100;
    });

    res.status(200).json(Wallets);
  } catch (err) {
    console.log(err);

    res.status(500).json(err);
  }
}

module.exports.getReceiptsSimple = async (req, res) => {
  try {
    const Receipts = await Receipt.find().lean();

    res.status(200).json(Receipts);
  } catch (err) {
    res.status(500).json(err);
  }
}

module.exports.getByWalletId = async (req, res) => {
  try {
    const walletId = req.query.wallet;

    let Receipts = await Receipt.find({sortDate: {
      $gte: '2021-12-01',
      $lte: '2021-12-30'
    },
    walletId: walletId}).sort({ time: 'desc'}).lean();

    const BudgetGroups = await Budget.find({month: { $eq: 12 }}).lean();

    Receipts = transformReceipts(Receipts);

    const groupedByCategory = Receipts.reduce((groups, receipt) => {
      if (!groups[receipt.category]) {
        let budget = BudgetGroups.find(budget => budget.category === receipt.category);
        budget = budget ? budget.amount : 0;
        groups[receipt.category] = {
          receipts: [],
          total: 0,
          budget: budget,
          balance: budget
        };

      }

      if (!groups['Кешбек']) {
        groups['Кешбек'] = {
          receipts: [],
          total: 0,
          budget: 0,
          balance: 0
        };
      }

      if (!groups['Коммісії']) {
        groups['Коммісії'] = {
          receipts: [],
          total: 0,
          budget: 0,
          balance: 0
        };
      }

      if (receipt.commissionRate) {
        receipt.amount += receipt.commissionRate;
      }

      
      groups[receipt.category].receipts.push(receipt);
      groups[receipt.category].total += receipt.amount;
      groups[receipt.category].balance -= (receipt.amount * -1)
      
      if (receipt.cashbackAmount) {
        const newReceipt = {...receipt};
        newReceipt.amount = newReceipt.cashbackAmount;
        groups['Кешбек'].receipts.push(newReceipt);
        groups['Кешбек'].total += newReceipt.cashbackAmount;
      }

      if (receipt.commissionRate) {
        const newReceipt = {...receipt}
        newReceipt.amount = newReceipt.commissionRate * -1; 

        groups['Коммісії'].receipts.push(newReceipt);
        groups['Коммісії'].total += newReceipt.commissionRate * -1;
      }

      return groups;
    }, {});

    res.status(200).json(groupedByCategory);
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
}

module.exports.addCashWallet = async (req, res) => {
  
}

// module.exports.dbUpdate = 

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

    return Promise.allSettled(savedReceipts);
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
    let Receipts = await Receipt.find({sortDate: {
      $gte: '2022-05-01',
      $lte: '2022-05-31'
    }}).sort({ time: 'desc'}).lean();
    const BudgetGroups = await Budget.find({month: { $eq: 11 }}).lean();
    Receipts = transformReceipts(Receipts);

    const groupedByCategory = Receipts.reduce((groups, receipt) => {
      if (!groups[receipt.category]) {
        let budget = BudgetGroups.find(budget => budget.category === receipt.category);
        budget = budget ? budget.amount : 0;
        groups[receipt.category] = {
          receipts: [],
          total: 0,
          budget: budget,
          balance: budget
        };

      }

      if (!groups['Кешбек']) {
        groups['Кешбек'] = {
          receipts: [],
          total: 0,
          budget: 0,
          balance: 0
        };
      }

      if (!groups['Коммісії']) {
        groups['Коммісії'] = {
          receipts: [],
          total: 0,
          budget: 0,
          balance: 0
        };
      }

      if (receipt.commissionRate) {
        receipt.amount += receipt.commissionRate;
      }

      
      groups[receipt.category].receipts.push(receipt);
      groups[receipt.category].total += receipt.amount;
      groups[receipt.category].balance -= (receipt.amount * -1)
      
      if (receipt.cashbackAmount) {
        const newReceipt = {...receipt};
        newReceipt.amount = newReceipt.cashbackAmount;
        groups['Кешбек'].receipts.push(newReceipt);
        groups['Кешбек'].total += newReceipt.cashbackAmount;
      }

      if (receipt.commissionRate) {
        const newReceipt = {...receipt}
        newReceipt.amount = newReceipt.commissionRate * -1; 

        groups['Коммісії'].receipts.push(newReceipt);
        groups['Коммісії'].total += newReceipt.commissionRate * -1;
      }

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
    console.log(req.body.data.statementItem);
    await saveReceipt(req.body.data.statementItem)
    console.log(req);
  } catch (err) {
    console.log(err);
  }
}

module.exports.getByDescription = async (req, res) => {
  try {
    let Receipts = await Receipt
      .find({description: req.body.description})
      .sort({time: 'desc'})
      .lean();

    Receipts = transformReceipts(Receipts);

    const groupByDate = Receipts.reduce((acc, receipt) => {
      if (!acc[receipt.date]) {
        acc[receipt.date] = {};
        acc[receipt.date].receipts = [];
        acc[receipt.date].total = 0;
      }

      acc[receipt.date].receipts.push(receipt);
      acc[receipt.date].total += receipt.amount;

      return acc;
    }, {});

    res.status(200).json(groupByDate);
    
  } catch (err) {
    res.status(500).json(err);
  }
}

module.exports.getByCategory = async (req, res) => {
  try {
    let categoryId;

    for (let id in categorysCodes) {
      if (categorysCodes[id] === req.body.category) {
        categoryId = id;

        break;
      }
    }

    let Receipts = await Receipt
      .find({category: categoryId})
      .sort({time: 'desc'})
      .lean();

    Receipts = transformReceipts(Receipts);

    const groupByDate = Receipts.reduce((acc, receipt) => {
      if (!acc[receipt.date]) {
        acc[receipt.date] = {};
        acc[receipt.date].receipts = [];
        acc[receipt.date].total = 0;
      }

      acc[receipt.date].receipts.push(receipt);
      acc[receipt.date].total += receipt.amount;

      return acc;
    }, {});

    res.status(200).json(groupByDate);
    
  } catch (err) {
    res.status(500).json(err);
  }
}

module.exports.saveBudget = async (req, res) => {
  try {
    const budgetData = req.body.budget;
    const savedBudget = budgetData.map(saveBudgetSingle);
  
    const savedResult = await Promise.allSettled(savedBudget)

    res.status(200).json(savedResult);
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
}

module.exports.getCategorys = async (req, res) => {
  try {
    const BudgetCategoryes = await Budget
      .find()
      .lean();

    let getUsedCategorys;

    if (!BudgetCategoryes.length) {
      getUsedCategorys = await Receipt
        .find()
        .select('category')
        .lean();

      getUsedCategorys = getUsedCategorys.map(({ category, _id }) => {
        const catObject = {
          categoryId: category,
          category: categorysCodes[category],
          amount: 0
        };

        return catObject;
      })
      .filter((filter, index, array) => array.findIndex(({category}) => category === filter.category) === index );
    }

    const result = BudgetCategoryes.length
      ? BudgetCategoryes
      : getUsedCategorys;

    res.status(200).json(result);
  } catch (err) {
    console.log(err);
    res.status(500).json(err);
  }
}

module.exports.addWallet = async(req, res) => {
  const { name, balance, creditLimit } = req.body.data;
  const walletData = {
    wallet_id: uuidv4(),
    name: name,
    balance: balance,
    creditLimit: creditLimit
  };

  try {
    const newWallet = new Wallet(walletData);

    await newWallet.save();

    res.status(200).json({status: 'saved', data: newWallet});
  } catch(err) {
    res.status(500).json({status: 'error', data: err});
  }
}