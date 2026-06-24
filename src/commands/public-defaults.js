/** Open to all server members in guild channels (not admin-only). */
import { ApplicationIntegrationType, InteractionContextType } from "discord.js";

export const publicSlashCommandDefaults = {
  default_member_permissions: null,
  dm_permission: false,
  integration_types: [ApplicationIntegrationType.GuildInstall],
  contexts: [InteractionContextType.Guild],
};
