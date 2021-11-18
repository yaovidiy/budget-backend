const MonoAPI = require('../Models/MonoAPI');
const Receipt = require('../Models/Receipt');
const currencyCodes = require('../Utils/currencyCodes.json');
const categorysCodes = require('../Utils/mccCodes.json');
const Budget = require('../Models/Budget');

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
    counterIban: data.counterIban,
    sortDate: createReadableDate(data.time, true)
  };

  const newReceipt = new Receipt(receiptObject);
  
  return newReceipt.save();
}

const saveBudgetSingle = (data) => {
  const budgetData = {
    category: data.category,
    categoryId: data.categoryId,
    amount: data.amount,
    month: data.month
  }

  const newBudgetCategory = new Budget(budgetData)

  return newBudgetCategory.save()
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
      $gte: '2021-11-01',
      $lte: '2021-11-30'
    }}).sort({ time: 'desc'}).lean();
    const BudgetGroups = await Budget.find({month: { $eq: 11 }}).lean();
    Receipts = transformReceipts(Receipts);

    const groupedByCategory = Receipts.reduce((groups, receipt) => {
      if (!groups[receipt.category]) {
        const budget = BudgetGroups.find(budget => budget.category === receipt.category).amount;
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
          total: 0
        };
      }

      if (!groups['Коммісії']) {
        groups['Коммісії'] = {
          receipts: [],
          total: 0
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