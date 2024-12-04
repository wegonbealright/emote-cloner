import { Command } from "../commands";
import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Emote, getEmoteDataFromURL as getBTTVEmote } from "../../util/BetterTTVUtil";
import { getEmoteDataFromURL as get7TVEmote } from "../../util/SevenTVUtil";
import { isEmoteURL } from "../../util/URLUtil";

export class EmoteCommand extends Command {
    constructor() {
        super("emote", async (interaction: ChatInputCommandInteraction) => {
            console.log("Command received:", interaction.commandName);

            await interaction.deferReply(); // Acknowledge interaction immediately

            const urlOption = interaction.options.get('url');
            const sizeOption = interaction.options.get('size');
            const nameOption = interaction.options.get('name');
            const disableAnimationsOption = interaction.options.get('disable_animations');
            console.log("Options received:", { urlOption, sizeOption, nameOption, disableAnimationsOption });

            if (!urlOption) {
                console.warn("No URL option provided.");
                await interaction.editReply({ content: "`❌` URL is required." });
                return;
            }

            const emoteURL: string = urlOption.value as string;
            const platform = isEmoteURL(emoteURL);
            console.log("Platform detected:", platform);

            if (!platform) {
                console.warn("Invalid emote URL.");
                const embed = new EmbedBuilder()
                    .setTitle("Error")
                    .setAuthor({
                        name: interaction.user.displayName,
                        iconURL: `https://cdn.discordapp.com/avatars/${interaction.user.id}/${interaction.user.avatar ?? ''}`
                    })
                    .setTimestamp()
                    .setColor('#ff2020')
                    .setDescription("`❌` Invalid emote URL.\nCurrently supported platforms: `BetterTTV, 7TV`");
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            let emote: Emote | undefined;
            try {
                switch (platform) {
                    case '7tv':
                        emote = await get7TVEmote(emoteURL);
                        break;
                    case 'bttv':
                        emote = await getBTTVEmote(emoteURL);
                        break;
                }
            } catch (error) {
                console.error("Error fetching emote data:", error);
                await interaction.editReply("`❌` Failed to fetch emote data.");
                return;
            }

            if (!emote) {
                console.warn("Emote not found.");
                const embed = new EmbedBuilder()
                    .setTitle("Error")
                    .setAuthor({
                        name: interaction.user.displayName,
                        iconURL: `https://cdn.discordapp.com/avatars/${interaction.user.id}/${interaction.user.avatar ?? ''}`
                    })
                    .setTimestamp()
                    .setColor('#ff2020')
                    .setDescription("`❌` Emote not found.");
                await interaction.editReply({ embeds: [embed] });
                return;
            }

            console.log("Fetched emote data:", emote);

            const name: string = nameOption ? (nameOption.value as string) : emote.name;
            const disableAnimations = disableAnimationsOption ? (disableAnimationsOption.value as boolean) : false;

            const animatedURL = emote.hostURL.replace('{{size}}', sizeOption ? (platform === 'bttv' && sizeOption.value === '4x' ? '3x' : sizeOption.value as string) : '2x') + '.gif';
            const staticURL = emote.hostURL.replace('{{size}}', sizeOption ? (platform === 'bttv' && sizeOption.value === '4x' ? '3x' : sizeOption.value as string) : '4x') + '.webp';

            console.log("Constructed emote URLs:", { animatedURL, staticURL });

            let embed = new EmbedBuilder()
                .setAuthor({
                    name: emote.author.name,
                    iconURL: emote.author.avatar
                })
                .setURL(emoteURL)
                .setTitle(`${emote.name} by ${emote.author.name} (${platform})`)
                .setDescription('Uploading emote to Discord...')
                .setThumbnail(emote.animated && !disableAnimations ? animatedURL : staticURL)
                .setTimestamp()
                .setFooter({
                    text: `Executed by @${interaction.user.username}`
                })
                .setColor('#262626');

            try {
                console.log("Preparing to send embed...");
                await interaction.editReply({ embeds: [embed] });
                console.log("Embed sent successfully!");

                const guild = interaction.guild;
                if (!guild) {
                    console.error("Guild not found. Cannot upload emote.");
                    await interaction.editReply({ content: "`❌` This command must be used in a server." });
                    return;
                }

                console.log("Uploading emote to guild...");
                const emoji = await guild.emojis.create({
                    attachment: emote.animated && !disableAnimations ? animatedURL : staticURL,
                    name: name,
                    reason: `@${interaction.user.username} used /emote`
                });
                console.log("Emote uploaded:", emoji);

                embed.setDescription(`Emote ${emoji.toString()} **${emoji.name}** uploaded to Discord!`)
                    .setThumbnail(emote.animated && !disableAnimations ? animatedURL : staticURL)
                    .setColor('#00ff59');
                await interaction.editReply({ embeds: [embed] });
                console.log("Final reply sent with uploaded emote.");
            } catch (error) {
                console.error("Error uploading emote or editing reply:", error);
                embed.setDescription("`❌` An error occurred while uploading the emote.")
                    .setColor('#ff2323');
                await interaction.editReply({ embeds: [embed] });
            }
        });
    }
}

function errorMessage(err: Error) {
    if (err.message.includes("Asset exceeds maximum size:") || err.message.includes("Failed to resize asset below the maximum size:")) { return "Emote is too big. You can try to change it's size by using the \"size\" parameter." }
    else if (err.message.includes("name[STRING_TYPE_REGEX]")) { return "Emote name is invalid. You can change the name with the \"name\" parameter." }
    else return err.message
}