const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const teamSchema = new Schema({
  name: String,
  shortName: String,
  abbreviation: String,
  color: String,
  division: {
    type: Schema.Types.ObjectId,
    ref: 'Division',
  }
});

module.exports = mongoose.model('Team', teamSchema);