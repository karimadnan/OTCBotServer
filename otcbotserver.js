const fs = require('fs');
require('dotenv').config()
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
const url = process.env.MONGODB_URI;
const dbname = process.env.DBName;
let DB = require('./mongo');

//Discord Code
for (const file of commandFiles) {
  const command = require(`./server/Discord/commands/${file}`);
  client.commands.set(command.name, command);
  if (!cooldowns.has(command.name)) {
    cooldowns.set(command.name, new Discord.Collection());
  }
}

let sockets = [];
let offlineChars = [];

const updateOffline = () => {
  const guild = client.guilds.cache.find((guild) => guild.name === 'United')
  const offChannel = guild.channels.cache.find((c) => c.name === 'offline-chars')
  if (offChannel) {
    offChannel.messages.fetch({ limit: 100 }).then((messages) => {
      offChannel.bulkDelete(messages).then(() => {
        const charList = offlineChars.length ? offlineChars.map((char) => {
          let timeOfDC = Date.now() - char.time

          const hoursDifference = Math.floor(timeOfDC/1000/60/60);
          timeOfDC -= hoursDifference*1000*60*60
          const minutesDifference = Math.floor(timeOfDC/1000/60);
          timeOfDC -= minutesDifference*1000*60
          
          return `${char.name} - level ${char.level} - ${hoursDifference}H:${minutesDifference}M\n`
        }) : 'No offline characters!'
        const embed = new Discord.MessageEmbed()
            .setTitle('Current offline characters:')
            .setColor('#D82148')
            .setThumbnail('https://www.ezodus.net/images/outfit_gen/animoutfit.php?id=268&addons=3&head=132&body=0&legs=78&feet=0&mount=0&direction=3')
            .setDescription('Name - Hours since disconnection')
            .addField("Characters:", charList)
        offChannel.send(embed);
        offChannel.send('@everyone List was updated!')
      })
    })
  }
}
client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  updateOffline()
});

client.on('message', message => {
  if (message.channel.name === 'offline-chars' && 
      message.author.username.toLowerCase() !== 'united manger') {
    message.delete()
    .then(msg => msg.author.send(`You cannot type in (offline-chars) channel!`))
    .catch(console.error);
  }
  
  if (/[a-zA-Z+]-lv[0-9+]/gi.test(message.channel.name) && !message.author.bot){
    const char = message.channel.name.split('-')[0].toLowerCase()
    console.log(sockets, 'sockets')
    const charSoc = sockets.find((soc) => {
      if (soc && soc.name) {
        return soc.ws.name.toLowerCase() === char
      }
    })
    if (charSoc) {
      const msgObj = {action: 'textChannel', msg: message.content}
      charSoc.ws.send(JSON.stringify(msgObj))
    }
  }

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
        command.execute({ message, args, sockets, offlineChars });
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

const filterOffline = (name, callback) => {
  const isOffline = offlineChars.find((char) => char.name === name)
  if (isOffline) {
    offlineChars = offlineChars.filter((char) => char.name !== name)
    callback()
  }
}

require('uWebSockets.js').App().ws('/*', {
  open: (ws) => {
      const id = uuidv4();
      ws.id = id;
      console.log('connected')
      ws.subscribe('broadcast')
      sockets.push({ws, name: ''})
      const msg = {action: 'register', msg: 'Welcome to kimox OTC Bot server'}
      ws.send(JSON.stringify(msg))
  },
  message: (ws, incMsg, isBinary) => {
    let json = JSON.parse(decoder.write(Buffer.from(incMsg)));
    if (!json) return
    const guild = client.guilds.cache.find((guild) => guild.name === 'United')
    const getChannel = (name, full) => 
      guild.channels.cache.find((c) => !full ? c.name.split('-')[0] === name?.toLowerCase() : c.name === name?.toLowerCase())

    switch (json.action) {

      case 'announce': {
        const urgentAnnounces = /justified|dead/
        let str = `${json.data}`
        
        if (json.data.match(urgentAnnounces)) {
          str = `@everyone ${str}`
        }
        getChannel(ws.name)?.send(str)
      }

      case 'joined': {
        if (!json.name && !json.level && !json.stamina) return
        const charName = json.name.replace(/\s+/g, '')

        const isConnected = sockets.find((socket) => {
          if (socket && socket.name) {
            return socket.name === charName
          }
          return false
        })

        if (isConnected) {
          filterSocket(ws.id, () => {
            ws.send(JSON.stringify({ action: 'duplicate', msg: 'This character is already connected.' }))
            ws.close()
          })
          return
        }

        filterOffline(charName, () => {
          updateOffline()
        })

        ws.name = charName;
        ws.level = json.level;
        ws.stamina = json.stamina;

        sockets = sockets.map((socket) => {
          if (socket.ws.id === ws.id) {
            return { ws, name: charName }
          }
        })

      const old = getChannel(charName)
      if (!old) {
          guild.channels.create(`${charName}-Lv.${json.level}-ST-${Math.floor(json.stamina/60)}%`).then((channel) => {
          channel.send(`${json.name} Connected to server!`)
        })} else {
          old.send(`${json.name} Reconnected to server`)
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
          channel.send(`${ws.name} disconnected from server!`)
          offlineChars.push({ name: ws.name, level: ws.level, time: Date.now()})
          updateOffline()
        }
      })
  },
  
}).get('/*', (res, req) => {
  res.writeStatus('200 OK').writeHeader('IsExample', 'Yes').end('Hello there!');
  
}).listen(host, port, (listenSocket) => {

  if (listenSocket) {
    DB.connect(url, dbname).then(success => {
      console.log('Database connected')
    }, err => {
      console.log('Failed To connect DB', err);
      process.exit(1);
    })
    console.log(`Listening to port ${port}`);
    client.login(token)
  }
  
});