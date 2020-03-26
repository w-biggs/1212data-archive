const mongoose = require('mongoose');

const { Schema } = mongoose;

const gameSchema = new Schema({
  gameId: {
    type: String,
    required: [true, 'All games must have an associated Game ID.'],
    unique: true,
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
    coaches: [{
      coach: {
        type: Schema.Types.ObjectId,
        ref: 'Coach',
      },
      plays: Number,
    }],
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
    }, // Offensive playbook
    defense: {
      type: String,
      enum: ['3-4', '4-3', '5-2'],
    }, // Defensive playbook
    team: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'A team for awayTeam is required.'],
    },
    coaches: [{
      coach: {
        type: Schema.Types.ObjectId,
        ref: 'Coach',
      },
      plays: Number,
    }],
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
  status: {
    clock: {
      type: Number,
      min: 0,
      max: 420, // Not required because overtime
    },
    quarter: {
      type: Number,
      min: 1,
      required: () => (this.live),
    }, // Current quarter or overtime
    down: {
      type: Number,
      min: 1,
      max: 4,
      required: () => (this.live),
    }, // 1,2,3,4
    distance: {
      type: Number,
      min: 0,
      max: 100,
      required: () => (this.live),
    }, // distance to go
    yardLine: {
      type: Number,
      min: 0,
      max: 100,
      required: () => (this.live),
    }, // between 0 and 100. 98 = home team's 2 yard line
  },
});

module.exports = mongoose.model('Game', gameSchema);
