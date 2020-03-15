const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const gameSchema = new Schema({
  gameId: String, // Reddit thread ID for game
  gameLength: Number, // In-game length of game (in seconds)
  startTime_utc: Number, // Starting timestamp in UTC
  endTime_utc: Number, // Ending timestamp in UTC
  homeTeam: {
    offense: String, // Offensive playbook
    defense: String, // Defensive playbook
    team: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
    },
  },
  awayTeam: {
    offense: String, // Offensive playbook
    defense: String, // Defensive playbook
    team: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
    },
  },
  plays: [{
    type: Schema.Types.ObjectId,
    ref: 'Play',
  }],
});

module.exports = mongoose.model('Game', gameSchema);