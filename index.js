require('dotenv').config();

const mongoose = require('mongoose');
const express = require('express');
const MonoController = require('./Controllers/MonoBank');
const app = express();
const port = process.env.PORT || 3000;
const cors = require('cors');

mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log('Data base connected'))
  .catch(err => console.log(err));

app.use(cors());
app.use(express.json());

app.get('/user', MonoController.getUserInfo);
app.get('/currency', MonoController.getCurrency);
app.get('/receipt', MonoController.getReceipt);
app.get('/updateDB', MonoController.updateDataBase);

app.listen(port, () => {
  console.log(`app is running on ${port}`);
});