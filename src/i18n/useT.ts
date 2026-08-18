// src/i18n/useT.ts

import { useAppStore } from '../store/appStore';
import { Idioma, traducir, Traducciones } from './traducciones';

export type ClaveTraduccion = keyof Traducciones;

export function useT() {
  const idioma = useAppStore(s => s.ajustes.idioma);
  return (clave: ClaveTraduccion, params?: Record<string, string | number>) =>
    traducir(idioma, clave, params);
}

export function t(idio: Idioma, clave: ClaveTraduccion, params?: Record<string, string | number>) {
  return traducir(idio, clave, params);
}