var db = require('../../../mongo')
const { Discord } = require('../../Discord');

module.exports = {
    name: 'iconusers',
    cooldown: 10,
    description: 'Return list of icon users',
    async execute({message, args}) {
        const collection = db.dbo.collection('icons');
        try {
            const res = await collection.find({}).toArray();
            const list = res.map((row) => `${row.charName}\n`)
            const embed = new Discord.MessageEmbed()
            .setTitle('Characters:')
            .setColor('#D82148')
            .setThumbnail('https://static.wikia.nocookie.net/tibia/images/0/07/The_Golden_Outfit_Display_%28Helmet%29.gif/revision/latest/scale-to-width-down/64?cb=20190613020735&path-prefix=en&format=original')
            .setDescription('List of icon users')
            .addField("Characters:", list)
            message.channel.send(embed)
            console.log(res, 'res')
        } catch (err) {
            message.channel.send(`Error: ${err}`)
        }
    },
};