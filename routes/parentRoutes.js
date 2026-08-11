// routes/parent.routes.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/parentController");

router.get("/", controller.getParents);
router.get("/:id", controller.getParentById);
router.patch("/:id", controller.updateParent);
router.delete("/:id", controller.deleteParent);

module.exports = router;