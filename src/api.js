async function request(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "No se pudo completar la solicitud.");
  return payload;
}

export const api = {
  getCatalog: () => request("/api/catalog"),
  recordSearch: () => request("/api/search-events", { method: "POST", body: "{}" }),
  getUser: () => request("/api/auth/me"),
  getAvailability: (professionalId, centerId, date) => {
    const query = new URLSearchParams({ professionalId, centerId, date });
    return request(`/api/availability?${query}`);
  },
  getAvailabilityDates: (professionalId, centerId) => {
    const query = new URLSearchParams({ professionalId, centerId });
    return request(`/api/availability/dates?${query}`);
  },
  getAvailabilitySummary: () => request("/api/availability/summary"),
  getAppointments: () => request("/api/appointments"),
  getManagedAppointments: () => request("/api/appointments/manage"),
  createAppointment: (booking) => request("/api/appointments", { method: "POST", body: JSON.stringify(booking) }),
  cancelAppointment: (id) => request(`/api/appointments/${id}/cancel`, { method: "PATCH", body: "{}" }),
  updateAppointmentStatus: (id, status) => request(`/api/appointments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  login: (credentials) => request("/api/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
  register: (details) => request("/api/auth/register", { method: "POST", body: JSON.stringify(details) }),
  logout: () => request("/api/auth/logout", { method: "POST", body: "{}" }),
  getNotifications: () => request("/api/notifications"),
  markNotificationRead: (id) => request(`/api/notifications/${id}`, { method: "PATCH", body: "{}" }),
  getDocuments: () => request("/api/documents"),
  getDocument: (id) => request(`/api/documents/${id}`),
  createDocument: (document) => request("/api/documents", { method: "POST", body: JSON.stringify(document) }),
  createReview: (review) => request("/api/reviews", { method: "POST", body: JSON.stringify(review) }),
  getAdminUsers: () => request("/api/admin/users"),
  updateAdminUser: (id, changes) => request(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(changes) }),
  getAdminReviews: () => request("/api/admin/reviews"),
  moderateReview: (id, hidden) => request(`/api/admin/reviews/${id}`, { method: "PATCH", body: JSON.stringify({ hidden }) }),
  getAdminProfessionals: () => request("/api/admin/professionals"),
  verifyProfessional: (id, verified) => request(`/api/admin/professionals/${id}`, { method: "PATCH", body: JSON.stringify({ verified }) }),
  getProfessionalProfile: () => request("/api/professional/profile"),
  updateProfessionalProfile: (profile) => request("/api/professional/profile", { method: "PATCH", body: JSON.stringify(profile) }),
  getProfessionalSchedule: () => request("/api/professional/schedule"),
  updateProfessionalSchedule: (schedule) => request("/api/professional/schedule", { method: "PUT", body: JSON.stringify({ schedule }) }),
  getAdminStats: (from, to) => request(`/api/admin/stats?${new URLSearchParams({ from, to })}`),
  getAdminCenters: () => request("/api/admin/centers"),
  createAdminCenter: (center) => request("/api/admin/centers", { method: "POST", body: JSON.stringify(center) }),
  updateAdminCenter: (id, center) => request(`/api/admin/centers/${id}`, { method: "PATCH", body: JSON.stringify(center) }),
  deleteAdminCenter: (id) => request(`/api/admin/centers/${id}`, { method: "DELETE" }),
  createAdminProfessional: (professional) => request("/api/admin/professionals", { method: "POST", body: JSON.stringify(professional) }),
  updateAdminProfessional: (id, changes) => request(`/api/admin/professionals/${id}`, { method: "PATCH", body: JSON.stringify(changes) }),
  deleteAdminProfessional: (id) => request(`/api/admin/professionals/${id}`, { method: "DELETE" }),
};
