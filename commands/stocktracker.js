const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Store active trackers
const activeTrackers = new Map();

// Track previous stock states to detect changes
const previousStockStates = new Map();

// Role mappings from roles.json
const roleMappings = {};
const oldRoleMappings = {
    "seed_stock": {
        "Beanstalk": "1378079580627275786",
        "Cacao": "1378080651911364649",
        "Pepper": "1378080718500139080",
        "Mushroom": "1378080752620802098",
        "Grape": "1378080807541018624",
        "Mango": "1378080825769328722",
        "Dragon Fruit": "1378080844039721142",
        "Cactus": "1378080865208238171",
        "Coconut": "1378080890198167582"
    },
    "gear_stock": {
        "Master Sprinkler": "1378079539413909645",
        "Godly Sprinkler": "1378080036178886736",
        "Advanced Sprinkler": "1367539082216870039",
        "Basic Sprinkler": "1374423920932814949",
        "Lightning Rod": "1378099474290966578"
    },
    "egg_stock": {
        "Bug Egg": "1378099589835522159",
        "Mythical Egg": "1378099518842732594",
    },
    "eventshop_stock": {
        "Bee Egg": "1379397085123706922",
        "Bee Crate": "1379397150751850556",
        "Honey Sprinkler": "1379397351164350495",
        "Nectarine Seed": "1379397575802753107",
        "Hive Fruit": "1379397485260308553"
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stock-tracker')
        .setDescription('Manage the auto-updating stock tracker for different shops')
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start auto-updating stock tracker')
                .addStringOption(option =>
                    option.setName('shop')
                        .setDescription('The shop to track (e.g. egg_stock, seed_stock)')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Seed Stock', value: 'seed_stock' },
                            { name: 'Gear Stock', value: 'gear_stock' },
                            { name: 'Egg Stock', value: 'egg_stock' },
                            { name: 'Cosmetic Stock', value: 'cosmetic_stock' },
                            { name: 'Event Shop Stock', value: 'eventshop_stock' }
                        )
        ))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Stop the stock tracker in this channel')
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
                const shop = interaction.options.getString('shop');
                
                if (activeTrackers.has(channelId)) {
                    await interaction.editReply('❌ There is already an active stock tracker in this channel.');
                    return;
                }

                const { embed, itemCount, success } = await this.fetchStockData(shop);
                
                if (!success) {
                    await interaction.editReply("❌ Error Fetching Shop! Try again later.");
                    return;
                }

                const message = await interaction.channel.send({ embeds: [embed] });

                // Initialize previous stock state
                previousStockStates.set(channelId, {
                    shop,
                    items: new Map((await this.fetchStockData(shop)).combinedItems?.map(item => [item.display_name, item.quantity]) || new Map())
                });

                const interval = setInterval(async () => {
                    try {
                        const { embed: updatedEmbed, combinedItems } = await this.fetchStockData(shop);
                        await message.edit({ embeds: [updatedEmbed] });

                        // Check for restocked items
                        const previousState = previousStockStates.get(channelId);
                        if (previousState && previousState.shop === shop) {
                            const currentItems = new Map(combinedItems.map(item => [item.display_name, item.quantity]));
                            
                            for (const [itemName, currentQty] of currentItems) {
                                const previousQty = previousState.items.get(itemName) || 0;
                                
                                // If item was out of stock (0) and now has stock (>0)
                                if (previousQty === 0 && currentQty > 0) {
                                    const roleId = roleMappings[shop]?.[itemName];
                                    if (roleId) {
                                        const alertMsg = await interaction.channel.send({
                                            content: `🎉 ${itemName} is back in stock! <@&${roleId}>`,
                                            allowedMentions: { roles: [roleId] }
                                        });
                                        setTimeout(() => {
                                            alertMsg.delete().catch(console.error);
                                        }, 120000);
                                    }
                                }
                            }
                            
                            // Update previous state
                            previousState.items = currentItems;
                        }

                    } catch (error) {
                        console.error('Error updating stock tracker:', error);
                    }
                }, 60000);

                activeTrackers.set(channelId, { interval, message, shop });
                await interaction.editReply(`✅ Started auto-updating ${shop} tracker! Tracking ${itemCount} items.`);

            } else if (subcommand === 'stop') {
                if (!activeTrackers.has(channelId)) {
                    await interaction.editReply('❌ There is no active stock tracker in this channel.');
                    return;
                }

                const tracker = activeTrackers.get(channelId);
                clearInterval(tracker.interval);
                try {
                    await tracker.message.delete();
                } catch (error) {
                    console.error('Error deleting tracker message:', error);
                }

                activeTrackers.delete(channelId);
                previousStockStates.delete(channelId);
                await interaction.editReply('✅ Stopped stock tracker in this channel.');
            }
        } catch (error) {
            console.error('Error in stock tracker command:', error);
            await interaction.editReply(`❌ An error occurred: ${error.message}`);
        }
    },

    async fetchStockData(shop) {
        const response = await fetch("https://api.joshlei.com/v2/growagarden/stock", {
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
        const stockData = data[shop] || [];

        if (!stockData || stockData.length === 0) {
            const embed = new EmbedBuilder()
                .setDescription('Cannot fetch stock data or invalid shop')
                .setColor(0xFF0000);
            return { embed, success: false };
        }

        // Combine duplicate items and sum their quantities
        const itemMap = new Map();
        stockData.forEach(item => {
            if (itemMap.has(item.display_name)) {
                const existing = itemMap.get(item.display_name);
                itemMap.set(item.display_name, {
                    ...item,
                    quantity: existing.quantity + item.quantity
                });
            } else {
                itemMap.set(item.display_name, { ...item });
            }
        });

        const combinedItems = Array.from(itemMap.values())
            .sort((a, b) => a.display_name.localeCompare(b.display_name));

        const embed = new EmbedBuilder()
            .setTitle(`🛒 Current ${shop.replace('_', ' ')} (Auto-Updating)`)
            .setColor(0xFFD700)
            .setTimestamp();

        combinedItems.forEach(item => {
            embed.addFields({
                name: `${item.display_name}`,
                value: `Stock: ${item.quantity}`,
                inline: true
            });
        });

        const totalItems = combinedItems.reduce((sum, item) => sum + item.quantity, 0);
        embed.addFields({
            name: 'Total Items Available',
            value: `${totalItems}`,
            inline: false
        });

        return { 
            embed, 
            itemCount: combinedItems.length,
            totalItems,
            combinedItems,
            success: true
        };
    }
};
