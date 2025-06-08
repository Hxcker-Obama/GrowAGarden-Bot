const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const PORT = 8000;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Command collection
client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// When the client is ready
client.once(Events.ClientReady, async c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    
    // Register commands
    try {
        const commands = [];
        for (const [name, command] of client.commands) {
            commands.push(command.data.toJSON());
        }
        
        await client.application.commands.set(commands);
        console.log('Successfully registered application commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// Command interaction handler
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.editReply({ 
            content: 'There was an error while executing this command!', 
            ephemeral: true 
        });
    }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

// Start the HTTP server alongside your bot
app.listen(PORT, () => {
  console.log(`Health check server running on port ${PORT}`);
});

// Login
client.login(process.env["TOKEN"]);