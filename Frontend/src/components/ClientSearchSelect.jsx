import React, { useEffect, useId, useMemo, useRef, useState } from "react";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function getClientLabel(client) {
  return client?.name || "Client sans nom";
}

function getClientMeta(client) {
  return [client?.address, client?.robot_model, client?.phone].filter(Boolean).join(" - ");
}

export default function ClientSearchSelect({
  clients,
  value,
  onChange,
  required = false,
  placeholder = "Rechercher un client"
}) {
  const inputRef = useRef(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const selectedClient = useMemo(
    () => (Array.isArray(clients) ? clients : []).find((client) => String(client.id) === String(value)),
    [clients, value]
  );

  const filteredClients = useMemo(() => {
    const list = Array.isArray(clients) ? clients : [];
    const term = normalizeText(query);
    if (!term) return list.slice(0, 10);

    return list
      .filter((client) =>
        [client.name, client.address, client.robot_model, client.phone]
          .some((field) => normalizeText(field).includes(term))
      )
      .slice(0, 10);
  }, [clients, query]);

  useEffect(() => {
    setQuery(selectedClient ? getClientLabel(selectedClient) : "");
  }, [selectedClient]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.setCustomValidity(
      required && !value ? "Selectionner un client dans la liste." : ""
    );
  }, [required, value]);

  const selectClient = (client) => {
    onChange(String(client.id));
    setQuery(getClientLabel(client));
    setIsOpen(false);
  };

  const handleInputChange = (event) => {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    setIsOpen(true);

    if (selectedClient && nextQuery !== getClientLabel(selectedClient)) {
      onChange("");
    }
  };

  const handleKeyDown = (event) => {
    if (!isOpen && ["ArrowDown", "ArrowUp"].includes(event.key)) {
      setIsOpen(true);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (!filteredClients.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filteredClients.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      selectClient(filteredClients[activeIndex] || filteredClients[0]);
    }
  };

  return (
    <div className="client-search-select">
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listId}
      />
      {isOpen && (
        <div className="client-search-select__list" id={listId} role="listbox">
          {filteredClients.map((client, index) => {
            const meta = getClientMeta(client);
            return (
              <button
                key={client.id}
                type="button"
                className={
                  "client-search-select__option " +
                  (index === activeIndex ? "client-search-select__option--active" : "")
                }
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectClient(client);
                }}
                role="option"
                aria-selected={String(client.id) === String(value)}
              >
                <span>{getClientLabel(client)}</span>
                {meta && <small>{meta}</small>}
              </button>
            );
          })}
          {!filteredClients.length && (
            <div className="client-search-select__empty">Aucun client trouve</div>
          )}
        </div>
      )}
    </div>
  );
}
