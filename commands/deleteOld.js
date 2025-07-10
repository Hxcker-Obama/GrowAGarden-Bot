const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete-old')
    .setDescription('Deletes all trackers sent by this bot in the current channel'),

  async execute(interaction) {
    // Defer reply to avoid timeout
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.channel;
    try {
      if (interaction.user.id != 973159740303638549) {
            await interaction.editReply('❌ Unauthorized User!');
            return;
      }
      // Fetch all messages in the channel
      const messages = await channel.messages.fetch({ limit: 100 });
      
      // Filter messages sent by the bot
      const botMessages = messages.filter(m => m.author.id === interaction.client.user.id);

      // Bulk delete (works for messages < 14 days old)
      if (botMessages.size > 0) {
        await channel.bulkDelete(botMessages);
        await interaction.editReply({
          content: `Deleted ${botMessages.size} of my messages in this channel.`,
          ephemeral: true
        });
      } else {
        await interaction.editReply({
          content: "No messages from me found to delete.",
          ephemeral: true
        });
      }
    } catch (error) {
      console.error(error);
      await interaction.editReply({
        content: "Failed to delete messages. (Note: I can't delete messages older than 14 days.)",
        ephemeral: true
      });
    }
  }
};
