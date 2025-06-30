const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Store active weather trackers
const activeWeatherTrackers = new Map();

// Track previous weather states to detect changes
const previousWeatherStates = new Map();

// Role mappings for weather events
const weatherRoleMappings = {
    "Rain": "1378081635622191346",
    "Frost": "1378081652382761101",
    "Thunderstorm": "1378081694619271239",
    "NightEvent": "1381240543467536464",
    "MeteorShower": "1378081715272155227",
    // "BeeSwarm": "1378081652382761101",
    // "Disco": "1378081652382761101",
    "JandelStorm": "1381240273966993418",
    "Blackhole": "1381240416908742667",
    "DJJhai": "1381240472823005194",
    "SunGod": "1381240619938086994",
    "JandelFloat": "1381241665494192209"
};

// Emoji mappings for weather events
const weatherEmojiMappings = {
    "Rain": "🌧️",
    "Frost": "❄️",
    "Thunderstorm": "⛈️",
    "NightEvent": "🩸",
    "MeteorShower": "☄️",
    "BeeSwarm": "🐝",
    "Disco": "🌈",
    "JandelStorm": "🌀",
    "Blackhole": "⚫",
    "DJJhai": "🎵",
    "SunGod": "☀️",
    "JandelFloat": "🎈"
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weather-tracker')
        .setDescription('Manage the auto-updating weather event tracker')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start auto-updating weather tracker')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Stop the weather tracker in this channel')
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const subcommand = interaction.options.getSubcommand();
        const channelId = interaction.channelId;
        
        if (interaction.user.id != 973159740303638549) {
            await interaction.editReply('❌ Unauthorized User!');
            return;
        }

        try {
            if (subcommand === 'start') {
                if (activeWeatherTrackers.has(channelId)) {
                    await interaction.editReply('❌ There is already an active weather tracker in this channel.');
                    return;
                }

                const { embed, activeEvents, weatherEvents } = await this.fetchWeatherData();
                const message = await interaction.channel.send({ embeds: [embed] });

                // Initialize previous weather state
                previousWeatherStates.set(channelId, {
                    activeEvents: weatherEvents.map(event => ({
                        name: event.weather_name,
                        active: event.active
                    }))
                });

                const interval = setInterval(async () => {
                    try {
                        const { embed: updatedEmbed, weatherEvents: currentEvents } = await this.fetchWeatherData();
                        await message.edit({ embeds: [updatedEmbed] });

                        // Check for newly activated weather events
                        const previousState = previousWeatherStates.get(channelId);
                        if (previousState) {
                            for (const currentEvent of currentEvents) {
                                const previousEvent = previousState.activeEvents.find(e => e.name === currentEvent.weather_name);
                                
                                // If event was inactive and is now active
                                if (previousEvent && !previousEvent.active && currentEvent.active) {
                                    const roleId = weatherRoleMappings[currentEvent.weather_name];
                                    if (roleId) {
                                        const alertMsg = await interaction.channel.send({
                                            content: `⚠️ ${weatherEmojiMappings[currentEvent.weather_name] || '⛈️'} **${currentEvent.weather_name}** has started! <@&${roleId}>`,
                                            allowedMentions: { roles: [roleId] }
                                        });
                                        setTimeout(() => {
                                            alertMsg.delete().catch(console.error);
                                        }, 120000);
                                    }
                                }
                            }
                            
                            // Update previous state
                            previousState.activeEvents = currentEvents.map(event => ({
                                name: event.weather_name,
                                active: event.active
                            }));
                        }

                    } catch (error) {
                        console.error('Error updating weather tracker:', error);
                    }
                }, 60000); // Update every minute

                activeWeatherTrackers.set(channelId, { interval, message });
                await interaction.editReply(`✅ Started auto-updating weather tracker! Currently ${activeEvents} active weather events.`);

            } else if (subcommand === 'stop') {
                if (!activeWeatherTrackers.has(channelId)) {
                    await interaction.editReply('❌ There is no active weather tracker in this channel.');
                    return;
                }

                const tracker = activeWeatherTrackers.get(channelId);
                clearInterval(tracker.interval);
                try {
                    await tracker.message.delete();
                } catch (error) {
                    console.error('Error deleting tracker message:', error);
                }

                activeWeatherTrackers.delete(channelId);
                previousWeatherStates.delete(channelId);
                await interaction.editReply('✅ Stopped weather tracker in this channel.');
            }
        } catch (error) {
            console.error('Error in weather tracker command:', error);
            await interaction.editReply(`❌ An error occurred: ${error.message}`);
        }
    },

    async fetchWeatherData() {
        const response = await fetch("https://api.joshlei.com/v2/growagarden/weather", {
            "headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0",
                "Accept": "*/*",
            },
            "method": "GET"
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        const weatherData = data.weather || [];
        const activeEvents = weatherData.filter(event => event.active).length;
    
        // Create embed
        const embed = new EmbedBuilder()
            .setTitle('⛅ Current Weather Events (Auto-Updating)')
            .setColor(0x87CEEB)
            .setTimestamp();

        // Create single field with all weather events
        const weatherList = weatherData.map(event => {
            const emoji = weatherEmojiMappings[event.weather_name] || '⛈️';
            const status = event.active ? 
                `✅ Active (${event.duration}s)` : 
                `❌ Inactive`;
        
            const startTime = event.start_duration_unix > 0 ? 
                ` | Started: <t:${event.start_duration_unix}:R>` : '';
            const endTime = event.end_duration_unix > 0 ? 
                ` | Ends: <t:${event.end_duration_unix}:R>` : '';

            return `${emoji} **${event.weather_name}**: ${status}${startTime}${endTime}`;
        }).join('\n');

        // Add the single field with all weather events
        embed.addFields({
            name: 'All Weather Events',
            value: weatherList.length > 0 ? weatherList : 'No weather events found',
            inline: false
        });
    
        // Add summary field
        embed.addFields({
            name: 'Summary',
            value: `**${activeEvents} active weather events**\nNext update in 1 minute`,
            inline: false
        });

        return { 
            embed, 
            activeEvents,
            weatherEvents: weatherData
        };
    }
};
