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
  updateAppointmentStatus: (id, status) => request(`/api/appointments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  login: (credentials) => request("/api/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
  register: (details) => request("/api/auth/register", { method: "POST", body: JSON.stringify(details) }),
  logout: () => request("/api/auth/logout", { method: "POST", body: "{}" }),
};
