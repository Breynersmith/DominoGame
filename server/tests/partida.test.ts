import { describe, it, expect, afterEach, afterAll } from 'vitest';
import supertest from 'supertest';
import { Socket } from 'socket.io-client';
import {
  crearServidor,
  ServidorPrueba,
  escuchar,
  conectar,
  esperarEvento,
  registrarUsuario,
  describeSupabase,
  cerrarPool,
} from './helpers';
import { obtenerExtremosJugables, obtenerFichasJugables } from '../src/game/engine';
import { EstadoPartida } from '../src/game/types';

let servidor: ServidorPrueba | null = null;
const sockets: Socket[] = [];

async function registrarYConectar(url: string, nombre: string) {
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

// Emite `sala:unirse` y espera a que el servidor confirme (chat:historial es el
// último evento que envía unirse). Evita los sleeps fijos: con la base en
// Supabase el procesamiento es asíncrono y más lento que con SQLite local.
async function unirse(socket: Socket, codigo: string): Promise<void> {
  const confirmado = esperarEvento(socket, 'chat:historial');
  socket.emit('sala:unirse', codigo);
  await confirmado;
}

afterEach(async () => {
  for (const s of sockets) s.disconnect();
  sockets.length = 0;
  if (servidor) {
    await servidor.cerrar();
    servidor = null;
  }
});

afterAll(() => cerrarPool());

describeSupabase('partidas en tiempo real', () => {
  it('une a dos jugadores, el anfitrión empieza y el primero juega el doble-6', async () => {
    servidor = await crearServidor();
    const url = await escuchar(servidor.server);
    const ana = await registrarYConectar(url, 'Ana');
    const leo = await registrarYConectar(url, 'Leo');
    const codigo = await crearSala(ana.token, 'Mesa 1', 0);

    await unirse(ana.socket, codigo);
    await unirse(leo.socket, codigo);

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
    servidor = await crearServidor();
    const url = await escuchar(servidor.server);
    const ana = await registrarYConectar(url, 'Ana');
    const leo = await registrarYConectar(url, 'Leo');
    const codigo = await crearSala(ana.token, 'Apuestas', 50);

    await unirse(ana.socket, codigo);
    await unirse(leo.socket, codigo);

    const promEmpezada = esperarEvento(ana.socket, 'partida:empezada');
    ana.socket.emit('sala:empezar', { codigo, robarPozo: true });
    await promEmpezada;

    expect(await saldoDe(ana.token)).toBe(950);
    expect(await saldoDe(leo.token)).toBe(950);
  });

  it('solo el anfitrión puede empezar la partida', async () => {
    servidor = await crearServidor();
    const url = await escuchar(servidor.server);
    const ana = await registrarYConectar(url, 'Ana');
    const leo = await registrarYConectar(url, 'Leo');
    const codigo = await crearSala(ana.token, 'Mesa', 0);

    await unirse(ana.socket, codigo);
    await unirse(leo.socket, codigo);

    const promError = esperarEvento<{ error: string }>(leo.socket, 'sala:error');
    leo.socket.emit('sala:empezar', { codigo, robarPozo: true });
    const error = await promError;
    expect(error.error).toBe('solo_el_anfitrion');
  });

  it('cada jugador recibe un color de ficha distinto al empezar', async () => {
    servidor = await crearServidor();
    const url = await escuchar(servidor.server);
    // Ambos usuarios se registran con el mismo color (#2563eb)
    const ana = await registrarYConectar(url, 'Ana');
    const leo = await registrarYConectar(url, 'Leo');
    const codigo = await crearSala(ana.token, 'Mesa', 0);

    await unirse(ana.socket, codigo);
    await unirse(leo.socket, codigo);

    const promEmpezada = esperarEvento<{ jugadores: { id: number; color: string; esBot: boolean }[] }>(
      ana.socket,
      'partida:empezada',
    );
    ana.socket.emit('sala:empezar', { codigo, robarPozo: true });
    const empezada = await promEmpezada;

    const colores = empezada.jugadores.map(j => j.color);
    expect(new Set(colores).size).toBe(colores.length);
  });

  it('si el anfitrión abandona una sala en espera, el rol pasa a otro jugador', async () => {
    servidor = await crearServidor();
    const url = await escuchar(servidor.server);
    const ana = await registrarYConectar(url, 'Ana');
    const leo = await registrarYConectar(url, 'Leo');
    const codigo = await crearSala(ana.token, 'Mesa', 0);

    await unirse(ana.socket, codigo);
    await unirse(leo.socket, codigo);

    const promActualizada = esperarEvento<{ hostId: number }>(leo.socket, 'sala:actualizada');
    ana.socket.disconnect();
    const actualizada = await promActualizada;
    expect(actualizada.hostId).toBe(leo.usuario.id);

    const promEmpezada = esperarEvento<{ jugadores: unknown[] }>(leo.socket, 'partida:empezada');
    leo.socket.emit('sala:empezar', { codigo, robarPozo: true });
    await promEmpezada;
  });

  it('sala:actualizar_perfil refresca la foto en la sala', async () => {
    servidor = await crearServidor();
    const url = await escuchar(servidor.server);
    const ana = await registrarYConectar(url, 'Ana');
    const leo = await registrarYConectar(url, 'Leo');
    const codigo = await crearSala(ana.token, 'Mesa', 0);

    await unirse(ana.socket, codigo);
    await unirse(leo.socket, codigo);

    const foto = `data:image/jpeg;base64,${'C'.repeat(10)}`;
    await supertest(servidor!.app).put('/usuarios/yo').set('Authorization', `Bearer ${ana.token}`).send({ foto });

    const promActualizada = esperarEvento<{ jugadores: { nombre: string; foto?: string }[] }>(
      leo.socket,
      'sala:actualizada',
    );
    ana.socket.emit('sala:actualizar_perfil');
    const actualizada = await promActualizada;
    const jugadorAna = actualizada.jugadores.find(j => j.nombre === 'Ana');
    expect(jugadorAna?.foto).toBeTruthy(); // la foto se sube a Storage y se devuelve su URL
  });

  it('unirse a una sala inexistente devuelve error', async () => {
    servidor = await crearServidor();
    const url = await escuchar(servidor.server);
    const ana = await registrarYConectar(url, 'Ana');

    const promError = esperarEvento<{ error: string }>(ana.socket, 'sala:error');
    ana.socket.emit('sala:unirse', 'ZZZ999');
    const error = await promError;
    expect(error.error).toBe('sala_no_encontrada');
  });

  it('partida:terminada incluye los pagos de cada jugador humano', async () => {
    servidor = await crearServidor();
    const url = await escuchar(servidor.server);
    const ana = await registrarYConectar(url, 'Ana');
    const codigo = await crearSala(ana.token, 'Apuestas', 50);

    await unirse(ana.socket, codigo);

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

  it('el chat de la sala difunde mensajes y el historial llega a quien se une', async () => {
    servidor = await crearServidor();
    const url = await escuchar(servidor.server);
    const ana = await registrarYConectar(url, 'Ana');
    const leo = await registrarYConectar(url, 'Leo');
    const codigo = await crearSala(ana.token, 'Mesa chat', 0);

    await unirse(ana.socket, codigo);

    const promMensaje = esperarEvento<{ mensaje: { nombre: string; texto: string } }>(ana.socket, 'chat:mensaje');
    await unirse(leo.socket, codigo);
    leo.socket.emit('chat:enviar', { codigo, texto: '¡Hola Ana!' });

    const recibido = await promMensaje;
    expect(recibido.mensaje.nombre).toBe('Leo');
    expect(recibido.mensaje.texto).toBe('¡Hola Ana!');

    // Un tercer jugador que se une recibe el historial con el mensaje anterior
    const pablo = await registrarYConectar(url, 'Pablo');
    const promHistorial = esperarEvento<{ mensajes: { nombre: string; texto: string }[] }>(pablo.socket, 'chat:historial');
    pablo.socket.emit('sala:unirse', codigo);
    const historial = await promHistorial;
    expect(historial.mensajes.some(m => m.nombre === 'Leo' && m.texto === '¡Hola Ana!')).toBe(true);
  });

  it('el chat rechaza mensajes vacíos o demasiado largos', async () => {
    servidor = await crearServidor();
    const url = await escuchar(servidor.server);
    const ana = await registrarYConectar(url, 'Ana');
    const codigo = await crearSala(ana.token, 'Mesa chat', 0);

    await unirse(ana.socket, codigo);

    const promError = esperarEvento<{ error: string }>(ana.socket, 'chat:error');
    ana.socket.emit('chat:enviar', { codigo, texto: '' });
    const error = await promError;
    expect(error.error).toBe('mensaje_invalido');
  });
});