// Utility function to build full image URL
const buildImageUrl = (user) => {
  let BASE_URL = process.env.BASE_URL || "";
  BASE_URL = BASE_URL.trim().replace(/\/+$/, "");

  if (!user) return user;

  let img = user.img;

  if (!img) {
    return {
      ...user,
      img: `${BASE_URL}/media/users/avatar.png`,
    };
  }

  img = img.toString().trim();

  if (img.startsWith("http")) {
    return {
      ...user,
      img,
    };
  }

  return {
    ...user,
    img: `${BASE_URL}/media/${img.replace(/^\/+/, "")}`,
  };
};

const buildImagePath = (img) => {
  const BASE_URL = process.env.BASE_URL;
  if (!img) return `${BASE_URL}/media/users/avatar.png`;

  if (img.startsWith("http")) return img;

  return `${BASE_URL}/media/${img.replace(/^\/+/, "")}`;
};

module.exports = {
  buildImageUrl,
  buildImagePath,
};
