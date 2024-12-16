const mongoose = require("mongoose");

const voteSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  pollId: mongoose.Schema.Types.ObjectId,
  option: String,
});

module.exports = mongoose.model("Vote", voteSchema);
