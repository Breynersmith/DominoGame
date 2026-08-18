import { describe, it, expect, afterEach } from 'vitest';
import supertest from 'supertest';
import { Socket } from 'socket.io-client';
import {
  crearServidor,
  ServidorPrueba,
  escuchar,
  conectar,
  esperarEvento,
  registrarUsuario,
} from './helpers';
import { reiniciarLimitador } from '../src/limiter';
import { obtenerExtremosJugables, obtenerFichasJugables } from '../src/game/engine';
import { EstadoPartida } from '../src/game/types';

let servidor: ServidorPrueba | null = null;
const sockets: Socket[] = [];

async function registrarYConectar(url: string, nombre: string) {
  reiniciarLimitador();
  const reg = await registrarUsuario(servidor!.app, nombre);
  const token = reg.token;
  const socket = await conectar(url, token);
  sockets.push(socket);
  return { usuario: reg.usuario, token, socket };
}

async function crearSala(token: string, nombre: string, apuesta: number) {
  const res = await supertest(servidor!.app)
    .post('/salas')
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre, apuesta });
  return res.body.sala.codigo as string;
}

async function saldoDe(token: string) {
  const res = await supertest(servidor!.app).get('/billetera').set('Authorization', `Bearer ${token}`);
  return res.body.saldo as number;
}

afterEach(async () => {
  for (const s of sockets) s.disconnect();
  sockets.length = 0;
  if (servidor) {
    await servidor.cerrar();
    servidor = null;
  }
});

describe('partidas en tiempo real', () => {
  it('une a dos jugadores, el anfitrión empieza y el primero juega el doble-6', async () => {
    servidor = crearServidor();
    const url = await escuchar(servidor.server);
    const ana = await registrarYConectar(url, 'Ana');
    const leo = await registrarYConectar(url, 'Leo');
    const codigo = await crearSala(ana.token, 'Mesa 1', 0);

    ana.socket.emit('sala:unirse', codigo);
    leo.socket.emit('sala:unirse', codigo);
    await new Promise(r => setTimeout(r, 150));

    const promEmpezada = esperarEvento<{ apuesta: number; jugadores: { id: number; esBot: boolean; orden: number }[] }>(
      ana.socket,
      'partida:empezada',
    );
    const promEstadoInicial = esperarEvento<{ estado: { tablero: unknown[]; turnoActual: number; jugadores: { mano: { id: string }[] }[] } }>(
      leo.socket,
      'partida:estado',
    );

    ana.socket.emit('sala:empezar', { codigo, robarPozo: true });

    const empezada = await promEmpezada;
    const estadoInicial = await promEstadoInicial;

    expect(empezada.apuesta).toBe(0);
    expect(empezada.jugadores).toHaveLength(2);
    expect(empezada.jugadores.every(j => !j.esBot)).toBe(true);
    expect(estadoInicial.estado.tablero).toHaveLength(0);

    // El jugador inicial debe tener el doble-6 y su turno es el índice 0 de la mano
    const primerOrden = estadoInicial.estado.turnoActual;
    const primerJugador = estadoInicial.estado.jugadores[primerOrden];
    expect(primerJugador.mano.some(f => f.id === '6-6')).toBe(true);

    const primerUid = empezada.jugadores[primerOrden].id;
    const socketJugador = primerUid === ana.usuario.id ? ana.socket : leo.socket;

    const promEstadoJugado = esperarEvento<{ estado: { tablero: unknown[] } }>(leo.socket, 'partida:estado');
    socketJugador.emit('partida:jugar', { codigo, fichaId: '6-6', extremo: 'derecho' });
    const estadoJugado = await promEstadoJugado;

    expect(estadoJugado.estado.tablero).toHaveLength(1);
  });

  it('cobra la apuesta a cada jugador humano al empezar', async () => {
    servidor = crearServidor();
    const url = await escuchar(servidor.server);
    const ana = await registrarYConectar(url, 'Ana');
    const leo = await registrarYConectar(url, 'Leo');
    const codigo = await crearSala(ana.token, 'Apuestas', 50);

    ana.socket.emit('sala:unirse', codigo);
    leo.socket.emit('sala:unirse', codigo);
    await new Promise(r => setTimeout(r, 150));

    const promEmpezada = esperarEvento(ana.socket, 'partida:empezada');
    ana.socket.emit('sala:empezar', { codigo, robarPozo: true });
    await promEmpezada;

    expect(await saldoDe(ana.token)).toBe(950);
    expect(await saldoDe(leo.token)).toBe(950);
  });

  it('solo el anfitrión puede empezar la partida', async () => {
    servidor = crearServidor();
    const url = await escuchar(servidor.server);
    const ana = await registrarYConectar(url, 'Ana');
    const leo = await registrarYConectar(url, 'Leo');
    const codigo = await crearSala(ana.token, 'Mesa', 0);

    ana.socket.emit('sala:unirse', codigo);
    leo.socket.emit('sala:unirse', codigo);
    await new Promise(r => setTimeout(r, 150));

    const promError = esperarEvento<{ error: string }>(leo.socket, 'sala:error');
    leo.socket.emit('sala:empezar', { codigo, robarPozo: true });
    const error = await promError;
    expect(error.error).toBe('solo_el_anfitrion');
  });

  it('unirse a una sala inexistente devuelve error', async () => {
    servidor = crearServidor();
    const url = await escuchar(servidor.server);
    const ana = await registrarYConectar(url, 'Ana');

    const promError = esperarEvento<{ error: string }>(ana.socket, 'sala:error');
    ana.socket.emit('sala:unirse', 'ZZZ999');
    const error = await promError;
    expect(error.error).toBe('sala_no_encontrada');
  });

  it('partida:terminada incluye los pagos de cada jugador humano', async () => {
    servidor = crearServidor();
    const url = await escuchar(servidor.server);
    const ana = await registrarYConectar(url, 'Ana');
    const codigo = await crearSala(ana.token, 'Apuestas', 50);

    ana.socket.emit('sala:unirse', codigo);
    await new Promise(r => setTimeout(r, 150));

    // Conductor automático: juega por el humano en cada turno (los bots los mueve el servidor)
    ana.socket.on('partida:estado', (datos: { estado: EstadoPartida }) => {
      const estado = datos.estado;
      const jugador = estado.jugadores[estado.turnoActual];
      if (!jugador || jugador.esBot) return;
      const jugables = obtenerFichasJugables(jugador.id, estado);
      if (jugables.length > 0) {
        const f = jugables[0];
        const extremos = obtenerExtremosJugables(f, estado);
        ana.socket.emit('partida:jugar', { codigo, fichaId: f.id, extremo: extremos[0] });
      } else if (estado.pozo.length > 0) {
        ana.socket.emit('partida:robar', { codigo });
      } else {
        ana.socket.emit('partida:pasar', { codigo });
      }
    });

    const promTerminada = esperarEvento<{
      estado: unknown;
      apuesta: number;
      pot: number;
      pagos: Record<number, { tipo: string; monto: number }>;
    }>(ana.socket, 'partida:terminada');
    ana.socket.emit('sala:empezar', { codigo, robarPozo: true });

    const resultado = await promTerminada;
    expect(resultado.apuesta).toBe(50);
    expect(resultado.pot).toBe(50);
    // El humano (Ana) siempre recibe un pago definido
    const pago = resultado.pagos[ana.usuario.id];
    expect(pago).toBeDefined();
    expect(['ganancia', 'reembolso', 'perdida']).toContain(pago.tipo);
    expect(pago.monto).toBe(50);
  });
});