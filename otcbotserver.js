const fs = require('fs');
const { prefix, token } = require('./server/Discord/config.json');
const { Discord, client } = require('./server/Discord');
var bodyParser = require('body-parser');
client.commands = new Discord.Collection();
const commandFiles = fs.readdirSync('./server/Discord/commands').filter(file => file.endsWith('.js'));
const cooldowns = new Discord.Collection();
const { v4: uuidv4 } = require('uuid');
const { StringDecoder } = require('string_decoder');
const decoder = new StringDecoder('utf8');

//Discord Code
for (const file of commandFiles) {
  const command = require(`./server/Discord/commands/${file}`);
  client.commands.set(command.name, command);
  if (!cooldowns.has(command.name)) {
    cooldowns.set(command.name, new Discord.Collection());
  }
}

let sockets = [];

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', message => {

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const now = Date.now();
  const timestamps = cooldowns.get(commandName);
  const command = client.commands.get(commandName);
  const commandsChannel = ['actions', 'admin']

  if (!message.content.startsWith(prefix) && !command && commandsChannel.find(s => s === message.channel.name) && !message.author.bot) {
    return message.delete()
      .then(msg => msg.author.send(`${msg.author}, Only commands are allowed in action channel, Please use general for chat.`))
      .catch(console.error);
  }

  if (message.content.startsWith(prefix) && !command && commandsChannel.find(s => s === message.channel.name)) {
    return message.delete()
      .then(msg => msg.author.send(`${msg.author}, This is not a valid command.`))
      .catch(console.error);
  }

  if (!message.content.startsWith(prefix) || message.author.bot) return;
  if (!client.commands.has(commandName)) return;

  const cooldownAmount = (command.cooldown) * 1000;
  if (timestamps.has(message.author.id)) {
    const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      return message.delete()
        .then(msg => msg.author.send(`${msg.author}, please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${commandName}\` command.`))
        .catch(console.error);
    }
  } else {
    try {
      if (message.channel.name === 'actions' || message.channel.name === 'admin') {
        timestamps.set(message.author.id, now);
        setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
        command.execute(message, args, sockets);
      }
      else {
        timestamps.set(message.author.id, now);
        setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
        message.delete()
          .then(msg => msg.channel.send(`${msg.author}, Commands are only allowed in \`${`actions`}\` channel.`))
          .catch(console.error);
      }
    } catch {

    }
  }
});


require('uWebSockets.js').App().ws('/*', {
  open: (ws) => {
      const id = uuidv4();
      ws.id = id;
      console.log('connected')
      ws.subscribe('broadcast')
      sockets.push(ws)
      const msg = {action: 'register', id}
      ws.send(JSON.stringify(msg))
  },
  message: (ws, incMsg, isBinary) => {
    let json = JSON.parse(decoder.write(Buffer.from(incMsg)));
    switch (json.action) {
      case 'joined': {
        ws.name = json.name;
        ws.level = json.level;
        ws.hp = json.hp;
        const guild = client.guilds.cache.find((guild) => guild.name === 'United')
        const old = guild.channels.cache.find((c) => c.name === `${ws.name}-offline`.toLowerCase())
        if (old) {
          old.setName(`${json.name}-Lv.${json.level}-HP.${json.hp}%`).then((channel) => {
          const obj = {action: 'channelReg', data: channel.id}
          ws.send(JSON.stringify(obj))
          channel.send(`${json.name} Reconnected to server!`)
        })
        } else {
          guild.channels.create(`${json.name}-Lv.${json.level}-HP.${json.hp}%`).then((channel) => {
          const obj = {action: 'channelReg', data: channel.id}
          ws.send(JSON.stringify(obj))
          channel.send(`${json.name} Connected to server!`)
        })
        }
        break;
      }
      case 'updateChar': {
        ws.name = json.name;
        ws.level = json.level;
        ws.hp = json.hp;
        const updated = {action: 'updated'}
        ws.send(JSON.stringify(updated))
        const guild = client.guilds.cache.find((guild) => guild.name === 'United')
        const channel = guild.channels.cache.find((c) => c.id === json.id)
        if (channel) {
          channel.setName(`${json.name}-Lv.${json.level}-HP.${json.hp}%`)
          channel.send('updated!')
        }
        break;
      }
      case 'leave': {
        sockets.find((socket, index) => {
        if (socket && socket.id === ws.id) {
          sockets.splice(index, 1);
        }
      });
        break;
      }
    }
  },
  close: (ws, code, message) => {
    const guild = client.guilds.cache.find((guild) => guild.name === 'United')
    const channel = guild.channels.cache.find((c) => c.name.split('-')[0] === ws.name.toLowerCase())
    console.log(guild.channels.cache, ws.name.toLowerCase(), "CHANNELS")
    if (channel) {
      channel.setName(`${ws.name}-offline`)
      channel.send(`${ws.name} Disconnected from server!`)
    }
    sockets.find((socket, index) => {
    if (socket && socket.id === ws.id) {
      sockets.splice(index, 1);
    }
  });
  },
  
}).get('/*', (res, req) => {

  res.writeStatus('200 OK').writeHeader('IsExample', 'Yes').end('Hello there!');
  
}).listen(9001, (listenSocket) => {

  if (listenSocket) {
    console.log('Listening to port 9001');
    client.login(token)
  }
  
});