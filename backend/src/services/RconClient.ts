import net from 'net';

const RCON_AUTH = 3;
const RCON_COMMAND = 2;

function buildPacket(id: number, type: number, payload: string): Buffer {
  const payloadBuf = Buffer.from(payload, 'utf8');
  const length = 4 + 4 + payloadBuf.length + 2; // id + type + payload + 2 null bytes
  const buf = Buffer.alloc(4 + length);
  buf.writeInt32LE(length, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  payloadBuf.copy(buf, 12);
  buf.writeUInt8(0, 12 + payloadBuf.length);
  buf.writeUInt8(0, 13 + payloadBuf.length);
  return buf;
}

export async function sendRconCommand(host: string, port: number, password: string, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let buffer = Buffer.alloc(0);
    let authed = false;
    const REQUEST_ID = Math.floor(Math.random() * 1000) + 1;

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('RCON timeout'));
    }, 5000);

    socket.connect(port, host, () => {
      socket.write(buildPacket(REQUEST_ID, RCON_AUTH, password));
    });

    socket.on('data', (data) => {
      buffer = Buffer.concat([buffer, data]);

      while (buffer.length >= 4) {
        const length = buffer.readInt32LE(0);
        if (buffer.length < 4 + length) break;

        const id = buffer.readInt32LE(4);
        // type at offset 8, payload starts at 12
        const payload = buffer.slice(12, 4 + length - 2).toString('utf8');
        buffer = buffer.slice(4 + length);

        if (!authed) {
          if (id === -1) {
            clearTimeout(timeout);
            socket.destroy();
            reject(new Error('RCON auth failed'));
            return;
          }
          authed = true;
          socket.write(buildPacket(REQUEST_ID, RCON_COMMAND, command));
        } else {
          clearTimeout(timeout);
          socket.destroy();
          resolve(payload);
        }
      }
    });

    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}
