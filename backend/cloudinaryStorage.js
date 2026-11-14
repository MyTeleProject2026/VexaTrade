// backend/cloudinaryStorage.js
//
// Cloudinary-backed Multer storage implemented directly with the Cloudinary SDK.
// This intentionally avoids a hard runtime dependency on multer-storage-cloudinary:
// the backend must still boot when Render's dependency cache is incomplete, while
// uploads continue to use Cloudinary when configured.
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function getFolder(fieldname) {
  if (fieldname === "receipt") return "uploads/deposits";
  if (fieldname === "qr") return "uploads/qrcodes";
  if (fieldname === "front" || fieldname === "back") return "uploads/kyc";
  if (fieldname === "profile_picture") return "uploads/profiles";
  if (fieldname === "legal_file") return "uploads/legal";
  if (fieldname === "user_qr") return "uploads/qr_codes";
  return "uploads/misc";
}

function getFormat(originalname) {
  const ext = String(originalname || "").split(".").pop().toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp"].includes(ext) ? ext : "png";
}

function getPublicId(originalname) {
  const base = String(originalname || "upload")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "upload";
  return `${Date.now()}-${base}`;
}

function createUploadStream(req, file, callback) {
  const folder = getFolder(file.fieldname);
  const format = getFormat(file.originalname);
  const publicId = getPublicId(file.originalname);

  const uploadOptions = {
    folder,
    public_id: publicId,
    format,
    resource_type: String(file.mimetype || "").toLowerCase() === "application/pdf" ? "raw" : "image",
  };

  const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
    if (error) return callback(error);
    if (!result?.secure_url) {
      return callback(new Error("Cloudinary upload completed without a usable URL"));
    }

    callback(null, {
      path: result.secure_url,
      secure_url: result.secure_url,
      url: result.url || result.secure_url,
      filename: result.public_id || publicId,
      public_id: result.public_id || publicId,
      format: result.format || format,
      size: result.bytes,
      resource_type: result.resource_type || "image",
    });
  });

  file.stream.pipe(stream);
}

const storage = {
  _handleFile(req, file, callback) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return callback(new Error("Cloudinary upload is not configured on the server"));
    }

    createUploadStream(req, file, callback);
  },

  async _removeFile(req, file, callback) {
    const publicId = file?.public_id || file?.filename;
    if (!publicId) return callback();

    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: file.resource_type || "image" });
      callback();
    } catch (error) {
      callback(error);
    }
  },
};

module.exports = storage;
