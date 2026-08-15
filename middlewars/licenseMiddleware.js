const { PrismaClient } = require("@prisma/client");
const { getMachineId } = require("../utils/machineId");

const prisma = new PrismaClient();

const licenseMiddleware = async (req, res, next) => {
  try {

    const key =
      req.headers["x-license-key"] ||
      req.get("x-license-key");

    const machineId = getMachineId();

    if (!key || !machineId) {
      return res.status(403).json({
        error: "Licence requise",
      });
    }

    const license = await prisma.license.findUnique({
      where: { key },
    });

    if (!license) {
      return res.status(403).json({
        error: "Licence introuvable",
      });
    }

    if (!license.isActive) {
      return res.status(403).json({
        error: "Cette licence est désactivée",
      });
    }

    if (
      license.expiresAt &&
      new Date() > new Date(license.expiresAt)
    ) {
      return res.status(403).json({
        error: "Cette licence a expiré",
      });
    }

    if (
      license.machineId &&
      license.machineId !== machineId
    ) {
      return res.status(403).json({
        error: "Cette licence est utilisée sur une autre machine",
      });
    }

    req.license = license;

    next();
  } catch (error) {
    console.error("LICENSE MIDDLEWARE ERROR:", error);

    return res.status(500).json({
      error: "Erreur lors de la vérification de la licence",
    });
  }
};

module.exports = licenseMiddleware;