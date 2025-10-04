const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");

// Register (Signup)
router.post("/signup", async (req, res) => {
  try {
    const { usn, password, name, college } = req.body;
    const existing = await User.findOne({ usn });
    if (existing) return res.status(400).json({ msg: "USN already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ usn, password: hashed, name, college });
    await user.save();
    res.json({ msg: "Signup successful" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { usn, password } = req.body;
    const user = await User.findOne({ usn });
    if (!user) return res.status(400).json({ msg: "Invalid USN or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid USN or password" });

    res.json({ msg: "Login successful", usn: user.usn });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
