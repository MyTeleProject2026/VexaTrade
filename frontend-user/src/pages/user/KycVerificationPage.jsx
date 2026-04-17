import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  IdCard,
  Image as ImageIcon,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { getApiErrorMessage, userApi } from "../../services/api";

const COUNTRY_OPTIONS = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Cape Verde",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];

function getDocumentOptions(country) {
  const defaultOptions = [
    "National ID",
    "Passport",
    "Driving License",
    "Residence Permit",
  ];

  const customOptions = {
    Myanmar: ["NRC", "Passport", "Driving License"],
    Thailand: ["National ID Card", "Passport", "Driving License"],
    Singapore: ["National ID", "Passport", "Driving License"],
    Malaysia: ["National ID", "Passport", "Driving License"],
    Philippines: ["National ID", "Passport", "Driving License"],
    Indonesia: ["National ID", "Passport", "Driving License"],
    India: ["National ID", "Passport", "Driving License"],
    "United States": [
      "State ID",
      "Passport",
      "Driving License",
      "Residence Permit",
    ],
    "United Kingdom": [
      "National ID",
      "Passport",
      "Driving License",
      "Residence Permit",
    ],
  };

  return customOptions[country] || defaultOptions;
}

function UploadPreviewCard({
  title,
  optional = false,
  previewUrl,
  onChange,
  accept = "image/*",
  helperText,
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-slate-300">{title}</label>
        {optional ? (
          <span className="text-xs text-slate-500">Optional</span>
        ) : null}
      </div>

      <input
        type="file"
        accept={accept}
        onChange={onChange}
        className="block w-full text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-violet-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-violet-500"
      />

      {helperText ? (
        <p className="mt-3 text-xs text-slate-500">{helperText}</p>
      ) : null}

      <div className="mt-4 flex min-h-[220px] items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/10 bg-slate-900">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={title}
            className="h-full max-h-[320px] w-full rounded-2xl object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 px-4 text-center text-sm text-slate-500">
            <ImageIcon size={24} />
            <span>Image preview will appear here</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function KycVerificationPage() {
  const [form, setForm] = useState({
    country: "",
    documentType: "",
    documentNumber: "",
    frontFile: null,
    backFile: null,
  });

  const [preview, setPreview] = useState({
    front: "",
    back: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const token =
    localStorage.getItem("userToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const documentOptions = useMemo(() => {
    return getDocumentOptions(form.country);
  }, [form.country]);

  useEffect(() => {
    return () => {
      if (preview.front) URL.revokeObjectURL(preview.front);
      if (preview.back) URL.revokeObjectURL(preview.back);
    };
  }, [preview.front, preview.back]);

  function updateField(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleCountryChange(value) {
    setForm((prev) => ({
      ...prev,
      country: value,
      documentType: "",
    }));
  }

  function handleFileChange(key, file) {
    const previewKey = key === "frontFile" ? "front" : "back";

    setPreview((prev) => {
      if (prev[previewKey]) {
        URL.revokeObjectURL(prev[previewKey]);
      }

      return {
        ...prev,
        [previewKey]: file ? URL.createObjectURL(file) : "",
      };
    });

    updateField(key, file || null);
  }

  function validateForm() {
    if (!token) {
      return "Please log in again before submitting KYC";
    }

    if (!form.country) {
      return "Please select your country / region of residence";
    }

    if (!form.documentType) {
      return "Please select your government-issued document type";
    }

    if (!form.documentNumber.trim()) {
      return "Please enter your document number";
    }

    if (!form.frontFile) {
      return "Please upload the front side of your document";
    }

    if (form.frontFile && !form.frontFile.type.startsWith("image/")) {
      return "Front document must be an image file";
    }

    if (form.backFile && !form.backFile.type.startsWith("image/")) {
      return "Back document must be an image file";
    }

    return "";
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("country", form.country);
      formData.append("document_type", form.documentType);
      formData.append("document_number", form.documentNumber.trim());
      formData.append("front", form.frontFile);

      if (form.backFile) {
        formData.append("back", form.backFile);
      }

      await userApi.submitKyc(formData, token);

      setSuccess("Your KYC documents have been submitted successfully.");

      if (preview.front) URL.revokeObjectURL(preview.front);
      if (preview.back) URL.revokeObjectURL(preview.back);

      setForm({
        country: "",
        documentType: "",
        documentNumber: "",
        frontFile: null,
        backFile: null,
      });

      setPreview({
        front: "",
        back: "",
      });
    } catch (err) {
      setError(getApiErrorMessage(err) || "Failed to submit KYC");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <section className="rounded-3xl border border-white/10 bg-[#0a0e1a]/90 p-5 shadow-xl sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-slate-400">
              Account Verification
            </div>
            <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">
              Identity Verification
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Submit your government-issued document for account verification.
              Make sure your document is valid, clear, and fully visible.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200">
            <ShieldCheck size={18} />
            Secure KYC Submission
          </div>
        </div>
      </section>

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 rounded-3xl border border-white/10 bg-[#0a0e1a]/90 p-5 shadow-xl sm:p-6 md:p-8">
          <div className="flex items-center gap-3">
            <IdCard size={20} className="text-violet-300" />
            <h2 className="text-xl font-semibold text-white">
              Document Information
            </h2>
          </div>

          <p className="mt-2 text-sm text-slate-400">
            Please provide accurate document details that match your legal
            identity.
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Country / Region of Residence
              </label>
              <div className="relative">
                <Globe
                  size={16}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                />
                <select
                  value={form.country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 py-3 pl-11 pr-4 text-white outline-none focus:border-violet-500"
                >
                  <option value="">Select country / region</option>
                  {COUNTRY_OPTIONS.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Government-Issued Document Type
              </label>
              <select
                value={form.documentType}
                onChange={(e) => updateField("documentType", e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-violet-500"
              >
                <option value="">Select document type</option>
                {documentOptions.map((doc) => (
                  <option key={doc} value={doc}>
                    {doc}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Document Number
              </label>
              <input
                type="text"
                value={form.documentNumber}
                onChange={(e) => updateField("documentNumber", e.target.value)}
                placeholder="Enter document number"
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-center gap-3">
              <UploadCloud size={20} className="text-cyan-300" />
              <h3 className="text-lg font-semibold text-white">
                Upload Document Images
              </h3>
            </div>

            <p className="mt-2 text-sm text-slate-400">
              Please upload a clear, valid, government-issued document.
              Cropped, blurry, or expired documents may be rejected.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <UploadPreviewCard
                title="Front Side"
                previewUrl={preview.front}
                onChange={(e) =>
                  handleFileChange("frontFile", e.target.files?.[0] || null)
                }
                helperText="Upload a clear image of the front side of your document."
              />

              <UploadPreviewCard
                title="Back Side"
                optional
                previewUrl={preview.back}
                onChange={(e) =>
                  handleFileChange("backFile", e.target.files?.[0] || null)
                }
                helperText="Upload the back side if your document includes important information there."
              />
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          ) : null}

          {success ? (
            <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                <span>{success}</span>
              </div>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-violet-600 px-4 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Submitting..." : "Submit Verification"}
          </button>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/10 bg-[#0a0e1a]/90 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">
              Verification Tips
            </h3>

            <div className="mt-4 space-y-3 text-sm text-slate-400">
              <p>Use a valid government-issued document.</p>
              <p>Make sure all corners are visible.</p>
              <p>Use bright lighting and avoid blur.</p>
              <p>Do not upload cropped or edited images.</p>
              <p>Submitted details must match your registration identity.</p>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#0a0e1a]/90 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white">
              Accepted Documents
            </h3>

            <div className="mt-4 space-y-3 text-sm text-slate-400">
              <p>Passport</p>
              <p>National ID / State ID</p>
              <p>Driving License</p>
              <p>Residence Permit</p>
              <p>Country-specific IDs where applicable</p>
            </div>
          </div>

          <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-amber-200">
              Important Note
            </h3>

            <p className="mt-3 text-sm text-amber-100/80">
              Your submission will be reviewed by the CryptoPulse team. Approval
              time may depend on document quality and account details.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}