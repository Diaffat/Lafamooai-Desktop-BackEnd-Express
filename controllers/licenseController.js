const { PrismaClient } = require("@prisma/client");
const { getMachineId } = require("../utils/machineId");
const prisma = new PrismaClient();


// ===============================
// Créer une licence
// ===============================
exports.createLicense = async (req, res) => {
  try {
    const {
      key,
      clientName,
      expiresAt,
    } = req.body;

    if (!key) {
      return res.status(400).json({
        error: "La clé de licence est obligatoire",
      });
    }

    const existingLicense = await prisma.license.findUnique({
      where: { key },
    });

    if (existingLicense) {
      return res.status(409).json({
        error: "Cette licence existe déjà",
      });
    }

    const license = await prisma.license.create({
      data: {
        key,
        clientName: clientName || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    return res.status(201).json(license);

  } catch (error) {
    console.error("CREATE LICENSE ERROR:", error);

    return res.status(500).json({
      error: "Erreur serveur",
    });
  }
};


// ===============================
// Activer une licence
// ===============================
exports.activateLicense = async (req, res) => {
  try {
    const {key } = req.body || {};
    const machineId = getMachineId();

    if (!key || !machineId) {
      return res.status(400).json({
        error: "La clé de licence est obligatoire",
      });
    }

    const license = await prisma.license.findUnique({
      where: { key },
    });

    if (!license) {
      return res.status(404).json({
        error: "Licence introuvable",
      });
    }

    if (!license.isActive) {
      return res.status(403).json({
        error: "Cette licence est désactivée",
      });
    }

    // Vérifier l'expiration
    if (
      license.expiresAt &&
      new Date() > new Date(license.expiresAt)
    ) {
      return res.status(403).json({
        error: "Cette licence a expiré",
      });
    }

    // Licence déjà utilisée
    if (
      license.machineId &&
      license.machineId !== machineId
    ) {
      return res.status(403).json({
        error: "Cette licence est déjà activée sur une autre machine",
      });
    }

    // Première activation
    const activatedLicense = await prisma.license.update({
      where: { id: license.id },
      data: {
        machineId,
      },
    });

    return res.json({
      success: true,
      message: "Licence activée avec succès",
      license: activatedLicense,
    });

  } catch (error) {
    console.error("ACTIVATE LICENSE ERROR:", error);

    return res.status(500).json({
      error: "Erreur serveur",
    });
  }
};

// ===============================
// Vérifier une licence
// ===============================
exports.verifyLicense = async (req, res) => {
  try {
    const { key} = req.body || {};
    const machineId = getMachineId();

    if (!key || !machineId) {
      return res.status(400).json({
        error: "La clé de licence est obligatoire",
      });
    }

    const license = await prisma.license.findUnique({
      where: { key },
    });

    if (!license) {
      return res.status(404).json({
        valid: false,
        error: "Licence introuvable",
      });
    }

    if (!license.isActive) {
      return res.status(403).json({
        valid: false,
        error: "Cette licence est désactivée",
      });
    }

    // Vérifier l'expiration
    if (
      license.expiresAt &&
      new Date() > new Date(license.expiresAt)
    ) {
      return res.status(403).json({
        valid: false,
        error: "Cette licence a expiré",
      });
    }

    // Vérifier la machine
    if (!license.machineId) {
      return res.status(403).json({
        valid: false,
        error: "Cette licence n'est pas encore activée",
      });
    }

    if (license.machineId !== machineId) {
      return res.status(403).json({
        valid: false,
        error: "Cette licence est utilisée sur une autre machine",
      });
    }

    return res.json({
      valid: true,
      message: "Licence valide",
      license: {
        id: license.id,
        clientName: license.clientName,
        expiresAt: license.expiresAt,
        machineId: license.machineId,
        isActive: license.isActive,
      },
    });

  } catch (error) {
    console.error("VERIFY LICENSE ERROR:", error);

    return res.status(500).json({
      valid: false,
      error: "Erreur serveur",
    });
  }
};