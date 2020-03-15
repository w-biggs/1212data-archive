const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const coachSchema = new Schema({
  username: {
    type: String,
    required: [true, 'All coaches must have an associated Reddit username.']
  }, // Reddit username
});

module.exports = mongoose.model('Coach', coachSchema);