const mongoose = require('mongoose');

const { Schema } = mongoose;

const seasonSchema = new Schema({
  seasonNo: {
    type: Number,
    required: [true, 'All seasons must have a season number.'],
  },
  weeks: [{
    type: Schema.Types.ObjectId,
    ref: 'Week',
  }],
});

module.exports = mongoose.model('Season', seasonSchema);
