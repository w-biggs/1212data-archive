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

const forfeitGame = async function forfeitGame(gameId, winner) {
  if (!gameId || !winner) {
    throw new Error('Missing args.');
  }

  const game = await Game.findOne({ gameId }).exec();

  if (!game) {
    throw new Error(`Game ${gameId} not found.`);
  }

  const emptyStats = {
    fieldGoals: {
      attempts: 0,
      makes: 0,
    },
    score: {
      quarters: [0, 0, 0, 0],
      final: 0,
    },
    passYds: 0,
    rushYds: 0,
    interceptions: 0,
    fumbles: 0,
    timeOfPossession: 0,
    timeoutsRemaining: 3,
  };

  game.homeTeam.stats = emptyStats;
  game.awayTeam.stats = emptyStats;

  if (winner === 'home') {
    game.homeTeam.stats.score.quarters[0] = 1;
    game.homeTeam.stats.score.final = 1;
  } else if (winner === 'away') {
    game.awayTeam.stats.score.quarters[0] = 1;
    game.awayTeam.stats.score.final = 1;
  } else {
    throw new Error(`Invalid winner ${winner}.`);
  }

  await deleteMetricsGame(game._id, game.homeTeam.team);
  await deleteMetricsGame(game._id, game.awayTeam.team);

  return game.save();
};

mongoose.set('debug', true);

mongoose.connect('mongodb://127.0.0.1:27017/1212', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
})
  .catch(console.error)
  .then(() => forfeitGame(...args))
  .then(() => mongoose.disconnect())
  .catch(console.error);
