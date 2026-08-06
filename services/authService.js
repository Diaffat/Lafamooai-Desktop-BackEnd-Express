const prisma = require("../prisma");
const bcrypt = require("bcrypt")
;
const generateCNI = () => {
  return `CNI-${bcrypt.hashSync(Math.random().toString(), 10).slice(-6)}`;
};
const ensureRoleRecord = async (userId, role, db) => {
  if (role === "parent") {
    const exists = await db.parent.findFirst({ where: { userId } });
    if (!exists) {
      await db.parent.create({ data: { userId } });
    }
  } else if (role === "teacher") {
    const exists = await db.teacher.findFirst({ where: { userId } });
    if (!exists) {
      await db.teacher.create({ data: { userId } });
    }
  } else if (role === "admin") {
    const exists = await db.admin.findFirst({ where: { userId } });
    if (!exists) {
      await db.admin.create({ data: { userId } });
    }
  }
};

const createUserWithRole = async ({
  username,
  email,
  password,
  role,
  first_name,
  last_name,
  tel,
  address,
  gender,
  prismaClient = prisma,
}) => {
  const hashedPassword = await bcrypt.hash(password, 10);

  // 🔍 Check existing user
  if (email) {
    const existingUser = await prismaClient.customUser.findUnique({
      where: { email },
    });

    if (existingUser) {
      if (role && existingUser.role !== role) {
        throw new Error(
          `User with email already exists with role ${existingUser.role}`
        );
      }

      const updateData = {};
      if (tel !== undefined) updateData.tel = tel;
      if (address !== undefined) updateData.address = address;
      if (gender !== undefined) updateData.gender = gender;
      if (first_name !== undefined) updateData.first_name = first_name;
      if (last_name !== undefined) updateData.last_name = last_name;

      if (Object.keys(updateData).length > 0) {
        await prismaClient.customUser.update({
          where: { id: existingUser.id },
          data: updateData,
        });
      }

      if (role !== "student") {
        await ensureRoleRecord(existingUser.id, role, prismaClient);
      }

      return existingUser;
    }
  }

  // 🆕 Create new user
  const user = await prismaClient.customUser.create({
    data: {
      username,
      email,
      password: hashedPassword,
      role,
      first_name,
      last_name,
      tel,
      address,
      gender,
    },
  });

  await ensureRoleRecord(user.id, role, prismaClient);

  return user;
};

module.exports = { createUserWithRole, generateCNI };