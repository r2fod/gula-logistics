/**
 * Centralized Date and Time utilities to ensure consistent formatting across the application.
 */

// Format: 15/09/2026
export const formatDate = (dateObj) => {
  if (!dateObj) return '';
  return new Date(dateObj).toLocaleDateString('es-ES');
};

// Format: 10:30:00 (24h)
export const formatTime = (dateObj) => {
  if (!dateObj) return '';
  return new Date(dateObj).toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit', 
    hour12: false 
  });
};

// Format: 10:30 (24h) - no seconds
export const formatTimeShort = (dateObj) => {
  if (!dateObj) return '';
  return new Date(dateObj).toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: false 
  });
};

export const parseDateString = (dateString) => {
  if (!dateString) return null;
  return new Date(dateString);
};
