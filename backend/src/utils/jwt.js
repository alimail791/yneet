const jwt = require("jsonwebtoken");
const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
const sendTokens = (user, res) => {
  const token = signToken(user.id);
  const { password, verifyToken, resetToken, resetTokenExp, ...safe } = user;
  res.json({ success: true, token, user: safe });
};
module.exports = { signToken, sendTokens };
