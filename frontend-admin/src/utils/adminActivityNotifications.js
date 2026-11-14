const ALLOWED_CATEGORIES = new Set([
  'deposit', 'withdrawal', 'funding', 'trading', 'market', 'chat', 'security', 'kyc', 'general',
]);

export function normalizeAdminActivityEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) return null;
  const id = Number(event.id);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const rawCategory = String(event.category || 'general').trim().toLowerCase();
  const aliases = { withdraw: 'withdrawal', funds: 'funding', fund: 'funding', trade: 'trading', crypto: 'market', support: 'chat' };
  const category = aliases[rawCategory] || rawCategory;
  const date = event.created_at ? new Date(event.created_at) : null;
  return {
    ...event,
    id,
    user_id: event.user_id == null ? null : Number(event.user_id),
    category: ALLOWED_CATEGORIES.has(category) ? category : 'general',
    title: String(event.title || 'Activity notification'),
    message: String(event.message || ''),
    is_read: Boolean(event.is_read),
    created_at: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
  };
}

export function mergeAdminActivityEvent(current, incoming) {
  const event = normalizeAdminActivityEvent(incoming);
  if (!event) return Array.isArray(current) ? current : [];
  const rows = (Array.isArray(current) ? current : [])
    .map(normalizeAdminActivityEvent)
    .filter(Boolean)
    .filter((item) => item.id !== event.id);
  rows.push(event);
  rows.sort((a, b) => {
    const timeA = a.created_at ? Date.parse(a.created_at) : 0;
    const timeB = b.created_at ? Date.parse(b.created_at) : 0;
    return timeB - timeA || b.id - a.id;
  });
  return rows.slice(0, 100);
}

export function countUnreadAdminActivity(events) {
  return (Array.isArray(events) ? events : []).filter((event) => event && !event.is_read).length;
}
