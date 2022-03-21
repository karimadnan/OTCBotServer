var db = require('../../../mongo')

module.exports = {
    name: 'addicons',
    cooldown: 10,
    description: 'Add access to icons',
    async execute({message, args}) {
        const collection = db.dbo.collection('icons');
        if (!args.length) return message.channel.send('Please provide a character name')
        try {
            await collection.insertOne({ charName: args[0].toLowerCase() });
            message.channel.send(`${args[0]} was added to icons successfully :white_check_mark:`)
        } catch (err) {
            message.channel.send(`Error: ${err}`)
        }
    },
};