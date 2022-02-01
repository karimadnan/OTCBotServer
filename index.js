const io = require('socket.io')(3000, {
    cors: {
        origin: ['*']
    }
});

io.on('connection', client => {
  console.log('connected')
  client.on('event', data => { /* … */ });
  client.on('disconnect', () => { /* … */ });
});