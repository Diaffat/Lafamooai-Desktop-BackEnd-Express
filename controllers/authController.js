const prisma = require("../prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sendVerificationCode } = require("../services/emailService");
const { verifyCode } = require("../services/verificationService");
const { createUserWithRole } = require("../services/authService");

const accessSECRET = process.env.ACCESS_SECRET;
const refreshSECRET = process.env.REFRESH_SECRET;
const BASE_URL = process.env.BASE_URL;

// Utility function to build full image URL
const buildImageUrl = (user) => {
  if (user && user.img && !user.img.startsWith("http")) {
    return {
      ...user,
      img: `${BASE_URL}/media/${user.img}`,
    };
  }
  return user;
};

// ================== LOGIN ==================
const login = async (req, res) => {
  const loginInput = (req.body.username || req.body.email || "")
    .toString()
    .trim();
  const { password } = req.body;

  try {
    if (!loginInput || !password) {
      return res
        .status(401)
        .json({
          error: "Veuillez saisir votre identifiant et votre mot de passe.",
        });
    }

    const user = await prisma.customUser.findFirst({
      where: {
        OR: [{ username: loginInput }, { email: loginInput }],
      },
    });

    if (!user) {
      return res
        .status(401)
        .json({ error: "Nom d'utilisateur/e-mail ou mot de passe incorrect." });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res
        .status(401)
        .json({ error: "Nom d'utilisateur/e-mail ou mot de passe incorrect." });
    }

    // Update last_login timestamp
    await prisma.customUser.update({
      where: { id: user.id },
      data: { last_login: new Date() },
    });

    const tokens = await generateTokens(user);

    let response = {
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      role: user.role,
      userId: user.id,
    };

    // 🔹 Ajouter ID selon rôle
    if (user.role === "teacher") {
      const teacher = await prisma.teacher.findFirst({
        where: { userId: user.id },
      });
      response.teacherId = teacher?.id;
    }

    if (user.role === "parent") {
      const parent = await prisma.parent.findFirst({
        where: { userId: user.id },
      });
      response.parentId = parent?.id;
    }

    if (user.role === "student") {
      const student = await prisma.student.findFirst({
        where: { accountId: user.id },
      });
      response.studentId = student?.id;
    }

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// ================== REQUEST VERIFICATION ==================
// simple email regex
const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};
const requestVerification = async (req, res) => {
  const { email } = req.body;

  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    await prisma.verificationCode.deleteMany({
      where: { email },
    });

    await prisma.verificationCode.create({
      data: {
        email,
        code,
      },
    });

    await sendVerificationCode(email, code);

    res.json({ message: "Code envoyé" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur lors de l'envoi du code" });
  }
};

// ================== CREATE AND SEND CODE (for signup) ==================
const createAndSendCode = async (req, res) => {
  const { email, code_type, role } = req.body;
  try {
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Email invalide" });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = await bcrypt.hash(code, 10);
    await prisma.verificationCode.upsert({
      where: { email },
      update: { code: hashedCode },
      create: { email, code: hashedCode },
    });

    // send email
    if (code_type === "signup") {
      const link = `${process.env.FRONTEND_URL}/signup?email=${encodeURIComponent(email)}&code=${hashedCode}&role=${role}`;
      await sendVerificationCode(email, link);
    }
    return res.status(200).json({ message: "Success" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

// ================== SIGNUP ==================
const signup = async (req, res) => {
  const { username, email, password, role, code } = req.body;

  try {
    const userRole = (role || "student").toString().toLowerCase().trim();

    await verifyCode(email, code);

    const existingUser = await prisma.customUser.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const user = await createUserWithRole({
      username,
      email,
      password,
      role: userRole,
    });

    const tokens = await generateTokens(user);

    res.status(201).json({
      message: "User registered successfully",
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      userId: user.id,
      role: user.role,
    });
  } catch (error) {
    if (error.message === "INVALID_CODE") {
      return res.status(400).json({ error: "Code invalide" });
    }

    if (error.message === "EXPIRED_CODE") {
      return res.status(400).json({ error: "Code expiré" });
    }

    console.error(error);
    res
      .status(500)
      .json({ error: "Server error", errorMessage: error.message });
  }
};

// ================== GENERATE TOKENS ==================
const generateTokens = async (user) => {
  const accessToken = jwt.sign(
    { userId: user.id, role: user.role },
    accessSECRET,
    { expiresIn: "24h" }, // Augmenté pour développement
  );

  const refreshToken = jwt.sign({ userId: user.id }, refreshSECRET, {
    expiresIn: "30d",
  });

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
    },
  });

  return { accessToken, refreshToken };
};

// ================== REFRESH ==================
const refresh = async (req, res) => {
  const { refreshToken } = req.body;

  try {
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!stored || stored.revoked) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const decoded = jwt.verify(refreshToken, refreshSECRET);

    const user = await prisma.customUser.findUnique({
      where: { id: decoded.userId },
    });

    await prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { revoked: true },
    });

    const tokens = await generateTokens(user);

    res.json(tokens);
  } catch (err) {
    res.status(401).json({ error: "Token expired" });
  }
};

// ================== LOGOUT ==================
const logout = async (req, res) => {
  // pour JWT, le logout côté serveur = rien à faire
  res.json({ message: "Logged out (JWT stateless)" });
};

// ================== PASSWORD RESET ==================
const resetPassword = async (req, res) => {
  const { email } = req.body;

  try {
    // Verify email exists
    const user = await prisma.customUser.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(400).json({
        error: "Aucun utilisateur avec cet email.",
      });
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = jwt.sign(
      { userId: user.id },
      process.env.RESET_PASSWORD_SECRET || "reset_secret",
      { expiresIn: "1h" },
    );

    // Store reset token in database
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    // TODO: Send reset email with link containing token
    // const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    // await sendPasswordResetEmail(email, resetLink);

    res.json({
      message: "Un email de réinitialisation a été envoyé.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Échec de l'envoi de l'email.",
    });
  }
};

// ================== RESET PASSWORD CONFIRM ==================
const resetPasswordConfirm = async (req, res) => {
  const { token, new_password } = req.body;

  try {
    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(
        token,
        process.env.RESET_PASSWORD_SECRET || "reset_secret",
      );
    } catch (error) {
      return res.status(400).json({
        error: "Lien invalide ou expiré.",
      });
    }

    // Check if reset token exists and not expired
    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
    });

    if (!resetRecord || resetRecord.expiresAt < new Date()) {
      return res.status(400).json({
        error: "Lien invalide ou expiré.",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update user password
    await prisma.customUser.update({
      where: { id: decoded.userId },
      data: { password: hashedPassword },
    });

    // Delete used reset token
    await prisma.passwordReset.delete({
      where: { token },
    });

    res.json({
      message: "Mot de passe réinitialisé avec succès.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erreur lors de la réinitialisation du mot de passe.",
    });
  }
};

// ================== CHANGE PASSWORD ==================
const changePassword = async (req, res) => {
  const userId = req.user?.id;
  const { new_password, confirm_password } = req.body;

  try {
    if (!userId) {
      return res.status(401).json({
        error: "Non authentifié",
      });
    }

    // Validate passwords match
    if (new_password !== confirm_password) {
      return res.status(400).json({
        error: "Les mots de passe ne correspondent pas.",
      });
    }

    // Validate password length
    if (new_password.length < 8) {
      return res.status(400).json({
        error: "Le mot de passe doit contenir au moins 8 caractères.",
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Update user password
    await prisma.customUser.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    res.json({
      message: "Success",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erreur lors du changement de mot de passe.",
    });
  }
};

// ================== GET ME (Current User) ==================
const getMe = async (req, res) => {
  try {
    // req.user is set by auth middleware
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await prisma.customUser.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(buildImageUrl(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  login,
  signup,
  requestVerification,
  createAndSendCode,
  refresh,
  logout,
  resetPassword,
  resetPasswordConfirm,
  changePassword,
  getMe,
};
