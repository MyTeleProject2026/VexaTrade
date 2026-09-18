// frontend-user/src/hooks/useMaintenance.js
import { useState, useEffect } from 'react';
import { maintenanceApi } from '../services/maintenanceApi';

export function useMaintenance() {
  const [maintenance, setMaintenance] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const checkMaintenance = async ({ force = false } = {}) => {
    try {
      const response = await maintenanceApi.getStatus({ force });
      if (response.success) {
        setMaintenance(response.data.maintenance);
        setMessage(response.data.message);
      }
    } catch (_) {
      // A status endpoint/network failure is not evidence that maintenance is enabled.
      // Keep the platform accessible and let the normal authenticated routes report
      // their own availability. Only an explicit maintenance=true response may block.
      setMaintenance(false);
      setMessage('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkMaintenance();
  }, []);

  return { maintenance, message, loading, checkMaintenance };
}
