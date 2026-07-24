// frontend-user/src/hooks/useMaintenance.js
import { useState, useEffect } from 'react';
import { maintenanceApi } from '../services/maintenanceApi';

export function useMaintenance() {
  const [maintenance, setMaintenance] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const checkMaintenance = async () => {
    try {
      const response = await maintenanceApi.getStatus();
      if (response.success) {
        setMaintenance(response.data.maintenance);
        setMessage(response.data.message);
      }
    } catch (_) {
      setMaintenance(true);
      setMessage('VexaTrade is currently undergoing maintenance. Please check back later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkMaintenance();
  }, []);

  return { maintenance, message, loading, checkMaintenance };
}
