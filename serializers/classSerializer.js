exports.serializeClass = (classe) => {
  if (!classe) return null;

  return {
    id_class: classe.id_class,
    name: classe.name,
    capacity: classe.capacity,
    annee_academique: classe.annee_academique,

    students: classe.students ?? [],

    subjects: classe.subjects?.map((subject) => {
      const fullName = `${subject.teacher?.user?.first_name ?? ''} ${subject.teacher?.user?.last_name ?? ''}`.trim();

      return {
        id_subject: subject.id_subject,
        name: subject.name,
        description: subject.description,

        teacher: subject.teacher
          ? {
              id_teacher: subject.teacher.id_teacher,
              full_name: fullName || null,
            }
          : null,
      };
    }) ?? [],

    effective: classe.students?.length || 0,
  };
};