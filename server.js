const mongoose = require('mongoose');
const fs = require('fs');
const addGame = require('./tasks/addGame');

/* Connect to MongoDB */
mongoose.connect('mongodb://127.0.0.1:27017/1212', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

/* Check connection */
const db = mongoose.connection;

const writeDebug = function writeDebug(data) {
  fs.writeFile('debug.json', JSON.stringify(data, null, 2), console.log);
};

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected!');

  addGame('elsj30')
    .catch(err => console.error(err))
    .then(writeDebug);
});
