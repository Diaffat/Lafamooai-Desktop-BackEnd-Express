const {
  buildImageUrl,
  buildImagePath
} = require("../utils/buildImageUtils");


exports.serializeStudent = (student) => ({
  ...student,

  account: student?.account
    ? buildImageUrl(student.account)
    : null,

  // =========================
  // IDENTITE ETUDIANT
  // =========================

  first_name: student?.first_name ?? student?.firstname ?? null,

  last_name: student?.last_name ?? student?.lastname ?? null,

  firstname: student?.firstname ?? student?.first_name ?? null,

  lastname: student?.lastname ?? student?.last_name ?? null,


  // =========================
  // PARENT
  // =========================

  parent: student?.parent
    ? {
        ...student.parent,

        first_name:
          student.parent?.first_name ??
          student.parent?.user?.first_name ??
          student.parent?.user?.username ??
          student.parent?.username ??
          null,

        last_name:
          student.parent?.last_name ??
          student.parent?.user?.last_name ??
          student.parent?.user?.username ??
          null,

        firstname:
          student.parent?.firstname ??
          student.parent?.user?.first_name ??
          student.parent?.user?.username ??
          null,

        lastname:
          student.parent?.lastname ??
          student.parent?.user?.last_name ??
          student.parent?.user?.username ??
          null,

        tel:
          student.parent?.tel ??
          student.parent?.user?.tel ??
          null,

        img: buildImagePath(
          student.parent?.img ??
          student.parent?.user?.img
        ),
      }
    : null,


  // =========================
  // CLASSE
  // =========================

  classeId:
    student?.classeId ??
    student?.classe?.id_class ??
    null,

  classe_name:
    student?.classe?.name ??
    null,


  // =========================
  // NIVEAU
  // =========================

  grade_id:
    student?.classe?.grade?.id_grade ??
    null,

  grade_level:
    student?.classe?.grade?.level ??
    null,

  grade_name:
    student?.classe?.grade
      ? `Niveau ${student.classe.grade.level}`
      : null,


  // =========================
  // MATIERES
  // =========================

  subjects:
    student?.classe?.subjects ?? [],

  subjects_count:
    student?.classe?.subjects?.length ?? 0,
});