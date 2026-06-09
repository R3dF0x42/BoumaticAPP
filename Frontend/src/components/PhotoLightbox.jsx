import React, { useEffect } from "react";
import { createPortal } from "react-dom";

export default function PhotoLightbox({ photo, onClose }) {
  useEffect(() => {
    if (!photo) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [photo, onClose]);

  if (!photo) return null;

  const lightbox = (
    <div className="photo-lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <button
        className="photo-lightbox-close"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClose?.();
        }}
        aria-label="Fermer la photo"
      >
        X
      </button>
      <img
        src={photo.src}
        alt={photo.alt || "Photo agrandie"}
        onClick={(event) => event.stopPropagation()}
        draggable="false"
      />
    </div>
  );

  return createPortal(lightbox, document.body);
}
