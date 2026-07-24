// frontend-admin/src/services/maintenanceApi.js
import api, { authHeaders } from './api';

export const maintenanceApi = {
  getSettings: (token) =>
    api.get("/api/maintenance/admin/settings", authHeaders(token)),

  toggleMaintenance: (payload, token) =>
    api.post("/api/maintenance/admin/toggle", payload, authHeaders(token)),
};
