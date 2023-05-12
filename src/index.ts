import '@total-typescript/ts-reset';
import 'dotenv/config';
import { Client, ForumChannel, IntentsBitField, Message, Partials, ThreadChannel } from 'discord.js';
import { Octokit } from '@octokit/rest';
import { setTimeout } from 'timers/promises';
import { globalLogger } from '@app/logger';
import outdent from 'outdent';

const logger = globalLogger.child({ service: 'DiscoHub' });

const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = 'ImLunaHey';
const GITHUB_REPO = 'Jive'

const octokit = new Octokit({ auth: GITHUB_TOKEN });

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
    partials: [
        Partials.Message,
    ]
});

// Discord bot is connected
client.on('ready', () => {
    console.log(`Logged in as ${client.user?.tag}!`);
});

// New issue created
client.on('threadCreate', async ({ messages, parent, guild, }) => {
    // Only allow for a specific channel
    if (parent?.id !== DISCORD_CHANNEL_ID) return;
    let initialMessage: Message<boolean> | undefined = undefined;
    while (initialMessage === undefined) {
        await setTimeout(10);
        initialMessage = messages.cache.first();
    }

    // Get the message's thread
    const thread = initialMessage.channel;
    if (!thread.isThread()) return;

    // Get the thread's applied tags as names not IDs
    const tags = thread.appliedTags.map(tagId => (thread.parent as ForumChannel).availableTags.find(tag => tag.id === tagId)?.name).filter(Boolean);

    try {
        logger.info('Creating a new issue', {
            guildId: guild?.id,
            channelId: thread.id,
        });

        // Create a new Github issue
        const issue = await octokit.issues.create({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            // Use the OP's title as the issue title
            // only allow the first 50 chars
            title: thread.name.substring(0, 50),
            labels: tags,
            body: outdent`
                User: ${initialMessage.member?.displayName}
                Message: ${initialMessage.content}
    
                <hr>
    
                [Message](${initialMessage.url})
            `,
        });

        logger.info('Created a new issue', {
            guildId: guild?.id,
            channelId: thread.id,
            issueNumber: issue.data.number,
        });

        // Edit the thread's title to include the issue ID
        await thread.setName(`#${issue.data.number} ${thread.name}`);
    } catch (error: unknown) {
        logger.error('Failed creating a new issue', {
            guildId: guild?.id,
            channelId: thread.id,
            error,
        });
    }
});

// New comment
client.on('messageCreate', async message => {
    // Only allow for a specific channel
    if (!message.channel.isThread()) return;
    if (message.channel.parent && (message.channel.parent.id !== DISCORD_CHANNEL_ID)) return;

    // Get issue number from the thread title
    const issueNumber = Number(message.channel.name.split(' ')?.[0].substring(1));
    if (!issueNumber) return;

    try {
        logger.info('Creating a new comment', {
            guildId: message.guild?.id,
            userId: message.member?.id,
            messageId: message.id,
            issueNumber,
        });

        // Add new comment to github issue
        await octokit.issues.createComment({
            owner: GITHUB_OWNER,
            repo: GITHUB_REPO,
            issue_number: issueNumber,
            body: outdent`
                User: ${message.member?.displayName}
                Message: ${message.content}
    
                <hr>
    
                [Message](${message.url})
            `,
        });

        logger.info('Created a new comment', {
            guildId: message.guild?.id,
            userId: message.member?.id,
            messageId: message.id,
            issueNumber,
        });
    } catch (error: unknown) {
        // If we hit an error close the issue for now
        // TODO: Fix this one day?
        await (message.channel as ThreadChannel).setArchived();

        logger.error('Failed creating comment', {
            guildId: message.guild?.id,
            userId: message.member?.id,
            messageId: message.id,
            issueNumber,
            error,
        });
    }
});

client.login(DISCORD_TOKEN);

client.on('error', error => {
    logger.error('clientError', { error });
});

process.on('uncaughtException', error => {
    logger.error('uncaughtException', { error });
});

process.on('unhandledRejection', error => {
    logger.error('unhandledRejection', { error });
});
