const { buildImageUrl } = require("../utils/buildImageUtils");

exports.serializeParent = (parent) => {
  if (!parent) return null;

  return {
    ...parent,
    user: parent.user
      ? buildImageUrl(parent.user)
      : null,
    first_name: parent?.first_name ?? parent?.user?.first_name ?? null,
    last_name: parent?.last_name ?? parent?.user?.last_name ?? null,
    firstname: parent?.firstname ?? parent?.user?.first_name ?? null,
    lastname: parent?.lastname ?? parent?.user?.last_name ?? null,
    tel: parent?.tel ?? parent?.user?.tel ?? null,
    email: parent?.email ?? parent?.user?.email ?? null,
    address: parent?.address ?? parent?.user?.address ?? null,
    gender: parent?.gender ?? parent?.user?.gender ?? null,
  };
};
