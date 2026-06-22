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
    return true;
  } catch (err) {
    console.error("editReply failed", err);
  }

  try {
    const content =
      typeof options?.content === "string"
        ? options.content
        : "Your LT3 request finished, but Discord could not update the original reply.";
    await interaction.followUp({
      content,
      files: options?.files,
    });
    return true;
  } catch (err) {
    console.error("followUp failed", err);
    return false;
  }
}

export async function safeReply(interaction, options) {
  try {
    await interaction.reply(options);
  } catch (err) {
    console.error("reply failed", err);
  }
}
