const mongoose = require('mongoose');

const BudgetSchema = new mongoose.Schema({
  category: String,
  categoryId: Number,
  amount: Number,
  month: Number
});

module.exports = mongoose.model('Budget', BudgetSchema);