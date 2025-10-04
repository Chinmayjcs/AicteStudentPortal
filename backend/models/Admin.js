const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  name: { type: String, required: true },
  adminId: { type: String, required: true, unique: true },
  passhash: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("Admin", adminSchema);
