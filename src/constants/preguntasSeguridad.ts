// src/constants/preguntasSeguridad.ts
// Códigos de pregunta de seguridad admitidos por el servidor.
import { Traducciones } from '../i18n/traducciones';

export const PREGUNTAS_SEGURIDAD: { codigo: string; clave: keyof Traducciones }[] = [
  { codigo: 'nombre_mascota', clave: 'preguntaMascota' },
  { codigo: 'ciudad_nacimiento', clave: 'preguntaCiudad' },
  { codigo: 'comida_favorita', clave: 'preguntaComida' },
  { codigo: 'nombre_colegio', clave: 'preguntaColegio' },
];

export const TIPOS_DOCUMENTO = ['dni', 'nie', 'pasaporte'] as const;