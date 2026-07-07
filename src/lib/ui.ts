import { useEffect, useState, type ReactNode } from 'react';

export type SheetContent = {
  title: string;
  subtitle?: string;
  body: ReactNode;
  actions?: ReactNode;
} | null;

type ToastEntry = { id: number; text: string; kind?: 'info' | 'success' };

export type LightboxContent = { src: string; caption?: string } | null;

const toastListeners = new Set<(t: ToastEntry[]) => void>();
const sheetListeners = new Set<(s: SheetContent) => void>();
const lightboxListeners = new Set<(l: LightboxContent) => void>();
let toasts: ToastEntry[] = [];
let sheet: SheetContent = null;
let lightbox: LightboxContent = null;
let idCounter = 0;

export function toast(text: string, kind: ToastEntry['kind'] = 'info') {
  const id = ++idCounter;
  toasts = [...toasts, { id, text, kind }];
  toastListeners.forEach((l) => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    toastListeners.forEach((l) => l(toasts));
  }, 2600);
}

export function openSheet(content: NonNullable<SheetContent>) {
  sheet = content;
  sheetListeners.forEach((l) => l(sheet));
}

export function closeSheet() {
  sheet = null;
  sheetListeners.forEach((l) => l(null));
}

export function useToasts() {
  const [s, setS] = useState<ToastEntry[]>(toasts);
  useEffect(() => {
    toastListeners.add(setS);
    return () => {
      toastListeners.delete(setS);
    };
  }, []);
  return s;
}

export function useSheet() {
  const [s, setS] = useState<SheetContent>(sheet);
  useEffect(() => {
    sheetListeners.add(setS);
    return () => {
      sheetListeners.delete(setS);
    };
  }, []);
  return s;
}

export function openLightbox(src: string, caption?: string) {
  lightbox = { src, caption };
  lightboxListeners.forEach((l) => l(lightbox));
}

export function closeLightbox() {
  lightbox = null;
  lightboxListeners.forEach((l) => l(null));
}

export function useLightbox() {
  const [s, setS] = useState<LightboxContent>(lightbox);
  useEffect(() => {
    lightboxListeners.add(setS);
    return () => {
      lightboxListeners.delete(setS);
    };
  }, []);
  return s;
}
