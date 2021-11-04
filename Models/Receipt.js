const mongoose = require('mongoose');

const ReceiptSchema = new mongoose.Schema(
  {
    amount: Number,
    operationAmount: Number,
    currency: Number,
    description: String,
    time: Number,
    commissionRate: Number,
    cashbackAmount: Number,
    category: Number,
    comment: String,
    counterIban: String
  }
)

module.exports = mongoose.model('Receipt', ReceiptSchema);