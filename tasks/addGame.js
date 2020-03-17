/**
 * Add a game to the database
 */
const fetchGameInfo = require('./fetchGameInfo');

const addGame = function addGameToDatabase(gameId) {
  return new Promise((resolve, reject) => {
    console.log(`Adding game ${gameId}`);
  
    fetchGameInfo(gameId)
      .catch(reject)
      .then(resolve);
  });
};

module.exports = addGame;
