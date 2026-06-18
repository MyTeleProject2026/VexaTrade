// cloudinaryStorage.js
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: (req, file) => {
      // Dynamic folder based on fieldname (same as your original logic)
      if (file.fieldname === "receipt") return "uploads/deposits";
      if (file.fieldname === "qr" || file.fieldname === "user_qr") return "uploads/qr_codes";
      if (file.fieldname === "front" || file.fieldname === "back") return "uploads/kyc";
      if (file.fieldname === "profile_picture") return "uploads/profiles";
      if (file.fieldname === "legal_file") return "uploads/legal";
      return "uploads/misc";
    },
    format: async (req, file) => "png", // or dynamic based on mimetype
    public_id: (req, file) => {
      const name = file.originalname.split(".")[0].replace(/\s+/g, "-");
      return `${Date.now()}-${name}`;
    },
  },
});

module.exports = storage;
