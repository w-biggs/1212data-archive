const mongoose = require('mongoose');
const {handleTeams} = require('./handleHardData');

/* Connect to MongoDB */
mongoose.connect('mongodb://127.0.0.1:27017/1212', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

/* Check connection */
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected!');

  /* handleTeams(db)
    .catch((err) => {
      console.error(err);
    })
    .then((response) => {
      console.log(response);
    }); */
});