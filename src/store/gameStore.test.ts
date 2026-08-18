import { EstadoPartida } from '../game/types';
import { useAppStore } from './appStore';
import { useGameStore } from './gameStore';

function estadoDeEjemplo(): EstadoPartida {
  return {
    jugadores: [
      {
        id: 'h',
        nombre: 'Humano',
        mano: [
          { id: '3-4', lado1: 3, lado2: 4 },
          { id: '4-6', lado1: 4, lado2: 6 },
        ],
        esBot: false,
      },
      { id: 'b', nombre: 'Bot', mano: [], esBot: true },
    ],
    tablero: [{ id: '2-3', lado1: 2, lado2: 3, rotada: false }],
    pozo: [],
    turnoActual: 0,
    extremoIzquierdo: 2,
    extremoDerecho: 3,
    ganador: null,
    partidaTrabada: false,
  };
}

beforeEach(() => {
  useGameStore.setState({
    fase: 'jugando',
    config: [],
    opciones: { robarPozo: true },
    estado: estadoDeEjemplo(),
    mensaje: null,
  });
});

describe('gameStore', () => {
  it('coloca una ficha y pasa el turno', () => {
    useGameStore.getState().jugar('3-4', 'derecho');
    const { estado, fase } = useGameStore.getState();
    expect(estado!.jugadores[0].mano).toHaveLength(1);
    expect(estado!.turnoActual).toBe(0);
    expect(estado!.extremoDerecho).toBe(4);
    expect(fase).toBe('jugando');
  });

  it('declara ganador cuando el jugador se queda sin fichas', () => {
    useGameStore.setState({
      estado: {
        ...estadoDeEjemplo(),
        jugadores: [
          {
            id: 'h',
            nombre: 'Humano',
            mano: [{ id: '3-4', lado1: 3, lado2: 4 }],
            esBot: false,
          },
          { id: 'b', nombre: 'Bot', mano: [], esBot: true },
        ],
      },
    });
    useGameStore.getState().jugar('3-4', 'derecho');
    const { estado, fase } = useGameStore.getState();
    expect(fase).toBe('terminado');
    expect(estado!.ganador).toBe('h');
  });

  it('no permite jugar una ficha que no coincide', () => {
    useGameStore.setState({
      estado: {
        ...estadoDeEjemplo(),
        jugadores: [
          {
            id: 'h',
            nombre: 'Humano',
            mano: [{ id: '1-1', lado1: 1, lado2: 1 }],
            esBot: false,
          },
          { id: 'b', nombre: 'Bot', mano: [], esBot: true },
        ],
      },
    });
    useGameStore.getState().jugar('1-1', 'izquierdo');
    const { estado, mensaje } = useGameStore.getState();
    expect(estado!.jugadores[0].mano).toHaveLength(1);
    expect(mensaje).toBeTruthy();
  });

  it('no permite pasar si tiene fichas jugables', () => {
    useGameStore.getState().pasar();
    const { estado, mensaje } = useGameStore.getState();
    expect(estado!.turnoActual).toBe(0);
    expect(mensaje).toBeTruthy();
  });

  it('el bot resuelve su turno jugando una ficha jugable', () => {
    useGameStore.setState({
      estado: {
        ...estadoDeEjemplo(),
        turnoActual: 1,
        jugadores: [
          {
            id: 'h',
            nombre: 'Humano',
            mano: [{ id: '3-6', lado1: 3, lado2: 6 }],
            esBot: false,
          },
          {
            id: 'b',
            nombre: 'Bot',
            mano: [
              { id: '2-2', lado1: 2, lado2: 2 },
              { id: '5-5', lado1: 5, lado2: 5 },
            ],
            esBot: true,
          },
        ],
      },
    });
    useGameStore.getState().resolverTurnoBot();
    const { estado, fase } = useGameStore.getState();
    expect(fase).toBe('jugando');
    expect(estado!.jugadores[1].mano).toHaveLength(1);
    expect(estado!.turnoActual).toBe(0);
  });

  it('termina la partida por bloqueo y gana quien tenga menos puntos', () => {
    useGameStore.setState({
      estado: {
        ...estadoDeEjemplo(),
        turnoActual: 1,
        pozo: [],
        jugadores: [
          {
            id: 'h',
            nombre: 'Humano',
            mano: [{ id: '1-1', lado1: 1, lado2: 1 }],
            esBot: false,
          },
          {
            id: 'b',
            nombre: 'Bot',
            mano: [{ id: '5-5', lado1: 5, lado2: 5 }],
            esBot: true,
          },
        ],
      },
    });
    useGameStore.getState().resolverTurnoBot();
    const { estado, fase } = useGameStore.getState();
    expect(fase).toBe('terminado');
    expect(estado!.partidaTrabada).toBe(true);
    expect(estado!.ganador).toBe('h');
  });

  it('inicia una partida sin pozo cuando se desactiva el robo', () => {
    useGameStore.setState({ fase: 'configuracion', opciones: { robarPozo: true } });
    useGameStore.getState().iniciar(
      [
        { nombre: 'Ana', esBot: false },
        { nombre: 'Bot', esBot: true },
      ],
      { robarPozo: false }
    );
    const { estado, opciones } = useGameStore.getState();
    expect(opciones.robarPozo).toBe(false);
    expect(estado!.pozo).toHaveLength(0);
    expect(estado!.jugadores.reduce((acc, j) => acc + j.mano.length, 0)).toBe(28);
  });

  it('con el robo desactivado no permite robar del pozo', () => {
    useGameStore.setState({
      opciones: { robarPozo: false },
      estado: {
        ...estadoDeEjemplo(),
        jugadores: [
          {
            id: 'h',
            nombre: 'Humano',
            mano: [{ id: '1-1', lado1: 1, lado2: 1 }],
            esBot: false,
          },
          { id: 'b', nombre: 'Bot', mano: [], esBot: true },
        ],
        pozo: [{ id: '3-3', lado1: 3, lado2: 3 }],
      },
    });
    useGameStore.getState().robar();
    const { estado, mensaje } = useGameStore.getState();
    expect(estado!.jugadores[0].mano).toHaveLength(1);
    expect(estado!.pozo).toHaveLength(1);
    expect(mensaje).toBeTruthy();
  });

  it('con el robo desactivado el bot pasa en lugar de robar', () => {
    useGameStore.setState({
      opciones: { robarPozo: false },
      estado: {
        ...estadoDeEjemplo(),
        turnoActual: 1,
        pozo: [{ id: '3-3', lado1: 3, lado2: 3 }],
        jugadores: [
          {
            id: 'h',
            nombre: 'Humano',
            mano: [{ id: '3-6', lado1: 3, lado2: 6 }],
            esBot: false,
          },
          {
            id: 'b',
            nombre: 'Bot',
            mano: [{ id: '5-5', lado1: 5, lado2: 5 }],
            esBot: true,
          },
        ],
      },
    });
    useGameStore.getState().resolverTurnoBot();
    const { estado } = useGameStore.getState();
    expect(estado!.jugadores[1].mano).toHaveLength(1);
    expect(estado!.pozo).toHaveLength(1);
    expect(estado!.turnoActual).toBe(0);
  });

  it('iniciar con apuesta cobra los créditos del jugador local', () => {
    useAppStore.setState({ saldo: 1000, transacciones: [], perfil: null });
    useGameStore.setState({ fase: 'configuracion' });
    useGameStore.getState().iniciar(
      [
        { nombre: 'Ana', esBot: false },
        { nombre: 'Bot', esBot: true },
      ],
      { robarPozo: true, apuesta: 100 }
    );
    expect(useAppStore.getState().saldo).toBe(900);
  });

  it('ganar la partida con apuesta abona el pozo completo', () => {
    useAppStore.setState({ saldo: 900, transacciones: [], perfil: null });
    useGameStore.setState({
      fase: 'jugando',
      opciones: { robarPozo: true, apuesta: 100 },
      config: [{ nombre: 'Ana', esBot: false }],
    });
    const estado = useGameStore.getState().estado as EstadoPartida;
    useGameStore.getState().resolverYpagar({ ...estado, ganador: 'h' });
    const { pago, fase } = useGameStore.getState();
    expect(fase).toBe('terminado');
    expect(pago).toEqual({ tipo: 'ganancia', monto: 200 });
    expect(useAppStore.getState().saldo).toBe(1100);
  });

  it('partida trabada con apuesta devuelve el reembolso', () => {
    useAppStore.setState({ saldo: 900, transacciones: [], perfil: null });
    useGameStore.setState({
      fase: 'jugando',
      opciones: { robarPozo: true, apuesta: 100 },
      config: [{ nombre: 'Ana', esBot: false }],
    });
    const estado: EstadoPartida = {
      ...estadoDeEjemplo(),
      turnoActual: 1,
      pozo: [],
      jugadores: [
        { id: 'h', nombre: 'Humano', mano: [{ id: '5-5', lado1: 5, lado2: 5 }], esBot: false },
        { id: 'b', nombre: 'Bot', mano: [{ id: '1-1', lado1: 1, lado2: 1 }], esBot: true },
      ],
    };
    useGameStore.getState().resolverYpagar(estado);
    const { pago, estado: final } = useGameStore.getState();
    expect(final!.partidaTrabada).toBe(true);
    expect(final!.ganador).toBe('b');
    expect(pago).toEqual({ tipo: 'reembolso', monto: 100 });
    expect(useAppStore.getState().saldo).toBe(1000);
  });

  it('perder la partida registra una pérdida sin abonar nada', () => {
    useAppStore.setState({ saldo: 900, transacciones: [], perfil: null });
    useGameStore.setState({
      fase: 'jugando',
      opciones: { robarPozo: true, apuesta: 100 },
      config: [{ nombre: 'Ana', esBot: false }],
    });
    const estado = useGameStore.getState().estado as EstadoPartida;
    useGameStore.getState().resolverYpagar({ ...estado, ganador: 'b' });
    const { pago } = useGameStore.getState();
    expect(pago).toEqual({ tipo: 'perdida', monto: -100 });
    expect(useAppStore.getState().saldo).toBe(900);
  });
});