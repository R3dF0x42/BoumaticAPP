import React from "react";

export default function MapAppChooserModal({ open, title, links, onClose }) {
  if (!open || !links) return null;

  const openMapApp = (url) => {
    if (!url) return;
    onClose?.();
    window.location.assign(url);
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2>Choisir une app GPS</h2>
        <p className="muted-small">
          {title ? `Destination: ${title}` : "Choisissez une application de navigation."}
        </p>
        <div className="modal-actions">
          <button className="btn small" type="button" onClick={() => openMapApp(links.google)}>
            Google Maps
          </button>
          <button className="btn small" type="button" onClick={() => openMapApp(links.waze)}>
            Waze
          </button>
          <button className="btn small" type="button" onClick={() => openMapApp(links.apple)}>
            Plans Apple
          </button>
          <button className="btn small ghost" type="button" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
