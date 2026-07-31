const { buildImageUrl } = require("../utils/buildImageUtils");

exports.serializeAdmin = (admin) => ({
  ...admin,
  user: admin.user
      ? buildImageUrl(admin.user)
      : null,
  first_name: admin?.user?.first_name ?? null,
  last_name: admin?.user?.last_name ?? null,
  email: admin?.user?.email ?? null,
  tel: admin?.user?.tel ?? null,
  address: admin?.user?.address ?? null,
  gender: admin?.user?.gender ?? null,
  //img: user?.img ?? null,
  
});