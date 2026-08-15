const { machineIdSync } = require("node-machine-id");

let cachedMachineId = null;

function getMachineId() {
  if (cachedMachineId) {
    return cachedMachineId;
  }

  cachedMachineId = machineIdSync({
    original: false,
  });

  return cachedMachineId;
}

module.exports = {
  getMachineId,
};