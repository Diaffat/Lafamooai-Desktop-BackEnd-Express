exports.serializeSubject = (subject) => {
  if (!subject) return null;

  return {
    ...subject,
    classe_name: subject.classe?.name,
    teacher: subject?.teacher ? {
      ...subject.teacher,
      id_teacher: subject.teacherId,
      full_name: subject.teacher?.full_name ??
        `${subject.teacher?.user?.first_name ?? ''} ${subject.teacher?.user?.last_name ?? ''}`.trim()
        ?? subject.teacher?.user?.username,
    } : null,
  };
};
