// src/hooks/useResponsive.ts
// Ajusta los paddings verticales fijos (diseñados para móvil con muesca/status bar)
// cuando la app se ve en web de escritorio, donde no hay notch y sobra espacio.

import { Platform, useWindowDimensions } from 'react-native';

export function useResponsive() {
  const { width } = useWindowDimensions();
  const esWebGrande = Platform.OS === 'web' && width >= 640;
  return {
    esWebGrande,
    paddingBarra: esWebGrande ? 16 : 30,
    paddingContenido: esWebGrande ? 24 : 40,
    paddingPie: esWebGrande ? 24 : 60,
  };
}