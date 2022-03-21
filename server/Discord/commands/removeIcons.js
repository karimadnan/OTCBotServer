var db = require('../../../mongo')

module.exports = {
    name: 'removeicons',
    cooldown: 10,
    description: 'Remove access to icons',
    async execute({message, args}) {
        const collection = db.dbo.collection('icons');
        if (!args.length) return message.channel.send('Please provide a character name')
        try {
            await collection.deleteOne({ charName: args[0].toLowerCase() });
            message.channel.send(`${args[0]} was removed from icons :x:`)
        } catch (err) {
            message.channel.send(`Error: ${err}`)
        }
    },
};