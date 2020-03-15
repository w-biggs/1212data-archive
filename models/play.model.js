const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const playSchema = new Schema({
  game: {
    type: Schema.Types.ObjectId,
    ref: 'Game',
  },
  homeOffense: Boolean, // Is the home team on offense?
  offense: {
    number: Number,
    coach: {
      type: Schema.Types.ObjectId,
      ref: 'Coach',
    },
  },
  defense: {
    number: Number,
    coach: {
      type: Schema.Types.ObjectId,
      ref: 'Coach',
    },
  },
  playType: String, // "Play.XXXX" in play list
  result: String, // Final "Result.XXXX" in play list
  down: Number, // 1,2,3,4
  distance: Number, // distance to go
  yardLine: Number, // between 0 and 100. 98 = home team's 2 yard line
  quarter: Number, // Current quarter or overtime
  clock: Number, // Current time left on the clock in seconds
  playLength: Number, // Time the play took
});

module.exports = mongoose.model('Play', playSchema);