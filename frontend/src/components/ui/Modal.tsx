"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={cn("relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-3 sm:mx-4 max-h-[92vh] overflow-y-auto", className)}>
        {title && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b">
            <h3 className="text-base sm:text-lg font-semibold text-neutral-900">{title}</h3>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 ml-2 flex-shrink-0">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="px-4 sm:px-6 py-3 sm:py-4">{children}</div>
      </div>
    </div>
  );
}
