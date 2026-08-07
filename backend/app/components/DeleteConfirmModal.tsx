import { useState, type ReactNode } from "react";
import { Form } from "react-router";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title: string;
  warningText: ReactNode;
  id: string;
  intent?: string;
  extraFields?: Record<string, string>;
  isSubmitting?: boolean;
  error?: string | null;
  confirmWord?: string;
  confirmButtonLabel?: string;
  submittingLabel?: string;
  confirmButtonClassName?: string;
  onCancel: () => void;
}

export function DeleteConfirmModal({
  isOpen,
  title,
  warningText,
  id,
  intent = "hard_delete",
  extraFields,
  isSubmitting,
  error,
  confirmWord = "DELETE",
  confirmButtonLabel = "Delete Permanently",
  submittingLabel = "Deleting...",
  confirmButtonClassName = "bg-red-600 hover:bg-red-700",
  onCancel,
}: DeleteConfirmModalProps) {
  const [confirmText, setConfirmText] = useState("");

  if (!isOpen) return null;

  const canConfirm = confirmText === confirmWord;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <Form method="post" className="p-6 flex flex-col gap-4" onSubmit={() => setConfirmText("")}>
          <input type="hidden" name="intent" value={intent} />
          <input type="hidden" name="id" value={id} />
          {extraFields &&
            Object.entries(extraFields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}

          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {warningText}
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded text-sm font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="font-mono font-bold">{confirmWord}</span> to confirm
            </label>
            <input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500 text-sm font-mono"
              placeholder={confirmWord}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={!canConfirm || isSubmitting}
              className={`flex-1 py-2 text-white rounded font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed ${confirmButtonClassName}`}
            >
              {isSubmitting ? submittingLabel : confirmButtonLabel}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm"
            >
              Cancel
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
