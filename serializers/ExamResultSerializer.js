const { serializeStudent } = require("./studentSerializer");

const ExamResultSerializer = (examResult) => {
  if (!examResult) return null;

  return {
    id_exam_result: examResult.id_exam_result,
    studentId: examResult.studentId,
    examId: examResult.examId,
    total_marks: examResult.total_marks,
    average: examResult.average,
    percentage: examResult.percentage,
    rank: examResult.rank,
    mention: examResult.mention,
    grade: examResult.grade,
    decision: examResult.decision,
    createdAt: examResult.createdAt,
    updatedAt: examResult.updatedAt,
    note: examResult.note,

    student: examResult.student
      ? serializeStudent(examResult.student)
      : null,

    exam: examResult.exam,
  };
};

module.exports = ExamResultSerializer;