const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema({
  wallet_id: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  balance: {
    type: Number,
    required: true
  },
  creditLimit: {
    type: Number
  }
},
{
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

WalletSchema.post('save', (error, doc, next) => {
  if (error.code === 11000) {
    next(new Error(`This wallet_id '${error.keyValue.wallet_id}' already exist`));
  } else {
    next();
  }
});

module.exports = mongoose.model('Wallet', WalletSchema);