const STORAGE_KEY = "vexatrade_recent_transfers";

export function getRecentContacts() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const contacts = JSON.parse(stored);
    // Return only last 5 unique contacts
    return contacts.slice(0, 5);
  } catch {
    return [];
  }
}

export function addRecentContact(recipient) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    let contacts = stored ? JSON.parse(stored) : [];
    
    // Remove if already exists
    contacts = contacts.filter(c => c.uid !== recipient.uid);
    
    // Add to beginning
    contacts.unshift({
      uid: recipient.uid,
      name: recipient.name || recipient.email,
      timestamp: Date.now()
    });
    
    // Keep only last 10
    contacts = contacts.slice(0, 10);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
  } catch {
    // Silent fail
  }
}

export function clearRecentContacts() {
  localStorage.removeItem(STORAGE_KEY);
}
