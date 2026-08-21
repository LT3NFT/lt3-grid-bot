import { ApplicationCommandOptionType } from "discord.js";
import { buildTraitGridFromTraitText } from "../chat/traitGrid.js";
import { handleTraitSlashCommand } from "./trait-command-shared.js";
import { publicSlashCommandDefaults } from "./public-defaults.js";

export const randomgridCommandData = {
  ...publicSlashCommandDefaults,
  name: "randomgrid",
  description: "Generate a 3×3 grid of random LT3s matching a trait",
  options: [
    {
      name: "trait",
      description: "Trait name — close enough works (e.g. Venus Fly Trap, ski, fly trap headwear)",
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
};

export async function handleRandomgridCommand(interaction) {
  const trait = interaction.options.getString("trait", true);
  await handleTraitSlashCommand(interaction, {
    build: () => buildTraitGridFromTraitText(trait),
    cooldownKey: "randomgrid",
    progressLabel: "Building your trait grid",
    errorLabel: "/randomgrid",
  });
}
