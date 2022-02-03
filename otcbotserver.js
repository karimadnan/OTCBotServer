const fs = require('fs');
const { prefix, token } = require('./server/Discord/config.json');
const { Discord, client } = require('./server/Discord');
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
      const msg = {action: 'register', msg: 'Welcome to kimox OTC Bot server'}
      ws.send(JSON.stringify(msg))
  },
  message: (ws, incMsg, isBinary) => {
    let json = JSON.parse(decoder.write(Buffer.from(incMsg)));
    if (!json) return
    const guild = client.guilds.cache.find((guild) => guild.name === 'United')
    
    const getChannel = (name) => {
      const channel = guild.channels.cache.find((c) => c.name.split('-')[0] === name?.toLowerCase())
      return channel
    }

    switch (json.action) {
      case 'announce': {
        getChannel(ws.name)?.send(json.data)
      }
      case 'joined': {
        if (!json.name && !json.level && !json.stamina) return
        ws.name = json.name;
        ws.level = json.level;
        ws.stamina = json.stamina;
        const old = getChannel(json.name)
          old?.delete()
          guild.channels.create(`${json.name}-Lv.${json.level}-ST-${Math.floor(json.stamina/60)}%`).then((channel) => {
          const obj = {action: 'channelReg'}
          ws.send(JSON.stringify(obj))
          channel.send(`${json.name} Connected to server!`)
        })
        break;
      }
      case 'updateChar': {
        ws.level = json.level;
        ws.stamina = json.stamina;
        const updated = {action: 'updated'}
        ws.send(JSON.stringify(updated))
        const channel = getChannel(ws.name)
        channel?.setName(`${ws.name}-Lv.${json.level}-ST.${Math.floor(json.stamina/60)}%`)
        break;
      }
    }
  },
  close: (ws, code, message) => {
    const guild = client.guilds.cache.find((guild) => guild.name === 'United')
    const channel = guild.channels.cache.find((c) => c.name.split('-')[0] === ws.name.toLowerCase())
    sockets.find((socket, index) => {
    if (socket && socket.id === ws.id) {
      sockets.splice(index, 1);
      channel?.setName(`${ws.name}-offline`)
      channel?.send(`${ws.name} Disconnected from server!`)
    }
  });
  },
  
}).get('/*', (res, req) => {

  res.writeStatus('200 OK').writeHeader('IsExample', 'Yes').end('Hello there!');
  
}).listen(process.env.PORT || 9001, (listenSocket) => {

  if (listenSocket) {
    console.log('Listening to port 9001');
    client.login(token)
  }
  
});