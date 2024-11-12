const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
import type { WebSocket } from 'ws';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

interface Room {
  [key: string]: WebSocket[];
}

const rooms: Room = {};

wss.on('connection', (ws: WebSocket) => {
  let currentRoom: string;

  ws.on('message', (message: string) => {
    const data = JSON.parse(message);
    switch (data.type) {
      case 'join':
        currentRoom = data.room;
        if (!rooms[currentRoom]) {
          rooms[currentRoom] = [];
        }
        rooms[currentRoom].push(ws);
        break;
      case 'signal':
      case 'chat':
        rooms[currentRoom].forEach((client) => {
          if (client !== ws) {
            client.send(JSON.stringify(data));
          }
        });
        break;
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms[currentRoom]) {
      rooms[currentRoom] = rooms[currentRoom].filter((client) => client !== ws);
      if (rooms[currentRoom].length === 0) {
        delete rooms[currentRoom];
      }
    }
  });
});

const PORT = process.env.PORT || 8000;

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
