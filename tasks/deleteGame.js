const mongoose = require('mongoose');
const Game = require('../models/schedules/game.model');
const TeamMetrics = require('../models/teamMetrics.model');

const args = process.argv.slice(2);

const deleteMetricsGame = async function deleteMetricsGame(gameRef, teamRef) {
  const metrics = await TeamMetrics.findOne({ team: teamRef }).exec();

  for (let i = 0; i < metrics.seasons.length; i += 1) {
    const season = metrics.seasons[i];
    for (let j = 0; j < season.weeks.length; j += 1) {
      const week = season.weeks[j];
      if (week.game && week.game.equals(gameRef)) {
        metrics.seasons[i].weeks.splice(j, 1);
        return metrics.save();
      }
    }
  }

  return false;
};

const deleteGame = async function deleteGame(gameId) {
  if (!gameId) {
    throw new Error('Missing args.');
  }

  const game = await Game.findOne({ gameId }).exec();

  if (!game) {
    throw new Error(`Game ${gameId} not found.`);
  }

  await deleteMetricsGame(game._id, game.homeTeam.team);
  await deleteMetricsGame(game._id, game.awayTeam.team);

  return Game.deleteOne({ gameId }).exec();
};

mongoose.set('debug', true);

mongoose.connect('mongodb://127.0.0.1:27017/1212', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
})
  .catch(console.error)
  .then(() => deleteGame(...args))
  .then(() => mongoose.disconnect())
  .catch(console.error);
