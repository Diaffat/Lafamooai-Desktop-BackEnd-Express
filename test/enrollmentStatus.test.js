const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isInscribedStatus,
  buildEnrollmentStatusFilter,
} = require("../utils/enrollmentStatus");

test("inscribed statuses include Submitted and Accepted", () => {
  assert.equal(isInscribedStatus("Submitted"), true);
  assert.equal(isInscribedStatus("Accepted"), true);
  assert.equal(isInscribedStatus("Pending"), false);
});

test("buildEnrollmentStatusFilter returns the same inscrit filter as the list endpoint", () => {
  assert.deepEqual(buildEnrollmentStatusFilter("inscrit"), {
    status: { in: ["Accepted", "Submitted"] },
  });
});
