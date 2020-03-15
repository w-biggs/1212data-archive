const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const seasonSchema = new Schema({
  seasonNo: Number,
  weeks: [{
    type: Schema.Types.ObjectId,
    ref: 'Week',
  }],
});

module.exports = mongoose.model('Season', seasonSchema);