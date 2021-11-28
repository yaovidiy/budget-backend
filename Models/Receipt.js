const mongoose = require('mongoose');

const ReceiptSchema = new mongoose.Schema(
  {
    operationId: {
      type: String,
      required: true,
      unique: true
    },
    amount: Number,
    operationAmount: Number,
    currency: Number,
    description: String,
    time: Number,
    commissionRate: Number,
    cashbackAmount: Number,
    category: Number,
    comment: String,
    counterIban: String,
    sortDate: String,
    walletId: String
  }
)

ReceiptSchema.post('save', (error, doc, next) => {
  if (error.code === 11000) {
    next(new Error(`This operationId '${error.keyValue.operationId}' already exist`));
  } else {
    next();
  }
});

module.exports = mongoose.model('Receipt', ReceiptSchema);