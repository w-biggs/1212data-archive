const mongoose = require('mongoose');

const { Schema } = mongoose;

const teamMetricsSchema = new Schema({
  team: {
    type: Schema.Types.ObjectId,
    ref: 'Team',
    required: true,
  },
  seasons: [{
    season: {
      type: Schema.Types.ObjectId,
      ref: 'Season',
      required: true,
    },
    weeks: [{
      preseason: {
        type: Boolean,
        default: false,
      },
      week: {
        type: Schema.Types.ObjectId,
        ref: 'Week',
      },
      game: {
        type: Schema.Types.ObjectId,
        ref: 'Game',
      },
      elo: {
        oppElo: Number,
        oldElo: Number,
        elo: Number,
      },
    }],
    wPN: Number,
  }],
});

module.exports = mongoose.model('TeamMetrics', teamMetricsSchema);
