// frontend-user/src/services/maintenanceApi.js
import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://vexatrade-server.onrender.com";

export const maintenanceApi = {
  getStatus: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/maintenance/status`);
      return response.data;
    } catch (error) {
      // If API fails, assume maintenance mode (fail-safe)
      return {
        success: true,
        data: {
          maintenance: true,
          message: "VexaTrade is currently undergoing maintenance. Please check back later.",
          auto_triggered: true
        }
      };
    }
  }
};
