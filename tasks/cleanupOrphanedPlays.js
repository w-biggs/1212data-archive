const mongoose = require('mongoose');
const Game = require('../models/schedules/game.model');
const Play = require('../models/play.model');

const cleanupOrphanedPlays = async function cleanupOrphanedPlays() {
  const gameIds = await Game.find().distinct('_id').exec();
  const deletion = await Play.deleteMany({ game: { $not: { $in: gameIds } } }).exec();
  console.log(`Deleted ${deletion.deletedCount} plays.`);
};

mongoose.connect('mongodb://127.0.0.1:27017/1212', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
})
  .catch(console.error)
  .then(() => cleanupOrphanedPlays())
  .then(() => mongoose.disconnect())
  .catch(console.error);
