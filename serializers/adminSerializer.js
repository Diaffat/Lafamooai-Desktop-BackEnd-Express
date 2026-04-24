exports.serializeAdmin = (admin) => ({
  ...admin,
  first_name: admin?.user?.first_name ?? null,
  last_name: admin?.user?.last_name ?? null,
  email: admin?.user?.email ?? null,
  tel: admin?.user?.tel ?? null,
  address: admin?.user?.address ?? null,
  gender: admin?.user?.gender ?? null,
  img: admin?.user?.img ?? null,
});