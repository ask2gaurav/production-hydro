import { useState, useRef, useEffect, type ReactNode } from "react";

type ButtonItem = {
  type: "button";
  label: string;
  onClick: () => void;
  variant?: "default" | "danger" | "warning";
  disabled?: boolean;
};

type NodeItem = {
  type: "node";
  node: ReactNode;
};

export type ActionItem = ButtonItem | NodeItem;

const variantClass: Record<NonNullable<ButtonItem["variant"]>, string> = {
  default: "text-gray-700 hover:bg-gray-50",
  danger: "text-red-600 hover:bg-red-50 font-medium",
  warning: "text-yellow-700 hover:bg-gray-50",
};

export function ActionsDropdown({ items }: { items: ActionItem[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = btnRef.current!.getBoundingClientRect();
    setPos({ top: rect.bottom + window.scrollY, left: rect.right - 176 });
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={toggle}
        className="p-1 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 leading-none text-base"
        title="More actions"
      >
        ⋮
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={close} />
          <div
            className="fixed w-44 bg-white border border-gray-200 rounded shadow-lg z-20 py-1 text-sm"
            style={{ top: pos.top, left: pos.left }}
          >
            {items.map((item, i) =>
              item.type === "node" ? (
                <div key={i} onClick={close}>
                  {item.node}
                </div>
              ) : (
                <button
                  key={i}
                  onClick={() => { item.onClick(); close(); }}
                  disabled={item.disabled}
                  className={`w-full text-left px-4 py-2 transition-colors disabled:opacity-50 ${variantClass[item.variant ?? "default"]}`}
                >
                  {item.label}
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
