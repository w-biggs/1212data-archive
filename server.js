const mongoose = require('mongoose');
const fs = require('fs');
const addOldGames = require('./old_data/oldGames');
const checkModifiedGames = require('./old_data/checkModifiedGames');
// const fetchGameInfo = require('./tasks/fetchGameInfo');
// const { addGame } = require('./tasks/addGame');

/* Connect to MongoDB */
mongoose.connect('mongodb://127.0.0.1:27017/1212', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
});

/* Check connection */
const db = mongoose.connection;

const writeDebug = function writeDebug(data) {
  fs.writeFile('debug.json', JSON.stringify(data, null, 2), (err) => {
    if (err) {
      console.error(err);
    } else {
      console.log('Successfully wrote debug.json.');
    }
  });
};

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected!');

  addOldGames()
    .catch(console.error)
    .then((oldGames) => {
      writeDebug(oldGames);
      checkModifiedGames()
        .catch(console.error)
        .then(console.log);
    });
  
  
  /* fetchGameInfo('9y7gtc')
    .catch((error) => {
      console.error(`Error in game ${'9y7gtc'}.`);
      console.error(error);
      process.exit();
    })
    .then((gameInfo) => {
      console.log(`Adding game ${'9y7gtc'}.`);
      return addGame(gameInfo, 1, 0);
    }); */
});
