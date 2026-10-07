"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const triggerButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const closeMenu = useCallback(() => {
    dialog.current?.close();
    setOpen(false);
    window.requestAnimationFrame(() => triggerButton.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    closeButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [closeMenu, open]);

  return (
    <>
      <button ref={triggerButton} className="icon-button mobile-menu-button" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open} aria-controls="mobile-menu-dialog"><Menu size={22} /></button>
      {open && <dialog ref={dialog} id="mobile-menu-dialog" className="mobile-drawer mobile-drawer--open" aria-label="Menu principal" onCancel={(event) => { event.preventDefault(); closeMenu(); }}>
        <button ref={closeButton} className="icon-button mobile-drawer__close" onClick={closeMenu} aria-label="Fechar menu"><X size={22} /></button>
        <Sidebar onNavigate={closeMenu} />
      </dialog>}
    </>
  );
}
