const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const coachSchema = new Schema({
  username: String, // Reddit username
});

module.exports = mongoose.model('Coach', coachSchema);