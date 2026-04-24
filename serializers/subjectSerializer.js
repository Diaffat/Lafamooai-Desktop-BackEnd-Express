exports.serializeSubject = (subject) => {
  if (!subject) return null;

  return {
    ...subject,
    teacher: subject?.teacher ? {
      ...subject.teacher,
      id_teacher: subject.teacherId,
      full_name: subject.teacher?.full_name ?? `${subject.teacher?.first_name ?? ''} ${subject.teacher?.last_name ?? ''}`.trim() || null,
    } : null,
  };
};
