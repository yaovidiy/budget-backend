const mongoose = require('mongoose');

const ReceiptSchema = new mongoose.Schema(
  {
    amount: Number,
    currency: String,
    description: String,
    time: Number,
    commissionRate: Number,
    cashbackAmount: Number,
    comment: String,
    counterIban: String
  }
)

module.exports = mongoose.model('Receipt', ReceiptSchema);