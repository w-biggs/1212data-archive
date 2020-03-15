const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const playSchema = new Schema({
  game: {
    type: Schema.Types.ObjectId,
    ref: 'Game',
    required: [true, 'All plays must be associated with a game.'],
  },
  homeOffense: {
    type: Boolean,
    required: true,
  }, // Is the home team on offense?
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
  playType: {
    type: String,
    required: true,
    enum: ['KNEEL', 'SPIKE', 'PAT', 'TWO_POINT', 'PUNT', 
      'RUN', 'PASS', 'FIELD_GOAL'],
  }, // "Play.XXXX" in play list
  result: {
    type: String,
    required: true,
    enum: ['GAIN', 'KICK', 'TOUCHDOWN', 'TOUCHBACK', 
      'SAFETY', 'INCOMPLETE', 'TURNOVER', 'KNEEL', 'SPIKE',
      'TWO_POINT', 'PAT', 'KICKOFF', 'TURNOVER_PAT',
      'TURNOVER_TOUCHDOWN', 'FIELD_GOAL', 'MISS'],
  }, // Final "Result.XXXX" in play list
  down: {
    type: Number,
    min: 1,
    max: 4,
    required: true,
  }, // 1,2,3,4
  distance: {
    type: Number,
    min: 0,
    max: 100,
    required: true,
  }, // distance to go
  yardLine: {
    type: Number,
    min: 0,
    max: 100,
    required: true,
  }, // between 0 and 100. 98 = home team's 2 yard line
  quarter: {
    type: Number,
    min: 1,
    required: true,
  }, // Current quarter or overtime
  clock: {
    type: Number,
    min: 0,
    max: 420,
    required: true,
  }, // Current time left on the clock in seconds
  playLength: {
    type: Number,
    min: 0,
    max: 420,
    required: true,
  }, // Time the play took
});

module.exports = mongoose.model('Play', playSchema);