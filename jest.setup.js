jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({
    volume: 0.7,
    seekTo: jest.fn(),
    play: jest.fn(),
  })),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// En los tests no hay red: las llamadas a la API fallan y el appStore
// cae al modo local (retroceso offline).
global.fetch = jest.fn(() => Promise.reject(new Error('sin red en tests')));

jest.mock('socket.io-client', () => {
  const socket = {
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  };
  return {
    io: jest.fn(() => socket),
  };
});