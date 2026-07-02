const INSCRIBED_STATUSES = ["Accepted", "Submitted"];

const isInscribedStatus = (status) => INSCRIBED_STATUSES.includes(status);

const buildEnrollmentStatusFilter = (statusParam) => {
  if (statusParam === "demande") {
    return { status: { not: "Accepted" } };
  }

  if (statusParam === "inscrit") {
    return { status: { in: INSCRIBED_STATUSES } };
  }

  return {};
};

module.exports = {
  INSCRIBED_STATUSES,
  isInscribedStatus,
  buildEnrollmentStatusFilter,
};
