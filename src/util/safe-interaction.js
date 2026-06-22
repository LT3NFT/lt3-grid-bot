export async function safeDeferReply(interaction) {
  try {
    await interaction.deferReply();
    return true;
  } catch (err) {
    console.error("deferReply failed", err);
    return false;
  }
}

export async function safeEditReply(interaction, options) {
  try {
    await interaction.editReply(options);
  } catch (err) {
    console.error("editReply failed", err);
  }
}

export async function safeReply(interaction, options) {
  try {
    await interaction.reply(options);
  } catch (err) {
    console.error("reply failed", err);
  }
}
