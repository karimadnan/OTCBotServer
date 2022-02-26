const fs = require('fs');
const { prefix, token } = require('./server/Discord/config.json');
const { Discord, client } = require('./server/Discord');
client.commands = new Discord.Collection();
const commandFiles = fs.readdirSync('./server/Discord/commands').filter(file => file.endsWith('.js'));
const cooldowns = new Discord.Collection();
const { v4: uuidv4 } = require('uuid');
const { StringDecoder } = require('string_decoder');
const decoder = new StringDecoder('utf8');
const port = process.env.PORT || 9001
const host = '0.0.0.0'

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

const filterSocket = (id, callback) => {
    sockets.find((socket) => {
    if (socket && socket.id === id) {
      sockets = sockets.filter((prevSock) => prevSock.id !== id)
      callback()
    }
  });
}

require('uWebSockets.js').App().ws('/*', {
  open: (ws) => {
      const id = uuidv4();
      ws.id = id;
      console.log('connected')
      ws.subscribe('broadcast')
      sockets.push(ws)
      const msg = {action: 'register', msg: 'Welcome to kimox OTC Bot server'}
      ws.send(JSON.stringify(msg))
  },
  message: (ws, incMsg, isBinary) => {
    let json = JSON.parse(decoder.write(Buffer.from(incMsg)));
    if (!json) return
    const guild = client.guilds.cache.find((guild) => guild.name === 'United')
    const getChannel = (name) => 
      guild.channels.cache.find((c) => c.name.split('-')[0] === name?.toLowerCase())

    switch (json.action) {

      case 'announce': {
        getChannel(ws.name)?.send(json.data)
      }

      case 'joined': {
        if (!json.name && !json.level && !json.stamina) return
        const charName = json.name.replace(/\s+/g, '')
        ws.name = charName;
        ws.level = json.level;
        ws.stamina = json.stamina;

        const isConnected = sockets.find((socket) => socket.char === charName)

        if (isConnected) {
          filterSocket(ws.id, () => {
            ws.send(JSON.stringify({ action: 'duplicate', msg: 'This character is already connected.' }))
            ws.close()
          })
        }

        sockets.map((socket) => {
          if (socket.id === ws.id) {
            return { ...socket, char: charName }
          }
        })

        const old = getChannel(charName)
        const offlineChannel = getChannel(`${charName}-offline`)

        if (!old) {
          guild.channels.create(`${charName}-Lv.${json.level}-ST-${Math.floor(json.stamina/60)}%`).then((channel) => {
          channel.send(`${json.name} Connected to server!`)
        })}

        if (offlineChannel) {
          channel.setName(`${charName}-Lv.${json.level}-ST.${Math.floor(json.stamina/60)}%`)
        }

        const obj = {action: 'channelReg'}
        ws.send(JSON.stringify(obj))
        break;
      }

      case 'updateChar': {
        if (ws.level !== json.level || ws.stamina !== json.stamina) {
          const channel = getChannel(ws.name)
          if (channel) {
            channel.setName(`${ws.name}-Lv.${json.level}-ST.${Math.floor(json.stamina/60)}%`)
          }
        }

        ws.level = json.level;
        ws.stamina = json.stamina;
        const updated = {action: 'updated'}
        ws.send(JSON.stringify(updated))
        break;
      }
    }
  },
  close: (ws, code, message) => {
    const guild = client.guilds.cache.find((guild) => guild.name === 'United')
    const getChannel = (name) => 
      guild.channels.cache.find((c) => c.name.split('-')[0] === name?.toLowerCase())
      
      filterSocket(ws.id, () => {
        const channel = getChannel(ws.name)
        if (channel) {
          channel.setName(`${ws.name}-offline`)
          channel.send(`${ws.name} Connection closed!`)
        }
      })
  },
  
}).get('/*', (res, req) => {
  res.writeStatus('200 OK').writeHeader('IsExample', 'Yes').end('Hello there!');
  
}).listen(host, port, (listenSocket) => {

  if (listenSocket) {
    console.log(`Listening to port ${port}`);
    client.login(token)
  }
  
});