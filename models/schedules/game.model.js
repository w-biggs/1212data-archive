const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const gameSchema = new Schema({
  gameId: {
    type: String,
    required: [true, 'All games must have an associated Game ID.']
  }, // Reddit thread ID for game
  gameLength: Number, // In-game length of game (in seconds)
  startTime_utc: Number, // Starting timestamp in UTC
  endTime_utc: Number, // Ending timestamp in UTC
  homeTeam: {
    offense: {
      type: String,
      enum: ['Option', 'Pro', 'Spread', 'Air Raid'],
      required: [true, 'All teams must have an offensive playbook.'],
    }, // Offensive playbook
    defense: {
      type: String,
      enum: ['3-4', '4-3', '5-2'],
      required: [true, 'All teams must have a defensive playbook.'],
    }, // Defensive playbook
    team: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'A team for homeTeam is required.'],
    },
  },
  awayTeam: {
    offense: {
      type: String,
      enum: ['Option', 'Pro', 'Spread', 'Air Raid'],
      required: [true, 'All teams must have an offensive playbook.'],
    }, // Offensive playbook
    defense: {
      type: String,
      enum: ['3-4', '4-3', '5-2'],
      required: [true, 'All teams must have a defensive playbook.'],
    }, // Defensive playbook
    team: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'A team for awayTeam is required.'],
    },
  },
  plays: [{
    type: Schema.Types.ObjectId,
    ref: 'Play',
  }],
});

module.exports = mongoose.model('Game', gameSchema);