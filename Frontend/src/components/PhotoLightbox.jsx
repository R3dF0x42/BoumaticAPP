import React, { useEffect } from "react";

export default function PhotoLightbox({ photo, onClose }) {
  useEffect(() => {
    if (!photo) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [photo, onClose]);

  if (!photo) return null;

  return (
    <div className="photo-lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <button
        className="photo-lightbox-close"
        type="button"
        onClick={onClose}
        aria-label="Fermer la photo"
      >
        X
      </button>
      <img
        src={photo.src}
        alt={photo.alt || "Photo agrandie"}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}
