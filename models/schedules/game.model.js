const mongoose = require('mongoose');

const { Schema } = mongoose;

const gameSchema = new Schema({
  gameId: {
    type: String,
    required: [true, 'All games must have an associated Game ID.'],
  }, // Reddit thread ID for game
  startTime: Number, // Starting timestamp
  endTime: Number, // Ending timestamp
  homeTeam: {
    offense: {
      type: String,
      enum: ['Option', 'Pro', 'Spread', 'Air Raid'],
    }, // Offensive playbook
    defense: {
      type: String,
      enum: ['3-4', '4-3', '5-2'],
    }, // Defensive playbook
    team: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'A team for homeTeam is required.'],
    },
    stats: {
      passYds: {
        type: Number,
        default: 0,
      },
      rushYds: {
        type: Number,
        default: 0,
      },
      interceptions: {
        type: Number,
        default: 0,
      },
      fumbles: {
        type: Number,
        default: 0,
      },
      fieldGoals: {
        attempts: {
          type: Number,
          default: 0,
        },
        makes: {
          type: Number,
          default: 0,
        },
      },
      timeOfPossession: {
        type: Number,
        default: 0,
      },
      timeoutsRemaining: {
        type: Number,
        default: 3,
      },
      score: {
        quarters: [{
          type: Number,
          default: 0,
        }],
        final: {
          type: Number,
          default: 0,
        },
      },
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
    stats: {
      passYds: {
        type: Number,
        default: 0,
      },
      rushYds: {
        type: Number,
        default: 0,
      },
      interceptions: {
        type: Number,
        default: 0,
      },
      fumbles: {
        type: Number,
        default: 0,
      },
      fieldGoals: {
        attempts: {
          type: Number,
          default: 0,
        },
        makes: {
          type: Number,
          default: 0,
        },
      },
      timeOfPossession: {
        type: Number,
        default: 0,
      },
      timeoutsRemaining: {
        type: Number,
        default: 3,
      },
      score: {
        quarters: [{
          type: Number,
          default: 0,
        }],
        final: {
          type: Number,
          default: 0,
        },
      },
    },
  },
  plays: [{
    type: Schema.Types.ObjectId,
    ref: 'Play',
  }],
  live: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model('Game', gameSchema);
