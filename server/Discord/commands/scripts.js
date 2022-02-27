module.exports = {
    name: 'online',
    cooldown: 10,
    description: 'Connected Characters!',
    execute({msg, sockets}) {
        let str = `${sockets.length} Character${sockets.length > 1 ? 's' : ''} connected`
        sockets.forEach((soc, index) => str = str + `\n ${index + 1}- ${soc.name} (${soc.level})`)
        msg.channel.send(str);
    },
};