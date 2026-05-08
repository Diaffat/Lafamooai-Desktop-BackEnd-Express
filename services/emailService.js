const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendVerificationCode = async (email, code) => {
  try {
    await transporter.sendMail({
      from: `"LaFamooai App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Code de vérification",
      html: `
        <p>Votre code de vérification est:</p>
        <h2>${code}</h2>
        <p>Il expire dans 24h.</p>
      `,
    });
  } catch (error) {
    console.error("Email error:", error);
    throw new Error("EMAIL_FAILED");
  }
};

const sendAccountsEmail = async (email, accounts) => {

  // Construire le message
  let message = `Informations de connexion:\n\n`;

  message += `Parent:\n`;
  message += `Username: ${accounts.parent.username}\n`;
  message += `Password: ${accounts.parent.password}\n\n`;

  accounts.students.forEach((s, i) => {
    if (s.credentials) {
      message += `Élève ${i + 1}:\n`;
      message += `Username: ${s.credentials.username}\n`;
      message += `Password: ${s.credentials.password}\n\n`;
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Vos accès Lafamooai",
    text: message,
  });
};

const sendEmail = ({to, subject, text}) => {
  return transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  });
};
module.exports = { sendVerificationCode, sendAccountsEmail, sendEmail };