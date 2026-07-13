const { buildImageUrl } = require("../utils/buildImageUtils");

exports.serializeTeacher = (teacher) => {
  if (!teacher) return null;

  return {
    ...teacher,

    user: teacher.user
      ? buildImageUrl(teacher.user)
      : null,

    first_name: teacher?.first_name ?? teacher?.user?.first_name ?? null,
    last_name: teacher?.last_name ?? teacher?.user?.last_name ?? null,
    firstname: teacher?.firstname ?? teacher?.user?.first_name ?? null,
    lastname: teacher?.lastname ?? teacher?.user?.last_name ?? null,
    email: teacher?.email ?? teacher?.user?.email ?? null,
    tel: teacher?.tel ?? teacher?.user?.tel ?? null,
    address: teacher?.address ?? teacher?.user?.address ?? null,
    gender: teacher?.gender ?? teacher?.user?.gender ?? null,
  };
};