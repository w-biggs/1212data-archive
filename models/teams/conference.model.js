const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const conferenceSchema = new Schema({
  name: String,
  shortName: String,
  level: {
    type: Schema.Types.ObjectId,
    ref: 'Level',
  },
  divisions: [{
    type: Schema.Types.ObjectId,
    ref: 'Division',
  }]
});

module.exports = mongoose.model('Conference', conferenceSchema);