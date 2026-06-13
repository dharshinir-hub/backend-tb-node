// Shared SweetAlert2 popups for the Paperless Factory module.
// These mirror the EXACT patterns used elsewhere in the app (Component
// Registration etc.) so every create / update / delete looks identical.
// Button/popup colours come from the global theme in App.css
// (.swal2-confirm -> orange), so we don't set colours here.
import Swal from 'sweetalert2';

// Created a new record (green check + OK).
export const alertCreated = (msg) => Swal.fire(msg || 'Created successfully!', '', 'success');

// Updated an existing record (matches the app's plain "Updated Successfully").
export const alertUpdated = (msg) => Swal.fire(msg || 'Updated Successfully');

// Generic save success (green check).
export const alertSaved = (msg) => Swal.fire(msg || 'Saved successfully!', '', 'success');

// After a confirmed delete (green check).
export const alertDeleted = (msg) => Swal.fire('Deleted!', msg || 'Your record has been deleted successfully.', 'success');

// Error popup.
export const alertError = (msg) => Swal.fire('Error', msg || 'Something went wrong.', 'error');

// A simple warning (e.g. missing required fields).
export const alertWarning = (title, text) => Swal.fire({ icon: 'warning', title: title || 'Please check', text: text || '' });

// Delete confirmation — resolves to true if the user confirms.
export const confirmDelete = (text) =>
  Swal.fire({
    title: 'Are you sure you want to delete this record?',
    text: text || "You won't be able to revert this!",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, delete it!',
    cancelButtonText: 'Cancel',
    allowOutsideClick: false,
  }).then((r) => r.isConfirmed);
